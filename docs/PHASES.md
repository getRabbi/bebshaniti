# Delivery phases

The production foundation and first operational web slice are implemented without simulated business data. This list tracks remaining depth across the full product roadmap.

1. **Auth, organizations, branches, staff and devices** — owner registration and atomic organization/main-branch onboarding are live; invitations and device activation remain.
2. **Catalog and inventory** — product creation, catalog reads, balances and audited adjustments are live; richer category/brand/variant editing remains.
3. **Sales** — server-calculated atomic sales, payments, stock movements, due posting, returns, voids and printable receipts are live; exchanges and richer credit-note workflows remain.
4. **Due/baki** — customer creation, balances and collection posting are live; statements and opening-balance approval remain.
5. **Suppliers/purchases** — receiving, payable ledger, payments and returns.
6. **Offline sync** — Flutter SQLite/Drift, outbox, bootstrap/pull/push, exact-once sale acceptance and conflict policy.
7. **Reports/monitoring** — live dashboard indicators are available; detailed sales, profit, due, payable, inventory, cash and audit exports remain.
8. **Wholesale/sourcing** — price groups, unit conversion, delivery and sourcing/outsourcing flows.
9. **Licensing/super admin** — activation, device/branch limits, module gates and merchant support console.
10. **Hardening/launch** — load and RLS tests, backups, monitoring, domains, compliance review and smoke tests.

## Recommended next phase

Add invitation acceptance, device activation and automated two-tenant isolation tests. Then complete supplier purchasing and payable workflows before public merchant rollout.
