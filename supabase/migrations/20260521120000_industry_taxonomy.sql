-- Migration: Session 1 (онбординг) — industry taxonomy
-- См. wiki/decisions/0019-mvp-scope-platforms-and-industry.md § 2
-- См. wiki/raw/industry-taxonomy-curated-2026-05-21.md (source-of-truth для seed)
-- Plan-eng-review: ~/.gstack/projects/wow-solutions-Quoteworthy-internal/user-main-eng-review-test-plan-20260521-225703.md
--
-- Schema:
--   1. industry_categories (146 rows seed; name_en + name_ru + keywords[] + generated searchable + gist trgm index)
--   2. industry_requests (waitlist для категорий не в каталоге)
--   3. industry_search_misses (instrumentation для self-learning catalog)
--   4. brands.industry_category_id FK (nullable; legacy brands.industry text оставлен для backward compat)
--   5. RPC search_industries(query, lang, limit) — top-N similarity-ranked
--   6. RPC submit_industry_request — waitlist insert через security invoker
--   7. RPC log_industry_search_miss — instrumentation insert
--   8. RLS: categories public-read, requests/misses own-account
--   9. SEED 146 категорий (RU + EN + keywords)
--  10. Backfill 24 Clima → Commercial HVAC, WOW SOLUTIONS → AI Consulting

-- ════════════════════════════════════════════════════════════════════
-- 0) Immutable wrapper для array_to_string (нужен generated column ниже).
-- ════════════════════════════════════════════════════════════════════
-- Postgres помечает array_to_string(text[], text) как STABLE — generated column
-- требует IMMUTABLE. Wrapper это известный паттерн (см. PG mailing list 2019).
create or replace function public.immutable_array_to_string(arr text[], delim text)
returns text
language sql
immutable
parallel safe
as $$ select array_to_string(arr, delim) $$;

-- ════════════════════════════════════════════════════════════════════
-- 1) industry_categories
-- ════════════════════════════════════════════════════════════════════
create table public.industry_categories (
  id uuid primary key default gen_random_uuid(),
  name_en text not null,
  name_ru text not null,
  name_es text,                              -- nullable, TODO #14 при первом es-locale user
  industry_group text not null,              -- 'Food Service', 'Trades' etc. — для будущего browse UI
  keywords text[] not null default '{}',     -- триггеры для fuzzy search (RU + EN colloquial)
  searchable text generated always as (
    name_en || ' ' || name_ru || ' ' || public.immutable_array_to_string(keywords, ' ')
  ) stored,                                  -- concat для pg_trgm gist (P1 perf finding из eng-review)
  is_dogfood_anchor boolean not null default false,  -- visibility flag для testing/QA
  created_at timestamptz not null default now()
);

comment on table public.industry_categories is
  'Curated industry catalog для wizard self-ID. ~146 rows seed. ADR-0019 § 2. Self-learning через industry_requests + industry_search_misses.';

comment on column public.industry_categories.searchable is
  'Generated column для pg_trgm gist index. Без неё gist на text[] не работает (P1 из plan-eng-review).';

-- pg_trgm gist index для ORDER BY similarity DESC queries
create index industry_categories_searchable_trgm_idx
  on public.industry_categories using gist (searchable extensions.gist_trgm_ops);

-- Unique constraint на name_en (case-insensitive) чтобы избежать дублей при будущих add'ах через waitlist
create unique index industry_categories_name_en_uniq
  on public.industry_categories(lower(name_en));

-- ════════════════════════════════════════════════════════════════════
-- 2) industry_requests (waitlist)
-- ════════════════════════════════════════════════════════════════════
create table public.industry_requests (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references public.brands(id) on delete set null,        -- nullable: можно submit'нуть из wizard до создания brand
  account_id uuid not null references public.accounts(id) on delete cascade,
  query_text text not null,                                              -- что юзер искал / описание желаемой категории
  email text,                                                            -- optional, для ответа когда добавим
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  approved_category_id uuid references public.industry_categories(id),   -- заполняется при approve через admin UI (TODO #13)
  created_at timestamptz not null default now()
);

comment on table public.industry_requests is
  'Waitlist для категорий не в каталоге. Admin review UI = TODO #13 (>10 запросов trigger).';

create index industry_requests_account_idx
  on public.industry_requests(account_id);

create index industry_requests_status_idx
  on public.industry_requests(status, created_at desc)
  where status = 'pending';

-- ════════════════════════════════════════════════════════════════════
-- 3) industry_search_misses (instrumentation для self-learning)
-- ════════════════════════════════════════════════════════════════════
create table public.industry_search_misses (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references public.brands(id) on delete set null,    -- nullable если search из wizard pre-brand
  account_id uuid not null references public.accounts(id) on delete cascade,
  query_text text not null,                                          -- что юзер напечатал
  top_5_ids uuid[] not null default '{}',                            -- IDs категорий которые показали (пусто если 0 hits)
  picked_index integer,                                              -- 0-4 если выбрал из top-5, null если ничего
  clicked_other boolean not null default false,                      -- кликнул «Не нашли свою?» CTA
  created_at timestamptz not null default now()
);

