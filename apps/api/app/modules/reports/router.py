# ruff: noqa: E501
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import require_permission
from app.core.tenant import OrganizationContext, get_organization_context
from app.db.session import get_db_session

router = APIRouter(prefix="/reports", tags=["reports"])
report_viewer = require_permission("reports.view")


async def report_branch(
    requested: UUID | None, context: OrganizationContext, session: AsyncSession
) -> UUID | None:
    if context.branch_id:
        if requested and requested != context.branch_id:
            raise HTTPException(status_code=403, detail="এই শাখার রিপোর্ট দেখার অনুমতি নেই।")
        return context.branch_id
    if requested:
        exists = (
            await session.execute(
                text(
                    "select 1 from public.branches where id=:id and organization_id=:org and is_active"
                ),
                {"id": requested, "org": context.organization_id},
            )
        ).scalar_one_or_none()
        if not exists:
            raise HTTPException(status_code=404, detail="Branch not found")
    return requested


async def summary_query(context: OrganizationContext, session: AsyncSession) -> dict[str, object]:
    result = await session.execute(
        text("""
        select
          coalesce((select sum(s.grand_total-coalesce((select sum(sr.return_total) from public.sale_returns sr where sr.sale_id=s.id),0))
            from public.sales s where s.organization_id=:org and s.status='completed' and s.sold_at>=current_date
            and (cast(:branch as uuid) is null or s.branch_id=:branch)
            and not exists(select 1 from public.sale_voids sv where sv.sale_id=s.id)),0) sales_today,
          coalesce((select sum(s.profit_total-coalesce((select sum(sri.line_total-sri.purchase_cost*sri.quantity)
            from public.sale_return_items sri join public.sale_returns sr on sr.id=sri.sale_return_id where sr.sale_id=s.id),0))
            from public.sales s where s.organization_id=:org and s.status='completed' and s.sold_at>=current_date
            and (cast(:branch as uuid) is null or s.branch_id=:branch)
            and not exists(select 1 from public.sale_voids sv where sv.sale_id=s.id)),0) profit_today,
          coalesce((select sum(s.grand_total-coalesce((select sum(sr.return_total) from public.sale_returns sr where sr.sale_id=s.id),0))
            from public.sales s where s.organization_id=:org and s.status='completed' and s.sold_at>=date_trunc('month',now())
            and (cast(:branch as uuid) is null or s.branch_id=:branch)
            and not exists(select 1 from public.sale_voids sv where sv.sale_id=s.id)),0) sales_this_month,
          coalesce((select sum(s.profit_total-coalesce((select sum(sri.line_total-sri.purchase_cost*sri.quantity)
            from public.sale_return_items sri join public.sale_returns sr on sr.id=sri.sale_return_id where sr.sale_id=s.id),0))
            from public.sales s where s.organization_id=:org and s.status='completed' and s.sold_at>=date_trunc('month',now())
            and (cast(:branch as uuid) is null or s.branch_id=:branch)
            and not exists(select 1 from public.sale_voids sv where sv.sale_id=s.id)),0) gross_profit,
          coalesce((select count(*) from public.sales s where s.organization_id=:org
            and s.status='completed' and s.sold_at>=current_date and (cast(:branch as uuid) is null or s.branch_id=:branch)
            and not exists(select 1 from public.sale_voids sv where sv.sale_id=s.id)),0) transactions_today,
          coalesce((select sum(debit-credit) from public.customer_ledger_entries where organization_id=:org
            and (cast(:branch as uuid) is null or branch_id=:branch)),0) receivable_due,
          coalesce((select count(*) from public.inventory_balances ib join public.product_variants pv on pv.id=ib.product_variant_id
            where ib.organization_id=:org and ib.quantity<=pv.reorder_level and (cast(:branch as uuid) is null or ib.branch_id=:branch)),0) low_stock_items,
          coalesce((select sum(quantity*avg_cost) from public.inventory_balances where organization_id=:org
            and (cast(:branch as uuid) is null or branch_id=:branch)),0) inventory_value,
          coalesce((select count(*) from public.products where organization_id=:org and status='active'),0) total_products,
          coalesce((select count(*) from public.customers where organization_id=:org and status='active'),0) total_customers,
          coalesce((select sum(case when payment_type='refund' then -amount else amount end) from public.payments where organization_id=:org and paid_at>=current_date
            and (cast(:branch as uuid) is null or branch_id=:branch)),0) collection_today
    """),
        {"org": context.organization_id, "branch": context.branch_id},
    )
    return dict(result.mappings().one())


