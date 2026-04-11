import type { ComponentType } from 'react';
import { Building2, HeartHandshake, Pill, ShieldPlus, Stethoscope, Users2 } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import type { AppRole } from '@/lib/types';

interface RoleBadgeProps {
  role: AppRole;
}

const ROLE_LABELS: Record<AppRole, string> = {
  patient_admin: 'Patient',
  family_member: 'Patient',
  caretaker: 'Caretaker',
  doctor: 'Doctor',
  hospital: 'Hospital',
  chemist: 'Chemist',
};

const ROLE_VARIANTS: Record<AppRole, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  patient_admin: 'info',
  family_member: 'default',
  caretaker: 'success',
  doctor: 'info',
  hospital: 'info',
  chemist: 'warning',
};

const ROLE_ICONS: Record<AppRole, ComponentType<{ className?: string }>> = {
  patient_admin: HeartHandshake,
  family_member: Users2,
  caretaker: ShieldPlus,
  doctor: Stethoscope,
  hospital: Building2,
  chemist: Pill,
};

export default function RoleBadge({ role }: RoleBadgeProps) {
  const Icon = ROLE_ICONS[role];

  return (
    <Badge variant={ROLE_VARIANTS[role]} size="md">
      <span className="inline-flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" />
        {ROLE_LABELS[role]}
      </span>
    </Badge>
  );
}
