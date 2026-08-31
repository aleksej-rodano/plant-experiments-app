-- Run this in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).
-- Seeds the propagation reference tips shown on the Tips tab. Idempotent: a tip is
-- only inserted if no row with the same title already exists, so re-running is safe.
-- The tips table is public-read, so no user_id / RLS work is needed here.
--
-- Adds the category column used by the Tips tab's chip row if it's missing.
--------------------------------------------------------------------------------

alter table public.tips add column if not exists category text;

insert into public.tips (title, content, category)
select v.title, v.content, v.category
from (
  values
  ($tip$Nodes & aerial roots$tip$, $tip$The node is where roots and new growth come from — the small bump where a leaf or petiole meets the stem.

- A cutting needs at least one node below the water or medium line.
- A leaf with no node stays fresh for months but never roots.
- A stub of aerial root speeds things up but isn't required.
- 1–2 nodes per cutting is plenty; more just wastes the mother plant.$tip$, 'Cuttings'),

  ($tip$Taking a clean cutting$tip$, $tip$- Wipe the blade or scissors with alcohol first.
- Cut about 1 cm below the node, straight across.
- Thick or sappy stems (hoya, cactus, succulents): let the cut dry 1–24 h until it calluses.
- Thin stems (pothos, philodendron): propagate straight away.$tip$, 'Cuttings'),

  ($tip$Rooting mediums compared$tip$, $tip$Water — easy to watch; roots can be brittle when potted up, so pot up early.
Sphagnum moss — high success, gentle roots, good for fussy plants.
Perlite — airy, hard to overwater, transitions well to soil.
LECA — clean and reusable, slower start, needs steady moisture.
Soil — no transplant shock, but you can't see progress.

Rule of thumb: move to soil once roots are 3–5 cm.$tip$, 'Rooting'),

  ($tip$Rooting hormone$tip$, $tip$Powder or gel with IBA speeds rooting and evens out a batch.

- Most useful on woody or slow plants (ficus, hoya, citrus).
- Little effect on pothos or philodendron — they root anyway.
- Dip only the cut end, tap off the excess.
- Too much can burn the stem and stall rooting.$tip$, 'Rooting'),

  ($tip$Prop box & humidity$tip$, $tip$A rootless cutting can't drink, so it leans on humid air.

- Aim for 70–90% humidity: a clear box, bag, or covered tray.
- Open it a few minutes daily to swap the air and avoid mould.
- Once roots are a few cm long, open it wider each day for a week, then remove the cover.$tip$, 'Environment & timing'),

  ($tip$Light & temperature$tip$, $tip$- Bright, indirect light. No direct sun on a rootless cutting.
- Warmth matters more than light: 21–26 °C at the roots.
- A cold windowsill in winter can stall rooting for weeks.
- A seedling heat mat under the tray makes a big difference.$tip$, 'Environment & timing'),

  ($tip$Water propagation upkeep$tip$, $tip$- Change the water every 3–5 days, or when it turns cloudy.
- Top up between changes so nodes stay covered.
- Roots in the water, leaves out of it.
- Slimy brown stem = rot: recut above it into fresh water.
- Algae on the glass is harmless; wipe it at changes.$tip$, 'Rooting'),

  ($tip$Reading root health$tip$, $tip$White or pale cream — healthy, growing.
Tan or light brown — normal for older roots, especially in soil or moss.
Translucent, mushy, smelly — rot. Act now.

Rot rescue:
- Cut back to firm, white tissue.
- Rinse, air-dry about an hour.
- Restart in fresh water or damp sphagnum, out of direct sun.$tip$, 'Method & fixes'),

  ($tip$Potting up$tip$, $tip$- Wait for several roots 3–5 cm long, not one long single root.
- Use a light, chunky mix and water it in.
- Keep humidity up 1–2 weeks, then taper — water roots hate dry room air.
- Top growth often pauses while roots adjust. That's normal.$tip$, 'Rooting'),

  ($tip$Why cuttings fail$tip$, $tip$- No node below the surface — the most common cause.
- Stem rot from dirty water or a crushed cut.
- Dried out — humidity too low, no roots to compensate.
- Potted too early, before roots could support the plant.
- Too much rooting hormone.
- Too cold — rooting stops below about 18 °C.$tip$, 'Method & fixes'),

  ($tip$First feed after rooting$tip$, $tip$- Wait until it's in soil with roots a few cm long.
- Start at quarter strength, then half strength.
- Feed monthly while it's actively growing.
- Yellow lower leaves + crusty soil = overfed; flush with plain water.
- Don't fertilise water-prop cuttings — plain water is enough.$tip$, 'Method & fixes'),

  ($tip$Running a clean experiment$tip$, $tip$- Change one thing at a time (medium, hormone, light, node count).
- Keep a control group treated the normal way.
- With only 3–4 cuttings per group, treat results as a hint, not proof.
- Repeat a promising result before trusting it.$tip$, 'Method & fixes'),

  ($tip$What to log each week$tip$, $tip$Same day each week, same photo angle and distance.

Worth noting:
- Node swelling or root nubs.
- Number of roots and length of the longest.
- New leaf growth.
- Any yellowing, rot, or mould.$tip$, 'Method & fixes'),

  ($tip$Water quality$tip$, $tip$- Tap water is usually fine. If heavily chlorinated, let it sit out overnight.
- Filtered or rainwater is nice to have, not a must.$tip$, 'Environment & timing'),

  ($tip$Seasonal timing$tip$, $tip$Spring & early summer — fastest rooting, plants in active growth.
Late summer — still good; start earlier in the day to dodge heat stress.
Autumn — slower; add warmth and light.
Winter — slowest. Expect roughly double the time, or wait for spring.$tip$, 'Environment & timing')
) as v(title, content, category)
where not exists (
  select 1 from public.tips t where t.title = v.title
);
