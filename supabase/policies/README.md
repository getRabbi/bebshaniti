# RLS policy source

RLS policies are executable, ordered migrations in `../migrations/202607040005_rls_policies.sql` and storage policies are in `../migrations/202607040006_storage_policies.sql`.

This directory documents policy intent only. Do not apply ad-hoc SQL from this directory to production; all policy changes must be reviewed migrations.

- Organization membership is resolved from `auth.uid()` through security-definer helper functions with a fixed empty `search_path`.
- Owner and admin roles can cross branches inside their own organization.
- Other roles only access their assigned branch for branch-scoped tables.
- Financial ledgers, stock movements, audit logs, and cashbook records are append-only.
- Client roles have no direct mutation policy for canonical financial, inventory, sync, license, or outbox records.
- The Supabase service role bypasses RLS and must exist only in FastAPI/worker secret stores.
