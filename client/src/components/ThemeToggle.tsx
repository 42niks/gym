import { useTheme } from '../context/ThemeContext.js';

const icons: Record<string, string> = {
  light: 'light_mode',
  dark: 'dark_mode',
  system: 'computer',
};

const next: Record<string, 'light' | 'dark' | 'system'> = {
  system: 'light',
  light: 'dark',
  dark: 'system',
};

export default function ThemeToggle() {
  const { preference, setPreference } = useTheme();
  return (
    <button
      onClick={() => setPreference(next[preference])}
      className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black bg-white/82 text-black shadow-glass backdrop-blur-md transition-all hover:-translate-y-0.5 hover:text-black dark:border-white dark:bg-surface-dark/82 dark:text-white dark:hover:bg-surface-raised/88 dark:hover:text-white"
      aria-label={`Theme: ${preference}. Click to switch.`}
      title={`Theme: ${preference}`}
    >
      <span className="material-symbols-outlined text-[1.15rem]">{icons[preference]}</span>
    </button>
  );
}
