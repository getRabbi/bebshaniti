# ruff: noqa: E501
from datetime import date
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import require_permission
from app.core.security import CurrentUser, get_current_user
from app.core.tenant import OrganizationContext, get_organization_context, resolve_branch_id
from app.db.session import get_db_session
from app.schemas import CustomerCreate

router = APIRouter(prefix="/customers", tags=["customers"])
customer_creator = require_permission("customers.create")


@router.get("")
async def list_customers(
    search: str | None = Query(default=None, max_length=100),
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
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
            limit :limit offset :offset
            """
        ),
        {
            "organization_id": context.organization_id,
            "branch_id": context.branch_id,
            "search": search,
            "limit": limit,
            "offset": offset,
        },
    )
    return [dict(row) for row in result.mappings().all()]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_customer(
    payload: CustomerCreate,
    context: OrganizationContext = Depends(customer_creator),
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, object]:
    branch_id = await resolve_branch_id(context, session, payload.branch_id)
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


@router.get("/{customer_id}/statement")
async def customer_statement(
    customer_id: UUID,
    date_from: date | None = None,
    date_to: date | None = None,
    context: OrganizationContext = Depends(get_organization_context),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, object]:
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=422, detail="Invalid date range")
    customer = (
        (
            await session.execute(
                text(
                    """
                select c.id,c.name,c.phone,c.address,c.credit_limit,c.branch_id,
                       o.name as organization_name,o.address as organization_address,
                       o.phone as organization_phone,b.name as branch_name
                from public.customers c
                join public.organizations o on o.id=c.organization_id
                left join public.branches b on b.id=c.branch_id
                where c.id=:customer and c.organization_id=:org
                  and (cast(:branch as uuid) is null or c.branch_id=:branch)
                """
                ),
                {
                    "customer": customer_id,
                    "org": context.organization_id,
                    "branch": context.branch_id,
                },
            )
        )
        .mappings()
        .one_or_none()
    )
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    opening = (
        (
            await session.execute(
                text(
                    """
                select coalesce(sum(debit-credit),0) from public.customer_ledger_entries
                where organization_id=:org and customer_id=:customer
                  and (cast(:branch as uuid) is null or branch_id=:branch)
                  and (cast(:date_from as date) is not null and created_at < cast(:date_from as date))
                """
                ),
                {
                    "org": context.organization_id,
                    "customer": customer_id,
                    "branch": context.branch_id,
                    "date_from": date_from,
                },
            )
        ).scalar_one()
        if date_from
        else Decimal("0")
    )
    ledger_result = await session.execute(
        text(
            """
            select id,entry_type,debit,credit,reference_type,reference_id,note,created_at
            from public.customer_ledger_entries
            where organization_id=:org and customer_id=:customer
              and (cast(:branch as uuid) is null or branch_id=:branch)
              and (cast(:date_from as date) is null or created_at >= cast(:date_from as date))
              and (cast(:date_to as date) is null or created_at < cast(:date_to as date)+interval '1 day')
            order by created_at,id
            """
        ),
        {
            "org": context.organization_id,
            "customer": customer_id,
            "branch": context.branch_id,
            "date_from": date_from,
            "date_to": date_to,
        },
    )
    balance = Decimal(opening)
    ledger: list[dict[str, object]] = []
    for item in ledger_result.mappings().all():
        balance += Decimal(item["debit"]) - Decimal(item["credit"])
        ledger.append({**dict(item), "balance": balance})
    totals = (
        (
            await session.execute(
                text(
                    """
                select coalesce(sum(debit),0) total_due,
                       coalesce(sum(credit) filter (where entry_type='payment'),0) total_paid,
                       coalesce(sum(debit-credit),0) current_balance
                from public.customer_ledger_entries
                where organization_id=:org and customer_id=:customer
                  and (cast(:branch as uuid) is null or branch_id=:branch)
                """
                ),
                {
                    "org": context.organization_id,
                    "customer": customer_id,
                    "branch": context.branch_id,
                },
            )
        )
        .mappings()
        .one()
    )
    sales = await session.execute(
        text(
            """
            select id,memo_no,grand_total,paid_total,due_total,completed_at
            from public.sales where organization_id=:org and customer_id=:customer and status='completed'
              and (cast(:branch as uuid) is null or branch_id=:branch)
              and (cast(:date_from as date) is null or completed_at >= cast(:date_from as date))
              and (cast(:date_to as date) is null or completed_at < cast(:date_to as date)+interval '1 day')
            order by completed_at desc
            """
        ),
        {
            "org": context.organization_id,
            "customer": customer_id,
            "branch": context.branch_id,
            "date_from": date_from,
            "date_to": date_to,
        },
    )
    payments = await session.execute(
        text(
            """
            select id,method,amount,reference_no,paid_at,payment_type
            from public.payments where organization_id=:org and customer_id=:customer
              and (cast(:branch as uuid) is null or branch_id=:branch)
              and (cast(:date_from as date) is null or paid_at >= cast(:date_from as date))
              and (cast(:date_to as date) is null or paid_at < cast(:date_to as date)+interval '1 day')
            order by paid_at desc
            """
        ),
        {
            "org": context.organization_id,
            "customer": customer_id,
            "branch": context.branch_id,
            "date_from": date_from,
            "date_to": date_to,
        },
    )
    return {
        "customer": dict(customer),
        "date_from": date_from,
        "date_to": date_to,
        "opening_balance": opening,
        **dict(totals),
        "closing_balance": balance,
        "ledger": ledger,
        "sales": [dict(row) for row in sales.mappings().all()],
        "payments": [dict(row) for row in payments.mappings().all()],
    }
