# ruff: noqa: E501
from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.tenant import OrganizationContext, get_organization_context
from app.db.session import get_db_session

router = APIRouter(prefix="/reports", tags=["reports"])


async def summary_query(context: OrganizationContext, session: AsyncSession) -> dict[str, object]:
    result = await session.execute(text("""
        select
          coalesce((select sum(grand_total) from public.sales where organization_id=:org
            and status='completed' and sold_at>=current_date and (cast(:branch as uuid) is null or branch_id=:branch)),0) sales_today,
          coalesce((select sum(profit_total) from public.sales where organization_id=:org
            and status='completed' and sold_at>=current_date and (cast(:branch as uuid) is null or branch_id=:branch)),0) profit_today,
          coalesce((select sum(grand_total) from public.sales where organization_id=:org
            and status='completed' and sold_at>=date_trunc('month',now()) and (cast(:branch as uuid) is null or branch_id=:branch)),0) sales_this_month,
          coalesce((select sum(profit_total) from public.sales where organization_id=:org
            and status='completed' and sold_at>=date_trunc('month',now()) and (cast(:branch as uuid) is null or branch_id=:branch)),0) gross_profit,
          coalesce((select count(*) from public.sales where organization_id=:org
            and status='completed' and sold_at>=current_date and (cast(:branch as uuid) is null or branch_id=:branch)),0) transactions_today,
          coalesce((select sum(debit-credit) from public.customer_ledger_entries where organization_id=:org
            and (cast(:branch as uuid) is null or branch_id=:branch)),0) receivable_due,
          coalesce((select count(*) from public.inventory_balances ib join public.product_variants pv on pv.id=ib.product_variant_id
            where ib.organization_id=:org and ib.quantity<=pv.reorder_level and (cast(:branch as uuid) is null or ib.branch_id=:branch)),0) low_stock_items,
          coalesce((select sum(quantity*avg_cost) from public.inventory_balances where organization_id=:org
            and (cast(:branch as uuid) is null or branch_id=:branch)),0) inventory_value,
          coalesce((select count(*) from public.products where organization_id=:org and status='active'),0) total_products,
          coalesce((select count(*) from public.customers where organization_id=:org and status='active'),0) total_customers,
          coalesce((select sum(amount) from public.payments where organization_id=:org and paid_at>=current_date
            and (cast(:branch as uuid) is null or branch_id=:branch)),0) collection_today
    """), {"org": context.organization_id, "branch": context.branch_id})
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
    context: OrganizationContext = Depends(get_organization_context),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, object]:
    daily = await session.execute(text("""
      select sold_at::date as date,count(*) as transactions,sum(grand_total) as sales,
             sum(profit_total) as profit,sum(due_total) as due
      from public.sales where organization_id=:org and status='completed'
        and sold_at>=current_date-(:days-1)*interval '1 day'
        and (cast(:branch as uuid) is null or branch_id=:branch)
      group by sold_at::date order by date
    """), {"org": context.organization_id, "branch": context.branch_id, "days": days})
    payment = await session.execute(text("""
      select method,sum(amount) as amount,count(*) as transactions from public.payments
      where organization_id=:org and paid_at>=current_date-(:days-1)*interval '1 day'
        and (cast(:branch as uuid) is null or branch_id=:branch) group by method order by amount desc
    """), {"org": context.organization_id, "branch": context.branch_id, "days": days})
    best = await session.execute(text("""
      select si.description,sum(si.quantity) as quantity,sum(si.line_total) as sales
      from public.sale_items si join public.sales s on s.id=si.sale_id
      where si.organization_id=:org and s.status='completed'
        and s.sold_at>=current_date-(:days-1)*interval '1 day'
        and (cast(:branch as uuid) is null or si.branch_id=:branch)
      group by si.description order by quantity desc limit 10
    """), {"org": context.organization_id, "branch": context.branch_id, "days": days})
    return {"daily": [dict(r) for r in daily.mappings().all()],
            "payment_methods": [dict(r) for r in payment.mappings().all()],
            "best_sellers": [dict(r) for r in best.mappings().all()]}


@router.get("/inventory")
async def inventory_report(
    context: OrganizationContext = Depends(get_organization_context),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, object]:
    rows = await session.execute(text("""
      select p.name,p.name_bn,pv.sku,coalesce(sum(ib.quantity),0) quantity,
             coalesce(sum(ib.quantity*ib.avg_cost),0) stock_value,pv.reorder_level,
             bool_or(ib.quantity<=pv.reorder_level) as low_stock
      from public.products p join public.product_variants pv on pv.product_id=p.id
      left join public.inventory_balances ib on ib.product_variant_id=pv.id
        and (cast(:branch as uuid) is null or ib.branch_id=:branch)
      where p.organization_id=:org and p.status='active'
      group by p.name,p.name_bn,pv.sku,pv.reorder_level order by stock_value desc
    """), {"org": context.organization_id, "branch": context.branch_id})
    items = [dict(r) for r in rows.mappings().all()]
    return {"items": items, "inventory_value": sum(float(r["stock_value"] or 0) for r in items),
            "low_stock_count": sum(1 for r in items if r["low_stock"])}


@router.get("/due")
async def due_report(
    context: OrganizationContext = Depends(get_organization_context),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, object]:
    rows = await session.execute(text("""
      select c.id,c.name,c.phone,c.credit_limit,sum(l.debit-l.credit) balance,
             max(l.created_at) last_activity
      from public.customers c join public.customer_ledger_entries l on l.customer_id=c.id
      where c.organization_id=:org and (cast(:branch as uuid) is null or l.branch_id=:branch)
      group by c.id,c.name,c.phone,c.credit_limit having sum(l.debit-l.credit)>0
      order by balance desc
    """), {"org": context.organization_id, "branch": context.branch_id})
    customers = [dict(r) for r in rows.mappings().all()]
    return {"customers": customers, "receivable_due": sum(float(r["balance"]) for r in customers)}


@router.get("/profit")
async def profit_report(
    days: int = Query(default=30, ge=1, le=366),
    context: OrganizationContext = Depends(get_organization_context),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, object]:
    result = await session.execute(text("""
      select coalesce(sum(subtotal-discount_total),0) net_sales,
             coalesce(sum(profit_total),0) gross_profit,
             coalesce(sum(vat_total),0) tax_total,
             case when sum(subtotal-discount_total)>0 then
               round(sum(profit_total)/sum(subtotal-discount_total)*100,2) else 0 end profit_margin
      from public.sales where organization_id=:org and status='completed'
        and sold_at>=current_date-(:days-1)*interval '1 day'
        and (cast(:branch as uuid) is null or branch_id=:branch)
    """), {"org": context.organization_id, "branch": context.branch_id, "days": days})
    return dict(result.mappings().one())
