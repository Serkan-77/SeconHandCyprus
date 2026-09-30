-- Category tree and category-specific attributes.
--
-- Model (hybrid):
--   categories            a tree (parent_id); listings may sit at any level,
--                         the listing form asks for a leaf when one exists.
--   category_attributes   attribute definitions. category_id NULL = every
--                         category. A category inherits its ancestors'
--                         attributes; a definition with the same key lower in
--                         the tree overrides the inherited one, and an
--                         override with is_active = false hides it there.
--   listings.attributes   the values, as one JSONB object keyed by attribute
--                         key (GIN-indexed with jsonb_path_ops for "@>"
--                         filters). The API validates values against the
--                         effective definitions of the listing's category.
--
-- Option values are stable slugs; labels can be renamed without touching
-- listings. Nothing here renames an existing category's slug or id.

create table public.category_attributes (
  id serial primary key,
  category_id int references public.categories (id) on delete cascade,
  key text not null check (key ~ '^[a-z][a-z0-9_]{1,39}$'),
  label text not null check (char_length(btrim(label)) between 1 and 60),
  label_en text check (label_en is null or char_length(btrim(label_en)) between 1 and 60),
  type text not null check (type in ('text', 'number', 'select', 'multiselect', 'boolean', 'year')),
  unit text check (unit is null or char_length(unit) <= 12),
  -- [{"value": "apple", "label": "Apple", "label_en": "Apple"}, …]
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  required boolean not null default false,
  filterable boolean not null default false,
  -- Shown on listing cards and at the top of the specifications.
  highlight boolean not null default false,
  min_value numeric,
  max_value numeric,
  max_length int check (max_length is null or max_length between 1 and 500),
  placeholder text check (placeholder is null or char_length(placeholder) <= 80),
  help text check (help is null or char_length(help) <= 200),
  group_name text not null default 'Özellikler' check (char_length(group_name) <= 40),
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique nulls not distinct (category_id, key),
  check (type not in ('select', 'multiselect') or jsonb_array_length(options) > 0 or not is_active)
);

create index category_attributes_category_idx on public.category_attributes (category_id, sort_order);

alter table public.category_attributes enable row level security;
create policy "system" on public.category_attributes for all using ((select app.role()) = 'system') with check ((select app.role()) = 'system');
create policy "attributes are public" on public.category_attributes for select using (true);
create policy "admins manage attributes" on public.category_attributes for all
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Ancestors of a category, itself first, then its parent, … up to the root.
create or replace function public.category_path(p_category int)
returns table (id int, depth int) language sql stable as $$
  with recursive up as (
    select c.id, c.parent_id, 0 as depth from public.categories c where c.id = p_category
    union all
    select c.id, c.parent_id, up.depth + 1 from public.categories c join up on c.id = up.parent_id
    where up.depth < 10
  )
  select up.id, up.depth from up
$$;

-- Descendants of a category, itself included.
create or replace function public.category_subtree(p_category int)
returns table (id int) language sql stable as $$
  with recursive down as (
    select c.id, 0 as depth from public.categories c where c.id = p_category
    union all
    select c.id, down.depth + 1 from public.categories c join down on c.parent_id = down.id
    where down.depth < 10
  )
  select down.id from down
$$;

-- ---------------------------------------------------------------------------
-- Seed helpers (temporary: pg_temp disappears at the end of the session)
-- ---------------------------------------------------------------------------

-- Options from labels: value = slug of the label ("128 GB" → "128-gb").
create function pg_temp.opts(variadic labels text[])
returns jsonb language sql immutable as $$
  select coalesce(jsonb_agg(jsonb_build_object('value', public.slugify(l), 'label', l) order by ord), '[]'::jsonb)
  from unnest(labels) with ordinality as t(l, ord)
$$;

-- Numeric options: value = the number ("128").
create function pg_temp.nopts(unit text, variadic nums int[])
returns jsonb language sql immutable as $$
  select coalesce(jsonb_agg(jsonb_build_object('value', n::text, 'label', n::text || coalesce(' ' || unit, '')) order by ord), '[]'::jsonb)
  from unnest(nums) with ordinality as t(n, ord)
$$;

create function pg_temp.cat(p_parent text, p_slug text, p_name text, p_name_en text, p_icon text, p_sort int)
returns void language sql as $$
  insert into public.categories (parent_id, slug, name, name_en, icon, sort_order)
  values ((select id from public.categories where slug = p_parent), p_slug, p_name, p_name_en, p_icon, p_sort)
  on conflict (slug) do nothing
$$;

create function pg_temp.attr(
  p_category text, p_key text, p_label text, p_label_en text, p_type text,
  p_options jsonb default '[]'::jsonb, p_unit text default null,
  p_required boolean default false, p_filterable boolean default false, p_highlight boolean default false,
  p_min numeric default null, p_max numeric default null, p_group text default 'Özellikler',
  p_sort int default 0, p_placeholder text default null, p_help text default null, p_max_length int default null
) returns void language sql as $$
  insert into public.category_attributes
    (category_id, key, label, label_en, type, options, unit, required, filterable, highlight,
     min_value, max_value, group_name, sort_order, placeholder, help, max_length)
  values (
    (select id from public.categories where slug = p_category), p_key, p_label, p_label_en, p_type,
    p_options, p_unit, p_required, p_filterable, p_highlight, p_min, p_max, p_group, p_sort,
    p_placeholder, p_help, p_max_length)
