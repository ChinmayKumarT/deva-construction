-- Tracks whether a material purchase already has a payment created for it
-- through the Payments page's "Purchase (optional)" picker, so it drops out
-- of that dropdown afterward instead of being payable more than once.
alter table public.materials add column if not exists billed boolean not null default false;
