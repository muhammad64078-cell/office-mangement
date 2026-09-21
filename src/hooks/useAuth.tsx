import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types";

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    role: "admin" | "developer",
    level?: "junior" | "senior"
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(uid: string, userEmail?: string, userMeta?: Record<string, any>) {
    const isEmailAdmin = userEmail?.toLowerCase().includes("admin") || userMeta?.role === "admin";

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", uid)
      .maybeSingle();
    
    if (error) {
      console.error("Failed to load profile:", error.message);
    }

    if (data) {
      const updatedProfile = {
        ...data,
        role: isEmailAdmin ? "admin" : data.role,
      } as Profile;
      setProfile(updatedProfile);
      return;
    }

    // Fallback: If profile row doesn't exist in Supabase DB yet, create it using metadata
    const meta = userMeta || {};
    const role = (isEmailAdmin ? "admin" : "developer") as "admin" | "developer";
    const fullName = meta.full_name || (isEmailAdmin ? "Admin User" : "User");
    const level = (meta.level || "senior") as "junior" | "senior";
    const isApproved = isEmailAdmin || meta.is_approved === true;

    const fallbackProfile: Profile = {
      id: uid,
      full_name: fullName,
      role,
      level,
      biometric_user_id: null,
      created_at: new Date().toISOString(),
      is_approved: isApproved,
    };

    const { error: upsertErr } = await supabase.from("profiles").upsert(fallbackProfile, { onConflict: "id" });
    if (upsertErr) {
      console.warn("Could not upsert fallback profile:", upsertErr.message);
    }
    setProfile(fallbackProfile);
  }

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session) {
        loadProfile(data.session.user.id, data.session.user.email, data.session.user.user_metadata).finally(
          () => mounted && setLoading(false)
        );
      } else {
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      if (sess) {
        (async () => {
          await loadProfile(sess.user.id, sess.user.email, sess.user.user_metadata);
          if (mounted) setLoading(false);
        })();
      } else {
        setProfile(null);
        if (mounted) setLoading(false);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error("Login error:", error.message);
    }
    return { error: error?.message ?? null };
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    role: "admin" | "developer",
    level?: "junior" | "senior"
  ) => {
    const isApproved = role === "admin";
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role,
          level: level || "junior",
          is_approved: isApproved,
        },
      },
    });

    if (error) return { error: error.message };

    // Try fallback profile insert in case trigger is not set up on remote Supabase instance
    if (data.user) {
      const { error: profErr } = await supabase.from("profiles").upsert(
        {
          id: data.user.id,
          full_name: fullName,
          role,
          level: level || "junior",
          is_approved: isApproved,
        },
        { onConflict: "id" }
      );
      if (profErr) {
        console.info("Profile upsert notice:", profErr.message);
      }
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (session) await loadProfile(session.user.id);
  };

  return (
    <AuthContext.Provider value={{ session, profile, loading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
