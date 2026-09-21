/*
  # Multi-Check-In & Sessions Migration

  Adds `attendance_sessions` table to track multiple check-in/check-out segments
  throughout a single day (e.g. Morning Check-In, University Break, Return Check-In, Evening Check-Out).

  Adds `total_break_hours` and `is_on_break` to `attendance`.
*/

-- Add multi-check-in columns to attendance table
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS total_break_hours numeric(5,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS is_on_break boolean DEFAULT false;

-- attendance_sessions table
CREATE TABLE IF NOT EXISTS public.attendance_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id uuid NOT NULL REFERENCES public.attendance(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT current_date,
  check_in timestamptz NOT NULL,
  check_out timestamptz,
  session_type text NOT NULL DEFAULT 'work' CHECK (session_type IN ('work', 'break')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attendance_sessions_select" ON public.attendance_sessions;
CREATE POLICY "attendance_sessions_select" ON public.attendance_sessions FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "attendance_sessions_insert_admin" ON public.attendance_sessions;
CREATE POLICY "attendance_sessions_insert_admin" ON public.attendance_sessions FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "attendance_sessions_update_admin" ON public.attendance_sessions;
CREATE POLICY "attendance_sessions_update_admin" ON public.attendance_sessions FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "attendance_sessions_delete_admin" ON public.attendance_sessions;
CREATE POLICY "attendance_sessions_delete_admin" ON public.attendance_sessions FOR DELETE
  TO authenticated USING (public.is_admin());

-- Index for session queries
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_att ON public.attendance_sessions(attendance_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_user_date ON public.attendance_sessions(user_id, date);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_sessions;
