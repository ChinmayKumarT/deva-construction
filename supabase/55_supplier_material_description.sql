-- The supplier price list carries a description instead of a rate.
--
-- 54 gave each catalog entry an agreed unit_cost, prefilled into the Record
-- Delivery form. In practice the rate is the part that moves -- it changes per
-- load, per season, per negotiation -- so a pinned rate was stale more often
-- than it was useful, and it made the list look like an agreement rather than
-- the typing shortcut it is. What does not move is WHICH material this is:
-- "OPC 53 grade, Ultratech" is worth far more at the point of entry than a
-- number that will be wrong next week.
--
-- The supplier still types the rate on each delivery, exactly as before. This
-- table never fed the money model -- a delivery row has always carried its own
-- name, unit and unit_cost (see the note at the top of 54).
alter table public.supplier_materials
  add column if not exists description text;

-- unit_cost is deliberately LEFT IN PLACE rather than dropped. Nothing reads
-- it any more, existing rows keep whatever rate was agreed, and a dropped
-- column cannot be undone if this turns out to be the wrong call. It is
-- `not null default 0`, so inserts that omit it are fine.
