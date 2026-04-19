import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OwnerMembersPage from '../pages/owner/OwnerMembersPage.js';
import { renderWithProviders } from './test-utils.js';
import { mockMemberListItem, mockRenewalStartsOn } from './mocks.js';

const { mockApiGet } = vi.hoisted(() => ({ mockApiGet: vi.fn() }));

vi.mock('../context/AuthContext.js', () => ({
  useAuth: () => ({ logout: vi.fn(), user: { id: 1, role: 'owner', full_name: 'Sam Chen', email: 'owner@thebase.fit' }, loading: false }),
  AuthProvider: ({ children }: any) => children,
}));

vi.mock('../lib/api.js', async () => {
  const actual = await vi.importActual('../lib/api.js');
  return { ...actual, api: { get: mockApiGet, post: vi.fn(), patch: vi.fn() } };
});

function tabLabels(container: HTMLElement) {
  const dock = container.querySelector('.members-view-dock');
  if (!dock) return [];

  return Array.from(dock.querySelectorAll('button')).map((button) => {
    const iconText = button.querySelector('.material-symbols-outlined')?.textContent ?? '';
    return button.textContent?.replace(iconText, '').replace(/\s+/g, ' ').trim() ?? '';
  });
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
    expect(tabLabels(container)).toEqual([
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

  it('loads the all view by default', async () => {
    mockApiGet.mockResolvedValue([mockMemberListItem]);

    renderWithProviders(<OwnerMembersPage />, { route: '/members' });

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/api/members');
      expect(screen.getByRole('heading', { level: 3, name: 'All Active' })).toBeInTheDocument();
      expect(screen.getByText('Alex Kumar')).toBeInTheDocument();
      expect(screen.getByText('7 left')).toBeInTheDocument();
    });
  });

  it('loads a selected view from the URL and renders view-specific copy', async () => {
    mockApiGet.mockResolvedValue([
      {
        ...mockMemberListItem,
        active_subscription: null,
        renewal: mockRenewalStartsOn,
      },
    ]);

    renderWithProviders(<OwnerMembersPage />, { route: '/members?view=no-plan' });

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/api/members?view=no-plan');
      expect(screen.getByRole('heading', { level: 3, name: 'No Active Plan' })).toBeInTheDocument();
      expect(screen.getByText('Starts soon')).toBeInTheDocument();
      expect(screen.getByText('20 Apr')).toBeInTheDocument();
    });
  });

  it('switches to the today view from the bottom tabs', async () => {
    const user = userEvent.setup();
    mockApiGet.mockImplementation((url: string) => {
      if (url === '/api/members?view=today') {
        return Promise.resolve([{ ...mockMemberListItem, marked_attendance_today: true }]);
      }
      return Promise.resolve([mockMemberListItem]);
    });

    renderWithProviders(<OwnerMembersPage />, { route: '/members' });

    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith('/api/members'));
    await user.click(screen.getByRole('button', { name: /today/i }));

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/api/members?view=today');
      expect(screen.getByRole('heading', { level: 3, name: 'Marked Today' })).toBeInTheDocument();
      expect(screen.getAllByText('In today').length).toBeGreaterThan(0);
    });
  });

  it('renders archived members from the archived view', async () => {
    mockApiGet.mockResolvedValue([
      {
        ...mockMemberListItem,
        status: 'archived',
        active_subscription: null,
        consistency: null,
        renewal: null,
        consistency_risk_today: null,
      },
    ]);

    renderWithProviders(<OwnerMembersPage />, { route: '/members?view=archived' });

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/api/members?view=archived');
      expect(screen.getByRole('heading', { level: 3, name: 'Archived' })).toBeInTheDocument();
      expect(screen.getByText(/joined 7 april 2026/i)).toBeInTheDocument();
    });
  });
});
