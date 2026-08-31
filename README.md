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
3. **Log entries** — inside an experiment, you add dated updates: how the plants
   look that day, with an optional photo. These stack up into a timeline so you
   can see progress at a glance.

Three ways to add a log entry, depending on how much you want to type:

- **Add Log Entry** — the full form: notes, root length, new leaves, plants lost
  and the cause, photo.
- **Photo** — the quick path. Take a picture, save. The note is optional.
- **Log all** (from a folder) — one entry written to every experiment in the
  folder at once, for when you change the water or fertilize the whole batch. It
  still shows up in each experiment's own timeline.

From an experiment you can tap **Export PDF** for a shareable report with the
batch details, notes, and every log entry with its photos, or **CSV** to get the
same log entries as a spreadsheet. A folder has its own CSV export covering all
of its experiments in one sheet.

Each folder can carry a **recurring reminder** — a task like "Change water" every
few days. The folder shows whether it's due or overdue with a **Mark done**
button, and folders needing attention are badged in the folder list.

Comparing experiments is the point of the app, so a folder with more than one
experiment also shows:

- **Charts** overlaying every experiment on shared axes — survival, root length,
  and new leaves — so you can see which treatment is pulling ahead.
- **A verdict line** naming the best treatment so far and the fastest to root.

Other tabs:

- **Stats** — everything across every folder: overall survival, median days to
  root, and survival broken down by treatment, folder, and origin.
- **Fertilizer Log** — a simple running list of the dates you fed your plants,
  plus a seasonal feeding-frequency guide.
- **Pest Control** — a reference of common pests with quick treatment steps and a
  fuller protocol for the ones covered in detail.
- **Tips** — short propagation reference notes.
- **Notes** — free-form notes with optional photos.

The layout adapts to the screen: a side navigation rail on desktop, a bottom bar
on phones.

## Current state

The web app is **live at https://plant-experiments-app.vercel.app** (deployed
from `main` via Vercel) and also runs locally with `npm run dev`. An Android
build is working too: `npm run apk` produces an installable debug APK, with the
hardware back button and a themed status bar/splash screen wired up. The phone
build is deliberately slimmer than the web app — it drops the PDF/CSV export
buttons and the top-of-experiment photo shortcut (no file downloads on a phone),
its bottom-bar labels are shortened (Exp. / Feeding / Pests), and adding a photo
to a log entry offers an explicit **Take photo** vs **Choose from device**
choice. When the soft keyboard opens, Android shrinks the app window
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

- Sign-in and per-user private data
- Folders, experiments, and dated log entries with photo uploads
- **Folder-wide log entries** — from a folder, add one dated update (e.g. a water
  change or a round of fertilizer) to every experiment in that folder at once.
  Each experiment still gets its own entry, so it shows up in every individual
  timeline.
- **Quick photo logging** — one tap, take a picture, done; the note is optional
- **Comparison charts and a verdict** on which treatment is winning inside a
  folder, including how many days each took to root
- **Stats** across every folder — survival by treatment, folder, and origin
- **Recurring reminders** per folder, with overdue badges on the folder list
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

Configuration (Supabase URL and key) lives in a git-ignored `.env.local` file.
Build the production web bundle with `npm run build`. For the Android app,
`npm run apk` builds a debug APK and `npm run apk:install` pushes it to a
USB-connected phone — see `ANDROID_BUILD.md` for the one-time toolchain setup.

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
4. Optional: in Supabase → **Authentication → URL Configuration**, set the Site
   URL to your Vercel URL. Only needed if you later turn email confirmation back
   on (it's currently disabled).
