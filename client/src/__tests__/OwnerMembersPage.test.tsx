import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OwnerMembersPage from '../pages/owner/OwnerMembersPage.js';
import { renderWithProviders } from './test-utils.js';
import { mockMemberListItem, mockRenewalEndsSoon, mockRenewalStartsOn } from './mocks.js';

const { mockApiGet } = vi.hoisted(() => ({ mockApiGet: vi.fn() }));

vi.mock('../context/AuthContext.js', () => ({
  useAuth: () => ({ logout: vi.fn(), user: { id: 1, role: 'owner', full_name: 'Sam Chen', email: 'owner@thebase.fit' }, loading: false }),
  AuthProvider: ({ children }: any) => children,
}));

vi.mock('../lib/api.js', async () => {
  const actual = await vi.importActual('../lib/api.js');
  return { ...actual, api: { get: mockApiGet, post: vi.fn(), patch: vi.fn() } };
});

function dockButtonLabels(container: HTMLElement) {
  const dock = container.querySelector('.members-view-dock');
  if (!dock) return [];

  return Array.from(dock.querySelectorAll('button')).map((button) => {
    const iconText = button.querySelector('.material-symbols-outlined')?.textContent ?? '';
    return button.textContent
      ?.replace(iconText, '')
      .replace(/\s+/g, ' ')
      .replace(/([A-Za-z])(\d+)$/, '$1 $2')
      .trim() ?? '';
  });
}

function createMember(name: string, overrides: Record<string, unknown> = {}) {
  return {
    ...mockMemberListItem,
    id: Math.floor(Math.random() * 10000) + 1,
    full_name: name,
    ...overrides,
  };
}

