import { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigationType, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { useTheme } from '../context/ThemeContext.js';
import ThemeToggle from './ThemeToggle.js';
import Icon from './Icon.js';
import Spinner from './Spinner.js';
import { preloadOwnerShellRoutes, preloadRoute } from '../lib/routePreload.js';

interface AppShellLink {
  to: string;
  label: string;
  icon: string;
}

interface AppShellProps {
  links: AppShellLink[];
}

export default function AppShell({ links }: AppShellProps) {
  const { logout } = useAuth();
  const { theme, preference } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [navPending, setNavPending] = useState(false);
  const isNavigatingRef = useRef(false);
  const homeHref = links[0]?.to ?? '/';
  const themeLabel = preference[0].toUpperCase() + preference.slice(1);
  const currentUrlKey = `${location.pathname}${location.search}`;

  const showBackInHeader =
    /^\/members\/\d+$/.test(location.pathname) || // Owner: member detail
    /^\/members\/new$/.test(location.pathname) || // Owner: create member
    /^\/members\/\d+\/subscriptions\/new$/.test(location.pathname) || // Owner: create subscription
    /^\/members\/\d+\/subscriptions\/\d+\/attendance$/.test(location.pathname) || // Owner: subscription attendance
    location.pathname === '/packages/new' || // Owner: create package
    /^\/subscription(\/\d+\/attendance)?$/.test(location.pathname); // Member: subscription pages

  function handleHeaderBack() {
    // Prefer a real "back" experience; if there's no history, fall back to the home route.
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(homeHref);
  }

  function saveScrollSnapshot(routeKey: string, routeUrlKey: string) {
    try {
      const y = String(window.scrollY);
      sessionStorage.setItem(`scroll:key:${routeKey}`, y);
      sessionStorage.setItem(`scroll:url:${routeUrlKey}`, y);
    } catch {
      // Ignore storage quota/privacy mode failures.
    }
  }

  useEffect(() => {
    setDrawerOpen(false);
    setNavPending(false);
    isNavigatingRef.current = false;
  }, [location.pathname]);

  useEffect(() => {
    const preload = () => preloadOwnerShellRoutes();
    const idleId = 'requestIdleCallback' in window
      ? window.requestIdleCallback(preload, { timeout: 1800 })
      : window.setTimeout(preload, 900);

    return () => {
      if ('cancelIdleCallback' in window && typeof idleId === 'number') {
        window.cancelIdleCallback(idleId);
      } else {
        window.clearTimeout(idleId as number);
      }
    };
  }, []);

  useEffect(() => {
    function handlePopState() {
      isNavigatingRef.current = true;
      saveScrollSnapshot(location.key, currentUrlKey);
      setNavPending(true);
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [location.key, currentUrlKey]);

  useEffect(() => {
    if (!navPending) return;
    const timeout = window.setTimeout(() => setNavPending(false), 1800);
    return () => window.clearTimeout(timeout);
  }, [navPending]);

  useEffect(() => {
    document.body.classList.toggle('drawer-open', drawerOpen);
    return () => document.body.classList.remove('drawer-open');
  }, [drawerOpen]);

  useEffect(() => {
    if (!('scrollRestoration' in window.history)) return;
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);

  useEffect(() => {
    const saveCurrentPosition = () => saveScrollSnapshot(location.key, currentUrlKey);
    const handleScroll = () => {
      if (isNavigatingRef.current) return;
      saveCurrentPosition();
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('beforeunload', saveCurrentPosition);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('beforeunload', saveCurrentPosition);
    };
  }, [location.key, currentUrlKey]);

  useLayoutEffect(() => {
    let restoredY = 0;

    try {
      if (navigationType === 'POP') {
        const byKey = sessionStorage.getItem(`scroll:key:${location.key}`);
        const byUrl = sessionStorage.getItem(`scroll:url:${currentUrlKey}`);
        const candidate = byKey ?? byUrl;
        restoredY = candidate === null ? 0 : Number.parseInt(candidate, 10);
      } else {
        const byUrl = sessionStorage.getItem(`scroll:url:${currentUrlKey}`);
        restoredY = byUrl === null ? 0 : Number.parseInt(byUrl, 10);
      }
    } catch {
      restoredY = 0;
    }

    const targetY = Number.isFinite(restoredY) ? Math.max(0, restoredY) : 0;
    if (targetY === 0) {
      window.scrollTo(0, 0);
      return;
    }

    let frame = 0;
    let cancelled = false;
    const maxFrames = 24;

    const tryRestore = () => {
      if (cancelled) return;
      const maxScrollableY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const clampedTarget = Math.min(targetY, maxScrollableY);
      window.scrollTo(0, clampedTarget);

      // Retry for a few frames so async list content can mount before final restore.
      if (frame < maxFrames && maxScrollableY < targetY - 8) {
        frame += 1;
        window.requestAnimationFrame(tryRestore);
      }
    };

    window.requestAnimationFrame(tryRestore);
    return () => {
      cancelled = true;
    };
  }, [location.key, currentUrlKey, navigationType]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setDrawerOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  function getInternalAnchor(target: EventTarget | null) {
    if (!(target instanceof Element)) return null;
    const anchor = target.closest('a[href]');
    if (!(anchor instanceof HTMLAnchorElement)) return null;
    if (anchor.target && anchor.target !== '_self') return null;
    if (anchor.hasAttribute('download')) return null;
    const url = new URL(anchor.href, window.location.href);
    if (url.origin !== window.location.origin) return null;
    return { anchor, url };
  }

  function handleNavigationIntent(event: React.MouseEvent<HTMLDivElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    const internal = getInternalAnchor(event.target);
    if (!internal) return;
    const currentPath = `${location.pathname}${location.search}`;
    const nextPath = `${internal.url.pathname}${internal.url.search}`;
    if (nextPath !== currentPath) {
      isNavigatingRef.current = true;
      saveScrollSnapshot(location.key, currentUrlKey);
      setNavPending(true);
      internal.anchor.dataset.navPending = 'true';
    }
  }

  function handlePreloadIntent(event: React.SyntheticEvent<HTMLDivElement>) {
    const internal = getInternalAnchor(event.target);
    if (!internal) return;
    void preloadRoute(internal.url.pathname);
  }

  return (
    <div
      className="relative min-h-screen"
      onClickCapture={handleNavigationIntent}
      onPointerOverCapture={handlePreloadIntent}
      onFocusCapture={handlePreloadIntent}
    >
      <div
        aria-hidden="true"
        className={`fixed inset-x-0 top-0 z-[70] h-1 origin-left bg-brand-500 shadow-glow-brand transition-opacity duration-150 dark:bg-accent-400 ${
          navPending ? 'navigation-progress opacity-100' : 'opacity-0'
        }`}
      />
      <div
        aria-hidden="true"
        className="brand-duotone-page pointer-events-none fixed inset-0"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-5 top-4 h-24 rounded-full bg-white/24 blur-3xl dark:bg-white/5"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -left-12 top-24 h-44 w-44 rounded-full bg-accent-500/12 blur-3xl dark:bg-accent-500/10"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed right-[-3.5rem] top-36 h-40 w-40 rounded-full bg-brand-400/16 blur-3xl dark:bg-brand-400/14"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed bottom-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-energy-300/10 blur-3xl dark:bg-energy-300/8"
      />

      <header className="fixed inset-x-0 top-0 z-50 pt-2 sm:pt-4">
        <div className="mx-auto max-w-6xl px-2 sm:px-4">
          <nav className="w-full overflow-hidden rounded-shell border border-black bg-white/88 px-4 py-3 shadow-glass backdrop-blur-xl dark:border-white dark:bg-surface-dark/88">
            <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center">
              <div className="flex items-center justify-start">
                {showBackInHeader ? (
                  <button
                    type="button"
                    aria-label="Back"
                    onClick={handleHeaderBack}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-black text-black transition-all hover:bg-black/[0.05] hover:text-black active:translate-y-px active:scale-[0.98] dark:border-white dark:text-white dark:hover:bg-white/[0.06] dark:hover:text-white"
                  >
                    <Icon name="arrow_back" className="text-[1.35rem]" />
                  </button>
                ) : (
                  <div aria-hidden="true" />
                )}
              </div>
              <Link
                to={homeHref}
                className="flex min-w-0 items-center justify-center gap-3 transition-all active:translate-y-px active:opacity-75"
              >
                <img
                  src={theme === 'dark' ? '/base-wordmark-dark.png' : '/base-wordmark-light.png'}
                  alt="BASE"
                  width={4000}
                  height={1627}
                  decoding="async"
                  className="h-10 w-auto shrink-0 sm:h-11"
                />
              </Link>

              <div className="flex justify-end">
                <button
                  type="button"
                  aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
                  aria-expanded={drawerOpen}
                  onClick={() => setDrawerOpen(open => !open)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-black text-black transition-all hover:bg-black/[0.05] hover:text-black active:translate-y-px active:scale-[0.98] dark:border-white dark:text-white dark:hover:bg-white/[0.06] dark:hover:text-white"
                >
                  <Icon name={drawerOpen ? 'close' : 'menu'} className="text-[1.35rem]" />
                </button>
              </div>
            </div>
          </nav>
        </div>
      </header>

      <div
        className={`fixed inset-0 z-40 ${drawerOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
        aria-hidden={!drawerOpen}
      >
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setDrawerOpen(false)}
          className={`absolute inset-0 bg-black/18 transition-opacity duration-300 ${drawerOpen ? 'opacity-100' : 'opacity-0'}`}
        />

        <aside
          className={`absolute bottom-2 right-2 top-[5.25rem] w-[min(18rem,82vw)] max-h-[calc(100dvh-5.75rem)] transition-transform duration-300 ease-out sm:bottom-4 sm:right-4 sm:top-[6.5rem] sm:max-h-[calc(100dvh-7.5rem)] ${
            drawerOpen ? 'translate-x-0' : 'translate-x-[calc(100%+1rem)]'
          }`}
        >
          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-shell border border-black bg-white/94 px-4 py-5 shadow-panel backdrop-blur-xl dark:border-white dark:bg-surface-dark/94">
            <div className="border-b border-black pb-4 dark:border-white">
              <p className="font-label text-[0.68rem] font-bold uppercase tracking-[0.24em] text-black dark:text-white">
                Navigation
              </p>
            </div>

            <nav className="mt-5 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain">
              {links.map(link => {
                const active = location.pathname === link.to || location.pathname.startsWith(`${link.to}/`);
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`inline-flex items-center gap-3 rounded-2xl px-4 py-3 font-label text-[0.74rem] font-bold uppercase tracking-[0.16em] transition-all active:translate-y-px active:scale-[0.99] ${
                      active
                        ? 'bg-brand-500 text-white shadow-panel dark:bg-accent-500 dark:text-black'
                        : 'text-black hover:bg-black/[0.04] hover:text-black dark:text-white dark:hover:bg-white/[0.06] dark:hover:text-white'
                    }`}
                  >
                    <Icon name={link.icon} className="text-[1.15rem]" />
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-4 space-y-3 border-t border-black pt-4 dark:border-white">
              <div className="flex items-center justify-between rounded-2xl border border-black bg-black/[0.03] px-4 py-3 dark:border-white dark:bg-white/[0.04]">
                <div>
                  <p className="font-label text-[0.62rem] font-bold uppercase tracking-[0.18em] text-black dark:text-white">
                    Theme
                  </p>
                  <p className="mt-1 text-sm font-semibold text-black dark:text-white">{themeLabel}</p>
                </div>
                <ThemeToggle />
              </div>

              <button
                type="button"
                onClick={logout}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-black bg-black/[0.04] px-4 py-3 font-label text-[0.74rem] font-bold uppercase tracking-[0.16em] text-black transition-all hover:bg-black/[0.08] hover:text-black active:translate-y-px active:scale-[0.99] dark:border-white dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.08] dark:hover:text-white"
              >
                <Icon name="logout" className="text-[1.1rem]" />
                Sign out
              </button>
            </div>
          </div>
        </aside>
      </div>

      <main className="page-content page-content-with-fixed-nav relative z-10 mx-auto min-h-screen max-w-6xl">
        <Suspense fallback={<div className="min-h-[55vh] flex items-center justify-center"><Spinner /></div>}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
