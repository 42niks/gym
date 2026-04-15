import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
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

  it('renders the mark today CTA at the consistency-panel headline size with !important overrides', async () => {
    // The Button component has `text-sm` in its base classes. Because Tailwind emits `.text-sm`
    // later in the stylesheet than arbitrary `.text-[X]` utilities, a plain caller-supplied
    // `text-[2.3rem]` loses at equal specificity and the button collapses to 14px. The fix is
    // to mark the override important so it beats `text-sm` regardless of rule order. Keep the
    // `!` prefix below — removing it reintroduces the "either tiny or huge" regression.
    mockApiGet.mockResolvedValue(mockMemberHome);
    renderWithProviders(<MemberHomePage />, { route: '/home' });

    const button = await screen.findByRole('button', { name: /mark today/i });
    const icon = within(button).getByText('how_to_reg');

    expect(button.className).toContain('!text-[2.07rem]');
    expect(button.className).toContain('!leading-none');
    expect(button.className).not.toMatch(/(^|\s)text-\[2\.07rem\](\s|$)/);
    expect(icon.className).toContain('text-[1em]');
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
      expect(screen.getByText("You're done for the day. Get some rest.")).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /mark today/i })).not.toBeInTheDocument();
  });

  it('shows the rest state when attendance is already marked', async () => {
    mockApiGet.mockResolvedValue({ ...mockMemberHome, marked_attendance_today: true } as MemberHome);
    renderWithProviders(<MemberHomePage />, { route: '/home' });

    await waitFor(() => {
      expect(screen.getByText('Good Job!')).toBeInTheDocument();
      expect(screen.getByText("You're done for the day. Get some rest.")).toBeInTheDocument();
    });
  });

  it('renders a fading consistency ribbon when the streak started before the visible week', async () => {
    mockApiGet.mockResolvedValue(mockMemberHome);
    renderWithProviders(<MemberHomePage />, { route: '/home' });

    const ribbon = await screen.findByTestId('consistency-ribbon');

    expect(ribbon).toBeInTheDocument();
    expect(ribbon.className).toContain('consistency-window-ribbon-fade-left');
  });

  it('shows the streak risk copy in the keep moving state', async () => {
    mockApiGet.mockResolvedValue({
      ...mockMemberHome,
      consistency: { status: 'building', message: 'You are building your consistency, keep it up!' },
      consistency_window: { ...mockMemberHome.consistency_window, streak_days: 14 },
    } as MemberHome);
    renderWithProviders(<MemberHomePage />, { route: '/home' });

    await waitFor(() => {
      expect(screen.getByText('Check in today!')).toBeInTheDocument();
      expect(screen.getByText('You risk breaking your 14 day streak.')).toBeInTheDocument();
    });
  });

  it('hides the streak risk copy when today is already included in the consistency window', async () => {
    mockApiGet.mockResolvedValue({
      ...mockMemberHome,
      consistency: { status: 'building', message: 'You are building your consistency, keep it up!' },
      marked_attendance_today: true,
      consistency_window: {
        ...mockMemberHome.consistency_window,
        streak_days: 14,
        end_date: mockMemberHome.recent_attendance[mockMemberHome.recent_attendance.length - 1].date,
      },
      recent_attendance: mockMemberHome.recent_attendance.map((day, index, days) => (
        index === days.length - 1 ? { ...day, attended: true } : day
      )),
    } as MemberHome);
    renderWithProviders(<MemberHomePage />, { route: '/home' });

    await waitFor(() => {
      expect(screen.getByText('Check in today!')).toBeInTheDocument();
      expect(screen.queryByText('You risk breaking your 14 day streak.')).not.toBeInTheDocument();
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
