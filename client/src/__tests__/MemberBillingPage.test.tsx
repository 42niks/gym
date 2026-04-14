import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import MemberBillingPage from '../pages/member/MemberBillingPage.js';
import { renderWithProviders } from './test-utils.js';
import { mockSubscriptions } from './mocks.js';

const { mockApiGet } = vi.hoisted(() => ({ mockApiGet: vi.fn() }));

vi.mock('../context/AuthContext.js', () => ({
  useAuth: () => ({ logout: vi.fn(), user: { id: 2, role: 'member', full_name: 'Alex Kumar', email: 'member@thebase.fit' }, loading: false }),
  AuthProvider: ({ children }: any) => children,
}));

vi.mock('../lib/api.js', async () => {
  const actual = await vi.importActual('../lib/api.js');
  return { ...actual, api: { get: mockApiGet, post: vi.fn(), patch: vi.fn() } };
});

beforeEach(() => { vi.clearAllMocks(); });

describe('MemberBillingPage', () => {
  it('renders subscription shell while loading', () => {
    mockApiGet.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<MemberBillingPage />, { route: '/subscription' });
    expect(screen.getByRole('heading', { name: 'SUBSCRIPTION', level: 2 })).toBeInTheDocument();
  });

  it('shows upcoming, current, and past sections', async () => {
    mockApiGet.mockResolvedValue(mockSubscriptions);
    renderWithProviders(<MemberBillingPage />, { route: '/subscription' });
    await waitFor(() => {
      expect(screen.getByText('Upcoming')).toBeInTheDocument();
      expect(screen.getByText('Current')).toBeInTheDocument();
      expect(screen.getByText('Past')).toBeInTheDocument();
    });
  });

  it('renders subscription cards with lifecycle badges', async () => {
    mockApiGet.mockResolvedValue(mockSubscriptions);
    renderWithProviders(<MemberBillingPage />, { route: '/subscription' });
    await waitFor(() => {
      expect(screen.getByText('active')).toBeInTheDocument();
      expect(screen.getByText('completed')).toBeInTheDocument();
      expect(screen.getByText('upcoming')).toBeInTheDocument();
    });
  });

  it('shows empty state when no subscriptions', async () => {
    mockApiGet.mockResolvedValue([]);
    renderWithProviders(<MemberBillingPage />, { route: '/subscription' });
    await waitFor(() => {
      expect(screen.getByText('No active package')).toBeInTheDocument();
      expect(screen.getByText('No past packages')).toBeInTheDocument();
    });
  });

  it('displays subscription details', async () => {
    mockApiGet.mockResolvedValue(mockSubscriptions);
    renderWithProviders(<MemberBillingPage />, { route: '/subscription' });
    await waitFor(() => {
      expect(screen.getAllByText('1:1 Personal Training').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Group Personal Training')).toBeInTheDocument();
    });
  });
});
