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

The web app is functional and in active use. Working today:

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
