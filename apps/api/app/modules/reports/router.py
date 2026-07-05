from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.tenant import OrganizationContext, get_organization_context
from app.db.session import get_db_session

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("")
@router.get("/dashboard")
async def report_dashboard(
    context: OrganizationContext = Depends(get_organization_context),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, object]:
    result = await session.execute(
        text(
            """
            select
              coalesce((select sum(grand_total) from public.sales
                where organization_id = :organization_id and status = 'completed'
                  and sold_at >= current_date
                  and (:branch_id is null or branch_id = :branch_id)), 0) as sales_today,
              coalesce((select count(*) from public.sales
                where organization_id = :organization_id and status = 'completed'
                  and sold_at >= current_date
                  and (:branch_id is null or branch_id = :branch_id)), 0) as transactions_today,
              coalesce((select sum(debit - credit) from public.customer_ledger_entries
                where organization_id = :organization_id
                  and (:branch_id is null or branch_id = :branch_id)), 0) as receivable_due,
              coalesce((select count(*) from public.inventory_balances ib
                join public.product_variants pv on pv.id = ib.product_variant_id
                where ib.organization_id = :organization_id
                  and ib.quantity <= pv.reorder_level
                  and (:branch_id is null or ib.branch_id = :branch_id)), 0) as low_stock_items,
              coalesce((select sum(quantity * avg_cost) from public.inventory_balances
                where organization_id = :organization_id
                  and (:branch_id is null or branch_id = :branch_id)), 0) as inventory_value
            """
        ),
        {"organization_id": context.organization_id, "branch_id": context.branch_id},
    )
    return dict(result.mappings().one())
