-- Run this in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).
-- It is idempotent-ish: safe to run once. Adds the Folders layer above Experiments
-- and a one-time image slot on pest_guides.
--------------------------------------------------------------------------------

-- 1. Folders: a batch of plants acquired/started together. Batch metadata lives
--    here; each experiment inside a folder is just a treatment variant + timeline.
create table if not exists public.folders (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title          text not null,
  plant_count    integer,
  origin         text,
  initial_price  numeric,
  notes          text,
  cover_image_url text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.folders enable row level security;

drop policy if exists "folders: select own" on public.folders;
drop policy if exists "folders: insert own" on public.folders;
drop policy if exists "folders: update own" on public.folders;
drop policy if exists "folders: delete own" on public.folders;

create policy "folders: select own" on public.folders
  for select using (auth.uid() = user_id);
create policy "folders: insert own" on public.folders
  for insert with check (auth.uid() = user_id);
create policy "folders: update own" on public.folders
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "folders: delete own" on public.folders
  for delete using (auth.uid() = user_id);

-- 2. Link experiments to a folder. Nullable for now so the backfill can run.
alter table public.experiments
  add column if not exists folder_id uuid references public.folders (id) on delete cascade;

-- 3. Batch fields are optional on experiments now (they belong to the folder).
alter table public.experiments alter column plant_count drop not null;
alter table public.experiments alter column origin      drop not null;

-- 4. Backfill: give every orphan experiment an "Unsorted" folder per user,
--    carrying over that user's first experiment's batch info as a starting point.
insert into public.folders (user_id, title, plant_count, origin, initial_price, notes)
select distinct on (e.user_id)
       e.user_id, 'Unsorted', e.plant_count, e.origin, e.initial_price,
       'Auto-created when folders were introduced.'
from public.experiments e
where e.folder_id is null
order by e.user_id, e.created_at asc;

update public.experiments e
set folder_id = f.id
from public.folders f
where e.folder_id is null
  and f.user_id = e.user_id
  and f.title = 'Unsorted';

-- 5. Now every experiment has a folder — make it required.
alter table public.experiments alter column folder_id set not null;

-- 6. pest_guides: one-time reference photo of the pest. Table stays public-read;
--    add a narrow policy so any signed-in user can set/replace the image.
alter table public.pest_guides
  add column if not exists image_url text;

drop policy if exists "pest_guides: authenticated can update" on public.pest_guides;
create policy "pest_guides: authenticated can update" on public.pest_guides
  for update to authenticated using (true) with check (true);
