import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import MemberSubscriptionAttendancePage from '../pages/member/MemberSubscriptionAttendancePage.js';
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
      expect(screen.getByText('Check-ins')).toBeInTheDocument();
      expect(screen.getByText('active')).toBeInTheDocument();
    });
  });

  it('shows weekdays starting with sunday', async () => {
    mockApiGet.mockResolvedValue(mockMemberSubscriptionAttendance);
    renderWithProviders(<MemberSubscriptionAttendancePage />, { route: '/subscription/1/attendance' });

    await waitFor(() => {
      const headers = screen.getAllByRole('columnheader').map(node => node.textContent);
      expect(headers.slice(0, 7)).toEqual(['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']);
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
});
