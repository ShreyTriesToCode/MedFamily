import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import Header from '@/components/layout/Header';
import MobileNav from '@/components/layout/MobileNav';

interface LayoutProps {
  children: ReactNode;
  pageTitle?: string;
}

export default function Layout({ children, pageTitle }: LayoutProps) {
  return (
    <div className="page-backdrop min-h-screen">
      <Header pageTitle={pageTitle} />
      <motion.main
        className="relative z-10 mx-auto w-full max-w-[1380px] px-4 pb-28 pt-5 sm:px-6 sm:pb-10 lg:pt-8 xl:px-8 2xl:px-10"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
      >
        {children}
      </motion.main>
      <MobileNav />
    </div>
  );
}
