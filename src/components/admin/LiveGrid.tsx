import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Profile, Attendance, Task } from "@/types";
import { useLiveTimer } from "@/hooks/useLiveTimer";
import { formatDuration, formatTime, todayStr } from "@/lib/utils";
import {
  Circle,
  Timer,
  ListTodo,
  AlertTriangle,
  Wifi,
  WifiOff,
  Coffee,
} from "lucide-react";

interface Props {
  developers: Profile[];
}

interface DevState {
  attendance: Attendance | null;
  runningTask: Task | null;
}

export function LiveGrid({ developers }: Props) {
  const [states, setStates] = useState<Record<string, DevState>>({});
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    const today = todayStr();
    const result: Record<string, DevState> = {};

    for (const dev of developers) {
      const [attRes, taskRes] = await Promise.all([
        supabase
          .from("attendance")
          .select("*")
          .eq("user_id", dev.id)
          .eq("date", today)
          .maybeSingle(),
        supabase
          .from("tasks")
          .select("*")
          .eq("assigned_to", dev.id)
          .eq("status", "in_progress")
          .maybeSingle(),
      ]);
      result[dev.id] = {
        attendance: attRes.data as Attendance | null,
        runningTask: taskRes.data as Task | null,
      };
    }

    setStates(result);
    setLoading(false);
  }, [developers]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("admin-live-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance" },
        () => loadAll(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance_sessions" },
        () => loadAll(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        () => loadAll(),
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadAll]);

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Loading live status…</div>;
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900">Live Developers</h2>
        <span className="text-sm text-slate-400">Real-time updates</span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {developers.map((dev) => (
          <DevCard
            key={dev.id}
            dev={dev}
            state={states[dev.id] ?? { attendance: null, runningTask: null }}
          />
        ))}
      </div>
    </div>
  );
}

function DevCard({ dev, state }: { dev: Profile; state: DevState }) {
  const { attendance, runningTask } = state;
  const isOnBreak = !!attendance?.is_on_break;
  const online = !!attendance?.check_in && !attendance?.check_out && !isOnBreak;
  const liveSeconds = useLiveTimer(
    runningTask?.started_at ?? null,
    runningTask?.total_seconds_spent ?? 0,
  );
  const estimatedSeconds = runningTask ? runningTask.estimated_minutes * 60 : 0;
  const isOverdue = online && runningTask && liveSeconds > estimatedSeconds;

  const cardClass = isOnBreak
    ? "border-amber-300 bg-amber-50/60 ring-1 ring-amber-100"
    : !online
      ? "border-slate-200 bg-white"
      : isOverdue
        ? "border-red-300 bg-red-50 ring-2 ring-red-100"
        : "border-emerald-200 bg-emerald-50/50";

  return (
    <div className={`rounded-2xl border p-5 shadow-sm transition ${cardClass}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-200 text-sm font-bold text-slate-600">
            {dev.full_name.charAt(0)}
          </div>
          <div>
            <p className="font-semibold text-slate-900">{dev.full_name}</p>
            <p className="text-xs capitalize text-slate-400">{dev.level ?? ""}</p>
          </div>
        </div>
        {isOnBreak ? (
          <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
            <Coffee className="h-3.5 w-3.5" /> On Break
          </span>
        ) : online ? (
          <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
            <Wifi className="h-3.5 w-3.5" /> Online
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs font-medium text-slate-400">
            <WifiOff className="h-3.5 w-3.5" /> Offline
          </span>
        )}
      </div>

      <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
        {attendance?.check_in ? (
          <>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Check-in</span>
              <span className="font-medium text-slate-600">{formatTime(attendance.check_in)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Net Work Hours</span>
              <span className="font-semibold text-emerald-700">{attendance.total_hours ?? 0}h</span>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Circle className="h-3 w-3" /> Not checked in today
          </div>
        )}

        {attendance?.check_out && !online && !isOnBreak && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Final Out</span>
            <span className="font-medium text-slate-600">{formatTime(attendance.check_out)}</span>
          </div>
        )}
      </div>

      <div className="mt-4 border-t border-slate-100 pt-4">
        {runningTask ? (
          <div>
            <div className="mb-1.5 flex items-center gap-2 text-xs text-slate-400">
              <ListTodo className="h-3.5 w-3.5" /> Current task
            </div>
            <p className="text-sm font-medium text-slate-900">{runningTask.title}</p>
            <div className="mt-2 flex items-center gap-2">
              <Timer className={`h-4 w-4 ${isOverdue ? "text-red-500" : "text-blue-500"}`} />
              <span className={`font-mono text-sm font-bold ${isOverdue ? "text-red-600" : "text-blue-600"}`}>
                {formatDuration(liveSeconds)}
              </span>
              <span className="text-xs text-slate-400">/ {runningTask.estimated_minutes}m est.</span>
            </div>
            {isOverdue && (
              <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-red-100 px-2.5 py-1.5 text-xs font-bold text-red-700">
                <AlertTriangle className="h-3.5 w-3.5" /> OVERDUE
              </div>
            )}
          </div>
        ) : isOnBreak ? (
          <div className="flex items-center gap-2 text-xs text-amber-700 font-medium">
            <Coffee className="h-3.5 w-3.5" /> Tasks auto-paused for break
          </div>
        ) : online ? (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Timer className="h-3.5 w-3.5" /> No active task
          </div>
        ) : null}
      </div>
    </div>
  );
}
