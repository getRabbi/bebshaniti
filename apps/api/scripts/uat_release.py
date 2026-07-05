"""Transaction-level production UAT against isolated BebshaNiti test tenants only."""

from __future__ import annotations

import asyncio
import base64
import io
import json
import os
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any, cast
from uuid import UUID, uuid4

import httpx
from openpyxl import Workbook  # type: ignore[import-untyped]
from sqlalchemy import text
from storage3 import AsyncStorageClient
from storage3.exceptions import StorageApiError

from app.core.config import get_settings
from app.db.session import get_engine
from scripts.smoke_readonly import _access_token

PNG_1X1 = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nWQAAAAASUVORK5CYII="
)
JPEG_1X1 = base64.b64decode(
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////"
    "2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/"
    "xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAA"
    "AAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QA"
    "FhABAQEAAAAAAAAAAAAAAAAAARAR/9oACAEBAAE/IV//2gAMAwEAAgADAAAAEP/EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQMBAT8QH//EABQRAQAA"
    "AAAAAAAAAAAAAAAABD/2gAIAQIBAT8QH//EABYQAQEBAAAAAAAAAAAAAAAAAAERIf/aAAgBAQABPxCHV//Z==="
)
WEBP_1X1 = base64.b64decode("UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEAAUAmJaQAA3AA/v89WAAAAA==")


@dataclass(slots=True)
class Actor:
    role: str
    user_id: UUID
    email: str
    token: str
    branch_id: UUID | None = None