comment on table public.industry_search_misses is
  'Instrumentation для self-learning catalog: каждый search где 0 hits OR user не выбрал. Fuel для auto-suggest layer (TODO #15).';

create index industry_search_misses_account_idx
  on public.industry_search_misses(account_id);

create index industry_search_misses_created_idx
  on public.industry_search_misses(created_at desc);

-- ════════════════════════════════════════════════════════════════════
-- 4) brands.industry_category_id FK
-- ════════════════════════════════════════════════════════════════════
-- Add nullable FK column. Legacy brands.industry text column оставлен для backward compat
-- (drop в Sprint 1B+ когда ничего не читает).
alter table public.brands
  add column industry_category_id uuid references public.industry_categories(id) on delete set null;

create index brands_industry_category_idx
  on public.brands(industry_category_id)
  where deleted_at is null;

-- ════════════════════════════════════════════════════════════════════
-- 5) RPC search_industries — top-N similarity-ranked
-- ════════════════════════════════════════════════════════════════════
-- Returns top-N категорий ранжированных по pg_trgm similarity.
-- Threshold 0.1 (мягкий) чтобы возвращать candidates даже на коротких RU queries
-- типа «торты» — UI решает что показывать (default = всё что вернул RPC).
--
-- p_lang param сейчас not used в SQL (searchable combines both langs),
-- но в signature для future per-language boost ranking.
--
-- security invoker: RLS на industry_categories = public-read, RPC OK без elevation.
create or replace function public.search_industries(
  p_query text,
  p_lang text default 'en',
  p_limit int default 5
)
returns table (
  id uuid,
  name_en text,
  name_ru text,
  industry_group text,
  similarity real
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.id,
    c.name_en,
    c.name_ru,
    c.industry_group,
    extensions.similarity(c.searchable, p_query) as similarity
  from public.industry_categories c
  where extensions.similarity(c.searchable, p_query) > 0.1
  order by extensions.similarity(c.searchable, p_query) desc
  limit p_limit;
$$;

comment on function public.search_industries is
  'Fuzzy search across name_en+name_ru+keywords. Threshold 0.1 (мягкий). Sprint 1 Session 1.';

grant execute on function public.search_industries(text, text, int) to authenticated;

-- ════════════════════════════════════════════════════════════════════
-- 6) RPC submit_industry_request — waitlist insert
-- ════════════════════════════════════════════════════════════════════
create or replace function public.submit_industry_request(
  p_brand_id uuid,
  p_query_text text,
  p_email text default null
)
returns public.industry_requests
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_account_id uuid;
  v_request public.industry_requests;
begin
  v_account_id := auth.uid();
  if v_account_id is null then
    raise exception 'unauthenticated' using errcode = '42501';
  end if;
  -- Verify brand belongs to account (if provided)
  if p_brand_id is not null then
    if not exists (
      select 1 from public.brands
      where id = p_brand_id and account_id = v_account_id
    ) then
      raise exception 'brand does not belong to account' using errcode = '42501';
    end if;
  end if;
  insert into public.industry_requests (brand_id, account_id, query_text, email)
  values (p_brand_id, v_account_id, p_query_text, p_email)
  returning * into v_request;
  return v_request;
end;
$$;

comment on function public.submit_industry_request is
  'Waitlist insert. Defense-in-depth: проверяет brand ownership через account_id.';

grant execute on function public.submit_industry_request(uuid, text, text) to authenticated;

