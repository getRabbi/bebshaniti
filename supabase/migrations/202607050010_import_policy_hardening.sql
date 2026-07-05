begin;

drop policy if exists product_imports_select_manager on public.product_imports;

create policy product_imports_select_admin on public.product_imports
for select to authenticated using (
  app_private.has_org_role(organization_id, array['owner','admin']::public.app_role[])
);

commit;
