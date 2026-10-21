"""Migrações Alembic contra uma base que imita a de produção a 21/10/2026:
sem tabela de pedidos, sem índice de Líder, todos os membros `viewer`."""

import os
import tempfile
import unittest
import uuid
from datetime import datetime, timedelta

os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("JWT_SECRET", "segredo-so-para-testes")

from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from sqlalchemy import create_engine, inspect, text  # noqa: E402

from core.database import Base  # noqa: E402
import models.models  # noqa: E402,F401

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REAL = "afa19bc8-1528-4802-95fa-24ad30305adb"
DUP_EMPTY = "3ac55b4f-9db3-49f7-b601-ffe1dd18d1b2"
DUP_WITH_MEMBER = "0a203a39-9328-4a71-954d-c4f888f51425"


def _uid():
    return str(uuid.uuid4())


class MigrationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.url = f"sqlite:///{self.tmp.name}"
        self.engine = create_engine(self.url, future=True)
        Base.metadata.create_all(self.engine)
        with self.engine.begin() as c:
            # Imitar produção: sem a tabela nova e sem o índice de Líder.
            c.execute(text("DROP TABLE organization_join_requests"))
            c.execute(text("DROP INDEX ux_organization_members_one_owner"))
            t0 = datetime(2026, 6, 1)
            self.users = {n: _uid() for n in ("talys", "valter", "junior", "outro")}
            for name, uid in self.users.items():
                c.execute(
                    text(
                        "INSERT INTO users (id, name, email, password_hash, created_at, updated_at) "
                        "VALUES (:id, :n, :e, 'x', :t, :t)"
                    ),
                    {"id": uid, "n": name, "e": f"{name}@x.pt", "t": t0},
                )
            for oid, name in (
                (REAL, "PondiFarm"),
                (DUP_EMPTY, "Euro Union Consult"),
                (DUP_WITH_MEMBER, "Euro Union Consult (auto)"),
            ):
                c.execute(
                    text(
                        "INSERT INTO organizations (id, name, document_number, created_at, updated_at) "
                        "VALUES (:id, :n, :d, :t, :t)"
                    ),
                    {"id": oid, "n": name, "d": f"DOC-{oid[:8]}", "t": t0},
                )

            def member(oid, user, when, deleted=None):
                c.execute(
                    text(
                        "INSERT INTO organization_members "
                        "(id, organization_id, user_id, role, created_at, updated_at, deleted_at) "
                        "VALUES (:id, :o, :u, 'viewer', :t, :t, :d)"
                    ),
                    {
                        "id": _uid(),
                        "o": oid,
                        "u": self.users[user],
                        "t": when,
                        "d": deleted,
                    },
                )

            member(REAL, "valter", t0 + timedelta(days=90))
            member(REAL, "talys", t0 + timedelta(days=30))  # mais antigo → Líder
            member(DUP_EMPTY, "talys", t0, deleted=t0 + timedelta(days=1))  # removido
            member(DUP_WITH_MEMBER, "outro", t0)  # ainda tem membro → não arquiva

    def tearDown(self):
        self.engine.dispose()
        os.unlink(self.tmp.name)

    def _alembic(self):
        cfg = Config(os.path.join(HERE, "alembic.ini"))
        cfg.set_main_option("script_location", os.path.join(HERE, "migrations"))
        cfg.cmd_opts = type("o", (), {"x": [f"url={self.url}"]})()
        return cfg

    def _role(self, c, org, user):
        return c.execute(
            text(
                "SELECT role FROM organization_members WHERE organization_id = :o AND user_id = :u"
            ),
            {"o": org, "u": self.users[user]},
        ).scalar()

    def test_upgrade_from_production_like_state(self):
        command.upgrade(self._alembic(), "head")
        insp = inspect(self.engine)
        self.assertIn("organization_join_requests", insp.get_table_names())
        self.assertIn(
            "ux_organization_members_one_owner",
            {ix["name"] for ix in insp.get_indexes("organization_members")},
        )
        with self.engine.connect() as c:
            self.assertEqual(self._role(c, REAL, "talys"), "owner")
            self.assertEqual(self._role(c, REAL, "valter"), "viewer")
            self.assertEqual(self._role(c, DUP_WITH_MEMBER, "outro"), "owner")
            names = dict(
                c.execute(text("SELECT id, name FROM organizations")).fetchall()
            )
            self.assertEqual(names[REAL], "Euro Union Consult")
            archived = dict(
                c.execute(text("SELECT id, deleted_at FROM organizations")).fetchall()
            )
            self.assertIsNotNone(archived[DUP_EMPTY])
            self.assertIsNone(archived[DUP_WITH_MEMBER])
            self.assertIsNone(archived[REAL])

    def test_running_again_changes_nothing(self):
        cfg = self._alembic()
        command.upgrade(cfg, "head")
        with self.engine.connect() as c:
            before = c.execute(
                text(
                    "SELECT id, role, deleted_at FROM organization_members ORDER BY id"
                )
            ).fetchall()
        command.stamp(cfg, "0001_baseline")
        command.upgrade(cfg, "head")
        with self.engine.connect() as c:
            after = c.execute(
                text(
                    "SELECT id, role, deleted_at FROM organization_members ORDER BY id"
                )
            ).fetchall()
        self.assertEqual(before, after)

    def test_existing_leader_is_kept(self):
        with self.engine.begin() as c:
            c.execute(
                text(
                    "UPDATE organization_members SET role = 'owner' "
                    "WHERE organization_id = :o AND user_id = :u"
                ),
                {"o": REAL, "u": self.users["valter"]},
            )
        command.upgrade(self._alembic(), "head")
        with self.engine.connect() as c:
            self.assertEqual(self._role(c, REAL, "valter"), "owner")
            self.assertEqual(self._role(c, REAL, "talys"), "viewer")


if __name__ == "__main__":
    unittest.main()
