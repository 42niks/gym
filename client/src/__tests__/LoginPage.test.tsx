import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
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
  it('renders login form with email and password fields', () => {
    renderWithProviders(<LoginPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('renders the BASE brand lockup', () => {
    renderWithProviders(<LoginPage />);
    expect(screen.getByAltText('BASE')).toBeInTheDocument();
    expect(screen.getByText('Your Strength Habitat')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('calls login and navigates to /owner for owner role', async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValue({ id: 1, role: 'owner', full_name: 'Sam', email: 'owner@thebase.fit' });
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), 'owner@thebase.fit');
    await user.type(screen.getByLabelText(/password/i), '9999999999');
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
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => { expect(mockNavigate).toHaveBeenCalledWith('/home', { replace: true }); });
  });

  it('displays error message on login failure', async () => {
    const user = userEvent.setup();
    const { ApiError } = await import('../lib/api.js');
    mockLogin.mockRejectedValue(new ApiError(401, 'Invalid email or password'));
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), 'bad@email.com');
    await user.type(screen.getByLabelText(/password/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => { expect(screen.getByText('Authentication Failed')).toBeInTheDocument(); });
  });

  it('shows loading state while submitting', async () => {
    const user = userEvent.setup();
    let resolveLogin: any;
    mockLogin.mockReturnValue(new Promise(r => { resolveLogin = r; }));
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), 'test@test.com');
    await user.type(screen.getByLabelText(/password/i), '1234');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(screen.getByText('Signing in…')).toBeInTheDocument();
    resolveLogin({ id: 1, role: 'member', full_name: 'Test', email: 'test@test.com' });
  });

  it('has a theme toggle button', () => {
    renderWithProviders(<LoginPage />);
    expect(screen.getByRole('button', { name: /theme/i })).toBeInTheDocument();
  });
});
