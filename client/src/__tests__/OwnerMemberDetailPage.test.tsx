import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OwnerMemberDetailPage from '../pages/owner/OwnerMemberDetailPage.js';
import { renderWithProviders } from './test-utils.js';
import { mockMemberDetail, mockSubscriptions } from './mocks.js';

const { mockApiGet, mockApiPost, mockApiPatch } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
  mockApiPatch: vi.fn(),
}));

vi.mock('../context/AuthContext.js', () => ({
  useAuth: () => ({ logout: vi.fn(), user: { id: 1, role: 'owner', full_name: 'Sam Chen', email: 'owner@thebase.fit' }, loading: false }),
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

beforeEach(() => {
  vi.clearAllMocks();
  configurePageData();
});

describe('OwnerMemberDetailPage', () => {
  it('renders the member header and status strip', async () => {
    renderWithProviders(<OwnerMemberDetailPage />, { route: '/members/2' });

    await waitFor(() => {
      expect(screen.getByText('Alex Kumar')).toBeInTheDocument();
      expect(screen.getByText(/member@thebase.fit/)).toBeInTheDocument();
      expect(screen.getByText('Current state')).toBeInTheDocument();
      expect(screen.getByText('Consistent')).toBeInTheDocument();
    });
  });

  it('renders grouped subscription history and keeps attendance links', async () => {
    renderWithProviders(<OwnerMemberDetailPage />, { route: '/members/2' });

    await waitFor(() => {
      expect(screen.getByText('Active subscriptions')).toBeInTheDocument();
      expect(screen.getByText('Upcoming subscriptions')).toBeInTheDocument();
      expect(screen.getByText('Past subscriptions')).toBeInTheDocument();
      expect(screen.getAllByRole('link', { name: /attendance dates/i })[0]).toHaveAttribute(
        'href',
        '/members/2/subscriptions/1/attendance',
      );
    });
  });

  it('does not show the deprecated mark attendance button', async () => {
    renderWithProviders(<OwnerMemberDetailPage />, { route: '/members/2' });

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /mark attendance/i })).not.toBeInTheDocument();
    });
  });

  it('shows marked today metrics when attendance is already done', async () => {
    configurePageData({
      detail: {
        ...mockMemberDetail,
        marked_attendance_today: true,
      },
    });
    renderWithProviders(<OwnerMemberDetailPage />, { route: '/members/2' });

    await waitFor(() => {
      expect(screen.getByText('Marked today')).toBeInTheDocument();
      expect(screen.getByText('Yes')).toBeInTheDocument();
    });
  });

  it('shows blocked archive guidance with review links', async () => {
    renderWithProviders(<OwnerMemberDetailPage />, { route: '/members/2' });

    await waitFor(() => {
      expect(screen.getByText(/Complete active or upcoming subscriptions before archiving this member/i)).toBeInTheDocument();
      expect(screen.getAllByRole('link', { name: /review & complete/i })).toHaveLength(2);
      expect(screen.getByRole('button', { name: /archive member/i })).toBeDisabled();
    });
  });

  it('saves name and phone edits from inline profile rows', async () => {
    const user = userEvent.setup();
    mockApiPatch.mockResolvedValue({});

    renderWithProviders(<OwnerMemberDetailPage />, { route: '/members/2' });

    await waitFor(() => expect(screen.getByRole('button', { name: /edit name/i })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /edit name/i }));
    await user.clear(screen.getByLabelText(/^name$/i));
    await user.type(screen.getByLabelText(/^name$/i), 'A New Name');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(mockApiPatch).toHaveBeenCalledWith('/api/members/2', { full_name: 'A New Name' });

    await user.click(screen.getByRole('button', { name: /edit mobile number/i }));
    await user.clear(screen.getByLabelText(/mobile number/i));
    await user.type(screen.getByLabelText(/mobile number/i), '99999-99999');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(mockApiPatch).toHaveBeenCalledWith('/api/members/2', { phone: '9999999999' });
  });

  it('defaults the back link to the all members view and preserves selected view links', async () => {
    renderWithProviders(<OwnerMemberDetailPage />, { route: '/members/2?view=today' });

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /marked today$/i })).toHaveAttribute('href', '/members?view=today');
      expect(screen.getByRole('link', { name: /add subscription/i })).toHaveAttribute('href', '/members/2/subscriptions/new?view=today');
    });
  });

  it('returns archived members to the archived list and hides subscription creation', async () => {
    configurePageData({
      detail: {
        ...mockMemberDetail,
        status: 'archived',
        active_subscription: null,
        consistency: null,
        renewal: null,
        status_highlights: [
          {
            key: 'no_active_subscription',
            label: 'No active subscription',
            tone: 'neutral',
            detail: 'This member does not have an active subscription right now.',
          },
        ],
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
    renderWithProviders(<OwnerMemberDetailPage />, { route: '/members/2' });

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /archived members$/i })).toHaveAttribute('href', '/members?view=archived');
      expect(screen.getByRole('button', { name: /add subscription/i })).toBeDisabled();
      expect(screen.getByText(/Unarchive this member before adding a new subscription/i)).toBeInTheDocument();
    });
  });

  it('unarchives an archived member when confirmed', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockApiPost.mockResolvedValue({ ok: true });
    configurePageData({
      detail: {
        ...mockMemberDetail,
        status: 'archived',
        active_subscription: null,
        consistency: null,
        renewal: null,
        status_highlights: [
          {
            key: 'no_active_subscription',
            label: 'No active subscription',
            tone: 'neutral',
            detail: 'This member does not have an active subscription right now.',
          },
        ],
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

  it('shows an explicit empty state when no subscriptions exist', async () => {
    configurePageData({ subscriptions: [] });
    renderWithProviders(<OwnerMemberDetailPage />, { route: '/members/2' });

    await waitFor(() => {
      expect(screen.getByText('No subscriptions yet.')).toBeInTheDocument();
    });
  });
});
