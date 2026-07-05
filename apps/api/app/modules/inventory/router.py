from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import require_permission
from app.core.security import CurrentUser, get_current_user
from app.core.tenant import OrganizationContext, get_organization_context, resolve_branch_id
from app.db.session import get_db_session
from app.schemas import InventoryAdjustmentCreate

router = APIRouter(prefix="/inventory", tags=["inventory"])
inventory_manager = require_permission("inventory.adjust")


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
              and (cast(:branch_id as uuid) is null or ib.branch_id = :branch_id)
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
    async with session.begin():
        branch_id = await resolve_branch_id(context, session, payload.branch_id)
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
        else:
            warehouse_id = (
                await session.execute(
                    text(
                        """
                        select id from public.warehouses
                        where id=:warehouse_id and organization_id=:organization_id
                          and branch_id=:branch_id and is_active
                        """
                    ),
                    {
                        "warehouse_id": warehouse_id,
                        "organization_id": context.organization_id,
                        "branch_id": branch_id,
                    },
                )
            ).scalar_one_or_none()
            if warehouse_id is None:
                raise HTTPException(status_code=404, detail="Warehouse not found")
        variant_exists = (
            await session.execute(
                text(
                    """
                    select 1 from public.product_variants
                    where id=:variant_id and organization_id=:organization_id
                      and status='active'
                    """
                ),
                {
                    "variant_id": payload.product_variant_id,
                    "organization_id": context.organization_id,
                },
            )
        ).scalar_one_or_none()
        if variant_exists is None:
            raise HTTPException(status_code=404, detail="Product variant not found")

        if payload.quantity_change < 0:
            settings = (
                await session.execute(
                    text("select settings from public.organizations where id=:id"),
                    {"id": context.organization_id},
                )
            ).scalar_one()
            allow_negative_stock = (
                isinstance(settings, dict) and settings.get("allow_negative_stock") is True
            )
            if not allow_negative_stock:
                await session.execute(
                    text(
                        """
                        select pg_advisory_xact_lock(hashtextextended(
                          cast(:organization_id as text) || ':' ||
                          cast(:branch_id as text) || ':' || cast(:variant_id as text), 0
                        ))
                        """
                    ),
                    {
                        "organization_id": context.organization_id,
                        "branch_id": branch_id,
                        "variant_id": payload.product_variant_id,
                    },
                )
                current_quantity = (
                    await session.execute(
                        text(
                            """
                            select quantity from public.inventory_balances
                            where organization_id=:organization_id
                              and branch_id=:branch_id
                              and warehouse_id is not distinct from cast(:warehouse_id as uuid)
                              and product_variant_id=:variant_id
                            for update
                            """
                        ),
                        {
                            "organization_id": context.organization_id,
                            "branch_id": branch_id,
                            "warehouse_id": warehouse_id,
                            "variant_id": payload.product_variant_id,
                        },
                    )
                ).scalar_one_or_none()
                if Decimal(current_quantity or 0) + payload.quantity_change < 0:
                    raise HTTPException(
                        status_code=422,
                        detail="Insufficient stock; negative inventory is disabled",
                    )
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