class ReleaseUAT:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.api_base = os.getenv("UAT_API_BASE_URL", "").rstrip("/")
        if not self.api_base:
            raise RuntimeError("UAT_API_BASE_URL must target an isolated UAT environment")
        if (
            self.api_base.startswith("https://")
            and os.getenv("UAT_ALLOW_PRODUCTION_MUTATIONS") != "I_UNDERSTAND"
        ):
            raise RuntimeError(
                "Hosted UAT mutates data; set UAT_ALLOW_PRODUCTION_MUTATIONS=I_UNDERSTAND"
            )
        self.tag = datetime.now(UTC).strftime("%Y%m%d-%H%M%S")
        self.engine = get_engine()
        self.actors: dict[str, Actor] = {}
        self.results: list[dict[str, Any]] = []
        self.organization_id: UUID | None = None
        self.isolation_organization_id: UUID | None = None
        self.main_branch_id: UUID | None = None
        self.second_branch_id: UUID | None = None
        self.category_id: UUID | None = None
        self.unit_id: UUID | None = None
        self.products: dict[str, dict[str, Any]] = {}
        self.customers: dict[str, dict[str, Any]] = {}
        self.sales: dict[str, dict[str, Any]] = {}
        self.unexpected_500 = 0

    def record(self, name: str, passed: bool, detail: str = "") -> None:
        self.results.append({"name": name, "passed": passed, "detail": detail})
        print(f"{'PASS' if passed else 'FAIL'} {name}{': ' + detail if detail else ''}")

    def require(self, name: str, condition: bool, detail: str = "") -> None:
        self.record(name, condition, detail)
        if not condition:
            raise AssertionError(f"{name}: {detail}")

    async def create_actor(self, role: str) -> Actor:
        email = f"uat-{self.tag}-{role}@bebshaniti.test"
        password = f"Uat-{secrets.token_urlsafe(18)}!9"
        headers = {
            "apikey": self.settings.supabase_service_role_key,
            "Authorization": f"Bearer {self.settings.supabase_service_role_key}",
        }
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post(
                f"{self.settings.supabase_url}/auth/v1/admin/users",
                headers=headers,
                json={
                    "email": email,
                    "password": password,
                    "email_confirm": True,
                    "user_metadata": {"full_name": f"UAT {role}"},
                },
            )
            response.raise_for_status()
            user_id = UUID(response.json()["id"])
        async with self.engine.begin() as connection:
            await connection.execute(
                text(
                    """
                    insert into public.profiles(id,email,full_name)
                    values (:id,:email,:name)
                    on conflict(id) do update set email=excluded.email,full_name=excluded.full_name
                    """
                ),
                {"id": user_id, "email": email, "name": f"UAT {role}"},
            )
        token = await _access_token(email)
        actor = Actor(role=role, user_id=user_id, email=email, token=token)
        self.actors[role] = actor
        return actor

    def headers(self, role: str, organization_id: UUID | None = None) -> dict[str, str]:
        org = organization_id or self.organization_id
        result = {"Authorization": f"Bearer {self.actors[role].token}"}
        if org:
            result["X-Organization-ID"] = str(org)
        return result

    async def request(
        self,
        role: str,
        method: str,
        path: str,
        *,
        expected: int | set[int] = 200,
        organization_id: UUID | None = None,
        **kwargs: Any,
    ) -> httpx.Response:
        async with httpx.AsyncClient(base_url=self.api_base, timeout=60) as client:
            response = await client.request(
                method,
                path,
                headers=self.headers(role, organization_id),
                **kwargs,
            )
        if response.status_code >= 500:
            self.unexpected_500 += 1
        allowed = {expected} if isinstance(expected, int) else expected
        self.record(
            f"{role} {method} {path}",
            response.status_code in allowed,
            f"status={response.status_code} expected={sorted(allowed)}",
        )
        return response

    async def provision(self) -> None:
        for role in (
            "owner",
            "admin",
            "manager",
            "cashier",
            "inventory_staff",
            "viewer",
            "isolation_owner",
        ):
            await self.create_actor(role)

        response = await self.request(
            "owner",
            "POST",
            "/organizations",
            expected=201,
            json={
                "name": f"BebshaNiti Release UAT {self.tag}",
                "slug": f"release-uat-{self.tag.lower()}",
                "business_type": "mixed",
                "phone": "01700000000",
                "address": "Isolated production UAT tenant",
                "branch_name": "UAT Main Branch",
                "branch_code": "UAT-MAIN",
            },
        )
        payload = response.json()
        self.organization_id = UUID(payload["id"])
        self.main_branch_id = UUID(payload["main_branch"]["id"])
        self.actors["owner"].branch_id = None

        isolation_response = await self.request(
            "isolation_owner",
            "POST",
            "/organizations",
            expected=201,
            json={
                "name": f"BebshaNiti Isolation Control {self.tag}",
                "slug": f"isolation-control-{self.tag.lower()}",
                "business_type": "retail",
                "branch_name": "Isolation Main",
                "branch_code": "ISO-MAIN",
            },
        )
        self.isolation_organization_id = UUID(isolation_response.json()["id"])

        async with self.engine.begin() as connection:
            self.second_branch_id = UUID(
                str(
                    (
                        await connection.execute(
                            text(
                                """
                                insert into public.branches
                                  (organization_id,name,code,address,phone,is_main)
                                values (:org,'UAT Second Branch','UAT-SECOND',
                                        'Isolated UAT branch two','01800000000',false)
                                returning id
                                """
                            ),
                            {"org": self.organization_id},
                        )
                    ).scalar_one()
                )
            )
            await connection.execute(
                text(
                    """
                    insert into public.warehouses(organization_id,branch_id,name,code)
                    values (:org,:branch,'Second Stock','SECOND-STOCK')
                    """
                ),
                {"org": self.organization_id, "branch": self.second_branch_id},
            )
            role_branches = {
                "admin": None,
                "manager": self.main_branch_id,
                "cashier": self.main_branch_id,
                "inventory_staff": self.main_branch_id,
                "viewer": self.main_branch_id,
            }
            for role, branch_id in role_branches.items():
                permissions = (
                    {"products.import": True, "audit.view": True} if role == "manager" else {}
                )
                await connection.execute(
                    text(
                        """
                        insert into public.memberships
                          (organization_id,user_id,role,status,branch_id,permissions,joined_at)
                        values (:org,:user,cast(:role as public.app_role),'active',:branch,
                                cast(:permissions as jsonb),now())
                        """
                    ),
                    {
                        "org": self.organization_id,
                        "user": self.actors[role].user_id,
                        "role": role,
                        "branch": branch_id,
                        "permissions": json.dumps(permissions),
                    },
                )
                self.actors[role].branch_id = branch_id
            metadata = (
                (
                    await connection.execute(
                        text(
                            """
                        select
                          (select id from public.categories where organization_id=:org
                           order by created_at limit 1) category_id,
                          (select id from public.units where organization_id=:org
                           order by created_at limit 1) unit_id
                        """
                        ),
                        {"org": self.organization_id},
                    )
                )
                .mappings()
                .one()
            )
            self.category_id = UUID(str(metadata["category_id"]))
            self.unit_id = UUID(str(metadata["unit_id"]))
        self.record(
            "isolated UAT tenant provisioned",
            True,
            f"tag={self.tag} roles=6 branches=2 control_tenant=1",
        )

    async def permission_and_rls_uat(self) -> None:
        assert self.isolation_organization_id and self.second_branch_id
        await self.request(
            "owner",
            "GET",
            "/organizations/current",
            expected=403,
            organization_id=self.isolation_organization_id,
        )
        await self.request("cashier", "POST", "/products/import/preview", expected=403)
        await self.request("manager", "POST", "/products/import/preview", expected=403)
        await self.request("inventory_staff", "GET", "/audit-logs", expected=403)
        await self.request("viewer", "GET", "/audit-logs", expected=403)
        viewer_write = await self.request(
            "viewer",
            "POST",
            "/customers",
            expected=403,
            json={"name": "Viewer forbidden write"},
        )
        self.require("viewer write rejected", viewer_write.status_code == 403)
        branches = await self.request("cashier", "GET", "/branches", expected=200)
        branch_rows = branches.json()
        self.require(
            "branch user sees assigned branch only",
            len(branch_rows) == 1 and branch_rows[0]["id"] == str(self.main_branch_id),
        )

        rest_headers = {
            "apikey": self.settings.supabase_anon_key,
            "Authorization": f"Bearer {self.actors['owner'].token}",
        }
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.get(
                f"{self.settings.supabase_url}/rest/v1/organizations",
                headers=rest_headers,
                params={"id": f"eq.{self.isolation_organization_id}", "select": "id"},
            )
        self.require(
            "PostgREST tenant RLS hides control organization",
            response.status_code == 200 and response.json() == [],
        )

    async def create_product(
        self,
        key: str,
        *,
        name: str,
        name_bn: str,
        purchase: str,
        retail: str,
        opening: str,
        branch_id: UUID | None = None,
        sku: str | None = None,
        barcode: str | None = None,
    ) -> dict[str, Any]:
        response = await self.request(
            "owner",
            "POST",
            "/products",
            expected=201,
            json={
                "name": name,
                "name_bn": name_bn,
                "category_id": str(self.category_id),
                "base_unit_id": str(self.unit_id),
                "purchase_price": purchase,
                "retail_price": retail,
                "wholesale_price": retail,
                "opening_stock": opening,
                "branch_id": str(branch_id or self.main_branch_id),
                "reorder_level": "10",
                "sku": sku,
                "barcode": barcode,
            },
        )
        data = cast(dict[str, Any], response.json())
        self.products[key] = data
        return data

    async def product_and_branch_uat(self) -> None:
        first = await self.create_product(
            "manual",
            name=f"UAT Premium Rice {self.tag}",
            name_bn=f"ইউএটি প্রিমিয়াম চাল {self.tag}",
            purchase="10",
            retail="15",
            opening="100",
        )
        second = await self.create_product(
            "barcode",
            name=f"UAT Tea {self.tag}",
            name_bn=f"ইউএটি চা {self.tag}",
            purchase="20",
            retail="30",
            opening="80",
            sku=f"UAT-TEA-{self.tag}",
            barcode=f"990{self.tag.replace('-', '')}",
        )
        self.require("auto SKU generated", str(first["variant"]["sku"]).startswith("SKU-"))
        self.require("barcode remains optional", first["variant"]["barcode"] is None)
        inventory = await self.request("owner", "GET", "/inventory/balances", expected=200)
        manual_balance = next(
            row
            for row in inventory.json()
            if row["variant_id"] == first["variant"]["id"]
            and row["branch_id"] == str(self.main_branch_id)
        )
        self.require("manual opening stock projected", Decimal(manual_balance["quantity"]) == 100)

        await self.request(
            "owner",
            "POST",
            "/inventory/adjustments",
            expected=201,
            json={
                "product_variant_id": first["variant"]["id"],
                "quantity_change": "10",
                "unit_cost": "10",
                "branch_id": str(self.second_branch_id),
                "note": "Isolated UAT branch two opening balance",
            },
        )
        self.record("second branch test stock provisioned", True)

        await self.request(
            "owner",
            "POST",
            "/inventory/adjustments",
            expected=201,
            json={
                "product_variant_id": first["variant"]["id"],
                "quantity_change": "20",
                "unit_cost": "10",
                "branch_id": str(self.second_branch_id),
                "note": "UAT branch-two opening",
            },
        )

        cross_customer = await self.request(
            "cashier",
            "POST",
            "/customers",
            expected=403,
            json={
                "name": "Forbidden cross-branch customer",
                "phone": f"019{self.tag.replace('-', '')[-8:]}",
                "branch_id": str(self.second_branch_id),
            },
        )
        cross_inventory = await self.request(
            "inventory_staff",
            "POST",
            "/inventory/adjustments",
            expected=403,
            json={
                "product_variant_id": second["variant"]["id"],
                "quantity_change": "1",
                "branch_id": str(self.second_branch_id),
                "note": "Forbidden branch override",
            },
        )
        cross_product = await self.request(
            "inventory_staff",
            "POST",
            "/products",
            expected=403,
            json={
                "name": "Forbidden opening branch product",
                "category_id": str(self.category_id),
                "base_unit_id": str(self.unit_id),
                "purchase_price": "1",
                "retail_price": "2",
                "opening_stock": "1",
                "branch_id": str(self.second_branch_id),
            },
        )
        self.record(
            "branch payload overrides rejected",
            all(
                response.status_code == 403
                for response in (cross_customer, cross_inventory, cross_product)
            ),
        )

        bn_search = await self.request(
            "owner", "GET", "/product-master/search?q=%E0%A6%9A%E0%A6%BE", expected=200
        )
        en_search = await self.request("owner", "GET", "/product-master/search?q=aci", expected=200)
        self.require("Bangla autocomplete returns results", bool(bn_search.json()))
        self.require("English autocomplete returns results", bool(en_search.json()))

    async def storage_uat(self) -> None:
        assert self.organization_id
        product_id = self.products["manual"]["id"]
        headers = {
            "apikey": self.settings.supabase_anon_key,
            "Authorization": f"Bearer {self.actors['owner'].token}",
        }
        paths = {
            "png": f"{self.organization_id}/products/{uuid4()}.png",
            "jpeg": f"{self.organization_id}/products/{uuid4()}.jpg",
            "webp": f"{self.organization_id}/products/{uuid4()}.webp",
        }
        uploaded: list[str] = []
        async with AsyncStorageClient(
            f"{self.settings.supabase_url}/storage/v1/", headers
        ) as storage:
            bucket = storage.from_("product-media")
            try:
                for kind, content, mime in (
                    ("png", PNG_1X1, "image/png"),
                    ("jpeg", JPEG_1X1, "image/jpeg"),
                    ("webp", WEBP_1X1, "image/webp"),
                ):
                    await bucket.upload(
                        paths[kind], content, {"content-type": mime, "upsert": "false"}
                    )
                    uploaded.append(paths[kind])
                    self.record(f"storage accepts {kind}", True)

                too_large_path = f"{self.organization_id}/products/{uuid4()}.png"
                too_large_rejected = False
                try:
                    await bucket.upload(
                        too_large_path,
                        b"0" * (5 * 1024 * 1024 + 1),
                        {"content-type": "image/png", "upsert": "false"},
                    )
                    uploaded.append(too_large_path)
                except StorageApiError:
                    too_large_rejected = True
                self.require("storage rejects image above 5 MB", too_large_rejected)

                unsupported_path = f"{self.organization_id}/products/{uuid4()}.txt"
                unsupported_rejected = False
                try:
                    await bucket.upload(
                        unsupported_path,
                        b"not an image",
                        {"content-type": "text/plain", "upsert": "false"},
                    )
                    uploaded.append(unsupported_path)
                except StorageApiError:
                    unsupported_rejected = True
                self.require("storage rejects unsupported MIME", unsupported_rejected)

                patch_png = await self.request(
                    "owner",
                    "PATCH",
                    f"/products/{product_id}/image",
                    expected=200,
                    json={"image_path": paths["png"]},
                )
                signed_url = patch_png.json()["image_url"]
                self.require(
                    "signed URL excludes service role",
                    self.settings.supabase_service_role_key not in signed_url,
                )
                async with httpx.AsyncClient(timeout=45) as client:
                    signed_response = await client.get(signed_url)
                self.require("signed product image URL loads", signed_response.status_code == 200)

                await self.request(
                    "owner",
                    "PATCH",
                    f"/products/{product_id}/image",
                    expected=200,
                    json={"image_path": paths["jpeg"]},
                )
                await bucket.remove([paths["png"]])
                uploaded.remove(paths["png"])
                old_missing = False
                try:
                    await bucket.info(paths["png"])
                except StorageApiError:
                    old_missing = True
                self.require("replaced image old object cleaned", old_missing)

                await self.request(
                    "owner",
                    "PATCH",
                    f"/products/{product_id}/image",
                    expected=200,
                    json={"image_path": paths["webp"]},
                )
                await bucket.remove([paths["jpeg"]])
                uploaded.remove(paths["jpeg"])
                listing = await self.request("owner", "GET", "/products?limit=500", expected=200)
                row = next(item for item in listing.json() if item["id"] == product_id)
                self.require(
                    "product thumbnail signed URL returned",
                    row["image_path"] == paths["webp"] and bool(row["image_url"]),
                )
                await self.request(
                    "owner",
                    "PATCH",
                    f"/products/{product_id}/image",
                    expected=200,
                    json={"image_path": None},
                )
                await bucket.remove([paths["webp"]])
                uploaded.remove(paths["webp"])
                self.record("remove image clears DB and storage", True)
            finally:
                if uploaded:
                    await bucket.remove(uploaded)

    def xlsx_bytes(self, rows: list[list[Any]]) -> bytes:
        workbook = Workbook()
        sheet = workbook.active
        for row in rows:
            sheet.append(row)
        stream = io.BytesIO()
        workbook.save(stream)
        workbook.close()
        return stream.getvalue()

    async def import_uat(self) -> None:
        sample = await self.request("owner", "GET", "/products/import/sample.csv", expected=200)
        self.require("sample CSV downloads", "product_name" in sample.text)
        suffix = self.tag.replace("-", "")
        english_header = (
            "product_name,category,unit,buying_price,selling_price,sku,barcode,brand,"
            "opening_stock,low_stock_alert,wholesale_price,mrp,supplier,rack,expiry_date\n"
        )
        valid_csv = english_header + (
            f"UAT Import Oil {self.tag},UAT Grocery,pcs,40,55,UAT-OIL-{suffix},"
            f"880{suffix},UAT Brand,12,3,50,60,UAT Supplier,R-1,2028-12-31\n"
        )
        preview = await self.request(
            "owner",
            "POST",
            "/products/import/preview",
            expected=200,
            files={"file": ("valid.csv", valid_csv.encode(), "text/csv")},
        )
        self.require(
            "English CSV valid preview",
            preview.json()["valid_rows"] == 1 and preview.json()["invalid_rows"] == 0,
        )
        bangla_csv = (
            "পণ্যের নাম,ক্যাটাগরি,ইউনিট,ক্রয় মূল্য,বিক্রয় মূল্য,sku,ওপেনিং স্টক\n"
            f"ইউএটি ডাল {self.tag},ডাল,pcs,60,75,UAT-BN-{suffix},7\n"
        )
        bangla = await self.request(
            "owner",
            "POST",
            "/products/import/preview",
            expected=200,
            files={"file": ("bangla.csv", bangla_csv.encode(), "text/csv")},
        )
        self.require("Bangla CSV headers accepted", bangla.json()["valid_rows"] == 1)
        invalid_csv = english_header + "Broken,,pcs,nope,10,,,,,,,,,,\n"
        invalid = await self.request(
            "owner",
            "POST",
            "/products/import/preview",
            expected=200,
            files={"file": ("invalid.csv", invalid_csv.encode(), "text/csv")},
        )
        self.require(
            "invalid import exposes row errors",
            invalid.json()["invalid_rows"] == 1 and bool(invalid.json()["rows"][0]["errors"]),
        )
        xlsx = self.xlsx_bytes(
            [
                ["product_name", "category", "unit", "buying_price", "selling_price", "sku"],
                [f"UAT XLSX Soap {self.tag}", "UAT Care", "pcs", 20, 30, f"UAT-XLSX-{suffix}"],
            ]
        )
        xlsx_preview = await self.request(
            "owner",
            "POST",
            "/products/import/preview",
            expected=200,
            files={
                "file": (
                    "valid.xlsx",
                    xlsx,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
        )
        self.require("XLSX valid preview", xlsx_preview.json()["valid_rows"] == 1)

        created = await self.request(
            "owner",
            "POST",
            "/products/import/commit",
            expected=201,
            data={"mode": "create"},
            files={"file": ("valid.csv", valid_csv.encode(), "text/csv")},
        )
        self.require(
            "create import summary accurate",
            created.json()["created_rows"] == 1 and created.json()["failed_rows"] == 0,
        )
        duplicate_csv = english_header + (
            f"SKU duplicate {self.tag},UAT Grocery,pcs,40,55,UAT-OIL-{suffix},"
            f"991{suffix},UAT Brand,0,3,50,60,UAT Supplier,R-3,2028-12-31\n"
            f"Barcode duplicate {self.tag},UAT Grocery,pcs,40,55,UAT-OTHER-{suffix},"
            f"880{suffix},UAT Brand,0,3,50,60,UAT Supplier,R-4,2028-12-31\n"
            f"UAT Import Oil {self.tag},UAT Grocery,pcs,40,55,UAT-NAME-{suffix},"
            f"992{suffix},UAT Brand,0,3,50,60,UAT Supplier,R-5,2028-12-31\n"
        )
        duplicate_preview = await self.request(
            "owner",
            "POST",
            "/products/import/preview",
            expected=200,
            files={"file": ("duplicate.csv", duplicate_csv.encode(), "text/csv")},
        )
        duplicate_rows = duplicate_preview.json()["rows"]
        self.require(
            "duplicates by SKU, barcode and name detected",
            duplicate_preview.json()["duplicate_rows"] == 3
            and {row["duplicate_by"] for row in duplicate_rows} == {"sku", "barcode", "name"},
        )
        skipped = await self.request(
            "owner",
            "POST",
            "/products/import/commit",
            expected=201,
            data={"mode": "skip"},
            files={"file": ("valid.csv", valid_csv.encode(), "text/csv")},
        )
        self.require("skip import summary accurate", skipped.json()["skipped_rows"] == 1)
        updated_csv = english_header + (
            f"UAT Import Oil {self.tag},UAT Grocery,pcs,45,60,UAT-OIL-{suffix},"
            f"880{suffix},UAT Brand,18,4,55,65,UAT Supplier,R-2,2029-12-31\n"
        )
        updated = await self.request(
            "owner",
            "POST",
            "/products/import/commit",
            expected=201,
            data={"mode": "update"},
            files={"file": ("updated.csv", updated_csv.encode(), "text/csv")},
        )
        self.require("update import summary accurate", updated.json()["updated_rows"] == 1)
        create_duplicate = await self.request(
            "owner",
            "POST",
            "/products/import/commit",
            expected=201,
            data={"mode": "create"},
            files={"file": ("duplicate.csv", updated_csv.encode(), "text/csv")},
        )
        self.require("create mode rejects duplicate", create_duplicate.json()["failed_rows"] == 1)

        async with self.engine.connect() as connection:
            imported = (
                (
                    await connection.execute(
                        text(
                            """
                        select p.id,v.id variant_id,v.purchase_price,v.retail_price,ib.quantity,
                               (select count(*) from public.stock_movements sm
                                where sm.product_variant_id=v.id
                                  and sm.reference_type='product_import') movements
                        from public.products p join public.product_variants v on v.product_id=p.id
                        left join public.inventory_balances ib on ib.product_variant_id=v.id
                          and ib.branch_id=:branch
                        where p.organization_id=:org and v.sku=:sku
                        """
                        ),
                        {
                            "org": self.organization_id,
                            "branch": self.main_branch_id,
                            "sku": f"UAT-OIL-{suffix}",
                        },
                    )
                )
                .mappings()
                .one()
            )
        self.require(
            "import opening stock uses stock movements",
            Decimal(imported["quantity"]) == 18 and imported["movements"] >= 2,
        )
        audit = await self.request(
            "owner", "GET", "/audit-logs?module=product_imports&limit=20", expected=200
        )
        self.require("product import audit exists", len(audit.json()) >= 3)

    async def create_customer(
        self, key: str, name: str, branch_id: UUID, phone_suffix: str
    ) -> dict[str, Any]:
        response = await self.request(
            "owner",
            "POST",
            "/customers",
            expected=201,
            json={
                "name": name,
                "phone": f"01{phone_suffix}{self.tag.replace('-', '')[-7:]}",
                "address": "Isolated UAT address",
                "branch_id": str(branch_id),
                "credit_limit": "500",
            },
        )
        data = cast(dict[str, Any], response.json())
        self.customers[key] = data
        return data

    async def create_sale(
        self,
        key: str,
        role: str,
        *,
        branch_id: UUID,
        customer_id: str | None,
        items: list[dict[str, Any]],
        paid: str,
        method: str = "cash",
    ) -> httpx.Response:
        response = await self.request(
            role,
            "POST",
            "/sales",
            expected=201,
            json={
                "branch_id": str(branch_id),
                "customer_id": customer_id,
                "items": items,
                "paid_amount": paid,
                "payment_method": method,
            },
        )
        if response.status_code == 201:
            self.sales[key] = response.json()
        return response

    async def sales_due_return_reports_uat(self) -> None:
        assert self.main_branch_id and self.second_branch_id
        first = self.products["manual"]["variant"]
        second = self.products["barcode"]["variant"]
        customer_a = await self.create_customer(
            "main", f"UAT Main Customer {self.tag}", self.main_branch_id, "71"
        )
        await self.create_customer(
            "second", f"UAT Second Customer {self.tag}", self.second_branch_id, "72"
        )

        cross_sale = await self.request(
            "cashier",
            "POST",
            "/sales",
            expected=403,
            json={
                "branch_id": str(self.second_branch_id),
                "items": [{"product_variant_id": first["id"], "quantity": "1"}],
                "paid_amount": "15",
            },
        )
        self.record("cashier cross-branch sale rejected", cross_sale.status_code == 403)

        await self.create_sale(
            "full_paid",
            "cashier",
            branch_id=self.main_branch_id,
            customer_id=None,
            items=[{"product_variant_id": first["id"], "quantity": "2"}],
            paid="30",
        )
        await self.create_sale(
            "partial",
            "cashier",
            branch_id=self.main_branch_id,
            customer_id=customer_a["id"],
            items=[{"product_variant_id": first["id"], "quantity": "2"}],
            paid="10",
            method="bkash",
        )
        await self.create_sale(
            "unpaid",
            "cashier",
            branch_id=self.main_branch_id,
            customer_id=customer_a["id"],
            items=[{"product_variant_id": second["id"], "quantity": "1"}],
            paid="0",
        )
        await self.create_sale(
            "discount_multi",
            "owner",
            branch_id=self.main_branch_id,
            customer_id=None,
            items=[
                {"product_variant_id": first["id"], "quantity": "1", "discount": "2"},
                {"product_variant_id": second["id"], "quantity": "2", "discount": "3"},
            ],
            paid="70",
            method="nagad",
        )
        await self.create_sale(
            "branch_two",
            "owner",
            branch_id=self.second_branch_id,
            customer_id=None,
            items=[{"product_variant_id": first["id"], "quantity": "1"}],
            paid="15",
        )
        await self.create_sale(
            "due_payments",
            "cashier",
            branch_id=self.main_branch_id,
            customer_id=customer_a["id"],
            items=[{"product_variant_id": second["id"], "quantity": "1"}],
            paid="0",
        )

        main_branch_sales = [sale for key, sale in self.sales.items() if key != "branch_two"]
        memo_numbers = [sale["memo_no"] for sale in main_branch_sales]
        self.require(
            "memo numbers unique in branch",
            len(memo_numbers) == len(set(memo_numbers)),
        )
        detail = await self.request(
            "owner", "GET", f"/sales/{self.sales['discount_multi']['id']}", expected=200
        )
        self.require("multi-item sale items correct", len(detail.json()["items"]) == 2)
        self.require("discount total correct", Decimal(detail.json()["discount_total"]) == 5)

        immutable = False
        async with self.engine.connect() as connection:
            transaction = await connection.begin()
            try:
                await connection.execute(
                    text("update public.sales set notes='forbidden mutation' where id=:id"),
                    {"id": self.sales["full_paid"]["id"]},
                )
            except Exception:
                immutable = True
            finally:
                await transaction.rollback()
        self.require("completed sale DB mutation rejected", immutable)

        partial_detail = await self.request(
            "owner", "GET", f"/sales/{self.sales['partial']['id']}", expected=200
        )
        partial_item = partial_detail.json()["items"][0]
        unauthorized_return = await self.request(
            "cashier",
            "POST",
            f"/sales/{self.sales['partial']['id']}/returns",
            expected=403,
            json={
                "reason": "Cashier must not return",
                "items": [{"sale_item_id": partial_item["id"], "quantity": "1"}],
            },
        )
        self.require("cashier return forbidden", unauthorized_return.status_code == 403)

        partial_return = await self.request(
            "owner",
            "POST",
            f"/sales/{self.sales['partial']['id']}/returns",
            expected=201,
            json={
                "reason": "UAT partial return",
                "refund_method": "cash",
                "items": [{"sale_item_id": partial_item["id"], "quantity": "1"}],
            },
        )
        self.require(
            "partial return total correct", Decimal(partial_return.json()["return_total"]) == 15
        )
        exceed = await self.request(
            "owner",
            "POST",
            f"/sales/{self.sales['partial']['id']}/returns",
            expected=422,
            json={
                "reason": "UAT excessive return",
                "items": [{"sale_item_id": partial_item["id"], "quantity": "2"}],
            },
        )
        self.require("return cannot exceed sold quantity", exceed.status_code == 422)

        unpaid_detail = await self.request(
            "owner", "GET", f"/sales/{self.sales['unpaid']['id']}", expected=200
        )
        full_return = await self.request(
            "owner",
            "POST",
            f"/sales/{self.sales['unpaid']['id']}/returns",
            expected=201,
            json={
                "reason": "UAT full return",
                "items": [
                    {
                        "sale_item_id": unpaid_detail.json()["items"][0]["id"],
                        "quantity": "1",
                    }
                ],
            },
        )
        self.require("full return created", Decimal(full_return.json()["return_total"]) == 30)
        unauthorized_void = await self.request(
            "cashier",
            "POST",
            f"/sales/{self.sales['full_paid']['id']}/void",
            expected=403,
            json={"reason": "Cashier must not void"},
        )
        self.require("cashier void forbidden", unauthorized_void.status_code == 403)
        voided = await self.request(
            "owner",
            "POST",
            f"/sales/{self.sales['full_paid']['id']}/void",
            expected=201,
            json={"reason": "UAT full sale void", "refund_method": "cash"},
        )
        self.require("full sale void created", voided.json()["status"] == "void")

        due_before = await self.request("owner", "GET", "/due", expected=200)
        customer_due = next(
            row for row in due_before.json() if row["customer_id"] == customer_a["id"]
        )
        self.require("customer due reflects returns", Decimal(customer_due["balance"]) == 35)
        first_collection = await self.request(
            "cashier",
            "POST",
            "/due/collections",
            expected=201,
            json={
                "customer_id": customer_a["id"],
                "amount": "10",
                "method": "cash",
                "note": "UAT partial due collection",
            },
        )
        self.require(
            "partial due collection posted", Decimal(first_collection.json()["amount"]) == 10
        )
        second_collection = await self.request(
            "cashier",
            "POST",
            "/due/collections",
            expected=201,
            json={
                "customer_id": customer_a["id"],
                "amount": "25",
                "method": "bank",
                "note": "UAT full due collection",
            },
        )
        self.require(
            "full due collection posted", Decimal(second_collection.json()["amount"]) == 25
        )

        statement = await self.request(
            "owner",
            "GET",
            f"/customers/{customer_a['id']}/statement",
            expected=200,
        )
        statement_data = statement.json()
        self.require(
            "customer statement closes at zero", Decimal(statement_data["current_balance"]) == 0
        )
        self.require(
            "customer statement ledger has running balances", len(statement_data["ledger"]) >= 7
        )
        today = datetime.now(UTC).date().isoformat()
        filtered_statement = await self.request(
            "owner",
            "GET",
            f"/customers/{customer_a['id']}/statement?date_from={today}&date_to={today}",
            expected=200,
        )
        self.require("statement date filter works", filtered_statement.status_code == 200)

        async with self.engine.connect() as connection:
            invariants = (
                (
                    await connection.execute(
                        text(
                            """
                        select
                          (select count(*) from public.sales where organization_id=:org
                           and status='completed') completed_sales,
                          (select count(*) from public.stock_movements where organization_id=:org
                           and movement_type='sale_return') reverse_movements,
                          (select count(*) from public.payments where organization_id=:org
                           and payment_type='refund') refunds,
                          (select count(*) from public.audit_logs where organization_id=:org
                           and entity_type in ('sale_returns','sale_voids')) reversal_audits,
                          (select status::text from public.sales where id=:void_sale)
                            original_void_status,
                          (select status::text from public.sales where id=:return_sale)
                            original_return_status
                        """
                        ),
                        {
                            "org": self.organization_id,
                            "void_sale": self.sales["full_paid"]["id"],
                            "return_sale": self.sales["partial"]["id"],
                        },
                    )
                )
                .mappings()
                .one()
            )
        self.require("return creates reverse stock movements", invariants["reverse_movements"] >= 3)
        self.require("void creates refund payment", invariants["refunds"] >= 1)
        self.require("return/void audit logs created", invariants["reversal_audits"] >= 2)
        self.require(
            "original returned/voided sales remain completed",
            invariants["original_void_status"] == "completed"
            and invariants["original_return_status"] == "completed",
        )

        sales_report = await self.request("owner", "GET", "/reports/sales?days=7", expected=200)
        profit_report = await self.request("owner", "GET", "/reports/profit?days=7", expected=200)
        due_report = await self.request("owner", "GET", "/reports/due", expected=200)
        inventory_report = await self.request("owner", "GET", "/reports/inventory", expected=200)
        branch_report = await self.request(
            "owner",
            "GET",
            f"/reports/sales?days=7&branch_id={self.second_branch_id}",
            expected=200,
        )
        self.require("best selling products reported", bool(sales_report.json()["best_sellers"]))
        self.require(
            "payment method summary reported", bool(sales_report.json()["payment_methods"])
        )
        self.require("profit report nets returns", Decimal(profit_report.json()["net_sales"]) > 0)
        self.require(
            "receivable due report cleared", Decimal(due_report.json()["receivable_due"]) == 0
        )
        self.require(
            "inventory value summary reported",
            Decimal(inventory_report.json()["inventory_value"]) > 0,
        )
        self.require("branch report filter works", len(branch_report.json()["daily"]) == 1)

    async def run(self) -> None:
        try:
            await self.provision()
            await self.permission_and_rls_uat()
            await self.product_and_branch_uat()
            await self.storage_uat()
            await self.import_uat()
            await self.sales_due_return_reports_uat()
        finally:
            await self.engine.dispose()
        passed = sum(1 for result in self.results if result["passed"])
        failed = [result for result in self.results if not result["passed"]]
        print(
            "UAT_SUMMARY "
            + json.dumps(
                {
                    "tag": self.tag,
                    "organization_id": str(self.organization_id),
                    "control_organization_id": str(self.isolation_organization_id),
                    "passed": passed,
                    "failed": len(failed),
                    "unexpected_500": self.unexpected_500,
                    "failures": failed,
                },
                ensure_ascii=False,
                default=str,
            )
        )
        if failed:
            raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(ReleaseUAT().run())
