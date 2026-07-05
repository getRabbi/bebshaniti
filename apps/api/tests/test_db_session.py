from types import SimpleNamespace
from unittest.mock import MagicMock

from sqlalchemy.pool import NullPool

import app.db.session as session_module


def test_production_engine_does_not_retain_serverless_connections(monkeypatch) -> None:
    factory = MagicMock()
    monkeypatch.setattr(
        session_module,
        "get_settings",
        lambda: SimpleNamespace(app_env="production", database_url="postgresql+asyncpg://db"),
    )
    monkeypatch.setattr(session_module, "create_async_engine", factory)
    session_module.get_engine.cache_clear()

    session_module.get_engine()

    assert factory.call_args.kwargs["poolclass"] is NullPool
    assert "pool_size" not in factory.call_args.kwargs
    assert "max_overflow" not in factory.call_args.kwargs
    session_module.get_engine.cache_clear()
