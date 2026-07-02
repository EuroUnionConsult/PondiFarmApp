import os
import unittest
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

os.environ["DATABASE_URL"] = "sqlite://"

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from core.database import Base, get_db
from main import app
from models.models import Animal, Breed, Organization, Species, VeterinaryAppointment


class VeterinaryAppointmentApiTests(unittest.TestCase):
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

    def create_organization_and_animal(self):
        with self.TestSessionLocal() as session:
            organization = Organization(
                name="PondiFarm",
                document_number=str(uuid4()),
            )
            species = Species(name="Bovine", normalized_name="bovine")
            session.add_all([organization, species])
            session.flush()
            breed = Breed(
                species_id=species.id,
                name="Angus",
                normalized_name="angus",
            )
            session.add(breed)
            session.flush()
            animal = Animal(
                organization_id=organization.id,
                species_id=species.id,
                breed_id=breed.id,
                name="Aurora",
                tag_code="VET-001",
                sex="female",
            )
            session.add(animal)
            session.commit()
            return str(organization.id), str(animal.id)

    def future_datetime(self, days=2, hours=0):
        return datetime.now(timezone.utc) + timedelta(days=days, hours=hours)

    def appointment_payload(
        self,
        *,
        scheduled_at=None,
        title="Annual vaccination",
    ):
        scheduled_at = scheduled_at or self.future_datetime()
        return {
            "title": title,
            "scheduledAt": scheduled_at.isoformat(),
            "notes": "Confirm animal identification",
            "calendarEventId": "calendar-event-001",
        }

    def create_appointment(self, animal_id, **payload_overrides):
        payload = self.appointment_payload()
        payload.update(payload_overrides)
        response = self.client.post(
            f"/api/v1/animals/{animal_id}/veterinary-appointments",
            json=payload,
        )
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def test_create_resolves_organization_and_defaults_to_scheduled(self):
        organization_id, animal_id = self.create_organization_and_animal()

        response = self.client.post(
            f"/api/v1/animals/{animal_id}/veterinary-appointments",
            json=self.appointment_payload(),
        )

        self.assertEqual(response.status_code, 201)
        payload = response.json()
        self.assertEqual(payload["organizationId"], organization_id)
        self.assertEqual(payload["animalId"], animal_id)
        self.assertEqual(payload["status"], "scheduled")

    def test_create_rejects_missing_animal_and_client_organization_id(self):
        missing_response = self.client.post(
            f"/api/v1/animals/{uuid4()}/veterinary-appointments",
            json=self.appointment_payload(),
        )
        self.assertEqual(missing_response.status_code, 404)

        organization_id, animal_id = self.create_organization_and_animal()
        payload = self.appointment_payload()
        payload["organizationId"] = organization_id
        override_response = self.client.post(
            f"/api/v1/animals/{animal_id}/veterinary-appointments",
            json=payload,
        )
        self.assertEqual(override_response.status_code, 400)

    def test_historical_appointment_must_be_created_as_completed(self):
        _, animal_id = self.create_organization_and_animal()
        scheduled_at = datetime.now(timezone.utc) - timedelta(days=2)
        payload = self.appointment_payload(scheduled_at=scheduled_at)

        scheduled_response = self.client.post(
            f"/api/v1/animals/{animal_id}/veterinary-appointments",
            json=payload,
        )
        self.assertEqual(scheduled_response.status_code, 400)

        payload["status"] = "completed"
        valid_completion = self.client.post(
            f"/api/v1/animals/{animal_id}/veterinary-appointments",
            json=payload,
        )
        self.assertEqual(valid_completion.status_code, 201)
        self.assertEqual(valid_completion.json()["status"], "completed")

    def test_prevents_normalized_duplicate_scheduled_appointment(self):
        _, animal_id = self.create_organization_and_animal()
        scheduled_at = self.future_datetime()
        first_payload = self.appointment_payload(
            scheduled_at=scheduled_at,
            title="Annual vaccination",
        )
        duplicate_payload = self.appointment_payload(
            scheduled_at=scheduled_at,
            title="  ANNUAL   VACCINATION  ",
        )

        first = self.client.post(
            f"/api/v1/animals/{animal_id}/veterinary-appointments",
            json=first_payload,
        )
        duplicate = self.client.post(
            f"/api/v1/animals/{animal_id}/veterinary-appointments",
            json=duplicate_payload,
        )

        self.assertEqual(first.status_code, 201)
        self.assertEqual(duplicate.status_code, 409)

    def test_lists_filters_and_paginates_by_animal_and_organization(self):
        organization_id, animal_id = self.create_organization_and_animal()
        first_date = self.future_datetime(days=2)
        second_date = self.future_datetime(days=8)
        self.create_appointment(
            animal_id,
            scheduledAt=first_date.isoformat(),
            title="Vaccination",
        )
        self.create_appointment(
            animal_id,
            scheduledAt=second_date.isoformat(),
            title="Routine checkup",
        )

        animal_response = self.client.get(
            f"/api/v1/animals/{animal_id}/veterinary-appointments",
            params={
                "status": "scheduled",
                "dateFrom": first_date.date().isoformat(),
                "dateTo": first_date.date().isoformat(),
            },
        )
        organization_response = self.client.get(
            f"/api/v1/organizations/{organization_id}/veterinary-appointments",
            params={"animalId": animal_id, "upcomingOnly": "true"},
        )
        paginated_response = self.client.get(
            f"/api/v1/animals/{animal_id}/veterinary-appointments",
            params={"page": 2, "limit": 1},
        )

        self.assertEqual(animal_response.status_code, 200)
        self.assertEqual(len(animal_response.json()), 1)
        self.assertEqual(animal_response.json()[0]["title"], "Vaccination")
        self.assertEqual(organization_response.status_code, 200)
        self.assertEqual(len(organization_response.json()), 2)
        self.assertEqual(paginated_response.json()[0]["title"], "Routine checkup")

    def test_update_and_read_scheduled_appointment_metadata(self):
        _, animal_id = self.create_organization_and_animal()
        appointment = self.create_appointment(animal_id)

        update_response = self.client.patch(
            f"/api/v1/veterinary-appointments/{appointment['id']}",
            json={
                "title": "Updated vaccination",
                "notes": "Use north barn",
                "calendarEventId": "calendar-event-002",
            },
        )
        read_response = self.client.get(
            f"/api/v1/veterinary-appointments/{appointment['id']}",
        )

        self.assertEqual(update_response.status_code, 200)
        self.assertEqual(read_response.status_code, 200)
        self.assertEqual(read_response.json()["title"], "Updated vaccination")
        self.assertEqual(read_response.json()["notes"], "Use north barn")
        self.assertEqual(
            read_response.json()["calendarEventId"],
            "calendar-event-002",
        )

    def test_complete_scheduled_appointment(self):
        _, animal_id = self.create_organization_and_animal()
        scheduled_at = self.future_datetime(days=1)
        appointment = self.create_appointment(
            animal_id,
            scheduledAt=scheduled_at.isoformat(),
        )

        response = self.client.post(
            f"/api/v1/veterinary-appointments/{appointment['id']}/complete",
            json={
                "notes": "Vaccination completed successfully",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "completed")
        self.assertEqual(
            response.json()["notes"],
            "Vaccination completed successfully",
        )

    def test_cancelled_and_archived_appointments_cannot_be_completed(self):
        _, animal_id = self.create_organization_and_animal()
        cancelled = self.create_appointment(animal_id, title="Cancelled")
        cancel_response = self.client.post(
            f"/api/v1/veterinary-appointments/{cancelled['id']}/cancel",
            json={"notes": "Veterinarian unavailable"},
        )
        self.assertEqual(cancel_response.status_code, 200)
        self.assertEqual(cancel_response.json()["status"], "cancelled")

        complete_cancelled = self.client.post(
            f"/api/v1/veterinary-appointments/{cancelled['id']}/complete",
            json={},
        )
        self.assertEqual(complete_cancelled.status_code, 400)

        archived = self.create_appointment(animal_id, title="Archived")
        self.client.post(
            f"/api/v1/veterinary-appointments/{archived['id']}/archive",
        )
        complete_archived = self.client.post(
            f"/api/v1/veterinary-appointments/{archived['id']}/complete",
            json={},
        )
        self.assertEqual(complete_archived.status_code, 400)

    def test_completed_cancelled_and_missed_can_be_archived(self):
        _, animal_id = self.create_organization_and_animal()

        completed = self.create_appointment(animal_id, title="Completed")
        self.client.post(
            f"/api/v1/veterinary-appointments/{completed['id']}/complete",
            json={},
        )

        cancelled = self.create_appointment(animal_id, title="Cancelled")
        self.client.post(
            f"/api/v1/veterinary-appointments/{cancelled['id']}/cancel",
            json={"notes": "Weather"},
        )

        missed = self.create_appointment(animal_id, title="Missed")
        missed_response = self.client.patch(
            f"/api/v1/veterinary-appointments/{missed['id']}",
            json={"status": "missed"},
        )
        self.assertEqual(missed_response.status_code, 200)

        for appointment_id in [completed["id"], cancelled["id"], missed["id"]]:
            archive_response = self.client.post(
                f"/api/v1/veterinary-appointments/{appointment_id}/archive",
            )
            self.assertEqual(archive_response.status_code, 200)
            self.assertEqual(archive_response.json()["status"], "archived")

    def test_completed_cannot_be_deleted_and_future_scheduled_is_soft_deleted(self):
        _, animal_id = self.create_organization_and_animal()
        completed = self.create_appointment(animal_id, title="Completed")
        self.client.post(
            f"/api/v1/veterinary-appointments/{completed['id']}/complete",
            json={},
        )
        completed_delete = self.client.delete(
            f"/api/v1/veterinary-appointments/{completed['id']}",
        )
        self.assertEqual(completed_delete.status_code, 409)

        scheduled = self.create_appointment(animal_id, title="Scheduled")
        scheduled_delete = self.client.delete(
            f"/api/v1/veterinary-appointments/{scheduled['id']}",
        )
        scheduled_get = self.client.get(
            f"/api/v1/veterinary-appointments/{scheduled['id']}",
        )
        self.assertEqual(scheduled_delete.status_code, 204)
        self.assertEqual(scheduled_get.status_code, 404)

        with self.TestSessionLocal() as session:
            stored = session.get(VeterinaryAppointment, UUID(scheduled["id"]))
            self.assertIsNotNone(stored.deleted_at)


if __name__ == "__main__":
    unittest.main()
