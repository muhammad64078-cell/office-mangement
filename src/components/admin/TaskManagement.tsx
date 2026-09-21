import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Profile, Task, Attendance } from "@/types";
import { TaskStatusBadge } from "@/components/shared/Badges";
import { Modal } from "@/components/shared/Modal";
import { useAuth } from "@/hooks/useAuth";
import { formatDuration, formatTime, todayStr } from "@/lib/utils";
import {
  Plus,
  Pencil,
  Trash2,
  ListTodo,
  Clock,
  Link as LinkIcon,
  FileText,
  Loader2,
  Calendar,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  Briefcase,
  BarChart2,
} from "lucide-react";

interface Props {
  developers: Profile[];
  allProfiles: Profile[];
}

export function TaskManagement({ developers, allProfiles }: Props) {
  const { profile } = useAuth();
  const [tasks, setTasks] = useState<(Task & { assignee?: Profile; assigner?: Profile })[]>([]);
  const [attendanceList, setAttendanceList] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Filters
  const [developerFilter, setDeveloperFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>(todayStr());
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const loadData = useCallback(async () => {
    setLoading(true);
    const [tasksRes, attRes] = await Promise.all([
      supabase
        .from("tasks")
        .select("*, assignee:profiles!tasks_assigned_to_fkey(*), assigner:profiles!tasks_assigned_by_fkey(*)")
        .order("created_at", { ascending: false }),
      supabase
        .from("attendance")
        .select("*")
        .eq("date", dateFilter),
    ]);

    setTasks((tasksRes.data as (Task & { assignee?: Profile; assigner?: Profile })[]) ?? []);
    setAttendanceList((attRes.data as Attendance[]) ?? []);
    setLoading(false);
  }, [dateFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const channel = supabase
      .channel("admin-tasks-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        () => loadData(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance" },
        () => loadData(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this task?")) return;
    await supabase.from("tasks").delete().eq("id", id);
  };

  const profileMap = new Map(allProfiles.map((p) => [p.id, p]));

  // Filtering Logic
  const dateFilteredTasks = tasks.filter((t) => {
    const taskDate = t.created_at ? t.created_at.slice(0, 10) : "";
    const startedDate = t.started_at ? t.started_at.slice(0, 10) : "";
    const completedDate = t.completed_at ? t.completed_at.slice(0, 10) : "";
    
    // Match date filter against created_at, started_at, or completed_at
    const matchesDate = taskDate === dateFilter || startedDate === dateFilter || completedDate === dateFilter;
    
    const matchesDev = developerFilter === "all" || t.assigned_to === developerFilter;

    return matchesDate && matchesDev;
  });

  const finalFilteredTasks = dateFilteredTasks.filter((t) => {
    const isOverdue = (t.total_seconds_spent ?? 0) > t.estimated_minutes * 60;
    if (statusFilter === "all") return true;
    if (statusFilter === "overdue") return isOverdue;
    return t.status === statusFilter;
  });

  // Calculate Daily Summary Metrics
  const filteredAttendance = attendanceList.filter((a) => {
    return developerFilter === "all" || a.user_id === developerFilter;
  });

  const totalWorkingHours = filteredAttendance.reduce((sum, a) => sum + (a.total_hours ?? 0), 0);

  const totalTaskSeconds = dateFilteredTasks.reduce((sum, t) => sum + (t.total_seconds_spent ?? 0), 0);
  const totalTaskHoursLogged = (totalTaskSeconds / 3600).toFixed(2);

  const tasksAssigned = dateFilteredTasks.length;
  const tasksCompleted = dateFilteredTasks.filter((t) => t.status === "done").length;
  const tasksPending = dateFilteredTasks.filter((t) => t.status === "todo" || t.status === "in_progress").length;

  return (
    <div className="space-y-6">
      {/* Filters Section */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <BarChart2 className="h-5 w-5 text-sky-500" />
          <h2 className="font-semibold text-slate-900">Task Filters & Daily Report</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Developer Dropdown Filter */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Developer</label>
            <select
              value={developerFilter}
              onChange={(e) => setDeveloperFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            >
              <option value="all">All Developers</option>
              {developers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.full_name} ({d.level ?? "Dev"})
                </option>
              ))}
            </select>
          </div>

          {/* Date Picker Filter */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Report Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-xs text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            >
              <option value="all">All Statuses</option>
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Completed</option>
              <option value="overdue">Overdue (Exceeded Est.)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Daily Summary Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <Briefcase className="h-4 w-4 text-emerald-500" />
            <span className="text-xs font-medium uppercase tracking-wide">Net Work Hours</span>
          </div>
          <p className="text-xl font-bold text-slate-900">{totalWorkingHours.toFixed(2)}h</p>
          <span className="text-[11px] text-slate-400">Office Attendance</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <Clock className="h-4 w-4 text-sky-500" />
            <span className="text-xs font-medium uppercase tracking-wide">Task Hours Logged</span>
          </div>
          <p className="text-xl font-bold text-slate-900">{totalTaskHoursLogged}h</p>
          <span className="text-[11px] text-slate-400">Logged on tasks</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="text-xs font-medium uppercase tracking-wide">Completed Tasks</span>
          </div>
          <p className="text-xl font-bold text-emerald-600">{tasksCompleted}</p>
          <span className="text-[11px] text-slate-400">Out of {tasksAssigned} assigned</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <Clock className="h-4 w-4 text-amber-500" />
            <span className="text-xs font-medium uppercase tracking-wide">Pending Tasks</span>
          </div>
          <p className="text-xl font-bold text-amber-600">{tasksPending}</p>
          <span className="text-[11px] text-slate-400">To-Do & In Progress</span>
        </div>
      </div>

      {/* Header with New Task Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListTodo className="h-5 w-5 text-slate-400" />
          <h2 className="text-lg font-semibold text-slate-900">Task List</h2>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
            {finalFilteredTasks.length}
          </span>
        </div>
        <button
          onClick={() => { setEditingTask(null); setModalOpen(true); }}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-xs sm:text-sm font-medium text-white shadow-lg shadow-sky-500/25 transition hover:shadow-sky-500/40"
        >
          <Plus className="h-4 w-4" /> New Task
        </button>
      </div>

      {/* Task Cards List View */}
      {loading ? (
        <div className="p-8 text-center text-slate-400 text-sm">Loading tasks…</div>
      ) : finalFilteredTasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <p className="text-slate-400 text-sm">No tasks found for the selected filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {finalFilteredTasks.map((task) => {
            const actualSeconds = task.total_seconds_spent ?? 0;
            const estimatedSeconds = task.estimated_minutes * 60;
            const isOvertime = actualSeconds > estimatedSeconds;

            return (
              <div
                key={task.id}
                className={`rounded-2xl border p-5 shadow-sm transition ${
                  isOvertime
                    ? "border-red-300 bg-red-50/60 ring-2 ring-red-100"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-900 text-base">{task.title}</h3>
                      <TaskStatusBadge status={task.status} />
                      {isOvertime && (
                        <span className="flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700 border border-red-200">
                          <AlertTriangle className="h-3.5 w-3.5 text-red-600" /> OVERTIME (EXCEEDED EST.)
                        </span>
                      )}
                    </div>
                    {task.description && (
                      <p className="mt-1 text-sm text-slate-500">{task.description}</p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <UserCheck className="h-3.5 w-3.5 text-slate-400" />
                        Developer:{" "}
                        <span className="font-semibold text-slate-800">
                          {task.assignee?.full_name ?? profileMap.get(task.assigned_to)?.full_name ?? "—"}
                        </span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-slate-400" /> Est. {task.estimated_minutes}m
                      </span>
                      <span className={`flex items-center gap-1 font-mono font-medium ${isOvertime ? "text-red-700 font-bold" : "text-slate-700"}`}>
                        Actual Spent: {formatDuration(actualSeconds)}
                      </span>
                      {task.status === "in_progress" && task.started_at && (
                        <span className="text-blue-600 font-medium">Running since {formatTime(task.started_at)}</span>
                      )}
                    </div>

                    {/* Proof of Work / Commit Link & Summary */}
                    {(task.git_link || task.summary_note) && (
                      <div className="mt-3 rounded-xl bg-slate-50 p-3 border border-slate-100 space-y-1.5 text-xs">
                        {task.git_link && (
                          <div className="flex items-center gap-1.5">
                            <LinkIcon className="h-3.5 w-3.5 text-sky-500 flex-shrink-0" />
                            <span className="font-medium text-slate-600">Proof of Work / Git Link:</span>
                            <a
                              href={task.git_link}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sky-600 hover:underline font-mono truncate max-w-md"
                            >
                              {task.git_link}
                            </a>
                          </div>
                        )}
                        {task.summary_note && (
                          <div className="flex items-start gap-1.5 text-slate-600">
                            <FileText className="h-3.5 w-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                            <span><strong className="font-semibold">Work Summary:</strong> "{task.summary_note}"</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-start">
                    <button
                      onClick={() => { setEditingTask(task); setModalOpen(true); }}
                      className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                      title="Edit task"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(task.id)}
                      className="rounded-xl border border-slate-200 p-2 text-red-400 transition hover:bg-red-50 hover:text-red-600"
                      title="Delete task"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <TaskModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingTask(null); }}
        developers={developers}
        editing={editingTask}
        adminId={profile?.id ?? null}
        onSaved={() => loadData()}
      />
    </div>
  );
}

function TaskModal({
  open,
  onClose,
  developers,
  editing,
  adminId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  developers: Profile[];
  editing: Task | null;
  adminId: string | null;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [estimatedMinutes, setEstimatedMinutes] = useState(60);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTitle(editing.title);
      setDescription(editing.description ?? "");
      setAssignedTo(editing.assigned_to);
      setEstimatedMinutes(editing.estimated_minutes);
    } else {
      setTitle("");
      setDescription("");
      setAssignedTo(developers[0]?.id ?? "");
      setEstimatedMinutes(60);
    }
    setError(null);
  }, [open, editing, developers]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!title.trim()) { setError("Title is required."); return; }
    if (!assignedTo) { setError("Select a developer."); return; }

    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase
          .from("tasks")
          .update({
            title: title.trim(),
            description: description.trim() || null,
            assigned_to: assignedTo,
            estimated_minutes: estimatedMinutes,
          })
          .eq("id", editing.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("tasks").insert({
          title: title.trim(),
          description: description.trim() || null,
          assigned_to: assignedTo,
          assigned_by: adminId,
          estimated_minutes: estimatedMinutes,
        });
        if (error) throw new Error(error.message);
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
    <Modal open={open} onClose={onClose} title={editing ? "Edit Task" : "Create Task"}>
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Title</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            placeholder="e.g. Fix login redirect bug"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Description</label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 resize-none"
            placeholder="What needs to be done…"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Assign to</label>
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            >
              {developers.map((d) => (
                <option key={d.id} value={d.id}>{d.full_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Est. minutes</label>
            <input
              type="number"
              min={1}
              value={estimatedMinutes}
              onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            />
          </div>
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
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? "Saving…" : editing ? "Update" : "Create"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
