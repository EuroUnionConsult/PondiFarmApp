from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field

from schemas.base import APIModel

MemberRole = Literal["viewer"]


class OrganizationMemberCreate(APIModel):
    user_id: UUID
    role: MemberRole = Field(default="viewer")


class OrganizationMemberUpdate(APIModel):
    role: MemberRole = Field(default="viewer")


class OrganizationMemberResponse(APIModel):
    id: UUID
    organization_id: UUID
    user_id: UUID
    user_name: str
    user_email: str
    role: MemberRole
    created_at: datetime
    updated_at: datetime
