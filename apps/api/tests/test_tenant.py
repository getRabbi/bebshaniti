from unittest.mock import AsyncMock, MagicMock
from uuid import UUID

import pytest
from fastapi import HTTPException

from app.core.security import CurrentUser
from app.core.tenant import OrganizationContext, get_organization_context, resolve_branch_id

ORG_ID = UUID("00000000-0000-4000-8000-000000000001")
MEMBERSHIP_ID = UUID("00000000-0000-4000-8000-000000000002")
USER_ID = UUID("00000000-0000-4000-8000-000000000003")
MAIN_BRANCH_ID = UUID("00000000-0000-4000-8000-000000000004")
OTHER_BRANCH_ID = UUID("00000000-0000-4000-8000-000000000005")


def context(branch_id: UUID | None) -> OrganizationContext:
    return OrganizationContext(
        organization_id=ORG_ID,
        branch_id=branch_id,
        membership_id=MEMBERSHIP_ID,
        role="cashier" if branch_id else "owner",
        permissions={},
    )


@pytest.mark.anyio
async def test_context_ends_membership_read_transaction() -> None:
    row = {
        "id": MEMBERSHIP_ID,
        "organization_id": ORG_ID,
        "branch_id": MAIN_BRANCH_ID,
        "role": "cashier",
        "permissions": {},
    }
    result = MagicMock()
    result.mappings.return_value.one_or_none.return_value = row
    session = AsyncMock()
    session.execute.return_value = result
    user = CurrentUser(id=USER_ID, email="uat@example.com", role="authenticated", claims={})

    resolved = await get_organization_context(user, session, str(ORG_ID))

    assert resolved.branch_id == MAIN_BRANCH_ID
    session.rollback.assert_awaited_once()


@pytest.mark.anyio
async def test_branch_user_cannot_override_assigned_branch() -> None:
    session = AsyncMock()

    with pytest.raises(HTTPException) as error:
        await resolve_branch_id(context(MAIN_BRANCH_ID), session, OTHER_BRANCH_ID)

    assert error.value.status_code == 403
    session.execute.assert_not_awaited()


@pytest.mark.anyio
async def test_owner_requested_branch_must_belong_to_organization() -> None:
    result = MagicMock()
    result.scalar_one_or_none.return_value = None
    session = AsyncMock()
    session.execute.return_value = result

    with pytest.raises(HTTPException) as error:
        await resolve_branch_id(context(None), session, OTHER_BRANCH_ID)

    assert error.value.status_code == 404
