-- Bin (soft delete with 30-day restore).
--
-- Deleting no longer removes rows. Instead it stamps:
--   deleted_at       when it was binned (null = live)
--   delete_batch_id  one id shared by everything removed in a single action, so
--                    restoring a folder brings back exactly the experiments and
--                    logs that went down with it -- and nothing that was already
--                    deleted separately beforehand
--   deleted_root     true on the row the user actually clicked delete on, so the
--                    bin lists one entry per action instead of every child row
--
-- Permanent deletion happens in the app: it purges rows binned more than 30 days
-- ago and removes their photos from storage at the same time. The existing
-- foreign-key cascades still do the destructive work at that point -- hard
-- deleting a folder row takes its experiments and logs with it.
--
-- Idempotent and wrapped in a transaction: safe to run once, safe to re-run.
-- Run in the Supabase SQL editor.

begin;

-- ── columns ──────────────────────────────────────────────────────────────────
alter table public.folders
  add column if not exists deleted_at timestamptz,
  add column if not exists delete_batch_id uuid,
  add column if not exists deleted_root boolean not null default false;

alter table public.experiments
  add column if not exists deleted_at timestamptz,
  add column if not exists delete_batch_id uuid,
  add column if not exists deleted_root boolean not null default false;

alter table public.date_logs
  add column if not exists deleted_at timestamptz,
  add column if not exists delete_batch_id uuid,
  add column if not exists deleted_root boolean not null default false;

alter table public.notes
  add column if not exists deleted_at timestamptz,
  add column if not exists delete_batch_id uuid,
  add column if not exists deleted_root boolean not null default false;

-- ── indexes ──────────────────────────────────────────────────────────────────
-- Every list query in the app now filters on `deleted_at is null`; partial
-- indexes keep those reads cheap as the bin fills up.
create index if not exists folders_live_idx
  on public.folders (user_id) where deleted_at is null;
create index if not exists experiments_live_idx
  on public.experiments (folder_id) where deleted_at is null;
create index if not exists date_logs_live_idx
  on public.date_logs (experiment_id) where deleted_at is null;
create index if not exists notes_live_idx
  on public.notes (user_id) where deleted_at is null;

-- The bin page and the purge sweep both scan by deletion time.
create index if not exists folders_deleted_idx
  on public.folders (deleted_at) where deleted_at is not null;
create index if not exists experiments_deleted_idx
  on public.experiments (deleted_at) where deleted_at is not null;
create index if not exists date_logs_deleted_idx
  on public.date_logs (deleted_at) where deleted_at is not null;
create index if not exists notes_deleted_idx
  on public.notes (deleted_at) where deleted_at is not null;

-- ── update policies ──────────────────────────────────────────────────────────
-- Binning and restoring are UPDATEs, not DELETEs. These policies are additive:
-- permissive RLS policies are OR'd together, so any existing update policy keeps
-- working alongside them.
drop policy if exists "experiments: update own (bin)" on public.experiments;
create policy "experiments: update own (bin)" on public.experiments
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "notes: update own (bin)" on public.notes;
create policy "notes: update own (bin)" on public.notes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- date_logs carries no user_id; ownership runs through the parent experiment.
drop policy if exists "date_logs: update own (bin)" on public.date_logs;
create policy "date_logs: update own (bin)" on public.date_logs
  for update using (
    exists (
      select 1 from public.experiments e
      where e.id = date_logs.experiment_id and e.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.experiments e
      where e.id = date_logs.experiment_id and e.user_id = auth.uid()
    )
  );

commit;
