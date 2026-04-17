import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OwnerNewMemberPage from '../pages/owner/OwnerNewMemberPage.js';
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
  return { ...actual, api: { get: vi.fn(), post: mockApiPost, patch: vi.fn() } };
});

beforeEach(() => { vi.clearAllMocks(); });

describe('OwnerNewMemberPage', () => {
  it('renders the new member form', () => {
    renderWithProviders(<OwnerNewMemberPage />, { route: '/members/new' });
    expect(screen.getByText('NEW MEMBER')).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/phone/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/join date/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create member/i })).toBeInTheDocument();
  });

  it('has a back link to members', () => {
    renderWithProviders(<OwnerNewMemberPage />, { route: '/members/new' });
    expect(screen.getByRole('link', { name: /arrow_back Members$/ })).toBeInTheDocument();
  });

  it('submits form and navigates to member detail', async () => {
    const user = userEvent.setup();
    mockApiPost.mockResolvedValue({ id: 5, full_name: 'Jane Doe', email: 'jane@example.com', phone: '9876543210', join_date: '2026-04-07', status: 'active' });
    renderWithProviders(<OwnerNewMemberPage />, { route: '/members/new' });

    await user.type(screen.getByLabelText(/full name/i), 'Jane Doe');
    await user.type(screen.getByLabelText(/email/i), 'jane@example.com');
    await user.type(screen.getByLabelText(/phone/i), '9876543210');
    await user.click(screen.getByRole('button', { name: /create member/i }));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/api/members', expect.objectContaining({
        full_name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '9876543210',
      }));
      expect(mockNavigate).toHaveBeenCalledWith('/members/5');
    });
  });

  it('shows error on API failure', async () => {
    const user = userEvent.setup();
    const { ApiError } = await import('../lib/api.js');
    mockApiPost.mockRejectedValue(new ApiError(400, 'Email already exists'));
    renderWithProviders(<OwnerNewMemberPage />, { route: '/members/new' });

    await user.type(screen.getByLabelText(/full name/i), 'Jane');
    await user.type(screen.getByLabelText(/email/i), 'dup@test.com');
    await user.type(screen.getByLabelText(/phone/i), '1234567890');
    await user.click(screen.getByRole('button', { name: /create member/i }));

    await waitFor(() => { expect(screen.getByText('Email already exists')).toBeInTheDocument(); });
  });
});
