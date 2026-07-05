begin;

create table public.licenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  plan_code text not null,
  license_key_hash text not null unique,
  license_type text not null check (license_type in ('internal_beta', 'lifetime', 'per_device', 'per_branch')),
  max_branches integer not null default 1 check (max_branches > 0),
  max_devices integer not null default 1 check (max_devices > 0),
  modules jsonb not null default '[]'::jsonb check (jsonb_typeof(modules) = 'array'),
  activated_at timestamptz,
  expires_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'active', 'suspended', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  check (expires_at is null or activated_at is null or expires_at > activated_at)
);

create index memberships_user_active_idx on public.memberships (user_id, organization_id) where status = 'active';
create index memberships_org_branch_idx on public.memberships (organization_id, branch_id, role);
create index branches_org_active_idx on public.branches (organization_id, is_active);
create index warehouses_org_branch_idx on public.warehouses (organization_id, branch_id);
create index devices_org_branch_status_idx on public.devices (organization_id, branch_id, status);
create index categories_org_parent_idx on public.categories (organization_id, parent_id);
create index products_org_status_idx on public.products (organization_id, status);
create index products_org_category_idx on public.products (organization_id, category_id);
create index product_variants_org_product_idx on public.product_variants (organization_id, product_id);
create index customers_org_branch_name_idx on public.customers (organization_id, branch_id, name);
create index suppliers_org_branch_name_idx on public.suppliers (organization_id, branch_id, name);
create index sales_org_branch_sold_idx on public.sales (organization_id, branch_id, sold_at desc);
create index sales_org_customer_idx on public.sales (organization_id, customer_id, sold_at desc);
create index sale_items_org_sale_idx on public.sale_items (organization_id, sale_id);
create index payments_org_paid_idx on public.payments (organization_id, branch_id, paid_at desc);
create index payments_org_customer_idx on public.payments (organization_id, customer_id, paid_at desc);
create index inventory_balances_org_variant_idx on public.inventory_balances (organization_id, product_variant_id);
create index stock_movements_org_variant_created_idx on public.stock_movements (organization_id, product_variant_id, created_at desc);
create index stock_movements_org_branch_created_idx on public.stock_movements (organization_id, branch_id, created_at desc);
create index customer_ledger_org_customer_created_idx on public.customer_ledger_entries (organization_id, customer_id, created_at, id);
create index purchases_org_branch_created_idx on public.purchases (organization_id, branch_id, created_at desc);
create index purchases_org_supplier_idx on public.purchases (organization_id, supplier_id, created_at desc);
create index purchase_items_org_purchase_idx on public.purchase_items (organization_id, purchase_id);
create index supplier_ledger_org_supplier_created_idx on public.supplier_ledger_entries (organization_id, supplier_id, created_at, id);
create index expenses_org_branch_incurred_idx on public.expenses (organization_id, branch_id, incurred_at desc);
create index cashbook_org_branch_occurred_idx on public.cashbook_entries (organization_id, branch_id, occurred_at desc);
create index audit_logs_org_created_idx on public.audit_logs (organization_id, created_at desc);
create index audit_logs_org_entity_idx on public.audit_logs (organization_id, entity_type, entity_id);
create index sync_events_org_version_idx on public.sync_events (organization_id, server_version);
create index outbox_pending_idx on public.outbox_events (status, available_at) where status in ('pending', 'failed');

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'organizations', 'profiles', 'branches', 'warehouses', 'memberships', 'devices',
    'categories', 'brands', 'units', 'products', 'product_variants', 'customers',
    'suppliers', 'sales', 'sale_items', 'payments', 'inventory_balances',
    'purchases', 'purchase_items', 'expenses', 'licenses', 'sync_events', 'outbox_events'
  ] loop
    execute format(
      'create trigger %I_set_updated_at before update on public.%I for each row execute function app_private.set_updated_at()',
      table_name, table_name
    );
  end loop;
end;
$$;

create trigger sales_protect_completed
before update or delete on public.sales
for each row execute function app_private.protect_completed_sale();

create trigger sale_items_protect_completed
before insert or update or delete on public.sale_items
for each row
execute function app_private.protect_completed_sale_child();

create trigger stock_movements_apply_balance
after insert on public.stock_movements
for each row execute function app_private.apply_stock_movement();

create trigger inventory_balances_projection_only
before insert or update or delete on public.inventory_balances
for each row execute function app_private.protect_inventory_balance();

create trigger stock_movements_append_only
before update or delete on public.stock_movements
for each row execute function app_private.reject_mutation();
create trigger payments_append_only
before update or delete on public.payments
for each row execute function app_private.reject_mutation();
create trigger customer_ledger_append_only
before update or delete on public.customer_ledger_entries
for each row execute function app_private.reject_mutation();
create trigger supplier_ledger_append_only
before update or delete on public.supplier_ledger_entries
for each row execute function app_private.reject_mutation();
create trigger cashbook_append_only
before update or delete on public.cashbook_entries
for each row execute function app_private.reject_mutation();
create trigger audit_logs_append_only
before update or delete on public.audit_logs
for each row execute function app_private.reject_mutation();

create trigger on_auth_user_created
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function app_private.handle_new_auth_user();

create trigger memberships_audit
after insert or update or delete on public.memberships
for each row execute function app_private.write_audit_log();
create trigger devices_audit
after insert or update or delete on public.devices
for each row execute function app_private.write_audit_log();
create trigger products_audit
after insert or update or delete on public.products
for each row execute function app_private.write_audit_log();
create trigger product_variants_audit
after insert or update or delete on public.product_variants
for each row execute function app_private.write_audit_log();
create trigger sales_audit
after insert or update or delete on public.sales
for each row execute function app_private.write_audit_log();
create trigger payments_audit
after insert on public.payments
for each row execute function app_private.write_audit_log();
create trigger stock_movements_audit
after insert on public.stock_movements
for each row execute function app_private.write_audit_log();
create trigger customer_ledger_audit
after insert on public.customer_ledger_entries
for each row execute function app_private.write_audit_log();
create trigger purchases_audit
after insert or update or delete on public.purchases
for each row execute function app_private.write_audit_log();
create trigger supplier_ledger_audit
after insert on public.supplier_ledger_entries
for each row execute function app_private.write_audit_log();
create trigger expenses_audit
after insert or update or delete on public.expenses
for each row execute function app_private.write_audit_log();
create trigger licenses_audit
after insert or update or delete on public.licenses
for each row execute function app_private.write_audit_log();

commit;
