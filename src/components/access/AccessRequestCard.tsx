import { Clock3, ShieldCheck, UserRound } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import type { AccessGrant, AccessRequest } from '@/lib/types';

interface AccessRequestCardProps {
  request?: AccessRequest;
  grant?: AccessGrant;
  onApprove?: () => void;
  onReject?: () => void;
  onRevoke?: () => void;
}

export default function AccessRequestCard({
  request,
  grant,
  onApprove,
  onReject,
  onRevoke,
}: AccessRequestCardProps) {
  const label = request
    ? `${request.requester_name ?? 'Provider'} requested access`
    : `${grant?.grantee_name ?? 'Provider'} has active access`;
  const role = request?.requester_role ?? grant?.grantee_role ?? 'doctor';

  return (
    <Card className="rounded-[28px]">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="theme-icon-badge flex h-10 w-10 items-center justify-center rounded-2xl">
                <UserRound className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">{label}</p>
                <p className="text-xs text-text-secondary">
                  {request?.requester_phone ?? 'Professional contact kept private until approval'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info">{role.replace('_', ' ')}</Badge>
              <Badge variant={request ? 'warning' : 'success'}>
                {request ? request.status : grant?.status ?? 'active'}
              </Badge>
            </div>
          </div>
          <div className="rounded-2xl bg-background-strong px-3 py-2 text-right">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-tertiary">
              {request ? 'Consent code' : 'Expires'}
            </p>
            <p className="mt-1 text-sm font-bold text-text-primary">
              {request?.consent_code ?? grant?.expires_at?.slice(0, 10) ?? 'No expiry'}
            </p>
          </div>
        </div>

        {request?.reason || grant?.reason ? (
          <div className="rounded-[24px] bg-background-strong p-4 text-sm text-text-secondary">
            {request?.reason ?? grant?.reason}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            {(request?.requested_scopes ?? grant?.permission_scopes ?? []).join(', ') || 'Scoped access'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock3 className="h-3.5 w-3.5" />
            {request?.created_at?.slice(0, 10) ?? grant?.created_at?.slice(0, 10)}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {request && onApprove ? (
            <Button size="sm" onClick={onApprove}>
              Approve access
            </Button>
          ) : null}
          {request && onReject ? (
            <Button variant="outline" size="sm" onClick={onReject}>
              Reject
            </Button>
          ) : null}
          {grant && onRevoke ? (
            <Button variant="danger" size="sm" onClick={onRevoke}>
              Revoke access
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
