import { forwardRef, type InputHTMLAttributes, type ReactNode, type Ref, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

interface BaseProps {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: ReactNode;
  suffix?: ReactNode;
}

type InputProps = BaseProps &
  InputHTMLAttributes<HTMLInputElement> & {
    multiline?: false;
  };

type TextareaProps = BaseProps &
  TextareaHTMLAttributes<HTMLTextAreaElement> & {
    multiline: true;
  };

type Props = InputProps | TextareaProps;

const inputBase =
  'field-surface w-full rounded-3xl px-4 py-3 text-sm backdrop-blur transition-all focus:outline-none disabled:cursor-not-allowed disabled:bg-background-strong';

const Input = forwardRef<HTMLInputElement | HTMLTextAreaElement, Props>(function Input(
  { label, error, helperText, icon, suffix, className, ...props },
  ref
) {
  const sharedClassName = cn(
    inputBase,
    icon ? 'pl-11' : '',
    suffix ? 'pr-12' : '',
    error ? 'border-danger-500 focus:ring-danger-100/70 focus:border-danger-500' : 'border-border',
    className
  );

  return (
    <label className="block w-full">
      {label ? <span className="mb-2 block text-sm font-semibold text-text-primary">{label}</span> : null}
      <span className="relative block">
        {icon ? (
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary">
            {icon}
          </span>
        ) : null}
        {suffix ? (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary">
            {suffix}
          </span>
        ) : null}
        {'multiline' in props && props.multiline ? (
          <textarea
            ref={ref as Ref<HTMLTextAreaElement>}
            className={cn(sharedClassName, 'min-h-28 resize-y')}
            {...(props as TextareaHTMLAttributes<HTMLTextAreaElement>)}
          />
        ) : (
          <input
            ref={ref as Ref<HTMLInputElement>}
            className={sharedClassName}
            {...(props as InputHTMLAttributes<HTMLInputElement>)}
          />
        )}
      </span>
      {error ? <span className="mt-1.5 block text-xs font-medium text-danger-600">{error}</span> : null}
      {!error && helperText ? <span className="mt-1.5 block text-xs text-text-secondary">{helperText}</span> : null}
    </label>
  );
});

export default Input;
