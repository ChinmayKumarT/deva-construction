-- Pre-assign roles by email before the person signs up.
--
-- The admin enters an email + role on the Team Access page. When that email
-- signs up (email/password or Google OAuth), handle_new_user() checks this
-- table and assigns the reserved role instead of the default client clamp.
-- The reservation is consumed (deleted) on use so it can't be replayed.

create table if not exists public.role_reservations (
  email text primary key,
  role public.user_role not null,
  created_at timestamptz not null default now()
);

alter table public.role_reservations enable row level security;

create policy "staff_all_role_reservations" on public.role_reservations for all
  using (public.is_staff()) with check (public.is_staff());

-- Update handle_new_user to check for a reservation before clamping.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := new.raw_user_meta_data->>'role';
  reserved public.user_role;
  safe_role public.user_role;
begin
  -- Check if the admin pre-assigned a role for this email.
  select r.role into reserved
    from public.role_reservations r
   where r.email = lower(new.email);

  if reserved is not null then
    safe_role := reserved;
    delete from public.role_reservations where email = lower(new.email);
  else
    safe_role := case requested_role
      when 'client' then 'client'::public.user_role
      when 'supplier' then 'supplier'::public.user_role
      else 'client'::public.user_role
    end;
  end if;

  insert into public.profiles (id, full_name, role, role_pending)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    safe_role,
    reserved is null and requested_role is null
  );
  return new;
end;
$$;
