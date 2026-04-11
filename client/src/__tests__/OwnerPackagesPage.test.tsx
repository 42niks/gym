import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OwnerPackagesPage from '../pages/owner/OwnerPackagesPage.js';
import { renderWithProviders } from './test-utils.js';
import { mockManagedPackages } from './mocks.js';

const { mockApiGet, mockApiPost, mockApiPatch, mockApiDelete } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
  mockApiPatch: vi.fn(),
  mockApiDelete: vi.fn(),
}));

vi.mock('../context/AuthContext.js', () => ({
  useAuth: () => ({ logout: vi.fn(), user: { id: 1, role: 'owner', full_name: 'Sam Chen', email: 'owner@thebase.fit' }, loading: false }),
  AuthProvider: ({ children }: any) => children,
}));

vi.mock('../lib/api.js', async () => {
  const actual = await vi.importActual('../lib/api.js');
  return {
    ...actual,
    api: {
      get: mockApiGet,
      post: mockApiPost,
      patch: mockApiPatch,
      delete: mockApiDelete,
    },
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('OwnerPackagesPage', () => {
  it('renders package sections and summary cards', async () => {
    mockApiGet.mockResolvedValue(mockManagedPackages);

    renderWithProviders(<OwnerPackagesPage />, { route: '/packages' });

    await waitFor(() => {
      expect(screen.getByText('PACKAGES')).toBeInTheDocument();
      expect(screen.getByText('1:1 Personal Training')).toBeInTheDocument();
      expect(screen.getByText('Group Personal Training')).toBeInTheDocument();
      expect(screen.getByText('Live catalog')).toBeInTheDocument();
    });
  });

  it('creates a new package', async () => {
    const user = userEvent.setup();
    mockApiGet.mockResolvedValue(mockManagedPackages);
    mockApiPost.mockResolvedValue({
      id: 42,
      service_type: 'Mobility Coaching',
      sessions: 10,
      duration_months: 2,
      price: 12000,
      consistency_window_days: 7,
      consistency_min_days: 2,
      is_active: true,
      subscription_count: 0,
      active_subscription_count: 0,
      upcoming_subscription_count: 0,
    });

    renderWithProviders(<OwnerPackagesPage />, { route: '/packages' });

    await waitFor(() => expect(screen.getByRole('button', { name: /new package/i })).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /new package/i }));
    await user.type(screen.getByLabelText(/service type/i), 'Mobility Coaching');
    await user.type(screen.getByLabelText(/^sessions$/i), '10');
    await user.type(screen.getByLabelText(/duration \(months\)/i), '2');
    await user.type(screen.getByLabelText(/price \(inr\)/i), '12000');
    await user.clear(screen.getByLabelText(/min exercise days/i));
    await user.type(screen.getByLabelText(/min exercise days/i), '2');
    await user.click(screen.getByRole('button', { name: /create package/i }));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/api/owner/packages', expect.objectContaining({
        service_type: 'Mobility Coaching',
        sessions: '10',
        duration_months: '2',
        price: '12000',
        consistency_min_days: '2',
        is_active: true,
      }));
    });
  });

  it('updates an existing package', async () => {
    const user = userEvent.setup();
    mockApiGet.mockResolvedValue(mockManagedPackages);
    mockApiPatch.mockResolvedValue({
      ...mockManagedPackages[1],
      consistency_min_days: 3,
    });

    renderWithProviders(<OwnerPackagesPage />, { route: '/packages' });

    await waitFor(() => expect(screen.getByText('24 sessions')).toBeInTheDocument());
    await user.click(screen.getByText('24 sessions'));
    await user.clear(screen.getByLabelText(/min exercise days/i));
    await user.type(screen.getByLabelText(/min exercise days/i), '3');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith('/api/owner/packages/2', expect.objectContaining({
        consistency_min_days: '3',
      }));
    });
  });
});
