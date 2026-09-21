# Team Attendance & Task Portal

A full-stack team management app with biometric attendance ingest, live
task tracking, and admin oversight. Built with **React (Vite + TypeScript +
Tailwind)** on the frontend and **Supabase** (Postgres, Auth, Realtime,
Edge Functions) on the backend.

## Features

### Two roles
- **Admin (PM)**: full oversight — attendance sheet, live developer grid,
  manual attendance, task assignment, developer management.
- **Developer**: attendance-gated task board with a live timer.

### Developer side
- Login with email/password.
- If not checked in today, a **locked screen** appears — "Please mark your
  attendance on the biometric machine." It unlocks automatically via
  Supabase Realtime the instant a punch is recorded.
- After check-in: **My Tasks Today** — only tasks assigned to them.
- **Start Timer** is disabled until today's attendance exists. Only one
  task can run at a time. The timer persists across page refreshes (based
  on `started_at`).
- **Complete Task** opens a modal requiring a Git/code link (URL-validated)
  and a one-line summary — both mandatory.
- Shows today's check-in time, hours so far, and late status.

### Admin side — 3 main views
1. **Attendance Sheet**: name, check-in/out, total hours, status badges
   (Late in red, Manual in yellow, Half-day). Filter by date. Monthly
   summary with late count and total hours per developer. CSV export for
   both the daily sheet and the monthly summary.
2. **Live Developers Grid** (Realtime): card per developer showing
   Online/Offline, current task, and a live timer. Card turns **red with
   "OVERDUE"** when the timer exceeds the estimated time.
3. **Manual Attendance**: add or edit check-in/out for any developer with a
   compulsory reason field (e.g. "Scanner issue"). Stores `marked_by` and
   `source = 'manual'`.
- Also: **create/assign tasks** and **manage developers** (add users, set
  biometric user IDs).

### Biometric ingest
- A Supabase **Edge Function** (`punch`) receives punch events from the
  bridge, saves raw events, and upserts attendance rows (late detection,
  duplicate suppression within 2 minutes, auto check-out with hour
  calculation).
- A **Node.js bridge script** (`/bridge`) polls a ZKTeco device every 30
  seconds and POSTs new punches to the edge function.

## Setup

### 1. Database migrations
The schema, RLS policies, seed data, and profile trigger are applied via
Supabase MCP migrations. They are already applied in this project. To
re-apply or inspect, use the Supabase dashboard SQL editor or MCP tools.

**Seeded accounts:**

| Role     | Email           | Password   |
|----------|-----------------|------------|
| Admin    | admin@team.dev  | admin123   |
| Developer| dev1@team.dev   | dev123     |
| Developer| dev2@team.dev   | dev123     |

### 2. Edge Function secret
Set the `PUNCH_API_KEY` secret on your Supabase project (via the Supabase
dashboard → Edge Functions → Secrets). Use a long random string. The
bridge script must send the same value.

### 3. Frontend
```bash
npm install
npm run dev
```
The frontend env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) are
already in `.env`.

### 4. Bridge (biometric device → Supabase)
```bash
cd bridge
npm install
cp .env.example .env
# Edit .env with your device IP, Supabase URL, and PUNCH_API_KEY
npm start
```
See [`bridge/README.md`](bridge/README.md) for details.

## Architecture

```
ZKTeco Device
    │
    ▼
bridge/index.js (polls every 30s)
    │  POST { biometric_user_id, punched_at, device_id }
    ▼
Supabase Edge Function (punch)
    │  1. Save raw event → attendance_events
    │  2. Upsert attendance row (check-in / check-out / late / hours)
    ▼
Supabase Postgres (RLS-protected)
    │
    ▼
React Frontend (Realtime subscriptions)
```

### Database tables
- **profiles** — links to auth.users, stores role, level, biometric_user_id
- **attendance** — daily check-in/out, hours, status, source
- **attendance_events** — raw biometric punch log
- **tasks** — assigned work with timer state, git link, summary
- **settings** — singleton with office_start_time (default 09:00)

### RLS summary
- Developers: see only their own attendance and tasks; can update their
  tasks (but not reassign them); cannot edit attendance.
- Admin: full CRUD on all tables; can read raw attendance events.
- The edge function uses the service role key (bypasses RLS) to insert
  biometric events and attendance rows.
