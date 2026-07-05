-- PostgreSQL requires newly added enum values to commit before later migrations use them.
alter type public.app_role add value if not exists 'manager';
alter type public.app_role add value if not exists 'inventory_staff';
alter type public.app_role add value if not exists 'viewer';
