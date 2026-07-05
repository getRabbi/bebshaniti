from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ApiModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class HealthResponse(ApiModel):
    status: str
    service: str
    environment: str
    timestamp: datetime


class CurrentUserResponse(ApiModel):
    id: UUID
    email: str | None
    auth_role: str
    app_metadata: dict[str, Any]


class OrganizationCreate(ApiModel):
    name: str = Field(min_length=2, max_length=160)
    slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=80)
    business_type: str = Field(default="mixed", max_length=60)
    phone: str | None = Field(default=None, max_length=30)
    address: str | None = Field(default=None, max_length=500)
    branch_name: str = Field(default="Main Branch", min_length=2, max_length=120)
    branch_code: str = Field(default="MAIN", min_length=2, max_length=30)


class ProductCreate(ApiModel):
    name: str = Field(min_length=1, max_length=180)
    name_bn: str | None = Field(default=None, max_length=180)
    master_item_id: UUID | None = None
    sku: str | None = Field(default=None, max_length=80)
    barcode: str | None = Field(default=None, max_length=100)
    category_id: UUID | None = None
    brand_id: UUID | None = None
    base_unit_id: UUID | None = None
    purchase_price: Decimal = Field(default=Decimal("0"), ge=0)
    retail_price: Decimal = Field(default=Decimal("0"), ge=0)
    wholesale_price: Decimal = Field(default=Decimal("0"), ge=0)
    reorder_level: Decimal = Field(default=Decimal("0"), ge=0)
    track_stock: bool = True
    description: str | None = Field(default=None, max_length=2000)
    variant_name: str = Field(default="Default", max_length=120)
    brand_name: str | None = Field(default=None, max_length=120)
    supplier_id: UUID | None = None
    supplier_name: str | None = Field(default=None, max_length=180)
    pack_size: str | None = Field(default=None, max_length=120)
    mrp: Decimal | None = Field(default=None, ge=0)
    opening_stock: Decimal = Field(default=Decimal("0"), ge=0)
    branch_id: UUID | None = None
    vat_rate: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    discount_allowed: bool = True
    expiry_tracking: bool = False
    expiry_date: date | None = None
    batch_number: str | None = Field(default=None, max_length=120)
    serial_number: str | None = Field(default=None, max_length=120)
    rack_location: str | None = Field(default=None, max_length=120)
    notes: str | None = Field(default=None, max_length=1000)


class CustomerCreate(ApiModel):
    name: str = Field(min_length=1, max_length=180)
    phone: str | None = Field(default=None, max_length=30)
    address: str | None = Field(default=None, max_length=500)
    district: str | None = Field(default=None, max_length=100)
    customer_type: Literal["retail", "wholesale", "dealer", "vip"] = "retail"
    credit_limit: Decimal = Field(default=Decimal("0"), ge=0)
    branch_id: UUID | None = None


class InventoryAdjustmentCreate(ApiModel):
    product_variant_id: UUID
    quantity_change: Decimal
    unit_cost: Decimal | None = Field(default=None, ge=0)
    branch_id: UUID | None = None
    warehouse_id: UUID | None = None
    note: str | None = Field(default=None, max_length=500)


class SaleItemCreate(ApiModel):
    product_variant_id: UUID
    quantity: Decimal = Field(gt=0)
    unit_price: Decimal | None = Field(default=None, ge=0)
    discount: Decimal = Field(default=Decimal("0"), ge=0)


class SaleCreate(ApiModel):
    branch_id: UUID | None = None
    customer_id: UUID | None = None
    sale_type: Literal["retail", "wholesale"] = "retail"
    items: list[SaleItemCreate] = Field(min_length=1, max_length=200)
    paid_amount: Decimal = Field(default=Decimal("0"), ge=0)
    payment_method: Literal["cash", "bkash", "nagad", "rocket", "bank", "card", "cheque"] = "cash"
    reference_no: str | None = Field(default=None, max_length=120)
    notes: str | None = Field(default=None, max_length=500)
    footer_note: str | None = Field(default=None, max_length=500)


class ProductMasterImportItem(ApiModel):
    category_slug: str = Field(min_length=2, max_length=100)
    bn_name: str = Field(min_length=1, max_length=180)
    en_name: str = Field(min_length=1, max_length=180)
    brand_name: str | None = Field(default=None, max_length=120)
    common_unit: str = Field(default="pcs", max_length=40)
    common_pack_size: str | None = Field(default=None, max_length=80)
    aliases: list[str] = Field(default_factory=list, max_length=30)
    barcode: str | None = Field(default=None, max_length=100)


class ProductMasterImport(ApiModel):
    items: list[ProductMasterImportItem] = Field(min_length=1, max_length=5000)


class DueCollectionCreate(ApiModel):
    customer_id: UUID
    amount: Decimal = Field(gt=0)
    branch_id: UUID | None = None
    method: Literal["cash", "bkash", "nagad", "rocket", "bank", "card", "cheque"] = "cash"
    reference_no: str | None = Field(default=None, max_length=120)
    note: str | None = Field(default=None, max_length=500)
