"""Ações em massa do Líder: aprovar/recusar vários pedidos e remover várias
pessoas. Mesmas regras das ações individuais, resultado item a item."""

import os
import unittest
import uuid

os.environ["DATABASE_URL"] = "sqlite://"
os.environ.setdefault("JWT_SECRET", "segredo-so-para-testes")

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, event  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from api.v1.organization_access import organization_access_routes as routes  # noqa: E402
from core import rate_limit  # noqa: E402
from core.database import Base, get_db  # noqa: E402
from main import app  # noqa: E402
from models.models import OrganizationEvent, OrganizationMember  # noqa: E402

PW = "senha-forte-123"


BAD = 400


class OrganizationBulkTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine(
            "sqlite://",
            future=True,
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )

        @event.listens_for(cls.engine, "connect")
        def _fk(dbapi_connection, _):
            cur = dbapi_connection.cursor()
            cur.execute("PRAGMA foreign_keys=ON")
            cur.close()

        cls.Session = sessionmaker(bind=cls.engine, autoflush=False, future=True)

        def override_get_db():
            db = cls.Session()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.clear()
        cls.engine.dispose()

    def setUp(self):
        rate_limit.reset()
        Base.metadata.drop_all(bind=self.engine)
        Base.metadata.create_all(bind=self.engine)

    # --- ajudas ---------------------------------------------------------------

    def h(self, token):
        return {"Authorization": f"Bearer {token}"}

    def register(self, email, org=None, name="Pessoa"):
        # O registo tem limite por IP; aqui criam-se muitas contas de propósito.
        rate_limit.reset()
        body = {"name": name, "email": email, "password": PW}
        if org:
            body["organizationName"] = org
        r = self.client.post("/api/v1/auth/register", json=body)
        self.assertEqual(r.status_code, 201, r.text)
        return r.json()["accessToken"]

    def me(self, token):
        r = self.client.get("/api/v1/auth/me", headers=self.h(token))
        self.assertEqual(r.status_code, 200, r.text)
        return r.json()

    def refresh(self, token):
        r = self.client.post("/api/v1/auth/token/refresh", headers=self.h(token))
        self.assertEqual(r.status_code, 200, r.text)
        return r.json()["accessToken"]

    def leader_and_org(self, email="lider@euc.pt", org="Euro Union Consult"):
        token = self.register(email, org=org, name="Talys")
        return token, self.me(token)["organizationId"]

    def pending(self, email, org_id, name="Novo"):
        token = self.register(email, name=name)
        r = self.client.post(
            "/api/v1/organizations/join-requests",
            json={"organizationId": org_id},
            headers=self.h(token),
        )
        self.assertEqual(r.status_code, 201, r.text)
        return token, r.json()["id"]

    def bulk_requests(self, token, org_id, ids, action):
        return self.client.post(
            f"/api/v1/organizations/{org_id}/join-requests/bulk",
            json={"ids": ids, "action": action},
            headers=self.h(token),
        )

    def bulk_remove(self, token, org_id, user_ids):
        return self.client.post(
            f"/api/v1/organizations/{org_id}/members/bulk-remove",
            json={"userIds": user_ids},
            headers=self.h(token),
        )

    def members(self, leader, org_id, n):
        """n membros aprovados; devolve [(token, user_id)]."""
        reqs = [self.pending(f"m{i}@euc.pt", org_id, name=f"M{i}") for i in range(n)]
        r = self.bulk_requests(leader, org_id, [rid for _, rid in reqs], "approve")
        self.assertEqual(r.status_code, 200, r.text)
        out = []
        for token, _ in reqs:
            token = self.refresh(token)
            out.append((token, self.me(token)["id"]))
        return out

    def by_id(self, body):
        return {it["id"]: it for it in body["results"]}

    def event_types(self, org_id):
        with self.Session() as db:
            return [
                e.type
                for e in db.query(OrganizationEvent)
                .filter(OrganizationEvent.organization_id == uuid.UUID(org_id))
                .all()
            ]

    # --- pedidos --------------------------------------------------------------

    def test_leader_approves_and_denies_many(self):
        leader, org = self.leader_and_org()
        reqs = [self.pending(f"p{i}@x.pt", org, name=f"P{i}") for i in range(5)]
        ids = [rid for _, rid in reqs]

        ok = self.bulk_requests(leader, org, ids[:3], "approve")
        self.assertEqual(ok.status_code, 200, ok.text)
        self.assertEqual((ok.json()["succeeded"], ok.json()["failed"]), (3, 0))
        self.assertTrue(all(it["ok"] for it in ok.json()["results"]))

        no = self.bulk_requests(leader, org, ids[3:], "deny")
        self.assertEqual(no.status_code, 200, no.text)
        self.assertEqual((no.json()["succeeded"], no.json()["failed"]), (2, 0))

        people = self.client.get(
            f"/api/v1/organizations/{org}/people", headers=self.h(leader)
        ).json()
        self.assertEqual(len(people), 4)  # Líder + 3 aprovados
        left = self.client.get(
            f"/api/v1/organizations/{org}/join-requests", headers=self.h(leader)
        ).json()
        self.assertEqual(left, [])
        # Um evento por pessoa, como nas ações individuais.
        types = self.event_types(org)
        self.assertEqual(types.count("approved"), 3)
        self.assertEqual(types.count("rejected"), 2)
        # Quem foi recusado continua sem organização.
        self.assertEqual(self.me(reqs[3][0])["membershipStatus"], "none")

    def test_requests_mixed_valid_and_invalid_is_partial(self):
        leader, org = self.leader_and_org()
        _, a = self.pending("a@x.pt", org)
        _, b = self.pending("b@x.pt", org)
        # b já foi tratado individualmente; um id inventado; a repetido.
        self.client.post(
            f"/api/v1/organizations/{org}/join-requests/{b}/reject",
            headers=self.h(leader),
        )
        ghost = str(uuid.uuid4())
        r = self.bulk_requests(leader, org, [a, b, ghost, a], "approve")
        self.assertEqual(r.status_code, 200, r.text)
        body = r.json()
        self.assertEqual((body["succeeded"], body["failed"]), (1, 2))
        self.assertEqual(len(body["results"]), 3)  # repetidos contam uma vez
        res = self.by_id(body)
        self.assertTrue(res[a]["ok"])
        self.assertIsNone(res[a]["reason"])
        self.assertEqual(res[b]["reason"], "already_handled")
        self.assertEqual(res[ghost]["reason"], "already_handled")

    def test_request_of_another_org_is_not_touched(self):
        leader, org = self.leader_and_org()
        _, other_org = self.leader_and_org("outro@x.pt", org="Outra Quinta")
        foreign_token, foreign_req = self.pending("f@x.pt", other_org)
        r = self.bulk_requests(leader, org, [foreign_req], "approve")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["results"][0]["reason"], "already_handled")
        self.assertEqual(self.me(foreign_token)["membershipStatus"], "pending")

    def test_approve_someone_already_in_other_org(self):
        leader, org = self.leader_and_org()
        token, req = self.pending("dupla@x.pt", org)
        # Entretanto entrou noutra organização (por fora das regras, direto na BD).
        _, other_org = self.leader_and_org("outro@x.pt", org="Outra Quinta")
        user_id = self.me(token)["id"]
        with self.Session() as db:
            db.add(
                OrganizationMember(
                    organization_id=uuid.UUID(other_org),
                    user_id=uuid.UUID(user_id),
                    role="viewer",
                )
            )
            db.commit()
        r = self.bulk_requests(leader, org, [req], "approve")
        self.assertEqual(r.json()["results"][0]["reason"], "in_other_organization")
        self.assertEqual(r.json()["failed"], 1)

    def test_member_cannot_bulk(self):
        leader, org = self.leader_and_org()
        (member, _), (_, other_id) = self.members(leader, org, 2)
        _, req = self.pending("p@x.pt", org)
        r = self.bulk_requests(member, org, [req], "approve")
        self.assertEqual(r.status_code, 403)
        r = self.bulk_remove(member, org, [other_id])
        self.assertEqual(r.status_code, 403)

    def test_other_org_leader_is_forbidden(self):
        leader, org = self.leader_and_org()
        other_leader, _ = self.leader_and_org("outro@x.pt", org="Outra Quinta")
        _, req = self.pending("p@x.pt", org)
        [(_, member_id)] = self.members(leader, org, 1)
        r = self.bulk_requests(other_leader, org, [req], "approve")
        self.assertEqual(r.status_code, 403)
        r = self.bulk_remove(other_leader, org, [member_id])
        self.assertEqual(r.status_code, 403)
        # Nada mudou.
        people = self.client.get(
            f"/api/v1/organizations/{org}/people", headers=self.h(leader)
        ).json()
        self.assertEqual(len(people), 2)

    def test_requires_login(self):
        org = str(uuid.uuid4())
        r = self.client.post(
            f"/api/v1/organizations/{org}/join-requests/bulk",
            json={"ids": [org], "action": "approve"},
        )
        self.assertEqual(r.status_code, 401)

    def test_validation_and_limit(self):
        # Erros de validação saem como 400 (core/errors.py).
        leader, org = self.leader_and_org()
        too_many = [str(uuid.uuid4()) for _ in range(101)]
        self.assertEqual(
            self.bulk_requests(leader, org, too_many, "approve").status_code, BAD
        )
        self.assertEqual(self.bulk_remove(leader, org, too_many).status_code, BAD)
        self.assertEqual(
            self.bulk_requests(leader, org, [], "approve").status_code, BAD
        )
        self.assertEqual(self.bulk_remove(leader, org, []).status_code, BAD)
        self.assertEqual(
            self.bulk_requests(leader, org, [str(uuid.uuid4())], "delete").status_code,
            BAD,
        )
        self.assertEqual(
            self.bulk_requests(leader, org, ["nao-e-uuid"], "approve").status_code,
            BAD,
        )
        # 100 é o máximo aceite.
        hundred = [str(uuid.uuid4()) for _ in range(100)]
        r = self.bulk_requests(leader, org, hundred, "deny")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["failed"], 100)

    def test_rate_limited(self):
        leader, org = self.leader_and_org()
        ids = [str(uuid.uuid4())]
        for _ in range(routes.BULK_RATE_LIMIT):
            self.assertEqual(
                self.bulk_requests(leader, org, ids, "deny").status_code, 200
            )
        r = self.bulk_remove(leader, org, ids)
        self.assertEqual(r.status_code, 429)
        self.assertIn("Retry-After", r.headers)

    # --- remover --------------------------------------------------------------

    def test_leader_removes_many(self):
        leader, org = self.leader_and_org()
        ms = self.members(leader, org, 4)
        r = self.bulk_remove(leader, org, [uid for _, uid in ms[:3]])
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual((r.json()["succeeded"], r.json()["failed"]), (3, 0))
        people = self.client.get(
            f"/api/v1/organizations/{org}/people", headers=self.h(leader)
        ).json()
        self.assertEqual(
            {p["userId"] for p in people}, {self.me(leader)["id"], ms[3][1]}
        )
        self.assertEqual(self.event_types(org).count("removed"), 3)
        # Quem saiu perde o acesso logo.
        blocked = self.client.get(
            f"/api/v1/organizations/{org}/people", headers=self.h(ms[0][0])
        )
        self.assertEqual(blocked.status_code, 403)

    def test_cannot_remove_self_or_leader_and_partial(self):
        leader, org = self.leader_and_org()
        leader_id = self.me(leader)["id"]
        [(_, a), (_, b)] = self.members(leader, org, 2)
        stranger = self.me(self.register("solto@x.pt"))["id"]
        ghost = str(uuid.uuid4())
        r = self.bulk_remove(leader, org, [a, leader_id, stranger, ghost, b, a])
        self.assertEqual(r.status_code, 200, r.text)
        body = r.json()
        self.assertEqual((body["succeeded"], body["failed"]), (2, 3))
        res = self.by_id(body)
        self.assertTrue(res[a]["ok"] and res[b]["ok"])
        self.assertEqual(res[leader_id]["reason"], "is_self")
        self.assertEqual(res[stranger]["reason"], "not_a_member")
        self.assertEqual(res[ghost]["reason"], "not_a_member")
        # O Líder continua Líder e a organização continua com ele.
        me = self.me(leader)
        self.assertEqual((me["role"], me["membershipStatus"]), ("leader", "active"))
        # Remover outra vez quem já saiu: not_a_member, sem evento novo.
        again = self.bulk_remove(leader, org, [a])
        self.assertEqual(again.json()["results"][0]["reason"], "not_a_member")
        self.assertEqual(self.event_types(org).count("removed"), 2)

    def test_cannot_remove_the_leader_even_if_not_self(self):
        # Depois de passar a liderança, o antigo Líder já não pode remover o novo
        # (fica sem permissão), e o novo Líder recebe is_self se se incluir.
        leader, org = self.leader_and_org()
        [(member, member_id)] = self.members(leader, org, 1)
        leader_id = self.me(leader)["id"]
        t = self.client.post(
            f"/api/v1/organizations/{org}/transfer-leadership",
            json={"userId": member_id},
            headers=self.h(leader),
        )
        self.assertEqual(t.status_code, 204, t.text)
        self.assertEqual(self.bulk_remove(leader, org, [member_id]).status_code, 403)
        new_leader = self.refresh(member)
        r = self.bulk_remove(new_leader, org, [member_id, leader_id])
        res = self.by_id(r.json())
        self.assertEqual(res[member_id]["reason"], "is_self")
        self.assertTrue(res[leader_id]["ok"])

    def test_is_leader_reason_for_a_leader_row(self):
        # Defesa extra: uma linha com papel de líder (que não é quem pede) nunca sai.
        from services import organization_access_service as svc

        leader, org = self.leader_and_org()
        [(_, member_id)] = self.members(leader, org, 1)
        with self.Session() as db:
            row = (
                db.query(OrganizationMember)
                .filter(OrganizationMember.user_id == uuid.UUID(member_id))
                .one()
            )
            from models.models import User

            leader_user = db.get(User, uuid.UUID(self.me(leader)["id"]))
            # Simula o papel sem violar o índice único (só na sessão, sem commit).
            row.role = "owner"
            out = svc.bulk_remove_members(
                db, leader_user, uuid.UUID(org), [uuid.UUID(member_id)]
            )
            self.assertEqual(out, [(uuid.UUID(member_id), svc.REASON_IS_LEADER)])
            db.rollback()


if __name__ == "__main__":
    unittest.main()
