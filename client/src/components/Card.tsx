interface CardProps {
  children: React.ReactNode;
  className?: string;
  gradient?: boolean;
}

export default function Card({ children, className = '', gradient = false }: CardProps) {
  const base = gradient
    ? 'bg-brand-gradient text-white shadow-xl shadow-brand-500/20 rounded-2xl'
    : 'bg-white dark:bg-surface-dark border border-gray-100 dark:border-gray-800/60 rounded-2xl shadow-sm';
  return (
    <div className={`${base} ${className}`}>
      {children}
    </div>
  );
}
