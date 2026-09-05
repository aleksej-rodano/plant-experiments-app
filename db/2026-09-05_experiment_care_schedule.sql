-- Run this in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).
-- Gives each experiment its own optional recurring-care reminder, mirroring the
-- three columns folders already have (db/2026-08-31_folder_care_schedule.sql).
-- A folder tracks the batch-wide chore (e.g. "Change water"); an experiment can
-- now track its own (e.g. a per-treatment feeding schedule). Both are optional.
--
--   care_task_label    what the chore is, free text (null = no reminder)
--   care_interval_days  how often, in days (null / <=0 = reminder off)
--   care_last_done_on   last time it was marked done (null = never)
--
-- The Android app reads these to schedule an 11:00 daily notification listing
-- every folder / experiment chore that is due or overdue.
--
-- Idempotent, non-destructive (all three nullable, no default), safe to re-run.
-- RLS is unchanged (experiments are already scoped to auth.uid() = user_id).
--------------------------------------------------------------------------------

alter table public.experiments
  add column if not exists care_task_label text,
  add column if not exists care_interval_days integer,
  add column if not exists care_last_done_on date;
