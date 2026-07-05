from app.core.config import get_settings
from app.main import app


def test_production_routes_are_registered() -> None:
    prefix = get_settings().api_v1_prefix.rstrip("/")
    routes = {
        (method, route.path) for route in app.routes for method in getattr(route, "methods", set())
    }
    expected = {
        ("GET", f"{prefix}/product-master/search"),
        ("GET", f"{prefix}/product-master/categories"),
        ("POST", f"{prefix}/product-master/import"),
        ("GET", f"{prefix}/reports/summary"),
        ("GET", f"{prefix}/reports/sales"),
        ("GET", f"{prefix}/reports/inventory"),
        ("GET", f"{prefix}/reports/due"),
        ("GET", f"{prefix}/reports/profit"),
        ("GET", f"{prefix}/sales/{{sale_id}}/memo"),
    }
    assert expected <= routes
