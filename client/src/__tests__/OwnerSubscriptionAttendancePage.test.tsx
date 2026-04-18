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
  it('renders the attendance workspace and preserves the member back link', async () => {
    renderWithProviders(<OwnerSubscriptionAttendancePage />, { route: '/members/2/subscriptions/1/attendance?view=today' });

    await waitFor(() => {
      expect(screen.getByText('Attendance dates')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /arrow_back Member/i })).toHaveAttribute('href', '/members/2?view=today');
      expect(screen.getByRole('button', { name: /mark complete/i })).toBeInTheDocument();
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

  it('keeps an audit list of marked dates below the calendar', async () => {
    renderWithProviders(<OwnerSubscriptionAttendancePage />, { route: '/members/2/subscriptions/1/attendance' });

    await waitFor(() => {
      expect(screen.getByText('Audit trail')).toBeInTheDocument();
      expect(screen.getByText('3 Apr 2026')).toBeInTheDocument();
      expect(screen.getByText('14 Apr 2026')).toBeInTheDocument();
    });
  });
});
