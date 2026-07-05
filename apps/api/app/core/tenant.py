from dataclasses import dataclass
from uuid import UUID

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import CurrentUser, get_current_user
from app.db.session import get_db_session


@dataclass(frozen=True, slots=True)
class OrganizationContext:
    organization_id: UUID
    branch_id: UUID | None
    membership_id: UUID
    role: str
    permissions: dict[str, bool]


async def get_organization_context(
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
    organization_header: str | None = Header(default=None, alias="X-Organization-ID"),
) -> OrganizationContext:
    if not organization_header:
        raise HTTPException(status_code=400, detail="X-Organization-ID header is required")
    try:
        organization_id = UUID(organization_header)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="X-Organization-ID must be a UUID") from exc

    result = await session.execute(
        text(
            """
            select id, organization_id, branch_id, role::text, permissions
            from public.memberships
            where organization_id = :organization_id
              and user_id = :user_id
              and status = 'active'
            limit 1
            """
        ),
        {"organization_id": organization_id, "user_id": user.id},
    )
    row = result.mappings().one_or_none()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Active membership required",
        )
    return OrganizationContext(
        organization_id=row["organization_id"],
        branch_id=row["branch_id"],
        membership_id=row["id"],
        role=row["role"],
        permissions=row["permissions"] or {},
    )
