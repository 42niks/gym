import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { ThemeProvider } from './context/ThemeContext.js';
import AppShell from './components/AppShell.js';
import Spinner from './components/Spinner.js';
import { ownerLinks } from './pages/owner/ownerLinks.js';
import { memberLinks } from './pages/member/memberLinks.js';
import { pageLoaders } from './lib/routePreload.js';

const LoginPage = lazy(pageLoaders.LoginPage);
const MemberHomePage = lazy(pageLoaders.MemberHomePage);
const MemberBillingPage = lazy(pageLoaders.MemberBillingPage);
const MemberSubscriptionAttendancePage = lazy(pageLoaders.MemberSubscriptionAttendancePage);
const MemberProfilePage = lazy(pageLoaders.MemberProfilePage);
const OwnerHomePage = lazy(pageLoaders.OwnerHomePage);
const OwnerMembersPage = lazy(pageLoaders.OwnerMembersPage);
const OwnerNewMemberPage = lazy(pageLoaders.OwnerNewMemberPage);
const OwnerMemberDetailPage = lazy(pageLoaders.OwnerMemberDetailPage);
const OwnerNewSubscriptionPage = lazy(pageLoaders.OwnerNewSubscriptionPage);
const OwnerSubscriptionAttendancePage = lazy(pageLoaders.OwnerSubscriptionAttendancePage);
const OwnerPackagesPage = lazy(pageLoaders.OwnerPackagesPage);
const OwnerNewPackagePage = lazy(pageLoaders.OwnerNewPackagePage);
const NotFoundPage = lazy(pageLoaders.NotFoundPage);

function RouteFallback() {
  return (
    <div className="min-h-[55vh] flex items-center justify-center">
      <Spinner />
    </div>
  );
}

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
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    );
  }

  if (user.role === 'owner') {
    return (
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route element={<AppShell links={ownerLinks} />}>
          <Route path="/home" element={<OwnerHomePage />} />
          <Route path="/members" element={<OwnerMembersPage />} />
          <Route path="/members/new" element={<OwnerNewMemberPage />} />
          <Route path="/members/:id" element={<OwnerMemberDetailPage />} />
          <Route path="/members/:id/subscriptions/new" element={<OwnerNewSubscriptionPage />} />
          <Route path="/members/:id/subscriptions/:subscriptionId/attendance" element={<OwnerSubscriptionAttendancePage />} />
          <Route path="/packages" element={<OwnerPackagesPage />} />
          <Route path="/packages/new" element={<OwnerNewPackagePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route element={<AppShell links={memberLinks} />}>
        <Route path="/home" element={<MemberHomePage />} />
        <Route path="/subscription/:id/attendance" element={<MemberSubscriptionAttendancePage />} />
        <Route path="/subscription" element={<MemberBillingPage />} />
        <Route path="/profile" element={<MemberProfilePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
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
