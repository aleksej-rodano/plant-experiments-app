-- Make the schema state the invariants the app already relies on.
--
-- src/types/database.ts types these columns as non-null, and the code acts on
-- that: csvExport's chronological() calls `a.created_at.localeCompare(...)` and
-- latestStageLog compares created_at directly, both of which throw on null;
-- summariseAll groups by `log.experiment_id` and would bucket a null row under
-- "null". Postgres, though, still allowed null in all of them — the types were
-- describing an intent the database did not enforce.
--
-- Every one of these columns is non-null in practice (checked before writing
-- this: 0 nulls across every row), and every timestamp already defaults to
-- now(), so nothing changes for existing data or for inserts the app makes.
--
-- experiments.user_id additionally gains `default auth.uid()`, which folders,
-- notes and feeding_logs already have.
--
-- Idempotent and wrapped in a transaction: safe to run once, safe to re-run.
-- Run in the Supabase SQL editor.
--------------------------------------------------------------------------------

begin;

-- ── date_logs ────────────────────────────────────────────────────────────────
alter table public.date_logs alter column experiment_id set not null;
alter table public.date_logs alter column created_at    set not null;
alter table public.date_logs alter column updated_at    set not null;

-- ── experiments ──────────────────────────────────────────────────────────────
alter table public.experiments alter column user_id    set default auth.uid();
alter table public.experiments alter column user_id    set not null;
alter table public.experiments alter column created_at set not null;
alter table public.experiments alter column updated_at set not null;

-- ── seeded reference tables ──────────────────────────────────────────────────
alter table public.pest_guides alter column created_at set not null;
alter table public.tips        alter column created_at set not null;

commit;
