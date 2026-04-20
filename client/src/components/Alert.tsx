const variants = {
  error: 'border-red-200 bg-red-50/90 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300',
  warning: 'border-energy-300 bg-energy-50/90 text-black dark:border-energy-500/40 dark:bg-energy-500/15 dark:text-energy-100',
  info: 'border-brand-300 bg-brand-50/90 text-brand-800 dark:border-brand-400/40 dark:bg-brand-700/65 dark:text-brand-100 dark:shadow-[inset_0_1px_0_rgb(255_255_255_/_0.05)] dark:backdrop-blur-sm',
  success: 'border-brand-300 bg-brand-50/90 text-brand-800 dark:border-brand-400/40 dark:bg-brand-700/65 dark:text-brand-100 dark:shadow-[inset_0_1px_0_rgb(255_255_255_/_0.05)] dark:backdrop-blur-sm',
} as const;

interface AlertProps {
  variant: keyof typeof variants;
  children: React.ReactNode;
}

export default function Alert({ variant, children }: AlertProps) {
  return (
    <div className={`rounded-2xl border px-4 py-3.5 text-sm font-medium shadow-sm shadow-black/5 ${variants[variant]}`}>
      {children}
    </div>
  );
}
