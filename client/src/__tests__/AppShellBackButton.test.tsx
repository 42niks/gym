import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AppShell from '../components/AppShell.js';

vi.mock('../context/AuthContext.js', () => ({
  useAuth: () => ({ logout: vi.fn() }),
  AuthProvider: ({ children }: any) => children,
}));

vi.mock('../context/ThemeContext.js', () => ({
  useTheme: () => ({ theme: 'light', preference: 'light' }),
}));

vi.mock('../lib/routePreload.js', () => ({
  preloadOwnerShellRoutes: vi.fn(),
  preloadRoute: vi.fn(),
}));

function renderShell(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          element={<AppShell links={[{ to: '/home', label: 'Home', icon: 'home' }]} />}
        >
          <Route path="/home" element={<div>Home</div>} />
          <Route path="/members/2" element={<div>Member</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('AppShell header back button', () => {
  it('shows a back arrow on /members/2', () => {
    renderShell('/members/2');

    const backButton = screen.getByRole('button', { name: /^back$/i });
    expect(backButton).toBeInTheDocument();
    expect(within(backButton).getByText('arrow_back')).toBeInTheDocument();
  });

  it('does not show the back arrow on /home', () => {
    renderShell('/home');
    expect(screen.queryByRole('button', { name: /^back$/i })).not.toBeInTheDocument();
  });

  it('navigates to previous route when header back is clicked', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/home', '/members/2']} initialIndex={1}>
        <Routes>
          <Route
            element={<AppShell links={[{ to: '/home', label: 'Home', icon: 'home' }]} />}
          >
            <Route path="/home" element={<div>Home</div>} />
            <Route path="/members/2" element={<div>Member</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Member')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^back$/i }));
    expect(screen.queryByRole('button', { name: /^back$/i })).not.toBeInTheDocument();
  });
});

