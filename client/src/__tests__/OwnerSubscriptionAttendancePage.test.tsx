import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OwnerSubscriptionAttendancePage from '../pages/owner/OwnerSubscriptionAttendancePage.js';
import { renderWithProviders } from './test-utils.js';
import { mockMemberSubscriptionAttendance } from './mocks.js';

const { mockApiGet, mockApiPost, mockApiDelete } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
  mockApiDelete: vi.fn(),
}));

vi.mock('../context/AuthContext.js', () => ({
  useAuth: () => ({
    logout: vi.fn(),
    user: { id: 1, role: 'owner', full_name: 'Sam Chen', email: 'owner@thebase.fit' },
    loading: false,
  }),
  AuthProvider: ({ children }: any) => children,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useParams: () => ({ id: '2', subscriptionId: '1' }) };
});

vi.mock('../lib/api.js', async () => {
  const actual = await vi.importActual('../lib/api.js');
  return { ...actual, api: { get: mockApiGet, post: mockApiPost, delete: mockApiDelete, patch: vi.fn() } };
});

beforeEach(() => {
  vi.clearAllMocks();
  mockApiGet.mockResolvedValue(mockMemberSubscriptionAttendance);
});

describe('OwnerSubscriptionAttendancePage', () => {
  it('renders the attendance workspace without an in-page back link', async () => {
    renderWithProviders(<OwnerSubscriptionAttendancePage />, { route: '/members/2/subscriptions/1/attendance?view=today' });

    await waitFor(() => {
      expect(screen.getByText('Attendance dates')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /member profile/i })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /terminate subscription/i })).toBeInTheDocument();
    });
  });

  it('adds an attendance date directly from the calendar', async () => {
    const user = userEvent.setup();
    mockApiPost.mockResolvedValue({ ok: true });
    renderWithProviders(<OwnerSubscriptionAttendancePage />, { route: '/members/2/subscriptions/1/attendance' });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add attendance for 1 apr 2026/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /add attendance for 1 apr 2026/i }));

    expect(mockApiPost).toHaveBeenCalledWith('/api/members/2/subscriptions/1/attendance', { date: '2026-04-01' });
  });

  it('removes an attended date from the calendar', async () => {
    const user = userEvent.setup();
    mockApiDelete.mockResolvedValue({ ok: true });
    renderWithProviders(<OwnerSubscriptionAttendancePage />, { route: '/members/2/subscriptions/1/attendance' });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /remove attendance for 3 apr 2026/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /remove attendance for 3 apr 2026/i }));

    expect(mockApiDelete).toHaveBeenCalledWith('/api/members/2/subscriptions/1/attendance/2026-04-03');
  });

  it('renders the subscription summary above the calendar', async () => {
    renderWithProviders(<OwnerSubscriptionAttendancePage />, { route: '/members/2/subscriptions/1/attendance' });

    await waitFor(() => {
      expect(screen.getByText('1:1 Personal Training')).toBeInTheDocument();
      expect(screen.getByText('3 out of 7 days')).toBeInTheDocument();
      expect(screen.getByText('5 / 12')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /remove attendance for 3 apr 2026/i })).toBeInTheDocument();
    });
  });

  it('shows a graceful fallback when the subscription dates are invalid', async () => {
    mockApiGet.mockResolvedValue({
      ...mockMemberSubscriptionAttendance,
      subscription: {
        ...mockMemberSubscriptionAttendance.subscription,
        service_type: '',
        start_date: 'bad-date',
        end_date: 'also-bad',
        lifecycle_state: 'broken',
        attended_sessions: Number.NaN,
        total_sessions: Number.NaN,
      },
      consistency_rule: {
        min_days: Number.NaN,
        window_days: Number.NaN,
      },
      attended_dates: null,
    });

    renderWithProviders(<OwnerSubscriptionAttendancePage />, { route: '/members/2/subscriptions/1/attendance' });

    await waitFor(() => {
      expect(screen.getByText('Attendance calendar dates are invalid for this subscription.')).toBeInTheDocument();
      expect(screen.getByText('Subscription')).toBeInTheDocument();
      expect(screen.getByText('Unavailable - Unavailable')).toBeInTheDocument();
      expect(screen.getByText('Unknown')).toBeInTheDocument();
      expect(screen.getByText('Unavailable')).toBeInTheDocument();
      expect(screen.getByText('0 / 0')).toBeInTheDocument();
    });
  });
});
