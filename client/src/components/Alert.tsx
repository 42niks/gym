const variants = {
  error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400',
  warning: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400',
  info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400',
  success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400',
} as const;

interface AlertProps {
  variant: keyof typeof variants;
  children: React.ReactNode;
}

export default function Alert({ variant, children }: AlertProps) {
  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${variants[variant]}`}>
      {children}
    </div>
  );
}
