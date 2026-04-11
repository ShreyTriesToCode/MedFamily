import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, HeartCrack } from 'lucide-react';
import Button from '@/components/ui/Button';
import { ROUTES } from '@/lib/constants';


export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 text-center">
      {/* Decorative orbs */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary-100/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-accent-100/30 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10"
      >
        <motion.div
          className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-linear-to-br from-primary-100 to-accent-100 shadow-sm"
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          <HeartCrack className="h-10 w-10 text-primary-500" />
        </motion.div>

        <h1 className="text-8xl font-extrabold gradient-text">404</h1>
        <p className="mt-4 text-xl font-bold text-text-primary">Page Not Found</p>
        <p className="mt-2 max-w-md text-sm text-text-secondary leading-relaxed">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-8">
          <Button
            onClick={() => navigate(ROUTES.DASHBOARD)}
            icon={<Home className="h-4 w-4" />}
          >
            Back to Home
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
