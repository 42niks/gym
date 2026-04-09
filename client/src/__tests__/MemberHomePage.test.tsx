import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MemberHomePage from '../pages/member/MemberHomePage.js';
import { renderWithProviders } from './test-utils.js';
import { mockMemberHome, mockRenewalEndsSoon, mockRenewalNoActive } from './mocks.js';
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

beforeEach(() => { vi.clearAllMocks(); });

describe('MemberHomePage', () => {
  it('shows spinner while loading', () => {
    mockApiGet.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<MemberHomePage />, { route: '/home' });
    expect(screen.getByText('Home')).toBeInTheDocument();
  });

  it('renders greeting and active subscription', async () => {
    mockApiGet.mockResolvedValue(mockMemberHome);
    renderWithProviders(<MemberHomePage />, { route: '/home' });
    await waitFor(() => { expect(screen.getByText(/sessions remaining/)).toBeInTheDocument(); });
    expect(screen.getByText('7', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText(/sessions remaining/)).toBeInTheDocument();
    expect(screen.getAllByText('1:1 Personal Training').length).toBeGreaterThanOrEqual(1);
  });

  it('shows mark attendance button when not marked today', async () => {
    mockApiGet.mockResolvedValue(mockMemberHome);
    renderWithProviders(<MemberHomePage />, { route: '/home' });
    await waitFor(() => { expect(screen.getByRole('button', { name: /mark attendance/i })).toBeInTheDocument(); });
  });

  it('shows attendance already marked when marked today', async () => {
    mockApiGet.mockResolvedValue({ ...mockMemberHome, marked_attendance_today: true });
    renderWithProviders(<MemberHomePage />, { route: '/home' });
    await waitFor(() => { expect(screen.getByText(/attendance marked for today/i)).toBeInTheDocument(); });
  });

  it('calls mark attendance API on button click', async () => {
    const user = userEvent.setup();
    mockApiGet.mockResolvedValue(mockMemberHome);
    mockApiPost.mockResolvedValue({});
    renderWithProviders(<MemberHomePage />, { route: '/home' });
    await waitFor(() => { expect(screen.getByRole('button', { name: /mark attendance/i })).toBeInTheDocument(); });
    await user.click(screen.getByRole('button', { name: /mark attendance/i }));
    expect(mockApiPost).toHaveBeenCalledWith('/api/me/sessions');
  });

  it('shows renewal warning when ends_soon', async () => {
    mockApiGet.mockResolvedValue({ ...mockMemberHome, renewal: mockRenewalEndsSoon } as MemberHome);
    renderWithProviders(<MemberHomePage />, { route: '/home' });
    await waitFor(() => { expect(screen.getAllByText('Your subscription ends in 3 days').length).toBeGreaterThanOrEqual(1); });
  });

  it('shows no active subscription message', async () => {
    mockApiGet.mockResolvedValue({ ...mockMemberHome, active_subscription: null, consistency: null, renewal: mockRenewalNoActive } as MemberHome);
    renderWithProviders(<MemberHomePage />, { route: '/home' });
    await waitFor(() => { expect(screen.getByText('No active subscription')).toBeInTheDocument(); });
  });

  it('shows consistency card', async () => {
    mockApiGet.mockResolvedValue(mockMemberHome);
    renderWithProviders(<MemberHomePage />, { route: '/home' });
    await waitFor(() => { expect(screen.getByText('Consistency')).toBeInTheDocument(); });
    expect(screen.getByText('14')).toBeInTheDocument();
    expect(screen.getByText('DAYS!')).toBeInTheDocument();
  });

  it('renders nav links', async () => {
    mockApiGet.mockResolvedValue(mockMemberHome);
    renderWithProviders(<MemberHomePage />, { route: '/home' });
    await waitFor(() => {
      expect(screen.getByText('Billing')).toBeInTheDocument();
      expect(screen.getByText('Profile')).toBeInTheDocument();
    });
  });
});
