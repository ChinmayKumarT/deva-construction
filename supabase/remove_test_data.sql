-- ============================================================
-- REMOVE ALL TEST DATA
--
-- Covers everything seeded by test_data.sql AND by
-- test_data_attendance_personal.sql -- attendance and the personal ledger
-- included.
--
-- Matches ONLY on the fixed id prefixes the seeds assign:
--   clients  a0000001-   suppliers b0000001-   labourers c0000001-
--   projects d0000001-   materials e0000001-   personal  fd000001-
--   payments fa000001- (supplier) / fb000002- (labour)
--   client payments fc000001-
--
-- Real records use random UUIDs and cannot match any of these. Attendance,
-- project updates and supplier advances have no fixed ids of their own, so
-- they are cleared through the seeded project, labourer or supplier they
-- belong to.
--
-- Run STEP 0 first, on its own. It changes nothing and tells you exactly what
-- would go. Only then run STEP 1.
-- ============================================================


-- ============================================================
-- STEP 0 -- PREVIEW. Changes nothing.
-- ============================================================
SELECT 'clients'              AS table_name, count(*) AS test_rows FROM public.clients   WHERE id::text LIKE 'a0000001-0000-0000-0000-%'
UNION ALL SELECT 'suppliers',           count(*) FROM public.suppliers  WHERE id::text LIKE 'b0000001-0000-0000-0000-%'
UNION ALL SELECT 'labourers',           count(*) FROM public.labourers  WHERE id::text LIKE 'c0000001-0000-0000-0000-%'
UNION ALL SELECT 'projects',            count(*) FROM public.projects   WHERE id::text LIKE 'd0000001-0000-0000-0000-%'
UNION ALL SELECT 'materials',           count(*) FROM public.materials  WHERE id::text LIKE 'e0000001-0000-0000-0000-%'
UNION ALL SELECT 'client_payments',     count(*) FROM public.client_payments WHERE id::text LIKE 'fc000001-0000-0000-0000-%'
UNION ALL SELECT 'personal_transactions', count(*) FROM public.personal_transactions WHERE id::text LIKE 'fd000001-0000-0000-0000-%'
UNION ALL SELECT 'payments',            count(*) FROM public.payments
  WHERE id::text LIKE 'fa000001-0000-0000-0000-%'
     OR id::text LIKE 'fb000002-0000-0000-0000-%'
     OR supplier_id IN (SELECT id FROM public.suppliers WHERE id::text LIKE 'b0000001-0000-0000-0000-%')
     OR labourer_id IN (SELECT id FROM public.labourers WHERE id::text LIKE 'c0000001-0000-0000-0000-%')
UNION ALL SELECT 'attendance',          count(*) FROM public.attendance
  WHERE project_id  IN (SELECT id FROM public.projects  WHERE id::text LIKE 'd0000001-0000-0000-0000-%')
     OR labourer_id IN (SELECT id FROM public.labourers WHERE id::text LIKE 'c0000001-0000-0000-0000-%')
UNION ALL SELECT 'project_updates',     count(*) FROM public.project_updates
  WHERE project_id IN (SELECT id FROM public.projects WHERE id::text LIKE 'd0000001-0000-0000-0000-%')
UNION ALL SELECT 'supplier_advances',   count(*) FROM public.supplier_advances
  WHERE supplier_id IN (SELECT id FROM public.suppliers WHERE id::text LIKE 'b0000001-0000-0000-0000-%')
ORDER BY table_name;


-- ============================================================
-- STEP 1 -- the deletion. Child rows first, so nothing trips a foreign key.
-- ============================================================

-- Standalone: the owner's ledger references nothing and nothing references it.
DELETE FROM public.personal_transactions
 WHERE id::text LIKE 'fd000001-0000-0000-0000-%';

DELETE FROM public.supplier_advances
 WHERE supplier_id IN (SELECT id FROM public.suppliers WHERE id::text LIKE 'b0000001-0000-0000-0000-%');

DELETE FROM public.project_updates
 WHERE project_id IN (SELECT id FROM public.projects WHERE id::text LIKE 'd0000001-0000-0000-0000-%');

