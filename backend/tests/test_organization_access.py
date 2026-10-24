"""Organizações com Líder: registo, pesquisa, pedidos, aprovação, remoção,
passagem de liderança e as rotas antigas que passaram a exigir o Líder."""

import os
import unittest

os.environ["DATABASE_URL"] = "sqlite://"
os.environ.setdefault("JWT_SECRET", "segredo-so-para-testes")

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, event  # noqa: E402
from sqlalchemy.exc import IntegrityError  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from core import rate_limit  # noqa: E402
from core.database import Base, get_db  # noqa: E402
from main import app  # noqa: E402
from models.models import Organization, OrganizationMember  # noqa: E402

PW = "senha-forte-123"


class OrganizationAccessTests(unittest.TestCase):
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

    def register(self, email, org=None, name="Pessoa"):
        body = {"name": name, "email": email, "password": PW}
        if org:
            body["organizationName"] = org
        r = self.client.post("/api/v1/auth/register", json=body)
        self.assertEqual(r.status_code, 201, r.text)
        return r.json()["accessToken"]

    def h(self, token):
        return {"Authorization": f"Bearer {token}"}

    def me(self, token):
        r = self.client.get("/api/v1/auth/me", headers=self.h(token))
        self.assertEqual(r.status_code, 200, r.text)
        return r.json()

    def refresh(self, token):
        r = self.client.post("/api/v1/auth/token/refresh", headers=self.h(token))
        self.assertEqual(r.status_code, 200, r.text)
        return r.json()["accessToken"]

    def leader_and_org(self):
        token = self.register("lider@euc.pt", org="Euro Union Consult", name="Talys")
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

    def approve(self, leader_token, org_id, req_id):
        return self.client.post(
            f"/api/v1/organizations/{org_id}/join-requests/{req_id}/approve",
            headers=self.h(leader_token),
        )

    def member(self, leader_token, org_id, email="membro@euc.pt"):
        token, req_id = self.pending(email, org_id)
        self.assertEqual(self.approve(leader_token, org_id, req_id).status_code, 200)
        return self.refresh(token)

    # --- registo e /me --------------------------------------------------------

    def test_register_without_org_has_no_access(self):
        token = self.register("sozinho@x.pt")
        me = self.me(token)
        self.assertEqual(me["membershipStatus"], "none")
        self.assertIsNone(me["organizationId"])
        r = self.client.get("/api/v1/organizations", headers=self.h(token))
        self.assertEqual(r.status_code, 403)

    def test_legacy_register_with_org_makes_leader(self):
        token = self.register("antigo@x.pt", org="Quinta")
        me = self.me(token)
        self.assertEqual((me["membershipStatus"], me["role"]), ("active", "leader"))
        self.assertEqual(me["organizationName"], "Quinta")

    def test_login_without_org_is_not_an_error(self):
        self.register("sem@x.pt")
        r = self.client.post(
            "/api/v1/auth/login", json={"email": "sem@x.pt", "password": PW}
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.me(r.json()["accessToken"])["membershipStatus"], "none")

    def test_create_org_makes_leader(self):
        token = self.register("novo@x.pt")
        r = self.client.post(
            "/api/v1/organizations/create",
            json={"name": "Herdade"},
            headers=self.h(token),
        )
        self.assertEqual(r.status_code, 201, r.text)
        token = self.refresh(token)
        me = self.me(token)
        self.assertEqual((me["role"], me["organizationName"]), ("leader", "Herdade"))
        again = self.client.post(
            "/api/v1/organizations/create",
            json={"name": "Outra"},
            headers=self.h(token),
        )
        self.assertEqual(again.status_code, 409)

    # --- pesquisa -------------------------------------------------------------

    def test_search_rules(self):
        _, org_id = self.leader_and_org()
        token = self.register("procura@x.pt")
        short = self.client.get(
            "/api/v1/organizations/search?q=EU", headers=self.h(token)
        )
        self.assertEqual(short.status_code, 422)
        r = self.client.get(
            "/api/v1/organizations/search?q=union", headers=self.h(token)
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json(), [{"id": org_id, "name": "Euro Union Consult"}])
        # Curingas do LIKE são texto, não padrão.
        none = self.client.get(
            "/api/v1/organizations/search?q=%25%25%25", headers=self.h(token)
        )
        self.assertEqual(none.json(), [])
        # Arquivada não aparece.
        with self.Session() as db:
            db.get(
                Organization, __import__("uuid").UUID(org_id)
            ).deleted_at = __import__("datetime").datetime.utcnow()
            db.commit()
        r = self.client.get(
            "/api/v1/organizations/search?q=union", headers=self.h(token)
        )
        self.assertEqual(r.json(), [])

    def test_search_requires_login(self):
        r = self.client.get("/api/v1/organizations/search?q=union")
        self.assertEqual(r.status_code, 401)

    # --- pedidos --------------------------------------------------------------

    def test_pending_has_no_access_until_approved(self):
        leader, org_id = self.leader_and_org()
        token, req_id = self.pending("pede@x.pt", org_id)
        me = self.me(token)
        self.assertEqual(me["membershipStatus"], "pending")
        self.assertEqual(me["pendingOrganizationName"], "Euro Union Consult")
        blocked = self.client.get(
            f"/api/v1/organizations/{org_id}/people", headers=self.h(token)
        )
        self.assertEqual(blocked.status_code, 403)

        listed = self.client.get(
            f"/api/v1/organizations/{org_id}/join-requests", headers=self.h(leader)
        )
        self.assertEqual([p["userEmail"] for p in listed.json()], ["pede@x.pt"])
        self.assertEqual(self.approve(leader, org_id, req_id).status_code, 200)

        token = self.refresh(token)
        me = self.me(token)
        self.assertEqual((me["membershipStatus"], me["role"]), ("active", "member"))
        people = self.client.get(
            f"/api/v1/organizations/{org_id}/people", headers=self.h(token)
        )
        self.assertEqual(people.status_code, 200)
        self.assertEqual(
            sorted((p["email"], p["role"]) for p in people.json()),
            [("lider@euc.pt", "leader"), ("pede@x.pt", "member")],
        )

    def test_duplicate_and_member_requests_conflict(self):
        leader, org_id = self.leader_and_org()
        token, _ = self.pending("dup@x.pt", org_id)
        again = self.client.post(
            "/api/v1/organizations/join-requests",
            json={"organizationId": org_id},
            headers=self.h(token),
        )
        self.assertEqual(again.status_code, 409)
        mine = self.client.post(
            "/api/v1/organizations/join-requests",
            json={"organizationId": org_id},
            headers=self.h(leader),
        )
        self.assertEqual(mine.status_code, 409)

    def test_reject_and_cancel(self):
        leader, org_id = self.leader_and_org()
        token, req_id = self.pending("nao@x.pt", org_id)
        r = self.client.post(
            f"/api/v1/organizations/{org_id}/join-requests/{req_id}/reject",
            headers=self.h(leader),
        )
        self.assertEqual(r.json()["status"], "rejected")
        self.assertEqual(self.me(token)["membershipStatus"], "none")
        token2, _ = self.pending("cancela@x.pt", org_id)
        r = self.client.delete(
            "/api/v1/organizations/join-requests/mine", headers=self.h(token2)
        )
        self.assertEqual(r.status_code, 204)
        self.assertEqual(self.me(token2)["membershipStatus"], "none")

    def test_only_leader_decides(self):
        leader, org_id = self.leader_and_org()
        member = self.member(leader, org_id)
        _, req_id = self.pending("outro@x.pt", org_id)
        for path in (
            f"/api/v1/organizations/{org_id}/join-requests",
            f"/api/v1/organizations/{org_id}/join-requests/{req_id}/approve",
        ):
            call = (
                self.client.get if path.endswith("join-requests") else self.client.post
            )
            self.assertEqual(call(path, headers=self.h(member)).status_code, 403, path)

    def test_leader_of_another_org_cannot_decide(self):
        _, org_id = self.leader_and_org()
        _, req_id = self.pending("alvo@x.pt", org_id)
        other = self.register("outra@x.pt", org="Outra Quinta")
        other_org = self.me(other)["organizationId"]
        cross = self.approve(other, org_id, req_id)
        self.assertEqual(cross.status_code, 403)
        # Nem com o id da própria organização no caminho.
        sneaky = self.approve(other, other_org, req_id)
        self.assertEqual(sneaky.status_code, 404)

    # --- remover, sair, passar liderança --------------------------------------

    def test_removed_member_loses_access_immediately(self):
        leader, org_id = self.leader_and_org()
        member = self.member(leader, org_id)
        uid = self.me(member)["id"]
        ok = self.client.get(
            f"/api/v1/organizations/{org_id}/people", headers=self.h(member)
        )
        self.assertEqual(ok.status_code, 200)
        r = self.client.delete(
            f"/api/v1/organizations/{org_id}/people/{uid}", headers=self.h(leader)
        )
        self.assertEqual(r.status_code, 204)
        # O mesmo token (ainda válido 7 dias) deixa de servir logo.
        after = self.client.get(
            f"/api/v1/organizations/{org_id}/people", headers=self.h(member)
        )
        self.assertEqual(after.status_code, 403)
        # E pode voltar a pedir entrada; a aprovação reativa a mesma linha.
        r = self.client.post(
            "/api/v1/organizations/join-requests",
            json={"organizationId": org_id},
            headers=self.h(member),
        )
        self.assertEqual(r.status_code, 201)
        self.assertEqual(self.approve(leader, org_id, r.json()["id"]).status_code, 200)

    def test_leader_cannot_remove_or_leave_self(self):
        leader, org_id = self.leader_and_org()
        uid = self.me(leader)["id"]
        r = self.client.delete(
            f"/api/v1/organizations/{org_id}/people/{uid}", headers=self.h(leader)
        )
        self.assertEqual(r.status_code, 409)
        r = self.client.post(
            f"/api/v1/organizations/{org_id}/leave", headers=self.h(leader)
        )
        self.assertEqual(r.status_code, 409)

    def test_member_can_leave(self):
        leader, org_id = self.leader_and_org()
        member = self.member(leader, org_id)
        r = self.client.post(
            f"/api/v1/organizations/{org_id}/leave", headers=self.h(member)
        )
        self.assertEqual(r.status_code, 204)
        self.assertEqual(self.me(member)["membershipStatus"], "none")

    def test_transfer_leadership(self):
        leader, org_id = self.leader_and_org()
        member = self.member(leader, org_id)
        uid = self.me(member)["id"]
        r = self.client.post(
            f"/api/v1/organizations/{org_id}/transfer-leadership",
            json={"userId": uid},
            headers=self.h(leader),
        )
        self.assertEqual(r.status_code, 204, r.text)
        self.assertEqual(self.me(member)["role"], "leader")
        self.assertEqual(self.me(leader)["role"], "member")
        # O antigo líder já não decide pedidos (papel lido da BD, não do token).
        _, req_id = self.pending("depois@x.pt", org_id)
        self.assertEqual(self.approve(leader, org_id, req_id).status_code, 403)
        self.assertEqual(self.approve(member, org_id, req_id).status_code, 200)
        with self.Session() as db:
            owners = (
                db.query(OrganizationMember)
                .filter(
                    OrganizationMember.role == "owner",
                    OrganizationMember.deleted_at.is_(None),
                )
                .count()
            )
        self.assertEqual(owners, 1)

    def test_database_refuses_two_leaders(self):
        leader, org_id = self.leader_and_org()
        member = self.member(leader, org_id)
        uid = self.me(member)["id"]
        with self.Session() as db:
            row = (
                db.query(OrganizationMember)
                .filter(OrganizationMember.user_id == __import__("uuid").UUID(uid))
                .one()
            )
            row.role = "owner"
            with self.assertRaises(IntegrityError):
                db.commit()

    # --- rotas antigas, agora só para o Líder ---------------------------------

    def test_legacy_routes_require_leader(self):
        leader, org_id = self.leader_and_org()
        member = self.member(leader, org_id)
        h = self.h(member)
        checks = [
            self.client.delete(f"/api/v1/organizations/{org_id}", headers=h),
            self.client.patch(
                f"/api/v1/organizations/{org_id}", json={"name": "X"}, headers=h
            ),
            self.client.post(
                "/api/v1/organizations",
                json={"name": "Fantasma", "documentNumber": "1"},
                headers=h,
            ),
            self.client.post(
                "/api/v1/users",
                json={"name": "X", "email": "x@x.pt", "password": PW},
                headers=h,
            ),
        ]
        self.assertEqual([c.status_code for c in checks], [403] * len(checks))
        # O líder continua a poder alterar a organização.
        r = self.client.patch(
            f"/api/v1/organizations/{org_id}",
            json={"name": "EUC"},
            headers=self.h(leader),
        )
        self.assertEqual(r.status_code, 200, r.text)

    def test_legacy_member_write_routes_are_gone(self):
        # Nem o líder: entrar só por pedido, sair por /people ou /leave.
        leader, org_id = self.leader_and_org()
        other = self.register("alguem@x.pt")
        uid = self.me(other)["id"]
        h = self.h(leader)
        add = self.client.post(
            f"/api/v1/organizations/{org_id}/members", json={"userId": uid}, headers=h
        )
        self.assertIn(add.status_code, (404, 405))
        self.assertEqual(self.me(other)["membershipStatus"], "none")
        me_id = self.me(leader)["id"]
        drop = self.client.delete(
            f"/api/v1/organizations/{org_id}/members/{me_id}", headers=h
        )
        self.assertIn(drop.status_code, (404, 405))
        self.assertEqual(self.me(leader)["role"], "leader")

    def test_leader_cannot_delete_own_account(self):
        leader, org_id = self.leader_and_org()
        uid = self.me(leader)["id"]
        r = self.client.delete(f"/api/v1/users/{uid}", headers=self.h(leader))
        self.assertEqual(r.status_code, 409)
        self.assertEqual(self.me(leader)["role"], "leader")

    def test_deleted_accounts_disappear_from_lists(self):
        leader, org_id = self.leader_and_org()
        member = self.member(leader, org_id)
        uid = self.me(member)["id"]
        r = self.client.delete(f"/api/v1/users/{uid}", headers=self.h(member))
        self.assertEqual(r.status_code, 204)
        people = self.client.get(
            f"/api/v1/organizations/{org_id}/people", headers=self.h(leader)
        )
        self.assertEqual([p["email"] for p in people.json()], ["lider@euc.pt"])


