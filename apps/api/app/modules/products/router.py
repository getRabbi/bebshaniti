# ruff: noqa: E501
import asyncio
import logging
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import require_permission
from app.core.security import CurrentUser, get_current_user
from app.core.supabase import get_supabase_admin
from app.core.tenant import OrganizationContext, get_organization_context
from app.db.session import get_db_session
from app.schemas import ProductCreate, ProductImageUpdate

router = APIRouter(prefix="/products", tags=["products"])
product_creator = require_permission("products.create")
product_updater = require_permission("products.update")
logger = logging.getLogger(__name__)


def validate_image_path(organization_id: UUID, image_path: str | None) -> None:
    if image_path is None:
        return
    prefix = f"{organization_id}/products/"
    if (
        not image_path.startswith(prefix)
        or ".." in image_path
        or image_path.lower().split(".")[-1]
        not in {
            "jpg",
            "jpeg",
            "png",
            "webp",
        }
    ):
        raise HTTPException(status_code=422, detail="Invalid product image path")


async def signed_image_url(path: str | None) -> str | None:
    if not path:
        return None

    def create_url() -> str | None:
        try:
            result = (
                get_supabase_admin().storage.from_("product-media").create_signed_url(path, 3600)
            )
            return result.get("signedURL") or result.get("signedUrl")
        except Exception:
            logger.warning("Product image signing failed", exc_info=True)
            return None

    return await asyncio.to_thread(create_url)


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
            select p.id, p.name, p.name_bn, p.image_path, p.track_stock, p.status,
                   c.name as category_name, b.name as brand_name,
                   v.id as variant_id, v.variant_name, v.sku, v.barcode,
                   v.purchase_price, v.retail_price, v.wholesale_price, v.mrp,
                   v.pack_size, v.reorder_level, u.symbol as unit_symbol,
                   p.rack_location, p.discount_allowed,
                   coalesce(ib.quantity, 0) as stock_quantity
            from public.products p
            join public.product_variants v on v.product_id = p.id
              and v.organization_id = p.organization_id
            left join public.categories c on c.id = p.category_id
            left join public.brands b on b.id = p.brand_id
            left join public.units u on u.id = p.base_unit_id
            left join lateral (
              select sum(balance.quantity) as quantity
              from public.inventory_balances balance
              where balance.product_variant_id=v.id
                and balance.organization_id=p.organization_id
                and (cast(:branch_id as uuid) is null or balance.branch_id=:branch_id)
            ) ib on true
            where p.organization_id = :organization_id
              and p.status <> 'archived' and v.status <> 'archived'
              and (cast(:search as text) is null or p.name ilike '%' || :search || '%'
                or v.sku ilike '%' || :search || '%'
                or v.barcode ilike '%' || :search || '%')
            order by p.name, v.variant_name limit :limit
            """
        ),
        {
            "organization_id": context.organization_id,
            "branch_id": context.branch_id,
            "search": search,
            "limit": limit,
        },
    )
    rows = [dict(row) for row in result.mappings().all()]
    urls = await asyncio.gather(*(signed_image_url(row.get("image_path")) for row in rows))
    for row, url in zip(rows, urls, strict=True):
        row["image_url"] = url
    return rows


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
    context: OrganizationContext = Depends(product_creator),
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, object]:
    try:
        async with session.begin():
            validate_image_path(context.organization_id, payload.image_path)
            base_unit_id = payload.base_unit_id
            category_id = payload.category_id
            brand_id = payload.brand_id
            if payload.master_item_id:
                master = (
                    (
                        await session.execute(
                            text("""
                    select i.bn_name,i.en_name,i.brand_name,i.common_unit,c.bn_name as category_bn,c.en_name as category_en
                    from public.product_master_items i
                    join public.product_master_categories c on c.id=i.category_id
                    where i.id=:id and i.is_active
                """),
                            {"id": payload.master_item_id},
                        )
                    )
                    .mappings()
                    .one_or_none()
                )
                if master is None:
                    raise HTTPException(status_code=404, detail="Product master item was not found")
                if category_id is None:
                    category_id = (
                        await session.execute(
                            text("""
                        insert into public.categories(organization_id,name,name_bn)
                        values (:org,:name,:name_bn)
                        on conflict (organization_id,name) do update set name_bn=excluded.name_bn
                        returning id
                    """),
                            {
                                "org": context.organization_id,
                                "name": master["category_en"],
                                "name_bn": master["category_bn"],
                            },
                        )
                    ).scalar_one()
                if brand_id is None and master["brand_name"]:
                    brand_id = (
                        await session.execute(
                            text("""
                        insert into public.brands(organization_id,name) values (:org,:name)
                        on conflict (organization_id,name) do update set is_active=true returning id
                    """),
                            {"org": context.organization_id, "name": master["brand_name"]},
                        )
                    ).scalar_one()
                if base_unit_id is None:
                    base_unit_id = (
                        await session.execute(
                            text("""
                        insert into public.units(organization_id,name,symbol,precision)
                        values (:org,:unit,:unit,case when :unit in ('kg','litre') then 3 else 0 end)
                        on conflict (organization_id,symbol) do update set is_active=true returning id
                    """),
                            {"org": context.organization_id, "unit": master["common_unit"]},
                        )
                    ).scalar_one()
            if brand_id is None and payload.brand_name:
                brand_id = (
                    await session.execute(
                        text("""
                    insert into public.brands(organization_id,name) values (:org,:name)
                    on conflict (organization_id,name) do update set is_active=true returning id
                """),
                        {"org": context.organization_id, "name": payload.brand_name},
                    )
                ).scalar_one()
            supplier_id = payload.supplier_id
            if supplier_id is None and payload.supplier_name:
                supplier_id = (
                    await session.execute(
                        text("""
                    select id from public.suppliers
                    where organization_id=:org and lower(name)=lower(:name) limit 1
                """),
                        {"org": context.organization_id, "name": payload.supplier_name},
                    )
                ).scalar_one_or_none()
                if supplier_id is None:
                    supplier_id = (
                        await session.execute(
                            text("""
                        insert into public.suppliers(organization_id,branch_id,name,created_by)
                        values (:org,:branch,:name,:user) returning id
                    """),
                            {
                                "org": context.organization_id,
                                "branch": context.branch_id,
                                "name": payload.supplier_name,
                                "user": user.id,
                            },
                        )
                    ).scalar_one()
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
                           name, name_bn, description, supplier_id, rack_location, notes,
                           discount_allowed, expiry_tracking, track_stock, vat_rate, image_path, created_by)
                        values (:organization_id, :category_id, :brand_id, :base_unit_id,
                                :name, :name_bn, :description, :supplier_id, :rack_location, :notes,
                                :discount_allowed, :expiry_tracking, :track_stock, :vat_rate, :image_path, :created_by)
                        returning id, name, name_bn, track_stock, status
                        """
                        ),
                        {
                            "organization_id": context.organization_id,
                            "category_id": category_id,
                            "brand_id": brand_id,
                            "base_unit_id": base_unit_id,
                            "name": payload.name,
                            "name_bn": payload.name_bn,
                            "description": payload.description,
                            "supplier_id": supplier_id,
                            "rack_location": payload.rack_location,
                            "notes": payload.notes,
                            "discount_allowed": payload.discount_allowed,
                            "expiry_tracking": payload.expiry_tracking,
                            "track_stock": payload.track_stock,
                            "vat_rate": payload.vat_rate,
                            "image_path": payload.image_path,
                            "created_by": user.id,
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
                          (organization_id, product_id, variant_name, sku, barcode, purchase_price,
                           retail_price, wholesale_price, mrp, pack_size, batch_number,
                           expiry_date, serial_number, reorder_level)
                        values (:organization_id, :product_id, :variant_name, :sku, :barcode, :purchase_price,
                                :retail_price, :wholesale_price, :mrp, :pack_size, :batch_number,
                                :expiry_date, :serial_number, :reorder_level)
                        returning id, variant_name, sku, barcode, purchase_price,
                                  retail_price, wholesale_price, reorder_level, status
                        """
                        ),
                        {
                            "organization_id": context.organization_id,
                            "product_id": product["id"],
                            "variant_name": payload.variant_name,
                            "sku": payload.sku or f"SKU-{uuid4().hex[:10].upper()}",
                            "barcode": payload.barcode,
                            "purchase_price": payload.purchase_price,
                            "retail_price": payload.retail_price,
                            "wholesale_price": payload.wholesale_price,
                            "mrp": payload.mrp,
                            "pack_size": payload.pack_size,
                            "batch_number": payload.batch_number,
                            "expiry_date": payload.expiry_date,
                            "serial_number": payload.serial_number,
                            "reorder_level": payload.reorder_level,
                        },
                    )
                )
                .mappings()
                .one()
            )
            if payload.opening_stock > 0:
                branch_id = payload.branch_id or context.branch_id
                if branch_id is None:
                    branch_id = (
                        await session.execute(
                            text("""
                        select id from public.branches where organization_id=:org and is_main
                    """),
                            {"org": context.organization_id},
                        )
                    ).scalar_one_or_none()
                if branch_id is None:
                    raise HTTPException(
                        status_code=409, detail="An active branch is required for opening stock"
                    )
                await session.execute(
                    text("""
                    insert into public.stock_movements
                      (organization_id,branch_id,product_variant_id,movement_type,quantity_change,
                       unit_cost,reference_type,reference_id,note,created_by)
                    values (:org,:branch,:variant,'opening',:quantity,:cost,'product',:product,
                            'Opening stock',:user)
                """),
                    {
                        "org": context.organization_id,
                        "branch": branch_id,
                        "variant": variant["id"],
                        "quantity": payload.opening_stock,
                        "cost": payload.purchase_price,
                        "product": product["id"],
                        "user": user.id,
                    },
                )
            if payload.master_item_id:
                await session.execute(
                    text("""
                    update public.product_master_items
                    set popularity_score=popularity_score+1 where id=:id
                """),
                    {"id": payload.master_item_id},
                )
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(status_code=409, detail="SKU or barcode already exists") from exc
    return {**dict(product), "variant": dict(variant)}


@router.patch("/{product_id}/image")
async def update_product_image(
    product_id: UUID,
    payload: ProductImageUpdate,
    context: OrganizationContext = Depends(product_updater),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, object]:
    validate_image_path(context.organization_id, payload.image_path)
    async with session.begin():
        row = (
            (
                await session.execute(
                    text(
                        """
                    update public.products set image_path=:path
                    where id=:id and organization_id=:org and status <> 'archived'
                    returning id, image_path, name
                    """
                    ),
                    {"id": product_id, "org": context.organization_id, "path": payload.image_path},
                )
            )
            .mappings()
            .one_or_none()
        )
        if row is None:
            raise HTTPException(status_code=404, detail="Product not found")
    result = dict(row)
    result["image_url"] = await signed_image_url(payload.image_path)
    return result