$$;

-- Hides an inherited attribute in a subtree.
create function pg_temp.hide(p_category text, p_key text)
returns void language sql as $$
  insert into public.category_attributes (category_id, key, label, type, is_active)
  values ((select id from public.categories where slug = p_category), p_key, p_key, 'text', false)
$$;

-- ---------------------------------------------------------------------------
-- Global attributes: the optional details sellers could already fill in
-- (listings.details, migration 0014) plus known defects. Keys match 0014 so
-- imported listings keep their values.
-- ---------------------------------------------------------------------------

select pg_temp.attr(null, 'brand', 'Marka', 'Brand', 'text', p_group => 'Genel', p_sort => 10, p_max_length => 60, p_placeholder => 'Örn. IKEA, Samsung');
select pg_temp.attr(null, 'model', 'Model', 'Model', 'text', p_group => 'Genel', p_sort => 11, p_max_length => 60);
select pg_temp.attr(null, 'color', 'Renk', 'Colour', 'text', p_group => 'Genel', p_sort => 12, p_max_length => 60);
select pg_temp.attr(null, 'year', 'Satın alma yılı', 'Year of purchase', 'year', p_min => 1950, p_group => 'Genel', p_sort => 13);
select pg_temp.attr(null, 'warranty', 'Garanti', 'Warranty', 'select',
  '[{"value":"Garantisi devam ediyor","label":"Garantisi devam ediyor","label_en":"Under warranty"},{"value":"Garantisi yok","label":"Garantisi yok","label_en":"No warranty"}]',
  p_group => 'Durum', p_sort => 80);
select pg_temp.attr(null, 'invoice', 'Faturası var', 'Has receipt', 'boolean', p_group => 'Durum', p_sort => 81);
select pg_temp.attr(null, 'box', 'Kutusu / aksesuarları var', 'Box / accessories included', 'boolean', p_group => 'Durum', p_sort => 82);
select pg_temp.attr(null, 'defects', 'Kusurlar', 'Known defects', 'text', p_group => 'Durum', p_sort => 83, p_max_length => 200,
  p_placeholder => 'Varsa çizik, leke, eksik parça…', p_help => 'Açıkça yazmak güven verir ve sonradan anlaşmazlığı önler.');
select pg_temp.attr(null, 'exchange', 'Takasa açık', 'Open to swaps', 'boolean', p_group => 'Teslimat', p_sort => 90);
-- Values are the 0014 labels, kept verbatim for imported listings.
select pg_temp.attr(null, 'delivery', 'Teslimat', 'Delivery', 'multiselect',
  '[{"value":"Elden teslim","label":"Elden teslim","label_en":"Meet in person"},{"value":"Kargo ile gönderim","label":"Kargo ile gönderim","label_en":"Shipping"},{"value":"Adrese teslim","label":"Adrese teslim","label_en":"Delivery to address"}]',
  p_group => 'Teslimat', p_sort => 91, p_filterable => true);

-- ---------------------------------------------------------------------------
-- Tree. Top-level ids 1–9 come from 0001; names are refreshed where the
-- scope grew, slugs (URLs) never change.
-- ---------------------------------------------------------------------------

update public.categories set name = 'Ev & Mobilya', name_en = 'Home & furniture' where slug = 'mobilya' and name = 'Mobilya';
update public.categories set name = 'Giyim & Aksesuar', name_en = 'Fashion' where slug = 'giyim' and name = 'Giyim';
update public.categories set name = 'Bebek & Çocuk', name_en = 'Baby & kids' where slug = 'bebek' and name = 'Bebek';
update public.categories set name = 'Spor & Outdoor', name_en = 'Sports & outdoors' where slug = 'spor' and name = 'Spor';
update public.categories set name = 'Kitap & Eğitim', name_en = 'Books & study' where slug = 'kitap' and name = 'Kitap';
update public.categories set name = 'Hobi & Müzik', name_en = 'Hobbies & music' where slug = 'hobi' and name = 'Hobi';

select pg_temp.cat(null, 'alet-bahce', 'Alet & Bahçe', 'Tools & garden', 'tool', 10);

-- Ev & Mobilya
select pg_temp.cat('mobilya', 'koltuk-kanepe', 'Koltuk & Kanepe', 'Sofas & armchairs', 'sofa', 1);
select pg_temp.cat('mobilya', 'yatak-odasi', 'Yatak odası', 'Bedroom', 'bed', 2);
select pg_temp.cat('mobilya', 'masa-sandalye', 'Masa & Sandalye', 'Tables & chairs', 'table', 3);
select pg_temp.cat('mobilya', 'dolap-depolama', 'Dolap & Depolama', 'Storage & shelving', 'box', 4);
select pg_temp.cat('mobilya', 'ofis-mobilyasi', 'Ofis mobilyası', 'Office furniture', 'briefcase', 5);
select pg_temp.cat('mobilya', 'bahce-mobilyasi', 'Bahçe & Balkon mobilyası', 'Garden furniture', 'leaf', 6);
select pg_temp.cat('mobilya', 'dekorasyon-aydinlatma', 'Dekorasyon & Aydınlatma', 'Decor & lighting', 'lamp', 7);
select pg_temp.cat('mobilya', 'mutfak-sofra', 'Mutfak & Sofra', 'Kitchen & dining', 'cup', 8);
select pg_temp.cat('mobilya', 'ev-tekstili', 'Ev tekstili', 'Home textiles', 'shirt', 9);

