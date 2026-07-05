begin;

create or replace function app_private.is_org_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.organization_id = target_organization_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function app_private.has_org_role(
  target_organization_id uuid,
  allowed_roles public.app_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.organization_id = target_organization_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role = any(allowed_roles)
  );
$$;

create or replace function app_private.can_access_branch(
  target_organization_id uuid,
  target_branch_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.organization_id = target_organization_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and (m.role in ('owner', 'admin') or m.branch_id = target_branch_id)
  );
$$;

create or replace function app_private.can_view_profile(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_user_id = auth.uid() or exists (
    select 1
    from public.memberships mine
    join public.memberships theirs
      on theirs.organization_id = mine.organization_id
     and theirs.user_id = target_user_id
     and theirs.status = 'active'
    where mine.user_id = auth.uid()
      and mine.status = 'active'
  );
$$;

revoke all on function app_private.is_org_member(uuid) from public;
revoke all on function app_private.has_org_role(uuid, public.app_role[]) from public;
revoke all on function app_private.can_access_branch(uuid, uuid) from public;
revoke all on function app_private.can_view_profile(uuid) from public;
revoke all on function app_private.try_uuid(text) from public;
grant usage on schema app_private to authenticated;
grant execute on function app_private.is_org_member(uuid) to authenticated;
grant execute on function app_private.has_org_role(uuid, public.app_role[]) to authenticated;
grant execute on function app_private.can_access_branch(uuid, uuid) to authenticated;
grant execute on function app_private.can_view_profile(uuid) to authenticated;
grant execute on function app_private.try_uuid(text) to authenticated;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.branches enable row level security;
alter table public.warehouses enable row level security;
alter table public.memberships enable row level security;
alter table public.devices enable row level security;
alter table public.categories enable row level security;
alter table public.brands enable row level security;
alter table public.units enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.customers enable row level security;
alter table public.suppliers enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.payments enable row level security;
alter table public.inventory_balances enable row level security;
alter table public.stock_movements enable row level security;
alter table public.customer_ledger_entries enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.supplier_ledger_entries enable row level security;
alter table public.expenses enable row level security;
alter table public.cashbook_entries enable row level security;
alter table public.audit_logs enable row level security;
alter table public.sync_events enable row level security;
alter table public.outbox_events enable row level security;
alter table public.licenses enable row level security;

create policy organizations_select_member on public.organizations
for select to authenticated
using (app_private.is_org_member(id));
create policy organizations_update_admin on public.organizations
for update to authenticated
using (app_private.has_org_role(id, array['owner', 'admin']::public.app_role[]))
with check (app_private.has_org_role(id, array['owner', 'admin']::public.app_role[]));

create policy profiles_select_peers on public.profiles
for select to authenticated
using (app_private.can_view_profile(id));
create policy profiles_update_self on public.profiles
for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());

create policy memberships_select_member on public.memberships
for select to authenticated
using (app_private.is_org_member(organization_id));
create policy memberships_insert_admin on public.memberships
for insert to authenticated
with check (app_private.has_org_role(organization_id, array['owner', 'admin']::public.app_role[]));
create policy memberships_update_admin on public.memberships
for update to authenticated
using (app_private.has_org_role(organization_id, array['owner', 'admin']::public.app_role[]))
with check (app_private.has_org_role(organization_id, array['owner', 'admin']::public.app_role[]));

create policy branches_select_member on public.branches
for select to authenticated using (app_private.can_access_branch(organization_id, id));
create policy branches_insert_admin on public.branches
for insert to authenticated
with check (app_private.has_org_role(organization_id, array['owner', 'admin']::public.app_role[]));
create policy branches_update_admin on public.branches
for update to authenticated
using (app_private.has_org_role(organization_id, array['owner', 'admin']::public.app_role[]))
with check (app_private.has_org_role(organization_id, array['owner', 'admin']::public.app_role[]));

create policy warehouses_select_member on public.warehouses
for select to authenticated using (
  (branch_id is null and app_private.has_org_role(organization_id, array['owner', 'admin']::public.app_role[]))
  or app_private.can_access_branch(organization_id, branch_id)
);
create policy warehouses_insert_manager on public.warehouses
for insert to authenticated
with check (app_private.has_org_role(organization_id, array['owner', 'admin', 'inventory_manager']::public.app_role[]));
create policy warehouses_update_manager on public.warehouses
for update to authenticated
using (app_private.has_org_role(organization_id, array['owner', 'admin', 'inventory_manager']::public.app_role[]))
with check (app_private.has_org_role(organization_id, array['owner', 'admin', 'inventory_manager']::public.app_role[]));

create policy devices_select_branch on public.devices
for select to authenticated
using (app_private.can_access_branch(organization_id, branch_id));
create policy devices_insert_self on public.devices
for insert to authenticated
with check (user_id = auth.uid() and app_private.can_access_branch(organization_id, branch_id));
create policy devices_update_self_or_admin on public.devices
for update to authenticated
using (user_id = auth.uid() or app_private.has_org_role(organization_id, array['owner', 'admin']::public.app_role[]))
with check (user_id = auth.uid() or app_private.has_org_role(organization_id, array['owner', 'admin']::public.app_role[]));

do $$
declare
  table_name text;
