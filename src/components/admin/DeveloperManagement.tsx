import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types";
import { Modal } from "@/components/shared/Modal";
import {
  Plus,
  Fingerprint,
  Pencil,
  Loader2,
  Mail,
  User,
  Shield,
  Trash2,
  AlertTriangle,
} from "lucide-react";

interface Props {
  developers: Profile[];
  onUpdated: () => void;
}

export function DeveloperManagement({ developers, onUpdated }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDev, setEditingDev] = useState<Profile | null>(null);
  const [deletingDev, setDeletingDev] = useState<Profile | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const pendingDevs = developers.filter((d) => d.is_approved === false);
  const approvedDevs = developers.filter((d) => d.is_approved !== false);

  const handleApprove = async (devId: string) => {
    setApprovingId(devId);
    await supabase.from("profiles").update({ is_approved: true }).eq("id", devId);
    setApprovingId(null);
    onUpdated();
  };

  return (
    <div className="space-y-6">
      {/* Pending Approvals Section */}
      {pendingDevs.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-3 w-3 rounded-full bg-amber-500 animate-ping" />
              <h3 className="text-base font-bold text-amber-900">Pending Developer Approvals</h3>
              <span className="rounded-full bg-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                {pendingDevs.length} Pending
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pendingDevs.map((dev) => (
              <div key={dev.id} className="rounded-xl border border-amber-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800 font-bold">
                      {dev.full_name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{dev.full_name}</p>
                      <p className="text-xs text-slate-400 capitalize">{dev.level || "junior"} developer</p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
                  <button
                    onClick={() => handleApprove(dev.id)}
                    disabled={approvingId === dev.id}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2 text-xs font-semibold text-white shadow transition hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {approvingId === dev.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Shield className="h-3.5 w-3.5" />
                    )}
                    {approvingId === dev.id ? "Approving…" : "Approve Developer"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Approved Developers Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Fingerprint className="h-5 w-5 text-slate-400" />
          <h2 className="text-lg font-semibold text-slate-900">All Developers</h2>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
            {approvedDevs.length}
          </span>
        </div>
        <button
          onClick={() => { setEditingDev(null); setModalOpen(true); }}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-sky-500/25 transition hover:shadow-sky-500/40"
        >
          <Plus className="h-4 w-4" /> Add Developer
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {approvedDevs.map((dev) => (
          <div key={dev.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-200 text-sm font-bold text-slate-600">
                  {dev.full_name.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{dev.full_name}</p>
                  <p className="text-xs capitalize text-slate-400">{dev.level ?? "—"} developer</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setEditingDev(dev); setModalOpen(true); }}
                  className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50"
                  title="Edit Developer"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setDeletingDev(dev)}
                  className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-600 transition hover:bg-red-100"
                  title="Remove Developer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Biometric ID</span>
                <span className={`font-mono ${dev.biometric_user_id ? "text-slate-700" : "text-slate-300"}`}>
                  {dev.biometric_user_id ?? "Not set"}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <DeveloperModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingDev(null); }}
        editing={editingDev}
        onSaved={() => onUpdated()}
      />

      <DeleteDeveloperModal
        dev={deletingDev}
        onClose={() => setDeletingDev(null)}
        onDeleted={() => {
          setDeletingDev(null);
          onUpdated();
        }}
      />
    </div>
  );
}

function DeveloperModal({
  open,
  onClose,
  editing,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editing: Profile | null;
  onSaved: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [level, setLevel] = useState<"junior" | "senior">("junior");
  const [biometricId, setBiometricId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setEmail("");
      setPassword("");
      setFullName(editing.full_name);
      setLevel(editing.level ?? "junior");
      setBiometricId(editing.biometric_user_id ?? "");
    } else {
      setEmail("");
      setPassword("");
      setFullName("");
      setLevel("junior");
      setBiometricId("");
    }
    setError(null);
  }, [open, editing]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) { setError("Full name is required."); return; }

    setSaving(true);
    try {
      if (editing) {
        // Update profile fields directly
        const { error } = await supabase
          .from("profiles")
          .update({
            full_name: fullName.trim(),
            level,
            biometric_user_id: biometricId.trim() || null,
          })
          .eq("id", editing.id);
        if (error) throw new Error(error.message);
      } else {
        // Create new auth user via admin signUp, then profile is auto-created
        // by the trigger. We need to set role=developer and level in metadata.
        if (!email.trim() || !password) {
          setError("Email and password are required for new developers.");
          setSaving(false);
          return;
        }

        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              role: "developer",
              level,
            },
          },
        });
        if (authError) throw new Error(authError.message);
        if (!authData.user) throw new Error("Sign-up failed — no user returned.");

        // Update biometric_user_id (trigger creates the profile but without it)
        const { error: profErr } = await supabase
          .from("profiles")
          .update({
            biometric_user_id: biometricId.trim() || null,
            level,
          })
          .eq("id", authData.user.id);
        if (profErr) throw new Error(profErr.message);
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
    <Modal open={open} onClose={onClose} title={editing ? "Edit Developer" : "Add Developer"}>
      <form onSubmit={handleSave} className="space-y-4">
        {!editing && (
          <>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 py-2.5 pl-11 pr-4 text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                  placeholder="dev@team.dev"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                placeholder="Min 6 characters"
              />
            </div>
          </>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Full Name</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-11 pr-4 text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              placeholder="Jane Developer"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Level</label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value as "junior" | "senior")}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            >
              <option value="junior">Junior</option>
              <option value="senior">Senior</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Biometric ID</label>
            <div className="relative">
              <Fingerprint className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={biometricId}
                onChange={(e) => setBiometricId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 py-2.5 pl-11 pr-4 text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                placeholder="e.g. 1001"
              />
            </div>
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
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
            {saving ? "Saving…" : editing ? "Update" : "Create"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteDeveloperModal({
  dev,
  onClose,
  onDeleted,
}: {
  dev: Profile | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [typedName, setTypedName] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (dev) {
      setTypedName("");
      setConfirmed(false);
      setError(null);
    }
  }, [dev]);

  if (!dev) return null;

  const nameMatches = typedName === dev.full_name;
  const canDelete = nameMatches && confirmed && !deleting;

  const handleDelete = async () => {
    if (!canDelete) return;
    setDeleting(true);
    setError(null);
    try {
      const { error } = await supabase.from("profiles").delete().eq("id", dev.id);
      if (error) throw new Error(error.message);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete developer.");
      setDeleting(false);
    }
  };

  return (
    <Modal open={!!dev} onClose={onClose} title="Remove Developer">
      <div className="space-y-4">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
            <div className="text-sm text-red-900">
              <p className="font-bold text-red-700 mb-1">Danger Zone</p>
              <p>
                You are about to permanently delete <strong>{dev.full_name}</strong>.
                This action will wipe out all of their attendance records, sessions, and tasks from the system due to database cascade rules.
              </p>
            </div>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Step 1: Type the exact name <span className="font-bold">"{dev.full_name}"</span> to confirm
          </label>
          <input
            type="text"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
            placeholder={dev.full_name}
          />
        </div>

        <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50 cursor-pointer">
          <div className="flex h-5 items-center">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-600"
            />
          </div>
          <div className="text-sm">
            <p className="font-medium text-slate-900">Step 2: Acknowledge Data Loss</p>
            <p className="text-slate-500 text-xs mt-0.5">I understand that this action is permanent and will delete all attendance and task history for this developer.</p>
          </div>
        </label>

        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-100">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            disabled={deleting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!canDelete}
            className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-red-500/25 transition hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {deleting ? "Deleting…" : "Permanently Delete"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