-- ════════════════════════════════════════════════════════════════════
-- 7) RPC log_industry_search_miss — instrumentation
-- ════════════════════════════════════════════════════════════════════
-- Silent fail для unauthenticated — instrumentation не должна ломать UX.
create or replace function public.log_industry_search_miss(
  p_brand_id uuid,
  p_query_text text,
  p_top_5_ids uuid[] default '{}',
  p_picked_index int default null,
  p_clicked_other boolean default false
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_account_id uuid;
begin
  v_account_id := auth.uid();
  if v_account_id is null then
    return;  -- silent: instrumentation не critical
  end if;
  insert into public.industry_search_misses (
    brand_id, account_id, query_text, top_5_ids, picked_index, clicked_other
  )
  values (
    p_brand_id, v_account_id, p_query_text, p_top_5_ids, p_picked_index, p_clicked_other
  );
end;
$$;

comment on function public.log_industry_search_miss is
  'Instrumentation insert. Silent fail для unauthenticated. Fuel для TODO #15 auto-suggest.';

grant execute on function public.log_industry_search_miss(uuid, text, uuid[], int, boolean) to authenticated;

-- ════════════════════════════════════════════════════════════════════
-- 8) RLS
-- ════════════════════════════════════════════════════════════════════
-- industry_categories: public-read для всех authenticated. Write = service-role only.
alter table public.industry_categories enable row level security;

create policy "anyone authenticated can read industry_categories"
  on public.industry_categories for select
  to authenticated
  using (true);

-- industry_requests: read = own account, write via RPC (security invoker)
alter table public.industry_requests enable row level security;

create policy "users can read own industry_requests"
  on public.industry_requests for select
  using (account_id = (select auth.uid()));

-- industry_search_misses: read = own account, write via RPC
alter table public.industry_search_misses enable row level security;

create policy "users can read own industry_search_misses"
  on public.industry_search_misses for select
  using (account_id = (select auth.uid()));

-- ════════════════════════════════════════════════════════════════════
-- 9) SEED — 146 категорий
-- ════════════════════════════════════════════════════════════════════
-- Source: wiki/raw/industry-taxonomy-curated-2026-05-21.md
-- Dogfood anchors marked is_dogfood_anchor = true (24Clima HVAC ×3, marine ×5, dalnoboy ×2, Uzbek, Quoteworthy ×3 = 14 anchors)

insert into public.industry_categories (name_en, name_ru, industry_group, keywords, is_dogfood_anchor) values
-- Food Service (14)
('Italian Restaurant', 'Итальянский ресторан', 'Food Service', ARRAY['italian restaurant','итальянский ресторан','пицца','паста','ristorante'], false),
('Asian Restaurant', 'Азиатский ресторан', 'Food Service', ARRAY['asian restaurant','азиатский ресторан','суши','лапша','рамен','тайская кухня'], false),
('Latin Restaurant', 'Латиноамериканский ресторан', 'Food Service', ARRAY['latin restaurant','мексиканская кухня','тако','латиноамериканский ресторан','peruvian','panamanian'], false),
('Uzbek Restaurant', 'Узбекский ресторан', 'Food Service', ARRAY['uzbek','узбекский','плов','манты','самса','лагман','центральная азия','central asian'], true),
('Mediterranean Restaurant', 'Средиземноморский ресторан', 'Food Service', ARRAY['mediterranean','средиземноморская кухня','греческая','ливанская','hummus'], false),
('Steakhouse', 'Стейк-хаус', 'Food Service', ARRAY['steakhouse','стейк-хаус','мясной ресторан','grill','parrilla'], false),
('Seafood Restaurant', 'Ресторан морепродуктов', 'Food Service', ARRAY['seafood','морепродукты','рыбный ресторан','ceviche'], false),
('Fast Food', 'Фастфуд', 'Food Service', ARRAY['fast food','фастфуд','бургерная','qsr','quick service'], false),
('Cafe / Coffee Shop', 'Кафе / Кофейня', 'Food Service', ARRAY['cafe','кофейня','coffee shop','espresso','бариста','кофе'], false),
('Bakery', 'Пекарня', 'Food Service', ARRAY['bakery','пекарня','торты','выпечка','делаю торты','кондитерская','croissant'], false),
('Bar / Pub', 'Бар / Паб', 'Food Service', ARRAY['bar','паб','pub','коктейли','craft beer','крафтовое пиво'], false),
('Pizzeria', 'Пиццерия', 'Food Service', ARRAY['pizzeria','пиццерия','pizza place','делаю пиццу'], false),
('Food Truck', 'Фудтрак', 'Food Service', ARRAY['food truck','фудтрак','mobile food','street food'], false),
('Catering Small Business', 'Кейтеринг', 'Food Service', ARRAY['catering','кейтеринг','банкет','выездное питание','event food'], false),

