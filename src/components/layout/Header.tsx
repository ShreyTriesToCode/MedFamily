import { Bell, HeartPulse, LogOut, MoonStar, SunMedium } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import { useTheme } from '@/context/ThemeContext';
import RoleBadge from '@/components/app/RoleBadge';
import Button from '@/components/ui/Button';
import { ROUTES } from '@/lib/constants';
import { MESSAGES } from '@/lib/constants';
import { NAV_BY_ROLE } from '@/components/layout/navConfig';
import { cn } from '@/utils/cn';
import { showSuccessToast } from '@/utils/errorHandler';

interface HeaderProps {
  pageTitle?: string;
}

export default function Header({ pageTitle }: HeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, role, signOut } = useAuth();
  const { unreadCount } = useNotifications();
  const { theme, toggleTheme } = useTheme();

  const navItems = role ? NAV_BY_ROLE[role] : [];
  const isActivePath = (path: string) =>
    location.pathname === path || (path !== ROUTES.DASHBOARD && location.pathname.startsWith(path));

  const handleLogout = async () => {
    await signOut();
    showSuccessToast(MESSAGES.LOGGED_OUT);
    navigate(ROUTES.LOGIN);
  };

  const renderNavItems = (mode: 'desktop' | 'tablet') =>
    navItems.map(({ path, label, mobileLabel, icon: Icon }) => {
      const active = isActivePath(path);

      return (
        <motion.button
          key={`${mode}-${path}`}
          type="button"
          className={cn(
            'relative inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors',
            mode === 'desktop' ? 'justify-center' : 'shrink-0',
            active ? 'text-primary-700' : 'text-text-secondary hover:text-primary-700'
          )}
          onClick={() => navigate(path)}
          whileTap={{ scale: 0.97 }}
        >
          {active ? (
            <motion.span
              layoutId={mode === 'desktop' ? 'desktop-nav-active' : 'tablet-nav-active'}
              className="theme-active-surface absolute inset-0 rounded-full"
              transition={{ type: 'spring', stiffness: 360, damping: 30 }}
            />
          ) : null}
          <Icon className="relative z-10 h-4 w-4" />
          <span className="relative z-10">{mode === 'tablet' ? mobileLabel ?? label : label}</span>
        </motion.button>
      );
    });

  return (
    <header className="glass sticky top-0 z-40 border-b top-safe">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6 xl:px-8">
        <div className="flex flex-wrap items-center gap-3 py-3">
          <button
            type="button"
            className="theme-chip-strong flex min-w-0 items-center gap-3 rounded-[28px] px-3 py-2.5 soft-shadow transition"
            onClick={() => navigate(ROUTES.DASHBOARD)}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-[22px] bg-linear-to-br from-primary-600 to-teal-500 text-white">
              <HeartPulse className="h-5 w-5" />
            </div>
            <div className="min-w-0 text-left">
              <p className="font-serif text-lg font-semibold text-text-primary">MedFamily</p>
              <p className="truncate text-xs text-text-secondary">
                {pageTitle ?? 'Patient Healthcare Management System'}
              </p>
            </div>
          </button>

          {navItems.length ? (
            <nav className="hidden min-w-0 flex-1 justify-center lg:flex">
              <div className="glass flex max-w-full flex-wrap items-center justify-center gap-1 rounded-[30px] p-1.5 shadow-[0_14px_34px_rgba(16,63,95,0.08)]">
                {renderNavItems('desktop')}
              </div>
            </nav>
          ) : null}

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden xl:block">{role ? <RoleBadge role={role} /> : null}</div>
            <motion.button
              type="button"
              className="theme-chip rounded-full p-3 text-text-secondary transition hover:text-primary-700"
              onClick={toggleTheme}
              whileTap={{ scale: 0.95 }}
              aria-label="Toggle theme"
            >
              {theme === 'light' ? <MoonStar className="h-4.5 w-4.5" /> : <SunMedium className="h-4.5 w-4.5" />}
            </motion.button>
            <motion.button
              type="button"
              className="theme-chip relative rounded-full p-3 text-text-secondary transition hover:text-primary-700"
              onClick={() => navigate(ROUTES.NOTIFICATIONS)}
              whileTap={{ scale: 0.95 }}
              aria-label="Notifications"
            >
              <Bell className="h-4.5 w-4.5" />
              {unreadCount ? (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-coral-500 px-1 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              ) : null}
            </motion.button>
            <Button
              variant="ghost"
              size="sm"
              icon={<LogOut className="h-4 w-4" />}
              className="hidden md:inline-flex"
              onClick={handleLogout}
            >
              {profile?.full_name?.split(' ')[0] ?? 'Sign out'}
            </Button>
            <button
              type="button"
              className="theme-chip rounded-full p-3 text-text-secondary transition hover:text-danger-700 md:hidden"
              onClick={handleLogout}
              aria-label="Sign out"
            >
              <LogOut className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        {navItems.length ? (
          <div className="hidden pb-3 sm:block lg:hidden">
            <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {renderNavItems('tablet')}
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
