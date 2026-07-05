from uuid import UUID

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.security import CurrentUser, get_current_user
from app.main import app


@pytest.mark.anyio
async def test_me_requires_bearer_token() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/auth/me")
    assert response.status_code == 401


@pytest.mark.anyio
async def test_me_uses_verified_user_context() -> None:
    user_id = UUID("00000000-0000-4000-8000-000000000001")

    async def override_user() -> CurrentUser:
        return CurrentUser(
            id=user_id,
            email="owner@example.test",
            role="authenticated",
            claims={"app_metadata": {"provider": "email"}},
        )

    app.dependency_overrides[get_current_user] = override_user
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/v1/auth/me")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["id"] == str(user_id)
