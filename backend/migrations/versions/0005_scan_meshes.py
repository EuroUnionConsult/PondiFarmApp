"""Modelos 3D dos scans (animal_scan_meshes).

Idempotente: o arranque da API (create_all) pode ter criado a tabela antes.
"""

from alembic import op
import sqlalchemy as sa

from models.models import GUID

revision = "0005_scan_meshes"
down_revision = "0004_merge_dup_euc"
branch_labels = None
depends_on = None

TABLE = "animal_scan_meshes"


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if TABLE in insp.get_table_names():
        return
    op.create_table(
        TABLE,
        sa.Column(
            "scan_id", GUID(), sa.ForeignKey("animal_scans.id"), primary_key=True
        ),
        sa.Column(
            "organization_id", GUID(), sa.ForeignKey("organizations.id"), nullable=False
        ),
        sa.Column("mesh_format", sa.String(8), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("data", sa.LargeBinary(), nullable=False),
        sa.Column(
            "uploaded_by_user_id", GUID(), sa.ForeignKey("users.id"), nullable=True
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint(
            "mesh_format IN ('ply', 'obj', 'glb')", name="chk_animal_scan_meshes_format"
        ),
    )
    op.create_index("ix_animal_scan_meshes_organization_id", TABLE, ["organization_id"])


def downgrade() -> None:
    op.drop_index("ix_animal_scan_meshes_organization_id", table_name=TABLE)
    op.drop_table(TABLE)
