import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./auth/AuthProvider";
import { PortalProvider } from "./lib/portal";
import { AppShell } from "./layout/AppShell";
import { Spinner } from "./components/ui";
import LoginPage from "./pages/auth/LoginPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";
import HomePage from "./pages/home/HomePage";
import NotificationsPage from "./pages/NotificationsPage";
import SupportHubPage from "./pages/support/SupportHubPage";
import NewTicketPage from "./pages/support/NewTicketPage";
import TicketDetailPage from "./pages/support/TicketDetailPage";
import ContactSupportPage from "./pages/support/ContactSupportPage";
import PmsIntroPage from "./pages/support/PmsIntroPage";
import PmsRequestPage from "./pages/support/PmsRequestPage";
import SubmissionSuccessPage from "./pages/support/SubmissionSuccessPage";
import AccountPage from "./pages/account/AccountPage";

function FullScreenSpinner() {
  return (
    <div className="flex h-full min-h-screen items-center justify-center">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

function RequireAuth() {
  const { user, loading, recovering } = useAuth();
  const location = useLocation();
  if (loading) return <FullScreenSpinner />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (recovering && location.pathname !== "/reset-password") return <Navigate to="/reset-password" replace />;
  return (
    <PortalProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </PortalProvider>
  );
}

function PublicOnly() {
  const { user, loading, recovering } = useAuth();
  if (loading) return <FullScreenSpinner />;
  if (user && !recovering) return <Navigate to="/" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<PublicOnly />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      </Route>
      {/* Reachable both from the recovery link (session present, recovering) and when signed in. */}
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route element={<RequireAuth />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/support" element={<SupportHubPage />} />
        <Route path="/support/tickets/new" element={<NewTicketPage />} />
        <Route path="/support/tickets/:id" element={<TicketDetailPage />} />
        <Route path="/support/contact" element={<ContactSupportPage />} />
        <Route path="/support/pms" element={<PmsIntroPage />} />
        <Route path="/support/pms/request" element={<PmsRequestPage />} />
        <Route path="/support/success" element={<SubmissionSuccessPage />} />
        <Route path="/account" element={<Navigate to="/account/profile" replace />} />
        <Route path="/account/:tab" element={<AccountPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
