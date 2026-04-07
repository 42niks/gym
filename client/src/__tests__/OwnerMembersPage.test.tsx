import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OwnerMembersPage from '../pages/owner/OwnerMembersPage.js';
import { renderWithProviders } from './test-utils.js';
import { mockMemberListItem } from './mocks.js';

const { mockApiGet } = vi.hoisted(() => ({ mockApiGet: vi.fn() }));

vi.mock('../context/AuthContext.js', () => ({
  useAuth: () => ({ logout: vi.fn(), user: { id: 1, role: 'owner', full_name: 'Sam Chen', email: 'owner@thebase.fit' }, loading: false }),
  AuthProvider: ({ children }: any) => children,
}));

vi.mock('../lib/api.js', async () => {
  const actual = await vi.importActual('../lib/api.js');
  return { ...actual, api: { get: mockApiGet, post: vi.fn(), patch: vi.fn() } };
});

beforeEach(() => { vi.clearAllMocks(); });

describe('OwnerMembersPage', () => {
  it('renders members heading with new button', () => {
    mockApiGet.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<OwnerMembersPage />, { route: '/owner/members' });
    expect(screen.getByRole('heading', { name: 'Members' })).toBeInTheDocument();
    expect(screen.getByText('+ New')).toBeInTheDocument();
  });

  it('shows active/archived toggle', () => {
    mockApiGet.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<OwnerMembersPage />, { route: '/owner/members' });
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Archived')).toBeInTheDocument();
  });

  it('renders member list', async () => {
    mockApiGet.mockResolvedValue([mockMemberListItem]);
    renderWithProviders(<OwnerMembersPage />, { route: '/owner/members' });
    await waitFor(() => {
      expect(screen.getByText('Alex Kumar')).toBeInTheDocument();
      expect(screen.getByText('member@thebase.fit')).toBeInTheDocument();
    });
  });

  it('shows remaining sessions for members with active subscription', async () => {
    mockApiGet.mockResolvedValue([mockMemberListItem]);
    renderWithProviders(<OwnerMembersPage />, { route: '/owner/members' });
    await waitFor(() => { expect(screen.getByText('7 left')).toBeInTheDocument(); });
  });

  it('shows no members found when list is empty', async () => {
    mockApiGet.mockResolvedValue([]);
    renderWithProviders(<OwnerMembersPage />, { route: '/owner/members' });
    await waitFor(() => { expect(screen.getByText('No members found')).toBeInTheDocument(); });
  });

  it('switches to archived view on toggle click', async () => {
    const user = userEvent.setup();
    mockApiGet.mockResolvedValue([]);
    renderWithProviders(<OwnerMembersPage />, { route: '/owner/members' });
    await user.click(screen.getByText('Archived'));
    await waitFor(() => { expect(mockApiGet).toHaveBeenCalledWith('/api/members?status=archived'); });
  });
});
