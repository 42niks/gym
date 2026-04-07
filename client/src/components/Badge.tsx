const variants = {
  green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  gray: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
} as const;

interface BadgeProps {
  variant: keyof typeof variants;
  children: React.ReactNode;
}

export default function Badge({ variant, children }: BadgeProps) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${variants[variant]}`}>
      {children}
    </span>
  );
}
