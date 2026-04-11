import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OwnerNewSubscriptionPage from '../pages/owner/OwnerNewSubscriptionPage.js';
import { renderWithProviders } from './test-utils.js';
import { mockPackages } from './mocks.js';

const { mockApiGet, mockApiPost, mockNavigate } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
  mockNavigate: vi.fn(),
}));

vi.mock('../context/AuthContext.js', () => ({
  useAuth: () => ({ logout: vi.fn(), user: { id: 1, role: 'owner', full_name: 'Sam Chen', email: 'owner@thebase.fit' }, loading: false }),
  AuthProvider: ({ children }: any) => children,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useParams: () => ({ id: '2' }), useNavigate: () => mockNavigate };
});

vi.mock('../lib/api.js', async () => {
  const actual = await vi.importActual('../lib/api.js');
  return { ...actual, api: { get: mockApiGet, post: mockApiPost, patch: vi.fn() } };
});

beforeEach(() => { vi.clearAllMocks(); });

describe('OwnerNewSubscriptionPage', () => {
  it('renders heading and back link', () => {
    mockApiGet.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<OwnerNewSubscriptionPage />, { route: '/members/2/subscriptions/new' });
    expect(screen.getByText('New subscription')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /arrow_back Member$/ })).toBeInTheDocument();
  });

  it('renders package options grouped by type', async () => {
    mockApiGet.mockResolvedValue(mockPackages);
    renderWithProviders(<OwnerNewSubscriptionPage />, { route: '/members/2/subscriptions/new' });
    await waitFor(() => {
      expect(screen.getByText('1:1 Personal Training')).toBeInTheDocument();
      expect(screen.getByText('Group Personal Training')).toBeInTheDocument();
    });
  });

  it('shows start date and amount fields after selecting a package', async () => {
    const user = userEvent.setup();
    mockApiGet.mockResolvedValue(mockPackages);
    renderWithProviders(<OwnerNewSubscriptionPage />, { route: '/members/2/subscriptions/new' });
    await waitFor(() => { expect(screen.getAllByText('12 sessions').length).toBeGreaterThanOrEqual(1); });
    await user.click(screen.getAllByText('12 sessions')[0]);
    await waitFor(() => {
      expect(screen.getByLabelText(/start date/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create subscription/i })).toBeInTheDocument();
    });
  });

  it('pre-fills amount with package price on selection', async () => {
    const user = userEvent.setup();
    mockApiGet.mockResolvedValue(mockPackages);
    renderWithProviders(<OwnerNewSubscriptionPage />, { route: '/members/2/subscriptions/new' });
    await waitFor(() => { expect(screen.getAllByText('12 sessions')[0]).toBeInTheDocument(); });
    await user.click(screen.getAllByText('12 sessions')[0]);
    await waitFor(() => { expect(screen.getByLabelText(/amount/i)).toHaveValue(29500); });
  });

  it('submits and navigates back to member detail', async () => {
    const user = userEvent.setup();
    mockApiGet.mockResolvedValue(mockPackages);
    mockApiPost.mockResolvedValue({ id: 10 });
    renderWithProviders(<OwnerNewSubscriptionPage />, { route: '/members/2/subscriptions/new' });
    await waitFor(() => { expect(screen.getAllByText('12 sessions')[0]).toBeInTheDocument(); });
    await user.click(screen.getAllByText('12 sessions')[0]);
    await waitFor(() => { expect(screen.getByRole('button', { name: /create subscription/i })).toBeInTheDocument(); });
    await user.click(screen.getByRole('button', { name: /create subscription/i }));
    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/api/members/2/subscriptions', expect.objectContaining({ package_id: 1, amount: 29500 }));
      expect(mockNavigate).toHaveBeenCalledWith('/members/2');
    });
  });

  it('shows error on API failure', async () => {
    const user = userEvent.setup();
    const { ApiError } = await import('../lib/api.js');
    mockApiGet.mockResolvedValue(mockPackages);
    mockApiPost.mockRejectedValue(new ApiError(400, 'Overlapping subscription'));
    renderWithProviders(<OwnerNewSubscriptionPage />, { route: '/members/2/subscriptions/new' });
    await waitFor(() => { expect(screen.getAllByText('12 sessions')[0]).toBeInTheDocument(); });
    await user.click(screen.getAllByText('12 sessions')[0]);
    await waitFor(() => { expect(screen.getByRole('button', { name: /create subscription/i })).toBeInTheDocument(); });
    await user.click(screen.getByRole('button', { name: /create subscription/i }));
    await waitFor(() => { expect(screen.getByText('Overlapping subscription')).toBeInTheDocument(); });
  });
});
