import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { Profile, Attendance, Task } from "@/types";
import { AttendanceSheet } from "@/components/admin/AttendanceSheet";
import { LiveGrid } from "@/components/admin/LiveGrid";
import { TaskManagement } from "@/components/admin/TaskManagement";
import { DeveloperManagement } from "@/components/admin/DeveloperManagement";
import {
  ClipboardList,
  Grid3x3,
  ListTodo,
  Users,
  LogOut,
  Fingerprint,
} from "lucide-react";

type Tab = "attendance" | "live" | "tasks" | "developers";

export function AdminDashboard() {
  const { profile, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>("attendance");
  const [developers, setDevelopers] = useState<Profile[]>([]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);

  const loadProfiles = useCallback(async () => {
    const { data } = await supabase.from("profiles").select("*").order("created_at");
    const profiles = (data as Profile[]) ?? [];
    setAllProfiles(profiles);
    setDevelopers(profiles.filter((p) => p.role === "developer"));
  }, []);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "attendance", label: "Attendance Sheet", icon: <ClipboardList className="h-4 w-4" /> },
    { id: "live", label: "Live Developers", icon: <Grid3x3 className="h-4 w-4" /> },
    { id: "tasks", label: "Tasks", icon: <ListTodo className="h-4 w-4" /> },
    { id: "developers", label: "Developers", icon: <Users className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white">
              <Fingerprint className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Team Portal — Admin</p>
              <p className="text-xs text-slate-500">{profile?.full_name}</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>

        {/* Tabs */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <nav className="flex gap-1 overflow-x-auto pb-px">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                  tab === t.id
                    ? "border-sky-500 text-sky-600"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {tab === "attendance" && <AttendanceSheet developers={developers} />}
        {tab === "live" && <LiveGrid developers={developers} />}
        {tab === "tasks" && <TaskManagement developers={developers} allProfiles={allProfiles} />}
        {tab === "developers" && <DeveloperManagement developers={developers} onUpdated={loadProfiles} />}
      </main>
    </div>
  );
}
