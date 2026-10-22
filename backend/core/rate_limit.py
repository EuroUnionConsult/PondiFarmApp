"""Limite de tentativas em memória para as rotas de autenticação.

Janela deslizante por chave (IP, ou IP + email). Cada worker do uvicorn tem o
seu contador; com um só worker (o Dockerfile atual) o limite é exato. Se um
dia houver vários workers ou instâncias, isto passa a ser um limite por worker
e deve ir para um armazenamento partilhado (Redis).
"""

from __future__ import annotations

import math
import os
import threading
import time
from collections import deque

from fastapi import HTTPException, Request, status

_lock = threading.Lock()
_hits: dict[str, deque[float]] = {}


def _enabled() -> bool:
    return os.getenv("RATE_LIMIT_ENABLED", "1") != "0"


def client_ip(request: Request) -> str:
    """IP do cliente. No Azure App Service o front-end acrescenta o IP real ao
    fim do X-Forwarded-For; os valores à esquerda vêm do cliente e podem ser
    falsos, por isso usa-se o último. Pode vir com porta (1.2.3.4:5678)."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        last = forwarded.split(",")[-1].strip()
        if last.count(":") == 1:  # IPv4 com porta; IPv6 tem vários «:»
            last = last.split(":")[0]
        if last:
            return last
    return request.client.host if request.client else "unknown"


def hit(key: str, limit: int, window_s: int) -> None:
    """Verifica e regista numa só operação (sob o lock): 429 se a chave já tem
    `limit` registos na janela. Ser atómico importa: o hash da senha demora, e
    pedidos em paralelo não podem passar todos antes de algum ser contado."""
    if not _enabled():
        return
    now = time.monotonic()
    with _lock:
        q = _hits.setdefault(key, deque())
        while q and q[0] <= now - window_s:
            q.popleft()
        if len(q) >= limit:
            retry = max(1, math.ceil(q[0] + window_s - now))
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                "Demasiadas tentativas. Tente novamente mais tarde.",
                headers={"Retry-After": str(retry)},
            )
        q.append(now)
        # Limpeza ocasional para a memória não crescer com chaves que não voltam.
        if len(_hits) > 10_000:
            for k in [k for k, v in _hits.items() if not v or v[-1] <= now - 3600]:
                del _hits[k]


def release(key: str) -> None:
    """Devolve a última tentativa reservada com `hit` (ex.: a senha estava certa)."""
    with _lock:
        q = _hits.get(key)
        if q:
            q.pop()


def clear(key: str) -> None:
    with _lock:
        _hits.pop(key, None)


def reset() -> None:
    """Esvazia todos os contadores (testes)."""
    with _lock:
        _hits.clear()
