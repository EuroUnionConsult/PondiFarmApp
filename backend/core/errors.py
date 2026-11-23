import logging
import traceback

from fastapi.encoders import jsonable_encoder
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request, exc):
        return JSONResponse(
            status_code=400,
            content={"detail": jsonable_encoder(exc.errors())},
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request, exc):
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
        return JSONResponse(
            status_code=500, content={"detail": "Internal Server Error"}
        )
