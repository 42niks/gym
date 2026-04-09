import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { useTheme } from '../context/ThemeContext.js';
import ThemeToggle from './ThemeToggle.js';
import Icon from './Icon.js';

interface NavLink {
  to: string;
  label: string;
  icon?: string;
}

export default function NavBar({ links, fixed = false }: { links: NavLink[]; fixed?: boolean }) {
  const { logout } = useAuth();
  const { theme } = useTheme();
  const location = useLocation();

  return (
    <div
      className={
        fixed
          ? 'fixed inset-x-0 top-0 z-30 px-2 py-2 sm:px-4 sm:py-4'
          : ''
      }
    >
      <nav className="border-b border-white/60 bg-white/72 px-4 py-3 shadow-glass backdrop-blur-xl dark:border-white/10 dark:bg-surface-dark/72">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3">
          <Link to="/" className="flex flex-col items-start gap-1">
            <img
              src={theme === 'dark' ? '/base-wordmark-dark.png' : '/base-wordmark-light.png'}
              alt="BASE"
              className="h-8 w-auto"
          />
          <span className="hidden font-brand text-[0.5rem] font-black uppercase tracking-[0.22em] text-[#226350] dark:text-[#e00b0b] sm:inline">
            YOUR STRENGTH HABITAT
          </span>
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {links.map(l => (
            <Link
              key={l.to}
              to={l.to}
              className={`inline-flex items-center gap-1.5 rounded-2xl border px-3 py-2 font-label text-[0.68rem] font-bold italic uppercase tracking-[0.18em] transition-all ${
                location.pathname === l.to
                  ? 'border-white/70 bg-white bg-brand-gradient text-gray-900 shadow-panel dark:border-white/10 dark:bg-surface-dark dark:bg-brand-gradient-dark dark:text-white'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:border-white/55 hover:bg-white/60 hover:text-gray-900 dark:hover:border-white/10 dark:hover:bg-white/5 dark:hover:text-white'
              }`}
            >
              {l.icon ? <Icon name={l.icon} className="text-[1rem]" /> : null}
              {l.label}
            </Link>
          ))}
          <ThemeToggle />
          <button
            onClick={logout}
            className="inline-flex items-center gap-1.5 rounded-2xl border border-transparent px-3 py-2 font-label text-[0.68rem] font-bold italic uppercase tracking-[0.18em] text-gray-500 transition-all hover:border-white/55 hover:bg-white/60 hover:text-gray-900 dark:text-gray-400 dark:hover:border-white/10 dark:hover:bg-white/5 dark:hover:text-white"
          >
            <Icon name="logout" className="text-[1rem]" />
            Out
          </button>
        </div>
        </div>
      </nav>
    </div>
  );
}