-- Elektronik
select pg_temp.cat('elektronik', 'cep-telefonu', 'Cep telefonu', 'Mobile phones', 'phone', 1);
select pg_temp.cat('elektronik', 'dizustu-bilgisayar', 'Dizüstü bilgisayar', 'Laptops', 'laptop', 2);
select pg_temp.cat('elektronik', 'masaustu-bilgisayar', 'Masaüstü & Monitör', 'Desktops & monitors', 'monitor', 3);
select pg_temp.cat('elektronik', 'tablet', 'Tablet & E-okuyucu', 'Tablets & e-readers', 'tablet', 4);
select pg_temp.cat('elektronik', 'oyun-konsol', 'Oyun & Konsol', 'Gaming', 'gamepad', 5);
select pg_temp.cat('elektronik', 'tv-ses', 'TV & Ses sistemleri', 'TV & audio', 'tv', 6);
select pg_temp.cat('elektronik', 'fotograf-kamera', 'Fotoğraf & Kamera', 'Cameras', 'camera', 7);
select pg_temp.cat('elektronik', 'akilli-saat-aksesuar', 'Akıllı saat & Aksesuar', 'Wearables & accessories', 'watch', 8);

-- Giyim & Aksesuar
select pg_temp.cat('giyim', 'kadin-giyim', 'Kadın giyim', 'Women', 'shirt', 1);
select pg_temp.cat('giyim', 'erkek-giyim', 'Erkek giyim', 'Men', 'shirt', 2);
select pg_temp.cat('giyim', 'ayakkabi', 'Ayakkabı', 'Shoes', 'shoe', 3);
select pg_temp.cat('giyim', 'canta', 'Çanta', 'Bags', 'bag', 4);
select pg_temp.cat('giyim', 'saat-taki', 'Saat & Takı', 'Watches & jewellery', 'watch', 5);

-- Araç (kept small on purpose: no vehicle-trade specific flows)
select pg_temp.cat('arac', 'otomobil', 'Otomobil', 'Cars', 'car', 1);
select pg_temp.cat('arac', 'motosiklet', 'Motosiklet & Scooter', 'Motorbikes & scooters', 'scooter', 2);
select pg_temp.cat('arac', 'yedek-parca', 'Yedek parça & Aksesuar', 'Parts & accessories', 'tool', 3);

-- Ev aletleri
select pg_temp.cat('ev-aletleri', 'beyaz-esya', 'Beyaz eşya', 'Large appliances', 'appliance', 1);
select pg_temp.cat('ev-aletleri', 'klima-isitma', 'Klima & Isıtma', 'Air conditioning & heating', 'fan', 2);
select pg_temp.cat('ev-aletleri', 'kucuk-ev-aletleri', 'Küçük ev aletleri', 'Small appliances', 'appliance', 3);

-- Bebek & Çocuk
select pg_temp.cat('bebek', 'bebek-arabasi-koltuk', 'Bebek arabası & Oto koltuğu', 'Strollers & car seats', 'baby', 1);
select pg_temp.cat('bebek', 'bebek-cocuk-giyim', 'Bebek & Çocuk giyim', 'Kids'' clothing', 'shirt', 2);
select pg_temp.cat('bebek', 'oyuncak', 'Oyuncak', 'Toys', 'gift', 3);
select pg_temp.cat('bebek', 'bebek-odasi', 'Bebek odası', 'Nursery', 'bed', 4);

-- Spor & Outdoor
select pg_temp.cat('spor', 'bisiklet', 'Bisiklet', 'Bicycles', 'bike', 1);
select pg_temp.cat('spor', 'fitness', 'Fitness & Kondisyon', 'Fitness', 'dumbbell', 2);
select pg_temp.cat('spor', 'su-sporlari', 'Su sporları & Dalış', 'Water sports & diving', 'wave', 3);
select pg_temp.cat('spor', 'kamp-outdoor', 'Kamp & Outdoor', 'Camping & outdoors', 'tent', 4);
select pg_temp.cat('spor', 'takim-sporlari', 'Takım & Raket sporları', 'Team & racket sports', 'ball', 5);

-- Kitap & Eğitim
select pg_temp.cat('kitap', 'ders-kitabi', 'Ders kitabı & Akademik', 'Textbooks & academic', 'book', 1);
select pg_temp.cat('kitap', 'roman-edebiyat', 'Roman & Edebiyat', 'Fiction & literature', 'book', 2);
select pg_temp.cat('kitap', 'cocuk-kitaplari', 'Çocuk kitapları', 'Children''s books', 'book', 3);

