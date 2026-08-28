-- Run this in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).
-- Adds two owner-scoped tables:
--   * notes        - free-form notes with an optional photo (Notes tab)
--   * feeding_logs  - a global "fertilised on <date>" log with optional notes
--
-- Wrapped in a transaction: if any statement fails the whole thing rolls back.
-- Supabase shows a generic "destructive operations" warning for the CREATE/ALTER
-- keywords -- expected; nothing here drops a table/column or deletes any rows.
--------------------------------------------------------------------------------

begin;

-- 1. Notes: personal notes, newest first, optional image.
create table if not exists public.notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body       text not null,
  image_url  text,
  created_at timestamptz not null default now()
);

alter table public.notes enable row level security;

drop policy if exists "notes: select own" on public.notes;
drop policy if exists "notes: insert own" on public.notes;
drop policy if exists "notes: update own" on public.notes;
drop policy if exists "notes: delete own" on public.notes;

create policy "notes: select own" on public.notes
  for select using (auth.uid() = user_id);
create policy "notes: insert own" on public.notes
  for insert with check (auth.uid() = user_id);
create policy "notes: update own" on public.notes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "notes: delete own" on public.notes
  for delete using (auth.uid() = user_id);

create index if not exists notes_user_created_idx
  on public.notes (user_id, created_at desc);

-- 2. Feeding log: one global list per user of the dates plants were fertilised.
create table if not exists public.feeding_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  fed_on     date not null default current_date,
  notes      text,
  created_at timestamptz not null default now()
);

alter table public.feeding_logs enable row level security;

drop policy if exists "feeding_logs: select own" on public.feeding_logs;
drop policy if exists "feeding_logs: insert own" on public.feeding_logs;
drop policy if exists "feeding_logs: update own" on public.feeding_logs;
drop policy if exists "feeding_logs: delete own" on public.feeding_logs;

create policy "feeding_logs: select own" on public.feeding_logs
  for select using (auth.uid() = user_id);
create policy "feeding_logs: insert own" on public.feeding_logs
  for insert with check (auth.uid() = user_id);
create policy "feeding_logs: update own" on public.feeding_logs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "feeding_logs: delete own" on public.feeding_logs
  for delete using (auth.uid() = user_id);

create index if not exists feeding_logs_user_fed_on_idx
  on public.feeding_logs (user_id, fed_on desc);

commit;
