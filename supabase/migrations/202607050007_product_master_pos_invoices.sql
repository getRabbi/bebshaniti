begin;

create extension if not exists pg_trgm with schema extensions;

create table public.product_master_categories (
  id uuid primary key default gen_random_uuid(),
  bn_name text not null,
  en_name text not null,
  slug text not null unique,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_master_subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.product_master_categories(id) on delete restrict,
  bn_name text not null,
  en_name text not null,
  slug text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, slug)
);

create table public.product_master_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.product_master_categories(id) on delete restrict,
  subcategory_id uuid references public.product_master_subcategories(id) on delete restrict,
  bn_name text not null,
  en_name text not null,
  brand_name text,
  common_unit text not null default 'pcs',
  common_pack_size text,
  keywords_bn text[] not null default '{}',
  keywords_en text[] not null default '{}',
  aliases text[] not null default '{}',
  barcode text,
  is_active boolean not null default true,
  popularity_score integer not null default 0 check (popularity_score >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, bn_name, en_name)
);

create table public.product_master_aliases (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.product_master_items(id) on delete cascade,
  alias text not null,
  locale text not null default 'bn-BD' check (locale in ('bn-BD', 'en')),
  normalized_alias text generated always as (lower(trim(alias))) stored,
  created_at timestamptz not null default now(),
  unique (item_id, normalized_alias)
);

create index product_master_items_bn_trgm_idx on public.product_master_items
  using gin (bn_name extensions.gin_trgm_ops);
create index product_master_items_en_trgm_idx on public.product_master_items
  using gin (en_name extensions.gin_trgm_ops);
create index product_master_items_brand_trgm_idx on public.product_master_items
  using gin (brand_name extensions.gin_trgm_ops);
create index product_master_items_keywords_bn_idx on public.product_master_items using gin (keywords_bn);
create index product_master_items_keywords_en_idx on public.product_master_items using gin (keywords_en);
create index product_master_items_aliases_idx on public.product_master_items using gin (aliases);
create index product_master_aliases_trgm_idx on public.product_master_aliases
  using gin (normalized_alias extensions.gin_trgm_ops);

alter table public.product_master_categories enable row level security;
alter table public.product_master_subcategories enable row level security;
alter table public.product_master_items enable row level security;
alter table public.product_master_aliases enable row level security;

create policy product_master_categories_read on public.product_master_categories
  for select to authenticated using (is_active);
create policy product_master_subcategories_read on public.product_master_subcategories
  for select to authenticated using (is_active);
create policy product_master_items_read on public.product_master_items
  for select to authenticated using (is_active);
create policy product_master_aliases_read on public.product_master_aliases
  for select to authenticated using (true);

alter table public.products
  add column supplier_id uuid,
  add column rack_location text,
  add column notes text,
  add column discount_allowed boolean not null default true,
  add column expiry_tracking boolean not null default false,
  add foreign key (supplier_id, organization_id)
    references public.suppliers(id, organization_id) on delete restrict;

alter table public.product_variants
  add column mrp numeric(18,4) check (mrp >= 0),
  add column pack_size text,
  add column batch_number text,
  add column expiry_date date,
  add column serial_number text;

alter table public.sales
  add column memo_no text,
  add column payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'partial', 'paid')),
  add column completed_at timestamptz,
  add column footer_note text;

update public.sales set
  memo_no = invoice_no,
  payment_status = case when due_total = 0 then 'paid' when paid_total > 0 then 'partial' else 'unpaid' end,
  completed_at = sold_at;

alter table public.sales alter column memo_no set not null;
create unique index sales_org_branch_memo_idx on public.sales (organization_id, branch_id, memo_no);

alter table public.organizations
  add column invoice_prefix text not null default 'MEMO',
  add column invoice_footer text,
  add column receipt_size text not null default '80mm'
    check (receipt_size in ('58mm', '80mm', 'a4'));

create table public.document_sequences (
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null,
  document_type text not null check (document_type in ('sale_memo')),
  current_value bigint not null default 0 check (current_value >= 0),
  updated_at timestamptz not null default now(),
  primary key (organization_id, branch_id, document_type),
  foreign key (branch_id, organization_id)
    references public.branches(id, organization_id) on delete restrict
);

alter table public.document_sequences enable row level security;
create policy document_sequences_select_admin on public.document_sequences
  for select to authenticated
  using (app_private.has_org_role(organization_id, array['owner','admin']::public.app_role[]));

