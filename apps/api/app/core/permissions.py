from collections.abc import Awaitable, Callable

from fastapi import Depends, HTTPException, status

from app.core.tenant import OrganizationContext, get_organization_context


def require_roles(*roles: str) -> Callable[..., Awaitable[OrganizationContext]]:
    async def dependency(
        context: OrganizationContext = Depends(get_organization_context),
    ) -> OrganizationContext:
        if context.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        return context

    return dependency


def require_permission(permission: str) -> Callable[..., Awaitable[OrganizationContext]]:
    async def dependency(
        context: OrganizationContext = Depends(get_organization_context),
    ) -> OrganizationContext:
        if context.role in {"owner", "admin"} or context.permissions.get(permission) is True:
            return context
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission required: {permission}",
        )

    return dependency
