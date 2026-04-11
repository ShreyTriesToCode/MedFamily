import { motion } from 'framer-motion';
import { HeartPulse } from 'lucide-react';

interface LoadingSpinnerProps {
  variant?: 'page' | 'inline' | 'button';
}

export default function LoadingSpinner({ variant = 'inline' }: LoadingSpinnerProps) {
  if (variant === 'page') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <motion.div
          className="btn-primary flex h-16 w-16 items-center justify-center rounded-[24px]"
          animate={{ y: [0, -4, 0], scale: [1, 1.02, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        >
          <HeartPulse className="h-8 w-8" />
        </motion.div>
        <div className="space-y-1 text-center">
          <p className="text-sm font-semibold text-text-primary">Preparing your care workspace</p>
          <p className="text-xs text-text-secondary">Loading records, reminders, and secure access.</p>
        </div>
      </div>
    );
  }

  if (variant === 'button') {
    return (
      <motion.span
        className="inline-block h-4 w-4 rounded-full border-2 border-current border-t-transparent"
        animate={{ rotate: 360 }}
        transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
      />
    );
  }

  return (
    <div className="flex justify-center py-8">
      <motion.span
        className="inline-block h-8 w-8 rounded-full border-[3px] border-primary-100 border-t-[var(--brand-solid)]"
        animate={{ rotate: 360 }}
        transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );
}
