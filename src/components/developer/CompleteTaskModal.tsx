import { useEffect, useState } from "react";
import { Modal } from "@/components/shared/Modal";
import { isValidUrl } from "@/lib/utils";
import { Link, FileText, Loader2 } from "lucide-react";

interface CompleteTaskModalProps {
  open: boolean;
  onClose: () => void;
  taskTitle: string;
  onComplete: (gitLink: string, summary: string) => Promise<void>;
}

export function CompleteTaskModal({ open, onClose, taskTitle, onComplete }: CompleteTaskModalProps) {
  const [gitLink, setGitLink] = useState("");
  const [summary, setSummary] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setGitLink("");
      setSummary("");
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isValidUrl(gitLink)) {
      setError("Please enter a valid HTTP/HTTPS URL for the Git/code link.");
      return;
    }
    if (!summary.trim()) {
      setError("Please write a one-line summary of what you did.");
      return;
    }

    setSaving(true);
    try {
      await onComplete(gitLink.trim(), summary.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete task");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Complete: ${taskTitle}`}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Git / Code Link <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Link className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="url"
              required
              value={gitLink}
              onChange={(e) => setGitLink(e.target.value)}
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-11 pr-4 text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              placeholder="https://github.com/team/repo/pull/42"
            />
          </div>
          <p className="mt-1 text-xs text-slate-400">A valid commit, PR, or repo URL.</p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Summary <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <FileText className="absolute left-3 top-4 h-5 w-5 text-slate-400" />
            <textarea
              required
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-11 pr-4 text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100 resize-none"
              placeholder="Fixed the check-in time display by parsing timestamps as UTC…"
            />
          </div>
          <p className="mt-1 text-xs text-slate-400">One line describing what you did.</p>
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
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-500/25 transition hover:shadow-emerald-500/40 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? "Completing…" : "Complete Task"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
