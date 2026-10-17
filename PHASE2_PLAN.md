# Phase 1 / Phase 2 (potting) — implementation plan

Status: **PLAN ONLY — nothing built yet.** Each stage below is meant to be given to Claude
on its own ("do Stage 3 of PHASE2_PLAN.md"). Stages are ordered; later ones depend on
earlier ones. After every stage: `npm run build` (not only `tsc --noEmit`), commit, push
to origin/main, update README in the same push.

Project rules that apply to every stage (also in Claude's memory): push every change
straight to main; run DB migrations yourself via Supabase MCP `execute_sql` (never ask the
user to paste SQL; keep the `.sql` file in `db/` too); every button has visible verb text
(no icon-only buttons); finish replies with a numbered list of what the user must do.

---

## 1. Concept

An experiment has two phases on one timeline:

- **Phase 1 — Propagation**: what exists today (root track R0–R2, leaf track S0–S3,
  deaths).
- **Phase 2 — Potted**: plants that were moved into pots.

Plants move from Phase 1 to Phase 2 through **potting events**. A potting event is partial
or total, happens on a date, and creates one or more **pots**. Pots are tracked
individually, each with its own photo. One pot can hold several plants, so
**pots ≠ plants**: a pot has its own `plant_count`.

An experiment can have many potting events over time. The experiment keeps running in
Phase 1 for the plants that were not moved.

Only two phases for now. `date_logs.phase` is a text column with a CHECK so a third phase
can be added later without a redesign.

## 2. Decisions already made by the user

| # | Decision |
|---|----------|
| 1 | Track **individual pots**; each pot can have a picture. |
| 2 | Pots are never regrouped; plants are not moved between pots. |
| 3 | Pot size and substrate are optional free text. |
| 4 | Multiple potting events per experiment. |
| 5 | Only a **suggestion**: plants at R2 and S3 are likely ready. Never enforced. |
| 6 | Phase 2 check-in records: alive, died (+ cause), health counts good/ok/poor, photo, notes. |
| 7 | Show both figures (potted share of original plants; alive in pots). Informational only. |
| 8 | **No automatic "succeeded" status and no success verdict.** The user will define a success parameter later. |
| 9 | **No separate care schedule for Phase 2.** The existing per-experiment schedule stays as is. |
| 10 | A plant cannot "come back" individually. Deleting the whole potting event is the undo. |
| 11 | Exactly two phases for now. |
| 12 | A **folder-level "Pot selected" action** (pot several experiments at once). |
| extra | Remove "(plants)" / "— plants at each stage" from the Root track and Leaf track titles. |

## 3. Assumptions Claude made (change them if wrong)

- **Phase 2 deaths and health are recorded per pot.** A Phase 2 check-in targets one pot.
  Deaths need a pot so the pot's alive count stays correct. Experiment-level Phase 2
  numbers are sums over pots.
- A check-in without a pot (photo / notes / watered / fertilized only) is allowed in Phase 2.
- A potting on date D counts as already happened for any Phase 1 check-in dated D.
- Experiment survival keeps its current formula: `alive = plant_count − Σ all deaths_count`
  (Phase 1 and pot deaths both live in `deaths_count`). So survival math barely changes.
- The "winner" callout and survival ranking stay Phase-1/overall-survival based and are not
  changed (decision 8). Potting figures are extra, informational columns.
- The leaf track is called "Shoot track" in code (`SHOOT_STAGES`, `s0_count`…). Only the
  visible label is "Leaf track"; do not rename code or columns.

## 4. Data model

### 4.1 New table `pottings` (one row per potting event)
- `id uuid pk default gen_random_uuid()`
- `experiment_id uuid not null references experiments(id) on delete cascade`
- `potted_on date not null default current_date`
- `notes text`
- `created_at`, `updated_at timestamptz` (same defaults/trigger style as other tables)
- soft-delete trio, exactly as other bin tables: `deleted_at`, `delete_batch_id`,
  `deleted_root`
- Plants moved is **derived**: Σ `pots.plant_count` of that potting (no duplicate column).

### 4.2 New table `pots`
- `id uuid pk`
- `experiment_id uuid not null references experiments(id) on delete cascade`
  (denormalised from the potting for simple queries and RLS)
- `potting_id uuid not null references pottings(id) on delete cascade`
- `label text not null` (default "Pot N", editable)
- `plant_count int not null check (plant_count >= 1)` — plants put in this pot
- `pot_size text`, `substrate text`, `notes text` (all optional)
- `image_url text` (pot photo)
- `created_at`, `updated_at`, soft-delete trio

### 4.3 Changes to `date_logs`
- `phase text not null default 'propagation' check (phase in ('propagation','potted'))`
  — all existing rows backfill to `propagation`.
- `pot_id uuid null references pots(id) on delete cascade` — set for per-pot Phase 2 logs.
- `health_good int null`, `health_ok int null`, `health_poor int null`, each `>= 0`.
- Existing `deaths_count` / `death_cause` are reused for pot deaths.

### 4.4 RLS and storage
- RLS on `pottings` and `pots`: all operations allowed only when the row's experiment
  belongs to `auth.uid()` (same pattern as `date_logs`, which has no `user_id`).
- Pot photos reuse the existing `experiment-photos` bucket and path
  `${user.id}/${uuid}.ext` through `src/lib/utils/image.ts`.

### 4.5 RPC for atomic potting
Postgres function `create_potting(p_experiment_id uuid, p_potted_on date, p_notes text,
p_pots jsonb) returns uuid`, `security invoker` (so RLS applies). It inserts the potting
row and all its pots in one transaction and validates that the plants moved do not exceed
the plants currently in Phase 1 as of `p_potted_on`. The client has no multi-table
transactions, so this is the safe way to do it; the bulk folder action calls it once per
experiment.

### 4.6 TypeScript types
Update `src/types/database.ts`. **Repeat the soft-delete fields inline per table; do NOT
use a shared `SoftDeleteRow &` intersection** (it makes supabase-js infer `never` and
breaks `npm run build` while `tsc --noEmit` passes). Export `Potting`, `Pot` types.

## 5. Plant accounting (single source of truth)

Put these in a new `src/lib/utils/phases.ts` and use them everywhere.

```
phase1Remaining(asOf) = plant_count
                      − Σ deaths_count of phase='propagation' logs with log_date <= asOf
                      − Σ pot.plant_count of live pots whose potting.potted_on <= asOf
potAlive(pot, asOf)   = pot.plant_count − Σ deaths_count of logs with pot_id = pot.id
                        and log_date <= asOf
phase2Alive(asOf)     = Σ potAlive over live pots potted on or before asOf
totalAlive            = plant_count − Σ all deaths_count        (unchanged formula)
pottedShare           = Σ live pot.plant_count / plant_count    (informational)
```

- Phase 1 stage-count warnings and the snapshot percentages use `phase1Remaining(asOf)` as
  denominator instead of the original `plant_count`.
- Validation: Phase 1 deaths ≤ `phase1Remaining`; pot deaths ≤ `potAlive`; health counts
  good+ok+poor ≤ `potAlive` (soft warning, like the existing stage warnings).
- Ready-to-pot suggestion (decision 5): from the latest Phase 1 snapshot show
  "up to `min(R2, S3)` plants may be ready (R2: x, S3: y)". Display only.

---

## STAGES

### Stage 1 — Label cleanup (tiny, independent, no DB)
- `src/components/DateLogForm.tsx` ~line 322: "Root track — plants at each stage" → "Root track".
- `src/components/DateLogForm.tsx` ~line 351: "Leaf track — plants at each stage" → "Leaf track".
- `src/components/StageChart.tsx` ~line 58: remove the `(plants)` span after the title
  (titles at ~256/264 are already "Root track" / "Leaf track").
- Grep for any other "(plants)" / "plants at each stage" in titles (StageSnapshot, timeline
  chips, PDF/CSV headings) and remove. Do not touch the "Plant count" field label in
  EditExperimentPage/CreateExperimentPage.
- Done when: no "(plants)" next to the two track titles anywhere. Build, commit, push.

### Stage 2 — Database, types, bin and backup plumbing
- Write `db/<date>_phase2_potting.sql` (idempotent, transaction-wrapped) with section 4:
  `pottings`, `pots`, `date_logs` columns, RLS policies, `create_potting` RPC. Apply it
  with Supabase MCP `execute_sql`; verify with a real insert/read/delete round trip on an
  owned experiment (remember: an insert with a bogus FK fails RLS before CHECKs run, so use
  real owned rows and delete them after).
- Update `src/types/database.ts` (inline soft-delete fields, see 4.6).
- `src/lib/utils/bin.ts`: add kinds `potting` (cascades to its pots and the pot logs) and
  `pot`; make `binExperiment` / `binFolder` also stamp pottings, pots and their logs with
  the same batch id; make `restoreBatch` / `purgeExpired` handle the new tables and remove
  pot photos via `removeStoredImages`. Update `BinPage.tsx` labels (e.g. "Potting of 6
  plants · 2 pots").
- `src/lib/utils/backup.ts`: include `pottings` and `pots` (binned rows included, as for
  the other tables).
- Done when: migration applied and verified live, types compile, `npm run build` green.
  No visible UI change yet.

### Stage 3 — Phase accounting utilities and Phase 1 denominators
- Create `src/lib/utils/phases.ts` with section 5 (pure functions, typed, unit-checkable by
  hand against a few worked examples written in a comment).
- `src/lib/utils/stages.ts`: `stageSnapshot` / `stageWarnings` take the Phase 1 remaining
  population as of that check-in instead of `plant_count`.
- `src/lib/utils/survival.ts` and `insights.ts`: keep the survival formula; make sure pot
  deaths count; add `pottedShare` and `phase2Alive` to the summary object (informational).
- Experiments with no pottings must behave exactly as before (regression check on a
  folder with existing data).
- Done when: existing experiment pages show identical numbers for experiments with no
  pottings; build green.

### Stage 4 — "Pot plants" flow for one experiment, with pots and pot photos
- New page `/experiments/:id/pot` (`PotPlantsPage.tsx`), button **"Pot plants"** on
  `ExperimentDetailPage` action row (explicit verb label).
- Form: date (default today), optional notes, then a dynamic list of pot rows. Each row:
  label, plants in pot (≥1), optional pot size, optional substrate, optional notes,
  optional photo (use `CoverImagePicker`-style camera + gallery inputs and
  `image.ts` upload). Buttons: **"Add another pot"**, **"Remove pot"**, **"Save potting"**.
- Show "Plants available to pot: N (as of date)" and the ready suggestion
  ("up to X may be ready"). Block save if total plants in pots > available; do not
  block on R2/S3.
- Save via the `create_potting` RPC (after uploading photos), then navigate back to the
  experiment with a toast.
- Edit a pot: `/experiments/:id/pots/:potId/edit` (label, size, substrate, notes, photo,
  plants-in-pot; cannot be lowered below the deaths already logged for it).
- Delete a potting event: confirm dialog saying how many plants return to Phase 1 and how
  many pot check-ins are deleted; goes to the bin (decision 10).
- Done when: potting creates pots, Phase 1 remaining drops accordingly, photos upload,
  delete/restore via bin works. Verify live with a test experiment.

### Stage 5 — Phase 2 check-ins
- Extend `DateLogForm` / `AddDateLogPage` / `EditDateLogPage` to be phase-aware (phase is
  passed from the section the user adds the log from; default `propagation`).
  Phase 2 form fields: date, **pot** selector (optional for photo/notes-only), plants died
  (+ cause required if > 0, capped at `potAlive`), health counts good / ok / poor with a
  soft warning if their sum exceeds `potAlive`, photo, notes (optional).
  Phase 1 form keeps the root/leaf track sections; Phase 2 form hides them.
- `DateLogTimeline`: Phase 2 chips ("Pot: <label>", "Health g/o/p", death chip), phase
  badge, and potting events shown as markers/rows in the timeline ("Potted 4 plants into
  2 pots").
- Quick watered / fertilized buttons keep working in both phases; the row's phase follows
  the section it is added from. QuickPhotoLogPage the same.
- Care schedule: unchanged (decision 9).
- Done when: Phase 2 logs can be added/edited/deleted, deaths reduce the pot's alive count
  and the experiment survival, validation caps work.

### Stage 6 — Experiment detail page: two phases + charts
- `ExperimentDetailPage`: header summary "In propagation X · Potted Y · Died Z".
  Two tabs/sections: **Phase 1 — Propagation** (existing snapshot, stage charts, timeline
  filtered to phase 1) and **Phase 2 — Potted** (pot list with photo, label, plants alive /
  plants in pot, size, substrate, last check-in; pot timeline). The Phase 2 tab only
  appears once a potting exists; remember last tab per experiment in component state only.
- `StageChart`: bars use the shrinking Phase 1 population; draw a vertical line + label at
  each potting date; keep the y-axis plant-count labels.
- New Phase 2 chart: stacked health bars (good/ok/poor) per Phase 2 check-in date using
  each pot's latest health log up to that date, plus an "alive in pots" line.
- Done when: both tabs render with real data, charts show potting markers, no console
  errors, mobile layout checked.

### Stage 7 — Folder-level "Pot selected" + folder/stats surfacing
- `FolderDetailPage`: selection mode on the experiment list (checkboxes) and a button
  **"Pot selected experiments"** → `/folders/:folderId/pot?ids=…` (`PotSelectedPage.tsx`).
- Wizard page: shared date and optional shared pot size / substrate / notes (copied into
  each pot row, editable); one section per selected experiment with its available plants,
  ready suggestion and the pot-row editor from Stage 4. Per-experiment validation. Save
  calls `create_potting` once per experiment; if one fails, show which succeeded and
  which failed and keep the failed ones on screen for retry.
- Folder cards / `FoldersPage` / `FolderDetailPage` rows: show "A propagating · B potted".
- `ComparisonChart` and `StatsPage` tables: add informational columns "Potted % of
  original" and "Alive in pots". `WinnerCallout` and the status field are NOT changed
  (decision 8).
- Done when: potting several experiments at once works, counts show on folder pages,
  winner logic untouched.

### Stage 8 — Exports and polish
- `csvExport.ts`: add `phase`, `pot label`, `health_good/ok/poor` columns to the log
  export, plus a pots section/file (label, plants, size, substrate, potting date, photo
  URL). Keep native-app hiding of exports as is.
- `pdfExport.ts`: Phase 2 section (potting events, pot list with photos, Phase 2 timeline);
  keep the block-rasterising approach so nothing splits across pages.
- README: document phases, potting, pots, the bulk action, accounting formulas, and the
  new migration.
- Final regression pass over every screen with old (no potting) and new data; check bin
  round trip for potting/pot/experiment/folder; `npm run build` clean.

---

## 6. Out of scope (for now)
- A success metric / auto "succeeded" status (user will define later).
- Phase 2 care schedule and reminders.
- Moving plants between pots, or returning a single plant to Phase 1.
- A third phase (planted out, sold). The `phase` column CHECK is the only groundwork.
