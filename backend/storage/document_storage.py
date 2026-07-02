from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Protocol
from uuid import UUID, uuid4

from core.config import get_settings


class StoredDocumentNotFoundError(FileNotFoundError):
    pass


class DocumentStorage(Protocol):
    def save(self, animal_id: UUID, file_name: str, content: bytes) -> str: ...

    def read(self, locator: str) -> bytes: ...

    def delete(self, locator: str) -> None: ...


class LocalPrivateDocumentStorage:
    def __init__(self, root_path: Path) -> None:
        self.root_path = Path(root_path).resolve()

    def save(self, animal_id: UUID, file_name: str, content: bytes) -> str:
        extension = Path(file_name).suffix.lower()
        locator = (
            Path("animals") / str(animal_id) / f"{uuid4().hex}{extension}"
        ).as_posix()
        target_path = self._resolve_locator(locator)
        target_path.parent.mkdir(parents=True, exist_ok=True)
        target_path.write_bytes(content)
        return locator

    def read(self, locator: str) -> bytes:
        target_path = self._resolve_locator(locator)
        if not target_path.is_file():
            raise StoredDocumentNotFoundError(locator)
        return target_path.read_bytes()

    def delete(self, locator: str) -> None:
        target_path = self._resolve_locator(locator)
        if target_path.is_file():
            target_path.unlink()

    def _resolve_locator(self, locator: str) -> Path:
        target_path = (self.root_path / Path(locator)).resolve()
        if target_path != self.root_path and self.root_path not in target_path.parents:
            raise ValueError("Invalid private storage locator")
        return target_path


@lru_cache(maxsize=1)
def get_document_storage() -> DocumentStorage:
    return LocalPrivateDocumentStorage(get_settings().document_storage_path)
