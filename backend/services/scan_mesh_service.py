"""Modelos 3D dos scans: validar, guardar e devolver.

A malha fica numa tabela própria (animal_scan_meshes). Só se aceita o que o
scanner produz: PLY, OBJ e GLB, até MESH_MAX_BYTES, e o conteúdo tem de bater
com o formato declarado (assinatura do ficheiro), para não se guardar qualquer coisa.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from models.models import MESH_FORMATS, MESH_MAX_BYTES, AnimalScan, AnimalScanMesh

MEDIA_TYPES = {
    "ply": "application/octet-stream",
    "obj": "text/plain; charset=utf-8",
    "glb": "model/gltf-binary",
}


def _looks_like(fmt: str, data: bytes) -> bool:
    head = data[:2048]
    if fmt == "ply":
        return head.startswith(b"ply")
    if fmt == "glb":
        return head.startswith(b"glTF")
    # OBJ é texto: linhas de comentário (#) ou de vértices (v x y z).
    try:
        text = head.decode("utf-8")
    except UnicodeDecodeError:
        return False
    return any(
        line.startswith(("v ", "#", "o ", "mtllib")) for line in text.splitlines()[:20]
    )


def save_mesh(
    db: Session, scan: AnimalScan, user_id: UUID | None, fmt: str, data: bytes
) -> AnimalScanMesh:
    if fmt not in MESH_FORMATS:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "Formato de malha não suportado"
        )
    if not data:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Malha vazia")
    if len(data) > MESH_MAX_BYTES:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, "Malha demasiado grande")
    if not _looks_like(fmt, data):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "O conteúdo não corresponde ao formato indicado",
        )
    row = db.get(AnimalScanMesh, scan.id)
    if row is None:
        row = AnimalScanMesh(scan_id=scan.id, organization_id=scan.organization_id)
        db.add(row)
    row.mesh_format = fmt
    row.size_bytes = len(data)
    row.data = data
    row.uploaded_by_user_id = user_id
    row.updated_at = datetime.utcnow()
    db.commit()
    return row


def get_mesh(db: Session, scan: AnimalScan) -> AnimalScanMesh:
    row = db.get(AnimalScanMesh, scan.id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Este scan não tem modelo 3D")
    return row
