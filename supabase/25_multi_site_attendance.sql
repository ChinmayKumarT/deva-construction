-- Previously one attendance row per labourer per day, full stop -- made it
-- impossible to record a labourer splitting a single day across two sites
-- (e.g. half-day at each). Relax the uniqueness to include project_id, so a
-- labourer can have one attendance entry per project per day instead of one
-- total. The wage math (lib/wages.ts / AdminScreens.kt's ReportWageFactor)
-- already sums per (project, labourer) pair across however many attendance
-- rows exist, so split-day pay across two projects already computes
-- correctly once more than one row per day is allowed -- no math changes
-- needed there.
alter table public.attendance drop constraint attendance_labourer_id_date_key;
alter table public.attendance add constraint attendance_labourer_id_date_project_id_key
  unique (labourer_id, date, project_id);
