import Icon from './Icon.js';

const variants = {
  green: 'bg-brand-500 text-white dark:bg-brand-300 dark:text-black',
  blue: 'bg-accent-500 text-white dark:bg-accent-400 dark:text-black',
  orange: 'bg-energy-300 text-black dark:bg-energy-300 dark:text-black',
  gray: 'bg-black/10 text-black dark:bg-white/12 dark:text-white',
  red: 'bg-red-500 text-white dark:bg-red-400 dark:text-black',
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
