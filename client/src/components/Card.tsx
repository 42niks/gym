interface CardProps {
  children: React.ReactNode;
  className?: string;
  gradient?: boolean;
}

export default function Card({ children, className = '', gradient = false }: CardProps) {
  const base = gradient
    ? 'rounded-[1.75rem] border border-black bg-white bg-brand-gradient text-black shadow-panel dark:border-white dark:bg-surface-dark dark:bg-brand-gradient-dark dark:text-white'
    : 'glass-panel';
  return (
    <div className={`${base} ${className}`}>
      {children}
    </div>
  );
}
