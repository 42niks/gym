export const pageLoaders = {
  LoginPage: () => import('../pages/LoginPage.js'),
  NotFoundPage: () => import('../pages/NotFoundPage.js'),
  MemberHomePage: () => import('../pages/member/MemberHomePage.js'),
  MemberBillingPage: () => import('../pages/member/MemberBillingPage.js'),
  MemberSubscriptionAttendancePage: () => import('../pages/member/MemberSubscriptionAttendancePage.js'),
  MemberProfilePage: () => import('../pages/member/MemberProfilePage.js'),
  OwnerHomePage: () => import('../pages/owner/OwnerHomePage.js'),
  OwnerMembersPage: () => import('../pages/owner/OwnerMembersPage.js'),
  OwnerNewMemberPage: () => import('../pages/owner/OwnerNewMemberPage.js'),
  OwnerMemberDetailPage: () => import('../pages/owner/OwnerMemberDetailPage.js'),
  OwnerNewSubscriptionPage: () => import('../pages/owner/OwnerNewSubscriptionPage.js'),
  OwnerSubscriptionAttendancePage: () => import('../pages/owner/OwnerSubscriptionAttendancePage.js'),
  OwnerPackagesPage: () => import('../pages/owner/OwnerPackagesPage.js'),
  OwnerNewPackagePage: () => import('../pages/owner/OwnerNewPackagePage.js'),
};

export function preloadRoute(pathname: string) {
  if (pathname === '/' || pathname === '') return pageLoaders.LoginPage();
  if (pathname === '/home') return pageLoaders.OwnerHomePage();
  if (pathname === '/members/new') return pageLoaders.OwnerNewMemberPage();
  if (/^\/members\/[^/]+\/subscriptions\/new/.test(pathname)) return pageLoaders.OwnerNewSubscriptionPage();
  if (/^\/members\/[^/]+\/subscriptions\/[^/]+\/attendance/.test(pathname)) return pageLoaders.OwnerSubscriptionAttendancePage();
  if (/^\/members\/[^/]+/.test(pathname)) return pageLoaders.OwnerMemberDetailPage();
  if (pathname === '/members') return pageLoaders.OwnerMembersPage();
  if (pathname === '/packages/new') return pageLoaders.OwnerNewPackagePage();
  if (pathname === '/packages') return pageLoaders.OwnerPackagesPage();
  if (/^\/subscription\/[^/]+\/attendance/.test(pathname)) return pageLoaders.MemberSubscriptionAttendancePage();
  if (pathname === '/subscription') return pageLoaders.MemberBillingPage();
  if (pathname === '/profile') return pageLoaders.MemberProfilePage();
  return Promise.resolve();
}

export function preloadOwnerShellRoutes() {
  void pageLoaders.OwnerHomePage();
  void pageLoaders.OwnerMembersPage();
}