-- Hobi & Müzik
select pg_temp.cat('hobi', 'muzik-aletleri', 'Müzik aletleri', 'Musical instruments', 'music', 1);
select pg_temp.cat('hobi', 'koleksiyon', 'Koleksiyon & Antika', 'Collectibles & antiques', 'star', 2);
select pg_temp.cat('hobi', 'kutu-oyunlari', 'Kutu oyunu & Puzzle', 'Board games & puzzles', 'puzzle', 3);
select pg_temp.cat('hobi', 'el-sanatlari', 'El sanatları & Sanat malzemesi', 'Arts & crafts', 'brush', 4);

-- Alet & Bahçe
select pg_temp.cat('alet-bahce', 'el-aletleri', 'El aletleri', 'Hand tools', 'tool', 1);
select pg_temp.cat('alet-bahce', 'elektrikli-aletler', 'Elektrikli aletler', 'Power tools', 'tool', 2);
select pg_temp.cat('alet-bahce', 'bahce-ekipmanlari', 'Bahçe ekipmanları', 'Garden equipment', 'leaf', 3);

-- ---------------------------------------------------------------------------
-- Category attributes
-- ---------------------------------------------------------------------------

-- Ev & Mobilya
select pg_temp.attr('mobilya', 'material', 'Malzeme', 'Material', 'select',
  pg_temp.opts('Ahşap', 'MDF / Sunta', 'Metal', 'Cam', 'Kumaş', 'Deri', 'Suni deri', 'Rattan / Hasır', 'Plastik', 'Mermer / Taş', 'Diğer'),
  p_filterable => true, p_highlight => true, p_group => 'Ölçü & Malzeme', p_sort => 20);
select pg_temp.attr('mobilya', 'width_cm', 'Genişlik', 'Width', 'number', p_unit => 'cm', p_min => 1, p_max => 1000, p_group => 'Ölçü & Malzeme', p_sort => 21);
select pg_temp.attr('mobilya', 'height_cm', 'Yükseklik', 'Height', 'number', p_unit => 'cm', p_min => 1, p_max => 1000, p_group => 'Ölçü & Malzeme', p_sort => 22);
select pg_temp.attr('mobilya', 'depth_cm', 'Derinlik', 'Depth', 'number', p_unit => 'cm', p_min => 1, p_max => 1000, p_group => 'Ölçü & Malzeme', p_sort => 23);
select pg_temp.attr('mobilya', 'assembly', 'Montaj', 'Assembly', 'select',
  pg_temp.opts('Kurulu', 'Demonte', 'Sökülmesi gerekiyor'), p_group => 'Teslimat', p_sort => 92);

select pg_temp.attr('koltuk-kanepe', 'sofa_type', 'Tür', 'Type', 'select',
  pg_temp.opts('Kanepe', 'Köşe koltuk', 'Berjer / Tekli koltuk', 'Koltuk takımı', 'Yataklı kanepe', 'Puf'),
  p_required => true, p_filterable => true, p_highlight => true, p_group => 'Genel', p_sort => 1);
select pg_temp.attr('koltuk-kanepe', 'seats', 'Oturma kapasitesi', 'Seats', 'number', p_unit => 'kişilik', p_min => 1, p_max => 12,
  p_filterable => true, p_highlight => true, p_group => 'Genel', p_sort => 2);

select pg_temp.attr('yatak-odasi', 'bedroom_item', 'Ürün', 'Item', 'select',
  pg_temp.opts('Yatak', 'Baza / Karyola', 'Gardırop', 'Komodin', 'Şifonyer', 'Yatak odası takımı'),
  p_required => true, p_filterable => true, p_highlight => true, p_group => 'Genel', p_sort => 1);
select pg_temp.attr('yatak-odasi', 'bed_size', 'Yatak ölçüsü', 'Bed size', 'select',
  pg_temp.opts('Tek kişilik', 'Çift kişilik', 'Queen', 'King'), p_filterable => true, p_group => 'Genel', p_sort => 2);

select pg_temp.attr('masa-sandalye', 'table_item', 'Ürün', 'Item', 'select',
  pg_temp.opts('Yemek masası', 'Masa takımı', 'Sandalye', 'Orta sehpa', 'Çalışma masası', 'Bar taburesi'),
  p_required => true, p_filterable => true, p_highlight => true, p_group => 'Genel', p_sort => 1);
select pg_temp.attr('masa-sandalye', 'seats', 'Kaç kişilik', 'Seats', 'number', p_unit => 'kişilik', p_min => 1, p_max => 20,
  p_filterable => true, p_group => 'Genel', p_sort => 2);

select pg_temp.attr('dolap-depolama', 'storage_item', 'Ürün', 'Item', 'select',
  pg_temp.opts('Kitaplık / Raf', 'TV ünitesi', 'Vitrin', 'Ayakkabılık', 'Çekmece', 'Diğer'),
  p_filterable => true, p_highlight => true, p_group => 'Genel', p_sort => 1);

select pg_temp.attr('ofis-mobilyasi', 'office_item', 'Ürün', 'Item', 'select',
  pg_temp.opts('Çalışma masası', 'Ofis sandalyesi', 'Dosya dolabı', 'Toplantı masası', 'Diğer'),
  p_filterable => true, p_highlight => true, p_group => 'Genel', p_sort => 1);

