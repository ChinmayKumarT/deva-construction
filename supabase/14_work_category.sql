-- Freeform "what was this money for" tag within a project (e.g. Foundation,
-- Electrical, Plumbing), same style as the freeform current_stage text on
-- projects -- no fixed list, admin just types whatever they want. Nullable
-- so existing rows are unaffected.
alter table public.materials add column if not exists work_category text;
alter table public.payments add column if not exists work_category text;
create index if not exists materials_work_category_idx on public.materials(work_category);
create index if not exists payments_work_category_idx on public.payments(work_category);