insert into public.product_master_categories (bn_name, en_name, slug, sort_order) values
('চাল / ডাল / আটা / ময়দা / সুজি','Rice, lentils and flour','rice-lentils-flour',10),
('তেল / মসলা / লবণ / চিনি','Oil, spices, salt and sugar','oil-spices-staples',20),
('বিস্কুট / চানাচুর / স্ন্যাকস','Biscuits and snacks','biscuits-snacks',30),
('চা / কফি / পানীয়','Tea, coffee and beverages','beverages',40),
('দুধ / গুঁড়া দুধ / শিশুখাদ্য','Milk and baby food','milk-baby-food',50),
('সাবান / শ্যাম্পু / ডিটারজেন্ট','Soap, shampoo and detergent','cleaning',60),
('টুথপেস্ট / ব্রাশ / পার্সোনাল কেয়ার','Oral and personal care','personal-care',70),
('প্রসাধনী / স্কিন কেয়ার','Cosmetics and skin care','cosmetics',80),
('ওষুধ / ফার্মেসি','Basic non-prescription pharmacy','pharmacy-basic',90),
('স্টেশনারি','Stationery','stationery',100),
('মোবাইল এক্সেসরিজ','Mobile accessories','mobile-accessories',110),
('ইলেকট্রনিক্স','Electronics','electronics',120),
('কাপড় / ফ্যাশন','Clothing and fashion','fashion',130),
('জুতা / ব্যাগ','Shoes and bags','shoes-bags',140),
('হার্ডওয়্যার','Hardware','hardware',150),
('প্লাস্টিক / হোম আইটেম','Plastic and home items','home-items',160),
('কিচেন আইটেম','Kitchen items','kitchen',170),
('বাচ্চাদের পণ্য','Kids products','kids',180),
('কৃষি পণ্য','Agricultural products','agriculture',190),
('পাইকারি পণ্য','Wholesale products','wholesale',200);

insert into public.product_master_subcategories(category_id,bn_name,en_name,slug)
select id,bn_name,en_name,'general' from public.product_master_categories;

