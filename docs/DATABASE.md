# Database

Supabase migrations are the canonical schema. Application ORM migrations are intentionally absent to avoid competing histories.

## Tables

- Identity/tenant: `organizations`, `profiles`, `memberships`, `branches`, `warehouses`, `devices`, `licenses`.
- Catalog: `categories`, `brands`, `units`, `products`, `product_variants`.
- Inventory: `inventory_balances`, `stock_movements`.
- Sales/receivables: `customers`, `sales`, `sale_items`, `payments`, `customer_ledger_entries`.
- Purchasing/payables: `suppliers`, `purchases`, `purchase_items`, `supplier_ledger_entries`.
- Operations: `expenses`, `cashbook_entries`, `audit_logs`, `sync_events`, `outbox_events`.

All tenant-owned rows contain `organization_id`; branch-operational rows contain `branch_id`. UUIDs are primary keys, money uses `numeric(18,4)`, and mutable records use timezone-aware creation/update timestamps.

## Integrity rules

- Composite `(id, organization_id)` references prevent cross-tenant parent relationships.
- Sales totals, payment/due totals and purchase totals have database checks.
- A due sale requires a customer.
- Completed/returned/void sales and their line items cannot be updated or deleted.
- Stock movements, customer/supplier ledgers, cashbook and audit logs reject update/delete.
- `inventory_balances` is a projection updated by the stock-movement insert trigger.
- Ledger balances are calculated as ordered `sum(debit - credit)`; no editable balance column is authoritative.
- Sync idempotency is enforced by `(organization_id, device_id, client_event_id)`.
- License keys are stored as hashes, never plaintext.

## Reporting indexes

Indexes cover tenant/status catalog queries, branch/date sales and payments, customer/supplier histories, stock movements, audit timelines, sync versions and pending outbox work. Query plans must be reviewed with production-like volume before Phase 10.

## Future migrations

Phase-specific schemas extend this baseline through forward-only migrations. Sale completion, return/void, purchase receipt and ledger posting must use database transactions and server-owned procedures/services so all journal entries commit atomically.
