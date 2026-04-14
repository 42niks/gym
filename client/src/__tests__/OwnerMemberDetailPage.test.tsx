import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OwnerMemberDetailPage from '../pages/owner/OwnerMemberDetailPage.js';
import { renderWithProviders } from './test-utils.js';
import { mockMemberDetail, mockSubscriptions } from './mocks.js';

const { mockApiGet, mockApiPost, mockApiPatch } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
  mockApiPatch: vi.fn(),
}));

vi.mock('../context/AuthContext.js', () => ({
  useAuth: () => ({ logout: vi.fn(), user: { id: 1, role: 'owner', full_name: 'Sam Chen', email: 'owner@thebase.fit' }, loading: false }),
  AuthProvider: ({ children }: any) => children,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useParams: () => ({ id: '2' }), useNavigate: () => vi.fn() };
});

vi.mock('../lib/api.js', async () => {
  const actual = await vi.importActual('../lib/api.js');
  return { ...actual, api: { get: mockApiGet, post: mockApiPost, patch: mockApiPatch } };
});

beforeEach(() => {
  vi.clearAllMocks();
  mockApiGet.mockImplementation((url: string) => {
    if (url.includes('/subscriptions')) return Promise.resolve(mockSubscriptions);
    return Promise.resolve(mockMemberDetail);
  });
});

describe('OwnerMemberDetailPage', () => {
  it('renders member name and details', async () => {
    renderWithProviders(<OwnerMemberDetailPage />, { route: '/members/2' });
    await waitFor(() => {
      expect(screen.getByText('Alex Kumar')).toBeInTheDocument();
      expect(screen.getByText(/member@thebase.fit/)).toBeInTheDocument();
    });
  });

  it('shows active badge for active member', async () => {
    renderWithProviders(<OwnerMemberDetailPage />, { route: '/members/2' });
    await waitFor(() => { expect(screen.getAllByText('active').length).toBeGreaterThanOrEqual(1); });
  });

  it('renders subscription cards', async () => {
    renderWithProviders(<OwnerMemberDetailPage />, { route: '/members/2' });
    await waitFor(() => { expect(screen.getAllByText('1:1 Personal Training').length).toBeGreaterThanOrEqual(1); });
  });

  it('shows mark attendance button when member has active subscription', async () => {
    renderWithProviders(<OwnerMemberDetailPage />, { route: '/members/2' });
    await waitFor(() => { expect(screen.getByRole('button', { name: /mark attendance/i })).toBeInTheDocument(); });
  });

  it('shows attendance marked when already done today', async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('/subscriptions')) return Promise.resolve(mockSubscriptions);
      return Promise.resolve({ ...mockMemberDetail, marked_attendance_today: true });
    });
    renderWithProviders(<OwnerMemberDetailPage />, { route: '/members/2' });
    await waitFor(() => { expect(screen.getByText(/attendance marked for today/i)).toBeInTheDocument(); });
  });

  it('has subscription and archive buttons', async () => {
    renderWithProviders(<OwnerMemberDetailPage />, { route: '/members/2' });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Subscription$/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Archive$/ })).toBeInTheDocument();
    });
  });

  it('calls attendance API on click', async () => {
    const user = userEvent.setup();
    mockApiPost.mockResolvedValue({});
    renderWithProviders(<OwnerMemberDetailPage />, { route: '/members/2' });
    await waitFor(() => { expect(screen.getByRole('button', { name: /mark attendance/i })).toBeInTheDocument(); });
    await user.click(screen.getByRole('button', { name: /mark attendance/i }));
    expect(mockApiPost).toHaveBeenCalledWith('/api/members/2/sessions');
  });

  it('shows back link to members', async () => {
    renderWithProviders(<OwnerMemberDetailPage />, { route: '/members/2' });
    await waitFor(() => { expect(screen.getByRole('link', { name: /arrow_back Members$/ })).toBeInTheDocument(); });
  });

  it('shows no subscriptions message when empty', async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('/subscriptions')) return Promise.resolve([]);
      return Promise.resolve(mockMemberDetail);
    });
    renderWithProviders(<OwnerMemberDetailPage />, { route: '/members/2' });
    await waitFor(() => { expect(screen.getByText('No subscriptions yet')).toBeInTheDocument(); });
  });
});
