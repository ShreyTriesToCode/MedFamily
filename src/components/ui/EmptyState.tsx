import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <Card className="panel-muted rounded-[34px] border-dashed border-border-strong/80 text-center">
      <div className="flex flex-col items-center justify-center gap-4 py-10">
        <div className="theme-icon-badge flex h-16 w-16 items-center justify-center rounded-full">
          {icon ?? <Inbox className="h-7 w-7" />}
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-bold text-text-primary text-balance">{title}</h3>
          {description ? <p className="max-w-md text-sm text-text-secondary text-balance">{description}</p> : null}
        </div>
        {actionLabel && onAction ? <Button size="sm" onClick={onAction}>{actionLabel}</Button> : null}
      </div>
    </Card>
  );
}
