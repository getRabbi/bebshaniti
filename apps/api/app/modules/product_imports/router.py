# ruff: noqa: E501
import json
from decimal import Decimal
from typing import Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import require_permission
from app.core.security import CurrentUser, get_current_user
from app.core.tenant import OrganizationContext
from app.db.session import get_db_session
from app.modules.products.import_service import (
    ImportFileError,
    parse_product_file,
    serializable_rows,
)

router = APIRouter(prefix="/products/import", tags=["product-imports"])
import_manager = require_permission("products.import")


async def _read_upload(file: UploadFile) -> bytes:
    content = await file.read(5 * 1024 * 1024 + 1)
    await file.close()
    return content


async def _duplicate_maps(
    session: AsyncSession, organization_id: object
) -> tuple[
    dict[str, dict[str, object]], dict[str, dict[str, object]], dict[str, dict[str, object]]
]:
    result = await session.execute(
        text(
            """
            select p.id as product_id,p.name,v.id as variant_id,v.sku,v.barcode
            from public.products p join public.product_variants v on v.product_id=p.id
            where p.organization_id=:org and p.status <> 'archived' and v.status <> 'archived'
            """
        ),
        {"org": organization_id},
    )
    rows = [dict(row) for row in result.mappings().all()]
    by_name = {str(row["name"]).strip().lower(): row for row in rows}
    by_sku = {str(row["sku"]).strip().lower(): row for row in rows if row.get("sku")}
    by_barcode = {str(row["barcode"]).strip().lower(): row for row in rows if row.get("barcode")}
    return by_name, by_sku, by_barcode


def _find_duplicate(
    row: dict[str, object],
    maps: tuple[
        dict[str, dict[str, object]], dict[str, dict[str, object]], dict[str, dict[str, object]]
    ],
) -> tuple[dict[str, object] | None, str | None]:
    by_name, by_sku, by_barcode = maps
    name = str(row["product_name"]).lower()
    sku = str(row.get("sku") or "").lower()
    barcode = str(row.get("barcode") or "").lower()
    if barcode and barcode in by_barcode:
        return by_barcode[barcode], "barcode"
    if sku and sku in by_sku:
        return by_sku[sku], "sku"
    if name in by_name:
        return by_name[name], "name"
    return None, None


async def _lookup_or_create(
    session: AsyncSession,
    table: Literal["categories", "units", "brands", "suppliers"],
    organization_id: object,
    value: str | None,
    branch_id: object | None,
    user_id: object,
) -> UUID | None:
    if not value:
        return None
    column = "symbol" if table == "units" else "name"
    existing = (
        await session.execute(
            text(
                f"select id from public.{table} where organization_id=:org "
                f"and lower({column})=lower(:value) limit 1"
            ),
            {"org": organization_id, "value": value},
        )
    ).scalar_one_or_none()
    if existing:
        return UUID(str(existing))
    if table == "categories":
        query = "insert into public.categories(organization_id,name,name_bn) values (:org,:value,:value) returning id"
    elif table == "units":
        query = "insert into public.units(organization_id,name,symbol,precision) values (:org,:value,:value,3) returning id"
    elif table == "brands":
        query = "insert into public.brands(organization_id,name) values (:org,:value) returning id"
    else:
        query = "insert into public.suppliers(organization_id,branch_id,name,created_by) values (:org,:branch,:value,:user) returning id"
    created = (
        await session.execute(
            text(query),
            {
                "org": organization_id,
                "branch": branch_id,
                "value": value,
                "user": user_id,
            },
        )
    ).scalar_one()
    return UUID(str(created))


async def _set_opening_stock(
    session: AsyncSession,
    organization_id: object,
    branch_id: object,
    variant_id: object,
    target: Decimal,
    unit_cost: Decimal,
    user_id: object,
) -> None:
    current = (
        await session.execute(
            text(
                """
                select coalesce(sum(quantity),0) from public.inventory_balances
                where organization_id=:org and branch_id=:branch and product_variant_id=:variant
                """
            ),
            {"org": organization_id, "branch": branch_id, "variant": variant_id},
        )
    ).scalar_one()
    difference = target - Decimal(current)
    if difference == 0:
        return
    await session.execute(
        text(
            """
            insert into public.stock_movements
              (organization_id,branch_id,product_variant_id,movement_type,quantity_change,
               unit_cost,reference_type,note,created_by)
            values (:org,:branch,:variant,'adjustment',:quantity,:cost,'product_import',
                    'Product import opening stock',:user)
            """
        ),
        {
            "org": organization_id,
            "branch": branch_id,
            "variant": variant_id,
            "quantity": difference,
            "cost": unit_cost,
            "user": user_id,
        },
    )