-- Decor, kitchenware and textiles are not measured furniture.
select pg_temp.hide('dekorasyon-aydinlatma', 'assembly');
select pg_temp.hide('mutfak-sofra', 'assembly');
select pg_temp.hide('ev-tekstili', 'assembly');
select pg_temp.hide('ev-tekstili', 'material');
select pg_temp.hide('mutfak-sofra', 'width_cm');
select pg_temp.hide('mutfak-sofra', 'height_cm');
select pg_temp.hide('mutfak-sofra', 'depth_cm');

-- Elektronik: phones
select pg_temp.attr('cep-telefonu', 'brand', 'Marka', 'Brand', 'select',
  pg_temp.opts('Apple', 'Samsung', 'Xiaomi', 'Huawei', 'Google', 'Oppo', 'OnePlus', 'Honor', 'Realme', 'Nokia', 'Motorola', 'Diğer'),
  p_required => true, p_filterable => true, p_highlight => true, p_group => 'Genel', p_sort => 1);
select pg_temp.attr('cep-telefonu', 'model', 'Model', 'Model', 'text', p_required => true, p_highlight => true,
  p_group => 'Genel', p_sort => 2, p_max_length => 60, p_placeholder => 'Örn. iPhone 13 Pro');
select pg_temp.attr('cep-telefonu', 'storage_gb', 'Depolama', 'Storage', 'select', pg_temp.nopts('GB', 32, 64, 128, 256, 512, 1024),
  p_filterable => true, p_highlight => true, p_group => 'Teknik', p_sort => 20);
select pg_temp.attr('cep-telefonu', 'ram_gb', 'RAM', 'RAM', 'select', pg_temp.nopts('GB', 2, 3, 4, 6, 8, 12, 16),
  p_filterable => true, p_group => 'Teknik', p_sort => 21);
select pg_temp.attr('cep-telefonu', 'battery_health', 'Pil sağlığı', 'Battery health', 'number', p_unit => '%', p_min => 1, p_max => 100,
  p_filterable => true, p_highlight => true, p_group => 'Teknik', p_sort => 22);
select pg_temp.attr('cep-telefonu', 'sim', 'SIM', 'SIM', 'select', pg_temp.opts('Tek SIM', 'Çift SIM', 'SIM + eSIM', 'Yalnızca eSIM'),
  p_filterable => true, p_group => 'Teknik', p_sort => 23);
select pg_temp.attr('cep-telefonu', 'screen_condition', 'Ekran durumu', 'Screen condition', 'select',
  pg_temp.opts('Kusursuz', 'Hafif çizik', 'Belirgin çizik', 'Kırık / Çatlak'), p_filterable => true, p_group => 'Durum', p_sort => 70);
select pg_temp.attr('cep-telefonu', 'repair_history', 'Tamir geçmişi', 'Repair history', 'select',
  pg_temp.opts('Hiç tamir görmedi', 'Ekran değişti', 'Pil değişti', 'Başka parça değişti'), p_group => 'Durum', p_sort => 71);

-- Laptops
select pg_temp.attr('dizustu-bilgisayar', 'brand', 'Marka', 'Brand', 'select',
  pg_temp.opts('Apple', 'Lenovo', 'HP', 'Dell', 'Asus', 'Acer', 'MSI', 'Microsoft', 'Huawei', 'Samsung', 'Diğer'),
  p_required => true, p_filterable => true, p_highlight => true, p_group => 'Genel', p_sort => 1);
select pg_temp.attr('dizustu-bilgisayar', 'model', 'Model', 'Model', 'text', p_required => true, p_group => 'Genel', p_sort => 2,
  p_max_length => 60, p_placeholder => 'Örn. MacBook Air M1, ThinkPad T14');
select pg_temp.attr('dizustu-bilgisayar', 'cpu', 'İşlemci', 'Processor', 'text', p_highlight => true, p_group => 'Teknik', p_sort => 20,
  p_max_length => 60, p_placeholder => 'Örn. Intel Core i5-1135G7, Apple M2');
select pg_temp.attr('dizustu-bilgisayar', 'ram_gb', 'RAM', 'RAM', 'select', pg_temp.nopts('GB', 4, 8, 16, 24, 32, 64),
  p_filterable => true, p_highlight => true, p_group => 'Teknik', p_sort => 21);
select pg_temp.attr('dizustu-bilgisayar', 'storage_gb', 'Depolama', 'Storage', 'select', pg_temp.nopts('GB', 128, 256, 512, 1024, 2048),
  p_filterable => true, p_highlight => true, p_group => 'Teknik', p_sort => 22);
select pg_temp.attr('dizustu-bilgisayar', 'storage_type', 'Disk türü', 'Drive type', 'select', pg_temp.opts('SSD', 'HDD', 'SSD + HDD'),
  p_group => 'Teknik', p_sort => 23);
select pg_temp.attr('dizustu-bilgisayar', 'gpu', 'Ekran kartı', 'Graphics', 'text', p_group => 'Teknik', p_sort => 24, p_max_length => 60,
  p_placeholder => 'Örn. dahili, RTX 3060');
