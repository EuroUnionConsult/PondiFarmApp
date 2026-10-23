"""Modelos 3D dos scans: validar, guardar e devolver.

A malha fica numa tabela própria (animal_scan_meshes). Só se aceita o que o
scanner produz: PLY, OBJ e GLB, até MESH_MAX_BYTES, e o conteúdo tem de bater
com o formato declarado (assinatura do ficheiro), para não se guardar qualquer coisa.
"""

from __future__ import annotations

import io
from collections import OrderedDict
from datetime import datetime
from threading import Lock
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


# Conversões recentes em memória (o mesmo modelo é pedido várias vezes seguidas),
# com teto em BYTES, não só em itens: um PLY de texto pode ter vários MB.
_ply_cache: OrderedDict[tuple[UUID, datetime], bytes] = OrderedDict()
_ply_lock = Lock()
_PLY_CACHE_MAX_BYTES = 64 * 1024 * 1024

# Limites da conversão. Um GLB de 15 MB pode repetir a mesma malha milhares de
# vezes (instâncias) ou trazer uma textura enorme: sem isto, achatar o modelo
# podia gastar memória e CPU sem fim. As malhas reais ficam muito abaixo
# (a maior da sessão de campo tem ~100 mil vértices e textura de 4096 px).
MAX_CONVERT_VERTICES = 2_000_000
MAX_TEXTURE_PIXELS = 4096 * 4096
MAX_PLY_BYTES = 40 * 1024 * 1024


def _too_big() -> HTTPException:
    return HTTPException(
        status.HTTP_413_CONTENT_TOO_LARGE, "Modelo 3D demasiado grande para converter"
    )


def as_ply(mesh: AnimalScanMesh) -> bytes:
    """O modelo em PLY (texto, com cor por vértice), para o visualizador do iPhone.

    O SceneKit/ModelIO do iPhone abre PLY e OBJ mas não GLB; as malhas da sessão
    de campo são GLB (Polycam). Converte-se aqui com o trimesh; PLY passa direto.
    """
    if mesh.mesh_format == "ply":
        return mesh.data
    key = (mesh.scan_id, mesh.updated_at)
    with _ply_lock:
        if key in _ply_cache:
            _ply_cache.move_to_end(key)
            return _ply_cache[key]
    import trimesh  # só quando é preciso converter

    try:
        scene = trimesh.load(
            io.BytesIO(mesh.data), file_type=mesh.mesh_format, force="scene"
        )
        # Conta os vértices de TODAS as instâncias antes de achatar a cena.
        total = 0
        for node in scene.graph.nodes_geometry:
            _, geom_name = scene.graph[node]
            g = scene.geometry.get(geom_name)
            total += len(getattr(g, "vertices", ()))
            if total > MAX_CONVERT_VERTICES:
                raise _too_big()
        m = (
            scene.to_geometry()
            if hasattr(scene, "to_geometry")
            else scene.dump(concatenate=True)
        )
        img = getattr(
            getattr(getattr(m, "visual", None), "material", None), "image", None
        )
        if img is None or img.width * img.height <= MAX_TEXTURE_PIXELS:
            try:
                m.visual = m.visual.to_color()  # textura -> cor por vértice
            except Exception:
                pass  # sem textura: fica só a forma
        out = m.export(file_type="ply", encoding="ascii")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "Não foi possível converter o modelo 3D",
        ) from exc
    if len(out) > MAX_PLY_BYTES:
        raise _too_big()
    with _ply_lock:
        _ply_cache[key] = out
        while (
            sum(len(v) for v in _ply_cache.values()) > _PLY_CACHE_MAX_BYTES
            and len(_ply_cache) > 1
        ):
            _ply_cache.popitem(last=False)
    return out
