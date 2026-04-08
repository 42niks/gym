import Icon from './Icon.js';

const variants = {
  green: 'bg-brand-500 text-brand-800 dark:bg-brand-300 dark:text-gray-950',
  blue: 'bg-accent-500 text-white dark:bg-accent-400 dark:text-gray-950',
  orange: 'bg-energy-300 text-gray-950 dark:bg-energy-300 dark:text-gray-950',
  gray: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-100',
  red: 'bg-red-500 text-white dark:bg-red-400 dark:text-gray-950',
} as const;

interface BadgeProps {
  variant: keyof typeof variants;
  children: React.ReactNode;
  icon?: string;
}

export default function Badge({ variant, children, icon }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-2xl px-3 py-1.5 font-label text-[0.62rem] font-bold italic uppercase tracking-[0.18em] shadow-sm shadow-black/5 ${variants[variant]}`}>
      {icon ? <Icon name={icon} className="text-[0.9rem]" /> : null}
      {children}
    </span>
  );
}
