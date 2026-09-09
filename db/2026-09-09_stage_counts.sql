-- Per-experiment aggregate stage tracking.
--
-- Each check-in (one date_logs row per experiment) now tallies how many plants
-- currently sit in each root/shoot bucket, instead of carrying a single
-- representative root-length reading + new-leaf count.
--
--   Root track:   R0 no root · R1 initiation (<2mm) · R2 elongation (>=2mm)
--   Shoot track:  S0 none · S1 bud/leaf closed · S2 leaf unfolded · S3 established
--
-- Dead/removed reuses the existing date_logs.deaths_count / death_cause.
-- leafing_without_rooting = plants that are S1+ AND R0 (entered explicitly; it
-- can't be derived from the marginal bucket counts).
--
-- root_length_mm / new_leaves are dropped: the bucket counts supersede them and
-- the only data in them was throwaway test rows (owner-approved 2026-09-09).
--
-- Idempotent, transaction-wrapped.

begin;

alter table public.date_logs
  add column if not exists r0_count integer check (r0_count is null or r0_count >= 0),
  add column if not exists r1_count integer check (r1_count is null or r1_count >= 0),
  add column if not exists r2_count integer check (r2_count is null or r2_count >= 0),
  add column if not exists s0_count integer check (s0_count is null or s0_count >= 0),
  add column if not exists s1_count integer check (s1_count is null or s1_count >= 0),
  add column if not exists s2_count integer check (s2_count is null or s2_count >= 0),
  add column if not exists s3_count integer check (s3_count is null or s3_count >= 0),
  add column if not exists leafing_without_rooting integer
    check (leafing_without_rooting is null or leafing_without_rooting >= 0);

alter table public.date_logs drop column if exists root_length_mm;
alter table public.date_logs drop column if exists new_leaves;

commit;
