-- Phase 1 / Phase 2 (potting) schema. See PHASE2_PLAN.md sections 4 and 4.5.
--
-- An experiment keeps running in Phase 1 (propagation) for the plants that stay in
-- it; plants move to Phase 2 (potted) through potting events:
--
--   pottings   one row per potting event (date + notes). Plants moved is derived:
--              sum of pots.plant_count for that potting.
--   pots       individual pots created by a potting. One pot can hold several
--              plants, so pots <> plants: a pot has its own plant_count and photo.
--
-- date_logs gains:
--   phase           'propagation' (default, backfills every existing row) | 'potted'
--   pot_id          required for phase 'potted' (CHECK), null for Phase 1 logs;
--                   ON DELETE CASCADE so hard-purging a pot takes its logs with it
--   health_good/ok/poor   Phase 2 health tally per check-in
-- Phase 2 deaths reuse the existing deaths_count / death_cause.
--
-- Both new tables carry the same soft-delete trio as the other bin tables
-- (deleted_at, delete_batch_id, deleted_root) -- see 2026-08-31_soft_delete_bin.sql.
-- RLS runs through the parent experiment's owner (same pattern as date_logs).
--
-- create_potting(...) inserts a potting and all its pots atomically and refuses to
-- move more plants than Phase 1 still holds on the potting date:
--   remaining = experiments.plant_count
--             - sum(deaths_count) of live phase='propagation' logs dated <= potted_on
--             - sum(plant_count) of live pots whose live potting has potted_on <= potted_on
-- "Live" means deleted_at is null. SECURITY INVOKER, so RLS applies to the caller.
--
-- Idempotent and wrapped in a transaction: safe to run once, safe to re-run.

begin;

-- ── shared updated_at trigger function ───────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── pottings ─────────────────────────────────────────────────────────────────
create table if not exists public.pottings (
  id              uuid primary key default gen_random_uuid(),
  experiment_id   uuid not null references public.experiments (id) on delete cascade,
  potted_on       date not null default current_date,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  delete_batch_id uuid,
  deleted_root    boolean not null default false
);

-- ── pots ─────────────────────────────────────────────────────────────────────
create table if not exists public.pots (
  id              uuid primary key default gen_random_uuid(),
  -- denormalised from the potting for simple queries and RLS
  experiment_id   uuid not null references public.experiments (id) on delete cascade,
  potting_id      uuid not null references public.pottings (id) on delete cascade,
  label           text not null,
  plant_count     integer not null check (plant_count >= 1),
  pot_size        text,
  substrate       text,
  notes           text,
  image_url       text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  delete_batch_id uuid,
  deleted_root    boolean not null default false
);

-- ── date_logs: phase, pot link, health tally ─────────────────────────────────
alter table public.date_logs
  add column if not exists phase text not null default 'propagation',
  add column if not exists pot_id uuid references public.pots (id) on delete cascade,
  add column if not exists health_good integer,
  add column if not exists health_ok integer,
  add column if not exists health_poor integer;

-- Named CHECKs added only when missing so a re-run does not fail.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'date_logs_phase_check'
                 and conrelid = 'public.date_logs'::regclass) then
    alter table public.date_logs
      add constraint date_logs_phase_check check (phase in ('propagation', 'potted'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'date_logs_potted_needs_pot_check'
                 and conrelid = 'public.date_logs'::regclass) then
    alter table public.date_logs
      add constraint date_logs_potted_needs_pot_check
      check (phase <> 'potted' or pot_id is not null);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'date_logs_health_good_check'
                 and conrelid = 'public.date_logs'::regclass) then
    alter table public.date_logs
      add constraint date_logs_health_good_check check (health_good is null or health_good >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'date_logs_health_ok_check'
                 and conrelid = 'public.date_logs'::regclass) then
    alter table public.date_logs
      add constraint date_logs_health_ok_check check (health_ok is null or health_ok >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'date_logs_health_poor_check'
                 and conrelid = 'public.date_logs'::regclass) then
    alter table public.date_logs
      add constraint date_logs_health_poor_check check (health_poor is null or health_poor >= 0);
  end if;
end
$$;

-- ── indexes ──────────────────────────────────────────────────────────────────
create index if not exists pottings_live_idx
  on public.pottings (experiment_id) where deleted_at is null;
create index if not exists pottings_deleted_idx
  on public.pottings (deleted_at) where deleted_at is not null;
create index if not exists pots_live_idx
  on public.pots (experiment_id) where deleted_at is null;
create index if not exists pots_potting_idx
  on public.pots (potting_id);
create index if not exists pots_deleted_idx
  on public.pots (deleted_at) where deleted_at is not null;
create index if not exists date_logs_pot_idx
  on public.date_logs (pot_id) where pot_id is not null;

-- ── updated_at triggers ──────────────────────────────────────────────────────
drop trigger if exists pottings_set_updated_at on public.pottings;
create trigger pottings_set_updated_at
  before update on public.pottings
  for each row execute function public.set_updated_at();

drop trigger if exists pots_set_updated_at on public.pots;
create trigger pots_set_updated_at
  before update on public.pots
  for each row execute function public.set_updated_at();

-- ── RLS: ownership runs through the parent experiment ────────────────────────
alter table public.pottings enable row level security;
alter table public.pots enable row level security;

drop policy if exists "pottings: select own" on public.pottings;
drop policy if exists "pottings: insert own" on public.pottings;
drop policy if exists "pottings: update own" on public.pottings;
drop policy if exists "pottings: delete own" on public.pottings;

create policy "pottings: select own" on public.pottings
  for select using (
    experiment_id in (select e.id from public.experiments e where e.user_id = auth.uid())
  );
