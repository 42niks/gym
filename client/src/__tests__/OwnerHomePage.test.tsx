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
  it('renders home heading', () => {
    mockApiGet.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<OwnerHomePage />, { route: '/home' });
    expect(screen.getByRole('heading', { name: 'HOME' })).toBeInTheDocument();
  });

  it('renders attendance card', async () => {
    mockApiGet.mockResolvedValue(mockDashboard);
    renderWithProviders(<OwnerHomePage />, { route: '/home' });
    await waitFor(() => {
      expect(screen.getByText("Today's Attendance")).toBeInTheDocument();
      expect(screen.getByText('Marked today')).toBeInTheDocument();
      expect(screen.getByText('+1 vs yesterday')).toBeInTheDocument();
    });
  });

  it('shows zero state delta copy', async () => {
    mockApiGet.mockResolvedValue({
      ...mockDashboard,
      attendance_summary: { present_today: 0, present_yesterday: 0, delta: 0 },
    });
    renderWithProviders(<OwnerHomePage />, { route: '/home' });
    await waitFor(() => {
      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.getByText('No change vs yesterday')).toBeInTheDocument();
    });
  });

  it('renders the at risk breakdown on separate lines', async () => {
    mockApiGet.mockResolvedValue(mockDashboard);
    renderWithProviders(<OwnerHomePage />, { route: '/home' });
    await waitFor(() => {
      expect(screen.getByText('2 consistent')).toBeInTheDocument();
      expect(screen.getByText('14 building')).toBeInTheDocument();
      expect(screen.getByText('At Risk')).toBeInTheDocument();
    });
  });

  it('renders the new dashboard cards with deep links to the matching member views', async () => {
    mockApiGet.mockResolvedValue(mockDashboard);
    const { container } = renderWithProviders(<OwnerHomePage />, { route: '/home' });

    await waitFor(() => {
      expect(screen.getByText('Consistency Pipeline')).toBeInTheDocument();
      expect(screen.getByText('Upcoming Renewals')).toBeInTheDocument();
      expect(screen.getByText('No Active Plan')).toBeInTheDocument();
    });

    expect(screen.getByText('Not Consistent')).toBeInTheDocument();
    expect(screen.getByText('Building')).toBeInTheDocument();
    expect(screen.getByText('Consistent')).toBeInTheDocument();
    expect(container.querySelector('a[href="/members?view=today"]')).toBeInTheDocument();
    expect(container.querySelector('a[href="/members?view=not-consistent"]')).toBeInTheDocument();
    expect(container.querySelector('a[href="/members?view=building"]')).toBeInTheDocument();
    expect(container.querySelector('a[href="/members?view=consistent"]')).toBeInTheDocument();
    expect(container.querySelector('a[href="/members?view=at-risk"]')).toBeInTheDocument();
    expect(container.querySelector('a[href="/members?view=renewal"]')).toBeInTheDocument();
    expect(container.querySelector('a[href="/members?view=no-plan"]')).toBeInTheDocument();
  });

  it('has nav link to members', () => {
    mockApiGet.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<OwnerHomePage />, { route: '/home' });
    expect(screen.getByText('Members')).toBeInTheDocument();
  });
});
