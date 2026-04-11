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

  it('has nav link to members', () => {
    mockApiGet.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<OwnerHomePage />, { route: '/home' });
    expect(screen.getByText('Members')).toBeInTheDocument();
  });
});
