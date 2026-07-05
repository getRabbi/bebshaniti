# ruff: noqa: E501
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import require_roles
from app.core.tenant import OrganizationContext
from app.db.session import get_db_session

router = APIRouter(prefix="/audit-logs", tags=["audit-logs"])
audit_admin = require_roles("owner", "admin")


@router.get("")
async def list_audit_logs(
    user_id: UUID | None = None,
    action: str | None = Query(default=None, max_length=40),
    module: str | None = Query(default=None, max_length=80),
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    context: OrganizationContext = Depends(audit_admin),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict[str, object]]:
    result = await session.execute(
        text(
            """
            select a.id,a.action,a.entity_type,a.entity_id,a.created_at,a.branch_id,
                   b.name as branch_name,a.actor_user_id,p.full_name as actor_name,p.email as actor_email
            from public.audit_logs a
            left join public.profiles p on p.id=a.actor_user_id
            left join public.branches b on b.id=a.branch_id
            where a.organization_id=:org
              and (cast(:user_id as uuid) is null or a.actor_user_id=:user_id)
              and (cast(:action as text) is null or a.action=:action)
              and (cast(:module as text) is null or a.entity_type=:module)
              and (cast(:date_from as date) is null or a.created_at>=cast(:date_from as date))
              and (cast(:date_to as date) is null or a.created_at<cast(:date_to as date)+interval '1 day')
            order by a.created_at desc limit :limit
            """
        ),
        {
            "org": context.organization_id,
            "user_id": user_id,
            "action": action,
            "module": module,
            "date_from": date_from,
            "date_to": date_to,
            "limit": limit,
        },
    )
    return [dict(row) for row in result.mappings().all()]
