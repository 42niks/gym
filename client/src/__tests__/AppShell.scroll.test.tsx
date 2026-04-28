import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell.js';

vi.mock('../context/AuthContext.js', () => ({
  useAuth: () => ({ logout: vi.fn() }),
}));

vi.mock('../context/ThemeContext.js', () => ({
  useTheme: () => ({ theme: 'light', preference: 'light' }),
}));

vi.mock('../lib/routePreload.js', () => ({
  preloadOwnerShellRoutes: vi.fn(),
  preloadRoute: vi.fn(),
}));

function ListPage() {
  return (
    <div>
      <h1>List Page</h1>
      <Link to="/detail">Open detail</Link>
    </div>
  );
}

function DetailPage() {
  const navigate = useNavigate();
  return (
    <div>
      <h1>Detail Page</h1>
      <button type="button" onClick={() => navigate(-1)}>
        Back
      </button>
    </div>
  );
}

function renderShell(initialEntries: string[]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route
          element={<AppShell links={[{ to: '/list', label: 'List', icon: 'list' }, { to: '/detail', label: 'Detail', icon: 'info' }]} />}
        >
          <Route path="/list" element={<ListPage />} />
          <Route path="/detail" element={<DetailPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('AppShell scroll restoration', () => {
  let scrollYValue = 0;
  let scrollToSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    sessionStorage.clear();
    scrollYValue = 0;

    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      get: () => scrollYValue,
    });

    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 800,
    });
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      configurable: true,
      value: 5000,
    });

    scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation((x: number | ScrollToOptions, y?: number) => {
      if (typeof x === 'object') {
        scrollYValue = typeof x.top === 'number' ? x.top : scrollYValue;
        return;
      }
      scrollYValue = typeof y === 'number' ? y : scrollYValue;
    });
  });

  afterEach(() => {
    scrollToSpy.mockRestore();
  });

  it('scrolls to top on new page navigation', async () => {
    const user = userEvent.setup();
    renderShell(['/list']);

    await screen.findByText('List Page');

    scrollYValue = 420;
    fireEvent.scroll(window);

    await user.click(screen.getByRole('link', { name: /open detail/i }));
    await screen.findByText('Detail Page');

    await waitFor(() => {
      expect(scrollToSpy).toHaveBeenCalledWith(0, 0);
    });
  });

  it('restores previous scroll position on back navigation', async () => {
    const user = userEvent.setup();
    renderShell(['/list']);

    await screen.findByText('List Page');

    scrollYValue = 640;
    fireEvent.scroll(window);

    await user.click(screen.getByRole('link', { name: /open detail/i }));
    await screen.findByText('Detail Page');

    scrollYValue = 120;
    fireEvent.scroll(window);

    await user.click(screen.getByRole('button', { name: /^back$/i }));
    await screen.findByText('List Page');

    await waitFor(() => {
      expect(scrollToSpy).toHaveBeenCalledWith(0, 640);
    });
  });
});
