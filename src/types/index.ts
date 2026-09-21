export type Role = "admin" | "developer";
export type Level = "junior" | "senior";
export type AttendanceStatus = "present" | "late" | "half_day" | "absent";
export type AttendanceSource = "biometric" | "manual";
export type TaskStatus = "todo" | "in_progress" | "done";
export type SessionType = "work" | "break";

export interface Profile {
  id: string;
  full_name: string;
  role: Role;
  level: Level | null;
  biometric_user_id: string | null;
  created_at: string;
  is_approved?: boolean;
}

export interface AttendanceSession {
  id: string;
  attendance_id: string;
  user_id: string;
  date: string;
  check_in: string;
  check_out: string | null;
  session_type: SessionType;
  created_at: string;
}

export interface Attendance {
  id: string;
  user_id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  total_hours: number | null;
  total_break_hours?: number | null;
  is_on_break?: boolean;
  status: AttendanceStatus;
  source: AttendanceSource;
  manual_reason: string | null;
  marked_by: string | null;
  created_at: string;
  // Joined
  profile?: Profile;
  sessions?: AttendanceSession[];
}

export interface AttendanceEvent {
  id: string;
  biometric_user_id: string;
  punched_at: string;
  device_id: string | null;
  raw_payload: Record<string, unknown> | null;
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  assigned_to: string;
  assigned_by: string | null;
  estimated_minutes: number;
  status: TaskStatus;
  started_at: string | null;
  completed_at: string | null;
  total_seconds_spent: number;
  git_link: string | null;
  summary_note: string | null;
  created_at: string;
  // Joined
  assignee?: Profile;
  assigner?: Profile;
}

export interface Settings {
  id: number;
  office_start_time: string;
}
