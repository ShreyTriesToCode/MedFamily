import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { format, formatDistanceToNowStrict, isAfter, startOfDay } from 'date-fns';
import {
  Activity,
  CalendarClock,
  ClipboardCheck,
  HeartPulse,
  PillBottle,
  Plus,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import Layout from '@/components/layout/Layout';
import PageHeader from '@/components/app/PageHeader';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import Input from '@/components/ui/Input';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';
import { useAuth } from '@/context/AuthContext';
import { useAppointments } from '@/hooks/useAppointments';
import { useHealthHub } from '@/hooks/useHealthHub';
import { usePatientRecords } from '@/hooks/usePatientRecords';
import { useReminders } from '@/hooks/useReminders';
import { VITAL_METRIC_OPTIONS } from '@/lib/constants';
import type { CareTaskFormInputs, FamilyMember, VitalEntry, VitalEntryFormInputs } from '@/lib/types';
import { showErrorToast, showSuccessToast } from '@/utils/errorHandler';

function getAgeYears(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) {
    return null;
  }

  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

function getAgeGroup(member: FamilyMember): string {
  const age = getAgeYears(member.date_of_birth);
  if (age === null) {
    return 'Not set';
  }
  if (age < 18) {
    return 'Child';
  }
  if (age >= 60) {
    return 'Elderly';
  }
  return 'Adult';
}

function formatVitalValue(entry: VitalEntry): string {
  const base = entry.value_secondary ? `${entry.value_primary}/${entry.value_secondary}` : entry.value_primary;
  return entry.unit ? `${base} ${entry.unit}` : base;
}

function numericVitalValue(entry: VitalEntry): number {
  const primary = Number.parseFloat(entry.value_primary);
  const secondary = entry.value_secondary ? Number.parseFloat(entry.value_secondary) : NaN;

  if (Number.isFinite(primary) && Number.isFinite(secondary)) {
    return (primary + secondary) / 2;
  }

  if (Number.isFinite(primary)) {
    return primary;
  }

  return 0;
}

function InsightCard({
  title,
  value,
  description,
  icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <Card className="rounded-[28px]">
      <div className="flex items-start gap-4">
        <div className="theme-icon-badge flex h-12 w-12 items-center justify-center rounded-[20px]">
          {icon}
        </div>
        <div>
          <p className="text-sm font-semibold text-text-secondary">{title}</p>
          <p className="mt-2 text-2xl font-bold text-text-primary">{value}</p>
          <p className="mt-2 text-xs text-text-secondary">{description}</p>
        </div>
      </div>
    </Card>
  );
}

function SparkBars({ entries }: { entries: VitalEntry[] }) {
  const values = entries.map(numericVitalValue);
  const maxValue = Math.max(...values, 1);

  return (
    <div className="flex items-end gap-2">
      {entries.map((entry) => (
        <div key={entry.id} className="flex flex-1 flex-col items-center gap-2">
          <div
            className="w-full rounded-t-2xl bg-linear-to-t from-primary-600 to-teal-400"
            style={{ height: `${Math.max((numericVitalValue(entry) / maxValue) * 90, 18)}px` }}
          />
          <p className="text-[10px] font-semibold text-text-tertiary">
            {format(new Date(entry.recorded_at), 'dd MMM')}
          </p>
        </div>
      ))}
    </div>
  );
}

export default function HealthPage() {
  const { role, user } = useAuth();
  const {
    members,
    vitals,
    careTasks,
    loading,
    saving,
    addVitalEntry,
    createCareTask,
    updateCareTaskStatus,
  } = useHealthHub();
  const { reminders } = useReminders();
  const { appointments } = useAppointments();
  const { records } = usePatientRecords();

  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [showVitalModal, setShowVitalModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [vitalForm, setVitalForm] = useState<VitalEntryFormInputs>({
    member_id: '',
    metric_type: 'blood_pressure',
    value_primary: '',
    value_secondary: '',
    unit: 'mmHg',
    symptoms: [],
    notes: '',
    recorded_at: new Date().toISOString().slice(0, 16),
  });
  const [taskForm, setTaskForm] = useState<CareTaskFormInputs>({
    member_id: '',
    title: '',
    description: '',
    due_at: '',
    assigned_to_user_id: '',
  });

  useEffect(() => {
    if (!members.length) {
      setSelectedMemberId('');
      return;
    }

    setSelectedMemberId((current) =>
      current && members.some((member) => member.id === current) ? current : members[0].id
    );
  }, [members]);

  useEffect(() => {
    setVitalForm((prev) => ({
      ...prev,
      member_id: selectedMemberId,
    }));
    setTaskForm((prev) => ({
      ...prev,
      member_id: selectedMemberId,
    }));
  }, [selectedMemberId]);

  const selectedMember = useMemo(
    () => members.find((member) => member.id === selectedMemberId) ?? members[0] ?? null,
    [members, selectedMemberId]
  );

  const memberOptions = useMemo(
    () => members.map((member) => ({ label: `${member.name} (${member.relation})`, value: member.id })),
    [members]
  );

  const memberVitals = useMemo(
    () =>
      vitals.filter((entry) => (selectedMember ? entry.member_id === selectedMember.id : true)),
    [selectedMember, vitals]
  );

  const memberTasks = useMemo(
    () =>
      careTasks.filter((task) => (selectedMember ? task.member_id === selectedMember.id : true)),
    [careTasks, selectedMember]
  );

  const memberAppointments = useMemo(
    () =>
      appointments.filter((appointment) =>
        selectedMember ? appointment.member_id === selectedMember.id : true
      ),
    [appointments, selectedMember]
  );

  const memberRecords = useMemo(
    () =>
      records.filter((record) => (selectedMember ? record.member_id === selectedMember.id : true)),
    [records, selectedMember]
  );

  const memberReminders = useMemo(
    () =>
      reminders.filter((reminder) => (selectedMember ? reminder.member_id === selectedMember.id : true)),
    [reminders, selectedMember]
  );

  const openTasks = memberTasks.filter((task) => task.status === 'pending');
  const completedTasks = memberTasks.filter((task) => task.status === 'completed').slice(0, 5);

  const today = startOfDay(new Date());
  const upcomingAppointments = memberAppointments
    .filter(
      (appointment) =>
        (appointment.status === 'scheduled' || appointment.status === 'confirmed') &&
        isAfter(new Date(appointment.scheduled_for), today)
    )
    .slice(0, 3);

  const dueReminderCount = memberReminders.reduce((count, reminder) => count + reminder.reminder_times.length, 0);
  const takenReminderCount = memberReminders.reduce(
    (count, reminder) => count + reminder.todayLogs.filter((log) => log.status === 'taken').length,
    0
  );
  const adherenceRate = dueReminderCount
    ? Math.round((takenReminderCount / dueReminderCount) * 100)
    : 100;

  const refillWatch = memberReminders
    .filter((reminder) => {
      const daysLeft = Math.ceil(
        (new Date(reminder.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      return daysLeft >= 0 && daysLeft <= 7;
    })
    .sort((a, b) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime());

  const commonSymptoms = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of memberVitals.slice(0, 12)) {
      for (const symptom of entry.symptoms ?? []) {
        counts.set(symptom, (counts.get(symptom) ?? 0) + 1);
      }
    }

    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [memberVitals]);

  const trendCards = useMemo(() => {
    return VITAL_METRIC_OPTIONS.map((metric) => {
      const entries = memberVitals
        .filter((entry) => entry.metric_type === metric.value)
        .slice(0, 5)
        .reverse();

      return {
        ...metric,
        entries,
      };
    }).filter((metric) => metric.entries.length > 0);
  }, [memberVitals]);

  const recentVitals = memberVitals.slice(0, 6);

  const canAddVital = role !== 'chemist';
  const canManageTasks = role === 'patient_admin' || role === 'caretaker';

  const handleMetricTypeChange = (nextMetric: VitalEntryFormInputs['metric_type']) => {
    const selected = VITAL_METRIC_OPTIONS.find((option) => option.value === nextMetric);
    setVitalForm((prev) => ({
      ...prev,
      metric_type: nextMetric,
      unit: selected?.unit ?? prev.unit,
      value_secondary: nextMetric === 'blood_pressure' ? prev.value_secondary : '',
    }));
  };

  const handleCreateVital = async () => {
    if (!vitalForm.member_id || !vitalForm.value_primary.trim()) {
      showErrorToast('Choose a member and enter the reading value.');
      return;
    }

    const result = await addVitalEntry({
      ...vitalForm,
      symptoms: (vitalForm.symptoms ?? []).filter(Boolean),
      recorded_at: new Date(vitalForm.recorded_at).toISOString(),
    });

    if (result.error) {
      showErrorToast(result.error);
      return;
    }

    setShowVitalModal(false);
    setVitalForm({
      member_id: selectedMemberId,
      metric_type: 'blood_pressure',
      value_primary: '',
      value_secondary: '',
      unit: 'mmHg',
      symptoms: [],
      notes: '',
      recorded_at: new Date().toISOString().slice(0, 16),
    });
    showSuccessToast('Health reading saved.');
  };

  const handleCreateTask = async () => {
    if (!taskForm.member_id || !taskForm.title.trim()) {
      showErrorToast('Choose a member and give the task a title.');
      return;
    }

    const result = await createCareTask({
      ...taskForm,
      assigned_to_user_id: role === 'caretaker' ? user?.id ?? '' : taskForm.assigned_to_user_id,
    });

    if (result.error) {
      showErrorToast(result.error);
      return;
    }

    setShowTaskModal(false);
    setTaskForm({
      member_id: selectedMemberId,
      title: '',
      description: '',
      due_at: '',
      assigned_to_user_id: '',
    });
    showSuccessToast('Care task created.');
  };

  if (loading) {
    return (
      <Layout pageTitle="Health Hub">
        <LoadingSpinner variant="page" />
      </Layout>
    );
  }

  return (
    <Layout pageTitle="Health Hub">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Vitals, trends, and support"
          title="Health hub"
          description="Track health readings, review follow-ups, spot refill risk early, and manage caretaker checklists for every family member."
          showBackButton
          stats={[
            { label: 'Vitals logged', value: memberVitals.length, helper: 'Structured readings stored for the selected member.', tone: 'brand' },
            { label: 'Adherence', value: `${adherenceRate}%`, helper: `${takenReminderCount}/${dueReminderCount || 0} doses confirmed today.`, tone: 'accent' },
            { label: 'Open tasks', value: openTasks.length, helper: 'Care checklist items still waiting to be completed.', tone: 'neutral' },
            { label: 'Refill watch', value: refillWatch.length, helper: 'Medicines ending within the next seven days.', tone: 'warm' },
          ]}
          highlights={[
            selectedMember ? `Active member: ${selectedMember.name}` : 'Choose a member to focus the health view',
            'Vitals, appointments, reminders, and care tasks are linked in one workspace',
          ]}
          actions={
            <div className="flex flex-wrap gap-2">
              {canAddVital ? (
                <Button variant="outline" icon={<Activity className="h-4 w-4" />} onClick={() => setShowVitalModal(true)}>
                  Add reading
                </Button>
              ) : null}
              {canManageTasks ? (
                <Button icon={<Plus className="h-4 w-4" />} onClick={() => setShowTaskModal(true)}>
                  Add care task
                </Button>
              ) : null}
            </div>
          }
        />

        {!selectedMember ? (
          <EmptyState
            title="No family member selected"
            description="Add a family member in the access center first to start tracking health summaries."
          />
        ) : (
          <>
            <Card className="rounded-[32px]">
              <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
                <div className="space-y-4">
                  <Select
                    label="Active member"
                    options={memberOptions}
                    value={selectedMemberId}
                    onChange={(event) => setSelectedMemberId(event.target.value)}
                  />

                  <div className="rounded-[28px] bg-background-strong p-5">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="theme-chip-strong flex h-14 w-14 items-center justify-center rounded-[22px] soft-shadow">
                        <HeartPulse className="h-6 w-6" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-text-primary">{selectedMember.name}</h2>
                        <p className="text-sm text-text-secondary">
                          {selectedMember.relation} · {getAgeGroup(selectedMember)}
                          {getAgeYears(selectedMember.date_of_birth) !== null
                            ? ` · ${getAgeYears(selectedMember.date_of_birth)} yrs`
                            : ''}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="theme-chip rounded-full px-3 py-2 text-xs font-semibold">
                        Blood group: {selectedMember.blood_group || 'Not set'}
                      </span>
                      <span className="theme-chip rounded-full px-3 py-2 text-xs font-semibold">
                        Allergies: {selectedMember.allergies.length || 0}
                      </span>
                      <span className="theme-chip rounded-full px-3 py-2 text-xs font-semibold">
                        Chronic conditions: {selectedMember.chronic_conditions.length || 0}
                      </span>
                    </div>

                    {selectedMember.notes ? (
                      <div className="theme-surface-soft mt-4 rounded-[20px] px-4 py-3 text-sm text-text-secondary">
                        {selectedMember.notes}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <InsightCard
                    title="Vitals logged"
                    value={String(memberVitals.length)}
                    description="Structured readings stored with symptoms and timestamps."
                    icon={<Activity className="h-5 w-5" />}
                  />
                  <InsightCard
                    title="Medication adherence"
                    value={`${adherenceRate}%`}
                    description={`${takenReminderCount}/${dueReminderCount || 0} doses confirmed today.`}
                    icon={<PillBottle className="h-5 w-5" />}
                  />
                  <InsightCard
                    title="Pending care tasks"
                    value={String(openTasks.length)}
                    description="Checklist items still open for support and follow-up."
                    icon={<ClipboardCheck className="h-5 w-5" />}
                  />
                  <InsightCard
                    title="Upcoming visits"
                    value={String(upcomingAppointments.length)}
                    description="Scheduled consultations or follow-ups ahead."
                    icon={<CalendarClock className="h-5 w-5" />}
                  />
                </div>
              </div>
            </Card>

            <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
              <Card title="Vital trends" eyebrow="Chart-based view" className="rounded-[30px]">
                {trendCards.length ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {trendCards.map((metric) => (
                      <div key={metric.value} className="rounded-[24px] bg-background-strong p-4">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-text-primary">{metric.label}</p>
                            <p className="text-xs text-text-secondary">
                              Latest: {formatVitalValue(metric.entries[metric.entries.length - 1])}
                            </p>
                          </div>
                          <span className="theme-chip rounded-full px-3 py-1.5 text-[11px] font-semibold">
                            {metric.unit}
                          </span>
                        </div>
                        <SparkBars entries={metric.entries} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No vitals logged yet"
                    description="Start with blood pressure, sugar, oxygen, or symptoms to build a trend view."
                    actionLabel={canAddVital ? 'Add reading' : undefined}
                    onAction={canAddVital ? () => setShowVitalModal(true) : undefined}
                  />
                )}
              </Card>

              <Card title="Caretaker checklist" eyebrow="Shared responsibility" className="rounded-[30px]">
                {memberTasks.length ? (
                  <div className="space-y-3">
                    {memberTasks.slice(0, 6).map((task) => (
                      <div key={task.id} className="rounded-[24px] bg-background-strong p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-text-primary">{task.title}</p>
                            <p className="mt-1 text-xs text-text-secondary">
                              {task.description || 'No extra notes'}
                            </p>
                            <p className="mt-2 text-[11px] font-semibold text-text-tertiary">
                              {task.due_at
                                ? `Due ${formatDistanceToNowStrict(new Date(task.due_at), { addSuffix: true })}`
                                : 'No due time set'}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span
                              className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${
                                task.status === 'completed'
                                  ? 'theme-status-success'
                                  : 'theme-status-warning'
                              }`}
                            >
                              {task.status}
                            </span>
                            {canManageTasks ? (
                              <Button
                                size="sm"
                                variant={task.status === 'completed' ? 'outline' : 'secondary'}
                                onClick={async () => {
                                  const result = await updateCareTaskStatus(
                                    task,
                                    task.status === 'completed' ? 'pending' : 'completed'
                                  );
                                  if (result.error) {
                                    showErrorToast(result.error);
                                    return;
                                  }
                                  showSuccessToast(
                                    task.status === 'completed'
                                      ? 'Care task reopened.'
                                      : 'Care task marked complete.'
                                  );
                                }}
                              >
                                {task.status === 'completed' ? 'Reopen' : 'Mark done'}
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No care tasks yet"
                    description="Create task checklists for elders, dependent patients, or post-visit follow-ups."
                    actionLabel={canManageTasks ? 'Add care task' : undefined}
                    onAction={canManageTasks ? () => setShowTaskModal(true) : undefined}
                  />
                )}
              </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1fr_1fr_0.9fr]">
              <Card title="Refill watch" eyebrow="Medication continuity" className="rounded-[30px]">
                {refillWatch.length ? (
                  <div className="space-y-3">
                    {refillWatch.map((reminder) => (
                      <div key={reminder.id} className="rounded-[24px] bg-background-strong p-4">
                        <p className="text-sm font-bold text-text-primary">{reminder.medicine_name}</p>
                        <p className="mt-1 text-xs text-text-secondary">
                          Ends on {format(new Date(reminder.end_date), 'dd MMM yyyy')}
                        </p>
                        <p className="mt-2 text-[11px] font-semibold text-warning-600">
                          Refill in{' '}
                          {formatDistanceToNowStrict(new Date(reminder.end_date), { addSuffix: true })}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No immediate refills"
                    description="Active medicines nearing completion will surface here automatically."
                  />
                )}
              </Card>

              <Card title="Recent health timeline" eyebrow="History at a glance" className="rounded-[30px]">
                {recentVitals.length || memberRecords.length || upcomingAppointments.length ? (
                  <div className="space-y-3">
                    {recentVitals.slice(0, 3).map((entry) => (
                      <div key={entry.id} className="rounded-[24px] bg-background-strong p-4">
                        <p className="text-sm font-bold text-text-primary">
                          {VITAL_METRIC_OPTIONS.find((option) => option.value === entry.metric_type)?.label}
                        </p>
                        <p className="mt-1 text-xs text-text-secondary">
                          {formatVitalValue(entry)} · {format(new Date(entry.recorded_at), 'dd MMM yyyy, hh:mm a')}
                        </p>
                      </div>
                    ))}
                    {memberRecords.slice(0, 2).map((record) => (
                      <div key={record.id} className="rounded-[24px] bg-background-strong p-4">
                        <p className="text-sm font-bold text-text-primary">{record.record_type}</p>
                        <p className="mt-1 text-xs text-text-secondary">
                          {record.file_name} · {format(new Date(record.upload_date), 'dd MMM yyyy')}
                        </p>
                      </div>
                    ))}
                    {upcomingAppointments.slice(0, 1).map((appointment) => (
                      <div key={appointment.id} className="rounded-[24px] bg-background-strong p-4">
                        <p className="text-sm font-bold text-text-primary">{appointment.title}</p>
                        <p className="mt-1 text-xs text-text-secondary">
                          {format(new Date(appointment.scheduled_for), 'dd MMM yyyy, hh:mm a')}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No timeline items yet"
                    description="Vitals, reports, and visits will build a longitudinal history here."
                  />
                )}
              </Card>

              <Card title="Signal highlights" eyebrow="What stands out" className="rounded-[30px]">
                <div className="space-y-3">
                  <div className="rounded-[24px] bg-background-strong p-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary-700" />
                      <p className="text-sm font-bold text-text-primary">Symptom watch</p>
                    </div>
                    {commonSymptoms.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {commonSymptoms.map(([symptom, count]) => (
                          <span key={symptom} className="theme-chip rounded-full px-3 py-2 text-xs font-semibold">
                            {symptom} · {count}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-text-secondary">
                        No recurring symptoms have been logged recently.
                      </p>
                    )}
                  </div>

                  <div className="rounded-[24px] bg-background-strong p-4">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-coral-500" />
                      <p className="text-sm font-bold text-text-primary">Task history</p>
                    </div>
                    {completedTasks.length ? (
                      <div className="mt-3 space-y-2">
                        {completedTasks.map((task) => (
                          <p key={task.id} className="text-sm text-text-secondary">
                            {task.title}
                            {task.completed_at ? ` · ${format(new Date(task.completed_at), 'dd MMM')}` : ''}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-text-secondary">
                        Completed tasks will appear here as the care plan progresses.
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          </>
        )}
      </div>

      <Modal
        isOpen={showVitalModal}
        onClose={() => setShowVitalModal(false)}
        title="Add health reading"
        description="Capture vitals, symptom notes, and timestamped readings for member-wise monitoring."
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowVitalModal(false)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={handleCreateVital}>
              Save reading
            </Button>
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Member"
            options={memberOptions}
            value={vitalForm.member_id}
            onChange={(event) => setVitalForm((prev) => ({ ...prev, member_id: event.target.value }))}
          />
          <Select
            label="Metric"
            options={VITAL_METRIC_OPTIONS.map((option) => ({ label: option.label, value: option.value }))}
            value={vitalForm.metric_type}
            onChange={(event) => handleMetricTypeChange(event.target.value as VitalEntryFormInputs['metric_type'])}
          />
          <Input
            label={vitalForm.metric_type === 'blood_pressure' ? 'Systolic value' : 'Primary value'}
            value={vitalForm.value_primary}
            onChange={(event) => setVitalForm((prev) => ({ ...prev, value_primary: event.target.value }))}
          />
          {vitalForm.metric_type === 'blood_pressure' ? (
            <Input
              label="Diastolic value"
              value={vitalForm.value_secondary}
              onChange={(event) => setVitalForm((prev) => ({ ...prev, value_secondary: event.target.value }))}
            />
          ) : (
            <Input
              label="Unit"
              value={vitalForm.unit}
              onChange={(event) => setVitalForm((prev) => ({ ...prev, unit: event.target.value }))}
            />
          )}
          <Input
            label="Recorded at"
            type="datetime-local"
            value={vitalForm.recorded_at}
            onChange={(event) => setVitalForm((prev) => ({ ...prev, recorded_at: event.target.value }))}
          />
          <Input
            label="Symptoms"
            value={(vitalForm.symptoms ?? []).join(', ')}
            onChange={(event) =>
              setVitalForm((prev) => ({
                ...prev,
                symptoms: event.target.value
                  .split(',')
                  .map((value) => value.trim())
                  .filter(Boolean),
              }))
            }
            helperText="Separate symptoms with commas, for example dizziness, fatigue."
          />
          <div className="sm:col-span-2">
            <Input
              label="Clinical note"
              multiline
              value={vitalForm.notes}
              onChange={(event) => setVitalForm((prev) => ({ ...prev, notes: event.target.value }))}
            />
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        title="Add care task"
        description="Track caregiver duties, follow-up responsibilities, or medication support steps."
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowTaskModal(false)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={handleCreateTask}>
              Save task
            </Button>
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Member"
            options={memberOptions}
            value={taskForm.member_id}
            onChange={(event) => setTaskForm((prev) => ({ ...prev, member_id: event.target.value }))}
          />
          <Input
            label="Due at"
            type="datetime-local"
            value={taskForm.due_at}
            onChange={(event) => setTaskForm((prev) => ({ ...prev, due_at: event.target.value }))}
          />
          <div className="sm:col-span-2">
            <Input
              label="Task title"
              value={taskForm.title}
              onChange={(event) => setTaskForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="Check BP after dinner"
            />
          </div>
          <div className="sm:col-span-2">
            <Input
              label="Description"
              multiline
              value={taskForm.description}
              onChange={(event) => setTaskForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Add any care notes, dosage context, or handoff instructions."
            />
          </div>
        </div>
      </Modal>
    </Layout>
  );
}
