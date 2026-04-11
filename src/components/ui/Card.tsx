import type { ReactNode } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/utils/cn';

interface CardProps {
  title?: string;
  eyebrow?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

export default function Card({
  title,
  eyebrow,
  children,
  footer,
  className,
  onClick,
  hoverable = false,
}: CardProps) {
  const motionProps: HTMLMotionProps<'div'> = hoverable
    ? {
        whileHover: { y: -2, scale: 1.005 },
        whileTap: onClick ? { scale: 0.995 } : undefined,
        transition: { type: 'spring', stiffness: 320, damping: 28 },
      }
    : {};

  return (
    <motion.div
      className={cn(
        'panel overflow-hidden rounded-[28px] transition-[border-color,box-shadow,transform] duration-200',
        hoverable && 'cursor-pointer hover:border-primary-300/40 hover:shadow-[0_20px_48px_rgba(16,63,95,0.12)]',
        className
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      {...motionProps}
    >
      {title || eyebrow ? (
        <div className="border-b border-border/80 px-5 py-4 sm:px-6">
          {eyebrow ? <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-tertiary">{eyebrow}</p> : null}
          {title ? <h3 className="mt-1 text-base font-bold text-text-primary text-balance">{title}</h3> : null}
        </div>
      ) : null}
      <div className="p-5 sm:p-6">{children}</div>
      {footer ? <div className="border-t border-border/80 px-5 py-4 sm:px-6">{footer}</div> : null}
    </motion.div>
  );
}
