import { useMemo, useState } from 'react';
import { addMinutes, format, isAfter } from 'date-fns';
import { CheckCircle2, Plus } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import PageHeader from '@/components/app/PageHeader';
import SectionHeader from '@/components/app/SectionHeader';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import Input from '@/components/ui/Input';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import { FREQUENCY_OPTIONS, SNOOZE_OPTIONS } from '@/lib/constants';
import type { ManualReminderFormInputs } from '@/lib/types';
import { useReminders } from '@/hooks/useReminders';
import { showErrorToast, showSuccessToast } from '@/utils/errorHandler';

interface ReminderTask {
  reminderId: string;
  memberName: string;
  medicineName: string;
  dosage: string;
  time: string;
  scheduledAt: Date;
  status: 'pending' | 'taken' | 'missed' | 'upcoming' | 'snoozed' | 'skipped';
}

function parseScheduledTime(time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const scheduledAt = new Date();
  scheduledAt.setHours(hours, minutes, 0, 0);
  return scheduledAt;
}

export default function MedicineReminders() {
  const { role } = useAuth();
  const {
    members,
    reminders,
    loading,
    markReminderTaken,
    snoozeReminder,
    skipReminder,
    createManualReminder,
  } = useReminders();
  const { permission, requestPermission, sendBrowserNotification } = useNotifications();

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<ManualReminderFormInputs>({
    member_id: '',
    medicine_name: '',
    dosage: '',
    frequency: 'Once daily',
    reminder_times: ['09:00'],
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
  });

  const memberOptions = useMemo(
    () => members.map((member) => ({ label: member.name, value: member.id })),
    [members]
  );

  const canManage = role === 'patient_admin' || role === 'caretaker';

  const tasks = useMemo<ReminderTask[]>(() => {
    const now = new Date();

    return reminders.flatMap((reminder) =>
      reminder.reminder_times.map((time) => {
        const scheduledAt = parseScheduledTime(time);
        const existingLog = reminder.todayLogs.find(
          (log) => format(new Date(log.scheduled_time), 'HH:mm') === time
        );

        let status: ReminderTask['status'] = 'pending';
        if (existingLog?.status === 'taken') {
          status = 'taken';
        } else if (existingLog?.status === 'snoozed') {
          status = 'snoozed';
        } else if (existingLog?.status === 'skipped') {
          status = 'skipped';
        } else if (isAfter(scheduledAt, now)) {
          status = 'upcoming';
        } else {
          status = 'missed';
        }

        return {
          reminderId: reminder.id,
          memberName: reminder.member_name ?? 'Patient',
          medicineName: reminder.medicine_name,
          dosage: reminder.dosage,
          time,
          scheduledAt,
          status,
        };
      })
    );
  }, [reminders]);

  const todayTasks = tasks.filter((task) => task.status === 'pending' || task.status === 'taken' || task.status === 'snoozed' || task.status === 'skipped');
  const upcomingTasks = tasks.filter((task) => task.status === 'upcoming');
  const missedTasks = tasks.filter((task) => task.status === 'missed');

  const handleMarkTaken = async (task: ReminderTask) => {
    const scheduledTime = task.scheduledAt.toISOString();
    const result = await markReminderTaken(task.reminderId, scheduledTime);
    if (result.error) {
      showErrorToast(result.error);
      return;
    }

    showSuccessToast('Marked as taken.');
  };

  const handleSnooze = async (task: ReminderTask, minutes: number) => {
    const result = await snoozeReminder(task.reminderId, task.scheduledAt.toISOString(), minutes);
    if (result.error) {
      showErrorToast(result.error);
      return;
    }

    sendBrowserNotification(
      `Reminder snoozed for ${task.medicineName}`,
      `We will nudge again at ${format(addMinutes(new Date(), minutes), 'hh:mm a')}.`
    );
    showSuccessToast(`Reminder snoozed for ${minutes} minutes.`);
  };

  const handleSkip = async (task: ReminderTask) => {
    const result = await skipReminder(task.reminderId, task.scheduledAt.toISOString());
    if (result.error) {
      showErrorToast(result.error);
      return;
    }

    showSuccessToast('Reminder skipped.');
  };

  const handleCreateReminder = async () => {
    const result = await createManualReminder(form);
    if (result.error) {
      showErrorToast(result.error);
      return;
    }

    setShowModal(false);
    setForm({
      member_id: '',
      medicine_name: '',
      dosage: '',
      frequency: 'Once daily',
      reminder_times: ['09:00'],
      start_date: new Date().toISOString().slice(0, 10),
      end_date: new Date().toISOString().slice(0, 10),
    });
    showSuccessToast('Reminder created.');
  };

  const renderTaskList = (title: string, description: string, items: ReminderTask[]) => (
    <Card title={title} className="rounded-[30px]">
      <p className="mb-4 text-sm text-text-secondary">{description}</p>
      {items.length ? (
        <div className="space-y-3">
          {items.map((task) => (
            <div key={`${task.reminderId}-${task.time}`} className="rounded-[24px] bg-background-strong p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-text-primary">
                    {task.medicineName} · {task.dosage}
                  </p>
                  <p className="mt-1 text-xs text-text-secondary">
                    {task.memberName} · {format(task.scheduledAt, 'hh:mm a')}
                  </p>
                </div>
                <div className="theme-chip rounded-full px-3 py-1.5 text-xs font-semibold">
                  {task.status}
                </div>
              </div>

              {canManage && (task.status === 'pending' || task.status === 'missed') ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => handleMarkTaken(task)}>
                    Mark taken
                  </Button>
                  {SNOOZE_OPTIONS.map((option) => (
                    <Button
                      key={`${task.reminderId}-${option.value}`}
                      size="sm"
                      variant="outline"
                      onClick={() => handleSnooze(task, option.value)}
                    >
                      Snooze {option.label}
                    </Button>
                  ))}
                  <Button size="sm" variant="ghost" onClick={() => handleSkip(task)}>
                    Skip
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title={`No ${title.toLowerCase()} reminders`} description="This section is clear right now." />
      )}
    </Card>
  );

  return (
    <Layout pageTitle="Medicine Reminders">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Adherence center"
          title="Medicine reminders"
          description="See what is due today, what is coming up next, and which doses need attention."
          showBackButton
          stats={[
            { label: 'Due today', value: todayTasks.length, helper: 'Tasks that should be reviewed during the day.', tone: 'brand' },
            { label: 'Upcoming', value: upcomingTasks.length, helper: 'Next medicine windows already on the horizon.', tone: 'accent' },
            { label: 'Missed', value: missedTasks.length, helper: 'Schedules that need follow-up or confirmation.', tone: 'neutral' },
          ]}
          highlights={[
            permission === 'granted' ? 'Browser reminders are enabled for this device' : 'Browser reminders can be enabled from this page',
            canManage ? 'You can snooze, confirm, or skip doses directly' : 'This role can monitor adherence without editing schedules',
          ]}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {permission !== 'granted' ? (
                <Button variant="outline" onClick={requestPermission}>
                  Enable notifications
                </Button>
              ) : null}
              {canManage ? (
                <Button icon={<Plus className="h-4 w-4" />} onClick={() => setShowModal(true)}>
                  Add reminder
                </Button>
              ) : null}
            </div>
          }
        />

        <SectionHeader
          eyebrow="Dose queues"
          title="Current reminder lanes"
          description="Move through what is due now, what is coming up, and which doses need recovery or confirmation."
        />

        {loading ? (
          <LoadingSpinner />
        ) : (
          <div className="grid gap-4 xl:grid-cols-[1fr_1fr_0.95fr]">
            {renderTaskList('Today', 'Track current-day adherence and mark completed doses quickly.', todayTasks)}
            {renderTaskList('Upcoming', 'Plan ahead for the next scheduled medicine windows.', upcomingTasks)}
            {renderTaskList('Missed', 'Catch up on doses that were not confirmed in time.', missedTasks)}
          </div>
        )}
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Add manual reminder"
        description="Use this for medicines that are not already captured from a prescription."
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateReminder}>Save reminder</Button>
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Patient"
            options={memberOptions}
            value={form.member_id}
            onChange={(event) => setForm((prev) => ({ ...prev, member_id: event.target.value }))}
          />
          <Input
            label="Medicine name"
            value={form.medicine_name}
            onChange={(event) => setForm((prev) => ({ ...prev, medicine_name: event.target.value }))}
          />
          <Input
            label="Dosage"
            value={form.dosage}
            onChange={(event) => setForm((prev) => ({ ...prev, dosage: event.target.value }))}
          />
          <Select
            label="Frequency"
            options={FREQUENCY_OPTIONS}
            value={form.frequency}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, frequency: event.target.value as ManualReminderFormInputs['frequency'] }))
            }
          />
          <Input
            label="Reminder times"
            value={form.reminder_times.join(', ')}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                reminder_times: event.target.value
                  .split(',')
                  .map((value) => value.trim())
                  .filter(Boolean),
              }))
            }
            helperText="Separate multiple times with commas. Example: 08:00, 20:00"
          />
          <Input
            label="Start date"
            type="date"
            value={form.start_date}
            onChange={(event) => setForm((prev) => ({ ...prev, start_date: event.target.value }))}
          />
          <Input
            label="End date"
            type="date"
            value={form.end_date}
            onChange={(event) => setForm((prev) => ({ ...prev, end_date: event.target.value }))}
          />
        </div>
      </Modal>
    </Layout>
  );
}