-- HVAC / Trades (10) — D: 24Clima
('Residential HVAC', 'Бытовое кондиционирование', 'Trades', ARRAY['hvac','air conditioning','кондиционер','кондиционеры','ставлю кондиционеры','сплит-система','ac repair','бытовое hvac'], true),
('Commercial HVAC', 'Промышленное кондиционирование', 'Trades', ARRAY['commercial hvac','промышленное кондиционирование','чиллер','climate control b2b','vrf'], true),
('Industrial Refrigeration', 'Промышленная холодильная техника', 'Trades', ARRAY['refrigeration','холодильное оборудование','морозильные камеры','industrial freezer'], true),
('Plumbing', 'Сантехника', 'Trades', ARRAY['plumbing','сантехника','сантехник','водопровод','отопление','plumber'], false),
('Electrical Contractor', 'Электромонтаж', 'Trades', ARRAY['electrical','электрика','электромонтаж','electrician','проводка'], false),
('Roofing', 'Кровельные работы', 'Trades', ARRAY['roofing','кровля','крыша','ремонт кровли','roof repair'], false),
('General Contractor', 'Общестрой / генподряд', 'Trades', ARRAY['general contractor','генподряд','строительство','ремонт под ключ','gc'], false),
('Painting Contractor', 'Малярные работы', 'Trades', ARRAY['painting','маляр','покраска','малярка','painter contractor'], false),
('Solar Installer', 'Установка солнечных панелей', 'Trades', ARRAY['solar','солнечные панели','установка солнечных','photovoltaic','pv installer'], false),
('Pest Control', 'Дезинсекция', 'Trades', ARRAY['pest control','дезинсекция','дератизация','уничтожение насекомых','exterminator'], false),

-- Marine (7) — D: Panama marine
('Boat Repair', 'Ремонт лодок и катеров', 'Marine', ARRAY['boat repair','ремонт лодок','ремонт катеров','marine repair'], true),
('Yacht Charter', 'Чартер яхт', 'Marine', ARRAY['yacht charter','аренда яхты','чартер яхт','sailboat rental'], true),
('Marine Equipment Retail', 'Морское оборудование', 'Marine', ARRAY['marine equipment','морское снаряжение','ship chandler','корабельное оборудование'], true),
('Diving School', 'Дайвинг-школа', 'Marine', ARRAY['diving school','дайвинг','scuba','обучение дайвингу','padi'], false),
('Marina Operator', 'Марина / пристань', 'Marine', ARRAY['marina','пристань','dock operator','mooring','стоянка яхт'], true),
('Sailing Instruction', 'Парусная школа', 'Marine', ARRAY['sailing school','парусная школа','обучение парусу','sailing lessons'], false),
('Sportfishing Charter', 'Спортивная рыбалка / чартер', 'Marine', ARRAY['sportfishing','рыбалка чартер','deep sea fishing','морская рыбалка'], false),

-- Trucking & Logistics (6) — D: dalnoboy
('Long-Haul Trucking', 'Дальнобойные грузоперевозки', 'Logistics', ARRAY['trucking','дальнобой','фуры','long haul','грузоперевозки','дальнобойщик'], true),
('Truck Parts Retail', 'Запчасти для грузовиков', 'Logistics', ARRAY['truck parts','запчасти для фур','грузовые запчасти','semi truck parts'], true),
('Fleet Services', 'Обслуживание автопарка', 'Logistics', ARRAY['fleet services','автопарк','fleet management','обслуживание грузовиков'], false),
('Logistics SMB / 3PL', 'Логистика / 3PL', 'Logistics', ARRAY['3pl','логистика','freight forwarder','грузовой экспедитор','логистическая компания'], false),
('Owner-Operator Trucker', 'Индивидуальный дальнобойщик', 'Logistics', ARRAY['owner operator','индивидуальный дальнобойщик','частник перевозчик'], false),
('Last-Mile Delivery', 'Доставка последняя миля', 'Logistics', ARRAY['last mile','курьерская доставка','доставка по городу','courier'], false),

