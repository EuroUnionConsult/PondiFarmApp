"""Ponto de partida: o esquema de PRODUÇÃO tal como estava a 21/10/2026.

Não altera nada. Em produção aplica-se com `alembic stamp 0001_baseline`
(marca a base como estando nesta revisão). O esquema lido nesse dia está em
`Livestock Project/backend_esquema/esquema_prod_2026-10-21.txt` no vault —
inclui `animal_relationships` e um CHECK de papéis que o models.py não tinha.
Bases novas (testes, desenvolvimento) continuam a ser criadas pelo
`initialize_database()` no arranque; as migrações seguintes são idempotentes.
"""

revision = "0001_baseline"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
