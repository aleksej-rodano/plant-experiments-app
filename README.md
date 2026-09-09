# Plant Experiments Tracker

A small web app for keeping track of plant propagation experiments — which batch
of plants came from where, what you tried on them, and how each attempt is doing
over time. Photos, notes, feeding dates, and a pest reference are all in one place,
and any experiment can be exported to a PDF.

## How to use it

You sign in with an email and password. Everything you add is private to your
account.

The app is organised in three levels:

1. **Folders** — one folder per batch of plants. A folder records where the
   plants came from, what you paid, an optional cover photo, and a description.
   Open a folder and use **Edit** to change its description or picture later.
2. **Experiments** — inside a folder, each experiment is one thing you changed
   (e.g. "rooting powder", "smaller cuttings", "control"). You give it a name, the
   number of plants involved, notes, and an initial photo.
3. **Log entries** — inside an experiment, you add dated check-ins: how many
   plants sit in each root/shoot stage that day, with an optional photo and
   note. These stack up into a timeline, topped by a **latest-check-in
   snapshot** (counts + percentages for both tracks, % rooted / shoot /
   established, and the leafing-without-rooting flag) and **trend charts**
   showing the stage distribution across every check-in. Tap any photo in the
   timeline (or on a note) to open it full-screen, then pinch or double-tap to
   zoom in and drag to pan.

Three ways to add a log entry, depending on how much you want to type:

- **Add Log Entry** — the full check-in. Instead of measuring one plant, you
  tally how many plants sit in each stage right now, on two independent scales:
  - **Root track** — R0 no root · R1 initiation (<2 mm) · R2 elongation (≥2 mm)
  - **Shoot / leaf track** — S0 none · S1 bud/leaf closed · S2 leaf unfolded ·
    S3 established
  Plus a **dead / removed** count with cause, and a **leafing without rooting**
  count — plants pushing a leaf with no root yet, an early risk signal that has
  to be entered on its own. Counts are the current state, so they can go down if
  something dies back. If the buckets don't add up to the plants you started
  with, you get a soft warning but can still save.
- **Photo** — the quick path. Take a picture, save. The note is optional.
- **Log all** (from a folder) — one entry written to every experiment in the
  folder at once, for when you change the water or fertilize the whole batch. It
  still shows up in each experiment's own timeline.

After picking or taking a photo, tap **Circle** to drop an adjustable red ring on
it — drag to position, use the slider to size it — and it's burned into the image
before upload, so the marked-up photo is what lands in the log.

From an experiment you can tap **Export PDF** for a shareable report with the
batch details, notes, and every log entry with its photos, or **CSV** to get the
same log entries as a spreadsheet. A folder has its own CSV export covering all
of its experiments in one sheet.

Each folder can carry a **recurring reminder** — a task like "Change water" every
few days. The folder shows whether it's due or overdue with a **Mark done**
button, and folders needing attention are badged in the folder list.

Comparing experiments is the point of the app, so a folder with more than one
experiment also shows:

- **A survival chart** overlaying every experiment on shared axes, plus a
  **latest-snapshot table** — % rooted, % with any shoot, % established and the
  leafing-without-rooting count for each experiment side by side.
- **A verdict line** naming the best treatment so far and the fastest to root.

Other tabs:

- **Stats** — everything across every folder: overall survival, median days to
  root, and survival broken down by treatment, folder, and origin.
- **Fertilizer Log** — a simple running list of the dates you fed your plants,
  plus a feeding guide: frequency by season, and how long to wait before feeding
  freshly potted plants (6–8 weeks) or ones just bought from a garden centre
  (2–3 months).
- **Pest Control** — a reference of common pests with quick treatment steps and a
  fuller protocol for the ones covered in detail.
- **Tips** — short reference notes: propagation technique plus care for
  specific plants (a pothos & Monstera section covers the aroid triple mix,
  watering, and getting fenestrated leaves).
- **Notes** — free-form notes with optional photos.

The layout adapts to the screen: a side navigation rail on desktop, a bottom bar
on phones.

## Current state

The web app is **live at https://plant-experiments-app.vercel.app** (deployed
from `main` via Vercel) and also runs locally with `npm run dev`.

It's an **installable PWA** — open the site on a phone or desktop and use the
browser's "Install app" / "Add to Home Screen", and it runs in its own window
with the plant-green icon. The service worker precaches the (content-hashed)
build so it launches fast and picks up each new deploy silently; nothing from
Supabase is cached, so data is always live. There is no offline mode — the app
needs a connection to load its data.

