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
  defaultDate?: string;
  initialUserId?: string;
}

export function ManualAttendanceModal({
  open,
  onClose,
  developers,
  editing,
  onSaved,
  defaultDate,
  initialUserId,
}: Props) {
  const { profile } = useAuth();
  const [userId, setUserId] = useState("");
  const [date, setDate] = useState(defaultDate || todayStr());
  
  const [s1In, setS1In] = useState("");
  const [s1Out, setS1Out] = useState("");
  const [s2In, setS2In] = useState("");
  const [s2Out, setS2Out] = useState("");
  
  const [status, setStatus] = useState<AttendanceStatus>("present");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setUserId(editing.user_id);
      setDate(editing.date);
      setS1In("");
      setS1Out("");
      setS2In("");
      setS2Out("");
      setStatus(editing.status);
      setReason(editing.manual_reason ?? "");
      loadExistingSessions(editing);
    } else {
      setUserId(initialUserId || developers[0]?.id || "");
      setDate(defaultDate || todayStr());
      setS1In("");
      setS1Out("");
      setS2In("");
      setS2Out("");
      setStatus("present");
      setReason("");
    }
    setError(null);
  }, [open, editing, developers, defaultDate, initialUserId]);

  async function loadExistingSessions(editRec: Attendance) {
    const { data: sess } = await supabase
      .from("attendance_sessions")
      .select("*")
      .eq("attendance_id", editRec.id)
      .order("check_in", { ascending: true });

    if (sess && sess.length >= 2) {
      if (sess[0].check_in) setS1In(toLocalInput(sess[0].check_in));
      if (sess[0].check_out) setS1Out(toLocalInput(sess[0].check_out));
      if (sess[1].check_in) setS2In(toLocalInput(sess[1].check_in));
      if (sess[1].check_out) setS2Out(toLocalInput(sess[1].check_out));
    } else if (sess && sess.length === 1) {
      if (sess[0].check_in) setS1In(toLocalInput(sess[0].check_in));
      if (sess[0].check_out) setS1Out(toLocalInput(sess[0].check_out));
    } else {
      // Fallback if no sessions but attendance table has check_in/check_out
      if (editRec.check_in) setS1In(toLocalInput(editRec.check_in));
      if (editRec.check_out) setS1Out(toLocalInput(editRec.check_out));
    }
  }

  function toLocalInput(iso: string): string {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function getDurationStr(startIso: string, endIso: string): string | null {
    if (!startIso || !endIso) return null;
    const t1 = new Date(startIso).getTime();
    const t2 = new Date(endIso).getTime();
    if (isNaN(t1) || isNaN(t2) || t2 <= t1) return null;
    const diffMs = t2 - t1;
    const hours = Math.floor(diffMs / 3600000);
    const mins = Math.floor((diffMs % 3600000) / 60000);
    if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h`;
    return `${mins}m`;
  }

  // Live durations
  const session1Duration = getDurationStr(s1In, s1Out);
  const session2Duration = getDurationStr(s2In, s2Out);
  const breakDuration = getDurationStr(s1Out, s2In);

  // Live Net Hours Calculation
  const t1In = s1In ? new Date(s1In).getTime() : 0;
  const t1Out = s1Out ? new Date(s1Out).getTime() : 0;
  const t2In = s2In ? new Date(s2In).getTime() : 0;
  const t2Out = s2Out ? new Date(s2Out).getTime() : 0;

  let liveNetMs = 0;
  if (t1In && t1Out && t1Out > t1In) liveNetMs += t1Out - t1In;
  if (t2In && t2Out && t2Out > t2In) liveNetMs += t2Out - t2In;
  
  const liveTotalHours = Math.round((liveNetMs / 3_600_000) * 100) / 100;

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
    if (!s1In && !s2In) {
      setError("Provide at least a check-in time.");
      return;
    }

    setSaving(true);

    const s1InIso = s1In ? new Date(s1In).toISOString() : null;
    const s1OutIso = s1Out ? new Date(s1Out).toISOString() : null;
    const s2InIso = s2In ? new Date(s2In).toISOString() : null;
    const s2OutIso = s2Out ? new Date(s2Out).toISOString() : null;

    let netWorkMs = 0;
    let totalBreakMs = 0;

    if (t1In && t1Out && t1Out > t1In) netWorkMs += t1Out - t1In;
    if (t2In && t2Out && t2Out > t2In) netWorkMs += t2Out - t2In;
    if (t1Out && t2In && t2In > t1Out) totalBreakMs += t2In - t1Out;

    const totalHours = Math.round((netWorkMs / 3_600_000) * 100) / 100;
    const totalBreakHours = Math.round((totalBreakMs / 3_600_000) * 100) / 100;

    let finalStatus = status;
    if (totalHours > 0 && totalHours < 4 && status === "present") {
      finalStatus = "half_day";
    }

    // Overall checkIn/Out for attendance table
    const overallCheckIn = s1InIso || s2InIso;
    const overallCheckOut = s2OutIso || s1OutIso;

    try {
      let attId = editing?.id;

      if (attId) {
        const { error } = await supabase
          .from("attendance")
          .update({
            check_in: overallCheckIn,
            check_out: overallCheckOut,
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
              check_in: overallCheckIn,
              check_out: overallCheckOut,
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
              check_in: overallCheckIn,
              check_out: overallCheckOut,
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

      if (attId) {
        // Clear previous sessions for this attendance
        await supabase.from("attendance_sessions").delete().eq("attendance_id", attId);

        if (s1InIso && s1OutIso) {
          await supabase.from("attendance_sessions").insert({
            attendance_id: attId,
            user_id: userId,
            date,
            check_in: s1InIso,
            check_out: s1OutIso,
            session_type: "work",
          });
        }
        if (s2InIso && s2OutIso) {
          await supabase.from("attendance_sessions").insert({
            attendance_id: attId,
            user_id: userId,
            date,
            check_in: s2InIso,
            check_out: s2OutIso,
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
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-sky-500" /> Daily In / Out Sessions
            </p>
            <span className="text-[11px] text-slate-400">Supports 1 or 2 entries per day</span>
          </div>

          {/* Session 1 */}
          <div className="space-y-1.5 rounded-lg border border-slate-200/80 bg-white p-2.5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-sky-700 uppercase tracking-wide">Session 1 (First Punch In / Out)</p>
              {session1Duration && (
                <span className="rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-700">
                  Work: {session1Duration}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Check-In 1 (Morning / Arrival)</label>
                <input
                  type="datetime-local"
                  value={s1In}
                  onChange={(e) => setS1In(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-900 outline-none focus:border-sky-400 focus:bg-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Check-Out 1 (Mid-day Out / Leave)</label>
                <input
                  type="datetime-local"
                  value={s1Out}
                  onChange={(e) => setS1Out(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-900 outline-none focus:border-sky-400 focus:bg-white"
                  placeholder="Optional if single session"
                />
              </div>
            </div>
          </div>

          {/* Session 2 (Optional) */}
          <div className="space-y-1.5 rounded-lg border border-slate-200/80 bg-white p-2.5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wide flex items-center gap-1">
                <Coffee className="h-3 w-3" /> Session 2 (Second Punch In / Out - Optional)
              </p>
              {session2Duration && (
                <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                  Work: {session2Duration}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Check-In 2 (Return / 2nd In)</label>
                <input
                  type="datetime-local"
                  value={s2In}
                  onChange={(e) => setS2In(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-900 outline-none focus:border-sky-400 focus:bg-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Check-Out 2 (Evening / Final Out)</label>
                <input
                  type="datetime-local"
                  value={s2Out}
                  onChange={(e) => setS2Out(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-900 outline-none focus:border-sky-400 focus:bg-white"
                />
              </div>
            </div>
          </div>

          {/* Live Breakdown Banner */}
          {(session1Duration || session2Duration || breakDuration) && (
            <div className="rounded-xl border border-sky-100 bg-sky-50/70 p-3 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700 flex items-center gap-1">
                  ⚡ Live Calculated Timing Breakdown:
                </span>
                <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 font-bold text-white text-[11px]">
                  Total: {liveTotalHours} hrs
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                {session1Duration && (
                  <div className="rounded-lg bg-white p-2 border border-slate-200 shadow-sm">
                    <span className="text-slate-400 block text-[10px] font-medium">Session 1 Work</span>
                    <span className="font-bold text-sky-700 text-xs">{session1Duration}</span>
                  </div>
                )}
                {breakDuration && (
                  <div className="rounded-lg bg-white p-2 border border-slate-200 shadow-sm">
                    <span className="text-slate-400 block text-[10px] font-medium">Break / Away Duration</span>
                    <span className="font-bold text-amber-700 text-xs">{breakDuration}</span>
                  </div>
                )}
                {session2Duration && (
                  <div className="rounded-lg bg-white p-2 border border-slate-200 shadow-sm">
                    <span className="text-slate-400 block text-[10px] font-medium">Session 2 Work</span>
                    <span className="font-bold text-emerald-700 text-xs">{session2Duration}</span>
                  </div>
                )}
              </div>
            </div>
          )}
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
