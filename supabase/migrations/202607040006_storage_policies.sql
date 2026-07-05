begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-media', 'product-media', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('organization-assets', 'organization-assets', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']),
  ('private-documents', 'private-documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy storage_member_read on storage.objects
for select to authenticated
using (
  bucket_id in ('product-media', 'organization-assets', 'private-documents')
  and app_private.is_org_member(app_private.try_uuid((storage.foldername(name))[1]))
);

create policy storage_catalog_manager_insert on storage.objects
for insert to authenticated
with check (
  bucket_id in ('product-media', 'organization-assets')
  and app_private.has_org_role(
    app_private.try_uuid((storage.foldername(name))[1]),
    array['owner', 'admin', 'inventory_manager']::public.app_role[]
  )
);

create policy storage_catalog_manager_update on storage.objects
for update to authenticated
using (
  bucket_id in ('product-media', 'organization-assets')
  and app_private.has_org_role(
    app_private.try_uuid((storage.foldername(name))[1]),
    array['owner', 'admin', 'inventory_manager']::public.app_role[]
  )
)
with check (
  bucket_id in ('product-media', 'organization-assets')
  and app_private.has_org_role(
    app_private.try_uuid((storage.foldername(name))[1]),
    array['owner', 'admin', 'inventory_manager']::public.app_role[]
  )
);

create policy storage_catalog_admin_delete on storage.objects
for delete to authenticated
using (
  bucket_id in ('product-media', 'organization-assets')
  and app_private.has_org_role(
    app_private.try_uuid((storage.foldername(name))[1]),
    array['owner', 'admin']::public.app_role[]
  )
);

-- private-documents writes are server-only; clients can only read their organization's path.
commit;
