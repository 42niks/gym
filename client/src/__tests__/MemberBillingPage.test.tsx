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
      expect(screen.getByRole('heading', { name: /upcoming/i, level: 3 })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /current/i, level: 3 })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /past/i, level: 3 })).toBeInTheDocument();
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

  it('shows attendance links for active and past subscriptions only', async () => {
    mockApiGet.mockResolvedValue(mockSubscriptions);
    renderWithProviders(<MemberBillingPage />, { route: '/subscription' });
    await waitFor(() => {
      const links = screen.getAllByRole('link', { name: /see attendance/i });
      expect(links).toHaveLength(2);
      expect(links[0]).toHaveAttribute('href', '/subscription/1/attendance');
      expect(links[1]).toHaveAttribute('href', '/subscription/2/attendance');
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

  it('computes days left from IST date boundaries', async () => {
    const NativeDateTimeFormat = Intl.DateTimeFormat;
    const dateTimeFormatSpy = vi.spyOn(Intl, 'DateTimeFormat');
    dateTimeFormatSpy.mockImplementation((locale, options) => {
      if (options && typeof options === 'object' && options.timeZone === 'Asia/Kolkata') {
        return {
          format: () => '2026-04-15',
        } as Intl.DateTimeFormat;
      }
      return new NativeDateTimeFormat(locale, options);
    });

    mockApiGet.mockResolvedValue(mockSubscriptions);
    renderWithProviders(<MemberBillingPage />, { route: '/subscription' });

    await waitFor(() => {
      expect(screen.getByText('15 days left')).toBeInTheDocument();
    });

    dateTimeFormatSpy.mockRestore();
  });
});
