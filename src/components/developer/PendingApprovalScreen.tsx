import { Clock, Loader2, LogOut, RefreshCw, ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";

export function PendingApprovalScreen() {
  const { session, profile, signOut, refreshProfile } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshProfile();
    setRefreshing(false);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-500/10 ring-1 ring-amber-500/30">
          <ShieldAlert className="h-10 w-10 text-amber-400" />
        </div>

        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400 border border-amber-500/20">
          <Clock className="h-3.5 w-3.5" />
          Approval Pending
        </div>

        <h1 className="text-2xl font-bold text-white">Account Under Review</h1>
        
        <p className="mt-3 text-slate-300 text-sm leading-relaxed">
          Hello <span className="font-semibold text-white">{profile?.full_name || session?.user?.email}</span>! Your developer registration has been received. Please wait for the <span className="font-semibold text-sky-400">Admin (Project Manager)</span> to approve your account.
        </p>

        <div className="mt-8 rounded-2xl bg-slate-800/60 p-4 border border-slate-700/50 text-xs text-slate-400 text-left space-y-2">
          <p className="font-semibold text-slate-200">What happens next?</p>
          <ul className="list-disc pl-4 space-y-1 text-slate-400">
            <li>Admin will review and approve your registration.</li>
            <li>Once approved, click "Check Approval Status" to unlock your workspace.</li>
          </ul>
        </div>

        <div className="mt-8 flex flex-col items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 py-2.5 text-xs font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:shadow-sky-500/30 disabled:opacity-60"
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {refreshing ? "Checking Status…" : "Check Approval Status"}
          </button>

          <button
            onClick={signOut}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 py-2.5 text-xs font-medium text-slate-400 transition hover:bg-slate-700 hover:text-white"
          >
            <LogOut className="h-4 w-4" /> Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