begin
  foreach table_name in array array['categories', 'brands', 'units', 'products', 'product_variants'] loop
    execute format(
      'create policy %I_select_member on public.%I for select to authenticated using (app_private.is_org_member(organization_id))',
      table_name, table_name
    );
    execute format(
      'create policy %I_insert_catalog_manager on public.%I for insert to authenticated with check (app_private.has_org_role(organization_id, array[''owner'', ''admin'', ''branch_manager'', ''inventory_manager'']::public.app_role[]))',
      table_name, table_name
    );
    execute format(
      'create policy %I_update_catalog_manager on public.%I for update to authenticated using (app_private.has_org_role(organization_id, array[''owner'', ''admin'', ''branch_manager'', ''inventory_manager'']::public.app_role[])) with check (app_private.has_org_role(organization_id, array[''owner'', ''admin'', ''branch_manager'', ''inventory_manager'']::public.app_role[]))',
      table_name, table_name
    );
  end loop;
end;
$$;

create policy customers_select_branch on public.customers
for select to authenticated
using (branch_id is null and app_private.is_org_member(organization_id) or app_private.can_access_branch(organization_id, branch_id));
create policy customers_insert_staff on public.customers
for insert to authenticated
with check (branch_id is not null and app_private.can_access_branch(organization_id, branch_id));
create policy customers_update_staff on public.customers
for update to authenticated
using (branch_id is not null and app_private.can_access_branch(organization_id, branch_id))
with check (branch_id is not null and app_private.can_access_branch(organization_id, branch_id));

create policy suppliers_select_branch on public.suppliers
for select to authenticated
using (branch_id is null and app_private.is_org_member(organization_id) or app_private.can_access_branch(organization_id, branch_id));
create policy suppliers_insert_manager on public.suppliers
for insert to authenticated
with check (app_private.has_org_role(organization_id, array['owner', 'admin', 'purchase_manager']::public.app_role[]));
create policy suppliers_update_manager on public.suppliers
for update to authenticated
using (app_private.has_org_role(organization_id, array['owner', 'admin', 'purchase_manager']::public.app_role[]))
with check (app_private.has_org_role(organization_id, array['owner', 'admin', 'purchase_manager']::public.app_role[]));

create policy sales_select_branch on public.sales
for select to authenticated using (app_private.can_access_branch(organization_id, branch_id));
create policy sales_insert_draft on public.sales
for insert to authenticated
with check (
  status in ('draft', 'held') and cashier_id = auth.uid()
  and app_private.can_access_branch(organization_id, branch_id)
);
create policy sales_update_draft on public.sales
for update to authenticated
using (status in ('draft', 'held') and app_private.can_access_branch(organization_id, branch_id))
with check (status in ('draft', 'held') and app_private.can_access_branch(organization_id, branch_id));
create policy sales_delete_draft on public.sales
for delete to authenticated
using (status in ('draft', 'held') and app_private.can_access_branch(organization_id, branch_id));

create policy sale_items_select_branch on public.sale_items
for select to authenticated using (app_private.can_access_branch(organization_id, branch_id));
create policy sale_items_insert_draft on public.sale_items
for insert to authenticated
with check (
  app_private.can_access_branch(organization_id, branch_id)
  and exists (select 1 from public.sales s where s.id = sale_id and s.organization_id = organization_id and s.status in ('draft', 'held'))
);
create policy sale_items_update_draft on public.sale_items
for update to authenticated
using (
  app_private.can_access_branch(organization_id, branch_id)
  and exists (select 1 from public.sales s where s.id = sale_id and s.organization_id = organization_id and s.status in ('draft', 'held'))
)
with check (
  app_private.can_access_branch(organization_id, branch_id)
  and exists (select 1 from public.sales s where s.id = sale_id and s.organization_id = organization_id and s.status in ('draft', 'held'))
);
create policy sale_items_delete_draft on public.sale_items
for delete to authenticated
using (
  app_private.can_access_branch(organization_id, branch_id)
  and exists (select 1 from public.sales s where s.id = sale_id and s.organization_id = organization_id and s.status in ('draft', 'held'))
);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'payments', 'inventory_balances', 'stock_movements', 'customer_ledger_entries',
    'purchases', 'purchase_items', 'supplier_ledger_entries', 'expenses', 'cashbook_entries'
  ] loop
    execute format(
      'create policy %I_select_branch on public.%I for select to authenticated using (app_private.can_access_branch(organization_id, branch_id))',
      table_name, table_name
    );
  end loop;
end;
$$;

create policy audit_logs_select_auditor on public.audit_logs
for select to authenticated
using (app_private.has_org_role(organization_id, array['owner', 'admin', 'auditor']::public.app_role[]));

create policy sync_events_select_device on public.sync_events
for select to authenticated
using (
  app_private.can_access_branch(organization_id, branch_id)
  and exists (select 1 from public.devices d where d.id = device_id and d.user_id = auth.uid() and d.status = 'active')
);

create policy licenses_select_admin on public.licenses
for select to authenticated
using (app_private.has_org_role(organization_id, array['owner', 'admin']::public.app_role[]));

-- outbox_events intentionally has no client policies. Only server/worker roles may access it.
-- Financial ledgers and inventory movements intentionally expose SELECT only to clients.

commit;
