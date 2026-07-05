from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import require_roles
from app.core.tenant import OrganizationContext, get_organization_context
from app.db.session import get_db_session
from app.schemas import ProductCreate

router = APIRouter(prefix="/products", tags=["products"])
catalog_manager = require_roles("owner", "admin", "branch_manager", "inventory_manager")


@router.get("")
async def list_products(
    search: str | None = Query(default=None, max_length=100),
    limit: int = Query(default=100, ge=1, le=500),
    context: OrganizationContext = Depends(get_organization_context),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict[str, object]]:
    result = await session.execute(
        text(
            """
            select p.id, p.name, p.name_bn, p.track_stock, p.status,
                   c.name as category_name, b.name as brand_name,
                   v.id as variant_id, v.variant_name, v.sku, v.barcode,
                   v.purchase_price, v.retail_price, v.wholesale_price,
                   v.reorder_level, u.symbol as unit_symbol
            from public.products p
            join public.product_variants v on v.product_id = p.id
              and v.organization_id = p.organization_id
            left join public.categories c on c.id = p.category_id
            left join public.brands b on b.id = p.brand_id
            left join public.units u on u.id = p.base_unit_id
            where p.organization_id = :organization_id
              and p.status <> 'archived' and v.status <> 'archived'
              and (:search is null or p.name ilike '%' || :search || '%'
                or v.sku ilike '%' || :search || '%'
                or v.barcode ilike '%' || :search || '%')
            order by p.name, v.variant_name limit :limit
            """
        ),
        {"organization_id": context.organization_id, "search": search, "limit": limit},
    )
    return [dict(row) for row in result.mappings().all()]


@router.get("/metadata")
async def catalog_metadata(
    context: OrganizationContext = Depends(get_organization_context),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, list[dict[str, object]]]:
    categories = await session.execute(
        text(
            """
            select id, name, name_bn from public.categories
            where organization_id = :id and is_active
            order by sort_order, name
            """
        ),
        {"id": context.organization_id},
    )
    brands = await session.execute(
        text(
            """
            select id, name from public.brands
            where organization_id = :id and is_active order by name
            """
        ),
        {"id": context.organization_id},
    )
    units = await session.execute(
        text(
            """
            select id, name, symbol, precision from public.units
            where organization_id = :id and is_active order by name
            """
        ),
        {"id": context.organization_id},
    )
    return {
        "categories": [dict(row) for row in categories.mappings().all()],
        "brands": [dict(row) for row in brands.mappings().all()],
        "units": [dict(row) for row in units.mappings().all()],
    }


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_product(
    payload: ProductCreate,
    context: OrganizationContext = Depends(catalog_manager),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, object]:
    try:
        async with session.begin():
            base_unit_id = payload.base_unit_id
            if base_unit_id is None:
                base_unit_id = (
                    await session.execute(
                        text(
                            """
                            select id from public.units
                            where organization_id = :id and is_active
                            order by created_at limit 1
                            """
                        ),
                        {"id": context.organization_id},
                    )
                ).scalar_one_or_none()
            if base_unit_id is None:
                raise HTTPException(status_code=409, detail="Create a unit before adding products")
            product = (
                (
                    await session.execute(
                        text(
                            """
                        insert into public.products
                          (organization_id, category_id, brand_id, base_unit_id,
                           name, name_bn, track_stock, created_by)
                        values (:organization_id, :category_id, :brand_id, :base_unit_id,
                                :name, :name_bn, :track_stock, null)
                        returning id, name, name_bn, track_stock, status
                        """
                        ),
                        {
                            "organization_id": context.organization_id,
                            "category_id": payload.category_id,
                            "brand_id": payload.brand_id,
                            "base_unit_id": base_unit_id,
                            "name": payload.name,
                            "name_bn": payload.name_bn,
                            "track_stock": payload.track_stock,
                        },
                    )
                )
                .mappings()
                .one()
            )
            variant = (
                (
                    await session.execute(
                        text(
                            """
                        insert into public.product_variants
                          (organization_id, product_id, sku, barcode, purchase_price,
                           retail_price, wholesale_price, reorder_level)
                        values (:organization_id, :product_id, :sku, :barcode, :purchase_price,
                                :retail_price, :wholesale_price, :reorder_level)
                        returning id, variant_name, sku, barcode, purchase_price,
                                  retail_price, wholesale_price, reorder_level, status
                        """
                        ),
                        {
                            "organization_id": context.organization_id,
                            "product_id": product["id"],
                            "sku": payload.sku,
                            "barcode": payload.barcode,
                            "purchase_price": payload.purchase_price,
                            "retail_price": payload.retail_price,
                            "wholesale_price": payload.wholesale_price,
                            "reorder_level": payload.reorder_level,
                        },
                    )
                )
                .mappings()
                .one()
            )
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(status_code=409, detail="SKU or barcode already exists") from exc
    return {**dict(product), "variant": dict(variant)}
