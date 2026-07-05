create or replace function app_private.apply_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  projected_quantity numeric(18,4);
  allow_negative_stock boolean;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      new.organization_id::text || ':' || new.branch_id::text || ':' ||
      new.product_variant_id::text,
      0
    )
  );
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
    updated_at = now()
  returning quantity into projected_quantity;

  select coalesce(sum(quantity), 0)
    into projected_quantity
    from public.inventory_balances
    where organization_id = new.organization_id
      and branch_id = new.branch_id
      and product_variant_id = new.product_variant_id;

  if projected_quantity < 0 then
    select lower(coalesce(settings ->> 'allow_negative_stock', 'false')) = 'true'
      into allow_negative_stock
      from public.organizations
      where id = new.organization_id;
    if not coalesce(allow_negative_stock, false) then
      raise exception 'Insufficient stock; negative inventory is disabled'
        using errcode = '23514';
    end if;
  end if;

  perform set_config('app.stock_projection_write', 'off', true);
  return new;
end;
$$;
