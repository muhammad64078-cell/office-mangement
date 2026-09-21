import type { AttendanceStatus, AttendanceSource, TaskStatus } from "@/types";

const statusStyles: Record<AttendanceStatus, string> = {
  present: "bg-emerald-100 text-emerald-700 border-emerald-200",
  late: "bg-red-100 text-red-700 border-red-200",
  half_day: "bg-amber-100 text-amber-700 border-amber-200",
  absent: "bg-gray-200 text-gray-600 border-gray-300",
};

const statusLabel: Record<AttendanceStatus, string> = {
  present: "Present",
  late: "Late",
  half_day: "Half-day",
  absent: "Absent",
};

export function StatusBadge({ status }: { status: AttendanceStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusStyles[status]}`}
    >
      {statusLabel[status]}
    </span>
  );
}

export function SourceBadge({ source }: { source: AttendanceSource }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        source === "manual"
          ? "bg-yellow-100 text-yellow-700 border-yellow-200"
          : "bg-sky-100 text-sky-700 border-sky-200"
      }`}
    >
      {source === "manual" ? "Manual" : "Biometric"}
    </span>
  );
}

const taskStatusStyles: Record<TaskStatus, string> = {
  todo: "bg-gray-100 text-gray-600 border-gray-200",
  in_progress: "bg-blue-100 text-blue-700 border-blue-200",
  done: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

const taskStatusLabel: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${taskStatusStyles[status]}`}
    >
      {taskStatusLabel[status]}
    </span>
  );
}
