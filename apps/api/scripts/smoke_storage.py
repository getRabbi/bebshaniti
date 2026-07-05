"""Ephemeral authenticated product-media RLS smoke; always removes the object."""

import asyncio
import base64
from uuid import uuid4

from sqlalchemy import text
from storage3 import AsyncStorageClient

from app.core.config import get_settings
from app.db.session import get_engine
from scripts.smoke_readonly import _access_token

PNG_1X1 = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nWQAAAAASUVORK5CYII="
)


async def main() -> None:
    settings = get_settings()
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
    path = f"{identity['organization_id']}/products/storage-smoke-{uuid4()}.png"
    headers = {
        "apikey": settings.supabase_anon_key,
        "Authorization": f"Bearer {token}",
    }
    uploaded = False
    async with AsyncStorageClient(f"{settings.supabase_url}/storage/v1/", headers) as storage:
        bucket = storage.from_("product-media")
        try:
            await bucket.upload(path, PNG_1X1, {"content-type": "image/png", "upsert": "false"})
            uploaded = True
            info = await bucket.info(path)
            if not info:
                raise RuntimeError("Uploaded object could not be read through storage RLS")
        finally:
            if uploaded:
                await bucket.remove([path])
    print("authenticated_storage_smoke_ok upload=1 read=1 cleanup=1")


if __name__ == "__main__":
    asyncio.run(main())
