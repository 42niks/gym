import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OwnerNewPackagePage from '../pages/owner/OwnerNewPackagePage.js';
import { renderWithProviders } from './test-utils.js';

const { mockApiPost, mockNavigate } = vi.hoisted(() => ({
  mockApiPost: vi.fn(),
  mockNavigate: vi.fn(),
}));

vi.mock('../context/AuthContext.js', () => ({
  useAuth: () => ({ logout: vi.fn(), user: { id: 1, role: 'owner', full_name: 'Sam Chen', email: 'owner@thebase.fit' }, loading: false }),
  AuthProvider: ({ children }: any) => children,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../lib/api.js', async () => {
  const actual = await vi.importActual('../lib/api.js');
  return {
    ...actual,
    api: {
      get: vi.fn(),
      post: mockApiPost,
      patch: vi.fn(),
      delete: vi.fn(),
    },
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('OwnerNewPackagePage', () => {
  it('renders the new package form', () => {
    renderWithProviders(<OwnerNewPackagePage />, { route: '/packages/new' });

    expect(screen.getByText('NEW PACKAGE')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /arrow_back Packages$/ })).toHaveAttribute('href', '/packages');
    expect(screen.getByLabelText(/service type/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create package/i })).toBeInTheDocument();
  });

  it('reveals a custom service type input when requested', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OwnerNewPackagePage />, { route: '/packages/new' });

    await user.selectOptions(screen.getByLabelText(/service type/i), '__custom__');

    expect(screen.getByLabelText(/new service type/i)).toBeInTheDocument();
  });

  it('keeps the steppers clamped to valid minimums and relationships', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OwnerNewPackagePage />, { route: '/packages/new' });

    expect(screen.getByRole('button', { name: /decrease sessions/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /decrease duration months/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /decrease min days in window/i })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /decrease consistency window days/i }));
    await user.click(screen.getByRole('button', { name: /decrease consistency window days/i }));

    const windowInput = screen.getByRole('textbox', { name: /consistency window \(days\)/i });
    const minDaysInput = screen.getByRole('textbox', { name: /^min days in window$/i });

    expect(windowInput).toHaveValue('5');
    expect(screen.getByRole('button', { name: /decrease consistency window days/i })).toBeDisabled();

    await user.clear(minDaysInput);
    await user.type(minDaysInput, '9');
    fireEvent.blur(minDaysInput);

    expect(minDaysInput).toHaveValue('4');
    expect(screen.getByRole('button', { name: /increase min days in window/i })).toBeDisabled();
  });

  it('sanitizes the price input to digits only', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OwnerNewPackagePage />, { route: '/packages/new' });

    const priceInput = screen.getByLabelText(/price/i);
    await user.type(priceInput, '12abc,500');

    expect(priceInput).toHaveValue('12500');
  });

  it('repeats step changes while a stepper button is held', () => {
    vi.useFakeTimers();
    renderWithProviders(<OwnerNewPackagePage />, { route: '/packages/new' });

    const input = screen.getByLabelText(/consistency window \(days\)/i);
    const increment = screen.getByRole('button', { name: /increase consistency window days/i });

    fireEvent.pointerDown(increment);
    act(() => {
      vi.advanceTimersByTime(620);
    });
    fireEvent.pointerUp(increment);

    expect(input).toHaveValue('11');
    vi.useRealTimers();
  });

  it('submits a custom service type and navigates back to packages', async () => {
    const user = userEvent.setup();
    mockApiPost.mockResolvedValue({
      id: 42,
      service_type: 'Mobility Coaching',
      sessions: 1,
      duration_months: 1,
      price: 12000,
      consistency_window_days: 7,
      consistency_min_days: 1,
      is_active: true,
      subscription_count: 0,
      active_subscription_count: 0,
      upcoming_subscription_count: 0,
    });

    renderWithProviders(<OwnerNewPackagePage />, { route: '/packages/new' });

    await user.selectOptions(screen.getByLabelText(/service type/i), '__custom__');
    await user.type(screen.getByLabelText(/new service type/i), 'Mobility Coaching');
    await user.clear(screen.getByLabelText(/price/i));
    await user.type(screen.getByLabelText(/price/i), '12000');
    await user.click(screen.getByRole('button', { name: /create package/i }));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/api/packages', {
        service_type: 'Mobility Coaching',
        sessions: 1,
        duration_months: 1,
        price: 12000,
        consistency_window_days: 7,
        consistency_min_days: 1,
        is_active: true,
      });
      expect(mockNavigate).toHaveBeenCalledWith('/packages?type=Mobility%20Coaching');
    });
  });

  it('shows an API error when create fails', async () => {
    const user = userEvent.setup();
    const { ApiError } = await import('../lib/api.js');
    mockApiPost.mockRejectedValue(new ApiError(400, 'Package already exists'));

    renderWithProviders(<OwnerNewPackagePage />, { route: '/packages/new' });

    await user.selectOptions(screen.getByLabelText(/service type/i), '1:1 Personal Training');
    await user.type(screen.getByLabelText(/price/i), '12000');
    await user.click(screen.getByRole('button', { name: /create package/i }));

    await waitFor(() => {
      expect(screen.getByText('Package already exists')).toBeInTheDocument();
    });
  });
});
