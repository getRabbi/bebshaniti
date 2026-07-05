begin;

create extension if not exists pgcrypto with schema extensions;

create type public.app_role as enum (
  'owner',
  'admin',
  'branch_manager',
  'cashier',
  'sales_rep',
  'inventory_manager',
  'accountant',
  'purchase_manager',
  'auditor',
  'support'
);

create type public.membership_status as enum ('invited', 'active', 'suspended', 'revoked');
create type public.sale_status as enum ('draft', 'held', 'completed', 'returned', 'void');
create type public.purchase_status as enum ('draft', 'ordered', 'partially_received', 'received', 'cancelled');

create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

create or replace function app_private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function app_private.reject_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is append-only; create a compensating entry instead', tg_table_name
    using errcode = '55000';
end;
$$;

create or replace function app_private.protect_completed_sale()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status in ('completed', 'returned', 'void') then
    raise exception 'completed, returned, and void sales are immutable; use a controlled return/void transaction'
      using errcode = '55000';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function app_private.protect_completed_sale_child()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_sale_id uuid;
  parent_status public.sale_status;
begin
  if tg_op = 'INSERT' then
    parent_sale_id := new.sale_id;
  elsif tg_op = 'DELETE' then
    parent_sale_id := old.sale_id;
  else
    parent_sale_id := coalesce(old.sale_id, new.sale_id);
  end if;
  select status into parent_status from public.sales where id = parent_sale_id;
  if parent_status in ('completed', 'returned', 'void') then
    raise exception 'items on completed, returned, and void sales are immutable'
      using errcode = '55000';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function app_private.try_uuid(value text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return value::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

create or replace function app_private.apply_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('app.stock_projection_write', 'on', true);
  insert into public.inventory_balances (
    organization_id, branch_id, warehouse_id, product_variant_id, quantity, avg_cost
  ) values (
    new.organization_id,
    new.branch_id,
    new.warehouse_id,
    new.product_variant_id,
    new.quantity_change,
    coalesce(new.unit_cost, 0)
  )
  on conflict (organization_id, branch_id, warehouse_id, product_variant_id)
  do update set
    quantity = public.inventory_balances.quantity + excluded.quantity,
    avg_cost = case
      when excluded.quantity > 0 and new.unit_cost is not null
        and public.inventory_balances.quantity + excluded.quantity > 0
      then round(
        ((public.inventory_balances.quantity * public.inventory_balances.avg_cost)
          + (excluded.quantity * new.unit_cost))
        / (public.inventory_balances.quantity + excluded.quantity), 4
      )
      else public.inventory_balances.avg_cost
    end,
    updated_at = now();
  perform set_config('app.stock_projection_write', 'off', true);
  return new;
end;
$$;

create or replace function app_private.protect_inventory_balance()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('app.stock_projection_write', true) is distinct from 'on' then
    raise exception 'inventory_balances is a projection; insert a stock_movement instead'
      using errcode = '55000';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

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
begin
  old_row := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  new_row := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  row_data := coalesce(new_row, old_row);

  insert into public.audit_logs (
    organization_id,
    branch_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    old_value,
    new_value
  ) values (
    (row_data ->> 'organization_id')::uuid,
    nullif(row_data ->> 'branch_id', '')::uuid,
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    nullif(row_data ->> 'id', '')::uuid,
    old_row,
    new_row
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function app_private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'phone',
    new.email
  )
  on conflict (id) do update set
    email = excluded.email,
    updated_at = now();
  return new;
end;
$$;

commit;
