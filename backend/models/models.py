from __future__ import annotations

from datetime import datetime
import json
import uuid

from sqlalchemy import (
    CHAR,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    JSON,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.mssql import UNIQUEIDENTIFIER
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TypeDecorator

from core.database import Base


class GUID(TypeDecorator):
    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "mssql":
            return dialect.type_descriptor(UNIQUEIDENTIFIER())
        return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        if isinstance(value, uuid.UUID):
            return str(value)
        return str(uuid.UUID(str(value)))

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        return uuid.UUID(str(value))


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    document_number: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        unique=True,
    )
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    members: Mapped[list["OrganizationMember"]] = relationship(
        back_populates="organization",
    )


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    memberships: Mapped[list["OrganizationMember"]] = relationship(
        back_populates="user",
    )


class OrganizationMember(Base):
    __tablename__ = "organization_members"
    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "user_id",
            name="uq_organization_members_organization_user",
        ),
        CheckConstraint(
            "role = 'viewer'",
            name="ck_organization_members_role_viewer",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("organizations.id"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("users.id"),
        nullable=False,
    )
    role: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="viewer",
        server_default=text("'viewer'"),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    organization: Mapped[Organization] = relationship(back_populates="members")
    user: Mapped[User] = relationship(back_populates="memberships")


class AnimalScan(Base):
    __tablename__ = "animal_scans"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        nullable=False,
        default=uuid.uuid4,
    )
    animal_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        nullable=False,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), nullable=True)

    estimated_weight_kg: Mapped[float | None] = mapped_column(
        "estimated_weight",
        Float,
        nullable=True,
    )
    confidence_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    scan_status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="pending",
        server_default=text("'pending'"),
    )
    scan_source: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        default="lidar",
        server_default=text("'lidar'"),
    )
    scanned_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    body_length_cm: Mapped[float | None] = mapped_column(
        "body_length",
        Float,
        nullable=True,
    )
    withers_height_cm: Mapped[float | None] = mapped_column(
        "withers_height",
        Float,
        nullable=True,
    )
    chest_girth_cm: Mapped[float | None] = mapped_column(
        "chest_circumference",
        Float,
        nullable=True,
    )
    rump_width_cm: Mapped[float | None] = mapped_column(
        "hip_width",
        Float,
        nullable=True,
    )
    raw_result_json: Mapped[dict[str, object] | None] = mapped_column(
        JSON,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    @property
    def thoracic_depth_cm(self) -> None:
        return None

    @property
    def mesh_uri(self) -> None:
        return None

    @property
    def estimation_model_version(self) -> str | None:
        raw_result = self._raw_result_dict()
        if raw_result is None:
            return None
        model_version = raw_result.get("model_version")
        if isinstance(model_version, str):
            return model_version
        return None

    @property
    def estimation_method(self) -> str | None:
        raw_result = self._raw_result_dict()
        if raw_result is None:
            return None
        estimation_method = raw_result.get("estimation_method")
        if isinstance(estimation_method, str):
            return estimation_method
        return None

    @property
    def estimation_diagnostics_json(self) -> dict[str, object] | None:
        raw_result = self._raw_result_dict()
        if raw_result is None:
            return None
        diagnostics = raw_result.get("diagnostics")
        if isinstance(diagnostics, dict):
            return diagnostics
        return None

    @property
    def real_weight_kg(self) -> None:
        return None

    @property
    def real_weight_measured_at(self) -> None:
        return None

    @property
    def real_weight_source(self) -> None:
        return None

    @property
    def real_weight_notes(self) -> None:
        return None

    @property
    def is_ground_truth_verified(self) -> bool:
        return False

    def _raw_result_dict(self) -> dict[str, object] | None:
        if isinstance(self.raw_result_json, dict):
            return self.raw_result_json
        if isinstance(self.raw_result_json, str):
            try:
                parsed_result = json.loads(self.raw_result_json)
            except json.JSONDecodeError:
                return None
            if isinstance(parsed_result, dict):
                return parsed_result
        return None
