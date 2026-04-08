interface CardProps {
  children: React.ReactNode;
  className?: string;
  gradient?: boolean;
}

export default function Card({ children, className = '', gradient = false }: CardProps) {
  const base = gradient
    ? 'rounded-[1.75rem] border border-white/70 bg-white bg-brand-gradient text-gray-900 shadow-panel dark:border-white/10 dark:bg-surface-dark dark:bg-brand-gradient-dark dark:text-white'
    : 'glass-panel';
  return (
    <div className={`${base} ${className}`}>
      {children}
    </div>
  );
}
