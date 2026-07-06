begin;

create table public.platform_access_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_email text not null,
  action text not null check (length(action) between 3 and 120),
  target_organization_id uuid references public.organizations(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index platform_access_logs_created_idx on public.platform_access_logs (created_at desc);
create index platform_access_logs_actor_idx on public.platform_access_logs (actor_user_id, created_at desc);

alter table public.platform_access_logs enable row level security;
revoke all on public.platform_access_logs from anon, authenticated;
grant select, insert on public.platform_access_logs to service_role;

create or replace view public.platform_merchant_overview
with (security_invoker = true)
as
with branch_counts as (
  select organization_id, count(*)::integer as branch_count,
    count(*) filter (where is_active)::integer as active_branch_count
  from public.branches group by organization_id
), member_counts as (
  select organization_id, count(*)::integer as member_count,
    count(*) filter (where status = 'active')::integer as active_member_count
  from public.memberships group by organization_id
), device_counts as (
  select organization_id, count(*)::integer as device_count,
    count(*) filter (where status = 'active')::integer as active_device_count
  from public.devices group by organization_id
), product_counts as (
  select organization_id, count(*)::integer as product_count
  from public.products where status = 'active' group by organization_id
), customer_counts as (
  select organization_id, count(*)::integer as customer_count
  from public.customers where status = 'active' group by organization_id
), sales_summary as (
  select organization_id,
    count(*)::integer as completed_sale_count,
    coalesce(sum(grand_total), 0)::numeric(18,4) as lifetime_sales,
    coalesce(sum(grand_total) filter (where sold_at >= now() - interval '30 days'), 0)::numeric(18,4) as sales_last_30_days,
    max(sold_at) as last_sale_at
  from public.sales where status = 'completed' group by organization_id
), receivable_summary as (
  select organization_id,
    coalesce(sum(debit - credit), 0)::numeric(18,4) as receivable_balance
  from public.customer_ledger_entries group by organization_id
), latest_activity as (
  select organization_id, max(created_at) as last_audit_at
  from public.audit_logs group by organization_id
)
select
  o.id, o.name, o.slug, o.business_type, o.phone, o.email, o.is_active, o.created_at,
  owner_profile.full_name as owner_name,
  owner_profile.email as owner_email,
  coalesce(b.branch_count, 0) as branch_count,
  coalesce(b.active_branch_count, 0) as active_branch_count,
  coalesce(m.member_count, 0) as member_count,
  coalesce(m.active_member_count, 0) as active_member_count,
  coalesce(d.device_count, 0) as device_count,
  coalesce(d.active_device_count, 0) as active_device_count,
  coalesce(p.product_count, 0) as product_count,
  coalesce(c.customer_count, 0) as customer_count,
  coalesce(s.completed_sale_count, 0) as completed_sale_count,
  coalesce(s.lifetime_sales, 0)::numeric(18,4) as lifetime_sales,
  coalesce(s.sales_last_30_days, 0)::numeric(18,4) as sales_last_30_days,
  coalesce(r.receivable_balance, 0)::numeric(18,4) as receivable_balance,
  s.last_sale_at,
  greatest(s.last_sale_at, a.last_audit_at, o.updated_at) as last_activity_at,
  license.plan_code,
  license.license_type,
  license.status as license_status,
  license.max_branches,
  license.max_devices,
  license.activated_at,
  license.expires_at
from public.organizations o
left join branch_counts b on b.organization_id = o.id
left join member_counts m on m.organization_id = o.id
left join device_counts d on d.organization_id = o.id
left join product_counts p on p.organization_id = o.id
left join customer_counts c on c.organization_id = o.id
left join sales_summary s on s.organization_id = o.id
left join receivable_summary r on r.organization_id = o.id
left join latest_activity a on a.organization_id = o.id
left join lateral (
  select pr.full_name, pr.email
  from public.memberships mm
  join public.profiles pr on pr.id = mm.user_id
  where mm.organization_id = o.id and mm.role = 'owner' and mm.status = 'active'
  order by mm.created_at limit 1
) owner_profile on true
left join lateral (
  select l.plan_code, l.license_type, l.status, l.max_branches, l.max_devices,
    l.activated_at, l.expires_at
  from public.licenses l where l.organization_id = o.id
  order by l.created_at desc limit 1
) license on true;

revoke all on public.platform_merchant_overview from anon, authenticated;
grant select on public.platform_merchant_overview to service_role;

notify pgrst, 'reload schema';
commit;
