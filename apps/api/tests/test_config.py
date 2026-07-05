import pytest
from pydantic import ValidationError

from app.core.config import Settings


def production_settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "app_env": "production",
        "supabase_url": "https://project.supabase.co",
        "supabase_anon_key": "anon-key",
        "supabase_service_role_key": "service-role-key",
        "database_url": "postgresql+asyncpg://user:password@pooler.example.net:6543/postgres",
        "allowed_origins": ["https://app.example.com"],
    }
    values.update(overrides)
    return Settings(**values)


def test_valid_production_configuration() -> None:
    settings = production_settings()

    assert settings.app_env == "production"


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("supabase_url", ""),
        ("supabase_anon_key", ""),
        ("supabase_service_role_key", ""),
        ("database_url", ""),
        ("database_url", "postgresql+asyncpg://postgres:postgres@localhost/postgres"),
        ("allowed_origins", ["*"]),
        ("allowed_origins", ["http://app.example.com"]),
    ],
)
def test_invalid_production_configuration_is_rejected(field: str, value: object) -> None:
    with pytest.raises(ValidationError):
        production_settings(**{field: value})
