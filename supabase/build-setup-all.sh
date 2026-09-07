#!/usr/bin/env bash
# Regenerates setup_all.sql from the individual migration files.
#
# Re-run this whenever you add a migration, otherwise setup_all.sql silently
# goes stale -- which is the same "did that migration actually run?" problem
# it exists to solve.
#
#   bash supabase/build-setup-all.sh
set -euo pipefail
cd "$(dirname "$0")"

OUT=setup_all.sql
# schema.sql is first and is NOT numbered -- it creates profiles, the role
# enum and the signup trigger that everything after it depends on.
FILES="./schema.sql $(ls ./[0-9][0-9]_*.sql | sort -V | grep -v '50_repair_negative_advances.sql' | tr '
' ' ')"

{
  cat <<'HEADER'
-- ============================================================
-- FULL SETUP -- run once, top to bottom, on a FRESH database.
--
-- Every migration concatenated in order, for standing up a new Supabase
-- project (a dev/test database) without pasting fifty files by hand.
--
-- DO NOT run this against a database that already has these objects. It is
-- for a brand-new project only.
--
-- Deliberately NOT included:
--   50_repair_negative_advances.sql -- a one-off repair for production data
--                                      written under the old advance rule.
--                                      Nothing to repair on a fresh database.
--   test_data.sql                   -- the seed. Run it AFTER this file.
--
-- Two manual steps afterwards:
--   1. Seed:  run test_data.sql
--   2. Owner: sign up through the app, then run
--        update public.profiles set is_owner = true, role = 'admin'
--        where id = (select id from auth.users where email = 'you@example.com');
--
-- Regenerate with:  bash supabase/build-setup-all.sh
-- ============================================================

HEADER

  for f in $FILES; do
    name=$(basename "$f")
    printf -- '\n\n-- ============================================================\n'
    printf -- '-- %s\n' "$name"
    printf -- '-- ============================================================\n\n'
    cat "$f"
  done
} > "$OUT"

echo "wrote $OUT  ($(wc -c < "$OUT") bytes, $(echo $FILES | wc -w) migrations)"
