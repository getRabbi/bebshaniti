# ruff: noqa: E501
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import text
from sqlalchemy.engine import RowMapping
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import CurrentUser, get_current_user
from app.core.tenant import OrganizationContext, get_organization_context
from app.db.session import get_db_session
from app.schemas import SaleCreate

router = APIRouter(prefix="/sales", tags=["sales"])


@router.get("")
async def list_sales(
    limit: int = Query(default=100, ge=1, le=500),
    context: OrganizationContext = Depends(get_organization_context),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict[str, object]]:
    result = await session.execute(
        text(
            """
            select s.id, s.invoice_no, s.branch_id, b.name as branch_name,
                   s.customer_id, c.name as customer_name, s.sale_type, s.status::text,
                   s.grand_total, s.paid_total, s.due_total, s.profit_total,
                   s.sold_at, s.created_at, p.full_name as cashier_name
            from public.sales s
            join public.branches b on b.id = s.branch_id
            left join public.customers c on c.id = s.customer_id
            join public.profiles p on p.id = s.cashier_id
            where s.organization_id = :organization_id
              and (:branch_id is null or s.branch_id = :branch_id)
            order by coalesce(s.sold_at, s.created_at) desc limit :limit
            """
        ),
        {
            "organization_id": context.organization_id,
            "branch_id": context.branch_id,
            "limit": limit,
        },
    )
    return [dict(row) for row in result.mappings().all()]


