import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OwnerMemberDetailPage from '../pages/owner/OwnerMemberDetailPage.js';
import { renderWithProviders } from './test-utils.js';
import {
  mockCompletedSubscription,
  mockMemberDetail,
  mockSubscription,
  mockSubscriptions,
  mockUpcomingSubscription,
} from './mocks.js';

const { mockApiGet, mockApiPost, mockApiPatch } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
  mockApiPatch: vi.fn(),
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
  return { ...actual, useParams: () => ({ id: '2' }), useNavigate: () => vi.fn() };
});

vi.mock('../lib/api.js', async () => {
  const actual = await vi.importActual('../lib/api.js');
  return { ...actual, api: { get: mockApiGet, post: mockApiPost, patch: mockApiPatch } };
});

function configurePageData({
  detail = mockMemberDetail,
  subscriptions = mockSubscriptions,
}: {
  detail?: any;
  subscriptions?: any[];
} = {}) {
  mockApiGet.mockImplementation((url: string) => {
    if (url === '/api/members/2') return Promise.resolve(detail);
    if (url === '/api/members/2/subscriptions') return Promise.resolve(subscriptions);
    return Promise.reject(new Error(`Unexpected GET ${url}`));
  });
}

function expectBefore(left: HTMLElement, right: HTMLElement) {
  expect(left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
}

beforeEach(() => {
  vi.clearAllMocks();
  configurePageData();
});

describe('OwnerMemberDetailPage', () => {
  it('renders the redesigned sections and billing order', async () => {
    renderWithProviders(<OwnerMemberDetailPage />, { route: '/members/2' });

    await waitFor(() => {
      expect(screen.getByText('BIO')).toBeInTheDocument();
      expect(screen.getByText('OVERVIEW')).toBeInTheDocument();
      expect(screen.getByText('BILLING')).toBeInTheDocument();
    });

    expect(screen.getByText('Alex Kumar')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE SUBSCRIPTION')).toBeInTheDocument();
    expect(screen.getByText('Upcoming subscriptions')).toBeInTheDocument();
    expect(screen.getByText('Past subscriptions')).toBeInTheDocument();
    expect(screen.getByText(/^Starts in \d+d$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Ended \d+d ago$/i)).toBeInTheDocument();
    expect(screen.getByText(/^\d+d left$/i)).toBeInTheDocument();
    expect(screen.getByText('7 left')).toBeInTheDocument();

    expectBefore(screen.getByText('ACTIVE SUBSCRIPTION'), screen.getByText('Upcoming subscriptions'));
    expectBefore(screen.getByText('Upcoming subscriptions'), screen.getByText('Past subscriptions'));
  });

  it('uses the shared status pill palette in the overview cards', async () => {
    renderWithProviders(<OwnerMemberDetailPage />, { route: '/members/2' });

    const activePill = await screen.findByText('Active');
    expect(activePill.parentElement).toHaveClass('bg-energy-100/55');
    expect(activePill.parentElement).toHaveClass('text-energy-500');

    const consistentDaysSurface = screen.getByText('14 Days').closest('.member-status-pill-consistent-surface');
    expect(consistentDaysSurface).not.toBeNull();
    expect(consistentDaysSurface?.parentElement).toHaveClass('member-status-pill-consistent-frame');
  });

  it('keeps complete before attendance in the active subscription card', async () => {
    renderWithProviders(<OwnerMemberDetailPage />, { route: '/members/2' });

    const activeSection = await screen.findByText('ACTIVE SUBSCRIPTION');
    const activeCard = activeSection.closest('.glass-panel');
    expect(activeCard).not.toBeNull();

    const completeButton = within(activeCard as HTMLElement).getByRole('button', { name: /complete/i });
    const attendanceButton = within(activeCard as HTMLElement).getByRole('button', { name: /attendance/i });
    expectBefore(completeButton, attendanceButton);
  });

  it('shows inline validation errors inside the edited bio rows', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OwnerMemberDetailPage />, { route: '/members/2' });

    await waitFor(() => expect(screen.getByRole('button', { name: /edit name/i })).toBeInTheDocument());

    const bioCard = screen.getByText('Name').closest('.surface-inset');
    expect(bioCard).not.toBeNull();

    await user.click(screen.getByRole('button', { name: /edit name/i }));
    await user.clear(screen.getByLabelText(/^name$/i));
    await user.click(screen.getByRole('button', { name: /^save$/i }));
    expect(within(bioCard as HTMLElement).getByText('Name is required')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /more/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /edit mobile/i })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /edit mobile/i }));
    await user.clear(screen.getByLabelText(/^mobile$/i));
    await user.type(screen.getByLabelText(/^mobile$/i), '123');
    await user.click(screen.getByRole('button', { name: /^save$/i }));
    expect(within(bioCard as HTMLElement).getByText('Phone must be exactly 10 digits')).toBeInTheDocument();
  });

  it('renders the empty active card with an add link and preserved view query', async () => {
    configurePageData({
      detail: {
        ...mockMemberDetail,
        active_subscription: null,
      },
      subscriptions: [],
    });

    renderWithProviders(<OwnerMemberDetailPage />, { route: '/members/2?view=today' });

    let activeCard: HTMLElement | null = null;
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /marked today$/i })).toHaveAttribute('href', '/members?view=today');
      expect(screen.getByText('This member has no subscription active for today')).toBeInTheDocument();
      activeCard = screen.getByText('ACTIVE SUBSCRIPTION').closest('.glass-panel');
      expect(activeCard).not.toBeNull();
      expect(within(activeCard as HTMLElement).getByRole('button', { name: /add subscription/i })).toBeInTheDocument();
      expect(within(activeCard as HTMLElement).getByRole('link')).toHaveAttribute('href', '/members/2/subscriptions/new?view=today');
    });
  });

  it('disables the empty active card CTA when the member cannot add subscriptions', async () => {
    configurePageData({
      detail: {
        ...mockMemberDetail,
        status: 'archived',
        active_subscription: null,
        can_add_subscription: false,
        archive_action: {
          kind: 'unarchive',
          allowed: true,
          reason: null,
          blocked_by: [],
        },
      },
      subscriptions: [],
    });

    renderWithProviders(<OwnerMemberDetailPage />, { route: '/members/2' });

    let activeCard: HTMLElement | null = null;
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /archived members$/i })).toHaveAttribute('href', '/members?view=archived');
      activeCard = screen.getByText('ACTIVE SUBSCRIPTION').closest('.glass-panel');
      expect(activeCard).not.toBeNull();
      expect(within(activeCard as HTMLElement).getByRole('button', { name: /unarchive to add subscription/i })).toBeDisabled();
      expect(within(activeCard as HTMLElement).queryByRole('link')).not.toBeInTheDocument();
    });
  });

  it('sorts upcoming by start date and past by end date regardless of API order', async () => {
    configurePageData({
      subscriptions: [
        { ...mockUpcomingSubscription, id: 31, service_type: 'Zulu Upcoming', start_date: '2026-06-01', end_date: '2026-06-30' },
        { ...mockCompletedSubscription, id: 41, service_type: 'Older Past', start_date: '2026-02-01', end_date: '2026-02-28' },
        mockSubscription,
        { ...mockUpcomingSubscription, id: 32, service_type: 'Alpha Upcoming', start_date: '2026-05-01', end_date: '2026-05-31' },
        { ...mockCompletedSubscription, id: 42, service_type: 'Recent Past', start_date: '2026-03-01', end_date: '2026-03-31' },
      ],
    });

    renderWithProviders(<OwnerMemberDetailPage />, { route: '/members/2' });

    const alphaUpcoming = await screen.findByText('Alpha Upcoming');
    const zuluUpcoming = screen.getByText('Zulu Upcoming');
    const recentPast = screen.getByText('Recent Past');
    const olderPast = screen.getByText('Older Past');

    expectBefore(alphaUpcoming, zuluUpcoming);
    expectBefore(recentPast, olderPast);
  });

  it('does not render deprecated status highlight cards even if the API sends them', async () => {
    configurePageData({
      detail: {
        ...mockMemberDetail,
        renewal: { kind: 'ends_soon', message: 'Your subscription ends soon, please renew.' },
        status_highlights: [
          {
            key: 'upcoming_renewal',
            label: 'Upcoming renewal',
            tone: 'warning',
            detail: 'Your subscription ends soon, please renew.',
          },
          {
            key: 'consistency_building',
            label: 'Consistency building',
            tone: 'info',
            detail: 'You are building your consistency, keep it up!',
          },
        ],
      },
    });

    renderWithProviders(<OwnerMemberDetailPage />, { route: '/members/2' });

    await waitFor(() => {
      expect(screen.getByText('Renewal')).toBeInTheDocument();
      expect(screen.queryByText('Upcoming renewal')).not.toBeInTheDocument();
      expect(screen.queryByText('Consistency building')).not.toBeInTheDocument();
    });
  });

  it('handles malformed subscription data without crashing and falls back safely', async () => {
    configurePageData({
      detail: {
        ...mockMemberDetail,
        active_subscription: {
          ...mockSubscription,
          service_type: '',
          start_date: 'not-a-date',
          end_date: 'also-bad',
          total_sessions: -8,
          attended_sessions: 99,
          remaining_sessions: -12,
          amount: Number.NaN,
        },
      },
      subscriptions: [
        {
          ...mockSubscription,
          service_type: '',
          start_date: 'not-a-date',
          end_date: 'also-bad',
          total_sessions: -8,
          attended_sessions: 99,
          remaining_sessions: -12,
          amount: Number.NaN,
        },
      ],
    });

    renderWithProviders(<OwnerMemberDetailPage />, { route: '/members/2' });

    await waitFor(() => {
      expect(screen.getByText('Untitled package')).toBeInTheDocument();
      expect(screen.getByText('₹0')).toBeInTheDocument();
      expect(screen.getByText('not-a-date - also-bad')).toBeInTheDocument();
      expect(screen.getByText('0 of 0 used')).toBeInTheDocument();
    });
  });

  it('shows archive blockers and unarchives when confirmed', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockApiPost.mockResolvedValue({ ok: true });

    configurePageData({
      detail: {
        ...mockMemberDetail,
        status: 'archived',
        active_subscription: null,
        archive_action: {
          kind: 'unarchive',
          allowed: true,
          reason: null,
          blocked_by: [],
        },
        can_add_subscription: false,
      },
      subscriptions: [],
    });

    const user = userEvent.setup();
    renderWithProviders(<OwnerMemberDetailPage />, { route: '/members/2' });

    await waitFor(() => expect(screen.getByRole('button', { name: /unarchive member/i })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /unarchive member/i }));

    expect(mockApiPost).toHaveBeenCalledWith('/api/members/2/unarchive');
    confirmSpy.mockRestore();
  });
});
