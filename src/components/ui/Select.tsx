import { forwardRef, type SelectHTMLAttributes } from 'react';
import type { SelectOption } from '@/lib/types';
import { cn } from '@/utils/cn';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  error?: string;
  helperText?: string;
  placeholder?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, options, error, helperText, placeholder = 'Select an option', className, ...props },
  ref
) {
  return (
    <label className="block w-full">
      {label ? <span className="mb-2 block text-sm font-semibold text-text-primary">{label}</span> : null}
      <select
        ref={ref}
        className={cn(
          'field-surface w-full rounded-3xl px-4 py-3 text-sm backdrop-blur transition-all focus:outline-none disabled:cursor-not-allowed disabled:bg-background-strong',
          error ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-100/70' : '',
          className
        )}
        {...props}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <span className="mt-1.5 block text-xs font-medium text-danger-600">{error}</span> : null}
      {!error && helperText ? <span className="mt-1.5 block text-xs text-text-secondary">{helperText}</span> : null}
    </label>
  );
});

export default Select;
