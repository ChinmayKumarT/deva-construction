-- Who recorded each delivery. Managers may only change (delete / pay / undo)
-- deliveries they recorded themselves; anything else is read-only to them.
--
-- The default stamps the inserting user on every path (admin form, supplier
-- portal, Android) without app code having to pass it. Rows that predate this
-- column stay null, which reads as "not recorded by this manager".
alter table public.materials
  add column if not exists created_by uuid
  references public.profiles(id) on delete set null
  default auth.uid();
