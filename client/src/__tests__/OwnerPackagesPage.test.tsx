import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OwnerPackagesPage from '../pages/owner/OwnerPackagesPage.js';
import { renderWithProviders } from './test-utils.js';

const { mockApiGet, mockApiPatch, mockConfirm } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPatch: vi.fn(),
  mockConfirm: vi.fn(),
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
      post: vi.fn(),
      patch: mockApiPatch,
      delete: vi.fn(),
    },
  };
});

const managedPackages = [
  {
    id: 1,
    service_type: '1:1 Personal Training',
    sessions: 12,
    duration_months: 1,
    price: 29500,
    consistency_window_days: 7,
    consistency_min_days: 3,
    is_active: true,
    subscription_count: 6,
    active_subscription_count: 2,
    upcoming_subscription_count: 1,
  },
  {
    id: 2,
    service_type: 'Group Personal Training',
    sessions: 16,
    duration_months: 2,
    price: 18000,
    consistency_window_days: 7,
    consistency_min_days: 2,
    is_active: true,
    subscription_count: 4,
    active_subscription_count: 3,
    upcoming_subscription_count: 0,
  },
  {
    id: 3,
    service_type: 'MMA/Kickboxing Personal Training',
    sessions: 8,
    duration_months: 1,
    price: 22000,
    consistency_window_days: 7,
    consistency_min_days: 2,
    is_active: false,
    subscription_count: 1,
    active_subscription_count: 0,
    upcoming_subscription_count: 0,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('confirm', mockConfirm);
  mockConfirm.mockReturnValue(true);
});

describe('OwnerPackagesPage', () => {
  it('renders the packages heading, new link, and dock tabs with counts', async () => {
    mockApiGet.mockResolvedValue(managedPackages);

    renderWithProviders(<OwnerPackagesPage />, { route: '/packages' });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'PACKAGES' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /new/i })).toHaveAttribute('href', '/packages/new');
      expect(screen.getByRole('button', { name: /1:1 personal training 1/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /group personal training 1/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /archived packages 1/i })).toBeInTheDocument();
    });
  });

  it('shows the selected service tab and its table rows', async () => {
    mockApiGet.mockResolvedValue(managedPackages);

    renderWithProviders(<OwnerPackagesPage />, { route: '/packages?type=Group%20Personal%20Training' });

    let selectedCard: HTMLElement | null = null;
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Group Personal Training' })).toBeInTheDocument();
      selectedCard = screen.getByRole('heading', { name: 'Group Personal Training' }).closest('.glass-panel');
      expect(selectedCard).not.toBeNull();
      expect(within(selectedCard as HTMLElement).getByText('16')).toBeInTheDocument();
      expect(within(selectedCard as HTMLElement).getByText('2 months')).toBeInTheDocument();
      expect(within(selectedCard as HTMLElement).getByText('₹18,000')).toBeInTheDocument();
      expect(within(selectedCard as HTMLElement).getByRole('button', { name: /archive/i })).toBeInTheDocument();
    });

    expect(
      screen.getByText((content, element) => (
        element?.tagName === 'SPAN'
        && element.className.includes('font-headline')
        && content.trim() === '1'
      )),
    ).toBeInTheDocument();
  });

  it('archives an active package from the table', async () => {
    const user = userEvent.setup();
    mockApiGet.mockResolvedValue(managedPackages);
    mockApiPatch.mockResolvedValue({ ...managedPackages[1], is_active: false });

    renderWithProviders(<OwnerPackagesPage />, { route: '/packages?type=Group%20Personal%20Training' });

    const selectedCard = await screen.findByRole('heading', { name: 'Group Personal Training' });
    const card = selectedCard.closest('.glass-panel');
    expect(card).not.toBeNull();

    await waitFor(() => expect(within(card as HTMLElement).getByRole('button', { name: /archive/i })).toBeInTheDocument());
    await user.click(within(card as HTMLElement).getByRole('button', { name: /archive/i }));

    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalled();
      expect(mockApiPatch).toHaveBeenCalledWith('/api/packages/2', { is_active: false });
    });
  });

  it('shows an archive error when the API call fails', async () => {
    const user = userEvent.setup();
    const { ApiError } = await import('../lib/api.js');
    mockApiGet.mockResolvedValue(managedPackages);
    mockApiPatch.mockRejectedValue(new ApiError(409, 'Archive failed'));

    renderWithProviders(<OwnerPackagesPage />, { route: '/packages?type=Group%20Personal%20Training' });

    const selectedCard = await screen.findByRole('heading', { name: 'Group Personal Training' });
    const card = selectedCard.closest('.glass-panel');
    expect(card).not.toBeNull();

    await waitFor(() => expect(within(card as HTMLElement).getByRole('button', { name: /archive/i })).toBeInTheDocument());
    await user.click(within(card as HTMLElement).getByRole('button', { name: /archive/i }));

    await waitFor(() => {
      expect(screen.getByText('Archive failed')).toBeInTheDocument();
    });
  });

  it('routes an archived service type into the archived packages tab', async () => {
    mockApiGet.mockResolvedValue(managedPackages);

    renderWithProviders(<OwnerPackagesPage />, { route: '/packages?type=MMA%2FKickboxing%20Personal%20Training' });

    let archivedCard: HTMLElement | null = null;
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Archived Packages' })).toBeInTheDocument();
      archivedCard = screen.getByRole('heading', { name: 'Archived Packages' }).closest('.glass-panel');
      expect(archivedCard).not.toBeNull();
      expect(within(archivedCard as HTMLElement).getByText('MMA/Kickboxing Personal Training')).toBeInTheDocument();
      expect(within(archivedCard as HTMLElement).getByText(/^Archived$/i)).toBeInTheDocument();
      expect(within(archivedCard as HTMLElement).queryByRole('button', { name: /archive/i })).not.toBeInTheDocument();
    });
  });
});
