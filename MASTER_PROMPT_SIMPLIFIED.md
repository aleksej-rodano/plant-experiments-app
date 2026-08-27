Perfect! Here's your **Simplified Master Prompt (Option B — Supabase only, no sync complexity)**:

Copy this entire prompt and save it as `MASTER_PROMPT_SIMPLIFIED.md` in your `~/plant-experiments-app/` folder.

---

```markdown
# Plant Experiments Tracker App — Simplified Master Prompt (Option B)

## Project Context
You are building a plant experiments tracking app for managing up to 20 concurrent plant experiments.
The user runs 3-4 experiments simultaneously, updating each with 1 photo + notes per week.
Architecture: **React + Supabase (cloud-only, no offline complexity)**.
Final deliverable: Web app → Android via Capacitor.

---

## Global Project Rules

- **Framework**: React 18+ with Vite, TypeScript (strict mode)
- **Styling**: Tailwind CSS v4 with Material Design 3 color tokens
- **UI Library**: Lucide React for icons (no emojis anywhere in code or UI)
- **Code Style**: Prioritize conciseness. Comment only on complex logic. No pedagogical numbering in comments.
- **Backend**: Supabase (PostgreSQL + Storage)
- **Image Storage**: Supabase Storage (not Base64)
- **PDF Export**: jsPDF + html2canvas
- **Version Control**: Git + GitHub (push after each task)

---

## Material Design 3 Setup

Use these Tailwind extensions for MD3:
- Primary: `#1b5e20` (plant green)
- Secondary: `#00897b`
- Tertiary: `#d32f2f`
- Error: `#d32f2f`
- Surface: `#fafafa`
- Rounded: `rounded-lg` (Material's 12dp default)
- Typography: Roboto (Google Fonts)

---

## Supabase Credentials

```
Project URL: https://cflrpseiuijldzpadmte.supabase.co
Anon Key: sb_publishable_X8cQAjA2bATJu5zewYRriw_pfeNo7ek
```

Database already configured with:
- `experiments` table
- `date_logs` table
- `pest_guides` table (seeded)
- `tips` table (seeded)
- `experiment-photos` storage bucket

---

## Task 0b: Vite Project Setup & Material Design 3 Tailwind Config

**Objective**: Initialize React + TypeScript + Vite project with Tailwind MD3 tokens.

**Requirements**:
1. Scaffold Vite project:
   ```bash
   npm create vite@latest plant-experiments-app -- --template react-ts
   cd plant-experiments-app
   npm install
   ```
2. Install dependencies:
   ```bash
   npm install -D tailwindcss postcss autoprefixer lucide-react
   npm install @supabase/supabase-js react-router-dom
   npm install jspdf html2canvas
   npm install -D @tailwindcss/forms
   ```
3. Configure Tailwind with Material Design 3:
   - Set primary colors to `#1b5e20` (plant green)
   - Configure rounded: 12px (Material standard)
   - Add Roboto font from Google Fonts
   - Ensure mobile-first breakpoints
4. Create project structure:
   ```
   src/
   ├── components/        (UI components)
   ├── pages/             (Route pages)
   ├── lib/
   │   ├── supabase.ts    (Supabase client)
   │   ├── hooks/         (Custom React hooks)
   │   └── utils/         (Helpers)
   ├── types/             (TypeScript interfaces)
   └── App.tsx            (Root component)
   ```
5. Add `.env.local` (git-ignored) with Supabase credentials:
   ```
   VITE_SUPABASE_URL=https://cflrpseiuijldzpadmte.supabase.co
   VITE_SUPABASE_ANON_KEY=sb_publishable_X8cQAjA2bATJu5zewYRriw_pfeNo7ek
   ```

**Deliverables**:
- Vite project structure ready
- Tailwind MD3 configured
- All dependencies installed
- `tailwind.config.ts` with Material Design 3 tokens
- `.env.local` set up (git-ignored)
- Push to GitHub (commit: "Task 0b: Vite + Tailwind setup")

---

## Task 0c: Supabase Client & Authentication Setup

**Objective**: Initialize Supabase client and set up basic auth.

**Requirements**:
1. Create `src/lib/supabase.ts`:
   - Initialize Supabase client with project URL + anon key
   - Export typed client
2. Create `src/lib/hooks/useAuth.ts`:
   - Hook to handle login/signup/logout
   - Hook to get current user
   - Hook to check auth state
3. Create `src/pages/LoginPage.tsx`:
   - Email + password login form
   - Email + password signup form (toggle between them)
   - Redirect to dashboard on success
   - Show errors if auth fails
4. Create auth context or state (choose one):
   - React Context (simpler)
   - Zustand/Redux (overkill for this)
   - **Recommend Context**

**Deliverables**:
- `src/lib/supabase.ts` with client config
- `src/lib/hooks/useAuth.ts` with auth logic
- `src/pages/LoginPage.tsx` with auth forms
- Test: Login/signup works, user persists on refresh
- Push to GitHub (commit: "Task 0c: Supabase + auth setup")

---

## Task 1: UI Shell & Navigation (Material Design 3)

**Objective**: Build the main app layout with responsive navigation.

**Requirements**:
1. Create `src/components/Layout.tsx`:
   - Top header with app title ("Plant Experiments")
   - Bottom navigation bar (mobile-first, hidden on desktop or moved to sidebar)
   - Nav items: Experiments (home icon), Pest Control (bug icon), Tips (lightbulb icon)
   - Material Design 3 styling: 12px rounded, proper color contrast
   - Logout button
2. Create routing in `src/App.tsx`:
   - Route `/login` → LoginPage
   - Route `/experiments` → Experiments Dashboard (default after login)
   - Route `/experiments/:id` → Experiment Detail
   - Route `/pest-control` → Pest Control View
   - Route `/tips` → Tips View
   - Redirect to login if not authenticated
3. Ensure mobile-responsive:
   - Bottom nav on mobile (< 768px)
   - Layout shifts appropriately for tablet/desktop
   - No horizontal scroll
4. Add placeholder pages for each route (empty, will fill in later tasks)

**Deliverables**:
- `src/components/Layout.tsx` with header + nav
- `src/App.tsx` with routing configured
- Material Design 3 applied (colors, spacing, typography)
- Responsive design tested (mobile + tablet)
- Push to GitHub (commit: "Task 1: UI shell + navigation")

---

## Task 2: Experiments Dashboard (List/Grid View)

**Objective**: Display all experiments with key info, add experiment button.

**Requirements**:
1. Create `src/pages/ExperimentsPage.tsx`:
   - Fetch experiments from Supabase using `supabase.from('experiments').select()`
   - Use `useEffect` to load on mount
   - Display grid of experiment cards (2 columns on mobile, 3+ on desktop)
   - Show loading state while fetching
2. Create `src/components/ExperimentCard.tsx`:
   - Show: cover image, title (plant species), plant count, origin
   - Clickable → navigate to `/experiments/:id`
   - Delete button with confirmation
   - Apply Material Design 3 card styling
3. Add "New Experiment" button (FAB or top action):
   - Routes to create form
4. Show empty state if no experiments

**Deliverables**:
- `src/pages/ExperimentsPage.tsx` with experiment list
- `src/components/ExperimentCard.tsx` with card UI
- Grid layout (responsive)
- FAB or button for new experiment
- Loading state + error handling
- Push to GitHub (commit: "Task 2: Experiments dashboard")

---

## Task 3: Create Experiment Form

**Objective**: Form to add new experiments with image upload.

**Requirements**:
1. Create `src/pages/CreateExperimentPage.tsx`:
   - Form fields:
     * Title (plant species) — required, text input
     * Plant count — required, number input
     * Origin (where purchased) — required, text input
     * Initial price — optional, number input
     * Notes — optional, textarea
     * Cover image — optional, image upload
2. Image handling:
   - Accept JPG/PNG, max 5MB
   - Upload to Supabase Storage (`experiment-photos` bucket)
   - Get public URL after upload
   - Preview before save
3. Validation:
   - Title + plant count required
   - Error messages for empty fields
4. On submit:
   - Insert into `experiments` table
   - Redirect to dashboard with success toast
5. Material Design 3: Use MD3 input styling, rounded buttons

**Deliverables**:
- `src/pages/CreateExperimentPage.tsx` with full form
- Image upload + preview
- Form validation
- Supabase Storage integration
- Success/error notifications (toast)
- Push to GitHub (commit: "Task 3: Create experiment form")

---

## Task 4: Experiment Detail View & Date Log Timeline

**Objective**: Show experiment details and chronological log of updates.

**Requirements**:
1. Create `src/pages/ExperimentDetailPage.tsx`:
   - Get experiment ID from URL params
   - Fetch experiment from Supabase
   - Display:
     * Cover image (large)
     * Title, plant count, origin, initial price, notes
     * "Export to PDF" button
     * "Add Log Entry" button
   - Show loading state
2. Create `src/components/DateLogTimeline.tsx`:
   - Fetch date logs for this experiment from Supabase
   - Sort by date (newest first)
   - Each log shows: date, status text, image (if present)
   - Timeline visual (vertical line with dots)
3. Create `src/pages/AddDateLogPage.tsx`:
   - Form fields:
     * Date picker (default today)
     * Status details — required, textarea
     * Photo upload — optional
   - Upload image to Supabase Storage if provided
   - Insert into `date_logs` table
   - Success → return to detail page
4. Navigation: Back button, delete experiment option

**Deliverables**:
- `src/pages/ExperimentDetailPage.tsx` with full detail view
- `src/components/DateLogTimeline.tsx` with timeline UI
- `src/pages/AddDateLogPage.tsx` with log form
- Supabase queries (select, insert)
- Push to GitHub (commit: "Task 4: Experiment detail + date log timeline")

---

## Task 5: PDF Export

**Objective**: Generate downloadable PDF of experiment history.

**Requirements**:
1. Create `src/lib/utils/pdfExport.ts`:
   - Function: `exportExperimentToPDF(experiment, dateLogs)`
   - Include:
     * Experiment title, plant count, origin, notes
     * Initial price (if present)
     * Creation date
     * All date logs in chronological order
     * Images embedded in PDF (if present)
     * Clean, readable formatting
2. Use jsPDF + html2canvas:
   - Render a hidden HTML template
   - Capture as image via html2canvas
   - Insert into jsPDF
   - Download with filename: `{plant-species}-{date}.pdf`
3. Add "Export to PDF" button in ExperimentDetailPage
   - On click: Generate PDF, trigger download

**Deliverables**:
- `src/lib/utils/pdfExport.ts` with export logic
- PDF template in hidden DOM
- "Export" button functional
- Test: Generate PDF, check content + images render
- Push to GitHub (commit: "Task 5: PDF export")

---

## Task 6: Pest Control & Tips Views

**Objective**: Display knowledge base for pest treatment and care tips.

**Requirements**:
1. Create `src/pages/PestControlPage.tsx`:
   - Fetch pest guides from Supabase: `supabase.from('pest_guides').select()`
   - Display as clickable list
2. Create `src/components/PestDetailModal.tsx`:
   - Show pest name + treatment steps (as numbered list)
   - Close button
   - Material Design modal styling
3. Create `src/pages/TipsPage.tsx`:
   - Fetch tips from Supabase: `supabase.from('tips').select()`
   - Display list of tips
   - Click → expand to full content
4. Verify seed data exists:
   - PestGuides: "Scale Insects", "Springtails"
   - Tips: "Watering Reference", "Hydrogen Peroxide Dilution"

**Deliverables**:
- `src/pages/PestControlPage.tsx` with pest list
- `src/components/PestDetailModal.tsx` with treatment guide
- `src/pages/TipsPage.tsx` with tips list
- Seed data verified in Supabase
- Push to GitHub (commit: "Task 6: Pest control + tips views")

---

## Task 7: Polish & Testing

**Objective**: Fix bugs, improve UX, ensure app is production-ready.

**Requirements**:
1. Test on real mobile device (browser)
2. Fix any layout/styling issues (Material Design 3 compliance)
3. Improve error handling:
   - Network errors → show retry prompt
   - Supabase errors → user-friendly message
   - Image upload failures → fallback
4. Add loading states (skeleton screens or spinners)
5. Performance:
   - Lazy-load images
   - Optimize Supabase queries
   - Check bundle size
6. Accessibility:
   - Alt text on images
   - Proper heading hierarchy
   - Color contrast check
7. Test all CRUD operations:
   - Create experiment ✅
   - Read experiment ✅
   - Update experiment ✅
   - Delete experiment ✅
   - Add date log ✅
   - Export to PDF ✅
   - PC ↔ Phone sync (automatic via Supabase) ✅

**Deliverables**:
- Bug fixes applied
- UX improvements documented
- Accessibility verified
- Mobile-tested and functional
- All CRUD operations working
- Push to GitHub (commit: "Task 7: Polish + testing")

---

## Task 8: Capacitor Setup (Android)

**Objective**: Wrap web app as native Android app.

**Requirements**:
1. Build web app for production:
   ```bash
   npm run build
   ```
2. Install Capacitor:
   ```bash
   npm install @capacitor/core @capacitor/cli
   npm install -D @capacitor/android
   ```
3. Initialize Capacitor:
   ```bash
   npx cap init plant-experiments-app com.experiments.planttracker
   ```
4. Configure `capacitor.config.json`:
   - appId: `com.experiments.planttracker`
   - appName: `Plant Experiments`
   - webDir: `dist`
5. Add Android:
   ```bash
   npx cap add android
   npx cap sync
   ```
6. Open Android Studio:
   ```bash
   npx cap open android
   ```
7. Build APK: Build > Build Bundle(s) / APK(s)

**Deliverables**:
- Capacitor configured
- Android project generated
- APK builds without errors
- Push to GitHub (commit: "Task 8: Capacitor setup")

---

## Task 9: Native Camera Integration

**Objective**: Use device camera for photo uploads on Android.

**Requirements**:
1. Install Capacitor Camera:
   ```bash
   npm install @capacitor/camera
   npm install -D @capacitor/camera
   ```
2. Create `src/lib/hooks/useDeviceCamera.ts`:
   - Hook that wraps Camera plugin
   - Fallback to file input on web
   - Returns image as File
3. Update image upload in CreateExperimentPage + AddDateLogPage:
   - On mobile: "Take Photo" button → camera
   - On mobile: "Choose from Gallery" button → photo library
   - On web: File input (fallback)
4. Handle permissions (Android):
   - Camera + READ_EXTERNAL_STORAGE in AndroidManifest.xml
   - Graceful fallback if denied
5. Test on Android device:
   - Take photo → uploads to Supabase Storage
   - Verify image appears in app + syncs to PC

**Deliverables**:
- `src/lib/hooks/useDeviceCamera.ts` with camera logic
- Camera button in forms (mobile only)
- File input fallback on web
- Permissions handled
- Tested on Android device
- Push to GitHub (commit: "Task 9: Native camera integration")

---

## GitHub Workflow

After each task, push to GitHub:

```bash
git add .
git commit -m "Task X: [Description]"
git push origin main
```

---

## Testing Checklist (Per Task)

Before each push:
- [ ] No console errors/warnings
- [ ] Feature works as described
- [ ] Mobile responsive (< 768px tested)
- [ ] Images load correctly
- [ ] Forms validate properly
- [ ] Material Design 3 applied
- [ ] Supabase queries working

---

## Running the App

**Development**:
```bash
npm run dev
```
Opens at `http://localhost:5173`

**Build for production**:
```bash
npm run build
```

---

## Environment Variables (.env.local)

```
VITE_SUPABASE_URL=https://cflrpseiuijldzpadmte.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_X8cQAjA2bATJu5zewYRriw_pfeNo7ek
```

---

## Architecture Overview

**Simple and Direct**:
- React component → Supabase client → PostgreSQL/Storage
- No offline queues, no sync logic
- Every operation talks directly to Supabase
- PC and phone see the same data (automatic)

---

## Ready. Start with Task 0b in Cowork.

In Claude Desktop:
1. Open Cowork
2. Select `plant-experiments-app` folder
3. Create a new chat
4. Paste MASTER_PROMPT_SIMPLIFIED.md
5. Say: "Ready for Task 0b: Vite Project Setup"
6. Follow along step by step
```

---
