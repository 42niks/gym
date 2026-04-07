import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import ThemeToggle from './ThemeToggle.js';

interface NavLink {
  to: string;
  label: string;
}

export default function NavBar({ links }: { links: NavLink[] }) {
  const { logout } = useAuth();
  const location = useLocation();

  return (
    <nav className="bg-white dark:bg-surface-dark border-b border-gray-100 dark:border-gray-800 px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
      <Link to="/" className="flex items-center gap-2">
        <img src="/logo.svg" alt="BASE" className="h-7 w-7" />
        <span className="text-lg font-black tracking-tighter text-gray-900 dark:text-white">BASE</span>
      </Link>
      <div className="flex items-center gap-1">
        {links.map(l => (
          <Link
            key={l.to}
            to={l.to}
            className={`text-sm px-3 py-1.5 rounded-lg transition-colors font-medium ${
              location.pathname === l.to
                ? 'bg-brand-500 text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            {l.label}
          </Link>
        ))}
        <ThemeToggle />
        <button
          onClick={logout}
          className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          Out
        </button>
      </div>
    </nav>
  );
}
