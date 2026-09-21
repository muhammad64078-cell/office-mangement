import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { Login } from "@/components/Login";
import { DeveloperDashboard } from "@/components/developer/DeveloperDashboard";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { PendingApprovalScreen } from "@/components/developer/PendingApprovalScreen";
import { FullPageLoader } from "@/components/shared/Spinner";

function AppContent() {
  const { session, profile, loading } = useAuth();

  if (loading) return <FullPageLoader label="Loading your workspace…" />;
  if (!session) return <Login />;

  const isEmailAdmin = session.user.email?.toLowerCase().includes("admin");
  const isMetaAdmin = session.user.user_metadata?.role === "admin";
  const isAdmin = isEmailAdmin || isMetaAdmin || profile?.role === "admin";

  if (isAdmin) {
    return <AdminDashboard />;
  }

  if (!profile) return <FullPageLoader label="Setting up developer profile…" />;

  if (profile.is_approved === false) {
    return <PendingApprovalScreen />;
  }

  return <DeveloperDashboard />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
