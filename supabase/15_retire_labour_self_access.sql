-- ---------- Labourers are records, not app users ----------
-- The client doesn't want a labour-facing app: a site manager records every
-- labourer's attendance and wages, and only admin/manager hold labour
-- information. (Attendance is expected to come from biometric hardware in
-- future, writing straight into public.attendance.)
--
-- These six policies were the labourer's self-access grants (02_domain.sql
-- lines 215-238). They are purely ADDITIVE on top of the staff_all_* policies,
-- so dropping them removes labourer read/write without touching admin or
-- manager capability at all.
drop policy if exists "labour_self"                  on public.labourers;
drop policy if exists "labour_own_assignments"       on public.project_labourers;
drop policy if exists "labour_own_attendance"        on public.attendance;
drop policy if exists "labour_insert_own_attendance" on public.attendance;
drop policy if exists "labour_own_payments"          on public.payments;
drop policy if exists "labour_assigned_projects"     on public.projects;

-- NOT touched, deliberately: the labourers table, project_labourers,
-- labourers.profile_id (the natural anchor for biometric identity later), and
-- the payee_type = 'labour' enum value with its CHECK constraint -- that
-- describes WHO GETS PAID, not a login role, and the wage/cash-flow reporting
-- depends on it.

-- ---------- Signup can no longer mint a labour account ----------
-- Same clamp as 08_owner_admin_approval.sql, with 'labour' removed so a
-- request crafted directly against the API (bypassing the UI, which no longer
-- offers the option) falls through to 'client' rather than creating a role
-- that has no home in the app.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := new.raw_user_meta_data->>'role';
  safe_role public.user_role;
begin
  safe_role := case requested_role
    when 'client' then 'client'::public.user_role
    when 'supplier' then 'supplier'::public.user_role
    else 'client'::public.user_role
  end;

  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    safe_role
  );
  return new;
end;
$$;

-- The 'labour' value stays in the user_role enum on purpose. Dropping it would
-- need a type recreate and would strand any existing labour account: guard.ts
-- redirects an unpermitted role to /<role>, so such a profile would bounce
-- /labour -> 404 -> / -> /labour forever. Existing accounts keep the role and
-- land on a short "your site manager handles this" notice instead.
