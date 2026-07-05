# Security

## Tenant isolation

Isolation is enforced twice: FastAPI scopes every query to resolved membership context and PostgreSQL RLS protects direct Supabase access. Composite tenant foreign keys block cross-organization references even if application validation fails.

## Credentials

- Browser/Flutter: Supabase anon/publishable key only.
- FastAPI/worker: service-role key and database URL in a managed secret store.
- Prefer JWKS token verification; if a legacy JWT secret is necessary, rotate and restrict it as a production secret.
- Never log authorization headers, refresh tokens, passwords, database URLs or service keys.

## Authorization

Authentication does not grant tenant access. An active `memberships` row is mandatory. Owner/admin are organization-wide; staff are branch-scoped. Endpoint permission dependencies supplement roles for actions such as discounts, returns, write-offs, exports and staff management.

## Data invariants

Completed sales are immutable. Returns/voids must post compensating documents. Customer and supplier balances derive from append-only entries. Stock derives from movements. Sensitive table changes emit audit rows. Client roles cannot directly mutate canonical financial/inventory journals.

## Launch controls still required

- RLS integration tests with two organizations and multiple branches.
- Rate limiting and abuse controls on auth and API routes.
- MFA/admin session policy, password breach protection and account recovery review.
- Sentry or equivalent with PII scrubbing; centralized structured logs and alerting.
- Dependency, container and secret scanning; SBOM and image provenance.
- Backup restoration drill, incident response runbook and key rotation process.
- Legal/privacy review and Bangladesh VAT/invoice consultation.

## Security review checklist

Any migration must answer: Is RLS enabled? Are all policies tenant-scoped? Can a foreign key cross tenants? Can a completed journal be altered? Does a new storage path expose another organization? Any server use of service role must bind organization/branch explicitly and write an audit record where material.