select pg_temp.attr('dizustu-bilgisayar', 'screen_inch', 'Ekran boyutu', 'Screen size', 'number', p_unit => 'inç', p_min => 10, p_max => 20,
  p_filterable => true, p_group => 'Teknik', p_sort => 25);
select pg_temp.attr('dizustu-bilgisayar', 'battery_condition', 'Pil durumu', 'Battery condition', 'select',
  pg_temp.opts('İyi', 'Orta', 'Zayıf', 'Değişmesi gerekiyor'), p_group => 'Durum', p_sort => 70);
select pg_temp.attr('dizustu-bilgisayar', 'charger', 'Şarj aleti var', 'Charger included', 'boolean', p_group => 'Durum', p_sort => 72);

-- Desktops & monitors
select pg_temp.attr('masaustu-bilgisayar', 'desktop_item', 'Ürün', 'Item', 'select',
  pg_temp.opts('Masaüstü bilgisayar', 'Monitör', 'Bileşen / Parça', 'Klavye / Mouse', 'Yazıcı', 'Ağ ürünü'),
  p_required => true, p_filterable => true, p_highlight => true, p_group => 'Genel', p_sort => 1);
select pg_temp.attr('masaustu-bilgisayar', 'cpu', 'İşlemci', 'Processor', 'text', p_group => 'Teknik', p_sort => 20, p_max_length => 60);
select pg_temp.attr('masaustu-bilgisayar', 'ram_gb', 'RAM', 'RAM', 'select', pg_temp.nopts('GB', 4, 8, 16, 32, 64, 128),
  p_filterable => true, p_group => 'Teknik', p_sort => 21);
select pg_temp.attr('masaustu-bilgisayar', 'gpu', 'Ekran kartı', 'Graphics', 'text', p_group => 'Teknik', p_sort => 22, p_max_length => 60);
select pg_temp.attr('masaustu-bilgisayar', 'screen_inch', 'Ekran boyutu', 'Screen size', 'number', p_unit => 'inç', p_min => 10, p_max => 60,
  p_group => 'Teknik', p_sort => 23);

-- Tablets
select pg_temp.attr('tablet', 'brand', 'Marka', 'Brand', 'select',
  pg_temp.opts('Apple', 'Samsung', 'Lenovo', 'Xiaomi', 'Huawei', 'Amazon', 'Diğer'),
  p_required => true, p_filterable => true, p_highlight => true, p_group => 'Genel', p_sort => 1);
select pg_temp.attr('tablet', 'storage_gb', 'Depolama', 'Storage', 'select', pg_temp.nopts('GB', 16, 32, 64, 128, 256, 512, 1024),
  p_filterable => true, p_highlight => true, p_group => 'Teknik', p_sort => 20);
select pg_temp.attr('tablet', 'connectivity', 'Bağlantı', 'Connectivity', 'select', pg_temp.opts('Wi-Fi', 'Wi-Fi + Hücresel'),
  p_filterable => true, p_group => 'Teknik', p_sort => 21);
select pg_temp.attr('tablet', 'screen_inch', 'Ekran boyutu', 'Screen size', 'number', p_unit => 'inç', p_min => 6, p_max => 15,
  p_group => 'Teknik', p_sort => 22);

-- Gaming
select pg_temp.attr('oyun-konsol', 'platform', 'Platform', 'Platform', 'select',
  pg_temp.opts('PlayStation 5', 'PlayStation 4', 'Xbox Series X|S', 'Xbox One', 'Nintendo Switch', 'PC', 'Diğer'),
  p_required => true, p_filterable => true, p_highlight => true, p_group => 'Genel', p_sort => 1);
select pg_temp.attr('oyun-konsol', 'gaming_item', 'Ürün', 'Item', 'select', pg_temp.opts('Konsol', 'Oyun', 'Kol / Aksesuar', 'VR'),
  p_required => true, p_filterable => true, p_highlight => true, p_group => 'Genel', p_sort => 2);
select pg_temp.hide('oyun-konsol', 'brand');

-- TV & audio
select pg_temp.attr('tv-ses', 'av_item', 'Ürün', 'Item', 'select',
  pg_temp.opts('Televizyon', 'Soundbar', 'Hoparlör', 'Kulaklık', 'Amfi / Receiver', 'Projeksiyon'),
  p_required => true, p_filterable => true, p_highlight => true, p_group => 'Genel', p_sort => 1);
select pg_temp.attr('tv-ses', 'screen_inch', 'Ekran boyutu', 'Screen size', 'number', p_unit => 'inç', p_min => 10, p_max => 120,
  p_filterable => true, p_highlight => true, p_group => 'Teknik', p_sort => 20);
select pg_temp.attr('tv-ses', 'resolution', 'Çözünürlük', 'Resolution', 'select', pg_temp.opts('HD', 'Full HD', '4K', '8K'),
  p_filterable => true, p_group => 'Teknik', p_sort => 21);
select pg_temp.attr('tv-ses', 'smart_tv', 'Smart TV', 'Smart TV', 'boolean', p_group => 'Teknik', p_sort => 22);

-- Cameras
select pg_temp.attr('fotograf-kamera', 'camera_item', 'Ürün', 'Item', 'select',
  pg_temp.opts('Fotoğraf makinesi', 'Objektif', 'Aksiyon kamerası', 'Drone', 'Video kamera', 'Aksesuar'),
  p_required => true, p_filterable => true, p_highlight => true, p_group => 'Genel', p_sort => 1);
