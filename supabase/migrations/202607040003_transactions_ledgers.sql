begin;

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null,
  customer_id uuid,
  invoice_no text not null,
  sale_type text not null default 'retail' check (sale_type in ('retail', 'wholesale')),
  status public.sale_status not null default 'draft',
  subtotal numeric(18,4) not null default 0 check (subtotal >= 0),
  discount_total numeric(18,4) not null default 0 check (discount_total >= 0),
  vat_total numeric(18,4) not null default 0 check (vat_total >= 0),
  grand_total numeric(18,4) not null default 0 check (grand_total >= 0),
  paid_total numeric(18,4) not null default 0 check (paid_total >= 0),
  due_total numeric(18,4) not null default 0 check (due_total >= 0),
  profit_total numeric(18,4) not null default 0,
  cashier_id uuid not null references public.profiles(id) on delete restrict,
  sold_at timestamptz,
  synced_from_device_id uuid,
  offline_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (id, organization_id, branch_id),
  unique (organization_id, invoice_no),
  foreign key (branch_id, organization_id)
    references public.branches (id, organization_id) on delete restrict,
  foreign key (customer_id, organization_id)
    references public.customers (id, organization_id) on delete restrict,
  foreign key (synced_from_device_id, organization_id)
    references public.devices (id, organization_id) on delete restrict,
  check (grand_total = subtotal - discount_total + vat_total),
  check (paid_total + due_total = grand_total),
  check (due_total = 0 or customer_id is not null),
  check ((status = 'completed' and sold_at is not null) or status <> 'completed')
);

create unique index sales_org_offline_id_idx
  on public.sales (organization_id, offline_id) where offline_id is not null;

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null,
  sale_id uuid not null,
  product_variant_id uuid not null,
  unit_id uuid,
  description text not null,
  quantity numeric(18,4) not null check (quantity > 0),
  unit_price numeric(18,4) not null check (unit_price >= 0),
  purchase_cost numeric(18,4) not null default 0 check (purchase_cost >= 0),
  discount numeric(18,4) not null default 0 check (discount >= 0),
  vat_rate numeric(7,4) not null default 0 check (vat_rate between 0 and 100),
  line_total numeric(18,4) not null check (line_total >= 0),
  serials jsonb,
  batch_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (sale_id, organization_id)
    references public.sales (id, organization_id) on delete restrict,
  foreign key (sale_id, organization_id, branch_id)
    references public.sales (id, organization_id, branch_id) on delete restrict,
  foreign key (product_variant_id, organization_id)
    references public.product_variants (id, organization_id) on delete restrict,
  foreign key (unit_id, organization_id)
    references public.units (id, organization_id) on delete restrict,
  foreign key (branch_id, organization_id)
    references public.branches (id, organization_id) on delete restrict
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null,
  payment_type text not null check (payment_type in ('sale_payment', 'due_collection', 'supplier_payment', 'refund')),
  method text not null check (method in ('cash', 'bkash', 'nagad', 'rocket', 'bank', 'card', 'cheque')),
  amount numeric(18,4) not null check (amount > 0),
  reference_no text,
  sale_id uuid,
  customer_id uuid,
  supplier_id uuid,
  paid_at timestamptz not null default now(),
  received_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (branch_id, organization_id)
    references public.branches (id, organization_id) on delete restrict,
  foreign key (sale_id, organization_id)
    references public.sales (id, organization_id) on delete restrict,
  foreign key (sale_id, organization_id, branch_id)
    references public.sales (id, organization_id, branch_id) on delete restrict,
  foreign key (customer_id, organization_id)
    references public.customers (id, organization_id) on delete restrict,
  foreign key (supplier_id, organization_id)
    references public.suppliers (id, organization_id) on delete restrict
);

create table public.inventory_balances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null,
  warehouse_id uuid,
  product_variant_id uuid not null,
  quantity numeric(18,4) not null default 0,
  avg_cost numeric(18,4) not null default 0 check (avg_cost >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (organization_id, branch_id, warehouse_id, product_variant_id),
  unique (id, organization_id),
  unique (id, organization_id, branch_id),
  foreign key (branch_id, organization_id)
    references public.branches (id, organization_id) on delete restrict,
  foreign key (warehouse_id, organization_id)
    references public.warehouses (id, organization_id) on delete restrict,
  foreign key (product_variant_id, organization_id)
    references public.product_variants (id, organization_id) on delete restrict
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null,
  warehouse_id uuid,
  product_variant_id uuid not null,
  movement_type text not null check (movement_type in ('opening', 'sale', 'sale_return', 'purchase', 'purchase_return', 'adjustment', 'transfer_in', 'transfer_out', 'damage', 'loss')),
  quantity_change numeric(18,4) not null check (quantity_change <> 0),
  unit_cost numeric(18,4) check (unit_cost >= 0),
  reference_type text not null,
  reference_id uuid,
  note text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (branch_id, organization_id)
    references public.branches (id, organization_id) on delete restrict,
  foreign key (warehouse_id, organization_id)
    references public.warehouses (id, organization_id) on delete restrict,
  foreign key (product_variant_id, organization_id)
    references public.product_variants (id, organization_id) on delete restrict
);

