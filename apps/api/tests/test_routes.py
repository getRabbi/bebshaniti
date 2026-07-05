from app.main import app


def test_production_routes_are_registered() -> None:
    routes = {
        (method, route.path) for route in app.routes for method in getattr(route, "methods", set())
    }
    expected = {
        ("GET", "/api/v1/product-master/search"),
        ("GET", "/api/v1/product-master/categories"),
        ("POST", "/api/v1/product-master/import"),
        ("GET", "/api/v1/reports/summary"),
        ("GET", "/api/v1/reports/sales"),
        ("GET", "/api/v1/reports/inventory"),
        ("GET", "/api/v1/reports/due"),
        ("GET", "/api/v1/reports/profit"),
        ("GET", "/api/v1/sales/{sale_id}/memo"),
    }
    assert expected <= routes
