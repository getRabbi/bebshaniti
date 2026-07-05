from collections.abc import AsyncIterator
from functools import lru_cache

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from app.core.config import get_settings


@lru_cache
def get_engine() -> AsyncEngine:
    settings = get_settings()
    if settings.app_env == "production":
        # Vercel instances must use Supabase transaction mode and must not
        # retain per-process connection pools.
        return create_async_engine(
            settings.database_url,
            pool_pre_ping=True,
            poolclass=NullPool,
            connect_args={
                # Supabase transaction-mode Supavisor does not support cached
                # prepared statements. SQLAlchemy and asyncpg maintain
                # separate caches, so both must be disabled.
                "prepared_statement_cache_size": 0,
                "statement_cache_size": 0,
            },
        )
    return create_async_engine(
        settings.database_url,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
    )


async def get_db_session() -> AsyncIterator[AsyncSession]:
    session_factory = async_sessionmaker(get_engine(), expire_on_commit=False)
    async with session_factory() as session:
        yield session
