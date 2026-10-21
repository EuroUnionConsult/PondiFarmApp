"""Líderes das organizações + correções de dados decididas a 21/10/2026.

1. Cada organização com membros ativos e sem Líder: o membro ativo mais antigo
   passa a `owner` (Líder). Todos os outros ficam `viewer` (Membro).
2. Índice único: no máximo 1 Líder ativo por organização.
3. Dados (decisão do Talys, 21/10): a organização real «PondiFarm» passa a
   chamar-se «Euro Union Consult»; as duas «Euro Union Consult» vazias (sem
   membros ativos nem animais) são arquivadas. Cada passo verifica o estado
   antes de mexer: numa base onde estes ids não existem, não faz nada.
"""

from datetime import datetime

from alembic import op
import sqlalchemy as sa

revision = "0003_leaders"
down_revision = "0002_join_requests"
branch_labels = None
depends_on = None

OWNER_INDEX = "ux_organization_members_one_owner"

REAL_ORG_ID = "AFA19BC8-1528-4802-95FA-24AD30305ADB"
REAL_ORG_OLD_NAME = "PondiFarm"
REAL_ORG_NEW_NAME = "Euro Union Consult"
EMPTY_DUPLICATES = (
    "3AC55B4F-9DB3-49F7-B601-FFE1DD18D1B2",  # «Euro Union Consult», 02/07
    "0A203A39-9328-4A71-954D-C4F888F51425",  # «Euro Union Consult (auto)», 29/09
)


def _id_param(bind, raw: str):
    """mssql: UNIQUEIDENTIFIER aceita o texto. sqlite (testes): o GUID guarda
    str(uuid) — minúsculas, com hífenes."""
    if bind.dialect.name == "mssql":
        return raw
    return raw.lower()


def upgrade() -> None:
    bind = op.get_bind()

    # 1. Um Líder por organização que ainda não tem.
    rows = bind.execute(
        sa.text(
            "SELECT id, organization_id, role, created_at FROM organization_members "
            "WHERE deleted_at IS NULL ORDER BY organization_id, created_at, id"
        )
    ).fetchall()
    by_org: dict = {}
    for r in rows:
        by_org.setdefault(r.organization_id, []).append(r)
    for members in by_org.values():
        if any(m.role == "owner" for m in members):
            continue
        bind.execute(
            sa.text("UPDATE organization_members SET role = 'owner' WHERE id = :id"),
            {"id": members[0].id},
        )

    # 2. Só depois de garantir no máximo 1 owner por organização.
    existing = {
        ix["name"] for ix in sa.inspect(bind).get_indexes("organization_members")
    }
    if OWNER_INDEX not in existing:
        op.create_index(
            OWNER_INDEX,
            "organization_members",
            ["organization_id"],
            unique=True,
            mssql_where=sa.text("role = 'owner' AND deleted_at IS NULL"),
            sqlite_where=sa.text("role = 'owner' AND deleted_at IS NULL"),
        )

    # 3a. Renomear a organização real — só se ainda tiver o nome antigo.
    bind.execute(
        sa.text(
            "UPDATE organizations SET name = :new, updated_at = :now "
            "WHERE id = :id AND name = :old AND deleted_at IS NULL"
        ),
        {
            "new": REAL_ORG_NEW_NAME,
            "old": REAL_ORG_OLD_NAME,
            "id": _id_param(bind, REAL_ORG_ID),
            "now": datetime.utcnow(),
        },
    )

    # 3b. Arquivar as duplicadas — só se continuarem vazias.
    for raw in EMPTY_DUPLICATES:
        oid = _id_param(bind, raw)
        active = bind.execute(
            sa.text(
                "SELECT COUNT(*) FROM organization_members "
                "WHERE organization_id = :id AND deleted_at IS NULL"
            ),
            {"id": oid},
        ).scalar()
        animals = bind.execute(
            sa.text("SELECT COUNT(*) FROM animals WHERE organization_id = :id"),
            {"id": oid},
        ).scalar()
        if active == 0 and animals == 0:
            bind.execute(
                sa.text(
                    "UPDATE organizations SET deleted_at = :now, updated_at = :now "
                    "WHERE id = :id AND deleted_at IS NULL"
                ),
                {"id": oid, "now": datetime.utcnow()},
            )


def downgrade() -> None:
    # Só o esquema. Os dados (quem é Líder, nome, arquivo) não se desfazem
    # sozinhos: há backup antes do deploy.
    op.drop_index(OWNER_INDEX, table_name="organization_members")
