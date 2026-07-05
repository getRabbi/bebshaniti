import asyncio

from sqlalchemy import text

from app.db.session import get_engine


async def main() -> None:
    engine = get_engine()
    async with engine.connect() as connection:
        tables = (
            await connection.execute(
                text("select count(*) from information_schema.tables where table_schema = 'public'")
            )
        ).scalar_one()
        migrations = (
            await connection.execute(
                text("select count(*) from supabase_migrations.schema_migrations")
            )
        ).scalar_one()
        hardening_tables = (
            await connection.execute(
                text(
                    """
                    select count(*) from information_schema.tables
                    where table_schema='public' and table_name in
                      ('product_imports','sale_returns','sale_return_items','sale_voids')
                    """
                )
            )
        ).scalar_one()
        hardening_roles = (
            await connection.execute(
                text(
                    """
                    select count(*) from pg_enum e join pg_type t on t.oid=e.enumtypid
                    where t.typname='app_role'
                      and e.enumlabel in ('manager','inventory_staff','viewer')
                    """
                )
            )
        ).scalar_one()
        product_bucket = (
            await connection.execute(
                text(
                    """
                    select count(*) from storage.buckets
                    where id='product-media' and public=false
                      and file_size_limit=5242880
                    """
                )
            )
        ).scalar_one()
    await engine.dispose()
    if (hardening_tables, hardening_roles, product_bucket) != (4, 3, 1):
        raise RuntimeError("Production hardening database objects are incomplete")
    print(
        f"database_ok tables={tables} migrations={migrations} "
        f"hardening_tables={hardening_tables} hardening_roles={hardening_roles} "
        f"private_product_bucket={product_bucket}"
    )


if __name__ == "__main__":
    asyncio.run(main())
