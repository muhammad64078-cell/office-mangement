import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Profile, Attendance } from "@/types";
import { StatusBadge, SourceBadge } from "@/components/shared/Badges";
import { ManualAttendanceModal } from "@/components/admin/ManualAttendanceModal";
import { formatTime, formatHours, formatDate, todayStr, downloadCSV } from "@/lib/utils";
import {
  Calendar,
  Download,
  Plus,
  Search,
  ClipboardList,
  TrendingUp,
  Clock,
  AlertTriangle,
} from "lucide-react";

interface Props {
  developers: Profile[];
}

export function AttendanceSheet({ developers }: Props) {
  const [date, setDate] = useState(todayStr());
  const [month, setMonth] = useState(todayStr().slice(0, 7));
  const [rows, setRows] = useState<(Attendance & { profile?: Profile })[]>([]);
  const [monthRows, setMonthRows] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [manualOpen, setManualOpen] = useState(false);
  const [editingAtt, setEditingAtt] = useState<Attendance | null>(null);

  const loadDay = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("attendance")
      .select("*, profile:profiles!attendance_user_id_fkey(*), sessions:attendance_sessions(*)")
      .eq("date", date)
      .order("check_in", { ascending: true, nullsFirst: false });
    setRows((data as (Attendance & { profile?: Profile })[]) ?? []);
    setLoading(false);
  }, [date]);

  const loadMonth = useCallback(async () => {
    const start = `${month}-01`;
    const end = `${month}-31`;
    const { data } = await supabase
      .from("attendance")
      .select("*")
      .gte("date", start)
      .lte("date", end);
    setMonthRows((data as Attendance[]) ?? []);
  }, [month]);

  useEffect(() => {
    loadDay();
  }, [loadDay]);

  useEffect(() => {
    loadMonth();
  }, [loadMonth]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("admin-attendance-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance" },
        () => { loadDay(); loadMonth(); },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance_sessions" },
        () => { loadDay(); loadMonth(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadDay, loadMonth]);

  // Merge: show all developers for the selected date (even if no attendance row)
  const displayRows = developers.map((dev) => {
    const att = rows.find((r) => r.user_id === dev.id);
    return att ? { ...att, profile: dev } : null;
  });

  const devNameMap = new Map(developers.map((d) => [d.id, d.full_name]));

  const monthlySummary = developers.map((dev) => {
    const devRows = monthRows.filter((r) => r.user_id === dev.id);
    const lateCount = devRows.filter((r) => r.status === "late").length;
    const totalHours = devRows.reduce((sum, r) => sum + (r.total_hours ?? 0), 0);
    const totalBreakHours = devRows.reduce((sum, r) => sum + (r.total_break_hours ?? 0), 0);
    const presentCount = devRows.filter(
      (r) => r.status === "present" || r.status === "late",
    ).length;
    return {
      name: dev.full_name,
      level: dev.level ?? "",
      presentDays: presentCount,
      lateCount,
      totalHours: Number(totalHours.toFixed(2)),
      totalBreakHours: Number(totalBreakHours.toFixed(2)),
    };
  });

  const exportCSV = () => {
    const header = ["Developer", "Level", "First Check-in", "Final Check-out", "Net Work Hours", "Break Hours", "Status", "Source", "Reason / Note"];
    const dataRows = displayRows.map((r) => {
      if (!r) return null;
      return [
        r.profile?.full_name ?? "",
        r.profile?.level ?? "",
        formatTime(r.check_in),
        formatTime(r.check_out),
        r.total_hours ?? 0,
        r.total_break_hours ?? 0,
        r.status,
        r.source,
        r.manual_reason ?? "",
      ];
    }).filter(Boolean) as (string | number)[][];

    downloadCSV(`attendance_${date}.csv`, [header, ...dataRows]);
  };

  const exportMonthlyCSV = () => {
    const header = ["Developer", "Level", "Present Days", "Late Count", "Total Hours"];
    const dataRows = monthlySummary.map((s) => [
      s.name, s.level, s.presentDays, s.lateCount, s.totalHours,
    ]);
    downloadCSV(`monthly_summary_${month}.csv`, [header, ...dataRows]);
  };

  return (
    <div className="space-y-6">
      {/* Day filter + actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <div className="relative flex-1 sm:flex-initial">
            <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            />
          </div>
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>
        <button
          onClick={() => { setEditingAtt(null); setManualOpen(true); }}
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2.5 text-xs sm:text-sm font-medium text-white shadow-lg shadow-sky-500/25 transition hover:shadow-sky-500/40"
        >
          <Plus className="h-4 w-4" /> Manual Attendance
        </button>
      </div>

      {/* Daily Attendance table / Card list */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5 sm:px-5">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-slate-400" />
            <h2 className="text-sm sm:text-base font-semibold text-slate-900">
              Attendance for {formatDate(date)}
            </h2>
          </div>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading…</div>
        ) : (
          <>
            {/* Desktop / Tablet Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-5 py-3 font-medium">Developer</th>
                    <th className="px-5 py-3 font-medium">First Check-in</th>
                    <th className="px-5 py-3 font-medium">Final Check-out</th>
                    <th className="px-5 py-3 font-medium">Net Work Hours</th>
                    <th className="px-5 py-3 font-medium">Break Hours</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Source & Reason</th>
                    <th className="px-5 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((r, i) => {
                    const dev = developers[i];
                    return (
                      <tr key={dev.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">
                              {dev.full_name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-medium text-slate-900">{dev.full_name}</p>
                              <p className="text-xs text-slate-400 capitalize">{dev.level ?? ""}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-slate-600">{formatTime(r?.check_in ?? null)}</td>
                        <td className="px-5 py-3 text-slate-600">{formatTime(r?.check_out ?? null)}</td>
                        <td className="px-5 py-3 text-slate-600 font-semibold">{formatHours(r?.total_hours ?? null)}</td>
                        <td className="px-5 py-3 text-amber-700 font-medium">{r?.total_break_hours ? `${r.total_break_hours}h` : "0.00h"}</td>
                        <td className="px-5 py-3">
                          {r ? (
                            <div className="flex items-center gap-1.5">
                              <StatusBadge status={r.status} />
                              {r.is_on_break && (
                                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                                  BREAK
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          {r ? (
                            <div>
                              <SourceBadge source={r.source} />
                              {r.manual_reason && (
                                <p className="mt-0.5 text-[11px] text-slate-500 italic max-w-[140px] truncate" title={r.manual_reason}>
                                  "{r.manual_reason}"
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          {r && (
                            <button
                              onClick={() => { setEditingAtt(r); setManualOpen(true); }}
                              className="text-xs font-medium text-sky-600 hover:underline"
                            >
                              Edit / Sessions
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="md:hidden divide-y divide-slate-100">
              {displayRows.map((r, i) => {
                const dev = developers[i];
                return (
                  <div key={dev.id} className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-600">
                          {dev.full_name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 text-sm">{dev.full_name}</p>
                          <p className="text-xs text-slate-400 capitalize">{dev.level ?? ""} developer</p>
                        </div>
                      </div>
                      {r ? (
                        <div className="flex items-center gap-1">
                          <StatusBadge status={r.status} />
                          {r.is_on_break && (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                              BREAK
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Absent</span>
                      )}
                    </div>

                    {r ? (
                      <div className="grid grid-cols-2 gap-2 bg-slate-50 rounded-xl p-2.5 text-xs">
                        <div>
                          <span className="text-slate-400 block text-[10px]">First In</span>
                          <span className="font-medium text-slate-700">{formatTime(r.check_in)}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Final Out</span>
                          <span className="font-medium text-slate-700">{formatTime(r.check_out)}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Net Work Hours</span>
                          <span className="font-bold text-emerald-700">{r.total_hours ?? 0}h</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Break Hours</span>
                          <span className="font-bold text-amber-700">{r.total_break_hours ?? 0}h</span>
                        </div>
                      </div>
                    ) : null}

                    <div className="flex items-center justify-between pt-1 text-xs">
                      {r ? (
                        <div className="flex items-center gap-2">
                          <SourceBadge source={r.source} />
                          {r.manual_reason && (
                            <span className="text-[11px] text-slate-500 italic truncate max-w-[150px]">
                              "{r.manual_reason}"
                            </span>
                          )}
                        </div>
                      ) : <span />}
                      {r && (
                        <button
                          onClick={() => { setEditingAtt(r); setManualOpen(true); }}
                          className="font-medium text-sky-600 hover:underline"
                        >
                          Edit / Sessions
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Monthly summary */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 px-4 py-3.5 sm:px-5">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-slate-400" />
            <h2 className="text-sm sm:text-base font-semibold text-slate-900">Monthly Summary</h2>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs sm:text-sm text-slate-700 outline-none focus:border-sky-400"
            />
            <button
              onClick={exportMonthlyCSV}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              <Download className="h-4 w-4" /> CSV
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left uppercase tracking-wide text-slate-400 text-[10px] sm:text-xs">
                <th className="px-4 py-3 sm:px-5 font-medium">Developer</th>
                <th className="px-4 py-3 sm:px-5 font-medium">Present Days</th>
                <th className="px-4 py-3 sm:px-5 font-medium">
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Late Count
                  </span>
                </th>
                <th className="px-4 py-3 sm:px-5 font-medium">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Total Net Hours
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {monthlySummary.map((s) => (
                <tr key={s.name} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                  <td className="px-4 py-3 sm:px-5 font-medium text-slate-900">{s.name}</td>
                  <td className="px-4 py-3 sm:px-5 text-slate-600">{s.presentDays}</td>
                  <td className="px-4 py-3 sm:px-5">
                    {s.lateCount > 0 ? (
                      <span className="font-medium text-red-600">{s.lateCount}</span>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 sm:px-5 text-slate-600 font-semibold">{s.totalHours}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ManualAttendanceModal
        open={manualOpen}
        onClose={() => { setManualOpen(false); setEditingAtt(null); }}
        developers={developers}
        editing={editingAtt}
        onSaved={() => { loadDay(); loadMonth(); }}
      />
    </div>
  );
}
