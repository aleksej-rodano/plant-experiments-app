-- Folder care schedule: a recurring chore per folder ("Change water" every 3
-- days) so the folder page can show what's due or overdue.
--
-- `care_last_done_on` is stamped by the "Mark done" button and by the
-- folder-wide log entry. Next due = care_last_done_on + care_interval_days.
--
-- Idempotent and wrapped in a transaction: safe to run once, safe to re-run.
-- Run in the Supabase SQL editor.

begin;

alter table public.folders
  add column if not exists care_task_label text;
alter table public.folders
  add column if not exists care_interval_days integer;
alter table public.folders
  add column if not exists care_last_done_on date;

-- An interval of 0 or less would make "next due" meaningless.
alter table public.folders
  drop constraint if exists folders_care_interval_check;
alter table public.folders
  add constraint folders_care_interval_check
  check (care_interval_days is null or care_interval_days > 0);

commit;
