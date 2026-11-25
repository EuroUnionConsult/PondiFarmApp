import logging
import traceback

from fastapi.encoders import jsonable_encoder
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from core.db_resilience import RETRY_AFTER_S, is_transient_db_error


def _log_unhandled(request: Request, exc: BaseException) -> None:
    # Só o tipo, a rota e a pilha de chamadas (sem a mensagem da exceção, que pode
    # trazer dados do pedido, ex.: parâmetros de SQL).
    route = getattr(request.scope.get("route"), "path", None) or "unmatched"
    logging.getLogger("pondifarm.errors").error(
        "unhandled exception",
        extra={
            "route": route,
            "method": request.method,
            "error_type": type(exc).__name__,
            "stack": "".join(traceback.format_tb(exc.__traceback__))[-4000:],
        },
    )


def error_response(request: Request, exc: BaseException) -> JSONResponse:
    """503 + Retry-After quando a base está a acordar; 500 (registado) no resto."""
    if is_transient_db_error(exc):
        route = getattr(request.scope.get("route"), "path", None) or "unmatched"
        logging.getLogger("pondifarm.errors").warning(
            "database waking",
            extra={
                "route": route,
                "method": request.method,
                "error_type": type(exc).__name__,
            },
        )
        return JSONResponse(
            status_code=503,
            content={"detail": "database_waking"},
            headers={"Retry-After": str(RETRY_AFTER_S)},
        )
    _log_unhandled(request, exc)
    return JSONResponse(status_code=500, content={"detail": "Internal Server Error"})


class ServerErrorResponseMiddleware:
    """Transforma exceções não tratadas em JSON DENTRO do CORS.

    O `exception_handler(Exception)` do FastAPI corre no ServerErrorMiddleware,
    por fora de todos os middlewares: as respostas 500 saíam sem
    Access-Control-Allow-Origin e o browser só via «Failed to fetch». Este
    middleware fica por dentro do CORSMiddleware (main.py adiciona-o antes),
    por isso qualquer 5xx leva os cabeçalhos CORS da origem permitida.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        started = False

        async def _send(message):
            nonlocal started
            if message["type"] == "http.response.start":
                started = True
            await send(message)

        try:
            await self.app(scope, receive, _send)
        except Exception as exc:
            if started:
                raise
            response = error_response(Request(scope), exc)
            await response(scope, receive, send)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request, exc):
        return JSONResponse(
            status_code=400,
            content={"detail": jsonable_encoder(exc.errors())},
        )

    # Última rede (erros nos middlewares de fora). Os erros das rotas já são
    # tratados pelo ServerErrorResponseMiddleware, dentro do CORS.
    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request, exc):
        return error_response(request, exc)