function configureMemberListResponses(
  overrides: Partial<Record<string, any[]>> = {},
) {
  const responses: Record<string, any[]> = {
    '/api/members': [
      createMember('Alex Kumar'),
    ],
    '/api/members?view=no-plan': [
      createMember('Bianca Shah', {
        active_subscription: null,
        renewal: mockRenewalStartsOn,
        owner_consistency_state: { stage: 'not_consistent', days: 0, at_risk: false },
      }),
    ],
    '/api/members?view=renewal': [
      createMember('Cyrus Nair', {
        renewal: mockRenewalEndsSoon,
      }),
    ],
    '/api/members?view=at-risk': [
      createMember('Diya Arora', {
        consistency_risk_today: { streak_days: 6, message: 'Attend today to keep the streak alive.' },
        owner_consistency_state: { stage: 'building', days: 6, at_risk: true },
      }),
      createMember('Ira Mehta', {
        consistency: { status: 'consistent', days: 12, message: 'Consistent for 12 days' },
        consistency_risk_today: { streak_days: 12, message: 'Attend today to protect the 12-day streak.' },
        owner_consistency_state: { stage: 'consistent', days: 12, at_risk: true },
      }),
    ],
    '/api/members?view=not-consistent': [
      createMember('Naina Paul', {
        consistency: { status: 'building', message: 'Consistency slipped recently.' },
        consistency_risk_today: null,
        owner_consistency_state: { stage: 'not_consistent', days: null, at_risk: false },
      }),
    ],
    '/api/members?view=building': [
      createMember('Eshan Roy', {
        consistency: { status: 'building', days: 3, message: 'Still building consistency.' },
        owner_consistency_state: { stage: 'building', days: 3, at_risk: false },
      }),
    ],
    '/api/members?view=consistent': [
      createMember('Farah Ali', {
        owner_consistency_state: { stage: 'consistent', days: 11, at_risk: false },
      }),
    ],
    '/api/members?view=today': [
      createMember('Gia Sen', {
        marked_attendance_today: true,
        owner_consistency_state: { stage: 'building', days: 5, at_risk: false },
      }),
    ],
    '/api/members?view=archived': [
      createMember('Hari Iyer', {
        status: 'archived',
        archived_at: '2026-04-10',
        active_subscription: null,
        consistency: null,
        renewal: null,
        consistency_risk_today: null,
      }),
    ],
    ...overrides,
  };

  const endpointForView = (view: string) => view === 'all' ? '/api/members' : `/api/members?view=${view}`;
  const overviewEndpointForView = (view: string) => view === 'all' ? '/api/members/overview' : `/api/members/overview?view=${view}`;
  const counts = Object.fromEntries(
    ['all', 'no-plan', 'renewal', 'at-risk', 'not-consistent', 'building', 'consistent', 'today', 'archived']
      .map((view) => [view, responses[endpointForView(view)]?.length ?? 0]),
  );

  mockApiGet.mockImplementation((url: string) => {
    for (const view of Object.keys(counts)) {
      if (url === overviewEndpointForView(view)) {
        return Promise.resolve({
          view,
          counts,
          members: responses[endpointForView(view)] ?? [],
        });
      }
    }
    if (url in responses) return Promise.resolve(responses[url]);
    return Promise.reject(new Error(`Unexpected GET ${url}`));
  });

  return responses;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('OwnerMembersPage', () => {
  it('renders the members heading, new link, and bottom tab order', () => {
    mockApiGet.mockReturnValue(new Promise(() => {}));
    const { container } = renderWithProviders(<OwnerMembersPage />, { route: '/members' });

    expect(screen.getByRole('heading', { name: 'MEMBERS' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /new/i })).toHaveAttribute('href', '/members/new');
    expect(dockButtonLabels(container)).toEqual([
      'All',
      'No plan',
      'Renewal',
      'At risk',
      'Not consistent',
      'Building',
      'Consistent',
      'Today',
      'Archived',
    ]);
  });

  it('loads the all view by default with the redesigned member card', async () => {
    configureMemberListResponses();

    renderWithProviders(<OwnerMembersPage />, { route: '/members' });

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/api/members/overview');
      expect(screen.getByRole('heading', { level: 3, name: 'All Active' })).toBeInTheDocument();
    });

    const memberName = await screen.findByText('Alex Kumar');
    const memberCard = memberName.closest('a');
    expect(memberCard).not.toBeNull();
    expect(within(memberCard as HTMLElement).getByText('Alex Kumar')).toBeInTheDocument();
    expect(within(memberCard as HTMLElement).getByText('Consistent')).toBeInTheDocument();
    expect(within(memberCard as HTMLElement).getByText('Not In Today')).toBeInTheDocument();
    expect(within(memberCard as HTMLElement).getByText('Active')).toBeInTheDocument();
    expect(screen.queryByText('member@thebase.fit')).not.toBeInTheDocument();
    expect(screen.queryByText('7 left')).not.toBeInTheDocument();
  });

  it('loads a selected view from the URL and keeps the same card model', async () => {
    configureMemberListResponses();

    renderWithProviders(<OwnerMembersPage />, { route: '/members?view=no-plan' });

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/api/members/overview?view=no-plan');
      expect(screen.getByRole('heading', { level: 3, name: 'No Active Plan' })).toBeInTheDocument();
    });

    const memberName = await screen.findByText('Bianca Shah');
    const memberCard = memberName.closest('a');
    expect(memberCard).not.toBeNull();
    expect(within(memberCard as HTMLElement).getByText('Bianca Shah')).toBeInTheDocument();
    expect(within(memberCard as HTMLElement).getByText('No Plan')).toBeInTheDocument();
    expect(screen.queryByText('Starts soon')).not.toBeInTheDocument();
    expect(screen.queryByText('20 Apr')).not.toBeInTheDocument();
  });

  it('loads the not consistent view from the URL without collapsing it into building', async () => {
    configureMemberListResponses();

    renderWithProviders(<OwnerMembersPage />, { route: '/members?view=not-consistent' });

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/api/members/overview?view=not-consistent');
      expect(screen.getByRole('heading', { level: 3, name: 'Not Consistent' })).toBeInTheDocument();
    });

    const memberName = await screen.findByText('Naina Paul');
    const memberCard = memberName.closest('a');
    expect(memberCard).not.toBeNull();
    expect(within(memberCard as HTMLElement).getByText('Not Consistent')).toBeInTheDocument();
    expect(within(memberCard as HTMLElement).queryByText('Building')).not.toBeInTheDocument();
  });

  it('switches to the today view from the bottom tabs', async () => {
    const user = userEvent.setup();
    configureMemberListResponses();

    renderWithProviders(<OwnerMembersPage />, { route: '/members' });

    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith('/api/members/overview'));
    await user.click(screen.getByRole('button', { name: /today/i }));

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/api/members/overview?view=today');
      expect(screen.getByRole('heading', { level: 3, name: 'Marked Today' })).toBeInTheDocument();
    });

    expect(screen.getByText('In Today')).toBeInTheDocument();
  });

  it('renders at-risk members from both building and consistent owner states', async () => {
    const user = userEvent.setup();
    configureMemberListResponses();

    renderWithProviders(<OwnerMembersPage />, { route: '/members' });

    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith('/api/members/overview'));
    await user.click(screen.getByRole('button', { name: /at risk/i }));

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/api/members/overview?view=at-risk');
      expect(screen.getByRole('heading', { level: 3, name: 'Consistency At Risk' })).toBeInTheDocument();
    });

    expect(screen.getByText('Diya Arora')).toBeInTheDocument();
    expect(screen.getByText('Ira Mehta')).toBeInTheDocument();
    expect(screen.getAllByText('At Risk').length).toBeGreaterThan(0);
  });

  it('shows counts in the active view header and the dock tabs', async () => {
    configureMemberListResponses({
      '/api/members': [createMember('Alex Kumar'), createMember('Brin Das')],
      '/api/members?view=no-plan': [createMember('Casey Noor', { active_subscription: null })],
      '/api/members?view=renewal': [createMember('Div Patel', { renewal: mockRenewalEndsSoon }), createMember('Ena Gill', { renewal: mockRenewalEndsSoon }), createMember('Fahim Ali', { renewal: mockRenewalEndsSoon })],
      '/api/members?view=at-risk': [createMember('Gita Sen')],
      '/api/members?view=not-consistent': [createMember('Hema Noor', { owner_consistency_state: { stage: 'not_consistent', days: null, at_risk: false } })],
      '/api/members?view=building': [createMember('Hari Iyer')],
      '/api/members?view=consistent': [createMember('Ishaan Rao'), createMember('Jiya Khan')],
      '/api/members?view=today': [createMember('Kabir Jain')],
      '/api/members?view=archived': [createMember('Lina Dutt', { status: 'archived' })],
    });

    const { container } = renderWithProviders(<OwnerMembersPage />, { route: '/members?view=renewal' });

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 3, name: 'Upcoming Renewal' })).toBeInTheDocument();
      expect(dockButtonLabels(container)).toEqual([
        'All 2',
        'No plan 1',
        'Renewal 3',
        'At risk 1',
        'Not consistent 1',
        'Building 1',
        'Consistent 2',
        'Today 1',
        'Archived 1',
      ]);
    });

    const headingRow = screen.getByRole('heading', { level: 3, name: 'Upcoming Renewal' }).parentElement;
    expect(headingRow).not.toBeNull();
    expect(within(headingRow as HTMLElement).getByText('3')).toBeInTheDocument();
  });

  it('renders counts from the single overview response', async () => {
    configureMemberListResponses();

    const { container } = renderWithProviders(<OwnerMembersPage />, { route: '/members' });

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 3, name: 'All Active' })).toBeInTheDocument();
      expect(dockButtonLabels(container)).toContain('All 1');
    });

    expect(dockButtonLabels(container)).toContain('Renewal 1');
  });

  it('renders archived members from the archived view', async () => {
    configureMemberListResponses();

    renderWithProviders(<OwnerMembersPage />, { route: '/members?view=archived' });

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/api/members/overview?view=archived');
      expect(screen.getByRole('heading', { level: 3, name: 'Archived' })).toBeInTheDocument();
      expect(screen.getByText('Hari Iyer')).toBeInTheDocument();
      expect(screen.getByText('Archived 10 Apr 2026')).toBeInTheDocument();
    });

    expect(screen.queryByText('member@thebase.fit')).not.toBeInTheDocument();
  });
});
