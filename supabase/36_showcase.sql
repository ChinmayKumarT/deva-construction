-- Public website showcase: the projects shown on devaconstructions.in.
-- Run AFTER 35_supplier_created_only_delete.sql.
--
-- WHY A SEPARATE TABLE, NOT A FLAG ON public.projects
-- ---------------------------------------------------
-- The marketing site reads this with the Supabase ANON key, from a public
-- website, with no login. public.projects carries total_cost and client_id.
-- Exposing that table to anonymous readers — even filtered to "published"
-- rows — puts contract values and the client list one policy mistake away
-- from being on the open internet.
--
-- So the public copy is its own table containing ONLY text meant for
-- strangers to read. There is no column here that could leak commercial
-- information, because there is no such column at all. That is a structural
-- guarantee rather than a promise to be careful.
--
-- The optional project_id link lets a showcase entry point back at the real
-- project for reference, and is deliberately nullable: work completed before
-- the app existed still deserves a place on the website.

create table public.showcase_projects (
  id uuid primary key default gen_random_uuid(),

  -- Public web address: devaconstructions.in/projects/<slug>
  -- Unique, and must not change once published — it is a shared link and a
  -- search result.
  slug text not null unique,

  name text not null,
  location text not null,
  year text not null,
  kind text not null check (kind in ('Residential', 'Commercial', 'Renovation')),
  area text not null,

  -- Optional paragraph shown on the project's own page.
  summary text,

  -- Show on the website home page. The site takes the first three.
  featured boolean not null default false,

  -- Off by default: a half-finished entry must never appear on the live site
  -- just because someone started filling it in.
  published boolean not null default false,

  -- Display order on the website. Lower first.
  sort_order integer not null default 0,

  -- Optional reference back to the operational project. Nullable on purpose.
  project_id uuid references public.projects(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.showcase_projects(published);
create index on public.showcase_projects(sort_order);

create table public.showcase_photos (
  id uuid primary key default gen_random_uuid(),
  showcase_id uuid not null references public.showcase_projects(id) on delete cascade,

  -- Public URL in the existing project-images bucket (paths under showcase/).
  url text not null,

  -- Lower first. The first photo is the cover: it appears on the project's
  -- card and across the top of its page.
  sort_order integer not null default 0,

  created_at timestamptz not null default now()
);

create index on public.showcase_photos(showcase_id);

-- Keep updated_at honest, so the website can tell when content last changed.
create or replace function public.touch_showcase_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger showcase_projects_touch
  before update on public.showcase_projects
  for each row execute function public.touch_showcase_updated_at();

-- ============================================================
-- RLS
-- ============================================================
alter table public.showcase_projects enable row level security;
alter table public.showcase_photos   enable row level security;

-- Staff manage everything.
create policy "staff_all_showcase_projects" on public.showcase_projects
  for all using (public.is_staff()) with check (public.is_staff());

create policy "staff_all_showcase_photos" on public.showcase_photos
  for all using (public.is_staff()) with check (public.is_staff());

-- Anonymous read of PUBLISHED rows only. `to anon, authenticated` is what the
-- website uses; unpublished rows stay invisible to it entirely, so a draft
-- cannot be read by guessing an id.
create policy "public_read_published_showcase" on public.showcase_projects
  for select to anon, authenticated
  using (published = true);

-- Photos follow their parent: visible only while that project is published.
create policy "public_read_published_showcase_photos" on public.showcase_photos
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.showcase_projects s
      where s.id = showcase_id and s.published = true
    )
  );

-- ============================================================
-- Seed: the six projects currently hard-coded on the website
-- ============================================================
-- Published so the live site keeps showing exactly what it shows today when
-- it switches over to reading from here. Photos are added through the app.
insert into public.showcase_projects
  (slug, name, location, year, kind, area, featured, published, sort_order)
values
  ('narayanappa-residence',      'Narayanappa Residence',      'Ramgondahalli, Bangalore',  '2026', 'Residential', '4,200 sq. ft.',  true,  true, 10),
  ('koramangala-loft',           'Koramangala Loft',           'Koramangala, Bangalore',    '2025', 'Renovation',  '2,100 sq. ft.',  true,  true, 20),
  ('hosur-warehouse',            'Hosur Industrial Warehouse', 'Hosur Road, Bangalore',     '2025', 'Commercial',  '22,000 sq. ft.', true,  true, 30),
  ('jayanagar-villa',            'Jayanagar Villa',            'Jayanagar, Bangalore',      '2024', 'Residential', '5,800 sq. ft.',  false, true, 40),
  ('indiranagar-office',         'Indiranagar Office Fit-out', 'Indiranagar, Bangalore',    '2024', 'Commercial',  '3,400 sq. ft.',  false, true, 50),
  ('electronic-city-apartments', 'Electronic City Apartments', 'Electronic City, Bangalore','2023', 'Residential', '34,000 sq. ft.', false, true, 60)
on conflict (slug) do nothing;
