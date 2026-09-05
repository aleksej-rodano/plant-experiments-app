-- Run this in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).
-- Adds two quick-action flags to date_logs so a log entry can record that the
-- plant was watered / fertilized on that date without filling in the full form.
-- The "Plant watered" and "Fertilized" buttons in the add-log forms create a
-- today-dated entry with the matching flag set; the CSV export gains a
-- `watered` / `fertilized` column so those dates show up in a spreadsheet.
--
-- Idempotent and non-destructive: both columns default to false, existing rows
-- get false, safe to re-run. RLS is unchanged (date_logs ownership still runs
-- through the parent experiment).
--------------------------------------------------------------------------------

alter table public.date_logs
  add column if not exists watered boolean not null default false,
  add column if not exists fertilized boolean not null default false;
