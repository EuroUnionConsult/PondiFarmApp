"""Logs da API: stdout (sempre) e Azure Application Insights (só com connection string).

- `configure_logging()` põe os loggers `pondifarm.*` a escrever no stdout, que é o que
  o App Service guarda («Log stream» / ficheiros de log do contentor). Sem isto, os
  avisos iam para o handler de último recurso do Python, sem data nem nível.
- `configure_telemetry()` liga o Azure Monitor (OpenTelemetry) quando existe
  APPLICATIONINSIGHTS_CONNECTION_STRING. Localmente e nos testes não faz nada. Uma
  falha aqui nunca impede a API de arrancar: fica um aviso no log.

Os campos estruturados vão em `extra={...}` (ex.: provider, status, attempt, platform,
appVersion, screen) e aparecem como customDimensions no Application Insights e como
`chave=valor` no stdout. Emails, tokens JWT/Bearer e cabeçalhos de autorização são
mascarados antes de sair; as rotas nunca registam coordenadas exatas nem texto de
pesquisa, e a query string é retirada dos pedidos enviados para a telemetria.
"""

from __future__ import annotations

import logging
import os
import re
import sys

log = logging.getLogger("pondifarm.observability")

APP_LOGGER = "pondifarm"

_EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
_JWT = re.compile(r"\beyJ[\w-]+\.[\w-]+\.[\w-]+")
_BEARER = re.compile(r"(?i)\bbearer\s+[\w.~+/=-]+")

# Atributos que todo o LogRecord já tem; o resto veio de `extra=`.
_STD = set(vars(logging.LogRecord("", 0, "", 0, "", None, None))) | {
    "message",
    "asctime",
    "taskName",
}


def scrub(value):
    if isinstance(value, str):
        value = _BEARER.sub("Bearer [redacted]", value)
        value = _JWT.sub("[jwt]", value)
        return _EMAIL.sub("[email]", value)
    return value


class ScrubFilter(logging.Filter):
    """Mascara emails/JWT/Bearer na mensagem, nos argumentos e nos campos extra;
    tira os campos extra vazios (None)."""

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            record.msg = scrub(record.msg)
        if isinstance(record.args, tuple):
            record.args = tuple(scrub(a) for a in record.args)
        for k, v in list(vars(record).items()):
            if k in _STD:
                continue
            if v is None:
                # Atributos OpenTelemetry não aceitam None; também não interessam no stdout.
                delattr(record, k)
            elif isinstance(v, str):
                setattr(record, k, scrub(v))
        return True


class KeyValueFormatter(logging.Formatter):
    """`2026-11-23 10:00:00 WARNING pondifarm.weather upstream failure provider=… status=…`"""

    def format(self, record: logging.LogRecord) -> str:
        base = super().format(record)
        extras = " ".join(
            f"{k}={v}"
            for k, v in vars(record).items()
            if k not in _STD and not k.startswith("_")
        )
        return f"{base} {extras}" if extras else base


def configure_logging() -> None:
    """Idempotente: chamar duas vezes não duplica linhas."""
    app_logger = logging.getLogger(APP_LOGGER)
    app_logger.setLevel(os.getenv("LOG_LEVEL", "INFO").upper())
    if any(getattr(h, "_pondifarm", False) for h in app_logger.handlers):
        return
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        KeyValueFormatter("%(asctime)s %(levelname)s %(name)s %(message)s")
    )
    # Filtro no HANDLER: os filtros de um logger não se aplicam aos registos que
    # chegam dos filhos (pondifarm.weather, pondifarm.client…).
    handler.addFilter(ScrubFilter())
    handler._pondifarm = True  # type: ignore[attr-defined]
    app_logger.addHandler(handler)
    # O handler do Application Insights fica no próprio logger "pondifarm";
    # não é preciso propagar para a raiz (evita linhas duplicadas no stdout).
    app_logger.propagate = os.getenv("LOG_PROPAGATE", "0") == "1"


def _strip_query(value):
    return value.split("?", 1)[0] if isinstance(value, str) else value


def _query_stripping_processor():
    """SpanProcessor que tira a query string dos pedidos (ex.: /places/reverse?lat=…)."""
    from opentelemetry.sdk.trace import SpanProcessor

    keys = ("http.target", "http.url", "url.full", "url.query")

    class StripQuery(SpanProcessor):
        def on_start(self, span, parent_context=None):
            attrs = getattr(span, "attributes", None) or {}
            for k in keys:
                if k in attrs:
                    span.set_attribute(
                        k, "" if k == "url.query" else _strip_query(attrs[k])
                    )

        def on_end(self, span):
            pass

    return StripQuery()


def configure_telemetry() -> bool:
    """Liga o Azure Monitor se houver connection string. Devolve True se ficou ligado."""
    conn = os.getenv("APPLICATIONINSIGHTS_CONNECTION_STRING", "").strip()
    if not conn:
        return False
    try:
        from azure.monitor.opentelemetry import configure_azure_monitor

        # Pedidos (traces): amostragem fixa, por omissão 25 %. Os logs NÃO seguem a
        # amostragem dos traces: todos os avisos e erros de "pondifarm.*" são enviados.
        ratio = float(os.getenv("APPINSIGHTS_SAMPLING_RATIO", "0.25"))
        configure_azure_monitor(
            connection_string=conn,
            logger_name=APP_LOGGER,
            sampling_ratio=min(1.0, max(0.0, ratio)),
            enable_trace_based_sampling_for_logs=False,
            enable_live_metrics=False,
            span_processors=[_query_stripping_processor()],
        )
        # Para o Application Insights só vão avisos e erros; o INFO fica no stdout.
        export_level = os.getenv("APPINSIGHTS_LOG_LEVEL", "WARNING").upper()
        for h in logging.getLogger(APP_LOGGER).handlers:
            if not getattr(h, "_pondifarm", False):
                h.setLevel(export_level)
                h.addFilter(ScrubFilter())
        log.info("azure monitor enabled", extra={"sampling_ratio": ratio})
        return True
    except Exception as e:  # noqa: BLE001 — telemetria nunca derruba o arranque
        log.warning("azure monitor not enabled", extra={"error_type": type(e).__name__})
        return False
