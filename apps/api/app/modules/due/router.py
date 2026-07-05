from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import CurrentUser, get_current_user
from app.core.tenant import OrganizationContext, get_organization_context
from app.db.session import get_db_session
from app.schemas import DueCollectionCreate

router = APIRouter(prefix="/due", tags=["due"])


@router.get("")
async def list_due(
    context: OrganizationContext = Depends(get_organization_context),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict[str, object]]:
    result = await session.execute(
        text(
            """
            select c.id as customer_id, c.name as customer_name, c.phone, c.credit_limit,
                   coalesce(sum(l.debit - l.credit), 0) as balance,
                   max(l.created_at) as last_activity,
                   coalesce(sum(l.debit - l.credit), 0) > c.credit_limit
                     as over_credit_limit
            from public.customers c
            left join public.customer_ledger_entries l
              on l.customer_id = c.id and l.organization_id = c.organization_id
            where c.organization_id = :organization_id
              and c.status = 'active'
              and (cast(:branch_id as uuid) is null or c.branch_id = :branch_id)
            group by c.id
            having coalesce(sum(l.debit - l.credit), 0) <> 0
            order by balance desc
            """
        ),
        {"organization_id": context.organization_id, "branch_id": context.branch_id},
    )
    return [dict(row) for row in result.mappings().all()]


@router.post("/collections", status_code=status.HTTP_201_CREATED)
async def collect_due(
    payload: DueCollectionCreate,
    context: OrganizationContext = Depends(get_organization_context),
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, object]:
    branch_id = payload.branch_id or context.branch_id
    async with session.begin():
        customer = (
            (
                await session.execute(
                    text(
                        """
                    select c.id, c.branch_id, coalesce(sum(l.debit - l.credit), 0) as balance
                    from public.customers c
                    left join public.customer_ledger_entries l
                      on l.customer_id = c.id and l.organization_id = c.organization_id
                    where c.id = :customer_id and c.organization_id = :organization_id
                    group by c.id
                    """
                    ),
                    {
                        "customer_id": payload.customer_id,
                        "organization_id": context.organization_id,
                    },
                )
            )
            .mappings()
            .one_or_none()
        )
        if customer is None:
            raise HTTPException(status_code=404, detail="Customer not found")
        if payload.amount > customer["balance"]:
            raise HTTPException(status_code=422, detail="Collection exceeds outstanding due")
        branch_id = branch_id or customer["branch_id"]
        if branch_id is None:
            raise HTTPException(status_code=409, detail="An active branch is required")
        payment_id = (
            await session.execute(
                text(
                    """
                    insert into public.payments
                      (organization_id, branch_id, payment_type, method, amount,
                       reference_no, customer_id, received_by)
                    values (:organization_id, :branch_id, 'due_collection', :method, :amount,
                            :reference_no, :customer_id, :received_by)
                    returning id
                    """
                ),
                {
                    "organization_id": context.organization_id,
                    "branch_id": branch_id,
                    "method": payload.method,
                    "amount": payload.amount,
                    "reference_no": payload.reference_no,
                    "customer_id": payload.customer_id,
                    "received_by": user.id,
                },
            )
        ).scalar_one()
        ledger_id = (
            await session.execute(
                text(
                    """
                    insert into public.customer_ledger_entries
                      (organization_id, branch_id, customer_id, entry_type, credit,
                       reference_type, reference_id, note, created_by)
                    values (:organization_id, :branch_id, :customer_id, 'payment', :amount,
                            'payment', :payment_id, :note, :created_by)
                    returning id
                    """
                ),
                {
                    "organization_id": context.organization_id,
                    "branch_id": branch_id,
                    "customer_id": payload.customer_id,
                    "amount": payload.amount,
                    "payment_id": payment_id,
                    "note": payload.note,
                    "created_by": user.id,
                },
            )
        ).scalar_one()
        await session.execute(
            text(
                """
                insert into public.cashbook_entries
                  (organization_id, branch_id, entry_type, direction, amount, method,
                   reference_type, reference_id, note, created_by)
                values (:organization_id, :branch_id, 'due_collection', 'in', :amount,
                        :method, 'payment', :payment_id, :note, :created_by)
                """
            ),
            {
                "organization_id": context.organization_id,
                "branch_id": branch_id,
                "amount": payload.amount,
                "method": payload.method,
                "payment_id": payment_id,
                "note": payload.note,
                "created_by": user.id,
            },
        )
    return {"id": ledger_id, "payment_id": payment_id, "amount": payload.amount}