select pg_temp.attr('fotograf-kamera', 'brand', 'Marka', 'Brand', 'select',
  pg_temp.opts('Canon', 'Nikon', 'Sony', 'Fujifilm', 'Panasonic', 'Olympus', 'GoPro', 'DJI', 'Diğer'),
  p_filterable => true, p_highlight => true, p_group => 'Genel', p_sort => 2);
select pg_temp.attr('fotograf-kamera', 'shutter_count', 'Deklanşör sayısı', 'Shutter count', 'number', p_min => 0, p_max => 2000000,
  p_group => 'Teknik', p_sort => 20);

-- Giyim & Aksesuar
select pg_temp.attr('giyim', 'size', 'Beden', 'Size', 'select',
  pg_temp.opts('XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', 'Tek beden'),
  p_filterable => true, p_highlight => true, p_group => 'Genel', p_sort => 1);
select pg_temp.attr('ayakkabi', 'shoe_size', 'Numara', 'Shoe size', 'number', p_min => 16, p_max => 50,
  p_filterable => true, p_highlight => true, p_group => 'Genel', p_sort => 1);
select pg_temp.attr('ayakkabi', 'gender', 'Kimin için', 'For', 'select', pg_temp.opts('Kadın', 'Erkek', 'Unisex', 'Çocuk'),
  p_filterable => true, p_group => 'Genel', p_sort => 2);
select pg_temp.hide('ayakkabi', 'size');
select pg_temp.attr('canta', 'gender', 'Kimin için', 'For', 'select', pg_temp.opts('Kadın', 'Erkek', 'Unisex', 'Çocuk'),
  p_filterable => true, p_group => 'Genel', p_sort => 2);
select pg_temp.hide('canta', 'size');
select pg_temp.hide('saat-taki', 'size');
select pg_temp.attr('saat-taki', 'authenticity', 'Orijinallik', 'Authenticity', 'select',
  pg_temp.opts('Orijinal, belgesi var', 'Orijinal, belgesi yok'), p_group => 'Durum', p_sort => 70,
  p_help => 'Replika ürün satışı kurallarımıza aykırıdır.');

-- Araç
select pg_temp.attr('arac', 'model_year', 'Model yılı', 'Model year', 'year', p_min => 1950,
  p_filterable => true, p_highlight => true, p_group => 'Genel', p_sort => 3);
select pg_temp.attr('arac', 'km', 'Kilometre', 'Mileage', 'number', p_unit => 'km', p_min => 0, p_max => 2000000,
  p_filterable => true, p_highlight => true, p_group => 'Teknik', p_sort => 20);
select pg_temp.attr('arac', 'fuel', 'Yakıt', 'Fuel', 'select', pg_temp.opts('Benzin', 'Dizel', 'Hibrit', 'Elektrik', 'LPG'),
  p_filterable => true, p_highlight => true, p_group => 'Teknik', p_sort => 21);
select pg_temp.attr('arac', 'transmission', 'Vites', 'Transmission', 'select', pg_temp.opts('Manuel', 'Otomatik'),
  p_filterable => true, p_group => 'Teknik', p_sort => 22);
-- Cyprus drives on the left; imported cars come both ways.
select pg_temp.attr('arac', 'steering', 'Direksiyon', 'Steering', 'select', pg_temp.opts('Sağdan direksiyon', 'Soldan direksiyon'),
  p_filterable => true, p_group => 'Teknik', p_sort => 23);
select pg_temp.hide('yedek-parca', 'km');
select pg_temp.hide('yedek-parca', 'fuel');
select pg_temp.hide('yedek-parca', 'transmission');
select pg_temp.hide('yedek-parca', 'steering');
select pg_temp.hide('yedek-parca', 'model_year');
select pg_temp.hide('motosiklet', 'transmission');
select pg_temp.hide('motosiklet', 'steering');
select pg_temp.hide('arac', 'year');

-- Ev aletleri
select pg_temp.attr('beyaz-esya', 'appliance_item', 'Ürün', 'Item', 'select',
  pg_temp.opts('Buzdolabı', 'Çamaşır makinesi', 'Kurutma makinesi', 'Bulaşık makinesi', 'Fırın / Ocak', 'Derin dondurucu'),
  p_required => true, p_filterable => true, p_highlight => true, p_group => 'Genel', p_sort => 1);
select pg_temp.attr('beyaz-esya', 'energy_class', 'Enerji sınıfı', 'Energy class', 'select',
  pg_temp.opts('A+++', 'A++', 'A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G'), p_filterable => true, p_group => 'Teknik', p_sort => 20);
select pg_temp.attr('klima-isitma', 'climate_item', 'Ürün', 'Item', 'select',
  pg_temp.opts('Split klima', 'Portatif klima', 'Vantilatör', 'Isıtıcı', 'Nem alma cihazı', 'Su ısıtıcı / Termosifon'),
  p_required => true, p_filterable => true, p_highlight => true, p_group => 'Genel', p_sort => 1);
