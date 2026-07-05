# API

Base URL: `/api/v1`. OpenAPI is exposed at `/docs` outside production.

## Authentication and tenancy

Send `Authorization: Bearer <Supabase access token>`. Tenant endpoints also require `X-Organization-ID: <uuid>`. FastAPI verifies HS256 legacy tokens with the configured secret and RS256/ES256 tokens through the project JWKS endpoint. It then resolves an active membership; request bodies cannot override the tenant context.

## Live routes

| Method and route | Behavior |
|---|---|
| `GET /health` | Unauthenticated liveness response |
| `GET /auth/me` | Verified Supabase identity |
| `GET /organizations` | Organizations where the caller has active membership |
| `POST /organizations` | Atomic organization, main branch, stock point and owner onboarding |
| `GET /organizations/current` | Selected organization profile |
| `GET /branches` | Membership-scoped branches |
| `GET /products` | Searchable product/variant catalog |
| `GET /products/metadata` | Categories, brands and units |
| `POST /products` | Permission-checked product and default variant creation |
| `GET /inventory/balances` | Branch-aware inventory projection |
| `POST /inventory/adjustments` | Audited append-only stock adjustment |
| `GET /customers` | Customers with ledger-derived due balance |
| `POST /customers` | Customer creation |
| `GET /sales` | Branch-aware sales history |
| `POST /sales` | Atomic server-calculated sale, payment, stock, due and cashbook posting |
| `GET /due` | Outstanding customer balances |
| `POST /due/collections` | Atomic payment, ledger and cashbook collection posting |
| `GET /reports/dashboard` | Live sales, receivable and inventory indicators |

## Errors

Errors use `{ "error": { "code": "...", "message": "..." } }`. Stack traces, SQL, JWTs and credentials are never returned.

## Transaction guarantees

Sale totals and profit are recalculated server-side. Inventory, due and cash balances are posted through append-only movements and ledgers. Organization onboarding and all multi-ledger business mutations run in database transactions.
