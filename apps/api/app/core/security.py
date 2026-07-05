from dataclasses import dataclass
from functools import lru_cache
from typing import Any
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient

from app.core.config import Settings, get_settings

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True, slots=True)
class CurrentUser:
    id: UUID
    email: str | None
    role: str
    claims: dict[str, Any]


@lru_cache(maxsize=4)
def _jwk_client(url: str) -> PyJWKClient:
    return PyJWKClient(url, cache_keys=True)


def _decode_token(token: str, settings: Settings) -> dict[str, Any]:
    options = {"require": ["exp", "sub", "aud"]}
    issuer = f"{settings.supabase_url.rstrip('/')}/auth/v1" if settings.supabase_url else None
    algorithm = str(jwt.get_unverified_header(token).get("alg", ""))
    if algorithm not in {"HS256", "RS256", "ES256"}:
        raise jwt.InvalidAlgorithmError("Unsupported JWT signing algorithm")
    kwargs: dict[str, Any] = {
        "audience": settings.supabase_jwt_audience,
        "options": options,
        "algorithms": [algorithm],
    }
    if issuer:
        kwargs["issuer"] = issuer

    if algorithm == "HS256" and settings.supabase_jwt_secret:
        return jwt.decode(token, settings.supabase_jwt_secret, **kwargs)

    if algorithm == "HS256":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Legacy JWT verification is not configured",
        )

    if not settings.effective_jwks_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="JWT verification is not configured",
        )
    signing_key = _jwk_client(settings.effective_jwks_url).get_signing_key_from_jwt(token)
    return jwt.decode(token, signing_key.key, **kwargs)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    settings: Settings = Depends(get_settings),
) -> CurrentUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bearer token required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        claims = _decode_token(credentials.credentials, settings)
        user_id = UUID(str(claims["sub"]))
    except HTTPException:
        raise
    except (KeyError, ValueError, jwt.PyJWTError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    return CurrentUser(
        id=user_id,
        email=claims.get("email"),
        role=str(claims.get("role", "authenticated")),
        claims=claims,
    )
