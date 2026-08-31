-- Run this in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).
-- Adds one tip to the Tips tab covering how long to wait before feeding a
-- freshly potted plant or one just bought from a garden centre.
-- Idempotent: the tip is only inserted if no row with the same title exists,
-- so re-running is safe. The tips table is public-read, no RLS work needed.
--------------------------------------------------------------------------------

insert into public.tips (title, content, category)
select v.title, v.content, v.category
from (
  values
  ($tip$Feeding new & repotted plants$tip$, $tip$Fresh potting mix already holds nutrients and disturbed roots scorch easily, so hold off on fertilizer at first.

- After potting or repotting — wait at least 6–8 weeks, and until you see new growth.
- Plants just bought from a garden centre — wait 2–3 months. Nursery stock is grown on heavy slow-release fertilizer and still has plenty left in the pot.
- When you do start, feed at quarter to half strength onto damp soil, never bone-dry roots.$tip$, 'Environment & timing')
) as v(title, content, category)
where not exists (
  select 1 from public.tips t where t.title = v.title
);
