import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MemberHomePage from '../pages/member/MemberHomePage.js';
import { renderWithProviders } from './test-utils.js';
import { mockMemberHome } from './mocks.js';
import type { MemberHome } from '../lib/api.js';

const { mockApiGet, mockApiPost } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
}));

vi.mock('../context/AuthContext.js', () => ({
  useAuth: () => ({ logout: vi.fn(), user: { id: 2, role: 'member', full_name: 'Alex Kumar', email: 'member@thebase.fit' }, loading: false }),
  AuthProvider: ({ children }: any) => children,
}));

vi.mock('../lib/api.js', async () => {
  const actual = await vi.importActual('../lib/api.js');
  return { ...actual, api: { get: mockApiGet, post: mockApiPost, patch: vi.fn() } };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MemberHomePage', () => {
  it('shows spinner while loading', () => {
    mockApiGet.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<MemberHomePage />, { route: '/home' });
    expect(screen.getByText('Home')).toBeInTheDocument();
  });

  it('renders consistency and check in panels', async () => {
    mockApiGet.mockResolvedValue(mockMemberHome);
    renderWithProviders(<MemberHomePage />, { route: '/home' });

    await waitFor(() => {
      expect(screen.getByText('Consistency')).toBeInTheDocument();
      expect(screen.getByText('Check In')).toBeInTheDocument();
    });

    expect(screen.getByText('14')).toBeInTheDocument();
    expect(screen.getByText('DAYS!')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mark today/i })).toBeInTheDocument();
  });

  it('updates the check in panel after marking attendance', async () => {
    const user = userEvent.setup();
    const updatedHome: MemberHome = { ...mockMemberHome, marked_attendance_today: true };
    let fetchCount = 0;

    mockApiGet.mockImplementation(async () => {
      fetchCount += 1;
      return fetchCount === 1 ? mockMemberHome : updatedHome;
    });
    mockApiPost.mockResolvedValue({});

    renderWithProviders(<MemberHomePage />, { route: '/home' });

    await user.click(await screen.findByRole('button', { name: /mark today/i }));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/api/member/session');
    });

    await waitFor(() => {
      expect(screen.getByText('Good Job!')).toBeInTheDocument();
      expect(screen.getByText('Get some rest.')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /mark today/i })).not.toBeInTheDocument();
  });

  it('shows the rest state when attendance is already marked', async () => {
    mockApiGet.mockResolvedValue({ ...mockMemberHome, marked_attendance_today: true } as MemberHome);
    renderWithProviders(<MemberHomePage />, { route: '/home' });

    await waitFor(() => {
      expect(screen.getByText('Good Job!')).toBeInTheDocument();
      expect(screen.getByText('Get some rest.')).toBeInTheDocument();
    });
  });

  it('shows fallback when there is no active consistency data', async () => {
    mockApiGet.mockResolvedValue({ ...mockMemberHome, active_subscription: null, consistency: null } as MemberHome);
    renderWithProviders(<MemberHomePage />, { route: '/home' });

    await waitFor(() => {
      expect(screen.getByText('No active consistency data yet.')).toBeInTheDocument();
    });
  });

  it('renders nav links', async () => {
    mockApiGet.mockResolvedValue(mockMemberHome);
    renderWithProviders(<MemberHomePage />, { route: '/home' });

    await waitFor(() => {
      expect(screen.getByText('Subscription')).toBeInTheDocument();
      expect(screen.getByText('Profile')).toBeInTheDocument();
    });
  });
});
