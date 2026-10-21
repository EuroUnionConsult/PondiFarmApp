"""Pedidos de entrada numa organização (organization_join_requests).

Idempotente: o arranque da API (create_all) pode ter criado a tabela antes.
"""

from alembic import op
import sqlalchemy as sa

from models.models import GUID

revision = "0002_join_requests"
down_revision = "0001_baseline"
branch_labels = None
depends_on = None

TABLE = "organization_join_requests"
PENDING_INDEX = "ux_organization_join_requests_pending"


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if TABLE not in insp.get_table_names():
        op.create_table(
            TABLE,
            sa.Column("id", GUID(), primary_key=True),
            sa.Column(
                "organization_id",
                GUID(),
                sa.ForeignKey("organizations.id"),
                nullable=False,
            ),
            sa.Column("user_id", GUID(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column(
                "status", sa.String(20), nullable=False, server_default="pending"
            ),
            sa.Column(
                "created_at",
                sa.DateTime(),
                nullable=False,
                server_default=sa.func.current_timestamp(),
            ),
            sa.Column("decided_at", sa.DateTime(), nullable=True),
            sa.Column(
                "decided_by_user_id", GUID(), sa.ForeignKey("users.id"), nullable=True
            ),
            sa.CheckConstraint(
                "status IN ('pending', 'approved', 'rejected', 'cancelled')",
                name="chk_organization_join_requests_status",
            ),
        )
    existing = {ix["name"] for ix in sa.inspect(bind).get_indexes(TABLE)}
    if PENDING_INDEX not in existing:
        op.create_index(
            PENDING_INDEX,
            TABLE,
            ["organization_id", "user_id"],
            unique=True,
            mssql_where=sa.text("status = 'pending'"),
            sqlite_where=sa.text("status = 'pending'"),
        )


def downgrade() -> None:
    op.drop_table(TABLE)
