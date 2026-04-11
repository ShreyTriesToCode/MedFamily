import type { ComponentType } from 'react';
import {
  Activity,
  BellRing,
  CalendarClock,
  FolderKanban,
  LayoutDashboard,
  PackageSearch,
  ShieldCheck,
  Siren,
  Stethoscope,
} from 'lucide-react';
import { ROUTES } from '@/lib/constants';
import type { AppRole } from '@/lib/types';

export interface NavItem {
  path: string;
  label: string;
  mobileLabel?: string;
  icon: ComponentType<{ className?: string }>;
  priority: 'primary' | 'secondary';
}

export const NAV_BY_ROLE: Record<AppRole, NavItem[]> = {
  patient_admin: [
    { path: ROUTES.DASHBOARD, label: 'Dashboard', mobileLabel: 'Home', icon: LayoutDashboard, priority: 'primary' },
    { path: ROUTES.RECORDS, label: 'Records', icon: FolderKanban, priority: 'primary' },
    { path: ROUTES.REMINDERS, label: 'Reminders', mobileLabel: 'Care', icon: BellRing, priority: 'primary' },
    { path: ROUTES.APPOINTMENTS, label: 'Appointments', mobileLabel: 'Visits', icon: CalendarClock, priority: 'primary' },
    { path: ROUTES.PRESCRIPTIONS, label: 'Prescriptions', mobileLabel: 'Rx', icon: Stethoscope, priority: 'secondary' },
    { path: ROUTES.HEALTH, label: 'Health', icon: Activity, priority: 'secondary' },
    { path: ROUTES.EMERGENCY, label: 'Emergency', mobileLabel: 'SOS', icon: Siren, priority: 'secondary' },
    { path: ROUTES.ACCESS_CONTROL, label: 'Access', icon: ShieldCheck, priority: 'secondary' },
    { path: ROUTES.ORDERS, label: 'Orders', icon: PackageSearch, priority: 'secondary' },
    { path: ROUTES.NOTIFICATIONS, label: 'Alerts', icon: BellRing, priority: 'secondary' },
  ],
  family_member: [
    { path: ROUTES.DASHBOARD, label: 'Dashboard', mobileLabel: 'Home', icon: LayoutDashboard, priority: 'primary' },
    { path: ROUTES.RECORDS, label: 'Records', icon: FolderKanban, priority: 'primary' },
    { path: ROUTES.REMINDERS, label: 'Reminders', mobileLabel: 'Care', icon: BellRing, priority: 'primary' },
    { path: ROUTES.APPOINTMENTS, label: 'Appointments', mobileLabel: 'Visits', icon: CalendarClock, priority: 'primary' },
    { path: ROUTES.PRESCRIPTIONS, label: 'Prescriptions', mobileLabel: 'Rx', icon: Stethoscope, priority: 'secondary' },
    { path: ROUTES.HEALTH, label: 'Health', icon: Activity, priority: 'secondary' },
    { path: ROUTES.EMERGENCY, label: 'Emergency', mobileLabel: 'SOS', icon: Siren, priority: 'secondary' },
    { path: ROUTES.ORDERS, label: 'Orders', icon: PackageSearch, priority: 'secondary' },
    { path: ROUTES.NOTIFICATIONS, label: 'Alerts', icon: BellRing, priority: 'secondary' },
  ],
  caretaker: [
    { path: ROUTES.DASHBOARD, label: 'Dashboard', mobileLabel: 'Home', icon: LayoutDashboard, priority: 'primary' },
    { path: ROUTES.REMINDERS, label: 'Reminders', mobileLabel: 'Care', icon: BellRing, priority: 'primary' },
    { path: ROUTES.APPOINTMENTS, label: 'Appointments', mobileLabel: 'Visits', icon: CalendarClock, priority: 'primary' },
    { path: ROUTES.ORDERS, label: 'Orders', icon: PackageSearch, priority: 'primary' },
    { path: ROUTES.RECORDS, label: 'Records', icon: FolderKanban, priority: 'secondary' },
    { path: ROUTES.PRESCRIPTIONS, label: 'Prescriptions', mobileLabel: 'Rx', icon: Stethoscope, priority: 'secondary' },
    { path: ROUTES.HEALTH, label: 'Health', icon: Activity, priority: 'secondary' },
    { path: ROUTES.EMERGENCY, label: 'Emergency', mobileLabel: 'SOS', icon: Siren, priority: 'secondary' },
    { path: ROUTES.ACCESS_CONTROL, label: 'Access', icon: ShieldCheck, priority: 'secondary' },
    { path: ROUTES.NOTIFICATIONS, label: 'Alerts', icon: BellRing, priority: 'secondary' },
  ],
  doctor: [
    { path: ROUTES.DASHBOARD, label: 'Dashboard', mobileLabel: 'Home', icon: LayoutDashboard, priority: 'primary' },
    { path: ROUTES.RECORDS, label: 'Records', icon: FolderKanban, priority: 'primary' },
    { path: ROUTES.PRESCRIPTIONS, label: 'Prescriptions', mobileLabel: 'Rx', icon: Stethoscope, priority: 'primary' },
    { path: ROUTES.APPOINTMENTS, label: 'Visits', mobileLabel: 'Visits', icon: CalendarClock, priority: 'primary' },
    { path: ROUTES.HEALTH, label: 'Health', icon: Activity, priority: 'secondary' },
    { path: ROUTES.EMERGENCY, label: 'Emergency', mobileLabel: 'SOS', icon: Siren, priority: 'secondary' },
    { path: ROUTES.ACCESS_CONTROL, label: 'Access', icon: ShieldCheck, priority: 'secondary' },
    { path: ROUTES.NOTIFICATIONS, label: 'Alerts', icon: BellRing, priority: 'secondary' },
  ],
  hospital: [
    { path: ROUTES.DASHBOARD, label: 'Dashboard', mobileLabel: 'Home', icon: LayoutDashboard, priority: 'primary' },
    { path: ROUTES.RECORDS, label: 'Records', icon: FolderKanban, priority: 'primary' },
    { path: ROUTES.PRESCRIPTIONS, label: 'Prescriptions', mobileLabel: 'Rx', icon: Stethoscope, priority: 'primary' },
    { path: ROUTES.APPOINTMENTS, label: 'Visits', mobileLabel: 'Visits', icon: CalendarClock, priority: 'primary' },
    { path: ROUTES.HEALTH, label: 'Health', icon: Activity, priority: 'secondary' },
    { path: ROUTES.EMERGENCY, label: 'Emergency', mobileLabel: 'SOS', icon: Siren, priority: 'secondary' },
    { path: ROUTES.ACCESS_CONTROL, label: 'Access', icon: ShieldCheck, priority: 'secondary' },
    { path: ROUTES.NOTIFICATIONS, label: 'Alerts', icon: BellRing, priority: 'secondary' },
  ],
  chemist: [
    { path: ROUTES.DASHBOARD, label: 'Dashboard', mobileLabel: 'Home', icon: LayoutDashboard, priority: 'primary' },
    { path: ROUTES.ORDERS, label: 'Orders', icon: PackageSearch, priority: 'primary' },
    { path: ROUTES.NOTIFICATIONS, label: 'Alerts', icon: BellRing, priority: 'primary' },
    { path: ROUTES.ACCESS_CONTROL, label: 'Access', icon: ShieldCheck, priority: 'secondary' },
    { path: ROUTES.PRESCRIPTIONS, label: 'Prescriptions', mobileLabel: 'Rx', icon: Stethoscope, priority: 'secondary' },
  ],
};

export function getPrimaryNavItems(role: AppRole): NavItem[] {
  return NAV_BY_ROLE[role].filter((item) => item.priority === 'primary').slice(0, 4);
}

export function getSecondaryNavItems(role: AppRole): NavItem[] {
  const primaryPaths = new Set(getPrimaryNavItems(role).map((item) => item.path));
  return NAV_BY_ROLE[role].filter((item) => !primaryPaths.has(item.path));
}
