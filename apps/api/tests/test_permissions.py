from uuid import UUID

from app.core.permissions import effective_permissions, has_permission
from app.core.tenant import OrganizationContext


def context(role: str, overrides: dict[str, bool] | None = None) -> OrganizationContext:
    return OrganizationContext(
        organization_id=UUID("00000000-0000-4000-8000-000000000001"),
        branch_id=None,
        membership_id=UUID("00000000-0000-4000-8000-000000000002"),
        role=role,
        permissions=overrides or {},
    )


def test_cashier_cannot_void_or_import() -> None:
    cashier = context("cashier")
    assert has_permission(cashier, "sales.create")
    assert not has_permission(cashier, "sales.void")
    assert not has_permission(cashier, "products.import")


def test_explicit_permission_override_wins() -> None:
    manager = context("manager", {"sales.void": False, "staff.manage": True})
    permissions = effective_permissions(manager)
    assert "sales.void" not in permissions
    assert "staff.manage" in permissions


def test_product_import_is_admin_only_by_default() -> None:
    assert has_permission(context("owner"), "products.import")
    assert has_permission(context("admin"), "products.import")
    assert not has_permission(context("manager"), "products.import")
    assert not has_permission(context("inventory_manager"), "products.import")


def test_restricted_permissions_cannot_be_granted_by_override() -> None:
    manager = context("manager", {"products.import": True, "audit.view": True})
    assert not has_permission(manager, "products.import")
    assert not has_permission(manager, "audit.view")
