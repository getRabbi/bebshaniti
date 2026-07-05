from collections.abc import Awaitable, Callable

from fastapi import Depends, HTTPException, status

from app.core.tenant import OrganizationContext, get_organization_context

ALL_PERMISSIONS = frozenset(
    {
        "products.create",
        "products.update",
        "products.import",
        "customers.create",
        "inventory.adjust",
        "sales.create",
        "sales.discount",
        "sales.price_override",
        "sales.void",
        "sales.return",
        "due.receive",
        "reports.view",
        "audit.view",
        "settings.manage",
        "staff.manage",
    }
)

ROLE_PERMISSIONS: dict[str, frozenset[str]] = {
    "owner": ALL_PERMISSIONS,
    "admin": ALL_PERMISSIONS,
    "manager": frozenset(
        {
            "products.create",
            "products.update",
            "customers.create",
            "inventory.adjust",
            "sales.create",
            "sales.discount",
            "sales.price_override",
            "sales.void",
            "sales.return",
            "due.receive",
            "reports.view",
        }
    ),
    "cashier": frozenset({"customers.create", "sales.create", "due.receive"}),
    "inventory_staff": frozenset({"products.create", "products.update", "inventory.adjust"}),
    "viewer": frozenset({"reports.view"}),
    # Backward-compatible roles retained by existing tenants.
    "branch_manager": frozenset(
        {
            "products.create",
            "products.update",
            "customers.create",
            "inventory.adjust",
            "sales.create",
            "sales.discount",
            "sales.price_override",
            "sales.void",
            "sales.return",
            "due.receive",
            "reports.view",
        }
    ),
    "inventory_manager": frozenset({"products.create", "products.update", "inventory.adjust"}),
    "sales_rep": frozenset({"customers.create", "sales.create", "due.receive"}),
    "accountant": frozenset({"due.receive", "reports.view"}),
    "auditor": frozenset({"reports.view"}),
    "purchase_manager": frozenset({"products.create", "products.update", "reports.view"}),
    "support": frozenset(),
}


def effective_permissions(context: OrganizationContext) -> set[str]:
    permissions = set(ROLE_PERMISSIONS.get(context.role, frozenset()))
    for name, enabled in context.permissions.items():
        if enabled:
            permissions.add(name)
        else:
            permissions.discard(name)
    return permissions


def has_permission(context: OrganizationContext, permission: str) -> bool:
    return permission in effective_permissions(context)


def require_roles(*roles: str) -> Callable[..., Awaitable[OrganizationContext]]:
    async def dependency(
        context: OrganizationContext = Depends(get_organization_context),
    ) -> OrganizationContext:
        if context.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="এই কাজটি করার অনুমতি আপনার নেই।",
            )
        return context

    return dependency


def require_permission(permission: str) -> Callable[..., Awaitable[OrganizationContext]]:
    if permission not in ALL_PERMISSIONS:
        raise ValueError(f"Unknown permission: {permission}")

    async def dependency(
        context: OrganizationContext = Depends(get_organization_context),
    ) -> OrganizationContext:
        if has_permission(context, permission):
            return context
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="এই কাজটি করার অনুমতি আপনার নেই।",
        )

    return dependency
