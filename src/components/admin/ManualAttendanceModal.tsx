import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Modal } from "@/components/shared/Modal";
import type { Profile, Attendance, AttendanceStatus } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { todayStr } from "@/lib/utils";
import { Loader2, Save, Coffee, Clock } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  developers: Profile[];
  editing: Attendance | null;
  onSaved: () => void;
}

export function ManualAttendanceModal({ open, onClose, developers, editing, onSaved }: Props) {
  const { profile } = useAuth();
  const [userId, setUserId] = useState("");
  const [date, setDate] = useState(todayStr());
  const [checkIn, setCheckIn] = useState("");
  const [breakStart, setBreakStart] = useState("");
  const [breakEnd, setBreakEnd] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [status, setStatus] = useState<AttendanceStatus>("present");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setUserId(editing.user_id);
      setDate(editing.date);
      setCheckIn(editing.check_in ? toLocalInput(editing.check_in) : "");
      setCheckOut(editing.check_out ? toLocalInput(editing.check_out) : "");
      setBreakStart("");
      setBreakEnd("");
      setStatus(editing.status);
      setReason(editing.manual_reason ?? "");
      loadExistingSessions(editing.id);
    } else {
      setUserId(developers[0]?.id ?? "");
      setDate(todayStr());
      setCheckIn("");
      setBreakStart("");
      setBreakEnd("");
      setCheckOut("");
      setStatus("present");
      setReason("");
    }
    setError(null);
  }, [open, editing, developers]);

  async function loadExistingSessions(attId: string) {
    const { data: sess } = await supabase
      .from("attendance_sessions")
      .select("*")
      .eq("attendance_id", attId)
      .order("check_in", { ascending: true });

    if (sess && sess.length >= 2) {
      // If at least 2 sessions exist, session 1 check_out is break start, session 2 check_in is break end
      if (sess[0].check_out) setBreakStart(toLocalInput(sess[0].check_out));
      if (sess[1].check_in) setBreakEnd(toLocalInput(sess[1].check_in));
      if (sess[sess.length - 1].check_out) {
        setCheckOut(toLocalInput(sess[sess.length - 1].check_out));
      }
    }
  }

  function toLocalInput(iso: string): string {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!userId) {
      setError("Select a developer.");
      return;
    }
    if (!reason.trim()) {
      setError("A reason is required for manual attendance / override (e.g. 'University Class / Scanner Issue').");
      return;
    }
    if (!checkIn && !checkOut) {
      setError("Provide at least a check-in time.");
      return;
    }

    setSaving(true);

    const checkInIso = checkIn ? new Date(checkIn).toISOString() : null;
    const breakStartIso = breakStart ? new Date(breakStart).toISOString() : null;
    const breakEndIso = breakEnd ? new Date(breakEnd).toISOString() : null;
    const checkOutIso = checkOut ? new Date(checkOut).toISOString() : null;

    // Compute Net Working Hours
    let netWorkMs = 0;
    let totalBreakMs = 0;

    if (checkInIso && breakStartIso && breakEndIso && checkOutIso) {
      // Session 1: CheckIn -> BreakStart
      netWorkMs += Math.max(0, new Date(breakStartIso).getTime() - new Date(checkInIso).getTime());
      // Break: BreakStart -> BreakEnd
      totalBreakMs += Math.max(0, new Date(breakEndIso).getTime() - new Date(breakStartIso).getTime());
      // Session 2: BreakEnd -> CheckOut
      netWorkMs += Math.max(0, new Date(checkOutIso).getTime() - new Date(breakEndIso).getTime());
    } else if (checkInIso && checkOutIso) {
      netWorkMs += Math.max(0, new Date(checkOutIso).getTime() - new Date(checkInIso).getTime());
    }

    const totalHours = Math.round((netWorkMs / 3_600_000) * 100) / 100;
    const totalBreakHours = Math.round((totalBreakMs / 3_600_000) * 100) / 100;

    let finalStatus = status;
    if (totalHours > 0 && totalHours < 4 && status === "present") {
      finalStatus = "half_day";
    }

    try {
      let attId = editing?.id;

      if (attId) {
        const { error } = await supabase
          .from("attendance")
          .update({
            check_in: checkInIso,
            check_out: checkOutIso,
            total_hours: totalHours,
            total_break_hours: totalBreakHours,
            status: finalStatus,
            source: "manual",
            manual_reason: reason.trim(),
            marked_by: profile?.id ?? null,
            is_on_break: false,
          })
          .eq("id", attId);
        if (error) throw new Error(error.message);
      } else {
        const { data: existing } = await supabase
          .from("attendance")
          .select("id")
          .eq("user_id", userId)
          .eq("date", date)
          .maybeSingle();

        if (existing) {
          attId = existing.id;
          const { error } = await supabase
            .from("attendance")
            .update({
              check_in: checkInIso,
              check_out: checkOutIso,
              total_hours: totalHours,
              total_break_hours: totalBreakHours,
              status: finalStatus,
              source: "manual",
              manual_reason: reason.trim(),
              marked_by: profile?.id ?? null,
              is_on_break: false,
            })
            .eq("id", attId);
          if (error) throw new Error(error.message);
        } else {
          const { data: inserted, error } = await supabase
            .from("attendance")
            .insert({
              user_id: userId,
              date,
              check_in: checkInIso,
              check_out: checkOutIso,
              total_hours: totalHours,
              total_break_hours: totalBreakHours,
              status: finalStatus,
              source: "manual",
              manual_reason: reason.trim(),
              marked_by: profile?.id ?? null,
              is_on_break: false,
            })
            .select("id")
            .single();
          if (error) throw new Error(error.message);
          attId = inserted.id;
        }
      }

      // Re-create sessions if break structure is specified
      if (attId && checkInIso) {
        // Clear previous sessions for this attendance
        await supabase.from("attendance_sessions").delete().eq("attendance_id", attId);

        if (breakStartIso && breakEndIso && checkOutIso) {
          // Session 1: Morning to Break
          await supabase.from("attendance_sessions").insert({
            attendance_id: attId,
            user_id: userId,
            date,
            check_in: checkInIso,
            check_out: breakStartIso,
            session_type: "work",
          });
          // Session 2: Return from Break to Evening Out
          await supabase.from("attendance_sessions").insert({
            attendance_id: attId,
            user_id: userId,
            date,
            check_in: breakEndIso,
            check_out: checkOutIso,
            session_type: "work",
          });
        } else {
          // Single Session
          await supabase.from("attendance_sessions").insert({
            attendance_id: attId,
            user_id: userId,
            date,
            check_in: checkInIso,
            check_out: checkOutIso,
            session_type: "work",
          });
        }
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit Attendance (Multi Check-In)" : "Add Manual Attendance"}>
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Developer</label>
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            disabled={!!editing}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-50"
          >
            {developers.map((d) => (
              <option key={d.id} value={d.id}>{d.full_name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={!!editing}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-50"
          />
        </div>

        {/* Multi session inputs */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-3">
          <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-sky-500" /> Work & Break Timestamps
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Morning Check-In</label>
              <input
                type="datetime-local"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-sky-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Break / Class Start</label>
              <input
                type="datetime-local"
                value={breakStart}
                onChange={(e) => setBreakStart(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-sky-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 flex items-center gap-1">
                <Coffee className="h-3 w-3 text-amber-500" /> Break / Return Check-In
              </label>
              <input
                type="datetime-local"
                value={breakEnd}
                onChange={(e) => setBreakEnd(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-sky-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Evening Final Check-Out</label>
              <input
                type="datetime-local"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-sky-400"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as AttendanceStatus)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
          >
            <option value="present">Present</option>
            <option value="late">Late</option>
            <option value="half_day">Half-day</option>
            <option value="absent">Absent</option>
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Reason / Override Note <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            placeholder="e.g. University Class schedule, Scanner issue, PM adjustment"
          />
          <p className="mt-1 text-xs text-slate-400">A compulsory reason must be recorded for admin manual edits.</p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-100">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-sky-500/25 transition hover:shadow-sky-500/40 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving…" : "Save Attendance"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
