-- Let admin/manager read the email behind a profile, for auto-filling the
-- create-supplier form when "Link to login" is picked. Run AFTER 02_domain.sql.
--
-- profiles has no email column (it lives in auth.users, which RLS never
-- exposes to normal queries). security definer + the is_staff() guard here
-- is the only way to surface it without granting broad auth.users access.

create or replace function public.admin_list_profiles_with_email(p_role public.user_role)
returns table (id uuid, full_name text, email text)
language sql security definer set search_path = public
as $$
  select p.id, p.full_name, u.email
  from public.profiles p
  join auth.users u on u.id = p.id
  where public.is_staff() and p.role = p_role
$$;

revoke all on function public.admin_list_profiles_with_email(public.user_role) from public;
grant execute on function public.admin_list_profiles_with_email(public.user_role) to authenticated;
