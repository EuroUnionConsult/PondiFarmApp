"""Resiliência à base de dados serverless (Azure SQL) que adormece.

Depois de ~60 min sem uso, o Azure SQL serverless pausa. O 1.º login a seguir
falha com 40613 («Database ... is not currently available») enquanto a base
retoma, o que leva dezenas de segundos. Antes disto o pedido rebentava logo à
primeira, o handler genérico respondia 500 fora do CORS e o browser via só
«Failed to fetch».

Aqui ficam:
- `is_transient_db_error()`: erros que passam sozinhos (base a acordar, rede).
- `connect_with_retry()`: repete uma ligação NOVA com espera crescente, dentro
  de um prazo. Só UMA thread espera de cada vez; as outras respondem logo 503
  (`DatabaseWakingError`) para não ocuparem o threadpool todo à espera.
- `initialize_database_with_retry()`: o arranque espera pela base (só para
  erros transitórios) em vez de sair, dentro do limite do App Service (230 s).
"""

from __future__ import annotations

import logging
import re
import threading
import time
from collections.abc import Callable
from typing import TypeVar

T = TypeVar("T")

log = logging.getLogger("pondifarm.db")

# Códigos do SQL Server / Azure SQL que querem dizer «tenta outra vez»:
# 40613 base indisponível (a acordar), 40197 erro a processar (failover),
# 40501 serviço ocupado, 49918–49920 recursos insuficientes, 10928/10929
# limites de recursos, 233 sem processo na outra ponta do pipe,
# 10053/10054/10060 ligação cortada / recusada / sem resposta (TCP).
TRANSIENT_ERROR_CODES = frozenset(
    {40613, 40197, 40501, 49918, 49919, 49920, 10928, 10929, 233, 10053, 10054, 10060}
)
# SQLSTATE do ODBC: HYT00 timeout do login, 08S01 ligação perdida,
# 08001 o cliente não conseguiu abrir a ligação.
TRANSIENT_SQLSTATES = frozenset({"HYT00", "08S01", "08001"})

_CODE_RE = re.compile(r"\((\d{3,5})\)")
_STATE_RE = re.compile(r"\[([0-9A-Z]{5})\]")

# Prazo de uma ligação nova (todas as tentativas). Um pedido HTTP não deve ficar
# muito mais do que isto preso numa thread.
CONNECT_RETRY_BUDGET_S = 45.0
# Arranque: não começa uma nova tentativa depois disto. Pior caso = isto + uma
# tentativa (prazo acima + 1 login) ≈ 160 + 60 = 220 s, abaixo dos 230 s do
# App Service.
STARTUP_RETRY_BUDGET_S = 160.0
# Pausas do arranque entre tentativas.
STARTUP_BACKOFF_S = (2.0, 4.0, 8.0, 16.0, 30.0)
# O cliente volta a tentar ao fim de...
RETRY_AFTER_S = 10


class DatabaseWakingError(Exception):
    """Outra thread já está à espera que a base acorde: responde 503 já."""


def _driver_errors(exc: BaseException) -> list[BaseException]:
    """O erro do driver (pyodbc/sqlite3) e as causas encadeadas.

    Do erro do SQLAlchemy só interessa o `.orig`: o texto dele traz o SQL e os
    parâmetros, onde um número entre parênteses não quer dizer nada.
    """
    out: list[BaseException] = []
    seen: set[int] = set()
    stack: list[BaseException | None] = [exc]
    while stack and len(out) < 8:
        e = stack.pop()
        if e is None or id(e) in seen:
            continue
        seen.add(id(e))
        orig = getattr(e, "orig", None)
        if isinstance(orig, BaseException):
            stack.append(orig)
        else:
            out.append(e)
        stack.append(e.__cause__)
        stack.append(e.__context__)
    return out


def is_transient_db_error(exc: BaseException) -> bool:
    """True para erros da base que passam sozinhos (a acordar, failover, rede)."""
    for e in _driver_errors(exc):
        if isinstance(e, DatabaseWakingError):
            return True
        args = getattr(e, "args", ()) or ()
        if args and isinstance(args[0], str) and args[0].strip() in TRANSIENT_SQLSTATES:
            return True
        text = " ".join(str(a) for a in args)
        if any(int(c) in TRANSIENT_ERROR_CODES for c in _CODE_RE.findall(text)):
            return True
        if any(s in TRANSIENT_SQLSTATES for s in _STATE_RE.findall(text)):
            return True
    return False


_wake_lock = threading.Lock()


def connect_with_retry(
    connect: Callable[[], T],
    *,
    budget_s: float = CONNECT_RETRY_BUDGET_S,
    sleep: Callable[[float], None] | None = None,
    clock: Callable[[], float] | None = None,
) -> T:
    """Abre uma ligação; se o erro for transitório, repete com espera crescente.

    Só uma thread fica à espera da base: enquanto ela espera, as outras recebem
    `DatabaseWakingError` sem tentar (503 imediato, o cliente repete).
    """
    sleep = sleep or time.sleep
    clock = clock or time.monotonic
    if _wake_lock.locked():
        raise DatabaseWakingError("database is waking up")
    start = clock()
    try:
        return connect()
    except Exception as exc:
        if not is_transient_db_error(exc):
            raise
        last: Exception = exc
    if not _wake_lock.acquire(blocking=False):
        raise DatabaseWakingError("database is waking up") from last
    try:
        deadline = start + budget_s
        delay = 1.0
        attempt = 1
        while True:
            remaining = deadline - clock()
            if remaining <= 0:
                raise last
            log.warning(
                "database unavailable, retrying",
                extra={"attempt": attempt, "error_type": type(last).__name__},
            )
            sleep(min(delay, remaining))
            delay = min(delay * 2, 8.0)
            attempt += 1
            try:
                conn = connect()
            except Exception as exc:
                if not is_transient_db_error(exc):
                    raise
                last = exc
                continue
            log.info("database connection recovered", extra={"attempt": attempt})
            return conn
    finally:
        _wake_lock.release()


def install_connect_retry(engine) -> None:
    """Liga `connect_with_retry` a cada ligação nova do engine (pool e pre-ping)."""
    from sqlalchemy import event

    @event.listens_for(engine, "do_connect")
    def _do_connect(dialect, conn_rec, cargs, cparams):
        return connect_with_retry(lambda: dialect.connect(*cargs, **cparams))


def initialize_database_with_retry(
    init: Callable[[], None],
    *,
    budget_s: float = STARTUP_RETRY_BUDGET_S,
    backoff_s: tuple[float, ...] = STARTUP_BACKOFF_S,
    sleep: Callable[[float], None] | None = None,
    clock: Callable[[], float] | None = None,
) -> None:
    """Arranque: espera pela base adormecida em vez de sair à 1.ª falha.

    Erros que não são transitórios (configuração, permissões, SQL) saem logo.
    """
    sleep = sleep or time.sleep
    clock = clock or time.monotonic
    start = clock()
    attempt = 0
    while True:
        try:
            init()
            if attempt:
                log.info("database ready", extra={"attempt": attempt + 1})
            return
        except Exception as exc:
            if not is_transient_db_error(exc):
                raise
            pause = backoff_s[min(attempt, len(backoff_s) - 1)]
            if clock() - start + pause > budget_s:
                log.error("database still unavailable at startup, giving up")
                raise
            attempt += 1
            log.warning(
                "database unavailable at startup, waiting",
                extra={
                    "attempt": attempt,
                    "wait_s": pause,
                    "error_type": type(exc).__name__,
                },
            )
            sleep(pause)