with seed(category_bn,bn_name,en_name,brand_name,unit_name,pack_size,aliases) as (values
('চাল / ডাল / আটা / ময়দা / সুজি','মিনিকেট চাল','Miniket Rice',null,'kg',null,array['miniket','চাল']),
('চাল / ডাল / আটা / ময়দা / সুজি','নাজিরশাইল চাল','Nazirshail Rice',null,'kg',null,array['nazirshail','নাজির চাল']),
('চাল / ডাল / আটা / ময়দা / সুজি','বাসমতি চাল','Basmati Rice',null,'kg',null,array['basmati','rice']),
('চাল / ডাল / আটা / ময়দা / সুজি','মসুর ডাল','Red Lentil',null,'kg',null,array['mosur dal','ডাল']),
('চাল / ডাল / আটা / ময়দা / সুজি','মুগ ডাল','Mung Lentil',null,'kg',null,array['mug dal']),
('চাল / ডাল / আটা / ময়দা / সুজি','এসিআই পিওর আটা','ACI Pure Atta','ACI Pure','pack','1 kg',array['aci atta','আটা']),
('চাল / ডাল / আটা / ময়দা / সুজি','তীর ময়দা','Teer Flour','Teer','pack','1 kg',array['teer maida','ময়দা']),
('চাল / ডাল / আটা / ময়দা / সুজি','সুজি','Semolina',null,'kg',null,array['suji','semolina']),
('তেল / মসলা / লবণ / চিনি','রূপচাঁদা সয়াবিন তেল','Rupchanda Soybean Oil','Rupchanda','bottle','1 litre',array['rupchanda oil','soybean']),
('তেল / মসলা / লবণ / চিনি','তীর সয়াবিন তেল','Teer Soybean Oil','Teer','bottle','1 litre',array['teer oil']),
('তেল / মসলা / লবণ / চিনি','এসিআই পিওর লবণ','ACI Pure Salt','ACI Pure','pack','1 kg',array['aci salt','লবণ']),
('তেল / মসলা / লবণ / চিনি','ফ্রেশ রিফাইন্ড চিনি','Fresh Refined Sugar','Fresh','pack','1 kg',array['fresh sugar','চিনি']),
('তেল / মসলা / লবণ / চিনি','রাঁধুনী মরিচ গুঁড়া','Radhuni Chilli Powder','Radhuni','pack','100 g',array['radhuni chili','মরিচ']),
('তেল / মসলা / লবণ / চিনি','রাঁধুনী হলুদ গুঁড়া','Radhuni Turmeric Powder','Radhuni','pack','100 g',array['radhuni holud','হলুদ']),
('বিস্কুট / চানাচুর / স্ন্যাকস','অলিম্পিক এনার্জি প্লাস বিস্কুট','Olympic Energy Plus Biscuit','Olympic','pack',null,array['energy plus','biscuit']),
('বিস্কুট / চানাচুর / স্ন্যাকস','প্রাণ পটাটা','PRAN Potata','PRAN','pack',null,array['potata','chips']),
('বিস্কুট / চানাচুর / স্ন্যাকস','বোম্বে সুইটস চানাচুর','Bombay Sweets Chanachur','Bombay Sweets','pack',null,array['chanachur','চানাচুর']),
('চা / কফি / পানীয়','ইস্পাহানি মির্জাপুর চা','Ispahani Mirzapore Tea','Ispahani','pack','200 g',array['ispahani tea','চা পাতা']),
('চা / কফি / পানীয়','ফিনলে চা','Finlay Tea','Finlay','pack','200 g',array['finlay tea','চা']),
('চা / কফি / পানীয়','নেসক্যাফে ক্লাসিক','Nescafe Classic','Nescafe','jar',null,array['coffee','কফি']),
('চা / কফি / পানীয়','কোকা-কোলা','Coca-Cola','Coca-Cola','bottle','1 litre',array['coke','soft drink']),
('দুধ / গুঁড়া দুধ / শিশুখাদ্য','ফ্রেশ ফুল ক্রিম মিল্ক পাউডার','Fresh Full Cream Milk Powder','Fresh','pack','500 g',array['fresh milk','গুঁড়া দুধ']),
('দুধ / গুঁড়া দুধ / শিশুখাদ্য','ডানো পাওয়ার','Dano Power','Dano','pack','500 g',array['dano milk']),
('দুধ / গুঁড়া দুধ / শিশুখাদ্য','সেরেলাক','Cerelac','Nestle','pack',null,array['baby food','শিশুখাদ্য']),
('সাবান / শ্যাম্পু / ডিটারজেন্ট','লাক্স সাবান','Lux Soap','Lux','pcs',null,array['lux','soap']),
('সাবান / শ্যাম্পু / ডিটারজেন্ট','লাইফবয় সাবান','Lifebuoy Soap','Lifebuoy','pcs',null,array['lifebuoy','soap']),
('সাবান / শ্যাম্পু / ডিটারজেন্ট','সানসিল্ক শ্যাম্পু','Sunsilk Shampoo','Sunsilk','bottle',null,array['sunsilk','shampoo']),
('সাবান / শ্যাম্পু / ডিটারজেন্ট','সার্ফ এক্সেল ডিটারজেন্ট','Surf Excel Detergent','Surf Excel','pack','500 g',array['surf excel','detergent']),
('সাবান / শ্যাম্পু / ডিটারজেন্ট','এসিআই এরোসল','ACI Aerosol','ACI','can',null,array['aci aerosol','mosquito spray']),
('টুথপেস্ট / ব্রাশ / পার্সোনাল কেয়ার','পেপসোডেন্ট টুথপেস্ট','Pepsodent Toothpaste','Pepsodent','tube',null,array['pepsodent','toothpaste']),
('টুথপেস্ট / ব্রাশ / পার্সোনাল কেয়ার','ক্লোজআপ টুথপেস্ট','Closeup Toothpaste','Closeup','tube',null,array['close up','toothpaste']),
('টুথপেস্ট / ব্রাশ / পার্সোনাল কেয়ার','সেনসোডাইন টুথপেস্ট','Sensodyne Toothpaste','Sensodyne','tube',null,array['sensodyne']),
('প্রসাধনী / স্কিন কেয়ার','ভ্যাসলিন পেট্রোলিয়াম জেলি','Vaseline Petroleum Jelly','Vaseline','jar',null,array['vaseline','skin care']),
('প্রসাধনী / স্কিন কেয়ার','পন্ডস ফেসওয়াশ','Ponds Face Wash','Ponds','tube',null,array['ponds','face wash']),
('ওষুধ / ফার্মেসি','প্যারাসিটামল ট্যাবলেট','Paracetamol Tablet',null,'strip',null,array['napa generic','জ্বর']),
('ওষুধ / ফার্মেসি','ওআরএস','Oral Rehydration Salts',null,'sachet',null,array['ors','oral saline','খাবার স্যালাইন']),
('ওষুধ / ফার্মেসি','ব্যান্ডেজ','Bandage',null,'pcs',null,array['first aid']),
('স্টেশনারি','ম্যাটাডোর বলপেন','Matador Ball Pen','Matador','pcs',null,array['pen','কলম']),
('স্টেশনারি','বসুন্ধরা খাতা','Bashundhara Exercise Book','Bashundhara','pcs',null,array['notebook','খাতা']),
('স্টেশনারি','এ৪ কাগজ','A4 Paper',null,'ream','500 sheets',array['a4','paper']),
('মোবাইল এক্সেসরিজ','ইউএসবি টাইপ-সি কেবল','USB Type-C Cable',null,'pcs',null,array['type c','charger cable']),
('মোবাইল এক্সেসরিজ','মোবাইল চার্জার','Mobile Charger',null,'pcs',null,array['adapter','charger']),
('মোবাইল এক্সেসরিজ','ইয়ারফোন','Earphone',null,'pcs',null,array['headphone','earbuds']),
('ইলেকট্রনিক্স','এলইডি বাল্ব','LED Bulb',null,'pcs',null,array['light','bulb']),
('ইলেকট্রনিক্স','মাল্টিপ্লাগ','Multi-plug',null,'pcs',null,array['power strip']),
('কাপড় / ফ্যাশন','কটন টি-শার্ট','Cotton T-shirt',null,'pcs',null,array['tshirt','shirt']),
('কাপড় / ফ্যাশন','লুঙ্গি','Lungi',null,'pcs',null,array['lungi']),
('জুতা / ব্যাগ','স্যান্ডেল','Sandal',null,'pair',null,array['slipper','জুতা']),
('জুতা / ব্যাগ','স্কুল ব্যাগ','School Bag',null,'pcs',null,array['backpack','ব্যাগ']),
('হার্ডওয়্যার','সিমেন্ট','Cement',null,'bag','50 kg',array['cement bag']),
('হার্ডওয়্যার','স্টিল পেরেক','Steel Nail',null,'kg',null,array['nail','পেরেক']),
('হার্ডওয়্যার','পিভিসি পাইপ','PVC Pipe',null,'pcs',null,array['pipe']),
('প্লাস্টিক / হোম আইটেম','প্লাস্টিক বালতি','Plastic Bucket',null,'pcs',null,array['bucket','বালতি']),
('প্লাস্টিক / হোম আইটেম','স্টোরেজ বক্স','Storage Box',null,'pcs',null,array['container','box']),
('কিচেন আইটেম','স্টেইনলেস স্টিল প্লেট','Stainless Steel Plate',null,'pcs',null,array['plate','থালা']),
('কিচেন আইটেম','প্রেশার কুকার','Pressure Cooker',null,'pcs',null,array['cooker']),
('বাচ্চাদের পণ্য','বেবি ডায়াপার','Baby Diaper',null,'pack',null,array['diaper','ন্যাপি']),
('বাচ্চাদের পণ্য','বেবি ওয়াইপস','Baby Wipes',null,'pack',null,array['wipes']),
('কৃষি পণ্য','ইউরিয়া সার','Urea Fertilizer',null,'bag',null,array['urea','fertilizer','সার']),
('কৃষি পণ্য','সবজির বীজ','Vegetable Seeds',null,'pack',null,array['seed','বীজ']),
('পাইকারি পণ্য','কার্টন প্যাক বিস্কুট','Biscuit Carton',null,'carton',null,array['wholesale biscuit']),
('পাইকারি পণ্য','তেল কার্টন','Oil Carton',null,'carton',null,array['wholesale oil'])
)
insert into public.product_master_items
  (category_id,bn_name,en_name,brand_name,common_unit,common_pack_size,keywords_bn,keywords_en,aliases)
select c.id,s.bn_name,s.en_name,s.brand_name,s.unit_name,s.pack_size,
       regexp_split_to_array(lower(s.bn_name),'\\s+'),
       regexp_split_to_array(lower(s.en_name),'\\s+'),s.aliases
from seed s join public.product_master_categories c on c.bn_name=s.category_bn;

insert into public.product_master_aliases (item_id, alias, locale)
select i.id, a.alias,
       case when a.alias ~ '[ঀ-৿]' then 'bn-BD' else 'en' end
from public.product_master_items i
cross join lateral unnest(i.aliases) as a(alias)
on conflict do nothing;

create trigger product_master_categories_updated_at before update on public.product_master_categories
for each row execute function app_private.set_updated_at();
create trigger product_master_subcategories_updated_at before update on public.product_master_subcategories
for each row execute function app_private.set_updated_at();
create trigger product_master_items_updated_at before update on public.product_master_items
for each row execute function app_private.set_updated_at();

commit;
