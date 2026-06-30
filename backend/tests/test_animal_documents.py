import asyncio
from datetime import date, timedelta
from io import BytesIO
import os
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
import unittest
from unittest.mock import patch
from uuid import uuid4

os.environ["DATABASE_URL"] = "sqlite://"

from fastapi import UploadFile
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from starlette.datastructures import Headers

from core.database import Base, get_db
from main import app
from models.models import (
    Animal,
    AnimalDocument,
    Breed,
    Organization,
    Species,
    User,
)
from schemas.animal_document_schemas import AnimalDocumentUploadMetadata
from services import animal_document_service
from storage.document_storage import LocalPrivateDocumentStorage


PDF_CONTENT = b"%PDF-1.4\nprivate test document"
JPEG_CONTENT = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00test"
PNG_CONTENT = b"\x89PNG\r\n\x1a\nprivate test image"
WEBP_CONTENT = b"RIFF\x10\x00\x00\x00WEBPVP8 private test image"


class AnimalDocumentApiTests(unittest.TestCase):
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
        self.maximum_file_size = 10 * 1024 * 1024
        self.storage_directory = TemporaryDirectory()
        self.storage = LocalPrivateDocumentStorage(
            Path(self.storage_directory.name),
        )
        self.storage_patcher = patch(
            "services.animal_document_service.get_document_storage",
            return_value=self.storage,
        )
        self.settings_patcher = patch(
            "services.animal_document_service.get_settings",
            side_effect=lambda: SimpleNamespace(
                document_max_file_size_bytes=self.maximum_file_size,
            ),
        )
        self.storage_patcher.start()
        self.settings_patcher.start()

    def tearDown(self):
        self.settings_patcher.stop()
        self.storage_patcher.stop()
        self.storage_directory.cleanup()

    def create_organization_and_animal(self, label="primary"):
        unique_value = uuid4().hex
        with self.TestSessionLocal() as session:
            organization = Organization(
                name=f"Farm {label}",
                document_number=unique_value,
            )
            species = Species(
                name=f"Bovine {unique_value}",
                normalized_name=f"bovine-{unique_value}",
            )
            session.add_all([organization, species])
            session.flush()
            breed = Breed(
                species_id=species.id,
                name=f"Breed {unique_value}",
                normalized_name=f"breed-{unique_value}",
            )
            session.add(breed)
            session.flush()
            animal = Animal(
                organization_id=organization.id,
                species_id=species.id,
                breed_id=breed.id,
                name=f"Animal {label}",
                tag_code=f"DOC-{unique_value[:8]}",
                sex="female",
            )
            session.add(animal)
            session.commit()
            return organization.id, animal.id

    def upload_document(
        self,
        animal_id,
        *,
        file_name="health certificate.pdf",
        content=PDF_CONTENT,
        content_type="application/pdf",
        document_type="health_certificate",
        issued_at=None,
        expires_at=None,
        extra_fields=None,
    ):
        form_data = {"documentType": document_type}
        if issued_at is not None:
            form_data["issuedAt"] = issued_at.isoformat()
        if expires_at is not None:
            form_data["expiresAt"] = expires_at.isoformat()
        if extra_fields:
            form_data.update(extra_fields)
        return self.client.post(
            f"/api/v1/animals/{animal_id}/documents",
            files={"file": (file_name, content, content_type)},
            data=form_data,
        )

    def test_upload_pdf_inherits_organization_and_hides_private_locator(self):
        organization_id, animal_id = self.create_organization_and_animal()

        response = self.upload_document(
            animal_id,
            file_name="../Health Certificate 2026.pdf",
        )

        self.assertEqual(response.status_code, 201, response.text)
        payload = response.json()
        self.assertEqual(payload["organizationId"], str(organization_id))
        self.assertEqual(payload["animalId"], str(animal_id))
        self.assertEqual(payload["status"], "active")
        self.assertEqual(payload["fileName"], "Health-Certificate-2026.pdf")
        self.assertNotIn("fileUrl", payload)

        with self.TestSessionLocal() as session:
            document = session.scalar(select(AnimalDocument))
            self.assertIsNotNone(document)
            self.assertEqual(document.organization_id, organization_id)
            self.assertFalse(Path(document.file_url).is_absolute())
            self.assertEqual(self.storage.read(document.file_url), PDF_CONTENT)

    def test_upload_rejects_client_managed_fields(self):
        organization_id, animal_id = self.create_organization_and_animal()

        response = self.upload_document(
            animal_id,
            extra_fields={"organizationId": str(organization_id)},
        )

        self.assertEqual(response.status_code, 400)
        with self.TestSessionLocal() as session:
            self.assertEqual(len(session.scalars(select(AnimalDocument)).all()), 0)

    def test_upload_accepts_supported_image_formats(self):
        _, animal_id = self.create_organization_and_animal()
        formats = (
            ("animal.jpg", JPEG_CONTENT, "image/jpeg"),
            ("animal.png", PNG_CONTENT, "image/png"),
            ("animal.webp", WEBP_CONTENT, "image/webp"),
        )

        for file_name, content, content_type in formats:
            with self.subTest(file_name=file_name):
                response = self.upload_document(
                    animal_id,
                    file_name=file_name,
                    content=content,
                    content_type=content_type,
                )
                self.assertEqual(response.status_code, 201, response.text)

    def test_upload_rejects_unsupported_or_mismatched_files(self):
        _, animal_id = self.create_organization_and_animal()
        invalid_files = (
            ("document.txt", b"plain text", "text/plain"),
            ("document.pdf", PDF_CONTENT, "image/png"),
            ("document.pdf", b"not really a PDF", "application/pdf"),
        )

        for file_name, content, content_type in invalid_files:
            with self.subTest(file_name=file_name, content_type=content_type):
                response = self.upload_document(
                    animal_id,
                    file_name=file_name,
                    content=content,
                    content_type=content_type,
                )
                self.assertEqual(response.status_code, 400)

    def test_upload_rejects_oversized_file_missing_animal_and_invalid_dates(self):
        _, animal_id = self.create_organization_and_animal()
        self.maximum_file_size = 8

        oversized = self.upload_document(
            animal_id,
            content=b"%PDF-1.4X",
        )
        self.assertEqual(oversized.status_code, 400)

        self.maximum_file_size = 10 * 1024 * 1024
        missing_animal = self.upload_document(uuid4())
        self.assertEqual(missing_animal.status_code, 404)

        invalid_dates = self.upload_document(
            animal_id,
            issued_at=date(2026, 8, 1),
            expires_at=date(2026, 7, 31),
        )
        self.assertEqual(invalid_dates.status_code, 400)

    def test_authenticated_service_context_sets_uploader(self):
        _, animal_id = self.create_organization_and_animal()
        with self.TestSessionLocal() as session:
            user = User(
                name="Document uploader",
                email=f"{uuid4().hex}@example.com",
                password_hash="test-hash",
            )
            session.add(user)
            session.commit()
            user_id = user.id

            upload_file = UploadFile(
                BytesIO(PDF_CONTENT),
                filename="certificate.pdf",
                headers=Headers({"content-type": "application/pdf"}),
            )
            result = asyncio.run(
                animal_document_service.upload_document(
                    session,
                    animal_id,
                    upload_file,
                    AnimalDocumentUploadMetadata(
                        document_type="health_certificate",
                    ),
                    authenticated_user_id=user_id,
                ),
            )

        self.assertEqual(result.uploaded_by_user_id, user_id)

    def test_list_filters_expiration_archive_and_organization(self):
        organization_id, animal_id = self.create_organization_and_animal()
        other_organization_id, other_animal_id = self.create_organization_and_animal(
            "other",
        )
        today = date.today()

        expired = self.upload_document(
            animal_id,
            document_type="identification",
            expires_at=today - timedelta(days=1),
        ).json()
        expiring = self.upload_document(
            animal_id,
            document_type="insurance",
            expires_at=today + timedelta(days=5),
        ).json()
        archived = self.upload_document(
            animal_id,
            document_type="pedigree",
            expires_at=today + timedelta(days=20),
        ).json()
        self.upload_document(
            other_animal_id,
            document_type="insurance",
            expires_at=today + timedelta(days=5),
        )
        archive_response = self.client.post(
            f"/api/v1/documents/{archived['id']}/archive",
        )
        self.assertEqual(archive_response.status_code, 200)

        animal_list = self.client.get(f"/api/v1/animals/{animal_id}/documents")
        self.assertEqual(animal_list.status_code, 200)
        self.assertEqual(
            {item["id"] for item in animal_list.json()}, {expired["id"], expiring["id"]}
        )

        active_only = self.client.get(
            f"/api/v1/animals/{animal_id}/documents",
            params={"includeExpired": "false", "documentType": "insurance"},
        )
        self.assertEqual([item["id"] for item in active_only.json()], [expiring["id"]])

        archived_only = self.client.get(
            f"/api/v1/animals/{animal_id}/documents",
            params={"status": "archived"},
        )
        self.assertEqual(
            [item["id"] for item in archived_only.json()], [archived["id"]]
        )

        expiring_list = self.client.get(
            f"/api/v1/organizations/{organization_id}/documents",
            params={"expiringWithinDays": 7},
        )
        self.assertEqual(
            [item["id"] for item in expiring_list.json()], [expiring["id"]]
        )
        self.assertTrue(
            all(
                item["organizationId"] == str(organization_id)
                for item in expiring_list.json()
            ),
        )

        isolated_list = self.client.get(
            f"/api/v1/organizations/{other_organization_id}/documents",
        )
        self.assertEqual(len(isolated_list.json()), 1)
        self.assertEqual(isolated_list.json()[0]["animalId"], str(other_animal_id))

    def test_expiration_filters_and_pagination_are_validated(self):
        organization_id, animal_id = self.create_organization_and_animal()
        today = date.today()
        self.upload_document(animal_id, expires_at=today + timedelta(days=10))

        filtered = self.client.get(
            f"/api/v1/organizations/{organization_id}/documents",
            params={
                "expiresAfter": (today + timedelta(days=5)).isoformat(),
                "expiresBefore": (today + timedelta(days=15)).isoformat(),
            },
        )
        self.assertEqual(filtered.status_code, 200)
        self.assertEqual(len(filtered.json()), 1)

        invalid_range = self.client.get(
            f"/api/v1/organizations/{organization_id}/documents",
            params={
                "expiresAfter": (today + timedelta(days=15)).isoformat(),
                "expiresBefore": (today + timedelta(days=5)).isoformat(),
            },
        )
        self.assertEqual(invalid_range.status_code, 400)

        invalid_pagination = self.client.get(
            f"/api/v1/animals/{animal_id}/documents",
            params={"page": 0},
        )
        self.assertEqual(invalid_pagination.status_code, 400)

    def test_metadata_update_allows_only_mutable_fields(self):
        _, animal_id = self.create_organization_and_animal()
        created = self.upload_document(animal_id).json()

        response = self.client.patch(
            f"/api/v1/documents/{created['id']}",
            json={
                "documentType": "vaccination_record",
                "issuedAt": "2026-06-01",
                "expiresAt": "2027-06-01",
            },
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["documentType"], "vaccination_record")
        self.assertEqual(response.json()["issuedAt"], "2026-06-01")

        immutable_fields = (
            {"fileName": "replacement.pdf"},
            {"fileUrl": "private/replacement.pdf"},
            {"animalId": str(uuid4())},
            {"organizationId": str(uuid4())},
            {"uploadedByUserId": str(uuid4())},
            {"status": "archived"},
        )
        for payload in immutable_fields:
            with self.subTest(payload=payload):
                rejected = self.client.patch(
                    f"/api/v1/documents/{created['id']}",
                    json=payload,
                )
                self.assertEqual(rejected.status_code, 400)

    def test_download_streams_file_without_exposing_locator(self):
        _, animal_id = self.create_organization_and_animal()
        created = self.upload_document(animal_id).json()

        metadata = self.client.get(f"/api/v1/documents/{created['id']}")
        download = self.client.get(f"/api/v1/documents/{created['id']}/download")

        self.assertEqual(metadata.status_code, 200)
        self.assertNotIn("fileUrl", metadata.json())
        self.assertEqual(download.status_code, 200)
        self.assertEqual(download.content, PDF_CONTENT)
        self.assertEqual(download.headers["content-type"], "application/pdf")
        self.assertEqual(download.headers["x-document-id"], created["id"])
        self.assertNotIn(self.storage_directory.name, download.text)

    def test_archive_and_soft_delete_enforce_lifecycle(self):
        _, animal_id = self.create_organization_and_animal()
        archived = self.upload_document(animal_id).json()

        first_archive = self.client.post(
            f"/api/v1/documents/{archived['id']}/archive",
        )
        self.assertEqual(first_archive.status_code, 200)
        self.assertEqual(first_archive.json()["status"], "archived")
        self.assertEqual(
            self.client.post(
                f"/api/v1/documents/{archived['id']}/archive",
            ).status_code,
            409,
        )
        self.assertEqual(
            self.client.patch(
                f"/api/v1/documents/{archived['id']}",
                json={"documentType": "other"},
            ).status_code,
            409,
        )
        self.assertEqual(
            self.client.get(
                f"/api/v1/documents/{archived['id']}/download",
            ).status_code,
            409,
        )

        deleted = self.upload_document(animal_id).json()
        with self.TestSessionLocal() as session:
            locator = session.get(AnimalDocument, deleted["id"]).file_url
        delete_response = self.client.delete(f"/api/v1/documents/{deleted['id']}")
        self.assertEqual(delete_response.status_code, 204)
        self.assertEqual(
            self.client.delete(f"/api/v1/documents/{deleted['id']}").status_code,
            409,
        )
        self.assertEqual(
            self.client.get(f"/api/v1/documents/{deleted['id']}").status_code,
            404,
        )
        self.assertEqual(
            self.client.post(
                f"/api/v1/documents/{deleted['id']}/archive",
            ).status_code,
            409,
        )
        self.assertEqual(self.storage.read(locator), PDF_CONTENT)


if __name__ == "__main__":
    unittest.main()
