"""Junta uma organização duplicada à «Euro Union Consult» (decisão do Líder, 21/10/2026).

A 17/10 uma conta registou-se e o registo de então criou-lhe uma organização
própria, também chamada «Euro Union Consult» — duas organizações com o mesmo nome
na pesquisa. Decidido:
  1. os animais dela (e tudo o que lhes pertence: scans, documentos, consultas,
     parentesco) passam para a «Euro Union Consult» real;
  2. a pessoa deixa de ser membro da organização própria e fica com um pedido de
     entrada PENDENTE na EUC, até o Líder a aprovar;
  3. a organização duplicada, já vazia, é arquivada.
Sem dados pessoais aqui (o repositório é público): a pessoa é o ÚNICO membro
ativo da organização duplicada, identificada pelo id.

Em produção as tabelas filhas apontam para os animais por chave COMPOSTA
(animal_id, organization_id) → animals(id, organization_id), que o models.py não
tem. Mudar a organização dos animais em qualquer ordem violaria essas chaves, por
isso, dentro da mesma transação: suspende-se a verificação, muda-se tudo e
reativa-se COM revalidação de todas as linhas (WITH CHECK CHECK CONSTRAINT) — se
alguma linha ficasse inconsistente, a revalidação falha e a transação desfaz-se.
As chaves são descobertas na própria base, não pelos nomes do código.

Cada passo verifica o estado antes de mexer: numa base sem estes ids, onde a
mudança já foi feita, ou se a organização tiver mais de um membro, não faz nada.
"""

import uuid
from datetime import datetime

from alembic import op
import sqlalchemy as sa

revision = "0004_merge_dup_euc"
down_revision = "0003_leaders"
branch_labels = None
depends_on = None

EUC_ORG_ID = "AFA19BC8-1528-4802-95FA-24AD30305ADB"
DUPLICATE_ORG_ID = "B02683CE-71A4-4367-BAA3-D2505A45CCDC"  # criada a 17/10/2026

# Tabelas que guardam organization_id junto de animal_id (seguem os animais).
CHILD_TABLES = (
    "animal_scans",
    "animal_documents",
    "veterinary_appointments",
    "animal_relationships",
)


def _id(bind, raw: str):
    return raw if bind.dialect.name == "mssql" else raw.lower()


def _scalar(bind, sql: str, **params):
    return bind.execute(sa.text(sql), params).scalar()


def _composite_fks_to_animals(bind) -> list[tuple[str, str]]:
    """(tabela, nome da FK) das chaves em mssql que apontam para animals e
    incluem organization_id."""
    if bind.dialect.name != "mssql":
        return []
    rows = bind.execute(
        sa.text(
            "SELECT DISTINCT OBJECT_NAME(f.parent_object_id) AS tbl, f.name AS fk_name "
            "FROM sys.foreign_keys f JOIN sys.foreign_key_columns fc ON fc.constraint_object_id = f.object_id "
            "WHERE f.referenced_object_id = OBJECT_ID('animals') "
            "AND COL_NAME(fc.parent_object_id, fc.parent_column_id) = 'organization_id'"
        )
    ).fetchall()
    # Atenção: `Row.t` é reservado no SQLAlchemy 2.0 (devolve o tuplo) — daí tbl/fk_name.
    return [(r.tbl, r.fk_name) for r in rows]


def upgrade() -> None:
    bind = op.get_bind()
    euc, jr = _id(bind, EUC_ORG_ID), _id(bind, DUPLICATE_ORG_ID)

    live = "SELECT COUNT(*) FROM organizations WHERE id = :id AND deleted_at IS NULL"
    if not _scalar(bind, live, id=euc) or not _scalar(bind, live, id=jr):
        return  # base sem estas organizações, ou a duplicada já arquivada

    members = bind.execute(
        sa.text(
            "SELECT user_id FROM organization_members "
            "WHERE organization_id = :o AND deleted_at IS NULL"
        ),
        {"o": jr},
    ).fetchall()
    if len(members) != 1:
        return  # não é a organização de uma só pessoa que se esperava — não mexer
    user_id = members[0].user_id

    now = datetime.utcnow()

    # 1. Animais e tudo o que lhes pertence → EUC.
    existing = set(sa.inspect(bind).get_table_names())
    fks = _composite_fks_to_animals(bind)
    for t, fk in fks:
        bind.execute(sa.text(f"ALTER TABLE [{t}] NOCHECK CONSTRAINT [{fk}]"))
    for t in CHILD_TABLES:
        if t in existing and "organization_id" in {
            c["name"] for c in sa.inspect(bind).get_columns(t)
        }:
            bind.execute(
                sa.text(
                    f"UPDATE {t} SET organization_id = :euc WHERE organization_id = :jr"
                ),
                {"euc": euc, "jr": jr},
            )
    bind.execute(
        sa.text(
            "UPDATE animals SET organization_id = :euc, updated_at = :now WHERE organization_id = :jr"
        ),
        {"euc": euc, "jr": jr, "now": now},
    )
    for t, fk in fks:
        # Revalida TODAS as linhas: se alguma ficou inconsistente, isto falha e
        # a transação inteira (incluindo os UPDATE acima) é desfeita.
        bind.execute(sa.text(f"ALTER TABLE [{t}] WITH CHECK CHECK CONSTRAINT [{fk}]"))

    # 2. Sai da organização própria e fica pendente na EUC.
    bind.execute(
        sa.text(
            "UPDATE organization_members SET deleted_at = :now, updated_at = :now "
            "WHERE organization_id = :jr AND user_id = :u AND deleted_at IS NULL"
        ),
        {"now": now, "jr": jr, "u": user_id},
    )
    already = _scalar(
        bind,
        "SELECT COUNT(*) FROM organization_join_requests WHERE user_id = :u AND status = 'pending'",
        u=user_id,
    )
    member_of_euc = _scalar(
        bind,
        "SELECT COUNT(*) FROM organization_members WHERE organization_id = :euc "
        "AND user_id = :u AND deleted_at IS NULL",
        euc=euc,
        u=user_id,
    )
    if not already and not member_of_euc:
        rid = str(uuid.uuid4())
        bind.execute(
            sa.text(
                "INSERT INTO organization_join_requests (id, organization_id, user_id, status, created_at) "
                "VALUES (:id, :euc, :u, 'pending', :now)"
            ),
            {"id": rid, "euc": euc, "u": user_id, "now": now},
        )

    # 3. Arquivar a organização dele, agora vazia.
    if not _scalar(
        bind, "SELECT COUNT(*) FROM animals WHERE organization_id = :jr", jr=jr
    ):
        bind.execute(
            sa.text(
                "UPDATE organizations SET deleted_at = :now, updated_at = :now WHERE id = :jr"
            ),
            {"now": now, "jr": jr},
        )


def downgrade() -> None:
    # Mudança de dados: não se desfaz sozinha (há backup antes do deploy).
    pass
