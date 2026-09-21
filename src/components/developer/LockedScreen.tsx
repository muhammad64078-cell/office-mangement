import { Fingerprint, Loader2, LogOut, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { todayStr } from "@/lib/utils";
import { useState } from "react";

export function LockedScreen() {
  const { session, profile, signOut } = useAuth();
  const [checkingIn, setCheckingIn] = useState(false);

  const handleSimulateCheckIn = async () => {
    if (!profile) return;
    setCheckingIn(true);
    const today = todayStr();

    const { data: existingAtt } = await supabase
      .from("attendance")
      .select("id, check_in")
      .eq("user_id", profile.id)
      .eq("date", today)
      .maybeSingle();

    let attId = existingAtt?.id;
    const nowIso = new Date().toISOString();

    if (!attId) {
      const { data: newAtt } = await supabase
        .from("attendance")
        .insert({
          user_id: profile.id,
          date: today,
          check_in: nowIso,
          status: "present",
          source: "manual",
          is_on_break: false,
        })
        .select("id")
        .single();
      attId = newAtt?.id;
    } else {
      await supabase
        .from("attendance")
        .update({
          check_in: existingAtt?.check_in || nowIso,
          check_out: null,
          is_on_break: false,
        })
        .eq("id", attId);
    }

    if (attId) {
      await supabase.from("attendance_sessions").insert({
        attendance_id: attId,
        user_id: profile.id,
        date: today,
        check_in: nowIso,
        session_type: "work",
      });
    }

    setCheckingIn(false);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-700/50 ring-1 ring-slate-600/50">
          <Fingerprint className="h-10 w-10 text-sky-400" />
        </div>

        {/* Current User Info */}
        <div className="mb-6 rounded-xl bg-slate-800/60 p-3 border border-slate-700/50 text-xs text-slate-300">
          Logged in as: <span className="font-semibold text-white">{session?.user?.email}</span>
        </div>

        <h1 className="text-2xl font-bold text-white">Attendance Required</h1>
        <p className="mt-2 text-slate-400 text-sm">
          Please mark your attendance on the biometric machine to unlock your tasks for today.
        </p>
        
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Waiting for biometric check-in…</span>
        </div>

        {/* Action Options */}
        <div className="mt-8 flex flex-col items-center gap-3">
          <button
            onClick={handleSimulateCheckIn}
            disabled={checkingIn}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600/30 border border-sky-500/40 py-2.5 text-xs font-medium text-sky-300 transition hover:bg-sky-600/50"
          >
            <CheckCircle2 className="h-4 w-4 text-sky-400" />
            {checkingIn ? "Checking in…" : "Simulate Punch / Mark Present (Test Developer Mode)"}
          </button>

          <button
            onClick={signOut}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 py-2 text-xs font-medium text-slate-400 transition hover:bg-slate-700 hover:text-white"
          >
            <LogOut className="h-4 w-4" /> Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
