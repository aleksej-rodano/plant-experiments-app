-- Experiment tracking: experiment start date + status, and per-log-entry
-- measurements (root length, new leaves) and plant deaths (count + cause).
--
-- Idempotent and wrapped in a transaction: safe to run once, safe to re-run.
-- Run in the Supabase SQL editor.

begin;

-- ── experiments.started_on ────────────────────────────────────────────────────
-- When the experiment / cuttings actually began. Back-filled from the row's
-- creation date for existing experiments, then made required going forward.
alter table public.experiments
  add column if not exists started_on date;

update public.experiments
  set started_on = created_at::date
  where started_on is null;

alter table public.experiments
  alter column started_on set default current_date;
alter table public.experiments
  alter column started_on set not null;

-- ── experiments.status ───────────────────────────────────────────────────────
-- Manual lifecycle label. Survivor counts are derived from date_logs, not this.
alter table public.experiments
  add column if not exists status text not null default 'ongoing';

alter table public.experiments
  drop constraint if exists experiments_status_check;
alter table public.experiments
  add constraint experiments_status_check
  check (status in ('ongoing', 'succeeded', 'failed'));

-- ── date_logs: measurements + deaths ─────────────────────────────────────────
alter table public.date_logs
  add column if not exists root_length_mm numeric;
alter table public.date_logs
  add column if not exists new_leaves integer;
alter table public.date_logs
  add column if not exists deaths_count integer not null default 0;
alter table public.date_logs
  add column if not exists death_cause text;

alter table public.date_logs
  drop constraint if exists date_logs_deaths_count_check;
alter table public.date_logs
  add constraint date_logs_deaths_count_check
  check (deaths_count >= 0);

alter table public.date_logs
  drop constraint if exists date_logs_new_leaves_check;
alter table public.date_logs
  add constraint date_logs_new_leaves_check
  check (new_leaves is null or new_leaves >= 0);

alter table public.date_logs
  drop constraint if exists date_logs_root_length_check;
alter table public.date_logs
  add constraint date_logs_root_length_check
  check (root_length_mm is null or root_length_mm >= 0);

commit;
