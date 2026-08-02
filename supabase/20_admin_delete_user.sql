-- Owner-only permanent user deletion from the Team access screen.
-- Same delete pattern as delete_my_account() (04_account.sql): deleting the
-- auth.users row cascades to public.profiles (FK on delete cascade), which in
-- turn nulls out profile_id on clients/suppliers/labourers (on delete set
-- null) -- so business records (projects, materials, payments, etc.) are NOT
-- lost, only the login. This is the account-removal equivalent of
-- owner_delete_row() (12_owner_delete.sql): genuinely irreversible, so the UI
-- must confirm before calling it.
create or replace function public.admin_delete_user(target_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_owner() then
    raise exception 'only the owner can delete accounts';
  end if;
  if target_id = auth.uid() then
    raise exception 'use delete_my_account() to delete your own account';
  end if;
  delete from auth.users where id = target_id;
end;
$$;

revoke all on function public.admin_delete_user(uuid) from public;
grant execute on function public.admin_delete_user(uuid) to authenticated;
