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
        <div className="min-h-screen bg-shell">
          <AppRoutes />
        </div>
      </AuthProvider>
    </ThemeProvider>
  );
}