create policy "pottings: insert own" on public.pottings
  for insert with check (
    experiment_id in (select e.id from public.experiments e where e.user_id = auth.uid())
  );
create policy "pottings: update own" on public.pottings
  for update using (
    experiment_id in (select e.id from public.experiments e where e.user_id = auth.uid())
  ) with check (
    experiment_id in (select e.id from public.experiments e where e.user_id = auth.uid())
  );
create policy "pottings: delete own" on public.pottings
  for delete using (
    experiment_id in (select e.id from public.experiments e where e.user_id = auth.uid())
  );

drop policy if exists "pots: select own" on public.pots;
drop policy if exists "pots: insert own" on public.pots;
drop policy if exists "pots: update own" on public.pots;
drop policy if exists "pots: delete own" on public.pots;

create policy "pots: select own" on public.pots
  for select using (
    experiment_id in (select e.id from public.experiments e where e.user_id = auth.uid())
  );
create policy "pots: insert own" on public.pots
  for insert with check (
    experiment_id in (select e.id from public.experiments e where e.user_id = auth.uid())
  );
create policy "pots: update own" on public.pots
  for update using (
    experiment_id in (select e.id from public.experiments e where e.user_id = auth.uid())
  ) with check (
    experiment_id in (select e.id from public.experiments e where e.user_id = auth.uid())
  );
create policy "pots: delete own" on public.pots
  for delete using (
    experiment_id in (select e.id from public.experiments e where e.user_id = auth.uid())
  );

-- ── create_potting RPC ───────────────────────────────────────────────────────
-- p_pots: jsonb array of objects
--   { "label": text?, "plant_count": int, "pot_size": text?, "substrate": text?,
--     "notes": text?, "image_url": text? }
-- A blank/missing label becomes "Pot N" (N = position in the array).
-- Returns the new potting id. Any failure rolls the whole call back.
create or replace function public.create_potting(
  p_experiment_id uuid,
  p_potted_on date,
  p_notes text,
  p_pots jsonb
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_total       integer;
  v_remaining   integer;
  v_potting_id  uuid;
  v_pot         jsonb;
  v_idx         integer := 0;
  v_count       integer;
  v_label       text;
  v_plants      integer;
begin
  if p_potted_on is null then
    raise exception 'create_potting: potted_on is required' using errcode = '22023';
  end if;
  if p_pots is null or jsonb_typeof(p_pots) <> 'array' or jsonb_array_length(p_pots) = 0 then
    raise exception 'create_potting: p_pots must be a non-empty array' using errcode = '22023';
  end if;

  -- Lock the experiment row so two concurrent pottings cannot both pass the check.
  -- RLS hides experiments the caller does not own, so a foreign id looks "not found".
  select coalesce(e.plant_count, 0) into v_total
  from public.experiments e
  where e.id = p_experiment_id and e.deleted_at is null
  for update;
  if not found then
    raise exception 'create_potting: experiment not found' using errcode = 'P0002';
  end if;

  -- Validate every pot and sum the plants being moved.
  v_count := 0;
  for v_pot in select * from jsonb_array_elements(p_pots) loop
    if jsonb_typeof(v_pot) <> 'object' then
      raise exception 'create_potting: each pot must be an object' using errcode = '22023';
    end if;
    v_plants := (v_pot ->> 'plant_count')::integer;
    if v_plants is null or v_plants < 1 then
      raise exception 'create_potting: each pot needs plant_count >= 1' using errcode = '22023';
    end if;
    v_count := v_count + v_plants;
  end loop;

  -- Phase 1 remaining as of the potting date.
  v_remaining := v_total
    - coalesce((
        select sum(l.deaths_count) from public.date_logs l
        where l.experiment_id = p_experiment_id
          and l.phase = 'propagation'
          and l.deleted_at is null
          and l.log_date <= p_potted_on
      ), 0)
    - coalesce((
        select sum(p.plant_count) from public.pots p
        join public.pottings t on t.id = p.potting_id
        where p.experiment_id = p_experiment_id
          and p.deleted_at is null
          and t.deleted_at is null
          and t.potted_on <= p_potted_on
      ), 0);

  if v_count > v_remaining then
    raise exception 'create_potting: cannot pot % plants, only % remain in Phase 1 on %',
      v_count, greatest(v_remaining, 0), p_potted_on
      using errcode = 'check_violation';
  end if;

  insert into public.pottings (experiment_id, potted_on, notes)
  values (p_experiment_id, p_potted_on, nullif(btrim(coalesce(p_notes, '')), ''))
  returning id into v_potting_id;

  for v_pot in select * from jsonb_array_elements(p_pots) loop
    v_idx := v_idx + 1;
    v_label := nullif(btrim(coalesce(v_pot ->> 'label', '')), '');
    insert into public.pots
      (experiment_id, potting_id, label, plant_count, pot_size, substrate, notes, image_url)
    values (
      p_experiment_id,
      v_potting_id,
      coalesce(v_label, 'Pot ' || v_idx),
      (v_pot ->> 'plant_count')::integer,
      nullif(btrim(coalesce(v_pot ->> 'pot_size', '')), ''),
      nullif(btrim(coalesce(v_pot ->> 'substrate', '')), ''),
      nullif(btrim(coalesce(v_pot ->> 'notes', '')), ''),
      nullif(btrim(coalesce(v_pot ->> 'image_url', '')), '')
    );
  end loop;

  return v_potting_id;
end;
$$;

revoke all on function public.create_potting(uuid, date, text, jsonb) from public, anon;
grant execute on function public.create_potting(uuid, date, text, jsonb) to authenticated;

commit;