The PDF export stack (jsPDF + html2canvas, ~780 kB) is deliberately left out of
the precache — `globIgnores` in `vite.config.ts`. It is already a dynamic import
so it stays off the initial page load, and precaching it would have undone that
by pulling the whole thing down on first visit and again after every deploy,
whether or not you ever export anything. It fetches on demand instead, which is
also why Export PDF needs a connection.

The Android app is a thin **Capacitor** shell that now loads the live site
directly (`server.url` in `capacitor.config.ts`) instead of a copy baked into
the APK. So a `git push` — which redeploys Vercel — updates the phone on its
next launch, no USB reinstall. You only rebuild and sideload the APK
(`npm run apk:install`) when *native* code changes: a plugin, `capacitor.config.ts`,
or `AndroidManifest.xml`. The shell keeps the native pieces the PWA can't do —
the 11:00 daily care-reminder notifications, hardware back button, themed status
bar/splash, and native token storage. The service worker is not registered
inside the shell, so the WebView always shows the freshest deploy. The phone
build is deliberately slimmer than the web app — it drops the PDF/CSV export
buttons and the top-of-experiment photo shortcut (no file downloads on a phone),
its bottom-bar labels are shortened (Exp. / Feeding / Pests), and every photo
field — log entries and the folder / experiment cover image on both the create
and edit forms — offers an explicit **Take photo** vs **Choose from device**
choice. The auth token is stored through `@capacitor/preferences` (native
`SharedPreferences`) rather than the WebView's `localStorage`, which the OS was
evicting on cold start and logging the user out — you now stay signed in until
you explicitly sign out. When the soft keyboard opens, Android shrinks the app window
(`android:windowSoftInputMode="adjustResize"` on the activity) so the layout
shrinks with it and the focused field scrolls into view.

Two traps live behind that one line, both of which produce the same symptom — a
dead band between the form and the keyboard — so they are worth writing down.

**`@capacitor/keyboard`'s `resize` option does nothing on Android.** The plugin
never calls `setSoftInputMode` and never reads that key (`setResizeMode` is
`unimplemented()`); it is iOS-only. Without the manifest attribute the window
defaults to `adjustPan`, the web view keeps its full screen height, and the
unused space inside `<main>` shows up as the dead band.

**The page must not ask for `viewport-fit=cover`.** Capacitor's built-in
`SystemBars` plugin pads the web view's parent by the keyboard inset when the
page requests cover *and* the system web view is >= 140. That is the right thing
on Android 15+, where the window does not resize — but on Android 14 and below
`adjustResize` has already shrunk the window, so the inset is subtracted twice
and the web view collapses to a sliver of its parent. `SystemBars` still handles
insets on Android 15+ without the meta tag (that branch is gated on the SDK
level, not on the tag), so dropping it costs nothing.

Both are diagnosable over adb rather than by guessing:

```bash
adb shell dumpsys window windows | grep sim=
```

reports the window's real soft-input mode (`adjust=resize` vs `adjust=pan`), and
`adb shell uiautomator dump /sdcard/ui.xml` shows whether the `WebView` bounds
match its parent `ViewGroup` — if the web view is shorter, something is
subtracting the inset twice.

Working today:

- Sign-in and per-user private data, with a **"Forgot your password?"** email
  reset link (the email always points at the hosted web app, then you sign into
  the phone with the new password)
- Folders, experiments, and dated log entries with photo uploads
- **Folder-wide log entries** — from a folder, add one dated update (e.g. a water
  change or a round of fertilizer) to every experiment in that folder at once.
  Each experiment still gets its own entry, so it shows up in every individual
  timeline.
- **Quick photo logging** — one tap, take a picture, done; the note is optional
- **Plant watered / Fertilized** — one-tap buttons on the add-log forms write a
  today-dated entry with nothing else to fill in. From a folder they log to every
  experiment at once, and "watered" also resets that folder's reminder. Both
  flags get their own column in the CSV export, so every watering / feeding date
  is in the sheet.
- **Comparison charts and a verdict** on which treatment is winning inside a
  folder, including how many days each took to root
- **Stats** across every folder — survival by treatment, folder, and origin
- **Recurring reminders** on a folder *and* on each experiment (both optional) —
  a task label and a repeat interval, with overdue badges on the folder list. On
  the Android app these also fire a phone notification at 11:00 each day that
  lists every folder / experiment chore due or overdue, and keep re-notifying
  each morning until the task is marked done.
- Editing a folder's details, description, and cover image
- PDF and CSV export, per experiment and per folder
- **Bin** — deleting anything moves it to a bin you can restore from for 30 days,
  after which it and its photos are removed permanently
- Fertilizer log, pest reference, tips, and notes

