import unittest
import os
from datetime import datetime, timedelta, timezone

os.environ["DATABASE_URL"] = "sqlite://"

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from core.database import Base, get_db
from main import app
from models.models import (
    Animal,
    AnimalScan,
    Breed,
    Organization,
    OrganizationMember,
    Species,
    User,
)


class ApiCrudTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine(
            "sqlite://",
            future=True,
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )

        @event.listens_for(cls.engine, "connect")
        def _enable_foreign_keys(dbapi_connection, connection_record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        cls.TestSessionLocal = sessionmaker(
            bind=cls.engine,
            autoflush=False,
            autocommit=False,
            future=True,
        )

        def override_get_db():
            db = cls.TestSessionLocal()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.clear()
        Base.metadata.drop_all(bind=cls.engine)
        cls.engine.dispose()

    def setUp(self):
        Base.metadata.drop_all(bind=self.engine)
        Base.metadata.create_all(bind=self.engine)

    def create_organization(
        self,
        name="PondiFarm",
        document_number="123456789",
        email="contact@pondifarm.com",
    ):
        response = self.client.post(
            "/api/v1/organizations",
            json={
                "name": name,
                "documentNumber": document_number,
                "phone": "+351900000000",
                "email": email,
                "address": "Porto, Portugal",
            },
        )
        self.assertEqual(response.status_code, 201)
        return response.json()

    def create_user(self, email="bruno@example.com"):
        response = self.client.post(
            "/api/v1/users",
            json={
                "name": "Bruno Silva",
                "email": email,
                "password": "password-value",
            },
        )
        self.assertEqual(response.status_code, 201)
        return response.json()

    def add_member(self, organization_id, user_id, role=None):
        payload = {"userId": user_id}
        if role is not None:
            payload["role"] = role
        response = self.client.post(
            f"/api/v1/organizations/{organization_id}/members",
            json=payload,
        )
        self.assertEqual(response.status_code, 201)
        return response.json()

    def create_species(self, name="Bovine"):
        response = self.client.post(
            "/api/v1/species",
            json={"name": name},
        )
        self.assertEqual(response.status_code, 201)
        return response.json()

    def create_breed(self, species_id, name="Angus"):
        response = self.client.post(
            f"/api/v1/species/{species_id}/breeds",
            json={"name": name},
        )
        self.assertEqual(response.status_code, 201)
        return response.json()

    def create_animal(
        self,
        organization_id,
        species_id,
        breed_id,
        name="Animal 001",
        tag_code="TAG-001",
        sex="male",
        birth_date="2024-03-10",
        photo_url=None,
        notes="Sample animal",
    ):
        response = self.client.post(
            "/api/v1/animals",
            json={
                "organizationId": organization_id,
                "speciesId": species_id,
                "breedId": breed_id,
                "name": name,
                "tagCode": tag_code,
                "sex": sex,
                "birthDate": birth_date,
                "photoUrl": photo_url,
                "notes": notes,
            },
        )
        self.assertEqual(response.status_code, 201)
        return response.json()

    def create_scan(
        self,
        animal_id,
        scan_source=None,
        scanned_at=None,
        notes="First Polycam LiDAR field test",
    ):
        payload = {}
        if scan_source is not None:
            payload["scanSource"] = scan_source
        if scanned_at is not None:
            payload["scannedAt"] = scanned_at
        if notes is not None:
            payload["notes"] = notes

        response = self.client.post(
            f"/api/v1/animals/{animal_id}/scans",
            json=payload,
        )
        self.assertEqual(response.status_code, 201)
        return response.json()

    def test_create_organization(self):
        payload = self.create_organization()
        self.assertEqual(payload["name"], "PondiFarm")
        self.assertEqual(payload["documentNumber"], "123456789")

    def test_create_organization_accepts_formatted_portuguese_nif(self):
        response = self.client.post(
            "/api/v1/organizations",
            json={
                "name": "Formatted PondiFarm",
                "documentNumber": "123 456 789",
                "phone": "+351900000000",
                "email": "formatted@pondifarm.com",
                "address": "Porto, Portugal",
            },
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["documentNumber"], "123456789")

    def test_create_organization_requires_document_number(self):
        response = self.client.post(
            "/api/v1/organizations",
            json={
                "name": "PondiFarm",
                "phone": "+351900000000",
                "email": "contact@pondifarm.com",
                "address": "Porto, Portugal",
            },
        )
        self.assertEqual(response.status_code, 400)

    def test_create_organization_rejects_invalid_portuguese_nif(self):
        response = self.client.post(
            "/api/v1/organizations",
            json={
                "name": "Invalid PondiFarm",
                "documentNumber": "123456780",
                "phone": "+351900000000",
                "email": "invalid@pondifarm.com",
                "address": "Porto, Portugal",
            },
        )
        self.assertEqual(response.status_code, 400)

    def test_list_organizations(self):
        self.create_organization()
        response = self.client.get("/api/v1/organizations")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)

    def test_get_organization_by_id_and_404(self):
        organization = self.create_organization()
        found = self.client.get(f"/api/v1/organizations/{organization['id']}")
        self.assertEqual(found.status_code, 200)
        missing = self.client.get(
            "/api/v1/organizations/00000000-0000-0000-0000-000000000999",
        )
        self.assertEqual(missing.status_code, 404)

    def test_update_organization(self):
        organization = self.create_organization()
        response = self.client.patch(
            f"/api/v1/organizations/{organization['id']}",
            json={"phone": "+351911111111"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["phone"], "+351911111111")

    def test_soft_delete_organization_hides_record_and_blocks_updates(self):
        organization = self.create_organization()
        user = self.create_user()
        self.add_member(organization["id"], user["id"])
        response = self.client.delete(f"/api/v1/organizations/{organization['id']}")
        self.assertEqual(response.status_code, 204)

        list_response = self.client.get("/api/v1/organizations")
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(list_response.json(), [])

        get_response = self.client.get(f"/api/v1/organizations/{organization['id']}")
        self.assertEqual(get_response.status_code, 404)

        patch_response = self.client.patch(
            f"/api/v1/organizations/{organization['id']}",
            json={"phone": "+351922222222"},
        )
        self.assertEqual(patch_response.status_code, 404)

        with self.TestSessionLocal() as session:
            stored = session.get(Organization, organization["id"])
            self.assertIsNotNone(stored.deleted_at)

    def test_create_user_hashes_password_and_hides_password_hash(self):
        user = self.create_user()
        self.assertNotIn("passwordHash", user)

        with self.TestSessionLocal() as session:
            stored = session.get(User, user["id"])
            self.assertIsNotNone(stored)
            self.assertNotEqual(stored.password_hash, "password-value")

    def test_duplicate_email_returns_conflict(self):
        self.create_user()
        response = self.client.post(
            "/api/v1/users",
            json={
                "name": "Other User",
                "email": "bruno@example.com",
                "password": "other-password",
            },
        )
        self.assertEqual(response.status_code, 409)

    def test_duplicate_email_is_case_insensitive(self):
        self.create_user(email="john@email.com")
        response = self.client.post(
            "/api/v1/users",
            json={
                "name": "John Duplicate",
                "email": " John@Email.com ",
                "password": "other-password",
            },
        )
        self.assertEqual(response.status_code, 409)

    def test_duplicate_organization_document_is_normalized(self):
        self.create_organization()
        response = self.client.post(
            "/api/v1/organizations",
            json={
                "name": "PondiFarm 2",
                "documentNumber": "123 456 789",
                "phone": "+351911111111",
                "email": "other@pondifarm.com",
                "address": "Lisbon, Portugal",
            },
        )
        self.assertEqual(response.status_code, 409)

    def test_list_and_update_users_without_password_hash(self):
        user = self.create_user()
        list_response = self.client.get("/api/v1/users")
        self.assertEqual(list_response.status_code, 200)
        self.assertNotIn("passwordHash", list_response.json()[0])

        update_response = self.client.patch(
            f"/api/v1/users/{user['id']}",
            json={"name": "Bruno Updated", "password": "new-password"},
        )
        self.assertEqual(update_response.status_code, 200)
        self.assertEqual(update_response.json()["name"], "Bruno Updated")
        self.assertNotIn("passwordHash", update_response.json())

    def test_soft_delete_user_hides_record_and_blocks_updates(self):
        user = self.create_user(email="delete@example.com")
        response = self.client.delete(f"/api/v1/users/{user['id']}")
        self.assertEqual(response.status_code, 204)

        list_response = self.client.get("/api/v1/users")
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(list_response.json(), [])

        get_response = self.client.get(f"/api/v1/users/{user['id']}")
        self.assertEqual(get_response.status_code, 404)

        patch_response = self.client.patch(
            f"/api/v1/users/{user['id']}",
            json={"name": "Should Fail"},
        )
        self.assertEqual(patch_response.status_code, 404)

        with self.TestSessionLocal() as session:
            stored = session.get(User, user["id"])
            self.assertIsNotNone(stored.deleted_at)

    def test_list_add_update_soft_delete_members(self):
        organization = self.create_organization()
        user = self.create_user()
        member = self.add_member(organization["id"], user["id"], role=None)

        list_response = self.client.get(
            f"/api/v1/organizations/{organization['id']}/members",
        )
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(list_response.json()[0]["userEmail"], "bruno@example.com")
        self.assertEqual(list_response.json()[0]["role"], "viewer")

        update_response = self.client.patch(
            f"/api/v1/organizations/{organization['id']}/members/{member['id']}",
            json={"role": "viewer"},
        )
        self.assertEqual(update_response.status_code, 200)
        self.assertEqual(update_response.json()["role"], "viewer")

        delete_response = self.client.delete(
            f"/api/v1/organizations/{organization['id']}/members/{member['id']}",
        )
        self.assertEqual(delete_response.status_code, 204)

        list_after_delete = self.client.get(
            f"/api/v1/organizations/{organization['id']}/members",
        )
        self.assertEqual(list_after_delete.status_code, 200)
        self.assertEqual(list_after_delete.json(), [])

        patch_after_delete = self.client.patch(
            f"/api/v1/organizations/{organization['id']}/members/{member['id']}",
            json={"role": "viewer"},
        )
        self.assertEqual(patch_after_delete.status_code, 404)

        with self.TestSessionLocal() as session:
            stored = session.get(OrganizationMember, member["id"])
            self.assertIsNotNone(stored.deleted_at)

    def test_prevent_duplicate_membership(self):
        organization = self.create_organization()
        user = self.create_user()
        self.add_member(organization["id"], user["id"])
        response = self.client.post(
            f"/api/v1/organizations/{organization['id']}/members",
            json={"userId": user["id"], "role": "viewer"},
        )
        self.assertEqual(response.status_code, 409)

    def test_reactivate_soft_deleted_membership(self):
        organization = self.create_organization()
        user = self.create_user(email="reactivate@example.com")
        member = self.add_member(organization["id"], user["id"])

        delete_response = self.client.delete(
            f"/api/v1/organizations/{organization['id']}/members/{member['id']}",
        )
        self.assertEqual(delete_response.status_code, 204)

        recreate_response = self.client.post(
            f"/api/v1/organizations/{organization['id']}/members",
            json={"userId": user["id"], "role": "viewer"},
        )
        self.assertEqual(recreate_response.status_code, 201)
        self.assertEqual(recreate_response.json()["id"], member["id"])
        self.assertEqual(recreate_response.json()["role"], "viewer")

        list_response = self.client.get(
            f"/api/v1/organizations/{organization['id']}/members",
        )
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(len(list_response.json()), 1)

    def test_member_list_ignores_soft_deleted_users(self):
        organization = self.create_organization()
        user = self.create_user(email="member-hidden@example.com")
        self.add_member(organization["id"], user["id"])

        delete_user_response = self.client.delete(f"/api/v1/users/{user['id']}")
        self.assertEqual(delete_user_response.status_code, 204)

        list_response = self.client.get(
            f"/api/v1/organizations/{organization['id']}/members",
        )
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(list_response.json(), [])

    def test_reject_invalid_role_and_member_not_found(self):
        organization = self.create_organization()
        user = self.create_user()

        invalid_role_response = self.client.post(
            f"/api/v1/organizations/{organization['id']}/members",
            json={"userId": user["id"], "role": "manager"},
        )
        self.assertEqual(invalid_role_response.status_code, 400)

        missing_member_response = self.client.delete(
            f"/api/v1/organizations/{organization['id']}/members/00000000-0000-0000-0000-000000000999",
        )
        self.assertEqual(missing_member_response.status_code, 404)

    def test_create_duplicate_species_with_same_name_case_insensitive(self):
        self.create_species("Bovine")
        response = self.client.post(
            "/api/v1/species",
            json={"name": "  bovine  "},
        )
        self.assertEqual(response.status_code, 409)

    def test_create_duplicate_breed_inside_same_species(self):
        species = self.create_species("Bovine")
        self.create_breed(species["id"], "Angus")
        response = self.client.post(
            f"/api/v1/species/{species['id']}/breeds",
            json={"name": "  ANGUS  "},
        )
        self.assertEqual(response.status_code, 409)

    def test_create_same_breed_name_under_different_species(self):
        bovine = self.create_species("Bovine")
        ovine = self.create_species("Ovine")
        breed_one = self.create_breed(bovine["id"], "Angus")
        breed_two = self.create_breed(ovine["id"], "Angus")
        self.assertNotEqual(breed_one["id"], breed_two["id"])

    def test_create_animal_rejects_breed_from_different_species(self):
        bovine = self.create_species("Bovine")
        ovine = self.create_species("Ovine")
        ovine_breed = self.create_breed(ovine["id"], "Suffolk")
        organization = self.create_organization()

        response = self.client.post(
            "/api/v1/animals",
            json={
                "organizationId": organization["id"],
                "speciesId": bovine["id"],
                "breedId": ovine_breed["id"],
                "name": "Wrong species animal",
                "sex": "female",
                "birthDate": "2024-03-10",
            },
        )
        self.assertEqual(response.status_code, 400)

    def test_create_animal_rejects_duplicate_tag_code_in_same_organization(self):
        organization = self.create_organization()
        species = self.create_species("Bovine")
        breed = self.create_breed(species["id"], "Angus")
        self.create_animal(
            organization_id=organization["id"],
            species_id=species["id"],
            breed_id=breed["id"],
            tag_code="TAG-001",
        )

        response = self.client.post(
            "/api/v1/animals",
            json={
                "organizationId": organization["id"],
                "speciesId": species["id"],
                "breedId": breed["id"],
                "name": "Animal 002",
                "tagCode": "TAG-001",
                "sex": "male",
                "birthDate": "2024-03-10",
            },
        )
        self.assertEqual(response.status_code, 409)

    def test_create_animal_allows_same_tag_code_in_different_organizations(self):
        organization_one = self.create_organization(
            name="PondiFarm One",
            document_number="123456797",
            email="one@pondifarm.com",
        )
        organization_two = self.create_organization(
            name="PondiFarm Two",
            document_number="123456770",
            email="two@pondifarm.com",
        )
        species = self.create_species("Bovine")
        breed = self.create_breed(species["id"], "Angus")

        first_animal = self.create_animal(
            organization_id=organization_one["id"],
            species_id=species["id"],
            breed_id=breed["id"],
            tag_code="TAG-002",
        )
        second_animal = self.create_animal(
            organization_id=organization_two["id"],
            species_id=species["id"],
            breed_id=breed["id"],
            tag_code="TAG-002",
        )

        self.assertEqual(first_animal["tagCode"], second_animal["tagCode"])
        self.assertNotEqual(first_animal["organizationId"], second_animal["organizationId"])

    def test_create_animal_rejects_future_birth_date(self):
        organization = self.create_organization()
        species = self.create_species("Bovine")
        breed = self.create_breed(species["id"], "Angus")

        response = self.client.post(
            "/api/v1/animals",
            json={
                "organizationId": organization["id"],
                "speciesId": species["id"],
                "breedId": breed["id"],
                "name": "Future Cow",
                "sex": "female",
                "birthDate": "2999-01-01",
            },
        )
        self.assertEqual(response.status_code, 400)

    def test_cannot_delete_species_with_linked_breeds_or_animals(self):
        organization = self.create_organization()
        species = self.create_species("Bovine")
        breed = self.create_breed(species["id"], "Angus")

        response = self.client.delete(f"/api/v1/species/{species['id']}")
        self.assertEqual(response.status_code, 409)

        self.create_animal(
            organization_id=organization["id"],
            species_id=species["id"],
            breed_id=breed["id"],
            tag_code="TAG-003",
        )
        response = self.client.delete(f"/api/v1/species/{species['id']}")
        self.assertEqual(response.status_code, 409)

    def test_cannot_delete_breed_with_linked_animals(self):
        organization = self.create_organization()
        species = self.create_species("Bovine")
        breed = self.create_breed(species["id"], "Angus")
        self.create_animal(
            organization_id=organization["id"],
            species_id=species["id"],
            breed_id=breed["id"],
            tag_code="TAG-004",
        )

        response = self.client.delete(f"/api/v1/breeds/{breed['id']}")
        self.assertEqual(response.status_code, 409)

    def test_list_animals_by_organization_and_filters(self):
        organization = self.create_organization()
        bovine = self.create_species("Bovine")
        ovine = self.create_species("Ovine")
        angus = self.create_breed(bovine["id"], "Angus")
        holstein = self.create_breed(bovine["id"], "Holstein")
        suffolk = self.create_breed(ovine["id"], "Suffolk")

        self.create_animal(
            organization_id=organization["id"],
            species_id=bovine["id"],
            breed_id=angus["id"],
            name="Black Angus",
            tag_code="ANG-001",
            sex="male",
        )
        self.create_animal(
            organization_id=organization["id"],
            species_id=bovine["id"],
            breed_id=holstein["id"],
            name="Dairy Holstein",
            tag_code="HOL-001",
            sex="female",
        )
        self.create_animal(
            organization_id=organization["id"],
            species_id=ovine["id"],
            breed_id=suffolk["id"],
            name="Suffolk Ewe",
            tag_code="OVN-001",
            sex="female",
        )

        list_response = self.client.get(
            f"/api/v1/organizations/{organization['id']}/animals"
        )
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(len(list_response.json()), 3)

        species_filter = self.client.get(
            f"/api/v1/organizations/{organization['id']}/animals",
            params={"speciesId": bovine["id"]},
        )
        self.assertEqual(species_filter.status_code, 200)
        self.assertEqual(len(species_filter.json()), 2)

        breed_filter = self.client.get(
            f"/api/v1/organizations/{organization['id']}/animals",
            params={"breedId": angus["id"]},
        )
        self.assertEqual(breed_filter.status_code, 200)
        self.assertEqual(len(breed_filter.json()), 1)

        sex_filter = self.client.get(
            f"/api/v1/organizations/{organization['id']}/animals",
            params={"sex": "female"},
        )
        self.assertEqual(sex_filter.status_code, 200)
        self.assertEqual(len(sex_filter.json()), 2)

        search_filter = self.client.get(
            f"/api/v1/organizations/{organization['id']}/animals",
            params={"search": "holstein"},
        )
        self.assertEqual(search_filter.status_code, 200)
        self.assertEqual(len(search_filter.json()), 1)

    def test_create_scan_for_existing_animal_defaults_to_pending_upload_and_polycam(self):
        organization = self.create_organization()
        species = self.create_species("Bovine")
        breed = self.create_breed(species["id"], "Angus")
        animal = self.create_animal(organization["id"], species["id"], breed["id"])

        scan = self.create_scan(animal["id"])

        self.assertEqual(scan["animalId"], animal["id"])
        self.assertEqual(scan["organizationId"], organization["id"])
        self.assertEqual(scan["scanStatus"], "pending_upload")
        self.assertEqual(scan["scanSource"], "polycam")
        self.assertIsNone(scan["estimatedWeight"])
        self.assertIsNone(scan["confidenceScore"])
        self.assertIsNone(scan["bodyLength"])
        self.assertIsNone(scan["withersHeight"])
        self.assertIsNone(scan["chestCircumference"])
        self.assertIsNone(scan["hipWidth"])

    def test_create_scan_requires_existing_animal(self):
        response = self.client.post(
            "/api/v1/animals/00000000-0000-0000-0000-000000000999/scans",
            json={},
        )
        self.assertEqual(response.status_code, 404)

    def test_create_scan_rejects_future_scanned_at(self):
        organization = self.create_organization()
        species = self.create_species("Bovine")
        breed = self.create_breed(species["id"], "Angus")
        animal = self.create_animal(organization["id"], species["id"], breed["id"])
        future_scanned_at = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()

        response = self.client.post(
            f"/api/v1/animals/{animal['id']}/scans",
            json={"scannedAt": future_scanned_at},
        )
        self.assertEqual(response.status_code, 400)

    def test_create_scan_rejects_second_active_unfinished_scan_for_same_animal(self):
        organization = self.create_organization()
        species = self.create_species("Bovine")
        breed = self.create_breed(species["id"], "Angus")
        animal = self.create_animal(organization["id"], species["id"], breed["id"])
        self.create_scan(animal["id"])

        response = self.client.post(
            f"/api/v1/animals/{animal['id']}/scans",
            json={"scanSource": "manual"},
        )
        self.assertEqual(response.status_code, 409)

    def test_create_scan_allows_new_scan_after_terminal_status(self):
        organization = self.create_organization()
        species = self.create_species("Bovine")
        breed = self.create_breed(species["id"], "Angus")
        animal = self.create_animal(organization["id"], species["id"], breed["id"])

        def transition_scan(scan_id, *statuses):
            for scan_status in statuses:
                response = self.client.patch(
                    f"/api/v1/scans/{scan_id}",
                    json={"scanStatus": scan_status},
                )
                self.assertEqual(response.status_code, 200)

        def create_after_transition(*statuses):
            scan = self.create_scan(animal["id"])
            transition_scan(scan["id"], *statuses)
            created = self.client.post(
                f"/api/v1/animals/{animal['id']}/scans",
                json={},
            )
            self.assertEqual(created.status_code, 201)
            self.client.delete(f"/api/v1/scans/{created.json()['id']}")

        create_after_transition("uploaded", "validating", "processing", "completed")
        create_after_transition("uploaded", "failed")
        create_after_transition("uploaded", "validating", "validation_failed")
        create_after_transition("archived")

    def test_list_scans_by_animal_with_status_source_and_date_filters(self):
        organization = self.create_organization()
        species = self.create_species("Bovine")
        breed = self.create_breed(species["id"], "Angus")
        animal = self.create_animal(organization["id"], species["id"], breed["id"])

        scan_one = self.create_scan(
            animal["id"],
            scanned_at="2026-06-01T10:30:00Z",
            notes="First",
        )
        self.client.patch(
            f"/api/v1/scans/{scan_one['id']}",
            json={"scanStatus": "uploaded"},
        )
        self.client.patch(
            f"/api/v1/scans/{scan_one['id']}",
            json={"scanStatus": "failed"},
        )

        scan_two = self.create_scan(
            animal["id"],
            scan_source="manual",
            scanned_at="2026-06-03T11:30:00Z",
            notes="Second",
        )
        self.client.patch(
            f"/api/v1/scans/{scan_two['id']}",
            json={"scanStatus": "uploaded"},
        )
        self.client.patch(
            f"/api/v1/scans/{scan_two['id']}",
            json={"scanStatus": "validating"},
        )
        self.client.patch(
            f"/api/v1/scans/{scan_two['id']}",
            json={"scanStatus": "processing"},
        )
        self.client.patch(
            f"/api/v1/scans/{scan_two['id']}",
            json={"scanStatus": "completed"},
        )

        list_response = self.client.get(f"/api/v1/animals/{animal['id']}/scans")
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(len(list_response.json()), 2)

        status_filter = self.client.get(
            f"/api/v1/animals/{animal['id']}/scans",
            params={"status": "completed"},
        )
        self.assertEqual(status_filter.status_code, 200)
        self.assertEqual(len(status_filter.json()), 1)

        source_filter = self.client.get(
            f"/api/v1/animals/{animal['id']}/scans",
            params={"source": "manual"},
        )
        self.assertEqual(source_filter.status_code, 200)
        self.assertEqual(len(source_filter.json()), 1)

        date_filter = self.client.get(
            f"/api/v1/animals/{animal['id']}/scans",
            params={"dateFrom": "2026-06-02", "dateTo": "2026-06-03"},
        )
        self.assertEqual(date_filter.status_code, 200)
        self.assertEqual(len(date_filter.json()), 1)

    def test_get_scan_by_id(self):
        organization = self.create_organization()
        species = self.create_species("Bovine")
        breed = self.create_breed(species["id"], "Angus")
        animal = self.create_animal(organization["id"], species["id"], breed["id"])
        scan = self.create_scan(animal["id"])

        response = self.client.get(f"/api/v1/scans/{scan['id']}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["id"], scan["id"])

    def test_update_scan_notes_and_scanned_at(self):
        organization = self.create_organization()
        species = self.create_species("Bovine")
        breed = self.create_breed(species["id"], "Angus")
        animal = self.create_animal(organization["id"], species["id"], breed["id"])
        scan = self.create_scan(animal["id"])

        response = self.client.patch(
            f"/api/v1/scans/{scan['id']}",
            json={
                "scannedAt": "2026-06-03T10:35:00Z",
                "notes": "Updated notes",
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["notes"], "Updated notes")
        self.assertTrue(response.json()["scannedAt"].startswith("2026-06-03T10:35:00"))

    def test_update_scan_rejects_immutable_fields(self):
        organization = self.create_organization()
        species = self.create_species("Bovine")
        breed = self.create_breed(species["id"], "Angus")
        animal = self.create_animal(organization["id"], species["id"], breed["id"])
        scan = self.create_scan(animal["id"])

        response = self.client.patch(
            f"/api/v1/scans/{scan['id']}",
            json={"animalId": animal["id"]},
        )
        self.assertEqual(response.status_code, 400)

    def test_delete_scan_blocks_processing_and_archives_completed(self):
        organization = self.create_organization()
        species = self.create_species("Bovine")
        breed = self.create_breed(species["id"], "Angus")
        animal = self.create_animal(organization["id"], species["id"], breed["id"])

        processing_scan = self.create_scan(animal["id"])
        self.client.patch(
            f"/api/v1/scans/{processing_scan['id']}",
            json={"scanStatus": "uploaded"},
        )
        self.client.patch(
            f"/api/v1/scans/{processing_scan['id']}",
            json={"scanStatus": "validating"},
        )
        self.client.patch(
            f"/api/v1/scans/{processing_scan['id']}",
            json={"scanStatus": "processing"},
        )

        processing_delete = self.client.delete(f"/api/v1/scans/{processing_scan['id']}")
        self.assertEqual(processing_delete.status_code, 409)

        transition_response = self.client.patch(
            f"/api/v1/scans/{processing_scan['id']}",
            json={"scanStatus": "completed"},
        )
        self.assertEqual(transition_response.status_code, 200)

        completed_delete = self.client.delete(f"/api/v1/scans/{processing_scan['id']}")
        self.assertEqual(completed_delete.status_code, 204)

        archived = self.client.get(f"/api/v1/scans/{processing_scan['id']}")
        self.assertEqual(archived.status_code, 200)
        self.assertEqual(archived.json()["scanStatus"], "archived")

    def test_delete_scan_soft_deletes_non_completed_scan(self):
        organization = self.create_organization()
        species = self.create_species("Bovine")
        breed = self.create_breed(species["id"], "Angus")
        animal = self.create_animal(organization["id"], species["id"], breed["id"])
        scan = self.create_scan(animal["id"])

        response = self.client.delete(f"/api/v1/scans/{scan['id']}")
        self.assertEqual(response.status_code, 204)

        get_response = self.client.get(f"/api/v1/scans/{scan['id']}")
        self.assertEqual(get_response.status_code, 404)

        with self.TestSessionLocal() as session:
            stored = session.get(AnimalScan, scan["id"])
            self.assertIsNotNone(stored.deleted_at)