@router.get("")
@router.get("/dashboard")
@router.get("/summary")
async def report_summary(
    context: OrganizationContext = Depends(get_organization_context),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, object]:
    return await summary_query(context, session)


@router.get("/sales")
async def sales_report(
    days: int = Query(default=30, ge=1, le=366),
    date_from: date | None = None,
    date_to: date | None = None,
    branch_id: UUID | None = None,
    payment_method: str | None = Query(default=None, max_length=20),
    context: OrganizationContext = Depends(report_viewer),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, object]:
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=422, detail="Invalid date range")
    branch = await report_branch(branch_id, context, session)
    daily = await session.execute(
        text("""
      select s.sold_at::date as date,count(*) as transactions,
             sum(s.grand_total-coalesce((select sum(sr.return_total) from public.sale_returns sr where sr.sale_id=s.id),0)) as sales,
             sum(s.profit_total-coalesce((select sum(sri.line_total-sri.purchase_cost*sri.quantity)
               from public.sale_return_items sri join public.sale_returns sr on sr.id=sri.sale_return_id where sr.sale_id=s.id),0)) as profit,
             sum(s.due_total-coalesce((select sum(sr.due_adjustment) from public.sale_returns sr where sr.sale_id=s.id),0)) as due
      from public.sales s where s.organization_id=:org and s.status='completed'
        and s.sold_at>=coalesce(cast(:date_from as date),current_date-(:days-1)*interval '1 day')
        and (cast(:date_to as date) is null or s.sold_at<cast(:date_to as date)+interval '1 day')
        and (cast(:branch as uuid) is null or s.branch_id=:branch)
        and not exists(select 1 from public.sale_voids sv where sv.sale_id=s.id)
        and (cast(:method as text) is null or exists(select 1 from public.payments p where p.sale_id=s.id and p.method=:method))
      group by s.sold_at::date order by date
    """),
        {
            "org": context.organization_id,
            "branch": branch,
            "days": days,
            "date_from": date_from,
            "date_to": date_to,
            "method": payment_method,
        },
    )
    payment = await session.execute(
        text("""
      select method,sum(case when payment_type='refund' then -amount else amount end) as amount,count(*) as transactions from public.payments
      where organization_id=:org and paid_at>=coalesce(cast(:date_from as date),current_date-(:days-1)*interval '1 day')
        and (cast(:date_to as date) is null or paid_at<cast(:date_to as date)+interval '1 day')
        and (cast(:branch as uuid) is null or branch_id=:branch)
        and (cast(:method as text) is null or method=:method) group by method order by amount desc
    """),
        {
            "org": context.organization_id,
            "branch": branch,
            "days": days,
            "date_from": date_from,
            "date_to": date_to,
            "method": payment_method,
        },
    )
    best = await session.execute(
        text("""
      select si.description,
             sum(si.quantity-coalesce((select sum(sri.quantity) from public.sale_return_items sri where sri.sale_item_id=si.id),0)) as quantity,
             sum(si.line_total-coalesce((select sum(sri.line_total) from public.sale_return_items sri where sri.sale_item_id=si.id),0)) as sales
      from public.sale_items si join public.sales s on s.id=si.sale_id
      where si.organization_id=:org and s.status='completed'
        and not exists(select 1 from public.sale_voids sv where sv.sale_id=s.id)
        and s.sold_at>=coalesce(cast(:date_from as date),current_date-(:days-1)*interval '1 day')
        and (cast(:date_to as date) is null or s.sold_at<cast(:date_to as date)+interval '1 day')
        and (cast(:branch as uuid) is null or si.branch_id=:branch)
        and (cast(:method as text) is null or exists(select 1 from public.payments p where p.sale_id=s.id and p.method=:method))
      group by si.description order by quantity desc limit 10
    """),
        {
            "org": context.organization_id,
            "branch": branch,
            "days": days,
            "date_from": date_from,
            "date_to": date_to,
            "method": payment_method,
        },
    )
    return {
        "daily": [dict(r) for r in daily.mappings().all()],
        "payment_methods": [dict(r) for r in payment.mappings().all()],
        "best_sellers": [dict(r) for r in best.mappings().all()],
    }


