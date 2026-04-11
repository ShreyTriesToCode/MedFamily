import type { ReactNode } from 'react';
import Card from '@/components/ui/Card';

interface StatCardProps {
  label: string;
  value: string | number;
  description: string;
  icon: ReactNode;
  tone?: 'blue' | 'green' | 'amber' | 'coral';
}

const toneClassMap = {
  blue: 'theme-icon-badge',
  green: 'theme-surface-accent text-secondary-700',
  amber: 'theme-surface text-warning-600',
  coral: 'theme-icon-badge-coral',
};

export default function StatCard({
  label,
  value,
  description,
  icon,
  tone = 'blue',
}: StatCardProps) {
  return (
    <Card className="rounded-[28px]" hoverable>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-text-secondary">{label}</p>
          <p className="mt-2 text-3xl font-bold text-text-primary">{value}</p>
          <p className="mt-2 text-xs text-text-secondary">{description}</p>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${toneClassMap[tone]}`}>{icon}</div>
      </div>
    </Card>
  );
}
