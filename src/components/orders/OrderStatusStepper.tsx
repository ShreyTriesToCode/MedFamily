import { CheckCircle2, CircleDashed, Package, Truck } from 'lucide-react';
import { ORDER_STATUS_OPTIONS } from '@/lib/constants';
import type { OrderStatus, OrderStatusHistory } from '@/lib/types';

interface OrderStatusStepperProps {
  currentStatus: OrderStatus;
  history?: OrderStatusHistory[];
}

const statusIcon = {
  placed: CircleDashed,
  awaiting_chemist_approval: CircleDashed,
  accepted: CheckCircle2,
  preparing: Package,
  packed: Package,
  out_for_delivery: Truck,
  delivered: CheckCircle2,
  cancelled: CircleDashed,
  rejected: CircleDashed,
};

export default function OrderStatusStepper({
  currentStatus,
  history = [],
}: OrderStatusStepperProps) {
  const statusOrder = ORDER_STATUS_OPTIONS.map((item) => item.value);
  const currentIndex = statusOrder.indexOf(currentStatus);

  return (
    <div className="space-y-3">
      {ORDER_STATUS_OPTIONS.map((step, index) => {
        const completed = currentIndex >= index;
        const Icon = statusIcon[step.value];
        const timestamp = history.find((entry) => entry.status === step.value)?.created_at;

        return (
          <div key={step.value} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full ${
                  completed ? 'theme-status-success' : 'theme-surface-soft text-text-tertiary'
                }`}
              >
                <Icon className="h-4.5 w-4.5" />
              </div>
              {index < ORDER_STATUS_OPTIONS.length - 1 ? (
                <div className={`mt-2 h-8 w-px ${completed ? 'bg-secondary-300' : 'bg-border'}`} />
              ) : null}
            </div>
            <div className="pt-1">
              <p className="text-sm font-semibold text-text-primary">{step.label}</p>
              <p className="text-xs text-text-secondary">{step.description}</p>
              {timestamp ? <p className="mt-1 text-[11px] text-text-tertiary">{new Date(timestamp).toLocaleString()}</p> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