select pg_temp.attr('klima-isitma', 'btu', 'Kapasite', 'Capacity', 'select', pg_temp.nopts('BTU', 7000, 9000, 12000, 18000, 24000),
  p_filterable => true, p_highlight => true, p_group => 'Teknik', p_sort => 20);
select pg_temp.attr('klima-isitma', 'inverter', 'Inverter', 'Inverter', 'boolean', p_group => 'Teknik', p_sort => 21);
select pg_temp.attr('kucuk-ev-aletleri', 'small_item', 'Ürün', 'Item', 'select',
  pg_temp.opts('Süpürge', 'Kahve makinesi', 'Mutfak robotu', 'Airfryer / Fritöz', 'Ütü', 'Mikrodalga', 'Kişisel bakım', 'Diğer'),
  p_filterable => true, p_highlight => true, p_group => 'Genel', p_sort => 1);

-- Bebek & Çocuk
select pg_temp.attr('bebek-cocuk-giyim', 'age_range', 'Yaş aralığı', 'Age', 'select',
  pg_temp.opts('0-3 ay', '3-6 ay', '6-12 ay', '1-2 yaş', '2-4 yaş', '4-6 yaş', '6-8 yaş', '8-12 yaş'),
  p_required => true, p_filterable => true, p_highlight => true, p_group => 'Genel', p_sort => 1);
select pg_temp.attr('bebek-cocuk-giyim', 'gender', 'Kimin için', 'For', 'select', pg_temp.opts('Kız', 'Erkek', 'Unisex'),
  p_filterable => true, p_group => 'Genel', p_sort => 2);
select pg_temp.attr('oyuncak', 'age_range', 'Yaş grubu', 'Age', 'select',
  pg_temp.opts('0-1 yaş', '1-3 yaş', '3-6 yaş', '6-9 yaş', '9+ yaş'), p_filterable => true, p_highlight => true, p_group => 'Genel', p_sort => 1);
select pg_temp.attr('bebek-arabasi-koltuk', 'baby_item', 'Ürün', 'Item', 'select',
  pg_temp.opts('Bebek arabası', 'Puset', 'Oto koltuğu', 'Travel sistem', 'Ana kucağı'),
  p_required => true, p_filterable => true, p_highlight => true, p_group => 'Genel', p_sort => 1);

-- Spor & Outdoor
select pg_temp.attr('bisiklet', 'bike_type', 'Bisiklet türü', 'Bike type', 'select',
  pg_temp.opts('Dağ bisikleti', 'Yol bisikleti', 'Şehir bisikleti', 'Elektrikli bisiklet', 'Katlanır bisiklet', 'Çocuk bisikleti', 'BMX'),
  p_required => true, p_filterable => true, p_highlight => true, p_group => 'Genel', p_sort => 1);
select pg_temp.attr('bisiklet', 'wheel_inch', 'Jant', 'Wheel size', 'select', pg_temp.nopts('inç', 12, 14, 16, 20, 24, 26, 27, 28, 29),
  p_filterable => true, p_highlight => true, p_group => 'Teknik', p_sort => 20);
select pg_temp.attr('bisiklet', 'frame_size', 'Kadro', 'Frame size', 'select', pg_temp.opts('XS', 'S', 'M', 'L', 'XL'),
  p_filterable => true, p_group => 'Teknik', p_sort => 21);

-- Kitap & Eğitim
select pg_temp.attr('kitap', 'author', 'Yazar', 'Author', 'text', p_highlight => true, p_group => 'Genel', p_sort => 1, p_max_length => 80);
select pg_temp.attr('kitap', 'language', 'Dil', 'Language', 'select', pg_temp.opts('Türkçe', 'İngilizce', 'Rusça', 'Yunanca', 'Almanca', 'Diğer'),
  p_filterable => true, p_highlight => true, p_group => 'Genel', p_sort => 2);
select pg_temp.attr('ders-kitabi', 'course', 'Ders / Bölüm', 'Course', 'text', p_group => 'Genel', p_sort => 3, p_max_length => 80,
  p_placeholder => 'Örn. MATH101, Tıp 1. sınıf');
select pg_temp.hide('kitap', 'brand');
select pg_temp.hide('kitap', 'model');
select pg_temp.hide('kitap', 'color');
select pg_temp.hide('kitap', 'warranty');
select pg_temp.hide('kitap', 'invoice');
select pg_temp.hide('kitap', 'box');

-- Hobi & Müzik
select pg_temp.attr('muzik-aletleri', 'instrument', 'Enstrüman', 'Instrument', 'select',
  pg_temp.opts('Gitar', 'Elektro gitar', 'Bas gitar', 'Piyano / Klavye', 'Davul / Perküsyon', 'Yaylı', 'Nefesli', 'Bağlama', 'Ekipman / Amfi', 'Diğer'),
  p_required => true, p_filterable => true, p_highlight => true, p_group => 'Genel', p_sort => 1);

-- Alet & Bahçe
select pg_temp.attr('elektrikli-aletler', 'power_source', 'Güç kaynağı', 'Power source', 'select', pg_temp.opts('Kablolu', 'Akülü', 'Benzinli'),
  p_filterable => true, p_highlight => true, p_group => 'Teknik', p_sort => 20);