@router.get("/inventory")
async def inventory_report(
    branch_id: UUID | None = None,
    context: OrganizationContext = Depends(report_viewer),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, object]:
    branch = await report_branch(branch_id, context, session)
    rows = await session.execute(
        text("""
      select p.name,p.name_bn,pv.sku,coalesce(sum(ib.quantity),0) quantity,
             coalesce(sum(ib.quantity*ib.avg_cost),0) stock_value,pv.reorder_level,
             bool_or(ib.quantity<=pv.reorder_level) as low_stock
      from public.products p join public.product_variants pv on pv.product_id=p.id
      left join public.inventory_balances ib on ib.product_variant_id=pv.id
        and (cast(:branch as uuid) is null or ib.branch_id=:branch)
      where p.organization_id=:org and p.status='active'
      group by p.name,p.name_bn,pv.sku,pv.reorder_level order by stock_value desc
    """),
        {"org": context.organization_id, "branch": branch},
    )
    items = [dict(r) for r in rows.mappings().all()]
    return {
        "items": items,
        "inventory_value": sum(float(r["stock_value"] or 0) for r in items),
        "low_stock_count": sum(1 for r in items if r["low_stock"]),
    }


@router.get("/due")
async def due_report(
    branch_id: UUID | None = None,
    context: OrganizationContext = Depends(report_viewer),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, object]:
    branch = await report_branch(branch_id, context, session)
    rows = await session.execute(
        text("""
      select c.id,c.name,c.phone,c.credit_limit,sum(l.debit-l.credit) balance,
             max(l.created_at) last_activity
      from public.customers c join public.customer_ledger_entries l on l.customer_id=c.id
      where c.organization_id=:org and (cast(:branch as uuid) is null or l.branch_id=:branch)
      group by c.id,c.name,c.phone,c.credit_limit having sum(l.debit-l.credit)>0
      order by balance desc
    """),
        {"org": context.organization_id, "branch": branch},
    )
    customers = [dict(r) for r in rows.mappings().all()]
    return {"customers": customers, "receivable_due": sum(float(r["balance"]) for r in customers)}


@router.get("/profit")
async def profit_report(
    days: int = Query(default=30, ge=1, le=366),
    date_from: date | None = None,
    date_to: date | None = None,
    branch_id: UUID | None = None,
    payment_method: str | None = Query(default=None, max_length=20),
    context: OrganizationContext = Depends(report_viewer),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, object]:
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=422, detail="Invalid date range")
    branch = await report_branch(branch_id, context, session)
    result = await session.execute(
        text("""
      select coalesce(sum(s.grand_total-coalesce((select sum(sr.return_total) from public.sale_returns sr where sr.sale_id=s.id),0)),0) net_sales,
             coalesce(sum(s.profit_total-coalesce((select sum(sri.line_total-sri.purchase_cost*sri.quantity)
               from public.sale_return_items sri join public.sale_returns sr on sr.id=sri.sale_return_id where sr.sale_id=s.id),0)),0) gross_profit,
             coalesce(sum(s.vat_total * (1 - coalesce((select sum(sr.return_total)
               from public.sale_returns sr where sr.sale_id=s.id),0) / nullif(s.grand_total,0))),0) tax_total,
             case when sum(s.grand_total-coalesce((select sum(sr.return_total) from public.sale_returns sr where sr.sale_id=s.id),0))>0 then
               round(sum(s.profit_total-coalesce((select sum(sri.line_total-sri.purchase_cost*sri.quantity)
                 from public.sale_return_items sri join public.sale_returns sr on sr.id=sri.sale_return_id where sr.sale_id=s.id),0)) /
                 sum(s.grand_total-coalesce((select sum(sr.return_total) from public.sale_returns sr where sr.sale_id=s.id),0))*100,2) else 0 end profit_margin
      from public.sales s where s.organization_id=:org and s.status='completed'
        and s.sold_at>=coalesce(cast(:date_from as date),current_date-(:days-1)*interval '1 day')
        and (cast(:date_to as date) is null or s.sold_at<cast(:date_to as date)+interval '1 day')
        and (cast(:branch as uuid) is null or s.branch_id=:branch)
        and not exists(select 1 from public.sale_voids sv where sv.sale_id=s.id)
        and (cast(:method as text) is null or exists(select 1 from public.payments p where p.sale_id=s.id and p.method=:method))
    """),
        {
            "org": context.organization_id,
            "branch": branch,
            "days": days,
            "date_from": date_from,
            "date_to": date_to,
            "method": payment_method,
        },
    )
    return dict(result.mappings().one())
