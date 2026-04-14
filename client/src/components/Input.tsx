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
        className={`field-label ${labelClassName}`}
      >
        {label}
      </label>
      <input
        id={id}
        {...rest}
        className={`field-control ${className}`}
      />
    </div>
  );
}
