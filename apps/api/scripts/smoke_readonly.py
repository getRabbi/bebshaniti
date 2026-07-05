"""Authenticated, read-only smoke for a configured environment.

Uses the server-only service role to create a short-lived session for an existing
owner/admin. It never prints identity, credentials, tokens, or business records.
"""

import asyncio

import httpx
from sqlalchemy import text

from app.core.config import get_settings
from app.db.session import get_engine
from app.main import app


async def _access_token(email: str) -> str:
    settings = get_settings()
    admin_headers = {
        "apikey": settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
    }
    async with httpx.AsyncClient(timeout=30) as client:
        generated = await client.post(
            f"{settings.supabase_url}/auth/v1/admin/generate_link",
            headers=admin_headers,
            json={"type": "magiclink", "email": email},
        )
        generated.raise_for_status()
        properties = generated.json().get("properties", generated.json())
        payload = {"type": "magiclink"}
        if properties.get("email_otp"):
            payload.update({"email": email, "token": properties["email_otp"]})
        else:
            payload["token_hash"] = properties["hashed_token"]
        verified = await client.post(
            f"{settings.supabase_url}/auth/v1/verify",
            headers={"apikey": settings.supabase_anon_key},
            json=payload,
        )
        verified.raise_for_status()
        return str(verified.json()["access_token"])


async def main() -> None:
    engine = get_engine()
    async with engine.connect() as connection:
        identity = (
            (
                await connection.execute(
                    text(
                        """
                    select p.email,m.organization_id
                    from public.memberships m join public.profiles p on p.id=m.user_id
                    where m.status='active' and m.role in ('owner','admin')
                    order by case when m.role='owner' then 0 else 1 end limit 1
                    """
                    )
                )
            )
            .mappings()
            .one()
        )
    await engine.dispose()
    token = await _access_token(str(identity["email"]))
    headers = {
        "Authorization": f"Bearer {token}",
        "X-Organization-ID": str(identity["organization_id"]),
    }
    routes = [
        "/api/v1/organizations/current",
        "/api/v1/products?limit=5",
        "/api/v1/product-master/search?q=aci",
        "/api/v1/inventory/balances?limit=5",
        "/api/v1/sales?limit=5",
        "/api/v1/customers?limit=5",
        "/api/v1/due",
        "/api/v1/reports/summary",
        "/api/v1/reports/sales?days=7",
        "/api/v1/reports/inventory",
        "/api/v1/reports/due",
        "/api/v1/reports/profit?days=7",
        "/api/v1/audit-logs?limit=5",
    ]
    transport = httpx.ASGITransport(app=app)
    checked = 0
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        customers: list[dict[str, object]] = []
        for route in routes:
            response = await client.get(route, headers=headers)
            response.raise_for_status()
            if route.startswith("/api/v1/customers?"):
                customers = response.json()
            checked += 1
        if customers:
            response = await client.get(
                f"/api/v1/customers/{customers[0]['id']}/statement", headers=headers
            )
            response.raise_for_status()
            checked += 1
        preview = await client.post(
            "/api/v1/products/import/preview",
            headers=headers,
            files={
                "file": (
                    "preview.csv",
                    b"product_name,category,unit,buying_price,selling_price\n"
                    b"Read-only preview,General,pcs,1,2\n",
                    "text/csv",
                )
            },
        )
        preview.raise_for_status()
        assert preview.json()["valid_rows"] == 1
        checked += 1
    print(f"authenticated_readonly_smoke_ok routes={checked}")


if __name__ == "__main__":
    asyncio.run(main())
