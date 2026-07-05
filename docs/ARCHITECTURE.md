# Architecture

The root architecture source is `bangladesh_retail_wholesale_production_supabase_vercel_architecture.md`. This document records the Phase 0 implementation boundary.

## Runtime topology

```text
yourdomain.com        -> Vercel project: apps/landing
app.yourdomain.com    -> Vercel project: apps/web_admin
api.yourdomain.com    -> container host: apps/api
Supabase              -> Auth + PostgreSQL + RLS + private Storage
Flutter POS           -> Supabase Auth + FastAPI; local database arrives in Phase 6
GitHub                -> source, review gates and CI
```

Clients authenticate through Supabase Auth. They send the access token to FastAPI. FastAPI verifies the JWT signature, issuer, audience, expiry and subject, then resolves an active membership for the requested `X-Organization-ID`. Browser-side Supabase access remains protected independently by PostgreSQL RLS.

## Trust boundaries

- Landing is public and contains no privileged credentials.
- Admin and POS use only Supabase publishable/anon keys.
- FastAPI and future workers may hold the service-role key and database URL.
- All API business queries must include `organization_id`; branch queries also include `branch_id`.
- Database composite foreign keys prevent a row from referencing an entity in another organization.
- Canonical stock, due, supplier payable, cashbook and audit records are append-only.

## Phase 0 behavior

Health and authenticated identity endpoints are live. Later business routes exist behind JWT and tenant resolution but respond `501` until their named implementation phase. This is deliberate: no empty arrays or generated figures impersonate real production behavior.

## Deployment independence

Admin and landing are separate Next.js projects so they can have separate Vercel environment scopes, domains, logs and rollbacks. FastAPI remains a container because future sync, Redis and worker operations are unsuitable for a purely serverless lifecycle.
