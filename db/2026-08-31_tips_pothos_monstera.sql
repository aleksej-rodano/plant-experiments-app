-- Run this in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).
-- Adds a "Pothos & Monstera" category to the Tips tab: aroid soil mix, watering,
-- light/support, and aerial roots/feeding/propagation.
-- Idempotent: each tip is only inserted if no row with the same title exists.
-- The tips table is public-read, so no user_id / RLS work is needed here.
--
-- The category chip only shows once 'Pothos & Monstera' is added to
-- CATEGORY_ORDER in src/pages/TipsPage.tsx.
--------------------------------------------------------------------------------

insert into public.tips (title, content, category)
select v.title, v.content, v.category
from (
  values
  ($tip$Aroid soil mix — the triple mix$tip$, $tip$Pothos and Monstera are aroids: their roots want air, not dense wet soil.

Mix equal parts, 1 : 1 : 1 —
- Potting soil — holds some moisture and nutrients.
- Orchid bark — chunky, keeps the mix open, and mimics the bark these plants climb in the wild.
- Perlite — stops it compacting and helps it drain fast.

Optional: a handful of horticultural charcoal or worm castings. Repot into fresh mix when roots circle the pot or push out the drainage holes, usually every 1–2 years.$tip$, 'Pothos & Monstera'),

  ($tip$Watering pothos & Monstera$tip$, $tip$- Let the top 3–5 cm of mix dry before watering. Pothos takes more drought than Monstera.
- Water thoroughly until it runs from the drainage holes, then tip out the saucer — no standing water.
- Limp leaves in dry mix = thirsty; it perks up within hours of a drink.
- Yellow lower leaves in soggy mix = overwatered; let it dry out more between waterings.
- The chunky aroid mix dries faster, so you can water freely without rotting the roots.
- Ease off through winter when growth slows.$tip$, 'Pothos & Monstera'),

  ($tip$Light, support & leaf splits$tip$, $tip$- Bright indirect light. Both survive medium light but grow slow and leggy.
- Variegated pothos and fenestrated Monstera need bright light to hold their pattern and to open holes and splits.
- Monstera is a climber: give it a moss pole or trellis. Climbing is what triggers big adult leaves with fenestrations — a pole-less plant stays juvenile.
- Tie new growth to the support as it goes.
- Rotate the pot a quarter turn each week for even growth.$tip$, 'Pothos & Monstera'),

  ($tip$Aerial roots, feeding & propagation$tip$, $tip$- Don't cut healthy aerial roots. Tuck them into the pole or down into the pot.
- Feed monthly in spring and summer with a balanced fertilizer at half strength; skip a plant that is new or just repotted (see "Feeding new & repotted plants").
- Wipe dust off the big leaves so they can photosynthesise.
- Both root very easily: cut just below a node and put it in water or straight into damp mix.
- A Monstera leaf with no node will never grow into a plant, however long it sits in water.$tip$, 'Pothos & Monstera')
) as v(title, content, category)
where not exists (
  select 1 from public.tips t where t.title = v.title
);