Photos are automatically shrunk before upload so saving stays fast.

Database changes live in `db/` as dated SQL files. They are idempotent and
transaction-wrapped, and you run them yourself in the Supabase SQL editor — the
app expects the columns they add, so a new one has to be run before the features
in that release will work.

Three are currently outstanding — run them in date order.

`db/2026-09-10_storage_policies.sql` fixes the `experiment-photos` bucket. It
had an INSERT policy that only checked you were signed in (not which bucket or
path), a public SELECT policy, and **no DELETE policy at all** — so
`supabase.storage.remove()` was silently denied and the app has never actually
deleted a photo. The bin's 30-day purge left every image behind, and replacing a
photo leaked the old one. The migration scopes writes to your own `<uid>/`
prefix, adds the missing delete policy, and sets a 10 MB / JPEG-PNG limit on the
bucket so the server enforces what `validateImage` checks in the client.

`db/2026-09-10_not_null_invariants.sql` adds `not null` to columns the app
already treats as non-null (`date_logs.experiment_id`, the `created_at` /
`updated_at` timestamps, `experiments.user_id`). They all have defaults and no
row violates them today; this just stops the schema and
`src/types/database.ts` disagreeing.

`db/2026-09-09_pest_guide_images_per_user.sql` — already run. Pest
reference photos move to their own owner-scoped table: `pest_guides` is seeded
shared reference content, and the policy that let you set a photo on it was a
table-wide UPDATE, so any signed-in account could also rewrite the pest names and
treatment steps everyone else reads. That table is now read-only from the client
and each account keeps its own photos. Photos added before the migration stay
visible as a fallback.

## Future steps

- **Native camera** — the log form now gives a Take photo / Choose from device
  choice, both routed through the webview file picker (the camera option uses
  `capture="environment"`). Swapping in the native `@capacitor/camera` plugin
  would add an in-app preview/retake step and is the main remaining Android
  polish item.
- **Release build** — the debug APK is built and installable now. A signed
  release build (own keystore, smaller optimised bundle) is only needed if the
  app is distributed more widely; steps are in `ANDROID_BUILD.md`.
- Smaller polish: offline tolerance, and tidying a few rough edges in the pest
  and tips sections.

## Running it locally

```bash
npm install
npm run dev
```

`npm test` runs the unit tests (vitest) over the date, care-schedule, stage and
survival helpers — the parts with enough arithmetic to break quietly. They pin
`TZ=Pacific/Auckland` on purpose: several of these helpers are about reading the
*local* calendar rather than the UTC one, and in UTC the two agree, so a
regression would pass unnoticed. `npm run lint` runs oxlint.

Configuration (Supabase URL and key) lives in a git-ignored `.env.local` file.
Build the production web bundle with `npm run build`. For the Android app,
`npm run apk` builds a debug APK and `npm run apk:install` pushes it to a
USB-connected phone — see `ANDROID_BUILD.md` for the one-time toolchain setup.

### Enabling developer mode on a Samsung phone

`npm run apk:install` needs USB debugging, which lives under Developer options.
On Samsung (One UI):

1. **Settings → About phone → Software information**.
2. Tap **Build number** seven times; enter your PIN/pattern when asked.
3. Go back to **Settings → Developer options** (new item near the bottom).
4. Enable **USB debugging**, plug in the phone, and tap **Allow** on the prompt.
5. Check the PC sees it: `adb devices` should list the phone as `device`.

## Deploying the web app

The frontend is a static Vite build; Supabase is the backend and is already
hosted. Deployment is configured for Vercel (`vercel.json`). One-time setup:

1. At [vercel.com/new](https://vercel.com/new), sign in with GitHub and import
   the `plant-experiments-app` repository. Vercel reads `vercel.json`, so the
   framework, build command (`npm run build`) and output (`dist`) are already
   set — don't override them.
2. Under **Environment Variables** add, for all environments:
   - `VITE_SUPABASE_URL` — same value as in your local `.env.local`
   - `VITE_SUPABASE_ANON_KEY` — same value as in your local `.env.local`
   (The anon key is safe in a client bundle; row-level security is what protects
   the data.)
3. Click **Deploy**. You get a `*.vercel.app` URL; every later push to `main`
   redeploys automatically.
4. In Supabase → **Authentication → URL Configuration**, set the **Site URL** to
   your Vercel URL and add these to **Redirect URLs**:
   - `https://<your-app>.vercel.app/reset-password`
   - `http://localhost:5173/reset-password` (for local dev)

   The password-reset email link uses these; without them Supabase falls back to
   the Site URL. (Also needed if you ever turn email confirmation back on — it's
   currently disabled.)
