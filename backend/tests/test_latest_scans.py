"""Último scan de cada animal num só pedido (substitui um pedido por animal)."""

import unittest
import uuid
from datetime import datetime, timedelta

from models.models import Animal, AnimalScan, Breed, Species
import test_organization_access as base

_B = base.OrganizationAccessTests.__dict__


class LatestScansTests(unittest.TestCase):
    # A mesma base em memória e as mesmas ajudas de registo, sem herdar (e
    # repetir) os testes das organizações.
    setUpClass, tearDownClass, setUp = _B["setUpClass"], _B["tearDownClass"], _B["setUp"]
    register, h, me, leader_and_org = _B["register"], _B["h"], _B["me"], _B["leader_and_org"]

    def seed(self, org_id):
        db = self.Session()
        org = uuid.UUID(org_id)
        sp = Species(name="Bovine", normalized_name="bovine")
        db.add(sp)
        db.flush()
        br = Breed(species_id=sp.id, name="Limousin", normalized_name="limousin")
        db.add(br)
        db.flush()
        a, b, c = (
            Animal(organization_id=org, species_id=sp.id, breed_id=br.id, name=n, sex="male")
            for n in ("A", "B", "C")
        )
        db.add_all([a, b, c])
        db.flush()
        t0 = datetime(2026, 10, 1)
        scans = [
            AnimalScan(organization_id=org, animal_id=a.id, scanned_at=t0, estimated_weight=400),
            AnimalScan(organization_id=org, animal_id=a.id, scanned_at=t0 + timedelta(days=2), estimated_weight=420),
            # O mais recente de B falhou: conta o anterior.
            AnimalScan(organization_id=org, animal_id=b.id, scanned_at=t0, estimated_weight=500),
            AnimalScan(organization_id=org, animal_id=b.id, scanned_at=t0 + timedelta(days=3),
                       estimated_weight=999, scan_status="failed"),
            # Apagado: não conta. C fica sem scan.
            AnimalScan(organization_id=org, animal_id=c.id, scanned_at=t0, estimated_weight=1,
                       deleted_at=t0),
        ]
        db.add_all(scans)
        db.commit()
        ids = {"A": str(a.id), "B": str(b.id), "C": str(c.id)}
        db.close()
        return ids

    def test_latest_usable_scan_per_animal(self):
        token, org_id = self.leader_and_org()
        ids = self.seed(org_id)
        r = self.client.get(
            f"/api/v1/organizations/{org_id}/animals/latest-scans", headers=self.h(token)
        )
        self.assertEqual(r.status_code, 200, r.text)
        by_animal = {s["animalId"]: s["estimatedWeight"] for s in r.json()}
        self.assertEqual(by_animal, {ids["A"]: 420, ids["B"]: 500})

    def test_other_org_is_forbidden(self):
        _, org_id = self.leader_and_org()
        other = self.register("outro@x.pt", org="Outra")
        r = self.client.get(
            f"/api/v1/organizations/{org_id}/animals/latest-scans", headers=self.h(other)
        )
        self.assertEqual(r.status_code, 403)
