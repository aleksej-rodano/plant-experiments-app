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

From an experiment you can tap **Export PDF** to get a shareable report with the
batch details, notes, and every log entry with its photos.

Other tabs:

- **Fertilizer Log** — a simple running list of the dates you fed your plants,
  plus a seasonal feeding-frequency guide.
- **Pest Control** — a reference of common pests with quick treatment steps and a
  fuller protocol for the ones covered in detail.
- **Tips** — short propagation reference notes.
- **Notes** — free-form notes with optional photos.

The layout adapts to the screen: a side navigation rail on desktop, a bottom bar
on phones.

## Current state

The web app is functional and in active use. Working today:

- Sign-in and per-user private data
- Folders, experiments, and dated log entries with photo uploads
- **Folder-wide log entries** — from a folder, add one dated update (e.g. a water
  change or a round of fertilizer) to every experiment in that folder at once.
  Each experiment still gets its own entry, so it shows up in every individual
  timeline.
- Editing a folder's details, description, and cover image
- PDF export of an experiment
- Fertilizer log, pest reference, tips, and notes

Photos are automatically shrunk before upload so saving stays fast.

## Future steps

- **Hosted deployment (no more local)** — today the interface only runs on your
  own machine with `npm run dev`. The next step is deploying the web app to a
  host so it has a public URL and other people can sign in and use it without
  checking out the code. The data backend (Supabase) is already hosted; this is
  about putting the frontend online and wiring up the production environment.
- **Android app** — the project is already wrapped with Capacitor so the same web
  app can be installed as a native Android app. The next step is building and
  testing the APK in Android Studio, then adding native touches: using the phone
  camera directly for photos, and making the hardware back button navigate within
  the app instead of closing it.
- Smaller polish: quicker photo capture, offline tolerance, and tidying a few
  rough edges in the pest and tips sections.

## Running it locally

```bash
npm install
npm run dev
```

Configuration (Supabase URL and key) lives in a git-ignored `.env.local` file.
Build the production web bundle with `npm run build`; `npm run android` opens the
Android project in Android Studio.
