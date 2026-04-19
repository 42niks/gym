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
        active_subscription: null,
        consistency: null,
        renewal: null,
        consistency_risk_today: null,
      }),
    ],
    ...overrides,
  };

  mockApiGet.mockImplementation((url: string) => {
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
      expect(mockApiGet).toHaveBeenCalledWith('/api/members');
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
      expect(mockApiGet).toHaveBeenCalledWith('/api/members?view=no-plan');
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

  it('switches to the today view from the bottom tabs', async () => {
    const user = userEvent.setup();
    configureMemberListResponses();

    renderWithProviders(<OwnerMembersPage />, { route: '/members' });

    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith('/api/members'));
    await user.click(screen.getByRole('button', { name: /today/i }));

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/api/members?view=today');
      expect(screen.getByRole('heading', { level: 3, name: 'Marked Today' })).toBeInTheDocument();
    });

    expect(screen.getByText('In Today')).toBeInTheDocument();
  });

  it('shows counts in the active view header and the dock tabs', async () => {
    configureMemberListResponses({
      '/api/members': [createMember('Alex Kumar'), createMember('Brin Das')],
      '/api/members?view=no-plan': [createMember('Casey Noor', { active_subscription: null })],
      '/api/members?view=renewal': [createMember('Div Patel', { renewal: mockRenewalEndsSoon }), createMember('Ena Gill', { renewal: mockRenewalEndsSoon }), createMember('Fahim Ali', { renewal: mockRenewalEndsSoon })],
      '/api/members?view=at-risk': [createMember('Gita Sen')],
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

  it('fails soft when one tab count request errors', async () => {
    const responses = configureMemberListResponses();
    mockApiGet.mockImplementation((url: string) => {
      if (url === '/api/members?view=renewal') {
        return Promise.reject(new Error('boom'));
      }
      if (url in responses) return Promise.resolve(responses[url]);
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });

    const { container } = renderWithProviders(<OwnerMembersPage />, { route: '/members' });

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 3, name: 'All Active' })).toBeInTheDocument();
      expect(dockButtonLabels(container)).toContain('All 1');
    });

    expect(dockButtonLabels(container)).toContain('Renewal');
  });

  it('renders archived members from the archived view', async () => {
    configureMemberListResponses();

    renderWithProviders(<OwnerMembersPage />, { route: '/members?view=archived' });

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/api/members?view=archived');
      expect(screen.getByRole('heading', { level: 3, name: 'Archived' })).toBeInTheDocument();
      expect(screen.getByText(/joined 7 april 2026/i)).toBeInTheDocument();
    });
  });
});
