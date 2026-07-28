# Database setup

Run these in the Supabase SQL editor **in order**:

1. `schema.sql` — `profiles` table, role enum, signup trigger.
2. `02_domain.sql` — projects, clients, suppliers, labourers, materials, payments, attendance, project_updates, plus RLS.
3. `03_storage.sql` — `project-images` storage bucket with public read + authenticated write.
4. `04_account.sql` — `delete_my_account()` RPC for self-service account deletion (required by Play Store).
5. `05_profiles_staff_access.sql` — lets admin/manager read all `profiles` (needed for the "Link to login" dropdowns in admin pages).
6. `06_supplier_deliveries.sql` — lets suppliers self-record material deliveries against any project.
7. `07_supplier_bills.sql` — lets suppliers submit pending bills (payments) for their own deliveries.
8. `08_owner_admin_approval.sql` — closes self-serve admin/manager signup. See "Owner model" below.
   Includes a one-time bootstrap you must run by hand afterwards.
9. `09_project_date_extension.sql` — adds `original_end_date`/`extension_reason` to `projects`
   and a trigger that stamps `extension_updated_at` whenever `end_date` changes, so clients can
   see when a project's finish date has slipped from what was originally planned.

## Entity map (matches the diagram)

| Diagram label                  | Table(s)                                  |
| ------------------------------ | ----------------------------------------- |
| Projects / sites               | `projects`                                |
| Clients / Suppliers / Labour   | `clients`, `suppliers`, `labourers`       |
| Material info / stock          | `materials`                               |
| Cost tracking / Total Cost     | `projects.total_cost` + `materials`       |
| Payments / pending / approval  | `payments` (status pending→approved→paid) |
| Attendance monitoring          | `attendance`                              |
| Current site / Assigned site   | `project_labourers`                       |
| Images of work / Recent updates| `project_updates`                         |
| Bill generation                | `payments` where `payee_type = 'supplier'`|
| Weekly wages                   | aggregate `attendance` × `labourers.daily_wage` |

## RLS summary

- **admin / manager** → full read+write everywhere.
- **client** → own profile, own projects, updates/materials/payments on those projects (read-only).
- **supplier** → own profile, materials they supply, payments to them (read-only).
- **labour** → own profile, assignments, attendance (can self-insert), wages, assigned project rows.

## Owner model

Signup can only ever produce `client`, `supplier`, or `labour` — `handle_new_user()`
(rewritten by `08_owner_admin_approval.sql`) clamps any other requested role to `client`.
Nobody can self-promote either: column-level `UPDATE` privilege on `profiles.role` and
`profiles.is_owner` is revoked from `authenticated` entirely, so no RLS policy (present or
future) can write those columns. The **only** way a row becomes `admin` or `manager` is the
`set_user_role(target_id, new_role)` RPC, which checks `is_owner()` itself and raises an
exception for everyone else.

Exactly one profile should have `is_owner = true`. Bootstrap it once, by hand, after that
person has signed up through the app:

```sql
update public.profiles set is_owner = true, role = 'admin'
where id = (select id from auth.users where email = 'the-owner@example.com');
```

The owner then grants admin/manager to anyone else from the Android app's **Team access**
screen (visible only to them), which calls `set_user_role`.

## Linking auth users to entities

A `profiles` row is created on signup with the chosen role. To wire a profile to its domain row, set `profile_id = profiles.id` on the matching `clients` / `suppliers` / `labourers` row. Until that link is set, the user can sign in but RLS will return empty results — admin must create the linking row.

We can automate that later (e.g., a server action that creates the domain row at the moment admin invites a user).