create table public.customer_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null,
  customer_id uuid not null,
  entry_type text not null check (entry_type in ('opening', 'sale_due', 'payment', 'return', 'adjustment', 'writeoff')),
  debit numeric(18,4) not null default 0 check (debit >= 0),
  credit numeric(18,4) not null default 0 check (credit >= 0),
  reference_type text not null,
  reference_id uuid,
  note text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (branch_id, organization_id)
    references public.branches (id, organization_id) on delete restrict,
  foreign key (customer_id, organization_id)
    references public.customers (id, organization_id) on delete restrict,
  check ((debit > 0 and credit = 0) or (credit > 0 and debit = 0))
);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null,
  warehouse_id uuid,
  supplier_id uuid not null,
  purchase_no text not null,
  status public.purchase_status not null default 'draft',
  expected_date date,
  received_at timestamptz,
  subtotal numeric(18,4) not null default 0 check (subtotal >= 0),
  discount_total numeric(18,4) not null default 0 check (discount_total >= 0),
  expense_total numeric(18,4) not null default 0 check (expense_total >= 0),
  grand_total numeric(18,4) not null default 0 check (grand_total >= 0),
  paid_total numeric(18,4) not null default 0 check (paid_total >= 0),
  payable_total numeric(18,4) not null default 0 check (payable_total >= 0),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (id, organization_id, branch_id),
  unique (organization_id, purchase_no),
  foreign key (branch_id, organization_id)
    references public.branches (id, organization_id) on delete restrict,
  foreign key (warehouse_id, organization_id)
    references public.warehouses (id, organization_id) on delete restrict,
  foreign key (supplier_id, organization_id)
    references public.suppliers (id, organization_id) on delete restrict,
  check (grand_total = subtotal - discount_total + expense_total),
  check (paid_total + payable_total = grand_total)
);

create table public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null,
  purchase_id uuid not null,
  product_variant_id uuid not null,
  quantity_ordered numeric(18,4) not null check (quantity_ordered > 0),
  quantity_received numeric(18,4) not null default 0 check (quantity_received >= 0),
  unit_cost numeric(18,4) not null check (unit_cost >= 0),
  line_total numeric(18,4) not null check (line_total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (branch_id, organization_id)
    references public.branches (id, organization_id) on delete restrict,
  foreign key (purchase_id, organization_id)
    references public.purchases (id, organization_id) on delete restrict,
  foreign key (purchase_id, organization_id, branch_id)
    references public.purchases (id, organization_id, branch_id) on delete restrict,
  foreign key (product_variant_id, organization_id)
    references public.product_variants (id, organization_id) on delete restrict,
  check (quantity_received <= quantity_ordered)
);

create table public.supplier_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null,
  supplier_id uuid not null,
  entry_type text not null check (entry_type in ('opening', 'purchase_payable', 'payment', 'return', 'adjustment', 'writeoff')),
  debit numeric(18,4) not null default 0 check (debit >= 0),
  credit numeric(18,4) not null default 0 check (credit >= 0),
  reference_type text not null,
  reference_id uuid,
  note text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (branch_id, organization_id)
    references public.branches (id, organization_id) on delete restrict,
  foreign key (supplier_id, organization_id)
    references public.suppliers (id, organization_id) on delete restrict,
  check ((debit > 0 and credit = 0) or (credit > 0 and debit = 0))
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null,
  category text not null,
  description text not null,
  amount numeric(18,4) not null check (amount > 0),
  payment_method text not null check (payment_method in ('cash', 'bkash', 'nagad', 'rocket', 'bank', 'card', 'cheque')),
  reference_no text,
  incurred_at timestamptz not null default now(),
  status text not null default 'posted' check (status in ('draft', 'posted', 'void')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (branch_id, organization_id)
    references public.branches (id, organization_id) on delete restrict
);

create table public.cashbook_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null,
  entry_type text not null check (entry_type in ('sale', 'due_collection', 'supplier_payment', 'expense', 'cash_in', 'cash_out', 'refund', 'owner_withdrawal')),
  direction text not null check (direction in ('in', 'out')),
  amount numeric(18,4) not null check (amount > 0),
  method text not null check (method in ('cash', 'bkash', 'nagad', 'rocket', 'bank', 'card', 'cheque')),
  reference_type text not null,
  reference_id uuid,
  note text,
  occurred_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (branch_id, organization_id)
    references public.branches (id, organization_id) on delete restrict
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid,
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  ip_address inet,
  user_agent text,
  device_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (branch_id, organization_id)
    references public.branches (id, organization_id) on delete restrict,
  foreign key (device_id, organization_id)
    references public.devices (id, organization_id) on delete restrict
);

create table public.sync_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null,
  device_id uuid not null,
  client_event_id text not null,
  entity_type text not null,
  entity_id uuid not null,
  operation text not null check (operation in ('create', 'update', 'void', 'return')),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  server_version bigint generated always as identity,
  status text not null default 'accepted' check (status in ('accepted', 'processed', 'rejected')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, device_id, client_event_id),
  foreign key (branch_id, organization_id)
    references public.branches (id, organization_id) on delete restrict,
  foreign key (device_id, organization_id)
    references public.devices (id, organization_id) on delete restrict
);

create table public.outbox_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid,
  event_type text not null,
  aggregate_type text not null,
  aggregate_id uuid not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  status text not null default 'pending' check (status in ('pending', 'processing', 'delivered', 'failed', 'dead_letter')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (branch_id, organization_id)
    references public.branches (id, organization_id) on delete restrict
);

commit;
