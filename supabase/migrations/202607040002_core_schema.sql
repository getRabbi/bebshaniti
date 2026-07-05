begin;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  business_type text not null default 'mixed',
  logo_path text,
  phone text,
  email text,
  address text,
  tin text,
  bin text,
  trade_license text,
  currency char(3) not null default 'BDT' check (currency = 'BDT'),
  language text not null default 'bn' check (language in ('bn', 'en')),
  timezone text not null default 'Asia/Dhaka',
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  email text,
  avatar_path text,
  locale text not null default 'bn' check (locale in ('bn', 'en')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null,
  code text not null,
  address text,
  phone text,
  is_main boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, code)
);

create unique index branches_one_main_per_org_idx
  on public.branches (organization_id) where is_main;

create table public.warehouses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid,
  name text not null,
  code text not null,
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, code),
  foreign key (branch_id, organization_id)
    references public.branches (id, organization_id) on delete restrict
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  branch_id uuid,
  role public.app_role not null,
  permissions jsonb not null default '{}'::jsonb check (jsonb_typeof(permissions) = 'object'),
  status public.membership_status not null default 'invited',
  invited_by uuid references public.profiles(id) on delete set null,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id),
  unique (id, organization_id),
  foreign key (branch_id, organization_id)
    references public.branches (id, organization_id) on delete restrict,
  check (role in ('owner', 'admin') or branch_id is not null)
);

create unique index memberships_one_owner_per_org_idx
  on public.memberships (organization_id) where role = 'owner' and status = 'active';

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid,
  user_id uuid references public.profiles(id) on delete set null,
  device_fingerprint text not null,
  device_name text not null,
  platform text not null,
  app_version text,
  last_seen_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'active', 'blocked', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, device_fingerprint),
  foreign key (branch_id, organization_id)
    references public.branches (id, organization_id) on delete restrict
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  parent_id uuid,
  name text not null,
  name_bn text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, name),
  foreign key (parent_id, organization_id)
    references public.categories (id, organization_id) on delete restrict
);

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, name)
);

create table public.units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null,
  symbol text not null,
  precision smallint not null default 0 check (precision between 0 and 4),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, symbol)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  category_id uuid,
  brand_id uuid,
  base_unit_id uuid,
  name text not null,
  name_bn text,
  description text,
  product_type text not null default 'standard' check (product_type in ('standard', 'service', 'composite')),
  track_stock boolean not null default true,
  track_serial boolean not null default false,
  track_batch boolean not null default false,
  vat_rate numeric(7,4) not null default 0 check (vat_rate between 0 and 100),
  image_path text,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (category_id, organization_id)
    references public.categories (id, organization_id) on delete restrict,
  foreign key (brand_id, organization_id)
    references public.brands (id, organization_id) on delete restrict,
  foreign key (base_unit_id, organization_id)
    references public.units (id, organization_id) on delete restrict
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  product_id uuid not null,
  variant_name text not null default 'Default',
  sku text not null,
  barcode text,
  attributes jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes) = 'object'),
  purchase_price numeric(18,4) not null default 0 check (purchase_price >= 0),
  retail_price numeric(18,4) not null default 0 check (retail_price >= 0),
  wholesale_price numeric(18,4) not null default 0 check (wholesale_price >= 0),
  dealer_price numeric(18,4) check (dealer_price >= 0),
  min_selling_price numeric(18,4) check (min_selling_price >= 0),
  reorder_level numeric(18,4) not null default 0 check (reorder_level >= 0),
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, sku),
  foreign key (product_id, organization_id)
    references public.products (id, organization_id) on delete restrict
);

create unique index product_variants_org_barcode_idx
  on public.product_variants (organization_id, barcode) where barcode is not null;

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid,
  name text not null,
  phone text,
  address text,
  district text,
  customer_type text not null default 'retail' check (customer_type in ('retail', 'wholesale', 'dealer', 'vip')),
  price_group text,
  credit_limit numeric(18,4) not null default 0 check (credit_limit >= 0),
  status text not null default 'active' check (status in ('active', 'blocked', 'archived')),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (branch_id, organization_id)
    references public.branches (id, organization_id) on delete restrict
);

create unique index customers_org_phone_idx
  on public.customers (organization_id, phone) where phone is not null;

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid,
  name text not null,
  contact_person text,
  phone text,
  email text,
  address text,
  status text not null default 'active' check (status in ('active', 'blocked', 'archived')),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (branch_id, organization_id)
    references public.branches (id, organization_id) on delete restrict
);

commit;
