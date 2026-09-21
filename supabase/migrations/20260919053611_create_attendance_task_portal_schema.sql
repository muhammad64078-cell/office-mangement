/*
# Team Attendance & Task Portal — Schema

Creates the full data model for a Team Attendance & Task Portal with two
roles: admin (PM) and developer. Includes profiles, attendance, raw
biometric punch events, tasks, and a single-row settings table.

## Tables
- profiles: id (uuid = auth.users.id), full_name, role, level,
  biometric_user_id (unique), created_at
- settings: singleton row with office_start_time (default 09:00)
- attendance: user_id, date, check_in/out, total_hours, status, source,
  manual_reason, marked_by. Unique (user_id, date)
- attendance_events: raw biometric punch log (biometric_user_id,
  punched_at, device_id, raw_payload)
- tasks: title, description, assigned_to, assigned_by, estimated_minutes,
  status, started_at, completed_at, total_seconds_spent, git_link,
  summary_note, created_at

## Security
- RLS on every table.
- SECURITY DEFINER is_admin() helper reads profiles to check role = admin.
- developers: SELECT own attendance & tasks; UPDATE own tasks only (cannot
  reassign — WITH CHECK assigned_to = auth.uid()); cannot edit attendance.
- admin: full CRUD on attendance, tasks, profiles; SELECT on attendance_events.
- settings: authenticated SELECT; admin UPDATE.
- The punch edge function uses the service role key, bypassing RLS to insert
  attendance_events and attendance rows.

## Notes
1. profiles + settings created before is_admin() so the function body
   resolves at creation time.
2. Developer task-update policy prevents reassignment via WITH CHECK.
*/

-- profiles (must exist before is_admin() function body compiles)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin','developer')),
  level text CHECK (level IN ('junior','senior')),
  biometric_user_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- settings singleton
CREATE TABLE IF NOT EXISTS public.settings (
  id int PRIMARY KEY DEFAULT 1,
  office_start_time time NOT NULL DEFAULT '09:00',
  CONSTRAINT settings_singleton CHECK (id = 1)
);

INSERT INTO public.settings (id, office_start_time) VALUES (1, '09:00')
  ON CONFLICT (id) DO NOTHING;

-- Helper: is_admin() — SECURITY DEFINER so policies can read profiles
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT
  TO authenticated USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin" ON public.profiles FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "profiles_insert_admin" ON public.profiles;
CREATE POLICY "profiles_insert_admin" ON public.profiles FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "profiles_delete_admin" ON public.profiles;
CREATE POLICY "profiles_delete_admin" ON public.profiles FOR DELETE
  TO authenticated USING (public.is_admin());

-- settings RLS
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_select" ON public.settings;
CREATE POLICY "settings_select" ON public.settings FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "settings_update_admin" ON public.settings;
CREATE POLICY "settings_update_admin" ON public.settings FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "settings_insert_admin" ON public.settings;
CREATE POLICY "settings_insert_admin" ON public.settings FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

-- attendance
CREATE TABLE IF NOT EXISTS public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT current_date,
  check_in timestamptz,
  check_out timestamptz,
  total_hours numeric(5,2),
  status text NOT NULL DEFAULT 'present' CHECK (status IN ('present','late','half_day','absent')),
  source text NOT NULL DEFAULT 'biometric' CHECK (source IN ('biometric','manual')),
  manual_reason text,
  marked_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attendance_select" ON public.attendance;
CREATE POLICY "attendance_select" ON public.attendance FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "attendance_insert_admin" ON public.attendance;
CREATE POLICY "attendance_insert_admin" ON public.attendance FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "attendance_update_admin" ON public.attendance;
CREATE POLICY "attendance_update_admin" ON public.attendance FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "attendance_delete_admin" ON public.attendance;
CREATE POLICY "attendance_delete_admin" ON public.attendance FOR DELETE
  TO authenticated USING (public.is_admin());

-- attendance_events
CREATE TABLE IF NOT EXISTS public.attendance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  biometric_user_id text NOT NULL,
  punched_at timestamptz NOT NULL,
  device_id text,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.attendance_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attendance_events_select_admin" ON public.attendance_events;
CREATE POLICY "attendance_events_select_admin" ON public.attendance_events FOR SELECT
  TO authenticated USING (public.is_admin());

-- tasks
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  assigned_to uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  estimated_minutes int NOT NULL DEFAULT 60,
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','done')),
  started_at timestamptz,
  completed_at timestamptz,
  total_seconds_spent numeric(12,2) NOT NULL DEFAULT 0,
  git_link text,
  summary_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tasks_select" ON public.tasks;
CREATE POLICY "tasks_select" ON public.tasks FOR SELECT
  TO authenticated USING (auth.uid() = assigned_to OR public.is_admin());

DROP POLICY IF EXISTS "tasks_insert_admin" ON public.tasks;
CREATE POLICY "tasks_insert_admin" ON public.tasks FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "tasks_update_own" ON public.tasks;
CREATE POLICY "tasks_update_own" ON public.tasks FOR UPDATE
  TO authenticated USING (auth.uid() = assigned_to)
  WITH CHECK (auth.uid() = assigned_to);

DROP POLICY IF EXISTS "tasks_update_admin" ON public.tasks;
CREATE POLICY "tasks_update_admin" ON public.tasks FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "tasks_delete_admin" ON public.tasks;
CREATE POLICY "tasks_delete_admin" ON public.tasks FOR DELETE
  TO authenticated USING (public.is_admin());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON public.attendance(user_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_events_bio_punched ON public.attendance_events(biometric_user_id, punched_at);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);

-- Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
