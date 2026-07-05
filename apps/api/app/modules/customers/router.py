from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import CurrentUser, get_current_user
from app.core.tenant import OrganizationContext, get_organization_context
from app.db.session import get_db_session
from app.schemas import CustomerCreate

router = APIRouter(prefix="/customers", tags=["customers"])


@router.get("")
async def list_customers(
    search: str | None = Query(default=None, max_length=100),
    context: OrganizationContext = Depends(get_organization_context),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict[str, object]]:
    result = await session.execute(
        text(
            """
            select c.id, c.branch_id, b.name as branch_name, c.name, c.phone, c.address,
                   c.district, c.customer_type, c.credit_limit, c.status,
                   coalesce(sum(l.debit - l.credit), 0) as due_balance,
                   max(l.created_at) as last_ledger_activity
            from public.customers c
            left join public.branches b on b.id = c.branch_id
            left join public.customer_ledger_entries l
              on l.customer_id = c.id and l.organization_id = c.organization_id
            where c.organization_id = :organization_id
              and c.status <> 'archived'
              and (cast(:branch_id as uuid) is null or c.branch_id = :branch_id)
              and (cast(:search as text) is null or c.name ilike '%' || :search || '%'
                or c.phone ilike '%' || :search || '%')
            group by c.id, b.name order by c.name
            """
        ),
        {
            "organization_id": context.organization_id,
            "branch_id": context.branch_id,
            "search": search,
        },
    )
    return [dict(row) for row in result.mappings().all()]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_customer(
    payload: CustomerCreate,
    context: OrganizationContext = Depends(get_organization_context),
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, object]:
    branch_id = payload.branch_id or context.branch_id
    if branch_id is None:
        branch_id = (
            await session.execute(
                text("select id from public.branches where organization_id = :id and is_main"),
                {"id": context.organization_id},
            )
        ).scalar_one_or_none()
    if branch_id is None:
        raise HTTPException(status_code=409, detail="An active branch is required")
    try:
        result = await session.execute(
            text(
                """
                insert into public.customers
                  (organization_id, branch_id, name, phone, address, district,
                   customer_type, credit_limit, created_by)
                values (:organization_id, :branch_id, :name, :phone, :address, :district,
                        :customer_type, :credit_limit, :created_by)
                returning id, branch_id, name, phone, address, district,
                          customer_type, credit_limit, status, created_at
                """
            ),
            {
                "organization_id": context.organization_id,
                "branch_id": branch_id,
                "name": payload.name,
                "phone": payload.phone,
                "address": payload.address,
                "district": payload.district,
                "customer_type": payload.customer_type,
                "credit_limit": payload.credit_limit,
                "created_by": user.id,
            },
        )
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=409, detail="A customer with this phone already exists"
        ) from exc
    return dict(result.mappings().one())
