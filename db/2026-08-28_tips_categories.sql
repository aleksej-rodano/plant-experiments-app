-- Run this in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).
-- Files the seeded Tips into the four chip categories the Tips tab shows.
-- Idempotent: the column is added only if missing, and each UPDATE just
-- re-stamps rows it finds by title.
--------------------------------------------------------------------------------

alter table public.tips add column if not exists category text;
alter table public.tips add column if not exists subcategory text;

-- Four categories; subcategory is no longer used by the UI.
update public.tips set subcategory = null;

update public.tips set category = 'Cuttings'
  where title in ('Nodes & aerial roots', 'Taking a clean cutting');

update public.tips set category = 'Rooting'
  where title in (
    'Rooting mediums compared',
    'Rooting hormone',
    'Water propagation upkeep',
    'Potting up'
  );

update public.tips set category = 'Environment & timing'
  where title in (
    'Prop box & humidity',
    'Light & temperature',
    'Seasonal timing',
    'Water quality'
  );

update public.tips set category = 'Method & fixes'
  where title in (
    'Reading root health',
    'Why cuttings fail',
    'First feed after rooting',
    'Running a clean experiment',
    'What to log each week'
  );
