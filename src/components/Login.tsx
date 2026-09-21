import { useState } from "react";
import {
  Fingerprint,
  Lock,
  Mail,
  LogIn,
  UserPlus,
  User,
  ShieldCheck,
  Eye,
  EyeOff,
  Sparkles,
  CheckCircle2,
  Code2,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export function Login() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [level, setLevel] = useState<"junior" | "senior">("senior");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    if (mode === "signin") {
      let { error } = await signIn(email.trim(), password);

      // If logging in as default admin and user doesn't exist yet, auto-register admin!
      if (error && email.trim() === "admin@team.dev" && password === "admin123") {
        console.info("Auto-creating admin@team.dev user...");
        const signUpRes = await signUp("admin@team.dev", "admin123", "Alice Admin", "admin", "senior");
        if (!signUpRes.error) {
          const retry = await signIn("admin@team.dev", "admin123");
          error = retry.error;
        }
      }

      setLoading(false);
      if (error) setError(error);
    } else {
      if (!fullName.trim()) {
        setError("Full Name is required");
        setLoading(false);
        return;
      }
      const { error: signUpError } = await signUp(email.trim(), password, fullName.trim(), "developer", level);
      if (signUpError) {
        setLoading(false);
        setError(signUpError);
      } else {
        const { error: autoSignInError } = await signIn(email.trim(), password);
        setLoading(false);
        if (autoSignInError) {
          setSuccess("Account created successfully! Please sign in with your credentials.");
          setMode("signin");
        }
      }
    }
  };

  const handleAdminDirectLogin = async () => {
    setEmail("admin@team.dev");
    setPassword("admin123");
    setError(null);
    setSuccess(null);
    setLoading(true);

    let { error } = await signIn("admin@team.dev", "admin123");

    if (error) {
      console.info("Admin user not found on remote database, creating admin user...");
      const signUpRes = await signUp("admin@team.dev", "admin123", "Alice Admin", "admin", "senior");
      if (signUpRes.error) {
        setError("Supabase tables missing! Please run the SQL setup query in Supabase Dashboard -> SQL Editor.");
        setLoading(false);
        return;
      }
      const retry = await signIn("admin@team.dev", "admin123");
      error = retry.error;
    }

    setLoading(false);
    if (error) {
      setError("Login error: " + error);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 overflow-hidden selection:bg-sky-500 selection:text-white">
      {/* Dynamic Background Glowing Orbs */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-sky-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 -bottom-40 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-cyan-500/10 blur-3xl" />

      <div className="relative z-10 w-full max-w-md">
        {/* Header Branding */}
        <div className="mb-8 text-center">
          <div className="relative mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-sky-500 via-blue-600 to-cyan-400 p-0.5 shadow-2xl shadow-sky-500/30">
            <div className="flex h-full w-full items-center justify-center rounded-[22px] bg-slate-950/80 backdrop-blur">
              <Fingerprint className="h-10 w-10 text-sky-400" />
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-400 ring-1 ring-sky-500/20 mb-2">
            <Sparkles className="h-3.5 w-3.5" /> Biometric & Task Portal
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Team Management
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Biometric Attendance & Developer Workflow Management
          </p>
        </div>

        {/* Main Glassmorphic Card */}
        <div className="rounded-3xl border border-slate-800/80 bg-slate-900/80 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          {/* Mode Switcher Tabs */}
          <div className="mb-6 flex rounded-2xl bg-slate-950/70 p-1.5 border border-slate-800/60">
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setError(null);
                setSuccess(null);
              }}
              className={`flex-1 rounded-xl py-2.5 text-xs font-semibold transition-all duration-200 ${
                mode === "signin"
                  ? "bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/25"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <LogIn className="mr-1.5 inline h-4 w-4" /> Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setError(null);
                setSuccess(null);
              }}
              className={`flex-1 rounded-xl py-2.5 text-xs font-semibold transition-all duration-200 ${
                mode === "signup"
                  ? "bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/25"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <UserPlus className="mr-1.5 inline h-4 w-4" /> Register Developer
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-300">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                      placeholder="e.g. Rahul Sharma"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-300">
                    Developer Level
                  </label>
                  <div className="relative">
                    <Code2 className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <select
                      value={level}
                      onChange={(e) => setLevel(e.target.value as "junior" | "senior")}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2.5 pl-10 pr-4 text-sm text-white outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                    >
                      <option value="junior">Junior Developer</option>
                      <option value="senior">Senior Developer</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                  placeholder={mode === "signup" ? "developer@company.com" : "you@company.com"}
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2.5 pl-10 pr-10 text-sm text-white placeholder-slate-500 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
                {error}
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-400">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                <span>{success}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 py-3 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-sky-500/25 transition-all duration-200 hover:shadow-sky-500/40 disabled:opacity-60"
            >
              {mode === "signin" ? (
                <>
                  <LogIn className="h-4 w-4" />
                  {loading ? "Signing in…" : "Sign In"}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  {loading ? "Registering…" : "Register Account"}
                </>
              )}
            </button>
          </form>

          {/* Quick Admin Demo Login Button */}
          <div className="mt-6 border-t border-slate-800/80 pt-4">
            <button
              type="button"
              onClick={handleAdminDirectLogin}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-950/60 py-2.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-800/60 hover:text-white"
            >
              <ShieldCheck className="h-4 w-4 text-sky-400" />
              Direct Login as Admin (PM)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
