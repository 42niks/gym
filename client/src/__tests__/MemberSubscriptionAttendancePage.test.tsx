import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import MemberSubscriptionAttendancePage, {
  getIncomingFocusAlpha,
} from '../pages/member/MemberSubscriptionAttendancePage.js';
import { renderWithProviders } from './test-utils.js';
import { mockMemberSubscriptionAttendance } from './mocks.js';

const { mockApiGet } = vi.hoisted(() => ({ mockApiGet: vi.fn() }));

vi.mock('../context/AuthContext.js', () => ({
  useAuth: () => ({
    logout: vi.fn(),
    user: { id: 2, role: 'member', full_name: 'Alex Kumar', email: 'member@thebase.fit' },
    loading: false,
  }),
  AuthProvider: ({ children }: any) => children,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useParams: () => ({ id: '1' }) };
});

vi.mock('../lib/api.js', async () => {
  const actual = await vi.importActual('../lib/api.js');
  return { ...actual, api: { get: mockApiGet, post: vi.fn(), patch: vi.fn() } };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MemberSubscriptionAttendancePage', () => {
  it('renders the attendance page heading and subscription details', async () => {
    mockApiGet.mockResolvedValue(mockMemberSubscriptionAttendance);
    renderWithProviders(<MemberSubscriptionAttendancePage />, { route: '/subscription/1/attendance' });

    await waitFor(() => {
      expect(screen.getByText('Attendance dates')).toBeInTheDocument();
      expect(screen.getByText('1:1 Personal Training')).toBeInTheDocument();
      expect(screen.getByText('Period')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Consistency rule')).toBeInTheDocument();
      expect(screen.getByText('3 out of 7 days')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Previous month' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled();
    });
  });

  it('shows weekdays starting with sunday', async () => {
    mockApiGet.mockResolvedValue(mockMemberSubscriptionAttendance);
    renderWithProviders(<MemberSubscriptionAttendancePage />, { route: '/subscription/1/attendance' });

    await waitFor(() => {
      const headers = screen.getAllByRole('columnheader').map(node => node.textContent);
      expect(headers).toEqual(['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']);
    });
  });

  it('highlights attended days and keeps a back link to subscription', async () => {
    mockApiGet.mockResolvedValue(mockMemberSubscriptionAttendance);
    renderWithProviders(<MemberSubscriptionAttendancePage />, { route: '/subscription/1/attendance' });

    await waitFor(() => {
      expect(screen.getByLabelText('Attended on 3 Apr 2026')).toBeInTheDocument();
      expect(screen.getByLabelText('Attended on 7 Apr 2026')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /arrow_back Subscription/i })).toHaveAttribute('href', '/subscription');
    });
  });

  it('shows an explicit fallback state for invalid subscription date ranges', async () => {
    mockApiGet.mockResolvedValue({
      ...mockMemberSubscriptionAttendance,
      subscription: {
        ...mockMemberSubscriptionAttendance.subscription,
        start_date: '2026-04-30',
        end_date: '2026-04-01',
      },
    });
    renderWithProviders(<MemberSubscriptionAttendancePage />, { route: '/subscription/1/attendance' });

    await waitFor(() => {
      expect(
        screen.getByText('Attendance calendar dates are invalid for this subscription.'),
      ).toBeInTheDocument();
    });
  });

  it('uses read-line transition math for incoming month alpha', () => {
    const viewportHeight = 500;
    const readLine = viewportHeight * 0.3;
    const zoneHeight = viewportHeight * 0.2;
    const zoneTop = readLine - zoneHeight / 2;
    const zoneBottom = readLine + zoneHeight / 2;

    expect(getIncomingFocusAlpha(zoneBottom + 1, viewportHeight)).toBe(0);
    expect(getIncomingFocusAlpha(zoneTop - 1, viewportHeight)).toBe(1);
    expect(getIncomingFocusAlpha(readLine, viewportHeight)).toBeCloseTo(0.5, 6);
  });

  it('renders consistency ribbon when consistency window is present', async () => {
    mockApiGet.mockResolvedValue({
      ...mockMemberSubscriptionAttendance,
      consistency_window: {
        start_date: '2026-04-03',
        end_date: '2026-04-14',
        streak_days: 12,
      },
    });
    renderWithProviders(<MemberSubscriptionAttendancePage />, { route: '/subscription/1/attendance' });

    await waitFor(() => {
      expect(screen.getAllByTestId('consistency-row-highlight').length).toBeGreaterThan(0);
    });
  });
});