-- Beauty & Wellness (8)
('Hair Salon', 'Парикмахерская', 'Beauty', ARRAY['hair salon','парикмахерская','hairdresser','стрижка','окрашивание волос'], false),
('Nail Salon', 'Маникюрный салон', 'Beauty', ARRAY['nail salon','маникюр','педикюр','ногтевой сервис','nail art'], false),
('Day Spa', 'Спа-салон', 'Beauty', ARRAY['day spa','спа','spa center','релакс','wellness day'], false),
('Massage Therapist', 'Массажист', 'Beauty', ARRAY['massage','массаж','массажист','мануальная терапия','masseuse'], false),
('Esthetician', 'Косметолог', 'Beauty', ARRAY['esthetician','косметолог','косметология','facial treatments','уход за кожей'], false),
('Barbershop', 'Барбершоп', 'Beauty', ARRAY['barbershop','барбершоп','мужская стрижка','beard trim','бритьё'], false),
('Tattoo Studio', 'Тату-студия', 'Beauty', ARRAY['tattoo','тату','татуировка','tattoo artist','body art studio'], false),
('Med Spa', 'Медицинский спа', 'Beauty', ARRAY['med spa','медспа','ботокс','инъекции','aesthetic medicine'], false),

-- E-commerce (9)
('Apparel E-commerce', 'Онлайн-магазин одежды', 'E-commerce', ARRAY['clothing store','одежда','продаю одежду','fashion brand','apparel online','магазин одежды'], false),
('Beauty E-commerce', 'Онлайн-магазин косметики', 'E-commerce', ARRAY['beauty store','косметика онлайн','продаю косметику','cosmetics brand'], false),
('Home Goods E-commerce', 'Товары для дома', 'E-commerce', ARRAY['home goods','товары для дома','интерьер','decor brand','homeware'], false),
('Pet Supplies E-commerce', 'Товары для животных', 'E-commerce', ARRAY['pet supplies','товары для животных','корм для собак','pet store'], false),
('Niche Hobby E-commerce', 'Нишевое хобби-магазин', 'E-commerce', ARRAY['hobby store','нишевое хобби','collectibles','model kits','специальный товар'], false),
('Print-on-Demand Brand', 'Print-on-Demand бренд', 'E-commerce', ARRAY['print on demand','pod','продаю майки','custom apparel','dtf'], false),
('DTC Food and Beverage', 'DTC еда и напитки', 'E-commerce', ARRAY['dtc food','доставка еды бренд','online food brand','craft beverage'], false),
('Jewelry E-commerce', 'Онлайн-магазин украшений', 'E-commerce', ARRAY['jewelry','украшения','ювелирные онлайн','handmade jewelry'], false),
('Subscription Box', 'Подписочный бокс', 'E-commerce', ARRAY['subscription box','подписочная коробка','monthly box'], false),

-- Coaching (9)
('Life Coach', 'Лайф-коуч', 'Coaching', ARRAY['life coach','лайф коуч','личностный рост','mentor'], false),
('Business Coach', 'Бизнес-коуч', 'Coaching', ARRAY['business coach','бизнес коуч','ментор для предпринимателей','executive mentor'], false),
('Fitness Coach', 'Фитнес-тренер', 'Coaching', ARRAY['fitness coach','фитнес тренер','personal training online','онлайн тренер'], false),
('Mindset Coach', 'Mindset-коуч', 'Coaching', ARRAY['mindset coach','mindset','психология успеха','head coach'], false),
('Career Coach', 'Карьерный консультант', 'Coaching', ARRAY['career coach','карьерный консультант','помощь с работой','resume coach'], false),
('Relationship Coach', 'Семейный коуч', 'Coaching', ARRAY['relationship coach','семейный психолог','couples coach','отношения'], false),
('Language Coach', 'Преподаватель языка', 'Coaching', ARRAY['language coach','репетитор английского','language tutor','преподаватель языка'], false),
('Nutrition Coach', 'Нутрициолог', 'Coaching', ARRAY['nutrition coach','нутрициолог','диетолог','питание'], false),
('Health Coach', 'Health-коуч', 'Coaching', ARRAY['health coach','велнес коуч','healthy living','лайфстайл здоровье'], false),

-- Real Estate (6)
('Residential Real Estate Agent', 'Агент по жилой недвижимости', 'Real Estate', ARRAY['residential real estate','риелтор','агент недвижимости','квартиры','дома','realtor'], false),
('Commercial Real Estate Broker', 'Коммерческая недвижимость', 'Real Estate', ARRAY['commercial real estate','коммерческая недвижимость','office leasing','retail space'], false),
('Property Management', 'Управление недвижимостью', 'Real Estate', ARRAY['property management','управление недвижимостью','доходные дома','landlord services'], false),
('Vacation Rentals', 'Краткосрочная аренда', 'Real Estate', ARRAY['vacation rental','airbnb','str operator','short term rental','посуточная аренда'], false),
('Real Estate Developer', 'Девелопер', 'Real Estate', ARRAY['real estate developer','девелопер','застройщик','residential developer'], false),
('Mortgage Broker', 'Ипотечный брокер', 'Real Estate', ARRAY['mortgage broker','ипотека','ипотечный брокер','mortgage agent'], false),

