from unittest.mock import AsyncMock
from uuid import UUID

import pytest

from app.core.locking import acquire_inventory_lock, inventory_lock_key

ORG = UUID("11111111-1111-1111-1111-111111111111")
BRANCH = UUID("22222222-2222-2222-2222-222222222222")
VARIANT = UUID("33333333-3333-3333-3333-333333333333")


def test_inventory_lock_key_is_stable_text() -> None:
    assert inventory_lock_key(ORG, BRANCH, VARIANT) == f"{ORG}:{BRANCH}:{VARIANT}"


@pytest.mark.anyio
async def test_inventory_lock_binds_one_text_parameter() -> None:
    session = AsyncMock()

    await acquire_inventory_lock(session, ORG, BRANCH, VARIANT)

    statement, parameters = session.execute.await_args.args
    assert "hashtextextended(:lock_key, 0)" in str(statement)
    assert parameters == {"lock_key": f"{ORG}:{BRANCH}:{VARIANT}"}
    assert isinstance(parameters["lock_key"], str)
