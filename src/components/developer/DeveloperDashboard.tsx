import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useLiveTimer } from "@/hooks/useLiveTimer";
import type { Attendance, AttendanceSession, Task } from "@/types";
import { LockedScreen } from "@/components/developer/LockedScreen";
import { CompleteTaskModal } from "@/components/developer/CompleteTaskModal";
import { StatusBadge } from "@/components/shared/Badges";
import { formatTime, formatDuration, todayStr } from "@/lib/utils";
import {
  Clock,
  Play,
  Square,
  CheckCircle2,
  Timer,
  LogOut,
  ListTodo,
  CheckCircle,
  Coffee,
  Calendar,
  AlertCircle,
  Briefcase,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";

export function DeveloperDashboard() {
  const { profile, signOut } = useAuth();
  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [completingTask, setCompletingTask] = useState<Task | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Active Task Tab filter ('all', 'todo', 'in_progress', 'done')
  const [activeTab, setActiveTab] = useState<"all" | "todo" | "in_progress" | "done">("all");

  const loadData = useCallback(async () => {
    if (!profile) return;
    const today = todayStr();

    const [attRes, tasksRes] = await Promise.all([
      supabase
        .from("attendance")
        .select("*, sessions:attendance_sessions(*)")
        .eq("user_id", profile.id)
        .eq("date", today)
        .maybeSingle(),
      supabase
        .from("tasks")
        .select("*")
        .eq("assigned_to", profile.id)
        .order("created_at", { ascending: false }),
    ]);

    const attData = attRes.data as (Attendance & { sessions?: AttendanceSession[] }) | null;
    setAttendance(attData);
    if (attData?.sessions) {
      const sorted = [...attData.sessions].sort(
        (a, b) => new Date(a.check_in).getTime() - new Date(b.check_in).getTime(),
      );
      setSessions(sorted);
    } else {
      setSessions([]);
    }
    setTasks((tasksRes.data as Task[]) ?? []);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Realtime
  useEffect(() => {
    if (!profile) return;
    const channel = supabase
      .channel("dev-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance", filter: `user_id=eq.${profile.id}` },
        () => loadData(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance_sessions", filter: `user_id=eq.${profile.id}` },
        () => loadData(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `assigned_to=eq.${profile.id}` },
        () => loadData(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, loadData]);

  const checkedIn = !!attendance?.check_in;
  const openSession = sessions.find((s) => !s.check_out);
  const isOnBreak = checkedIn && (!openSession || attendance?.is_on_break);
  const runningTask = tasks.find((t) => t.status === "in_progress");

  // Calculate Net Working Hours & Break Hours
  let totalWorkMs = 0;
  let totalBreakMs = 0;

  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    const checkInMs = new Date(s.check_in).getTime();
    const checkOutMs = s.check_out ? new Date(s.check_out).getTime() : Date.now();
    totalWorkMs += checkOutMs - checkInMs;

    if (i > 0) {
      const prev = sessions[i - 1];
      if (prev.check_out) {
        totalBreakMs += checkInMs - new Date(prev.check_out).getTime();
      }
    }
  }

  const netWorkHours = (totalWorkMs / 3_600_000).toFixed(2);
  const totalBreakHours = (totalBreakMs / 3_600_000).toFixed(2);

  // Single Active Task Timer Live Seconds for Sticky Banner
  const runningTaskSeconds = useLiveTimer(
    runningTask?.started_at ?? null,
    runningTask?.total_seconds_spent ?? 0,
  );

  // University Break / Break Start -> Pauses active task
  const handleStartBreak = async () => {
    setActionError(null);
    if (!profile || !attendance || !openSession) return;

    // Auto pause running task
    if (runningTask) {
      await stopTask(runningTask);
    }

    const nowIso = new Date().toISOString();

    // Close active session
    await supabase
      .from("attendance_sessions")
      .update({ check_out: nowIso })
      .eq("id", openSession.id);

    // Update attendance: is_on_break = true
    await supabase
      .from("attendance")
      .update({ check_out: nowIso, is_on_break: true })
      .eq("id", attendance.id);

    loadData();
  };

  // Return from Break / University Class
  const handleEndBreak = async () => {
    setActionError(null);
    if (!profile || !attendance) return;

    const nowIso = new Date().toISOString();

    // Open new work session
    await supabase.from("attendance_sessions").insert({
      attendance_id: attendance.id,
      user_id: profile.id,
      date: todayStr(),
      check_in: nowIso,
      session_type: "work",
    });

    await supabase
      .from("attendance")
      .update({ check_out: null, is_on_break: false })
      .eq("id", attendance.id);

    loadData();
  };

  // Single Active Task Rule
  const handleStartTask = async (task: Task) => {
    setActionError(null);
    if (!checkedIn || isOnBreak) {
      setActionError("Cannot start task while on break or checked out.");
      return;
    }

    // Stop any running task first — enforce single active task rule
    if (runningTask && runningTask.id !== task.id) {
      await stopTask(runningTask);
    }

    const { error } = await supabase
      .from("tasks")
      .update({ status: "in_progress", started_at: new Date().toISOString() })
      .eq("id", task.id);
    if (error) setActionError(error.message);
  };

  const stopTask = async (task: Task) => {
    if (!task.started_at) return;
    const elapsed = (Date.now() - new Date(task.started_at).getTime()) / 1000;
    const newTotal = (task.total_seconds_spent ?? 0) + elapsed;
    const { error } = await supabase
      .from("tasks")
      .update({
        status: "todo",
        started_at: null,
        total_seconds_spent: newTotal,
      })
      .eq("id", task.id);
    if (error) setActionError(error.message);
  };

  const handleStopTask = async (task: Task) => {
    setActionError(null);
    await stopTask(task);
  };

  const handleCompleteTask = async (gitLink: string, summary: string) => {
    if (!completingTask) return;
    const task = completingTask;
    let totalSpent = task.total_seconds_spent ?? 0;
    if (task.started_at) {
      totalSpent += (Date.now() - new Date(task.started_at).getTime()) / 1000;
    }
    const { error } = await supabase
      .from("tasks")
      .update({
        status: "done",
        completed_at: new Date().toISOString(),
        started_at: null,
        total_seconds_spent: totalSpent,
        git_link: gitLink,
        summary_note: summary,
      })
      .eq("id", task.id);
    if (error) throw new Error(error.message);
    setCompletingTask(null);
  };

  // Task Board Grouping
  const todoTasks = tasks.filter((t) => t.status === "todo");
  const inProgressTasks = tasks.filter((t) => t.status === "in_progress");
  const completedTasks = tasks.filter((t) => t.status === "done");

  const displayedTasks =
    activeTab === "all"
      ? tasks
      : activeTab === "todo"
        ? todoTasks
        : activeTab === "in_progress"
          ? inProgressTasks
          : completedTasks;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-400">Loading…</p>
      </div>
    );
  }

  if (!checkedIn) {
    return <LockedScreen />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-sm font-bold text-white shadow-md">
              {profile?.full_name?.charAt(0) ?? "?"}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">{profile?.full_name}</p>
              <p className="text-xs text-slate-500 capitalize">{profile?.level ?? ""} developer</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </header>

      {/* Active Task Sticky Banner */}
      {runningTask && (
        <div className="sticky top-[57px] z-20 bg-slate-900 text-white shadow-xl border-b border-slate-800">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400">
                <Timer className="h-4 w-4 animate-spin" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">ACTIVE TASK</span>
                  <span className="font-mono text-sm font-bold text-emerald-400">{formatDuration(runningTaskSeconds)}</span>
                </div>
                <p className="text-xs font-medium text-slate-200 truncate max-w-xs sm:max-w-md">{runningTask.title}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleStopTask(runningTask)}
                className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-700"
              >
                <Square className="h-3.5 w-3.5" /> Pause
              </button>
              <button
                onClick={() => setCompletingTask(runningTask)}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white shadow-md transition hover:bg-emerald-600"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Complete
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {/* Attendance summary cards */}
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            icon={<Clock className="h-5 w-5" />}
            label="First Check-In"
            value={formatTime(attendance?.check_in ?? null)}
            accent="sky"
          />
          <SummaryCard
            icon={<Briefcase className="h-5 w-5" />}
            label="Net Work Hours"
            value={`${netWorkHours}h`}
            accent="emerald"
          />
          <SummaryCard
            icon={<Coffee className="h-5 w-5" />}
            label="Break Duration"
            value={`${totalBreakHours}h`}
            accent="amber"
          />
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Current Status</span>
              {attendance && <StatusBadge status={attendance.status} />}
            </div>
            {isOnBreak ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                <Coffee className="h-3.5 w-3.5" /> On Break / Class
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
                <Briefcase className="h-3.5 w-3.5" /> Working
              </span>
            )}
          </div>
        </div>

        {/* Multi Check-In & Break Controls */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-semibold text-slate-900 flex items-center gap-2 text-sm sm:text-base">
                <Calendar className="h-4 w-4 text-sky-500" /> Multi Check-In / Break Management
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Take University Breaks or personal time. Task timers automatically pause during breaks.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {isOnBreak ? (
                <button
                  onClick={handleEndBreak}
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-md transition hover:bg-emerald-700"
                >
                  <Briefcase className="h-4 w-4" /> Return Check-In (End Break)
                </button>
              ) : (
                <button
                  onClick={handleStartBreak}
                  className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-semibold text-white shadow-md transition hover:bg-amber-600"
                >
                  <Coffee className="h-4 w-4" /> University / Class Break Start
                </button>
              )}
            </div>
          </div>

          {/* Session Timeline */}
          {sessions.length > 0 && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">Today's Check-In Log</p>
              <div className="space-y-2">
                {sessions.map((sess, idx) => (
                  <div key={sess.id || idx} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 font-bold text-slate-600 text-[11px]">
                        {idx + 1}
                      </span>
                      <span className="font-medium text-slate-700">Work Session</span>
                    </div>
                    <div className="text-slate-600 font-mono">
                      {formatTime(sess.check_in)} → {sess.check_out ? formatTime(sess.check_out) : <span className="text-emerald-600 font-bold">Active Now</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {isOnBreak && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl bg-amber-50 border border-amber-200 p-4 text-amber-900 text-sm">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="font-semibold">You are currently on break / university class.</p>
              <p className="text-xs text-amber-700">Active task timers are automatically paused until you return and check in again.</p>
            </div>
          </div>
        )}

        {actionError && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-100">
            {actionError}
          </div>
        )}

        {/* Task Board Tabs & Grouping */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-slate-500" />
            <h2 className="text-lg font-semibold text-slate-900">Today's Task Board</h2>
          </div>

          {/* Grouping Filter Tabs */}
          <div className="flex items-center gap-1 rounded-xl bg-slate-200/60 p-1 text-xs">
            <button
              onClick={() => setActiveTab("all")}
              className={`rounded-lg px-3 py-1.5 font-medium transition ${
                activeTab === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All ({tasks.length})
            </button>
            <button
              onClick={() => setActiveTab("todo")}
              className={`rounded-lg px-3 py-1.5 font-medium transition ${
                activeTab === "todo" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              To Do ({todoTasks.length})
            </button>
            <button
              onClick={() => setActiveTab("in_progress")}
              className={`rounded-lg px-3 py-1.5 font-medium transition ${
                activeTab === "in_progress" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              In Progress ({inProgressTasks.length})
            </button>
            <button
              onClick={() => setActiveTab("done")}
              className={`rounded-lg px-3 py-1.5 font-medium transition ${
                activeTab === "done" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Completed ({completedTasks.length})
            </button>
          </div>
        </div>

        {displayedTasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
            <p className="text-slate-400 text-sm">No tasks in this category.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayedTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                checkedIn={checkedIn && !isOnBreak}
                isRunning={task.status === "in_progress"}
                onStart={() => handleStartTask(task)}
                onStop={() => handleStopTask(task)}
                onComplete={() => setCompletingTask(task)}
              />
            ))}
          </div>
        )}
      </main>

      <CompleteTaskModal
        open={!!completingTask}
        onClose={() => setCompletingTask(null)}
        taskTitle={completingTask?.title ?? ""}
        onComplete={handleCompleteTask}
      />
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: "sky" | "emerald" | "amber";
}) {
  const accentMap = {
    sky: "bg-sky-50 text-sky-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-slate-400">
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${accentMap[accent]}`}>
          {icon}
        </span>
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function TaskCard({
  task,
  checkedIn,
  isRunning,
  onStart,
  onStop,
  onComplete,
}: {
  task: Task;
  checkedIn: boolean;
  isRunning: boolean;
  onStart: () => void;
  onStop: () => void;
  onComplete: () => void;
}) {
  const liveSeconds = useLiveTimer(
    isRunning ? task.started_at : null,
    task.total_seconds_spent ?? 0,
  );
  const estimatedSeconds = task.estimated_minutes * 60;
  const isOverdue = isRunning && liveSeconds > estimatedSeconds;

  return (
    <div
      className={`rounded-2xl border bg-white p-5 shadow-sm transition ${
        isOverdue ? "border-red-300 ring-2 ring-red-100" : "border-slate-200"
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {task.status === "done" ? (
              <CheckCircle className="h-5 w-5 text-emerald-500" />
            ) : isRunning ? (
              <Timer className="h-5 w-5 text-blue-500 animate-pulse" />
            ) : (
              <div className="h-2.5 w-2.5 rounded-full bg-slate-300" />
            )}
            <h3 className={`font-semibold text-slate-900 ${task.status === "done" ? "line-through text-slate-400" : ""}`}>
              {task.title}
            </h3>
          </div>
          {task.description && (
            <p className="mt-1.5 text-sm text-slate-500">{task.description}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> Est. {task.estimated_minutes}m
            </span>
            {(isRunning || (task.total_seconds_spent ?? 0) > 0) && task.status !== "done" && (
              <span className={`font-mono text-sm font-semibold ${isOverdue ? "text-red-600" : "text-blue-600"}`}>
                {formatDuration(liveSeconds)} {isOverdue && "⚠ OVERDUE"}
              </span>
            )}
            {task.status === "done" && (
              <>
                <span className="font-mono text-sm text-emerald-600">
                  Spent {formatDuration(task.total_seconds_spent ?? 0)}
                </span>
                {task.git_link && (
                  <a
                    href={task.git_link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky-500 hover:underline font-mono"
                  >
                    View code
                  </a>
                )}
              </>
            )}
          </div>
        </div>

        {task.status !== "done" && (
          <div className="flex gap-2">
            {isRunning ? (
              <button
                onClick={onStop}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                <Square className="h-4 w-4" /> Pause
              </button>
            ) : (
              <button
                onClick={onStart}
                disabled={!checkedIn}
                className="flex items-center gap-1.5 rounded-xl bg-blue-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
                title={!checkedIn ? "Check in and make sure you are not on break" : ""}
              >
                <Play className="h-4 w-4" /> Start
              </button>
            )}
            <button
              onClick={onComplete}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-600"
            >
              <CheckCircle2 className="h-4 w-4" /> Complete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