-- Creators (12)
('Beauty Creator', 'Beauty-блогер', 'Creator', ARRAY['beauty creator','бьюти блогер','makeup blogger','обзоры косметики'], false),
('Fashion Creator', 'Fashion-блогер', 'Creator', ARRAY['fashion creator','фэшн блогер','ootd','стайлинг блогер'], false),
('Lifestyle Creator', 'Lifestyle-блогер', 'Creator', ARRAY['lifestyle creator','лайфстайл блогер','daily vlog','влог'], false),
('Travel Creator', 'Travel-блогер', 'Creator', ARRAY['travel creator','тревел блогер','путешествия блогер','travel vlogger'], false),
('Food Creator', 'Food-блогер', 'Creator', ARRAY['food creator','фуд блогер','рецепты блогер','food vlogger'], false),
('Fitness Creator', 'Fitness-блогер', 'Creator', ARRAY['fitness creator','фитнес блогер','workout content','спортивный блогер'], false),
('Tech Creator', 'Tech-блогер', 'Creator', ARRAY['tech creator','тех блогер','обзоры гаджетов','tech reviewer'], false),
('Gaming Creator', 'Gaming-стример', 'Creator', ARRAY['gaming creator','стример','twitch streamer','gameplay youtube'], false),
('Finance Creator', 'Finance-блогер', 'Creator', ARRAY['finance creator','финансовый блогер','инвестиции блогер','fintwit'], false),
('Parenting Creator', 'Parenting-блогер', 'Creator', ARRAY['parenting creator','мам блогер','материнство блогер','family vlogger'], false),
('Education Creator', 'Образовательный блогер', 'Creator', ARRAY['education creator','edu youtube','обучающий контент','edutainment'], false),
('Comedy Creator', 'Комедийный блогер', 'Creator', ARRAY['comedy creator','юмор блогер','скетчи','sketch comedy'], false),

-- Solo Service Pros (12)
('Lawyer / Solo Practice', 'Адвокат / юрист', 'Professional', ARRAY['lawyer','юрист','адвокат','solo law firm','law practice'], false),
('Accountant / CPA', 'Бухгалтер / CPA', 'Professional', ARRAY['accountant','бухгалтер','cpa','налоговый консультант','tax advisor'], false),
('Tutor', 'Репетитор', 'Professional', ARRAY['tutor','репетитор','частный преподаватель','private teacher'], false),
('Personal Trainer', 'Персональный тренер', 'Professional', ARRAY['personal trainer','персональный тренер','gym trainer','individual trainer'], false),
('Photographer', 'Фотограф', 'Professional', ARRAY['photographer','фотограф','фотосессия','photo studio'], false),
('Wedding Planner', 'Свадебный планировщик', 'Professional', ARRAY['wedding planner','свадебный планировщик','организатор свадеб','event planner wedding'], false),
('Notary', 'Нотариус', 'Professional', ARRAY['notary','нотариус','notarization','нотариальные услуги'], false),
('Translator', 'Переводчик', 'Professional', ARRAY['translator','переводчик','translation services','перевод документов'], false),
('Bookkeeper', 'Бухгалтер первичка', 'Professional', ARRAY['bookkeeper','бухгалтерское сопровождение','первичка бухгалтер','payroll'], false),
('Virtual Assistant', 'Виртуальный ассистент', 'Professional', ARRAY['virtual assistant','va','ассистент онлайн','удалённый помощник'], false),
('Therapist / Counselor', 'Психотерапевт', 'Professional', ARRAY['therapist','психотерапевт','психолог','mental health counselor'], false),
('Videographer', 'Видеограф', 'Professional', ARRAY['videographer','видеограф','видео продакшн','event video'], false),

