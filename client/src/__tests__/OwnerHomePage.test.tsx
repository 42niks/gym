import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import OwnerHomePage from '../pages/owner/OwnerHomePage.js';
import { renderWithProviders } from './test-utils.js';
import { mockDashboard } from './mocks.js';

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

describe('OwnerHomePage', () => {
  it('renders dashboard heading and new member button', () => {
    mockApiGet.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<OwnerHomePage />, { route: '/owner' });
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('+ New member')).toBeInTheDocument();
  });

  it('renders dashboard sections', async () => {
    mockApiGet.mockResolvedValue(mockDashboard);
    renderWithProviders(<OwnerHomePage />, { route: '/owner' });
    await waitFor(() => {
      expect(screen.getByText(/Need renewal/)).toBeInTheDocument();
      expect(screen.getByText(/Checked in today/)).toBeInTheDocument();
      expect(screen.getByText(/Active members/)).toBeInTheDocument();
    });
  });

  it('shows member names in dashboard', async () => {
    mockApiGet.mockResolvedValue(mockDashboard);
    renderWithProviders(<OwnerHomePage />, { route: '/owner' });
    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getAllByText('Alex Kumar').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows badges for no plan', async () => {
    mockApiGet.mockResolvedValue(mockDashboard);
    renderWithProviders(<OwnerHomePage />, { route: '/owner' });
    await waitFor(() => { expect(screen.getByText('No plan')).toBeInTheDocument(); });
  });

  it('does not render empty sections', async () => {
    mockApiGet.mockResolvedValue({ ...mockDashboard, archived_members: [], renewal_nearing_end: [] });
    renderWithProviders(<OwnerHomePage />, { route: '/owner' });
    await waitFor(() => {
      expect(screen.queryByText(/Archived/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Nearing end/)).not.toBeInTheDocument();
    });
  });

  it('has nav link to members', () => {
    mockApiGet.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<OwnerHomePage />, { route: '/owner' });
    expect(screen.getByText('Members')).toBeInTheDocument();
  });
});
