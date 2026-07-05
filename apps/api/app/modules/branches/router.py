from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.tenant import OrganizationContext, get_organization_context
from app.db.session import get_db_session

router = APIRouter(prefix="/branches", tags=["branches"])


@router.get("")
async def list_branches(
    context: OrganizationContext = Depends(get_organization_context),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict[str, object]]:
    result = await session.execute(
        text(
            """
            select b.id, b.name, b.code, b.address, b.phone, b.is_main, b.is_active,
                   count(distinct w.id) as warehouse_count
            from public.branches b
            left join public.warehouses w on w.organization_id = b.organization_id
              and w.branch_id = b.id and w.is_active
            where b.organization_id = :organization_id
              and (:branch_id is null or b.id = :branch_id)
            group by b.id order by b.is_main desc, b.name
            """
        ),
        {"organization_id": context.organization_id, "branch_id": context.branch_id},
    )
    return [dict(row) for row in result.mappings().all()]
