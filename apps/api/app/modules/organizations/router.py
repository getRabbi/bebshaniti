from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import CurrentUser, get_current_user
from app.core.tenant import OrganizationContext, get_organization_context
from app.db.session import get_db_session
from app.schemas import OrganizationCreate

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.get("")
async def list_organizations(
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[dict[str, object]]:
    result = await session.execute(
        text(
            """
            select o.id, o.name, o.slug, o.business_type, o.logo_path, o.phone,
                   o.currency, o.language, o.timezone, m.role::text as role,
                   m.permissions, b.id as main_branch_id, b.name as main_branch_name
            from public.memberships m
            join public.organizations o on o.id = m.organization_id and o.is_active
            left join public.branches b on b.organization_id = o.id and b.is_main
            where m.user_id = :user_id and m.status = 'active'
            order by o.name
            """
        ),
        {"user_id": user.id},
    )
    return [dict(row) for row in result.mappings().all()]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_organization(
    payload: OrganizationCreate,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, object]:
    try:
        async with session.begin():
            await session.execute(
                text(
                    """
                    insert into public.profiles (id, email, full_name)
                    values (:user_id, :email, '')
                    on conflict (id) do update set email = excluded.email
                    """
                ),
                {"user_id": user.id, "email": user.email},
            )
            organization = (
                (
                    await session.execute(
                        text(
                            """
                        insert into public.organizations
                          (name, slug, business_type, phone, address)
                        values (:name, :slug, :business_type, :phone, :address)
                        returning id, name, slug, business_type, currency, language, timezone
                        """
                        ),
                        payload.model_dump(
                            include={"name", "slug", "business_type", "phone", "address"}
                        ),
                    )
                )
                .mappings()
                .one()
            )
            branch = (
                (
                    await session.execute(
                        text(
                            """
                        insert into public.branches
                          (organization_id, name, code, address, phone, is_main)
                        values (:organization_id, :name, :code, :address, :phone, true)
                        returning id, name, code
                        """
                        ),
                        {
                            "organization_id": organization["id"],
                            "name": payload.branch_name,
                            "code": payload.branch_code.upper(),
                            "address": payload.address,
                            "phone": payload.phone,
                        },
                    )
                )
                .mappings()
                .one()
            )
            await session.execute(
                text(
                    """
                    insert into public.memberships
                      (organization_id, user_id, role, status, branch_id, joined_at)
                    values (:organization_id, :user_id, 'owner', 'active', null, now())
                    """
                ),
                {"organization_id": organization["id"], "user_id": user.id},
            )
            await session.execute(
                text(
                    """
                    insert into public.warehouses
                      (organization_id, branch_id, name, code)
                    values (:organization_id, :branch_id, 'Main Stock', 'MAIN-STOCK')
                    """
                ),
                {"organization_id": organization["id"], "branch_id": branch["id"]},
            )
            await session.execute(
                text(
                    """
                    insert into public.units (organization_id, name, symbol, precision)
                    values (:organization_id, 'Piece', 'pcs', 0)
                    """
                ),
                {"organization_id": organization["id"]},
            )
            await session.execute(
                text(
                    """
                    insert into public.categories (organization_id, name, sort_order)
                    values (:organization_id, 'General', 0)
                    """
                ),
                {"organization_id": organization["id"]},
            )
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=409, detail="Organization slug or branch code already exists"
        ) from exc

    return {**dict(organization), "role": "owner", "main_branch": dict(branch)}


@router.get("/current")
async def get_current_organization(
    context: OrganizationContext = Depends(get_organization_context),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, object]:
    result = await session.execute(
        text(
            """
            select id, name, slug, business_type, logo_path, phone, email, address,
                   currency, language, timezone, settings
            from public.organizations where id = :organization_id and is_active
            """
        ),
        {"organization_id": context.organization_id},
    )
    row = result.mappings().one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Organization not found")
    return dict(row)
