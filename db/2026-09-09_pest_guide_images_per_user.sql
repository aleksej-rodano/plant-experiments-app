-- Per-user pest reference photos, and locking down the shared pest_guides table.
--
-- db/2026-08-28_folders_and_pest_images.sql added an `image_url` column to
-- pest_guides plus this policy:
--
--   for update to authenticated using (true) with check (true)
--
-- That is a table-wide UPDATE with no column list and no ownership test, so any
-- signed-in account could rewrite `pest_name` and `treatment_steps` — not just
-- the image — for every other user of the project. Sign-up is open, so that is
-- reachable by anyone who registers.
--
-- pest_guides is seeded shared reference content and should be read-only from
-- the client. The "add a reference photo" feature moves to its own owner-scoped
-- table; the old column stays and is still read as a fallback so photos added
-- before this migration keep showing.
--
-- Idempotent and wrapped in a transaction: safe to run once, safe to re-run.
-- Run in the Supabase SQL editor.
--------------------------------------------------------------------------------

begin;

-- ── 1. One reference photo per user, per pest ────────────────────────────────
create table if not exists public.pest_guide_images (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  pest_guide_id uuid not null references public.pest_guides (id) on delete cascade,
  image_url     text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, pest_guide_id)
);

alter table public.pest_guide_images enable row level security;

drop policy if exists "pest_guide_images: select own" on public.pest_guide_images;
drop policy if exists "pest_guide_images: insert own" on public.pest_guide_images;
drop policy if exists "pest_guide_images: update own" on public.pest_guide_images;
drop policy if exists "pest_guide_images: delete own" on public.pest_guide_images;

create policy "pest_guide_images: select own" on public.pest_guide_images
  for select using (auth.uid() = user_id);
create policy "pest_guide_images: insert own" on public.pest_guide_images
  for insert with check (auth.uid() = user_id);
create policy "pest_guide_images: update own" on public.pest_guide_images
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "pest_guide_images: delete own" on public.pest_guide_images
  for delete using (auth.uid() = user_id);

create index if not exists pest_guide_images_user_idx
  on public.pest_guide_images (user_id, pest_guide_id);

-- ── 2. pest_guides becomes read-only from the client ─────────────────────────
-- Dropping the policy alone is not enough: RLS gates rows, while the column-level
-- grant gates columns, and Supabase grants ALL on public tables to these roles by
-- default. Both have to go.
drop policy if exists "pest_guides: authenticated can update" on public.pest_guides;

revoke update, insert, delete on public.pest_guides from authenticated;
revoke update, insert, delete on public.pest_guides from anon;

commit;
