-- A labourer's trade/category (Carpenter, Plumber, Electrician, ...), the
-- same fixed list already used for materials.work_category and
-- payments.work_category. Plain nullable text -- existing rows are unaffected
-- and categorising is optional per labourer.
alter table public.labourers add column if not exists category text;
create index if not exists labourers_category_idx on public.labourers(category);
