import { useMemo, useState } from 'react';
import { format, isAfter, startOfDay } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Copy,
  BellRing,
  CalendarClock,
  ClipboardList,
  FileHeart,
  PackageSearch,
  ShieldCheck,
  Siren,
} from 'lucide-react';
import Layout from '@/components/layout/Layout';
import PageHeader from '@/components/app/PageHeader';
import RoleBadge from '@/components/app/RoleBadge';
import SearchBar from '@/components/app/SearchBar';
import SectionHeader from '@/components/app/SectionHeader';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import { useAccessRequests } from '@/hooks/useAccessRequests';
import { useAppointments } from '@/hooks/useAppointments';
import { useAuth } from '@/context/AuthContext';
import { useFamilyMembers } from '@/hooks/useFamilyMembers';
import { useNotifications } from '@/context/NotificationContext';
import { useOrders } from '@/hooks/useOrders';
import { usePatientRecords } from '@/hooks/usePatientRecords';
import { usePrescriptions } from '@/hooks/usePrescriptions';
import { useReminders } from '@/hooks/useReminders';
import { ROUTES } from '@/lib/constants';
import { showSuccessToast } from '@/utils/errorHandler';

function QuickActionCard({
  title,
  description,
  cta,
  onClick,
}: {
  title: string;
  description: string;
  cta: string;
  onClick: () => void;
}) {
  return (
    <Card className="rounded-[30px]" hoverable onClick={onClick}>
      <div className="space-y-3">
        <div className="space-y-2">
          <h3 className="text-lg font-bold text-text-primary text-balance">{title}</h3>
          <p className="text-sm text-text-secondary text-balance">{description}</p>
        </div>
        <div className="theme-surface-soft inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold text-text-primary">
          {cta}
          <ArrowRight className="h-4 w-4 text-primary-700" />
        </div>
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile, role, familyGroup } = useAuth();
  const { memberStats, members } = useFamilyMembers();
  const { requests, grants } = useAccessRequests();
  const { appointments } = useAppointments();
  const { activeOrders, pastOrders, orders } = useOrders();
  const { records } = usePatientRecords();
  const { prescriptions } = usePrescriptions();
  const { reminders } = useReminders();
  const { unreadCount } = useNotifications();
  const [workspaceQuery, setWorkspaceQuery] = useState('');

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) {
      return 'Good morning';
    }
    if (hour < 18) {
      return 'Good afternoon';
    }
    return 'Good evening';
  }, []);

  const activeGrantCount = grants.filter((grant) => grant.status === 'active').length;
  const pendingRequestCount = requests.filter((request) => request.status === 'pending').length;
  const deliveredOrdersCount = pastOrders.filter((order) => order.status === 'delivered').length;
  const upcomingAppointments = appointments.filter(
    (appointment) =>
      (appointment.status === 'scheduled' || appointment.status === 'confirmed') &&
      isAfter(new Date(appointment.scheduled_for), startOfDay(new Date()))
  );

  const workspaceResults = useMemo(() => {
    const query = workspaceQuery.trim().toLowerCase();
    if (!query) {
      return [];
    }

    const results = [
      ...members
        .filter(
          (member) =>
            member.name.toLowerCase().includes(query) ||
            member.relation.toLowerCase().includes(query)
        )
        .map((member) => ({
          id: `member-${member.id}`,
          category: 'Family member',
          title: member.name,
          description: `${member.relation} · Open records and care history`,
          route: ROUTES.RECORDS,
        })),
      ...records
        .filter(
          (record) =>
            record.file_name.toLowerCase().includes(query) ||
            record.record_type.toLowerCase().includes(query) ||
            (record.member_name ?? '').toLowerCase().includes(query)
        )
        .map((record) => ({
          id: `record-${record.id}`,
          category: 'Record',
          title: record.file_name,
          description: `${record.member_name ?? 'Patient'} · ${record.record_type}`,
          route: ROUTES.RECORDS,
        })),
      ...prescriptions
        .filter(
          (prescription) =>
            (prescription.member_name ?? '').toLowerCase().includes(query) ||
            (prescription.doctor_name ?? '').toLowerCase().includes(query)
        )
        .map((prescription) => ({
          id: `prescription-${prescription.id}`,
          category: 'Prescription',
          title: prescription.member_name ?? 'Prescription',
          description: `${prescription.doctor_name || 'Digitised prescription'} · ${prescription.prescription_date}`,
          route: ROUTES.PRESCRIPTIONS,
        })),
      ...orders
        .filter(
          (order) =>
            order.order_number.toLowerCase().includes(query) ||
            order.receiver_name.toLowerCase().includes(query) ||
            order.placed_for_name.toLowerCase().includes(query)
        )
        .map((order) => ({
          id: `order-${order.id}`,
          category: 'Order',
          title: order.order_number,
          description: `${order.receiver_name} · ${order.status.replaceAll('_', ' ')}`,
          route: ROUTES.ORDERS,
        })),
      ...requests
        .filter(
          (request) =>
            (request.requester_name ?? '').toLowerCase().includes(query) ||
            request.requester_role.toLowerCase().includes(query) ||
            (request.reason ?? '').toLowerCase().includes(query)
        )
        .map((request) => ({
          id: `request-${request.id}`,
          category: 'Access',
          title: request.requester_name ?? 'Care request',
          description: `${request.requester_role} · ${request.status}`,
          route: ROUTES.ACCESS_CONTROL,
        })),
    ];

    return results.slice(0, 8);
  }, [members, orders, prescriptions, records, requests, workspaceQuery]);

  const dashboardStats = useMemo(() => {
    if (role === 'chemist') {
      return [
        { label: 'Open queue', value: activeOrders.length, helper: 'Orders needing fulfilment right now.', tone: 'brand' as const },
        {
          label: 'Claimed by you',
          value: orders.filter((order) => order.chemist_id === profile?.id).length,
          helper: 'Requests already assigned to your desk.',
          tone: 'accent' as const,
        },
        { label: 'Delivered', value: deliveredOrdersCount, helper: 'Completed orders retained in history.', tone: 'warm' as const },
        { label: 'Unread alerts', value: unreadCount, helper: 'Messages and status updates still unopened.', tone: 'neutral' as const },
      ];
    }

    if (role === 'patient_admin') {
      return [
        { label: 'Family members', value: members.length, helper: 'Profiles protected inside your care workspace.', tone: 'brand' as const },
        { label: 'Records stored', value: records.length, helper: 'Reports, scans, bills, and clinical files.', tone: 'accent' as const },
        { label: 'Active reminders', value: reminders.length, helper: 'Medication schedules currently in motion.', tone: 'warm' as const },
        { label: 'Pending approvals', value: pendingRequestCount, helper: 'Doctor or caretaker requests awaiting review.', tone: 'neutral' as const },
      ];
    }

    return [
      { label: 'Assigned patients', value: members.length, helper: 'People currently available to your role.', tone: 'brand' as const },
      { label: 'Accessible records', value: records.length, helper: 'Clinical history available in your workspace.', tone: 'accent' as const },
      { label: 'Upcoming visits', value: upcomingAppointments.length, helper: 'Scheduled follow-ups and consultations ahead.', tone: 'warm' as const },
      {
        label: role === 'caretaker' ? 'Orders in motion' : 'Active grants',
        value: role === 'caretaker' ? activeOrders.length : activeGrantCount,
        helper:
          role === 'caretaker'
            ? 'Medicine fulfilment requests currently in progress.'
            : 'Families that currently allow secure access.',
        tone: 'neutral' as const,
      },
    ];
  }, [
    activeGrantCount,
    activeOrders.length,
    deliveredOrdersCount,
    members.length,
    orders,
    pendingRequestCount,
    profile?.id,
    records.length,
    reminders.length,
    role,
    upcomingAppointments.length,
    unreadCount,
  ]);

  const headerHighlights = useMemo(() => {
    const items = [];

    if (familyGroup?.share_code) {
      items.push(`Shareable MedFamily ID ready: ${familyGroup.share_code}`);
    }
    if (prescriptions.length) {
      items.push(`${prescriptions.length} digitised prescriptions available`);
    }
    if (unreadCount) {
      items.push(`${unreadCount} live alert${unreadCount > 1 ? 's' : ''} waiting`);
    }
    if (upcomingAppointments.length) {
      items.push(`${upcomingAppointments.length} scheduled visit${upcomingAppointments.length > 1 ? 's' : ''} ahead`);
    }
    if (role === 'chemist' && !items.length) {
      items.push('Realtime fulfilment desk is synced for incoming requests');
    }

    return items.slice(0, 3);
  }, [familyGroup?.share_code, prescriptions.length, role, upcomingAppointments.length, unreadCount]);

  const quickLinks = useMemo(() => {
    if (role === 'patient_admin') {
      return [
        { label: 'Records', route: ROUTES.RECORDS, icon: FileHeart },
        { label: 'Prescriptions', route: ROUTES.PRESCRIPTIONS, icon: ClipboardList },
        { label: 'Reminders', route: ROUTES.REMINDERS, icon: BellRing },
        { label: 'Access center', route: ROUTES.ACCESS_CONTROL, icon: ShieldCheck },
        { label: 'Orders', route: ROUTES.ORDERS, icon: PackageSearch },
      ];
    }

    if (role === 'caretaker') {
      return [
        { label: 'Reminders', route: ROUTES.REMINDERS, icon: BellRing },
        { label: 'Health hub', route: ROUTES.HEALTH, icon: Activity },
        { label: 'Orders', route: ROUTES.ORDERS, icon: PackageSearch },
        { label: 'Appointments', route: ROUTES.APPOINTMENTS, icon: CalendarClock },
        { label: 'Access', route: ROUTES.ACCESS_CONTROL, icon: ShieldCheck },
      ];
    }

    if (role === 'doctor' || role === 'hospital') {
      return [
        { label: 'Records', route: ROUTES.RECORDS, icon: FileHeart },
        { label: 'Prescriptions', route: ROUTES.PRESCRIPTIONS, icon: ClipboardList },
        { label: 'Appointments', route: ROUTES.APPOINTMENTS, icon: CalendarClock },
        { label: 'Emergency', route: ROUTES.EMERGENCY, icon: Siren },
        { label: 'Access', route: ROUTES.ACCESS_CONTROL, icon: ShieldCheck },
      ];
    }

    if (role === 'chemist') {
      return [
        { label: 'Orders', route: ROUTES.ORDERS, icon: PackageSearch },
        { label: 'Alerts', route: ROUTES.NOTIFICATIONS, icon: BellRing },
        { label: 'Prescriptions', route: ROUTES.PRESCRIPTIONS, icon: ClipboardList },
        { label: 'Access', route: ROUTES.ACCESS_CONTROL, icon: ShieldCheck },
      ];
    }

    return [];
  }, [role]);

  const todaySnapshot = useMemo(() => {
    const items = [];

    const nextVisit = upcomingAppointments[0];
    if (nextVisit) {
      items.push({
        id: 'next-visit',
        title: 'Next appointment',
        description: `${nextVisit.member_name} · ${format(new Date(nextVisit.scheduled_for), 'dd MMM, hh:mm a')}`,
        route: ROUTES.APPOINTMENTS,
      });
    }

    if (activeOrders.length) {
      items.push({
        id: 'orders',
        title: `${activeOrders.length} active order${activeOrders.length > 1 ? 's' : ''}`,
        description: role === 'chemist' ? 'Claim, pack, and update fulfilment milestones.' : 'Track chemist fulfilment and delivery progress.',
        route: ROUTES.ORDERS,
      });
    }

    if (pendingRequestCount) {
      items.push({
        id: 'requests',
        title: `${pendingRequestCount} access request${pendingRequestCount > 1 ? 's' : ''}`,
        description: 'Review consent-backed access requests and next actions.',
        route: ROUTES.ACCESS_CONTROL,
      });
    }

    if (reminders.length) {
      items.push({
        id: 'reminder-watch',
        title: `${reminders.length} reminder schedule${reminders.length > 1 ? 's' : ''}`,
        description: 'Medication adherence remains active across the workspace.',
        route: ROUTES.REMINDERS,
      });
    }

    if (unreadCount) {
      items.push({
        id: 'alerts',
        title: `${unreadCount} unread alert${unreadCount > 1 ? 's' : ''}`,
        description: 'Important notifications are waiting in the update center.',
        route: ROUTES.NOTIFICATIONS,
      });
    }

    if (!items.length) {
      items.push({
        id: 'calm',
        title: 'No urgent actions right now',
        description: 'Your workspace is calm. Use quick actions below to continue routine care work.',
        route: ROUTES.DASHBOARD,
      });
    }

    return items.slice(0, 4);
  }, [activeOrders.length, pendingRequestCount, reminders.length, role, unreadCount, upcomingAppointments]);

  const priorityItems = useMemo(() => {
    const items = [];

    if (role === 'patient_admin' && pendingRequestCount) {
      items.push({
        id: 'pending-access',
        title: `${pendingRequestCount} access request${pendingRequestCount > 1 ? 's' : ''} waiting`,
        description: 'Review doctor and caretaker approvals before the next consultation.',
        route: ROUTES.ACCESS_CONTROL,
      });
    }

    if ((role === 'patient_admin' || role === 'caretaker') && activeOrders.length) {
      items.push({
        id: 'active-orders',
        title: `${activeOrders.length} medicine order${activeOrders.length > 1 ? 's' : ''} in progress`,
        description: 'Check fulfilment updates and reply quickly if the chemist needs clarification.',
        route: ROUTES.ORDERS,
      });
    }

    if (role === 'chemist' && activeOrders.length) {
      items.push({
        id: 'chemist-orders',
        title: `${activeOrders.length} active fulfilment task${activeOrders.length > 1 ? 's' : ''}`,
        description: 'Move accepted orders through packing and delivery to keep patients updated.',
        route: ROUTES.ORDERS,
      });
    }

    if (reminders.length) {
      items.push({
        id: 'reminders',
        title: `${reminders.length} active reminder${reminders.length > 1 ? 's' : ''}`,
        description: 'Stay on top of medication adherence and follow up on any missed doses.',
        route: ROUTES.REMINDERS,
      });
    }

    if (unreadCount) {
      items.push({
        id: 'notifications',
        title: `${unreadCount} unread alert${unreadCount > 1 ? 's' : ''}`,
        description: 'Messages, approvals, and order updates are waiting in your notification center.',
        route: ROUTES.NOTIFICATIONS,
      });
    }

    if (!items.length) {
      items.push({
        id: 'explore',
        title: 'Workspace looks healthy',
        description: 'Use the navigation bar to explore records, reminders, access, and fulfilment flows.',
        route: ROUTES.DASHBOARD,
      });
    }

    return items.slice(0, 3);
  }, [activeOrders.length, pendingRequestCount, reminders.length, role, unreadCount]);

  const handleCopyFamilyId = async () => {
    if (!familyGroup?.share_code) {
      return;
    }

    await navigator.clipboard.writeText(familyGroup.share_code);
    showSuccessToast('MedFamily ID copied.');
  };

  const heroActions = (
    <>
      {role ? <RoleBadge role={role} /> : null}
      {familyGroup?.share_code ? (
        <>
          <div className="theme-chip rounded-full px-4 py-2 text-xs font-semibold">
            MedFamily ID: <span className="text-text-primary">{familyGroup.share_code}</span>
          </div>
          <Button variant="outline" size="sm" icon={<Copy className="h-4 w-4" />} onClick={handleCopyFamilyId}>
            Copy ID
          </Button>
        </>
      ) : null}
    </>
  );

  const renderRoleCards = () => {
    if (role === 'patient_admin') {
      return (
        <>
          <QuickActionCard
            title="Manage family access"
            description="Approve doctor and caretaker requests, review active grants, and revoke access when needed."
            cta="Open access center"
            onClick={() => navigate(ROUTES.ACCESS_CONTROL)}
          />
          <QuickActionCard
            title="Track medicines end-to-end"
            description="Digitise prescriptions, keep reminders on track, and place chemist orders when stock runs low."
            cta="Manage medicines"
            onClick={() => navigate(ROUTES.REMINDERS)}
          />
          <QuickActionCard
            title="Watch health signals"
            description="Review vitals, refill risk, follow-up visits, and caretaker checklists from the new health hub."
            cta="Open health hub"
            onClick={() => navigate(ROUTES.HEALTH)}
          />
        </>
      );
    }

    if (role === 'doctor' || role === 'hospital') {
      return (
        <>
          <QuickActionCard
            title="Request secure access"
            description="Use a patient MedFamily ID to send a consent-backed request for records and prescriptions."
            cta="Request access"
            onClick={() => navigate(ROUTES.ACCESS_CONTROL)}
          />
          <QuickActionCard
            title="Review care history"
            description="Once approved, inspect summaries, reports, and digitised prescriptions in one place."
            cta="Browse records"
            onClick={() => navigate(ROUTES.RECORDS)}
          />
          <QuickActionCard
            title="Open emergency summary"
            description="Use the fast-access patient summary when you need allergies, medicines, and quick contacts quickly."
            cta="Emergency mode"
            onClick={() => navigate(ROUTES.EMERGENCY)}
          />
        </>
      );
    }

    if (role === 'caretaker') {
      return (
        <>
          <QuickActionCard
            title="Support daily adherence"
            description="Keep reminders updated, note missed doses, and coordinate medicine orders for assigned patients."
            cta="Open reminders"
            onClick={() => navigate(ROUTES.REMINDERS)}
          />
          <QuickActionCard
            title="Manage patient access"
            description="Track which families approved you and which permissions are currently active."
            cta="View access"
            onClick={() => navigate(ROUTES.ACCESS_CONTROL)}
          />
          <QuickActionCard
            title="Log vitals and tasks"
            description="Update care checklists, record health readings, and stay on top of refill watch items."
            cta="Health hub"
            onClick={() => navigate(ROUTES.HEALTH)}
          />
        </>
      );
    }

    return (
      <>
        <QuickActionCard
          title="Stay on top of active fulfilment"
          description="Claim new orders, update statuses in real time, and keep patients informed through chat."
          cta="Open order queue"
          onClick={() => navigate(ROUTES.ORDERS)}
        />
        <QuickActionCard
          title="Watch service alerts"
          description="Unread messages and order updates appear in your notification center for faster follow-through."
          cta="View alerts"
          onClick={() => navigate(ROUTES.NOTIFICATIONS)}
        />
      </>
    );
  };

  return (
    <Layout pageTitle="Dashboard">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Care command center"
          title={`${greeting}, ${profile?.full_name?.split(' ')[0] ?? 'MedFamily user'}`}
          description={
            role === 'patient_admin'
              ? 'Your family records, reminders, access approvals, and medicine orders are organized in one secure workspace.'
              : role === 'chemist'
                ? 'Your fulfilment queue, tracking updates, and patient communication are all in sync.'
                : 'Your approved care access, patient updates, and follow-up actions are ready here.'
          }
          actions={heroActions}
          stats={dashboardStats}
          highlights={headerHighlights}
        />

        <SectionHeader
          eyebrow="Role focus"
          title="Recommended next moves"
          description="The fastest routes to keep care work moving based on your current role and workspace state."
        />
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">{renderRoleCards()}</div>

        <SectionHeader
          eyebrow="Workspace tools"
          title="Search and jump across the workspace"
          description="Find members, records, prescriptions, orders, or access requests without leaving the dashboard."
        />
        <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
          <Card title="Workspace search" className="rounded-[30px]">
            <div className="space-y-4">
              <SearchBar
                value={workspaceQuery}
                onChange={setWorkspaceQuery}
                placeholder="Search members, records, orders, prescriptions, or access requests"
              />
              {workspaceQuery.trim() ? (
                workspaceResults.length ? (
                  <div className="grid gap-3">
                    {workspaceResults.map((result) => (
                      <button
                        key={result.id}
                        type="button"
                        className="theme-surface-soft rounded-[22px] px-4 py-3 text-left transition hover:border-primary-300 hover:bg-[var(--surface-accent)]"
                        onClick={() => navigate(result.route)}
                      >
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-tertiary">
                          {result.category}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-text-primary">{result.title}</p>
                        <p className="mt-1 text-xs text-text-secondary">{result.description}</p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No matching care items"
                    description="Try a different patient name, order number, or clinical document keyword."
                  />
                )
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {quickLinks.map((link) => {
                    const Icon = link.icon;

                    return (
                      <button
                        key={link.route}
                        type="button"
                        className="theme-surface-soft flex items-center gap-3 rounded-[22px] px-4 py-3 text-left transition hover:border-primary-300 hover:bg-[var(--surface-accent)]"
                        onClick={() => navigate(link.route)}
                      >
                        <div className="theme-icon-badge flex h-10 w-10 items-center justify-center rounded-[18px]">
                          <Icon className="h-4.5 w-4.5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-text-primary">{link.label}</p>
                          <p className="text-xs text-text-secondary">Open module</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>

          <Card title="Care priorities" className="rounded-[30px]">
            <div className="space-y-3">
              {priorityItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="theme-surface-soft w-full rounded-[24px] p-4 text-left transition hover:border-primary-300 hover:bg-[var(--surface-accent)]"
                  onClick={() => navigate(item.route)}
                >
                  <p className="text-sm font-semibold text-text-primary">{item.title}</p>
                  <p className="mt-1 text-xs text-text-secondary">{item.description}</p>
                </button>
              ))}
            </div>
          </Card>
        </div>

        <SectionHeader
          eyebrow="Live overview"
          title="What needs attention now"
          description="A cleaner operational readout of today’s momentum, clinical activity, and anything that needs follow-through."
        />
        <div className="grid gap-4 xl:grid-cols-3">
          <Card title="Today in motion" className="rounded-[30px]">
            <div className="space-y-3">
              {todaySnapshot.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="theme-surface-soft w-full rounded-[24px] p-4 text-left transition hover:border-primary-300 hover:bg-[var(--surface-accent)]"
                  onClick={() => navigate(item.route)}
                >
                  <p className="text-sm font-semibold text-text-primary">{item.title}</p>
                  <p className="mt-1 text-xs text-text-secondary">{item.description}</p>
                </button>
              ))}
            </div>
          </Card>

          <Card title="Recent activity" className="rounded-[30px]">
            <div className="space-y-3">
              {role === 'chemist' ? (
                activeOrders.length ? (
                  activeOrders.slice(0, 4).map((order) => (
                    <div key={order.id} className="rounded-[24px] bg-background-strong p-4">
                      <p className="text-sm font-semibold text-text-primary">{order.order_number}</p>
                      <p className="mt-1 text-xs text-text-secondary">
                        {order.receiver_name} · {order.status.replaceAll('_', ' ')}
                      </p>
                    </div>
                  ))
                ) : (
                  <EmptyState title="No active orders yet" description="New medicine requests will appear here as families place them." />
                )
              ) : records.length ? (
                records.slice(0, 4).map((record) => (
                  <div key={record.id} className="rounded-[24px] bg-background-strong p-4">
                    <p className="text-sm font-semibold text-text-primary">{record.file_name}</p>
                    <p className="mt-1 text-xs text-text-secondary">
                      {record.member_name} · {record.record_type}
                    </p>
                  </div>
                ))
              ) : (
                <EmptyState title="No clinical activity yet" description="Upload a record or wait for a provider-approved workspace to populate." />
              )}
            </div>
          </Card>

          <Card title={role === 'patient_admin' ? 'Attention needed' : 'Pipeline snapshot'} className="rounded-[30px]">
            <div className="space-y-3">
              {role === 'patient_admin' ? (
                requests.filter((request) => request.status === 'pending').length ? (
                  requests
                    .filter((request) => request.status === 'pending')
                    .slice(0, 3)
                    .map((request) => (
                      <div key={request.id} className="rounded-[24px] bg-background-strong p-4">
                        <p className="text-sm font-semibold text-text-primary">
                          {request.requester_name ?? 'Care professional'}
                        </p>
                        <p className="mt-1 text-xs text-text-secondary">
                          {request.requester_role} requested {request.requested_scopes.join(', ')}
                        </p>
                      </div>
                    ))
                ) : (
                  <EmptyState title="No approvals pending" description="Doctor and caretaker requests will appear here for quick review." />
                )
              ) : (
                <>
                  <div className="rounded-[24px] bg-background-strong p-4">
                    <p className="text-sm font-semibold text-text-primary">Prescriptions in workspace</p>
                    <p className="mt-1 text-xs text-text-secondary">{prescriptions.length} accessible prescription records</p>
                  </div>
                  <div className="rounded-[24px] bg-background-strong p-4">
                    <p className="text-sm font-semibold text-text-primary">Orders in motion</p>
                    <p className="mt-1 text-xs text-text-secondary">{activeOrders.length} orders currently active</p>
                  </div>
                  <div className="rounded-[24px] bg-background-strong p-4">
                    <p className="text-sm font-semibold text-text-primary">Unread notifications</p>
                    <p className="mt-1 text-xs text-text-secondary">{unreadCount} updates waiting for review</p>
                  </div>
                </>
              )}
            </div>
          </Card>
        </div>

        {role === 'patient_admin' ? (
          <>
            <SectionHeader
              eyebrow="Household view"
              title="Family insight snapshot"
              description="Quickly compare every member’s records, prescriptions, and active reminder load in one place."
            />
            <Card className="rounded-[30px]">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {members.length ? (
                members.map((member) => (
                  <div key={member.id} className="theme-surface-soft rounded-[24px] p-4">
                    <p className="text-sm font-semibold text-text-primary">{member.name}</p>
                    <p className="mt-1 text-xs text-text-secondary">{member.relation}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-text-secondary">
                      <span>{memberStats[member.id]?.recordCount ?? 0} records</span>
                      <span>{memberStats[member.id]?.prescriptionCount ?? 0} prescriptions</span>
                      <span>{memberStats[member.id]?.activeReminderCount ?? 0} reminders</span>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState
                  title="Start with your family roster"
                  description="Add your first family member to unlock the complete MedFamily workflow."
                  actionLabel="Open family center"
                  onAction={() => navigate(ROUTES.ACCESS_CONTROL)}
                />
              )}
            </div>
            </Card>
          </>
        ) : null}

      </div>
    </Layout>
  );
}
