import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OwnerNewSubscriptionPage from '../pages/owner/OwnerNewSubscriptionPage.js';
import { renderWithProviders } from './test-utils.js';
import { mockManagedPackages, mockMemberDetail, mockPackages } from './mocks.js';

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

function configurePageData({
  packages = mockPackages,
  detail = mockMemberDetail,
}: {
  packages?: any[];
  detail?: any;
} = {}) {
  mockApiGet.mockImplementation((url: string) => {
    if (url === '/api/packages') return Promise.resolve(packages);
    if (url === '/api/members/2') return Promise.resolve(detail);
    return Promise.reject(new Error(`Unexpected GET ${url}`));
  });
}

async function selectFirstExistingPackage(user: ReturnType<typeof userEvent.setup>) {
  const table = await screen.findByRole('table');
  const selectButtons = within(table).getAllByRole('button', { name: /select/i });
  await user.click(selectButtons[0]);
}

beforeEach(() => {
  vi.clearAllMocks();
  configurePageData();
});

describe('OwnerNewSubscriptionPage', () => {
  it('renders the heading, mode tabs, and member back link', async () => {
    renderWithProviders(<OwnerNewSubscriptionPage />, { route: '/members/2/subscriptions/new' });

    await waitFor(() => {
      expect(screen.getByText('New subscription')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /member profile/i })).toHaveAttribute('href', '/members/2');
      expect(screen.getByRole('button', { name: /existing package/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /custom package/i })).toBeInTheDocument();
    });
  });

  it('renders package tabs grouped by type and hides inactive packages', async () => {
    configurePageData({ packages: mockManagedPackages });
    renderWithProviders(<OwnerNewSubscriptionPage />, { route: '/members/2/subscriptions/new' });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /1:1\s*2/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^group/i })).not.toBeInTheDocument();
    });

    const table = screen.getByRole('table');
    expect(within(table).getByText('12')).toBeInTheDocument();
    expect(within(table).getByText('24')).toBeInTheDocument();
  });

  it('requires selecting a shared package before the existing-package submit is enabled', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OwnerNewSubscriptionPage />, { route: '/members/2/subscriptions/new' });

    const createButton = await screen.findByRole('button', { name: /create subscription/i });
    expect(createButton).toBeDisabled();

    await selectFirstExistingPackage(user);
    expect(screen.getByRole('button', { name: /create subscription/i })).toBeEnabled();
  });

  it('shows start date, amount, and suggested end date in existing package mode', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OwnerNewSubscriptionPage />, { route: '/members/2/subscriptions/new' });

    await selectFirstExistingPackage(user);
    fireEvent.change(screen.getByLabelText(/^start date$/i), { target: { value: '2026-04-07' } });

    expect(screen.getByLabelText(/^start date$/i)).toHaveValue('2026-04-07');
    expect(screen.getByLabelText(/amount/i)).toHaveValue('29500');
    expect(screen.getByLabelText(/^end date$/i)).toHaveValue('2026-05-06');
    expect(screen.getByText(/suggested end date is 6 may 2026/i)).toBeInTheDocument();
  });

  it('sanitizes amount input to digits only', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OwnerNewSubscriptionPage />, { route: '/members/2/subscriptions/new' });

    await selectFirstExistingPackage(user);

    const amountInput = screen.getByLabelText(/amount/i);
    await user.clear(amountInput);
    await user.type(amountInput, '29,500abc');

    expect(amountInput).toHaveValue('29500');
  });

  it('submits an existing package subscription and returns to member detail', async () => {
    const user = userEvent.setup();
    mockApiPost.mockResolvedValue({ id: 10 });
    renderWithProviders(<OwnerNewSubscriptionPage />, { route: '/members/2/subscriptions/new' });

    await selectFirstExistingPackage(user);
    const currentStartDate = (screen.getByLabelText(/^start date$/i) as HTMLInputElement).value;
    const currentEndDate = (screen.getByLabelText(/^end date$/i) as HTMLInputElement).value;
    await user.click(screen.getByRole('button', { name: /create subscription/i }));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/api/members/2/subscriptions', {
        package_id: 1,
        start_date: currentStartDate,
        end_date: currentEndDate,
        amount: 29500,
      });
      expect(mockNavigate).toHaveBeenCalledWith('/members/2');
    });
  });

  it('allows overriding end date for an existing package', async () => {
    const user = userEvent.setup();
    mockApiPost.mockResolvedValue({ id: 11 });
    renderWithProviders(<OwnerNewSubscriptionPage />, { route: '/members/2/subscriptions/new' });

    await selectFirstExistingPackage(user);
    fireEvent.change(screen.getByLabelText(/^end date$/i), { target: { value: '2026-05-10' } });
    await user.click(screen.getByRole('button', { name: /create subscription/i }));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/api/members/2/subscriptions', expect.objectContaining({
        package_id: 1,
        end_date: '2026-05-10',
      }));
    });
  });

  it('submits a private custom package payload', async () => {
    const user = userEvent.setup();
    mockApiPost.mockResolvedValue({ id: 20 });
    renderWithProviders(<OwnerNewSubscriptionPage />, { route: '/members/2/subscriptions/new' });

    await user.click(await screen.findByRole('button', { name: /custom package/i }));
    await user.selectOptions(screen.getByLabelText(/^service type$/i), '__custom__');
    await user.type(screen.getByLabelText(/new service type/i), 'Special Plan');
    await user.clear(screen.getByLabelText(/^sessions$/i));
    await user.type(screen.getByLabelText(/^sessions$/i), '15');
    fireEvent.change(screen.getByLabelText(/^start date$/i), { target: { value: '2026-06-01' } });
    fireEvent.change(screen.getByLabelText(/^end date$/i), { target: { value: '2026-06-30' } });
    await user.clear(screen.getByLabelText(/price/i));
    await user.type(screen.getByLabelText(/price/i), '21000');
    await user.click(screen.getByRole('button', { name: /add subscription/i }));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/api/members/2/subscriptions', {
        custom_package: {
          service_type: 'Special Plan',
          sessions: 15,
          start_date: '2026-06-01',
          end_date: '2026-06-30',
          amount: 21000,
          consistency_window_days: 7,
          consistency_min_days: 1,
        },
      });
    });
  });

  it('blocks archived members from creating subscriptions in the UI', async () => {
    configurePageData({
      detail: {
        ...mockMemberDetail,
        status: 'archived',
        can_add_subscription: false,
        archive_action: {
          kind: 'unarchive',
          allowed: true,
          reason: null,
          blocked_by: [],
        },
      },
    });
    renderWithProviders(<OwnerNewSubscriptionPage />, { route: '/members/2/subscriptions/new' });

    await waitFor(() => {
      expect(screen.getByText(/Unarchive this member before creating a new subscription/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /back to member profile/i })).toHaveAttribute('href', '/members/2');
    });

    expect(screen.queryByRole('button', { name: /create subscription/i })).not.toBeInTheDocument();
  });

  it('clamps minimum attendance days below the consistency window', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OwnerNewSubscriptionPage />, { route: '/members/2/subscriptions/new' });

    await user.click(await screen.findByRole('button', { name: /custom package/i }));
    const consistencyWindowInput = screen.getByLabelText(/^consistency window \(days\)$/i, { selector: 'input' });
    const minDaysInput = screen.getByLabelText(/^min days in window$/i, { selector: 'input' });
    await user.clear(consistencyWindowInput);
    await user.type(consistencyWindowInput, '7');
    await user.clear(minDaysInput);
    await user.type(minDaysInput, '7');

    expect(minDaysInput).toHaveValue('6');
  });

  it('shows API errors inline', async () => {
    const user = userEvent.setup();
    const { ApiError } = await import('../lib/api.js');
    mockApiPost.mockRejectedValue(new ApiError(400, 'Overlapping subscription'));
    renderWithProviders(<OwnerNewSubscriptionPage />, { route: '/members/2/subscriptions/new' });

    await selectFirstExistingPackage(user);
    await user.click(screen.getByRole('button', { name: /create subscription/i }));

    await waitFor(() => {
      expect(screen.getByText('Overlapping subscription')).toBeInTheDocument();
    });
  });
});
