from fastapi import APIRouter, Depends

from app.core.security import CurrentUser, get_current_user
from app.schemas import CurrentUserResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=CurrentUserResponse)
async def me(user: CurrentUser = Depends(get_current_user)) -> CurrentUserResponse:
    return CurrentUserResponse(
        id=user.id,
        email=user.email,
        auth_role=user.role,
        app_metadata=user.claims.get("app_metadata", {}),
    )