-- B2B Services (10)
('Marketing Agency', 'Маркетинговое агентство', 'B2B Services', ARRAY['marketing agency','маркетинговое агентство','digital marketing','performance marketing'], false),
('PR Agency', 'PR-агентство', 'B2B Services', ARRAY['pr agency','пр агентство','media relations','public relations'], false),
('Graphic Design Studio', 'Дизайн-студия', 'B2B Services', ARRAY['graphic design','дизайн студия','branding agency','веб дизайн'], false),
('IT Services and Consulting', 'IT-услуги и консалтинг', 'B2B Services', ARRAY['it services','ит услуги','it consulting','системный администратор'], false),
('Software Development Agency', 'Студия разработки', 'B2B Services', ARRAY['software development','разработка софта','dev shop','заказная разработка'], false),
('Translation and Localization', 'Переводы и локализация', 'B2B Services', ARRAY['translation services','локализация','бюро переводов','localization agency'], false),
('Staffing and Recruiting', 'Кадровое агентство', 'B2B Services', ARRAY['staffing','рекрутинг','recruiting agency','кадровое агентство'], false),
('Events Services Agency', 'Event-агентство', 'B2B Services', ARRAY['events services','ивент агентство','event production','организация мероприятий'], false),
('Architecture Studio', 'Архитектурное бюро', 'B2B Services', ARRAY['architecture studio','архитектурное бюро','architect firm','проектирование'], false),
('Management Consulting', 'Управленческий консалтинг', 'B2B Services', ARRAY['management consulting','управленческий консалтинг','бизнес консалтинг','strategy consulting'], false),

-- AI / Tech Niche (9) — D: Quoteworthy
('AI Consulting', 'AI-консалтинг', 'AI / Tech', ARRAY['ai consulting','ai консалтинг','нейросети консалтинг','llm consulting','ai advisor'], true),
('Indie SaaS Founder', 'Indie SaaS-фаундер', 'AI / Tech', ARRAY['indie saas','индии saas','solo founder','bootstrap saas','micro saas'], true),
('Build-in-Public Founder', 'Build-in-public фаундер', 'AI / Tech', ARRAY['build in public','билд ин паблик','founder journey','transparent founder'], true),
('Developer Tools', 'Devtools', 'AI / Tech', ARRAY['developer tools','devtools','инструменты разработчика','dev productivity'], false),
('No-Code Agency', 'No-Code-агентство', 'AI / Tech', ARRAY['no code agency','ноукод агентство','bubble agency','webflow agency'], false),
('AI Agency', 'AI-агентство', 'AI / Tech', ARRAY['ai agency','аи агентство','ai integration','automation agency'], false),
('MCP / Agent Builder', 'MCP / Agent Builder', 'AI / Tech', ARRAY['mcp','agent builder','ai agents','llm agents','autonomous agents'], false),
('Web3 / Crypto Builder', 'Web3 / Крипто-разработчик', 'AI / Tech', ARRAY['web3','crypto','defi','smart contracts','блокчейн разработчик'], false),
('Open Source Maintainer', 'Open Source мейнтейнер', 'AI / Tech', ARRAY['open source','opensource maintainer','oss founder','github maintainer'], false),

-- Pet Services (6)
('Pet Grooming', 'Грумер', 'Pet Services', ARRAY['pet grooming','грумер','груминг собак','dog groomer'], false),
('Pet Boarding', 'Передержка животных', 'Pet Services', ARRAY['pet boarding','передержка собак','dog hotel','гостиница для собак'], false),
('Veterinary Clinic', 'Ветеринарная клиника', 'Pet Services', ARRAY['veterinary clinic','ветклиника','ветеринар','vet hospital'], false),
('Dog Walking', 'Выгул собак', 'Pet Services', ARRAY['dog walking','выгул собак','dog walker','прогулки с собакой'], false),
('Pet Training', 'Дрессировка', 'Pet Services', ARRAY['pet training','дрессировка собак','кинолог','dog trainer'], false),
('Mobile Vet', 'Выездной ветеринар', 'Pet Services', ARRAY['mobile vet','выездной ветеринар','vet at home','ветеринар на дом'], false),

-- Auto Services (5)
('Auto Repair Shop', 'Автосервис', 'Auto', ARRAY['auto repair','автосервис','ремонт авто','mechanic shop','сто'], false),
('Auto Detailing', 'Авто-детейлинг', 'Auto', ARRAY['auto detailing','детейлинг авто','химчистка авто','ceramic coating'], false),
('Tire Shop', 'Шиномонтаж', 'Auto', ARRAY['tire shop','шиномонтаж','tire change','замена резины'], false),
('Body Shop', 'Кузовной ремонт', 'Auto', ARRAY['body shop','кузовной ремонт','покраска авто','dent repair'], false),
('Car Wash', 'Автомойка', 'Auto', ARRAY['car wash','автомойка','мойка машин','мойка авто'], false),

