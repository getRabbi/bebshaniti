begin;

create table public.product_imports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid,
  file_name text not null,
  import_mode text not null check (import_mode in ('create', 'skip', 'update')),
  total_rows integer not null check (total_rows >= 0),
  created_rows integer not null default 0 check (created_rows >= 0),
  updated_rows integer not null default 0 check (updated_rows >= 0),
  skipped_rows integer not null default 0 check (skipped_rows >= 0),
  failed_rows integer not null default 0 check (failed_rows >= 0),
  error_summary jsonb not null default '[]'::jsonb check (jsonb_typeof(error_summary) = 'array'),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (branch_id, organization_id)
    references public.branches(id, organization_id) on delete restrict
);

create table public.sale_returns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null,
  sale_id uuid not null,
  return_no text not null,
  reason text not null check (length(trim(reason)) >= 3),
  return_total numeric(18,4) not null check (return_total >= 0),
  due_adjustment numeric(18,4) not null default 0 check (due_adjustment >= 0),
  refund_amount numeric(18,4) not null default 0 check (refund_amount >= 0),
  refund_method text check (refund_method in ('cash','bkash','nagad','rocket','bank','card','cheque')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, return_no),
  foreign key (branch_id, organization_id)
    references public.branches(id, organization_id) on delete restrict,
  foreign key (sale_id, organization_id, branch_id)
    references public.sales(id, organization_id, branch_id) on delete restrict,
  check (due_adjustment + refund_amount = return_total),
  check (refund_amount = 0 or refund_method is not null)
);

create table public.sale_return_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null,
  sale_return_id uuid not null,
  sale_item_id uuid not null,
  product_variant_id uuid not null,
  description text not null,
  quantity numeric(18,4) not null check (quantity > 0),
  unit_price numeric(18,4) not null check (unit_price >= 0),
  purchase_cost numeric(18,4) not null check (purchase_cost >= 0),
  line_total numeric(18,4) not null check (line_total >= 0),
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (branch_id, organization_id)
    references public.branches(id, organization_id) on delete restrict,
  foreign key (sale_return_id, organization_id)
    references public.sale_returns(id, organization_id) on delete restrict,
  foreign key (sale_item_id, organization_id)
    references public.sale_items(id, organization_id) on delete restrict,
  foreign key (product_variant_id, organization_id)
    references public.product_variants(id, organization_id) on delete restrict
);

create table public.sale_voids (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null,
  sale_id uuid not null,
  reason text not null check (length(trim(reason)) >= 3),
  due_adjustment numeric(18,4) not null default 0 check (due_adjustment >= 0),
  refund_amount numeric(18,4) not null default 0 check (refund_amount >= 0),
  refund_method text check (refund_method in ('cash','bkash','nagad','rocket','bank','card','cheque')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, sale_id),
  foreign key (branch_id, organization_id)
    references public.branches(id, organization_id) on delete restrict,
  foreign key (sale_id, organization_id, branch_id)
    references public.sales(id, organization_id, branch_id) on delete restrict,
  check (refund_amount = 0 or refund_method is not null)
);

create index product_imports_org_created_idx on public.product_imports(organization_id, created_at desc);
create index sale_returns_org_sale_idx on public.sale_returns(organization_id, sale_id, created_at desc);
create index sale_return_items_return_idx on public.sale_return_items(organization_id, sale_return_id);
create index sale_voids_org_sale_idx on public.sale_voids(organization_id, sale_id);

alter table public.product_imports enable row level security;
alter table public.sale_returns enable row level security;
alter table public.sale_return_items enable row level security;
alter table public.sale_voids enable row level security;

create policy product_imports_select_manager on public.product_imports
for select to authenticated using (
  app_private.has_org_role(organization_id, array['owner','admin','manager']::public.app_role[])
);
create policy sale_returns_select_branch on public.sale_returns
for select to authenticated using (app_private.can_access_branch(organization_id, branch_id));
create policy sale_return_items_select_branch on public.sale_return_items
for select to authenticated using (app_private.can_access_branch(organization_id, branch_id));
create policy sale_voids_select_branch on public.sale_voids
for select to authenticated using (app_private.can_access_branch(organization_id, branch_id));

-- Return/import writes remain server-only. The API enforces permissions and writes atomically.
create trigger product_imports_append_only before update or delete on public.product_imports
for each row execute function app_private.reject_mutation();
create trigger sale_returns_append_only before update or delete on public.sale_returns
for each row execute function app_private.reject_mutation();
create trigger sale_return_items_append_only before update or delete on public.sale_return_items
for each row execute function app_private.reject_mutation();
create trigger sale_voids_append_only before update or delete on public.sale_voids
for each row execute function app_private.reject_mutation();

create trigger product_imports_audit after insert on public.product_imports
for each row execute function app_private.write_audit_log();
create trigger sale_returns_audit after insert on public.sale_returns
for each row execute function app_private.write_audit_log();
create trigger sale_return_items_audit after insert on public.sale_return_items
for each row execute function app_private.write_audit_log();
create trigger sale_voids_audit after insert on public.sale_voids
for each row execute function app_private.write_audit_log();

create or replace function app_private.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_row jsonb;
  new_row jsonb;
  row_data jsonb;
  actor uuid;
begin
  old_row := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  new_row := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  row_data := coalesce(new_row, old_row);
  actor := coalesce(
    auth.uid(),
    app_private.try_uuid(row_data ->> 'created_by'),
    app_private.try_uuid(row_data ->> 'received_by'),
    app_private.try_uuid(row_data ->> 'cashier_id')
  );
  insert into public.audit_logs (
    organization_id, branch_id, actor_user_id, action, entity_type,
    entity_id, old_value, new_value
  ) values (
    (row_data ->> 'organization_id')::uuid,
    nullif(row_data ->> 'branch_id', '')::uuid,
    actor,
    lower(tg_op),
    tg_table_name,
    nullif(row_data ->> 'id', '')::uuid,
    old_row,
    new_row
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- Replace product-media mutation policies to include the new production roles.
drop policy if exists storage_catalog_manager_insert on storage.objects;
drop policy if exists storage_catalog_manager_update on storage.objects;
drop policy if exists storage_catalog_admin_delete on storage.objects;

create policy storage_catalog_manager_insert on storage.objects
for insert to authenticated with check (
  bucket_id in ('product-media','organization-assets')
  and app_private.has_org_role(
    app_private.try_uuid((storage.foldername(name))[1]),
    array['owner','admin','manager','inventory_manager','inventory_staff']::public.app_role[]
  )
);
create policy storage_catalog_manager_update on storage.objects
for update to authenticated using (
  bucket_id in ('product-media','organization-assets')
  and app_private.has_org_role(
    app_private.try_uuid((storage.foldername(name))[1]),
    array['owner','admin','manager','inventory_manager','inventory_staff']::public.app_role[]
  )
) with check (
  bucket_id in ('product-media','organization-assets')
  and app_private.has_org_role(
    app_private.try_uuid((storage.foldername(name))[1]),
    array['owner','admin','manager','inventory_manager','inventory_staff']::public.app_role[]
  )
);
create policy storage_catalog_manager_delete on storage.objects
for delete to authenticated using (
  bucket_id in ('product-media','organization-assets')
  and app_private.has_org_role(
    app_private.try_uuid((storage.foldername(name))[1]),
    array['owner','admin','manager','inventory_manager','inventory_staff']::public.app_role[]
  )
);

commit;
