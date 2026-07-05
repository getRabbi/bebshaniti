# Supabase setup

## Hosted projects

Create separate Supabase projects for staging and production. Record each project ref and region in the password manager/operations inventory. Enable MFA for administrators and restrict dashboard membership.

Login and link only from a trusted operator machine:

```powershell
supabase login
supabase link --project-ref <project-ref>
supabase db push --dry-run
supabase db push
```

Review the dry run and a database backup before production push. Never put access tokens, database passwords, project refs with secrets, or keys in Git.

## Auth configuration

In Authentication settings:

- Set production Site URL to `https://app.yourdomain.com`.
- Add exact staging and production callback URLs. Avoid broad production wildcards.
- Require email confirmation and strong passwords; add MFA in the hardening phase.
- Keep anonymous sign-in disabled.
- Prefer Supabase JWKS verification. Configure `SUPABASE_JWKS_URL`; use the legacy JWT secret only for legacy HS256 projects.
- Add `http://localhost:3000` redirects only to local project configuration.

## Migrations

The ordered SQL files create extensions/types/helpers, identity and catalog tables, transaction/ledger tables, indexes/guards, RLS, then storage policies. Apply them only via Supabase CLI so migration history is recorded.

Local reset:

```powershell
supabase db reset
supabase db lint --local --level warning
```

Generate future changes with `supabase migration new <name>`. Do not edit a migration already applied to shared staging or production; add a forward migration.

## RLS model

Every exposed application table has RLS enabled. Security-definer helper functions have an empty `search_path` and check `auth.uid()` against active memberships. Owner/admin roles can access all branches inside their organization; other roles require the assigned branch. Canonical financial and inventory tables have no client mutation policies.

The service role bypasses RLS. It belongs only in FastAPI/worker secret stores and must never appear in Vercel public variables, browser bundles, Flutter dart-defines, logs or support screenshots.

## Storage

Migrations create private buckets:

- `product-media` — 5 MiB images.
- `organization-assets` — 5 MiB brand assets.
- `private-documents` — 10 MiB invoices/statements, server-write only.

Object paths start with the organization UUID: `<organization_id>/<resource>/<file>`. RLS derives tenant scope from that first segment. Use signed URLs for external sharing and short expirations for financial documents.

## Local versus production

Local Supabase uses `supabase/config.toml` and `supabase/seed/local.sql`. The seed is intentionally empty and must never be pushed as production business data. Hosted secrets are configured in the API host and Vercel dashboards, not copied from local `.env` files.

## Backups and recovery

Enable the Supabase plan's point-in-time recovery or scheduled backups before onboarding. Schedule encrypted logical exports for business continuity, document restore ownership, and test restoration into an isolated project before launch.