@router.get("/{sale_id}")
@router.get("/{sale_id}/memo")
async def sale_detail(
    sale_id: UUID,
    context: OrganizationContext = Depends(get_organization_context),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, object]:
    sale = (await session.execute(text("""
        select s.id,s.invoice_no,s.memo_no,s.sale_type,s.status::text,s.payment_status,
               s.subtotal,s.discount_total,s.vat_total,s.grand_total,s.paid_total,s.due_total,
               s.profit_total,s.sold_at,s.completed_at,s.notes,s.footer_note,
               b.id as branch_id,b.name as branch_name,b.address as branch_address,b.phone as branch_phone,
               o.name as organization_name,o.phone as organization_phone,o.address as organization_address,
               o.receipt_size,o.invoice_footer,c.name as customer_name,c.phone as customer_phone,
               p.full_name as cashier_name
        from public.sales s
        join public.branches b on b.id=s.branch_id
        join public.organizations o on o.id=s.organization_id
        left join public.customers c on c.id=s.customer_id
        join public.profiles p on p.id=s.cashier_id
        where s.id=:id and s.organization_id=:org
          and (:branch is null or s.branch_id=:branch)
    """), {"id": sale_id, "org": context.organization_id,
            "branch": context.branch_id})).mappings().one_or_none()
    if sale is None:
        raise HTTPException(status_code=404, detail="Sale was not found")
    items = await session.execute(text("""
        select si.id,si.description,si.quantity,si.unit_price,si.discount,si.vat_rate,
               si.line_total,pv.sku,pv.barcode,u.symbol as unit_symbol
        from public.sale_items si
        join public.product_variants pv on pv.id=si.product_variant_id
        left join public.units u on u.id=si.unit_id
        where si.sale_id=:id and si.organization_id=:org order by si.created_at
    """), {"id": sale_id, "org": context.organization_id})
    payments = await session.execute(text("""
        select method,amount,reference_no,paid_at from public.payments
        where sale_id=:id and organization_id=:org order by paid_at
    """), {"id": sale_id, "org": context.organization_id})
    return {**dict(sale), "items": [dict(row) for row in items.mappings().all()],
            "payments": [dict(row) for row in payments.mappings().all()]}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_sale(
    payload: SaleCreate,
    context: OrganizationContext = Depends(get_organization_context),
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, object]:
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

        lines: list[tuple[RowMapping, Decimal, Decimal, Decimal, Decimal]] = []
        subtotal = Decimal("0")
        discount_total = Decimal("0")
        vat_total = Decimal("0")
        profit_total = Decimal("0")
        for item in payload.items:
            variant = (
                (
                    await session.execute(
                        text(
                            """
                        select v.id, v.variant_name, v.retail_price, v.wholesale_price,
                               v.purchase_price, p.name, p.track_stock, p.vat_rate,
                               p.base_unit_id
                        from public.product_variants v
                        join public.products p on p.id = v.product_id
                        where v.id = :variant_id and v.organization_id = :organization_id
                          and v.status = 'active' and p.status = 'active'
                        """
                        ),
                        {
                            "variant_id": item.product_variant_id,
                            "organization_id": context.organization_id,
                        },
                    )
                )
                .mappings()
                .one_or_none()
            )
            if variant is None:
                raise HTTPException(status_code=404, detail="A sale item was not found")
            default_price = (
                variant["wholesale_price"]
                if payload.sale_type == "wholesale"
                else variant["retail_price"]
            )
            unit_price = item.unit_price if item.unit_price is not None else Decimal(default_price)
            gross = item.quantity * unit_price
            if item.discount > gross:
                raise HTTPException(status_code=422, detail="Item discount exceeds its gross value")
            taxable = gross - item.discount
            item_vat = taxable * Decimal(variant["vat_rate"]) / Decimal("100")
            line_total = taxable + item_vat
            subtotal += gross
            discount_total += item.discount
            vat_total += item_vat
            profit_total += taxable - (item.quantity * Decimal(variant["purchase_price"]))
            lines.append((variant, item.quantity, unit_price, item.discount, line_total))

        grand_total = subtotal - discount_total + vat_total
        if payload.paid_amount > grand_total:
            raise HTTPException(status_code=422, detail="Paid amount exceeds the sale total")
        due_total = grand_total - payload.paid_amount
        if due_total > 0 and payload.customer_id is None:
            raise HTTPException(status_code=422, detail="A customer is required for a due sale")

        sequence = (await session.execute(text("""
            insert into public.document_sequences(organization_id,branch_id,document_type,current_value)
            values (:org,:branch,'sale_memo',1)
            on conflict (organization_id,branch_id,document_type) do update
              set current_value=public.document_sequences.current_value+1,updated_at=now()
            returning current_value
        """), {"org": context.organization_id, "branch": branch_id})).scalar_one()
        prefix = (await session.execute(text("""
            select invoice_prefix from public.organizations where id=:org
        """), {"org": context.organization_id})).scalar_one()
        memo_no = f"{prefix}-{sequence:06d}"
        invoice_no = memo_no
        payment_status = "paid" if due_total == 0 else "partial" if payload.paid_amount > 0 else "unpaid"
        sale = (
            (
                await session.execute(
                    text(
                        """
                    insert into public.sales
                      (organization_id, branch_id, customer_id, invoice_no, memo_no, sale_type, status,
                       subtotal, discount_total, vat_total, grand_total, paid_total, due_total,
                       profit_total, payment_status, cashier_id, notes, footer_note)
                    values (:organization_id, :branch_id, :customer_id, :invoice_no, :memo_no, :sale_type,
                            'draft', :subtotal, :discount_total, :vat_total, :grand_total,
                            :paid_total, :due_total, :profit_total, :payment_status, :cashier_id, :notes, :footer_note)
                    returning id, invoice_no, memo_no, grand_total, paid_total, due_total, payment_status
                    """
                    ),
                    {
                        "organization_id": context.organization_id,
                        "branch_id": branch_id,
                        "customer_id": payload.customer_id,
                        "invoice_no": invoice_no,
                        "memo_no": memo_no,
                        "sale_type": payload.sale_type,
                        "subtotal": subtotal,
                        "discount_total": discount_total,
                        "vat_total": vat_total,
                        "grand_total": grand_total,
                        "paid_total": payload.paid_amount,
                        "due_total": due_total,
                        "profit_total": profit_total,
                        "payment_status": payment_status,
                        "cashier_id": user.id,
                        "notes": payload.notes,
                        "footer_note": payload.footer_note,
                    },
                )
            )
            .mappings()
            .one()
        )

        for variant_row, quantity, unit_price, discount, line_total in lines:
            await session.execute(
                text(
                    """
                    insert into public.sale_items
                      (organization_id, branch_id, sale_id, product_variant_id, unit_id,
                       description, quantity, unit_price, purchase_cost, discount,
                       vat_rate, line_total)
                    values (:organization_id, :branch_id, :sale_id, :variant_id, :unit_id,
                            :description, :quantity, :unit_price, :purchase_cost, :discount,
                            :vat_rate, :line_total)
                    """
                ),
                {
                    "organization_id": context.organization_id,
                    "branch_id": branch_id,
                    "sale_id": sale["id"],
                    "variant_id": variant_row["id"],
                    "unit_id": variant_row["base_unit_id"],
                    "description": f"{variant_row['name']} - {variant_row['variant_name']}",
                    "quantity": quantity,
                    "unit_price": unit_price,
                    "purchase_cost": variant_row["purchase_price"],
                    "discount": discount,
                    "vat_rate": variant_row["vat_rate"],
                    "line_total": line_total,
                },
            )
            if variant_row["track_stock"]:
                await session.execute(
                    text(
                        """
                        insert into public.stock_movements
                          (organization_id, branch_id, product_variant_id, movement_type,
                           quantity_change, unit_cost, reference_type, reference_id, created_by)
                        values (:organization_id, :branch_id, :variant_id, 'sale',
                                :quantity_change, :unit_cost, 'sale', :sale_id, :created_by)
                        """
                    ),
                    {
                        "organization_id": context.organization_id,
                        "branch_id": branch_id,
                        "variant_id": variant_row["id"],
                        "quantity_change": -quantity,
                        "unit_cost": variant_row["purchase_price"],
                        "sale_id": sale["id"],
                        "created_by": user.id,
                    },
                )

        if payload.paid_amount > 0:
            payment = (
                await session.execute(
                    text(
                        """
                        insert into public.payments
                          (organization_id, branch_id, payment_type, method, amount,
                           reference_no, sale_id, customer_id, received_by)
                        values (:organization_id, :branch_id, 'sale_payment', :method, :amount,
                                :reference_no, :sale_id, :customer_id, :received_by)
                        returning id
                        """
                    ),
                    {
                        "organization_id": context.organization_id,
                        "branch_id": branch_id,
                        "method": payload.payment_method,
                        "amount": payload.paid_amount,
                        "reference_no": payload.reference_no,
                        "sale_id": sale["id"],
                        "customer_id": payload.customer_id,
                        "received_by": user.id,
                    },
                )
            ).scalar_one()
            await session.execute(
                text(
                    """
                    insert into public.cashbook_entries
                      (organization_id, branch_id, entry_type, direction, amount, method,
                       reference_type, reference_id, created_by)
                    values (:organization_id, :branch_id, 'sale', 'in', :amount, :method,
                            'payment', :payment_id, :created_by)
                    """
                ),
                {
                    "organization_id": context.organization_id,
                    "branch_id": branch_id,
                    "amount": payload.paid_amount,
                    "method": payload.payment_method,
                    "payment_id": payment,
                    "created_by": user.id,
                },
            )

        if due_total > 0:
            await session.execute(
                text(
                    """
                    insert into public.customer_ledger_entries
                      (organization_id, branch_id, customer_id, entry_type, debit,
                       reference_type, reference_id, created_by)
                    values (:organization_id, :branch_id, :customer_id, 'sale_due', :amount,
                            'sale', :sale_id, :created_by)
                    """
                ),
                {
                    "organization_id": context.organization_id,
                    "branch_id": branch_id,
                    "customer_id": payload.customer_id,
                    "amount": due_total,
                    "sale_id": sale["id"],
                    "created_by": user.id,
                },
            )

        await session.execute(
            text("update public.sales set status='completed', sold_at=now(), completed_at=now() where id=:id"),
            {"id": sale["id"]},
        )
    return {**dict(sale), "status": "completed"}