@router.post("/preview")
async def preview_import(
    file: UploadFile = File(...),
    context: OrganizationContext = Depends(import_manager),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, object]:
    try:
        rows = parse_product_file(file.filename or "products.csv", await _read_upload(file))
    except ImportFileError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    maps = await _duplicate_maps(session, context.organization_id)
    for row in rows:
        duplicate, duplicate_by = _find_duplicate(row, maps)
        row["duplicate_by"] = duplicate_by
        row["duplicate_product_id"] = duplicate["product_id"] if duplicate else None
    valid = sum(1 for row in rows if not row["errors"])
    duplicates = sum(1 for row in rows if row["duplicate_product_id"])
    return {
        "file_name": file.filename,
        "total_rows": len(rows),
        "valid_rows": valid,
        "invalid_rows": len(rows) - valid,
        "duplicate_rows": duplicates,
        "rows": serializable_rows(rows),
    }


@router.post("/commit", status_code=status.HTTP_201_CREATED)
async def commit_import(
    file: UploadFile = File(...),
    mode: Literal["create", "skip", "update"] = Form("skip"),
    context: OrganizationContext = Depends(import_manager),
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, object]:
    file_name = file.filename or "products.csv"
    try:
        rows = parse_product_file(file_name, await _read_upload(file))
    except ImportFileError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    created = updated = skipped = failed = 0
    row_errors: list[dict[str, object]] = []
    async with session.begin():
        branch_id = (
            context.branch_id
            or (
                await session.execute(
                    text("select id from public.branches where organization_id=:org and is_main"),
                    {"org": context.organization_id},
                )
            ).scalar_one_or_none()
        )
        if branch_id is None:
            raise HTTPException(status_code=409, detail="An active branch is required")
        maps = await _duplicate_maps(session, context.organization_id)
        for row in rows:
            if row["errors"]:
                failed += 1
                row_errors.append({"row_number": row["row_number"], "errors": row["errors"]})
                continue
            duplicate, duplicate_by = _find_duplicate(row, maps)
            if duplicate and mode == "skip":
                skipped += 1
                continue
            if duplicate and mode == "create":
                failed += 1
                row_errors.append(
                    {
                        "row_number": row["row_number"],
                        "errors": [f"duplicate {duplicate_by}"],
                    }
                )
                continue
            operation: Literal["created", "updated"]
            created_record: dict[str, object] | None = None
            try:
                async with session.begin_nested():
                    category_id = await _lookup_or_create(
                        session,
                        "categories",
                        context.organization_id,
                        str(row["category"]),
                        branch_id,
                        user.id,
                    )
                    unit_id = await _lookup_or_create(
                        session,
                        "units",
                        context.organization_id,
                        str(row["unit"]),
                        branch_id,
                        user.id,
                    )
                    brand_id = await _lookup_or_create(
                        session,
                        "brands",
                        context.organization_id,
                        row.get("brand"),
                        branch_id,
                        user.id,
                    )
                    supplier_id = await _lookup_or_create(
                        session,
                        "suppliers",
                        context.organization_id,
                        row.get("supplier"),
                        branch_id,
                        user.id,
                    )
                    if duplicate:
                        await session.execute(
                            text(
                                """
                                update public.products set name=:name,name_bn=:name,category_id=:category,
                                  base_unit_id=:unit,brand_id=:brand,supplier_id=:supplier,rack_location=:rack
                                where id=:product and organization_id=:org
                                """
                            ),
                            {
                                "name": row["product_name"],
                                "category": category_id,
                                "unit": unit_id,
                                "brand": brand_id,
                                "supplier": supplier_id,
                                "rack": row.get("rack"),
                                "product": duplicate["product_id"],
                                "org": context.organization_id,
                            },
                        )
                        await session.execute(
                            text(
                                """
                                update public.product_variants set sku=coalesce(:sku,sku),
                                  barcode=coalesce(:barcode,barcode),purchase_price=:buying,
                                  retail_price=:selling,wholesale_price=:wholesale,mrp=:mrp,
                                  reorder_level=:reorder,expiry_date=:expiry
                                where id=:variant and organization_id=:org
                                """
                            ),
                            {
                                "sku": row.get("sku"),
                                "barcode": row.get("barcode"),
                                "buying": row["buying_price"],
                                "selling": row["selling_price"],
                                "wholesale": row["wholesale_price"],
                                "mrp": row["mrp"],
                                "reorder": row["low_stock_alert"],
                                "expiry": row["expiry_date"],
                                "variant": duplicate["variant_id"],
                                "org": context.organization_id,
                            },
                        )
                        variant_id = duplicate["variant_id"]
                        operation = "updated"
                    else:
                        product_id = (
                            await session.execute(
                                text(
                                    """
                                    insert into public.products
                                      (organization_id,category_id,brand_id,base_unit_id,supplier_id,
                                       name,name_bn,rack_location,created_by)
                                    values (:org,:category,:brand,:unit,:supplier,:name,:name,:rack,:user)
                                    returning id
                                    """
                                ),
                                {
                                    "org": context.organization_id,
                                    "category": category_id,
                                    "brand": brand_id,
                                    "unit": unit_id,
                                    "supplier": supplier_id,
                                    "name": row["product_name"],
                                    "rack": row.get("rack"),
                                    "user": user.id,
                                },
                            )
                        ).scalar_one()
                        sku = row.get("sku") or f"IMP-{uuid4().hex[:10].upper()}"
                        variant_id = (
                            await session.execute(
                                text(
                                    """
                                    insert into public.product_variants
                                      (organization_id,product_id,sku,barcode,purchase_price,retail_price,
                                       wholesale_price,mrp,reorder_level,expiry_date)
                                    values (:org,:product,:sku,:barcode,:buying,:selling,:wholesale,:mrp,:reorder,:expiry)
                                    returning id
                                    """
                                ),
                                {
                                    "org": context.organization_id,
                                    "product": product_id,
                                    "sku": sku,
                                    "barcode": row.get("barcode"),
                                    "buying": row["buying_price"],
                                    "selling": row["selling_price"],
                                    "wholesale": row["wholesale_price"],
                                    "mrp": row["mrp"],
                                    "reorder": row["low_stock_alert"],
                                    "expiry": row["expiry_date"],
                                },
                            )
                        ).scalar_one()
                        created_record = {
                            "product_id": product_id,
                            "variant_id": variant_id,
                            "name": row["product_name"],
                            "sku": sku,
                            "barcode": row.get("barcode"),
                        }
                        operation = "created"
                    await _set_opening_stock(
                        session,
                        context.organization_id,
                        branch_id,
                        variant_id,
                        row["opening_stock"],
                        row["buying_price"],
                        user.id,
                    )
            except SQLAlchemyError:
                failed += 1
                row_errors.append(
                    {"row_number": row["row_number"], "errors": ["database validation failed"]}
                )
                continue
            if operation == "updated":
                updated += 1
            else:
                created += 1
                assert created_record is not None
                maps[0][str(row["product_name"]).lower()] = created_record
                maps[1][str(created_record["sku"]).lower()] = created_record
                if row.get("barcode"):
                    maps[2][str(row["barcode"]).lower()] = created_record
        import_id = (
            await session.execute(
                text(
                    """
                    insert into public.product_imports
                      (organization_id,branch_id,file_name,import_mode,total_rows,created_rows,
                       updated_rows,skipped_rows,failed_rows,error_summary,created_by)
                    values (:org,:branch,:file,:mode,:total,:created,:updated,:skipped,:failed,
                            cast(:errors as jsonb),:user) returning id
                    """
                ),
                {
                    "org": context.organization_id,
                    "branch": branch_id,
                    "file": file_name,
                    "mode": mode,
                    "total": len(rows),
                    "created": created,
                    "updated": updated,
                    "skipped": skipped,
                    "failed": failed,
                    "errors": json.dumps(row_errors[:200]),
                    "user": user.id,
                },
            )
        ).scalar_one()
    return {
        "id": import_id,
        "total_rows": len(rows),
        "created_rows": created,
        "updated_rows": updated,
        "skipped_rows": skipped,
        "failed_rows": failed,
        "errors": row_errors,
    }


@router.get("/sample.csv")
async def sample_csv(
    _: OrganizationContext = Depends(import_manager),
) -> Response:
    content = (
        "\ufeffproduct_name,category,unit,buying_price,selling_price,sku,barcode,brand,"
        "opening_stock,low_stock_alert,wholesale_price,mrp,supplier,rack,expiry_date\n"
        "Sample Product,General,pcs,80,100,SKU-001,,Sample Brand,10,2,90,110,Sample Supplier,A-1,2027-12-31\n"
    )
    return Response(
        content=content.encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="product-import-sample.csv"'},
    )
