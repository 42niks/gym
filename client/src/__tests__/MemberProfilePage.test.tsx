import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import MemberProfilePage from '../pages/member/MemberProfilePage.js';
import { renderWithProviders } from './test-utils.js';
import { mockMemberProfile } from './mocks.js';

const { mockApiGet } = vi.hoisted(() => ({ mockApiGet: vi.fn() }));

vi.mock('../context/AuthContext.js', () => ({
  useAuth: () => ({ logout: vi.fn(), user: { id: 2, role: 'member', full_name: 'Alex Kumar', email: 'member@thebase.fit' }, loading: false }),
  AuthProvider: ({ children }: any) => children,
}));

vi.mock('../lib/api.js', async () => {
  const actual = await vi.importActual('../lib/api.js');
  return { ...actual, api: { get: mockApiGet, post: vi.fn(), patch: vi.fn() } };
});

beforeEach(() => { vi.clearAllMocks(); });

describe('MemberProfilePage', () => {
  it('renders profile heading', () => {
    mockApiGet.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<MemberProfilePage />, { route: '/profile' });
    expect(screen.getByRole('heading', { name: 'Profile' })).toBeInTheDocument();
  });

  it('displays member profile data', async () => {
    mockApiGet.mockResolvedValue(mockMemberProfile);
    renderWithProviders(<MemberProfilePage />, { route: '/profile' });
    await waitFor(() => {
      expect(screen.getByText('Alex Kumar')).toBeInTheDocument();
      expect(screen.getByText('member@thebase.fit')).toBeInTheDocument();
      expect(screen.getByText('9876543210')).toBeInTheDocument();
    });
  });

  it('shows name, email, phone, and join date labels', async () => {
    mockApiGet.mockResolvedValue(mockMemberProfile);
    renderWithProviders(<MemberProfilePage />, { route: '/profile' });
    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Email')).toBeInTheDocument();
      expect(screen.getByText('Phone')).toBeInTheDocument();
      expect(screen.getByText('Member since')).toBeInTheDocument();
    });
  });

  it('has nav links to Home and Billing', () => {
    mockApiGet.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<MemberProfilePage />, { route: '/profile' });
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Billing')).toBeInTheDocument();
  });
});
