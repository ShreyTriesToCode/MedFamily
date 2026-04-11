import { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost bg-transparent text-text-secondary',
  outline: 'btn-outline',
  danger: 'btn-danger',
};

const sizeClasses: Record<Size, string> = {
  sm: 'h-9 rounded-full px-3.5 text-sm',
  md: 'h-11 rounded-full px-4.5 text-sm',
  lg: 'h-12 rounded-full px-5 text-base',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  fullWidth = false,
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const motionProps: HTMLMotionProps<'button'> = {
    whileHover: disabled || loading ? undefined : { y: -1, scale: 1.01 },
    whileTap: disabled || loading ? undefined : { scale: 0.98 },
    transition: { type: 'spring', stiffness: 360, damping: 28 },
  };

  return (
    <motion.button
      className={cn(
        'inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200',
        'focus-visible:ring-soft disabled:cursor-not-allowed disabled:opacity-55',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && 'w-full',
        className
      )}
      disabled={disabled || loading}
      {...motionProps}
      {...(props as HTMLMotionProps<'button'>)}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      <span>{children}</span>
    </motion.button>
  );
}