-- Tourism / Hospitality (7)
('Boutique Hotel', 'Бутик-отель', 'Tourism', ARRAY['boutique hotel','бутик отель','small hotel','дизайн отель'], false),
('Bed and Breakfast', 'B&B / Гостевой дом', 'Tourism', ARRAY['bed and breakfast','b&b','гостевой дом','guesthouse'], false),
('Tour Operator', 'Туроператор', 'Tourism', ARRAY['tour operator','туроператор','экскурсии','организованные туры'], false),
('Travel Agency', 'Турагентство', 'Tourism', ARRAY['travel agency','турагентство','продажа туров','путешествия агентство'], false),
('Excursion Operator', 'Экскурсионный гид', 'Tourism', ARRAY['excursion operator','экскурсовод','гид','local guide','частный гид'], false),
('Eco-Lodge', 'Эко-лодж', 'Tourism', ARRAY['eco lodge','эколодж','glamping','sustainable tourism'], false),
('Hostel', 'Хостел', 'Tourism', ARRAY['hostel','хостел','backpacker hostel'], false),

-- Home Services (6)
('House Cleaning Service', 'Клининг', 'Home Services', ARRAY['house cleaning','клининг','уборка квартир','cleaning service'], false),
('Lawn Care', 'Уход за газоном', 'Home Services', ARRAY['lawn care','уход за газоном','стрижка газона','landscaping basic'], false),
('Junk Removal', 'Вывоз мусора', 'Home Services', ARRAY['junk removal','вывоз мусора','hauling','расхламление'], false),
('Moving Company', 'Грузоперевозки / переезды', 'Home Services', ARRAY['moving company','переезды','квартирный переезд','mover','грузчики'], false),
('Handyman', 'Муж на час', 'Home Services', ARRAY['handyman','муж на час','мелкий ремонт','home repair'], false),
('Pool Service', 'Обслуживание бассейнов', 'Home Services', ARRAY['pool service','обслуживание бассейнов','pool cleaning','чистка бассейна'], false),

-- Fitness Studios (6)
('Yoga Studio', 'Йога-студия', 'Fitness', ARRAY['yoga studio','йога студия','hot yoga','vinyasa'], false),
('Pilates Studio', 'Пилатес-студия', 'Fitness', ARRAY['pilates studio','пилатес студия','reformer pilates'], false),
('CrossFit Box', 'CrossFit box', 'Fitness', ARRAY['crossfit','кроссфит','crossfit box','functional fitness'], false),
('Boutique Gym', 'Бутик-зал', 'Fitness', ARRAY['boutique gym','бутик фитнес','small group training','premium gym'], false),
('Dance Studio', 'Танцевальная студия', 'Fitness', ARRAY['dance studio','танцы','школа танцев','dance school'], false),
('Martial Arts School', 'Школа единоборств', 'Fitness', ARRAY['martial arts','единоборства','bjj','кикбоксинг','mma school'], false),

-- Local Events & Production (4)
('Event Photographer', 'Event-фотограф', 'Events', ARRAY['event photographer','ивент фотограф','свадебный фотограф','photo for events'], false),
('DJ / MC', 'DJ / Ведущий', 'Events', ARRAY['dj','mc','ведущий мероприятий','диджей','event host'], false),
('Florist', 'Флорист', 'Events', ARRAY['florist','флорист','букеты','цветочный магазин','flower shop'], false),
('Event Rental', 'Аренда event-оборудования', 'Events', ARRAY['event rental','аренда оборудования для мероприятий','party rental','sound rental'], false);

-- ════════════════════════════════════════════════════════════════════
-- 10) Backfill existing brands (T4 из plan-eng-review)
-- ════════════════════════════════════════════════════════════════════
-- 24 Clima (industry="air conditioners in Panama City", ru) → Commercial HVAC
-- WOW SOLUTIONS (industry="ИИ технологии...", en) → AI Consulting
-- Если mapping не подходит — юзер меняет через /brands/[id]/settings (Task #5).
update public.brands
set industry_category_id = (
  select id from public.industry_categories where name_en = 'Commercial HVAC'
)
where slug = '24clima' and industry_category_id is null;

update public.brands
set industry_category_id = (
  select id from public.industry_categories where name_en = 'AI Consulting'
)
where slug = 'wow-solutions' and industry_category_id is null;
