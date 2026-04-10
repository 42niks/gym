import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from '../pages/LoginPage.js';
import { renderWithProviders } from './test-utils.js';

const { mockLogin, mockNavigate } = vi.hoisted(() => ({
  mockLogin: vi.fn(),
  mockNavigate: vi.fn(),
}));

vi.mock('../context/AuthContext.js', () => ({
  useAuth: () => ({ login: mockLogin, logout: vi.fn(), user: null, loading: false }),
  AuthProvider: ({ children }: any) => children,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

beforeEach(() => { vi.clearAllMocks(); });

describe('LoginPage', () => {
  it('keeps email and password inputs on the same base visual styling', () => {
    renderWithProviders(<LoginPage />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/^password$/i);

    const emailClasses = emailInput.className.split(/\s+/);
    const passwordClasses = passwordInput.className.split(/\s+/);
    const sharedVisualClasses = [
      'w-full',
      'rounded-2xl',
      'border',
      'border-line',
      'bg-white/90',
      'px-4',
      'py-3.5',
      'text-sm',
      'font-medium',
      'text-gray-900',
      'shadow-sm',
      'shadow-black/5',
      'transition-all',
      'placeholder:text-gray-400',
      'focus:border-brand-300',
      'focus:outline-none',
      'focus:ring-4',
      'focus:ring-brand-300/25',
      'dark:bg-gray-900/80',
      'dark:text-gray-100',
      'dark:placeholder:text-gray-500',
      'dark:focus:border-accent-400',
      'dark:focus:ring-accent-400/25',
    ];

    expect(emailClasses).toEqual(expect.arrayContaining(sharedVisualClasses));
    expect(passwordClasses).toEqual(expect.arrayContaining(sharedVisualClasses));
  });

  it('uses teal focus in light theme and red focus in dark theme for both inputs', () => {
    renderWithProviders(<LoginPage />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/^password$/i);

    for (const input of [emailInput, passwordInput]) {
      expect(input).toHaveClass('focus:border-brand-300');
      expect(input).toHaveClass('focus:ring-brand-300/25');
      expect(input).toHaveClass('dark:focus:border-accent-400');
      expect(input).toHaveClass('dark:focus:ring-accent-400/25');
    }
  });

  it('renders login form with email and password fields', () => {
    renderWithProviders(<LoginPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('does not require a password in local dev', () => {
    renderWithProviders(<LoginPage />);
    expect(screen.getByLabelText(/^password$/i)).not.toBeRequired();
  });

  it('renders the BASE brand lockup', () => {
    renderWithProviders(<LoginPage />);
    expect(screen.getByAltText('BASE')).toBeInTheDocument();
    expect(screen.getByLabelText('Your Strength Habitat')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('calls login and navigates to /owner for owner role', async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValue({ id: 1, role: 'owner', full_name: 'Sam', email: 'owner@thebase.fit' });
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), 'owner@thebase.fit');
    await user.type(screen.getByLabelText(/^password$/i), '9999999999');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('owner@thebase.fit', '9999999999');
      expect(mockNavigate).toHaveBeenCalledWith('/owner', { replace: true });
    });
  });

  it('calls login and navigates to /home for member role', async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValue({ id: 2, role: 'member', full_name: 'Alex', email: 'member@thebase.fit' });
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), 'member@thebase.fit');
    await user.type(screen.getByLabelText(/^password$/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => { expect(mockNavigate).toHaveBeenCalledWith('/home', { replace: true }); });
  });

  it('displays error message on login failure', async () => {
    const user = userEvent.setup();
    const { ApiError } = await import('../lib/api.js');
    mockLogin.mockRejectedValue(new ApiError(401, 'Invalid email or password'));
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), 'bad@email.com');
    await user.type(screen.getByLabelText(/^password$/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => { expect(screen.getByText('Authentication Failed')).toBeInTheDocument(); });
  });

  it('shows loading state while submitting', async () => {
    const user = userEvent.setup();
    let resolveLogin: any;
    mockLogin.mockReturnValue(new Promise(r => { resolveLogin = r; }));
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), 'test@test.com');
    await user.type(screen.getByLabelText(/^password$/i), '1234');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(screen.getByText('Signing in…')).toBeInTheDocument();
    await act(async () => {
      resolveLogin({ id: 1, role: 'member', full_name: 'Test', email: 'test@test.com' });
    });
  });

  it('has a theme toggle button', () => {
    renderWithProviders(<LoginPage />);
    expect(screen.getByRole('button', { name: /theme/i })).toBeInTheDocument();
  });
});
