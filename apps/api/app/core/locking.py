from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


def inventory_lock_key(organization_id: UUID, branch_id: UUID, variant_id: UUID) -> str:
    return f"{organization_id}:{branch_id}:{variant_id}"


async def acquire_inventory_lock(
    session: AsyncSession,
    organization_id: UUID,
    branch_id: UUID,
    variant_id: UUID,
) -> None:
    await session.execute(
        text("select pg_advisory_xact_lock(hashtextextended(:lock_key, 0))"),
        {"lock_key": inventory_lock_key(organization_id, branch_id, variant_id)},
    )
