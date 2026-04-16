import Icon from './Icon.js';

const variants = {
  primary:
    'border border-black dark:border-white text-black dark:text-white font-label font-bold italic uppercase tracking-[0.18em] shadow-panel hover:shadow-glow-brand active:translate-y-0',
  secondary:
    'border border-black bg-white/80 text-black shadow-sm shadow-black/5 backdrop-blur-sm dark:border-white dark:bg-surface-dark/75 dark:text-white hover:border-brand-300 hover:bg-brand-50/60 dark:hover:bg-surface-raised/85',
  ghost:
    'text-black dark:text-white font-label font-semibold italic uppercase tracking-[0.16em] hover:bg-white/60 hover:text-black dark:hover:bg-white/5 dark:hover:text-white',
  danger:
    'border border-red-200 bg-red-50/90 text-red-700 font-label font-bold italic uppercase tracking-[0.16em] shadow-sm shadow-black/5 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/45',
} as const;

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: 'sm' | 'md' | 'lg';
  icon?: string;
  iconEnd?: boolean;
}

const duotoneBySize = {
  sm: 'brand-duotone-button-sm',
  md: 'brand-duotone-button-md',
  lg: 'brand-duotone-button-lg',
} as const;

export default function Button({ variant = 'primary', size = 'md', children, className = '', icon, iconEnd = false, ...props }: ButtonProps) {
  const iconEl = icon ? <Icon name={icon} className="text-[1em]" /> : null;
  const isPrimary = variant === 'primary';

  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400 ${isPrimary ? 'relative overflow-hidden isolate p-px' : 'px-5 py-3'} ${variants[variant]} ${className}`}
    >
      {isPrimary ? <span aria-hidden="true" className={`${duotoneBySize[size]} absolute inset-0 rounded-2xl`} /> : null}
      <span className={`relative z-10 inline-flex items-center justify-center gap-2 ${isPrimary ? 'w-full rounded-[calc(1rem-1px)] px-5 py-3' : ''}`}>
        {!iconEnd && iconEl}
        {children}
        {iconEnd && iconEl}
      </span>
    </button>
  );
}
