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
    await engine.dispose()
    print(f"database_ok tables={tables} migrations={migrations}")


if __name__ == "__main__":
    asyncio.run(main())
