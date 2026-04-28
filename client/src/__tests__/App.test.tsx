import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from '../App.js';

const authState = vi.hoisted(() => ({
  user: null as null | { id: number; role: 'member' | 'owner'; full_name: string; email: string },
  loading: false,
}));

vi.mock('../context/AuthContext.js', () => ({
  useAuth: () => ({ user: authState.user, loading: authState.loading }),
  AuthProvider: ({ children }: any) => children,
}));

vi.mock('../context/ThemeContext.js', () => ({
  ThemeProvider: ({ children }: any) => children,
}));

vi.mock('../pages/LoginPage.js', () => ({ default: () => <div>Login Page</div> }));
vi.mock('../pages/member/MemberHomePage.js', () => ({ default: () => <div>Member Home Page</div> }));
vi.mock('../pages/member/MemberBillingPage.js', () => ({ default: () => <div>Member Billing Page</div> }));
vi.mock('../pages/member/MemberSubscriptionAttendancePage.js', () => ({ default: () => <div>Member Subscription Attendance Page</div> }));
vi.mock('../pages/member/MemberProfilePage.js', () => ({ default: () => <div>Member Profile Page</div> }));
vi.mock('../pages/owner/OwnerHomePage.js', () => ({ default: () => <div>Owner Home Page</div> }));
vi.mock('../pages/owner/OwnerMembersPage.js', () => ({ default: () => <div>Owner Members Page</div> }));
vi.mock('../pages/owner/OwnerNewMemberPage.js', () => ({ default: () => <div>Owner New Member Page</div> }));
vi.mock('../pages/owner/OwnerMemberDetailPage.js', () => ({ default: () => <div>Owner Member Detail Page</div> }));
vi.mock('../pages/owner/OwnerNewSubscriptionPage.js', () => ({ default: () => <div>Owner New Subscription Page</div> }));
vi.mock('../pages/owner/OwnerPackagesPage.js', () => ({ default: () => <div>Owner Packages Page</div> }));
vi.mock('../pages/owner/OwnerNewPackagePage.js', () => ({ default: () => <div>Owner New Package Page</div> }));
vi.mock('../pages/NotFoundPage.js', () => ({ default: () => <div>Not Found Page</div> }));
vi.mock('../components/Spinner.js', () => ({ default: () => <div>Loading</div> }));

function renderApp(route: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  authState.user = null;
  authState.loading = false;
});

describe('App routes', () => {
  it('opens owner home at /home', async () => {
    authState.user = { id: 1, role: 'owner', full_name: 'Sam', email: 'owner@thebase.fit' };
    renderApp('/home');
    expect(await screen.findByText('Owner Home Page')).toBeInTheDocument();
  });

  it('opens members at /members for owners', async () => {
    authState.user = { id: 1, role: 'owner', full_name: 'Sam', email: 'owner@thebase.fit' };
    renderApp('/members');
    expect(await screen.findByText('Owner Members Page')).toBeInTheDocument();
  });

  it('opens packages at /packages for owners', async () => {
    authState.user = { id: 1, role: 'owner', full_name: 'Sam', email: 'owner@thebase.fit' };
    renderApp('/packages');
    expect(await screen.findByText('Owner Packages Page')).toBeInTheDocument();
  });

  it('opens new package at /packages/new for owners', async () => {
    authState.user = { id: 1, role: 'owner', full_name: 'Sam', email: 'owner@thebase.fit' };
    renderApp('/packages/new');
    expect(await screen.findByText('Owner New Package Page')).toBeInTheDocument();
  });

  it('shows 404 for members who visit /members', async () => {
    authState.user = { id: 2, role: 'member', full_name: 'Alex', email: 'member@thebase.fit' };
    renderApp('/members');
    expect(await screen.findByText('Not Found Page')).toBeInTheDocument();
  });

  it('opens subscription at /subscription for members', async () => {
    authState.user = { id: 2, role: 'member', full_name: 'Alex', email: 'member@thebase.fit' };
    renderApp('/subscription');
    expect(await screen.findByText('Member Billing Page')).toBeInTheDocument();
  });

  it('opens subscription attendance at /subscription/:id/attendance for members', async () => {
    authState.user = { id: 2, role: 'member', full_name: 'Alex', email: 'member@thebase.fit' };
    renderApp('/subscription/1/attendance');
    expect(await screen.findByText('Member Subscription Attendance Page')).toBeInTheDocument();
  });

  it('does not keep /owner as a valid owner route', async () => {
    authState.user = { id: 1, role: 'owner', full_name: 'Sam', email: 'owner@thebase.fit' };
    renderApp('/owner');
    expect(await screen.findByText('Not Found Page')).toBeInTheDocument();
  });
});
