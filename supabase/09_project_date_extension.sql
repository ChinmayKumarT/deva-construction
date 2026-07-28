-- Tracks project finishing-date extensions so clients can see when a project's
-- end date has slipped from what was originally planned.
-- Run AFTER 08_owner_admin_approval.sql.

alter table public.projects add column if not exists original_end_date date;
alter table public.projects add column if not exists extension_reason text;
alter table public.projects add column if not exists extension_updated_at timestamptz;

-- Backfill: existing rows had no original_end_date captured, so treat their
-- current end_date (if any) as the original -- they show as "not extended"
-- until admin pushes the date further, which is the correct starting state.
update public.projects set original_end_date = end_date
where original_end_date is null and end_date is not null;

-- original_end_date is captured once, at creation, and never touched again;
-- extension_updated_at is stamped automatically whenever end_date actually
-- changes, so the client-visible "extended" flag never depends on the app
-- remembering to set it manually.
create or replace function public.track_project_date_extension()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.original_end_date is null then
      new.original_end_date := new.end_date;
    end if;
  elsif tg_op = 'UPDATE' then
    if new.end_date is distinct from old.end_date then
      new.extension_updated_at := now();
    end if;
    -- original_end_date is immutable once set; ignore any client-sent change.
    new.original_end_date := old.original_end_date;
  end if;
  return new;
end;
$$;

drop trigger if exists projects_date_extension on public.projects;
create trigger projects_date_extension
  before insert or update on public.projects
  for each row execute function public.track_project_date_extension();

-- No RLS changes needed: staff_all_projects (02_domain.sql) already grants
-- admin/manager full write access to projects, and client_own_projects only
-- ever granted select, so clients can see but never set these columns.
