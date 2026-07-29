-- Permanent, owner-only delete from the archived view.
-- Run AFTER 11_archive_updates.sql.
--
-- Archive (10_archive.sql / 11_archive_updates.sql) never destroys data -- it
-- just hides a row. This adds the one genuinely irreversible action in the
-- app. Enforcement lives here, in Postgres, not in the app: a Next.js server
-- action or a Postgrest call is directly reachable by anyone with a valid
-- session, so a UI-only check would not actually stop a non-owner. This
-- mirrors set_user_role() in 08_owner_admin_approval.sql exactly -- a
-- security definer function that checks is_owner() itself and rejects
-- everyone else.
--
-- Deleting a project cascades to its materials, project_labourers and
-- project_updates (02_domain.sql); deleting a labourer cascades to their
-- attendance. That is expected and intentional once the owner has chosen to
-- permanently delete rather than archive.

create or replace function public.owner_delete_row(target_table text, target_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    raise exception 'only the owner can permanently delete records';
  end if;
  if target_table not in (
    'projects', 'clients', 'suppliers', 'labourers',
    'materials', 'payments', 'project_updates'
  ) then
    raise exception 'invalid table: %', target_table;
  end if;
  execute format('delete from public.%I where id = $1', target_table) using target_id;
end;
$$;

revoke all on function public.owner_delete_row(text, uuid) from public;
grant execute on function public.owner_delete_row(text, uuid) to authenticated;