if __name__ == "__main__":
    unittest.main()

    # --- histórico da organização: cada mudança fica registada, só o Líder lê ---

    def events(self, token, org_id):
        r = self.client.get(
            f"/api/v1/organizations/{org_id}/events", headers=self.h(token)
        )
        self.assertEqual(r.status_code, 200, r.text)
        return r.json()

    def test_history_records_every_change(self):
        leader, org = self.leader_and_org()
        # pedido recusado, pedido cancelado, aprovado e depois sai, aprovado e removido
        refused_token, refused_req = self.pending("recusado@x.pt", org, name="Recusado")
        self.client.post(
            f"/api/v1/organizations/{org}/join-requests/{refused_req}/reject",
            headers=self.h(leader),
        )
        gave_up, _ = self.pending("desistiu@x.pt", org, name="Desistiu")
        self.client.delete(
            "/api/v1/organizations/join-requests/mine", headers=self.h(gave_up)
        )
        leaver = self.member(leader, org, email="sai@x.pt")
        self.client.post(f"/api/v1/organizations/{org}/leave", headers=self.h(leaver))
        removed = self.member(leader, org, email="removido@x.pt")
        removed_id = self.me(removed)["id"]
        r = self.client.delete(
            f"/api/v1/organizations/{org}/people/{removed_id}", headers=self.h(leader)
        )
        self.assertEqual(r.status_code, 204)
        heir = self.member(leader, org, email="herdeiro@x.pt")
        heir_id = self.me(heir)["id"]
        r = self.client.post(
            f"/api/v1/organizations/{org}/transfer-leadership",
            json={"userId": heir_id},
            headers=self.h(leader),
        )
        self.assertEqual(r.status_code, 204)

        new_leader = self.refresh(heir)
        evs = self.events(new_leader, org)
        types = [e["type"] for e in reversed(evs)]  # do mais antigo ao mais recente
        self.assertEqual(
            types,
            [
                "created",
                "join_requested",
                "rejected",
                "join_requested",
                "join_cancelled",
                "join_requested",
                "approved",
                "left",
                "join_requested",
                "approved",
                "removed",
                "join_requested",
                "approved",
                "leader_transferred",
            ],
        )
        removed_ev = next(e for e in evs if e["type"] == "removed")
        self.assertEqual(
            (removed_ev["actorName"], removed_ev["subjectName"]), ("Talys", "Novo")
        )
        self.assertEqual(evs[0]["type"], "leader_transferred")  # mais recente primeiro
        self.assertNotIn("subjectUserId", evs[0])  # só nomes saem, nunca ids/emails

    def test_history_is_leader_only_and_scoped(self):
        leader, org = self.leader_and_org()
        member = self.member(leader, org)
        r = self.client.get(
            f"/api/v1/organizations/{org}/events", headers=self.h(member)
        )
        self.assertEqual(r.status_code, 403)
        other = self.register("outro@x.pt", org="Outra Quinta", name="Outro")
        r = self.client.get(
            f"/api/v1/organizations/{org}/events", headers=self.h(other)
        )
        self.assertEqual(r.status_code, 403)
        r = self.client.get(f"/api/v1/organizations/{org}/events")
        self.assertEqual(r.status_code, 401)

    # --- sexo do animal: só quem criou (o primeiro scan) escolhe; todos veem -------

    def _animal_by(self, token, leader):
        sp = self.client.post(
            "/api/v1/species", json={"name": "Bovine"}, headers=self.h(leader)
        )
        self.assertIn(sp.status_code, (200, 201), sp.text)
        br = self.client.post(
            f"/api/v1/species/{sp.json()['id']}/breeds",
            json={"name": "Limousine"},
            headers=self.h(leader),
        )
        self.assertIn(br.status_code, (200, 201), br.text)
        r = self.client.post(
            "/api/v1/animals",
            json={
                "organizationId": self.me(token)["organizationId"],
                "speciesId": sp.json()["id"],
                "breedId": br.json()["id"],
                "name": "Estrela",
                "sex": "unknown",
            },
            headers=self.h(token),
        )
        self.assertEqual(r.status_code, 201, r.text)
        return r.json()

    def patch_sex(self, token, animal_id, sex):
        return self.client.patch(
            f"/api/v1/animals/{animal_id}", json={"sex": sex}, headers=self.h(token)
        )

    def test_only_scan_creator_sets_sex(self):
        leader, org = self.leader_and_org()
        member = self.member(leader, org)
        animal = self._animal_by(member, leader)
        self.assertEqual(animal["createdByUserId"], self.me(member)["id"])
        # O Líder vê, mas não muda o sexo de um animal que outra pessoa criou.
        self.assertEqual(self.patch_sex(leader, animal["id"], "male").status_code, 403)
        r = self.patch_sex(member, animal["id"], "female")
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["sex"], "female")
        seen = self.client.get(
            f"/api/v1/animals/{animal['id']}", headers=self.h(leader)
        )
        self.assertEqual(seen.json()["sex"], "female")
        # Outros campos continuam a poder ser editados por quem já podia.
        ok = self.client.patch(
            f"/api/v1/animals/{animal['id']}",
            json={"notes": "nota"},
            headers=self.h(leader),
        )
        self.assertEqual(ok.status_code, 200, ok.text)

    def test_legacy_animal_without_creator_is_set_by_leader(self):
        leader, org = self.leader_and_org()
        member = self.member(leader, org)
        animal = self._animal_by(member, leader)
        with self.Session() as db:
            from models.models import Animal

            db.get(
                Animal, __import__("uuid").UUID(animal["id"])
            ).created_by_user_id = None
            db.commit()
        self.assertEqual(self.patch_sex(member, animal["id"], "male").status_code, 403)
        self.assertEqual(self.patch_sex(leader, animal["id"], "male").status_code, 200)
