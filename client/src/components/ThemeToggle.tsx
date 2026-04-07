import { useTheme } from '../context/ThemeContext.js';

const icons: Record<string, string> = {
  light: '☀️',
  dark: '🌙',
  system: '💻',
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
      className="w-8 h-8 flex items-center justify-center rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      aria-label={`Theme: ${preference}. Click to switch.`}
      title={`Theme: ${preference}`}
    >
      {icons[preference]}
    </button>
  );
}
