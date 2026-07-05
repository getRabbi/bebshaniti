# ruff: noqa: E501
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import require_roles
from app.core.tenant import OrganizationContext, get_organization_context
from app.db.session import get_db_session
from app.schemas import ProductMasterImport

router = APIRouter(prefix="/product-master", tags=["product-master"])
master_admin = require_roles("owner", "admin")


@router.get("/categories")
async def list_categories(
    _: OrganizationContext = Depends(get_organization_context),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict[str, object]]:
    result = await session.execute(text("""
        select id, bn_name, en_name, slug
        from public.product_master_categories where is_active
        order by sort_order, bn_name
    """))
    return [dict(row) for row in result.mappings().all()]


@router.get("/subcategories")
async def list_subcategories(
    category_id: str | None = Query(default=None),
    _: OrganizationContext = Depends(get_organization_context),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict[str, object]]:
    result = await session.execute(text("""
        select id, category_id, bn_name, en_name, slug
        from public.product_master_subcategories
        where is_active and (:category_id is null or category_id = cast(:category_id as uuid))
        order by bn_name
    """), {"category_id": category_id})
    return [dict(row) for row in result.mappings().all()]


@router.get("/search")
async def search_master(
    q: str = Query(min_length=1, max_length=100),
    limit: int = Query(default=12, ge=1, le=30),
    context: OrganizationContext = Depends(get_organization_context),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict[str, object]]:
    query = q.strip().lower()
    result = await session.execute(text("""
        with master as (
          select i.id, i.bn_name, i.en_name, i.brand_name, i.common_unit,
                 i.common_pack_size, i.barcode, i.category_id,
                 c.bn_name as category_bn_name, c.en_name as category_en_name,
                 'master'::text as source,
                 greatest(
                   extensions.similarity(lower(i.bn_name), :q),
                   extensions.similarity(lower(i.en_name), :q),
                   extensions.similarity(lower(coalesce(i.brand_name, '')), :q),
                   coalesce((select max(extensions.similarity(a.normalized_alias, :q))
                     from public.product_master_aliases a where a.item_id=i.id), 0)
                 ) + case when lower(i.bn_name) like :prefix or lower(i.en_name) like :prefix then 2 else 0 end
                   + i.popularity_score / 1000.0 as score
          from public.product_master_items i
          join public.product_master_categories c on c.id=i.category_id
          where i.is_active and (
            extensions.similarity(lower(i.bn_name), :q) > 0.15
            or extensions.similarity(lower(i.en_name), :q) > 0.15
            or extensions.similarity(lower(coalesce(i.brand_name,'')), :q) > 0.15
            or lower(i.bn_name) like :contains or lower(i.en_name) like :contains
            or exists (select 1 from unnest(i.aliases || i.keywords_bn || i.keywords_en) term
              where lower(term) like :contains
                or extensions.similarity(lower(term), :q) > 0.15)
          )
        ), local_items as (
          select p.id, coalesce(p.name_bn,p.name) as bn_name, p.name as en_name,
                 b.name as brand_name, u.symbol as common_unit,
                 v.pack_size as common_pack_size, v.barcode, null::uuid as category_id,
                 c.name_bn as category_bn_name, c.name as category_en_name,
                 'local'::text as source,
                 greatest(extensions.similarity(lower(p.name), :q),
                          extensions.similarity(lower(coalesce(p.name_bn,'')), :q))
                   + case when lower(p.name) like :prefix or lower(coalesce(p.name_bn,'')) like :prefix then 2 else 0 end as score
          from public.products p
          join public.product_variants v on v.product_id=p.id and v.organization_id=p.organization_id
          left join public.categories c on c.id=p.category_id
          left join public.brands b on b.id=p.brand_id
          left join public.units u on u.id=p.base_unit_id
          where p.organization_id=:organization_id and p.status='active'
            and (lower(p.name) like :contains or lower(coalesce(p.name_bn,'')) like :contains
                 or extensions.similarity(lower(p.name), :q) > 0.15
                 or extensions.similarity(lower(coalesce(p.name_bn,'')), :q) > 0.15)
        )
        select * from (select * from master union all select * from local_items) suggestions
        order by score desc, bn_name limit :limit
    """), {
        "q": query, "prefix": f"{query}%", "contains": f"%{query}%",
        "organization_id": context.organization_id, "limit": limit,
    })
    return [dict(row) for row in result.mappings().all()]


@router.post("/import", status_code=status.HTTP_201_CREATED)
async def import_master(
    payload: ProductMasterImport,
    _: OrganizationContext = Depends(master_admin),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, int]:
    imported = 0
    async with session.begin():
        for item in payload.items:
            category_id = (await session.execute(text("""
                select id from public.product_master_categories
                where slug=:slug and is_active
            """), {"slug": item.category_slug})).scalar_one_or_none()
            if category_id is None:
                raise HTTPException(status_code=422, detail=f"Unknown category: {item.category_slug}")
            result = await session.execute(text("""
                insert into public.product_master_items
                  (category_id,bn_name,en_name,brand_name,common_unit,common_pack_size,aliases,barcode)
                values (:category_id,:bn_name,:en_name,:brand_name,:common_unit,:pack_size,:aliases,:barcode)
                on conflict (category_id,bn_name,en_name) do update set
                  brand_name=excluded.brand_name, common_unit=excluded.common_unit,
                  common_pack_size=excluded.common_pack_size, aliases=excluded.aliases,
                  barcode=coalesce(excluded.barcode,public.product_master_items.barcode), updated_at=now()
                returning id
            """), {
                "category_id": category_id, "bn_name": item.bn_name, "en_name": item.en_name,
                "brand_name": item.brand_name, "common_unit": item.common_unit,
                "pack_size": item.common_pack_size, "aliases": item.aliases, "barcode": item.barcode,
            })
            master_id = result.scalar_one()
            for alias in item.aliases:
                await session.execute(text("""
                    insert into public.product_master_aliases(item_id,alias,locale)
                    values (:id,:alias,case when :alias ~ '[ঀ-৿]' then 'bn-BD' else 'en' end)
                    on conflict do nothing
                """), {"id": master_id, "alias": alias})
            imported += 1
    return {"imported": imported}
