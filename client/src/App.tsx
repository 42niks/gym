import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { ThemeProvider } from './context/ThemeContext.js';
import Spinner from './components/Spinner.js';
import LoginPage from './pages/LoginPage.js';
import MemberHomePage from './pages/member/MemberHomePage.js';
import MemberBillingPage from './pages/member/MemberBillingPage.js';
import MemberProfilePage from './pages/member/MemberProfilePage.js';
import OwnerHomePage from './pages/owner/OwnerHomePage.js';
import OwnerMembersPage from './pages/owner/OwnerMembersPage.js';
import OwnerNewMemberPage from './pages/owner/OwnerNewMemberPage.js';
import OwnerMemberDetailPage from './pages/owner/OwnerMemberDetailPage.js';
import OwnerNewSubscriptionPage from './pages/owner/OwnerNewSubscriptionPage.js';

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  if (user.role === 'owner') {
    return (
      <Routes>
        <Route path="/owner" element={<OwnerHomePage />} />
        <Route path="/owner/members" element={<OwnerMembersPage />} />
        <Route path="/owner/members/new" element={<OwnerNewMemberPage />} />
        <Route path="/owner/members/:id" element={<OwnerMemberDetailPage />} />
        <Route path="/owner/members/:id/subscriptions/new" element={<OwnerNewSubscriptionPage />} />
        <Route path="*" element={<Navigate to="/owner" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/home" element={<MemberHomePage />} />
      <Route path="/billing" element={<MemberBillingPage />} />
      <Route path="/profile" element={<MemberProfilePage />} />
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <div className="min-h-screen bg-shell px-2 py-2 sm:px-4 sm:py-4">
          <div className="relative mx-auto min-h-[calc(100vh-1rem)] max-w-6xl overflow-hidden rounded-shell border border-white/70 bg-page shadow-panel dark:border-white/10">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgb(var(--color-accent-500)_/_0.08),transparent_24%),radial-gradient(circle_at_top_right,rgb(var(--color-brand-500)_/_0.12),transparent_26%)] dark:bg-[radial-gradient(circle_at_top_left,rgb(var(--color-accent-400)_/_0.14),transparent_24%),radial-gradient(circle_at_top_right,rgb(var(--color-brand-400)_/_0.16),transparent_26%)]" />
            <div className="pointer-events-none absolute -left-24 top-16 h-56 w-56 rounded-full bg-accent-500/8 blur-3xl" />
            <div className="pointer-events-none absolute -right-24 top-1/3 h-64 w-64 rounded-full bg-brand-500/8 blur-3xl" />
            <AppRoutes />
          </div>
        </div>
      </AuthProvider>
    </ThemeProvider>
  );
}
