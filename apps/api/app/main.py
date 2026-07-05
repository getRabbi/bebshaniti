from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.errors import register_error_handlers
from app.core.logging import configure_logging
from app.modules.auth.router import router as auth_router
from app.modules.branches.router import router as branches_router
from app.modules.customers.router import router as customers_router
from app.modules.due.router import router as due_router
from app.modules.health.router import router as health_router
from app.modules.inventory.router import router as inventory_router
from app.modules.organizations.router import router as organizations_router
from app.modules.product_master.router import router as product_master_router
from app.modules.products.router import router as products_router
from app.modules.reports.router import router as reports_router
from app.modules.sales.router import router as sales_router

settings = get_settings()
configure_logging(settings)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    yield


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    docs_url="/docs" if settings.app_env != "production" else None,
    redoc_url=None,
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Organization-ID", "X-Request-ID"],
)
register_error_handlers(app)

for api_router in (
    health_router,
    auth_router,
    organizations_router,
    branches_router,
    products_router,
    product_master_router,
    inventory_router,
    customers_router,
    sales_router,
    due_router,
    reports_router,
):
    app.include_router(api_router, prefix=settings.api_v1_prefix)
