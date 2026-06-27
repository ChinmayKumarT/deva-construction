-- Self-service account deletion.
-- Run AFTER 02_domain.sql.
-- Deleting the auth.users row cascades to public.profiles (FK on delete cascade),
-- which in turn nulls out profile_id on clients/suppliers/labourers (on delete set null),
-- so domain rows (projects, materials, etc.) are NOT lost — only the login is.
--
-- If you want to ALSO wipe the linked clients/suppliers/labourers row, extend this fn.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