-- Both clauses matter. Every labourer in this database is seeded, so a test
-- labourer marked present on one of your REAL sites still has to go.
DELETE FROM public.attendance
 WHERE project_id  IN (SELECT id FROM public.projects  WHERE id::text LIKE 'd0000001-0000-0000-0000-%')
    OR labourer_id IN (SELECT id FROM public.labourers WHERE id::text LIKE 'c0000001-0000-0000-0000-%');

DELETE FROM public.client_payments
 WHERE id::text LIKE 'fc000001-0000-0000-0000-%';

-- Not just the seeded payment ids. payments.supplier_id / labourer_id are
-- ON DELETE SET NULL, but the row also CHECKs that a supplier payment has a
-- supplier -- so any payment still pointing at a seeded supplier or labourer
-- would trip that check when the parent is deleted below, and the whole
-- statement would fail. See the delete-cascade-traps brain page.
DELETE FROM public.payments
 WHERE id::text LIKE 'fa000001-0000-0000-0000-%'
    OR id::text LIKE 'fb000002-0000-0000-0000-%'
    OR supplier_id IN (SELECT id FROM public.suppliers WHERE id::text LIKE 'b0000001-0000-0000-0000-%')
    OR labourer_id IN (SELECT id FROM public.labourers WHERE id::text LIKE 'c0000001-0000-0000-0000-%');

DELETE FROM public.materials
 WHERE id::text LIKE 'e0000001-0000-0000-0000-%';

DELETE FROM public.project_labourers
 WHERE project_id  IN (SELECT id FROM public.projects  WHERE id::text LIKE 'd0000001-0000-0000-0000-%')
    OR labourer_id IN (SELECT id FROM public.labourers WHERE id::text LIKE 'c0000001-0000-0000-0000-%');

DELETE FROM public.projects   WHERE id::text LIKE 'd0000001-0000-0000-0000-%';
DELETE FROM public.labourers  WHERE id::text LIKE 'c0000001-0000-0000-0000-%';
DELETE FROM public.suppliers  WHERE id::text LIKE 'b0000001-0000-0000-0000-%';
DELETE FROM public.clients    WHERE id::text LIKE 'a0000001-0000-0000-0000-%';


-- ============================================================
-- STEP 2 -- confirm. Every count should be 0, and the second column shows
-- what is left, which is your real data.
-- ============================================================
SELECT 'clients'   AS table_name,
       count(*) FILTER (WHERE id::text LIKE 'a0000001-0000-0000-0000-%') AS test_left,
       count(*) FILTER (WHERE id::text NOT LIKE 'a0000001-0000-0000-0000-%') AS real_kept
  FROM public.clients
UNION ALL SELECT 'suppliers',
       count(*) FILTER (WHERE id::text LIKE 'b0000001-0000-0000-0000-%'),
       count(*) FILTER (WHERE id::text NOT LIKE 'b0000001-0000-0000-0000-%') FROM public.suppliers
UNION ALL SELECT 'labourers',
       count(*) FILTER (WHERE id::text LIKE 'c0000001-0000-0000-0000-%'),
       count(*) FILTER (WHERE id::text NOT LIKE 'c0000001-0000-0000-0000-%') FROM public.labourers
UNION ALL SELECT 'projects',
       count(*) FILTER (WHERE id::text LIKE 'd0000001-0000-0000-0000-%'),
       count(*) FILTER (WHERE id::text NOT LIKE 'd0000001-0000-0000-0000-%') FROM public.projects
UNION ALL SELECT 'materials',
       count(*) FILTER (WHERE id::text LIKE 'e0000001-0000-0000-0000-%'),
       count(*) FILTER (WHERE id::text NOT LIKE 'e0000001-0000-0000-0000-%') FROM public.materials
UNION ALL SELECT 'personal_transactions',
       count(*) FILTER (WHERE id::text LIKE 'fd000001-0000-0000-0000-%'),
       count(*) FILTER (WHERE id::text NOT LIKE 'fd000001-0000-0000-0000-%') FROM public.personal_transactions
UNION ALL SELECT 'attendance', count(*), 0 FROM public.attendance
UNION ALL SELECT 'payments',   0, count(*) FROM public.payments
ORDER BY table_name;
