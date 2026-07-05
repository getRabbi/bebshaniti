# API

Base URL: `/api/v1`. OpenAPI is exposed at `/docs` outside production.

## Authentication and tenancy

Send `Authorization: Bearer <Supabase access token>`. Tenant endpoints also require `X-Organization-ID: <uuid>`. FastAPI verifies HS256 legacy tokens with the configured secret and RS256/ES256 tokens through the project JWKS endpoint. It then resolves an active membership; request bodies cannot override the tenant context.

## Live routes

| Method and route                  | Behavior                                                                |
| --------------------------------- | ----------------------------------------------------------------------- |
| `GET /health`                     | Unauthenticated liveness response                                       |
| `GET /auth/me`                    | Verified Supabase identity                                              |
| `GET /organizations`              | Organizations where the caller has active membership                    |
| `POST /organizations`             | Atomic organization, main branch, stock point and owner onboarding      |
| `GET /organizations/current`      | Selected organization profile, role and effective permissions           |
| `GET /branches`                   | Membership-scoped branches                                              |
| `GET /products`                   | Searchable product/variant catalog                                      |
| `GET /products/metadata`          | Categories, brands and units                                            |
| `POST /products`                  | Permission-checked product and default variant creation                 |
| `PATCH /products/{id}/image`      | Persist or remove a tenant-scoped private product image path            |
| `POST /products/import/preview`   | Validate CSV/XLSX and return row-level preview/errors                   |
| `POST /products/import/commit`    | Owner/admin/manager product import in create/skip/update mode           |
| `GET /products/import/sample.csv` | Authenticated sample import template                                    |
| `GET /inventory/balances`         | Branch-aware inventory projection                                       |
| `POST /inventory/adjustments`     | Audited append-only stock adjustment                                    |
| `GET /customers`                  | Customers with ledger-derived due balance                               |
| `POST /customers`                 | Customer creation                                                       |
| `GET /customers/{id}/statement`   | Date-filtered due ledger, opening balance, sales and collections        |
| `GET /sales`                      | Branch-aware sales history                                              |
| `POST /sales`                     | Atomic server-calculated sale, payment, stock, due and cashbook posting |
| `POST /sales/{id}/returns`        | Append-only item return with stock and financial reversals              |
| `POST /sales/{id}/void`           | Append-only full void with stock and financial reversals                |
| `GET /due`                        | Outstanding customer balances                                           |
| `POST /due/collections`           | Atomic payment, ledger and cashbook collection posting                  |
| `GET /reports/dashboard`          | Live sales, receivable and inventory indicators                         |
| `GET /reports/sales`              | Filtered sales, payment and best-seller report                          |
| `GET /reports/inventory`          | Branch-filtered inventory value and low-stock report                    |
| `GET /reports/due`                | Branch-filtered receivable report                                       |
| `GET /reports/profit`             | Filtered net sales and profit summary                                   |
| `GET /audit-logs`                 | Owner/admin metadata-only audit log viewer feed                         |

## Errors

Errors use `{ "error": { "code": "...", "message": "..." } }`. Stack traces, SQL, JWTs and credentials are never returned.

## Transaction guarantees

Sale totals and profit are recalculated server-side. Inventory, due and cash balances are posted through append-only movements and ledgers. Organization onboarding and all multi-ledger business mutations run in database transactions.
