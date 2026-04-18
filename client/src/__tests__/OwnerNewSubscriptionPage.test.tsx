import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
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

beforeEach(() => {
  vi.clearAllMocks();
  configurePageData();
});

describe('OwnerNewSubscriptionPage', () => {
  it('renders heading, member copy, and back link', async () => {
    renderWithProviders(<OwnerNewSubscriptionPage />, { route: '/members/2/subscriptions/new' });

    await waitFor(() => {
      expect(screen.getByText('New subscription')).toBeInTheDocument();
      expect(screen.getByText(/Create a plan for Alex Kumar/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /arrow_back Member$/ })).toBeInTheDocument();
    });
  });

  it('renders package options grouped by type and hides inactive packages', async () => {
    configurePageData({ packages: mockManagedPackages });
    renderWithProviders(<OwnerNewSubscriptionPage />, { route: '/members/2/subscriptions/new' });

    await waitFor(() => {
      expect(screen.getByText('1:1 Personal Training')).toBeInTheDocument();
    });

    expect(screen.queryByText('Group Personal Training')).not.toBeInTheDocument();
  });

  it('shows start date, amount, and suggested end date in existing package mode', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OwnerNewSubscriptionPage />, { route: '/members/2/subscriptions/new' });

    await waitFor(() => {
      expect(screen.getAllByText('12 sessions')[0]).toBeInTheDocument();
    });

    await user.click(screen.getAllByText('12 sessions')[0]);
    await user.clear(screen.getByLabelText(/start date/i));
    await user.type(screen.getByLabelText(/start date/i), '2026-04-07');

    expect(screen.getByLabelText(/start date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/amount/i)).toHaveValue('29500');
    expect(screen.getByLabelText(/^end date$/i)).toHaveValue('2026-05-06');
  });

  it('sanitizes amount input to digits only', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OwnerNewSubscriptionPage />, { route: '/members/2/subscriptions/new' });

    await waitFor(() => {
      expect(screen.getAllByText('12 sessions')[0]).toBeInTheDocument();
    });
    await user.click(screen.getAllByText('12 sessions')[0]);

    const amountInput = screen.getByLabelText(/amount/i);
    await user.clear(amountInput);
    await user.type(amountInput, '29,500abc');

    expect(amountInput).toHaveValue('29500');
  });

  it('submits an existing package subscription and returns to member detail', async () => {
    const user = userEvent.setup();
    mockApiPost.mockResolvedValue({ id: 10 });
    renderWithProviders(<OwnerNewSubscriptionPage />, { route: '/members/2/subscriptions/new' });

    await waitFor(() => {
      expect(screen.getAllByText('12 sessions')[0]).toBeInTheDocument();
    });
    await user.click(screen.getAllByText('12 sessions')[0]);
    await user.click(screen.getByRole('button', { name: /create subscription/i }));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/api/members/2/subscriptions', expect.objectContaining({
        package_id: 1,
        amount: 29500,
        start_date: expect.any(String),
        end_date: expect.any(String),
      }));
      expect(mockNavigate).toHaveBeenCalledWith('/members/2');
    });
  });

  it('allows overriding end date for an existing package', async () => {
    const user = userEvent.setup();
    mockApiPost.mockResolvedValue({ id: 11 });
    renderWithProviders(<OwnerNewSubscriptionPage />, { route: '/members/2/subscriptions/new' });

    await waitFor(() => {
      expect(screen.getAllByText('12 sessions')[0]).toBeInTheDocument();
    });
    await user.click(screen.getAllByText('12 sessions')[0]);
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

    await waitFor(() => expect(screen.getByRole('button', { name: /custom package/i })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /custom package/i }));
    await user.type(screen.getByLabelText(/package name/i), 'Special Plan');
    await user.type(screen.getByLabelText(/number of sessions/i), '15');
    await user.clear(screen.getByLabelText(/start date/i));
    await user.type(screen.getByLabelText(/start date/i), '2026-06-01');
    await user.clear(screen.getByLabelText(/amount/i));
    await user.type(screen.getByLabelText(/amount/i), '21000');
    await user.type(screen.getByLabelText(/^end date$/i), '2026-06-30');
    await user.click(screen.getByRole('button', { name: /create subscription/i }));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/api/members/2/subscriptions', expect.objectContaining({
        custom_package: expect.objectContaining({
          service_type: 'Special Plan',
          sessions: 15,
          amount: 21000,
        }),
      }));
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
    });

    expect(screen.queryByRole('button', { name: /create subscription/i })).not.toBeInTheDocument();
  });

  it('shows validation when a custom rule is impossible', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OwnerNewSubscriptionPage />, { route: '/members/2/subscriptions/new' });

    await waitFor(() => expect(screen.getByRole('button', { name: /custom package/i })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /custom package/i }));
    await user.type(screen.getByLabelText(/package name/i), 'Bad Rule');
    await user.type(screen.getByLabelText(/number of sessions/i), '10');
    await user.clear(screen.getByLabelText(/start date/i));
    await user.type(screen.getByLabelText(/start date/i), '2026-05-01');
    await user.clear(screen.getByLabelText(/amount/i));
    await user.type(screen.getByLabelText(/amount/i), '10000');
    await user.type(screen.getByLabelText(/^end date$/i), '2026-05-30');
    await user.clear(screen.getByLabelText(/consistency window/i));
    await user.type(screen.getByLabelText(/consistency window/i), '7');
    await user.clear(screen.getByLabelText(/minimum attendance days/i));
    await user.type(screen.getByLabelText(/minimum attendance days/i), '7');
    await user.click(screen.getByRole('button', { name: /create subscription/i }));

    await waitFor(() => {
      expect(screen.getByText('Minimum attendance days must be less than the consistency window.')).toBeInTheDocument();
    });
  });

  it('shows API errors inline', async () => {
    const user = userEvent.setup();
    const { ApiError } = await import('../lib/api.js');
    mockApiPost.mockRejectedValue(new ApiError(400, 'Overlapping subscription'));
    renderWithProviders(<OwnerNewSubscriptionPage />, { route: '/members/2/subscriptions/new' });

    await waitFor(() => {
      expect(screen.getAllByText('12 sessions')[0]).toBeInTheDocument();
    });
    await user.click(screen.getAllByText('12 sessions')[0]);
    await user.click(screen.getByRole('button', { name: /create subscription/i }));

    await waitFor(() => {
      expect(screen.getByText('Overlapping subscription')).toBeInTheDocument();
    });
  });
});
