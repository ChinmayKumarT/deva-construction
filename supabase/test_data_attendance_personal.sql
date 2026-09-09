-- ============================================================
-- TEST DATA (top-up): attendance + personal transactions
--
-- Extends the August attendance that test_data.sql already generated, rather
-- than duplicating it, and fills the personal ledger which that file never
-- touched.
--
-- Run in the Supabase SQL Editor. Safe to re-run: attendance relies on the
-- (labourer_id, date, project_id) unique constraint, and the personal rows use
-- fixed ids so the delete below clears exactly its own.
--
-- Attendance covers 2026-08-30 .. 2026-09-09 (through today), continuing from
-- the seed's 2026-08-01 .. 2026-08-29. To carry it further, change the second
-- date in the generate_series below -- but not past today, or the dashboard
-- reports attendance for days that have not happened.
--
-- Only the seeded labourers (c0000001-) and seeded projects (d0000001-) are
-- used, so nothing attaches to your real sites.
-- ============================================================


-- ---------- Attendance: 2026-08-30 .. 2026-09-09 ----------
DO $$
DECLARE
  d date;
  dow int;
  proj_id uuid;
  lab_id uuid;
  roll float;
  att_status public.attendance_status;
BEGIN
  FOR d IN SELECT generate_series('2026-08-30'::date, '2026-09-09'::date, '1 day'::interval)::date LOOP
    dow := extract(dow from d)::int;  -- 0=Sun, 6=Sat
    IF dow = 0 THEN CONTINUE; END IF;  -- Sundays off

    FOR proj_id, lab_id IN
      SELECT pl.project_id, pl.labourer_id
      FROM public.project_labourers pl
      WHERE pl.unassigned_at IS NULL
        -- Same two exclusions the August generator used: one project is still
        -- 'planned' and one is on hold, so nobody is on site at either.
        AND pl.project_id != 'd0000001-0000-0000-0000-000000000009'
        AND pl.project_id != 'd0000001-0000-0000-0000-000000000012'
        -- Seeded rows only. Keeps test attendance off your real sites even if
        -- a real labourer is ever assigned to one of these projects.
        AND pl.project_id::text LIKE 'd0000001-0000-0000-0000-%'
        AND pl.labourer_id::text LIKE 'c0000001-0000-0000-0000-%'
    LOOP
      roll := random();

      -- Saturdays run at about half strength.
      IF dow = 6 AND roll > 0.5 THEN CONTINUE; END IF;

      -- 5% overtime, 7% absent, 8% half day, the rest a full day. Overtime is
      -- new here -- 46_overtime_status.sql added it after the August seed was
      -- written, so this is also the only data exercising that wage factor.
      IF roll < 0.05 THEN
        att_status := 'overtime';
      ELSIF roll < 0.12 THEN
        att_status := 'absent';
      ELSIF roll < 0.20 THEN
        att_status := 'half_day';
      ELSE
        att_status := 'present';
      END IF;

      INSERT INTO public.attendance (labourer_id, project_id, date, status)
      VALUES (lab_id, proj_id, d, att_status)
      ON CONFLICT (labourer_id, date, project_id) DO NOTHING;
    END LOOP;
  END LOOP;
END;
$$;


-- ---------- Personal transactions ----------
-- The owner's own ledger. Deliberately NOT project money: nothing here is
-- counted in project costs, cash flow or any report (see 21_personal_
-- transactions.sql and 39_personal_admin_only.sql -- admin-only, and the
-- owner's alone).
DELETE FROM public.personal_transactions WHERE id::text LIKE 'fd000001-0000-0000-0000-%';

INSERT INTO public.personal_transactions (id, type, amount, description, occurred_at) VALUES
  -- Income
  ('fd000001-0000-0000-0000-000000000001', 'income',  185000.00, 'Owner draw - August',                 '2026-08-31'),
  ('fd000001-0000-0000-0000-000000000002', 'income',   42000.00, 'Rent received - Jayanagar shop',      '2026-09-01'),
  ('fd000001-0000-0000-0000-000000000003', 'income',   15000.00, 'Scrap steel sale',                    '2026-09-04'),
  ('fd000001-0000-0000-0000-000000000004', 'income',  185000.00, 'Owner draw - September',              '2026-09-08'),

  -- Expense
  ('fd000001-0000-0000-0000-000000000005', 'expense',  28500.00, 'Bolero service and tyres',            '2026-08-30'),
  ('fd000001-0000-0000-0000-000000000006', 'expense',  12400.00, 'Diesel - site visits',                '2026-09-01'),
  ('fd000001-0000-0000-0000-000000000007', 'expense',   9800.00, 'Office rent',                         '2026-09-02'),
  ('fd000001-0000-0000-0000-000000000008', 'expense',   3200.00, 'Phone and internet',                  '2026-09-02'),
  ('fd000001-0000-0000-0000-000000000009', 'expense',  22000.00, 'Advance tax instalment',              '2026-09-03'),
  ('fd000001-0000-0000-0000-000000000010', 'expense',   6500.00, 'CA fees - quarterly filing',          '2026-09-05'),
  ('fd000001-0000-0000-0000-000000000011', 'expense',   4100.00, 'Site office electricity',             '2026-09-06'),
  ('fd000001-0000-0000-0000-000000000012', 'expense',  18000.00, 'Health insurance premium',            '2026-09-07'),
  ('fd000001-0000-0000-0000-000000000013', 'expense',   2700.00, 'Stationery and printing',             '2026-09-08'),
  ('fd000001-0000-0000-0000-000000000014', 'expense',   7500.00, 'Diesel - site visits',                '2026-09-09');


-- ---------- What landed ----------
SELECT 'attendance 30 Aug - 9 Sep' AS what,
       count(*)::text AS rows,
       count(DISTINCT date)::text AS days
  FROM public.attendance
 WHERE date BETWEEN '2026-08-30' AND '2026-09-09'
UNION ALL
SELECT 'personal transactions',
       count(*)::text,
       to_char(sum(CASE WHEN type = 'income' THEN amount ELSE -amount END), 'FM999,999,990') || ' net'
  FROM public.personal_transactions
 WHERE id::text LIKE 'fd000001-0000-0000-0000-%';
