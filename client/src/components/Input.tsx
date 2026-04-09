import { useId } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  labelClassName?: string;
}

export default function Input({ label, id: propId, labelClassName = '', ...props }: InputProps) {
  const autoId = useId();
  const id = propId ?? autoId;
  const { className = '', ...rest } = props;
  return (
    <div>
      <label
        htmlFor={id}
        className={`mb-2 block font-label text-[0.68rem] font-bold italic uppercase tracking-[0.28em] text-gray-500 dark:text-gray-400 ${labelClassName}`}
      >
        {label}
      </label>
      <input
        id={id}
        {...rest}
        className={`w-full rounded-2xl border border-line bg-white/90 px-4 py-3.5 text-sm font-medium text-gray-900 shadow-sm shadow-black/5 transition-all [color-scheme:light] placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-4 focus:ring-brand-300/25 dark:bg-gray-900/80 dark:text-gray-100 dark:placeholder:text-gray-500 dark:[color-scheme:dark] ${className}`}
      />
    </div>
  );
}
