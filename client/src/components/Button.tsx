const variants = {
  primary: 'bg-brand-gradient text-white font-bold shadow-lg shadow-brand-500/30 hover:shadow-brand-500/50 hover:brightness-110 active:brightness-90',
  secondary: 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 font-semibold hover:bg-gray-50 dark:hover:bg-gray-700',
  ghost: 'text-brand-500 dark:text-brand-400 hover:text-brand-600 dark:hover:text-brand-300 font-semibold underline-offset-2 hover:underline',
  danger: 'bg-red-600 hover:bg-red-700 text-white font-bold shadow-sm',
} as const;

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
}

export default function Button({ variant = 'primary', children, className = '', ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={`rounded-xl py-3 px-5 text-sm transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
