from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import require_roles
from app.core.security import CurrentUser, get_current_user
from app.core.tenant import OrganizationContext, get_organization_context
from app.db.session import get_db_session
from app.schemas import InventoryAdjustmentCreate

router = APIRouter(prefix="/inventory", tags=["inventory"])
inventory_manager = require_roles("owner", "admin", "branch_manager", "inventory_manager")


@router.get("")
@router.get("/balances")
async def inventory_balances(
    low_stock: bool = Query(default=False),
    context: OrganizationContext = Depends(get_organization_context),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict[str, object]]:
    result = await session.execute(
        text(
            """
            select ib.id, ib.branch_id, br.name as branch_name, ib.warehouse_id,
                   w.name as warehouse_name, p.id as product_id, p.name as product_name,
                   pv.id as variant_id, pv.variant_name, pv.sku, pv.barcode,
                   ib.quantity, ib.avg_cost, pv.reorder_level,
                   round(ib.quantity * ib.avg_cost, 4) as stock_value,
                   ib.updated_at
            from public.inventory_balances ib
            join public.branches br on br.id = ib.branch_id
            join public.product_variants pv on pv.id = ib.product_variant_id
            join public.products p on p.id = pv.product_id
            left join public.warehouses w on w.id = ib.warehouse_id
            where ib.organization_id = :organization_id
              and (:branch_id is null or ib.branch_id = :branch_id)
              and (not :low_stock or ib.quantity <= pv.reorder_level)
            order by p.name, pv.variant_name, br.name
            """
        ),
        {
            "organization_id": context.organization_id,
            "branch_id": context.branch_id,
            "low_stock": low_stock,
        },
    )
    return [dict(row) for row in result.mappings().all()]


@router.post("/adjustments", status_code=status.HTTP_201_CREATED)
async def create_adjustment(
    payload: InventoryAdjustmentCreate,
    context: OrganizationContext = Depends(inventory_manager),
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, object]:
    if payload.quantity_change == 0:
        raise HTTPException(status_code=422, detail="Quantity change cannot be zero")
    branch_id = payload.branch_id or context.branch_id
    async with session.begin():
        if branch_id is None:
            branch_id = (
                await session.execute(
                    text("select id from public.branches where organization_id = :id and is_main"),
                    {"id": context.organization_id},
                )
            ).scalar_one_or_none()
        if branch_id is None:
            raise HTTPException(status_code=409, detail="An active branch is required")
        warehouse_id = payload.warehouse_id
        if warehouse_id is None:
            warehouse_id = (
                await session.execute(
                    text(
                        """
                        select id from public.warehouses
                        where organization_id = :organization_id and branch_id = :branch_id
                          and is_active order by created_at limit 1
                        """
                    ),
                    {"organization_id": context.organization_id, "branch_id": branch_id},
                )
            ).scalar_one_or_none()
        result = await session.execute(
            text(
                """
                insert into public.stock_movements
                  (organization_id, branch_id, warehouse_id, product_variant_id,
                   movement_type, quantity_change, unit_cost, reference_type, note, created_by)
                values (:organization_id, :branch_id, :warehouse_id, :product_variant_id,
                        'adjustment', :quantity_change, :unit_cost,
                        'manual_adjustment', :note, :created_by)
                returning id, branch_id, warehouse_id, product_variant_id,
                          quantity_change, unit_cost, created_at
                """
            ),
            {
                "organization_id": context.organization_id,
                "branch_id": branch_id,
                "warehouse_id": warehouse_id,
                "product_variant_id": payload.product_variant_id,
                "quantity_change": payload.quantity_change,
                "unit_cost": payload.unit_cost,
                "note": payload.note,
                "created_by": user.id,
            },
        )
    return dict(result.mappings().one())
