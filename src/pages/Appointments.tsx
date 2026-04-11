import { useMemo, useState } from 'react';
import { format, isAfter, isBefore, startOfDay } from 'date-fns';
import { CalendarClock, CheckCircle2, RefreshCcw, Stethoscope, XCircle } from 'lucide-react';
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
import { useAppointments } from '@/hooks/useAppointments';
import { APPOINTMENT_TYPE_OPTIONS } from '@/lib/constants';
import type { Appointment, AppointmentFormInputs } from '@/lib/types';
import { showErrorToast, showSuccessToast } from '@/utils/errorHandler';

function emptyAppointmentForm(): AppointmentFormInputs {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);

  return {
    member_id: '',
    title: '',
    appointment_type: 'consultation',
    provider_name: '',
    provider_contact: '',
    provider_role: '',
    scheduled_for: tomorrow.toISOString().slice(0, 16),
    location: '',
    mode: 'clinic',
    notes: '',
    follow_up_date: '',
  };
}

export default function AppointmentsPage() {
  const { role, profile } = useAuth();
  const { appointments, members, loading, saving, createAppointment, updateAppointmentStatus, saveVisitSummary } =
    useAppointments();

  const [showCreate, setShowCreate] = useState(false);
  const [showSummary, setShowSummary] = useState<Appointment | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null);
  const [form, setForm] = useState<AppointmentFormInputs>(emptyAppointmentForm);
  const [visitSummary, setVisitSummary] = useState({
    diagnosis: '',
    visit_summary: '',
    advice_summary: '',
    follow_up_date: '',
  });
  const [rescheduledFor, setRescheduledFor] = useState('');

  const memberOptions = useMemo(
    () => members.map((member) => ({ label: member.name, value: member.id })),
    [members]
  );

  const now = startOfDay(new Date());
  const upcomingAppointments = appointments.filter(
    (appointment) =>
      (appointment.status === 'scheduled' || appointment.status === 'confirmed') &&
      isAfter(new Date(appointment.scheduled_for), now)
  );
  const followUps = appointments.filter((appointment) => appointment.follow_up_date);
  const completedAppointments = appointments.filter((appointment) => appointment.status === 'completed');
  const historyAppointments = appointments.filter(
    (appointment) =>
      appointment.status === 'completed' ||
      appointment.status === 'cancelled' ||
      appointment.status === 'missed' ||
      isBefore(new Date(appointment.scheduled_for), now)
  );

  const canSchedule = role === 'patient_admin' || role === 'caretaker';
  const canWriteSummary = role === 'doctor' || role === 'hospital' || role === 'patient_admin';

  const groupedUpcoming = useMemo(() => {
    return upcomingAppointments.reduce<Record<string, Appointment[]>>((acc, appointment) => {
      const key = format(new Date(appointment.scheduled_for), 'yyyy-MM-dd');
      acc[key] = [...(acc[key] ?? []), appointment];
      return acc;
    }, {});
  }, [upcomingAppointments]);

  const handleCreateAppointment = async () => {
    if (!form.member_id || !form.title.trim() || !form.scheduled_for) {
      showErrorToast('Choose a family member, title, and schedule time.');
      return;
    }

    const result = await createAppointment({
      ...form,
      title: form.title.trim(),
      provider_name: form.provider_name?.trim(),
      provider_contact: form.provider_contact?.trim(),
      location: form.location?.trim(),
      notes: form.notes?.trim(),
      follow_up_date: form.follow_up_date || undefined,
    });

    if (result.error) {
      showErrorToast(result.error);
      return;
    }

    setShowCreate(false);
    setForm(emptyAppointmentForm());
    showSuccessToast('Appointment scheduled.');
  };

  const handleSaveSummary = async () => {
    if (!showSummary) {
      return;
    }

    const result = await saveVisitSummary(showSummary, visitSummary);
    if (result.error) {
      showErrorToast(result.error);
      return;
    }

    setShowSummary(null);
    setVisitSummary({
      diagnosis: '',
      visit_summary: '',
      advice_summary: '',
      follow_up_date: '',
    });
    showSuccessToast('Visit summary saved.');
  };

  const handleStatusUpdate = async (appointment: Appointment, status: Appointment['status']) => {
    const result = await updateAppointmentStatus(appointment, status);
    if (result.error) {
      showErrorToast(result.error);
      return;
    }

    showSuccessToast(`Appointment marked as ${status}.`);
  };

  const handleReschedule = async () => {
    if (!rescheduleTarget || !rescheduledFor) {
      showErrorToast('Choose a new appointment time.');
      return;
    }

    const result = await updateAppointmentStatus(rescheduleTarget, 'scheduled', new Date(rescheduledFor).toISOString());
    if (result.error) {
      showErrorToast(result.error);
      return;
    }

    setRescheduleTarget(null);
    setRescheduledFor('');
    showSuccessToast('Appointment rescheduled.');
  };

  const renderAppointmentCard = (appointment: Appointment, isHistory = false) => (
    <Card key={appointment.id} className="rounded-[30px]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-lg font-bold text-text-primary">{appointment.title}</p>
            <p className="mt-1 text-sm text-text-secondary">
              {appointment.member_name} · {appointment.appointment_type.replace('_', ' ')}
            </p>
          </div>
          <span className="theme-active-surface rounded-full px-3 py-1.5 text-xs font-semibold">
            {appointment.status.replace('_', ' ')}
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[22px] bg-background-strong p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-text-tertiary">Schedule</p>
            <p className="mt-1 text-sm font-semibold text-text-primary">
              {format(new Date(appointment.scheduled_for), 'dd MMM yyyy · hh:mm a')}
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              {appointment.location || 'Location not added'} · {appointment.mode || 'clinic'}
            </p>
          </div>
          <div className="rounded-[22px] bg-background-strong p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-text-tertiary">Provider</p>
            <p className="mt-1 text-sm font-semibold text-text-primary">
              {appointment.provider_name || profile?.full_name || 'To be confirmed'}
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              {appointment.provider_contact || 'No direct contact saved'}
            </p>
          </div>
        </div>

        {appointment.notes ? (
          <div className="rounded-[22px] bg-background-strong p-4 text-sm text-text-secondary">
            {appointment.notes}
          </div>
        ) : null}

        {appointment.diagnosis || appointment.visit_summary || appointment.advice_summary ? (
          <div className="theme-surface-soft rounded-[22px] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-text-tertiary">Visit notes</p>
            {appointment.diagnosis ? <p className="mt-2 text-sm font-semibold text-text-primary">Diagnosis: {appointment.diagnosis}</p> : null}
            {appointment.visit_summary ? <p className="mt-2 text-sm text-text-secondary">{appointment.visit_summary}</p> : null}
            {appointment.advice_summary ? <p className="mt-2 text-sm text-text-secondary">Advice: {appointment.advice_summary}</p> : null}
            {appointment.follow_up_date ? (
              <p className="mt-2 text-xs font-semibold text-primary-700">
                Follow-up: {format(new Date(appointment.follow_up_date), 'dd MMM yyyy')}
              </p>
            ) : null}
          </div>
        ) : null}

        {!isHistory ? (
          <div className="flex flex-wrap gap-2">
            {(appointment.status === 'scheduled' || appointment.status === 'confirmed') && canSchedule ? (
              <>
                <Button size="sm" variant="outline" icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => handleStatusUpdate(appointment, 'confirmed')}>
                  Confirm
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  icon={<RefreshCcw className="h-4 w-4" />}
                  onClick={() => {
                    setRescheduleTarget(appointment);
                    setRescheduledFor(appointment.scheduled_for.slice(0, 16));
                  }}
                >
                  Reschedule
                </Button>
                <Button size="sm" variant="ghost" icon={<XCircle className="h-4 w-4" />} onClick={() => handleStatusUpdate(appointment, 'cancelled')}>
                  Cancel
                </Button>
              </>
            ) : null}
            {(appointment.status === 'scheduled' || appointment.status === 'confirmed') && canWriteSummary ? (
              <>
                <Button size="sm" icon={<Stethoscope className="h-4 w-4" />} onClick={() => {
                  setShowSummary(appointment);
                  setVisitSummary({
                    diagnosis: appointment.diagnosis || '',
                    visit_summary: appointment.visit_summary || '',
                    advice_summary: appointment.advice_summary || '',
                    follow_up_date: appointment.follow_up_date || '',
                  });
                }}>
                  Add visit summary
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleStatusUpdate(appointment, 'missed')}>
                  Mark missed
                </Button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  );

  return (
    <Layout pageTitle="Appointments">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Appointments and follow-up"
          title="Appointments"
          description="Book consultations, track follow-ups, manage reschedules, and attach visit summaries for every family member."
          showBackButton
          stats={[
            { label: 'Upcoming', value: upcomingAppointments.length, helper: 'Scheduled or confirmed visits ahead.', tone: 'brand' },
            { label: 'Follow-ups', value: followUps.length, helper: 'Appointments carrying a tagged follow-up date.', tone: 'accent' },
            { label: 'Completed', value: completedAppointments.length, helper: 'Consultations already closed into history.', tone: 'neutral' },
          ]}
          highlights={[
            'Visit summaries can be attached directly after consultations',
            canSchedule ? 'You can book, confirm, and reschedule appointments here' : 'This role can review appointments and contribute visit summaries',
          ]}
          actions={
            canSchedule ? (
              <Button icon={<CalendarClock className="h-4 w-4" />} onClick={() => setShowCreate(true)}>
                Book appointment
              </Button>
            ) : undefined
          }
        />

        <SectionHeader
          eyebrow="Calendar overview"
          title="Upcoming schedule and visit history"
          description="Keep future consultations visible while preserving the full clinical trail of completed, missed, or cancelled visits."
        />

        {loading ? (
          <LoadingSpinner />
        ) : (
          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <Card title="Upcoming calendar" className="rounded-[30px]">
              {Object.keys(groupedUpcoming).length ? (
                <div className="space-y-4">
                  {Object.entries(groupedUpcoming).map(([dateKey, dayAppointments]) => (
                    <div key={dateKey} className="space-y-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-tertiary">
                        {format(new Date(dateKey), 'EEEE, dd MMM')}
                      </p>
                      {dayAppointments.map((appointment) => renderAppointmentCard(appointment))}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No upcoming appointments"
                  description="Book a consultation or follow-up to start your care calendar."
                  actionLabel={canSchedule ? 'Book appointment' : undefined}
                  onAction={canSchedule ? () => setShowCreate(true) : undefined}
                />
              )}
            </Card>

            <Card title="Visit history" className="rounded-[30px]">
              {historyAppointments.length ? (
                <div className="space-y-3">
                  {historyAppointments.slice(0, 6).map((appointment) => renderAppointmentCard(appointment, true))}
                </div>
              ) : (
                <EmptyState
                  title="No visit history yet"
                  description="Completed, missed, and cancelled appointments will form a visit timeline here."
                />
              )}
            </Card>
          </div>
        )}
      </div>

      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Book appointment"
        description="Add provider, schedule, location, and follow-up context so the family timeline stays current."
        size="lg"
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={handleCreateAppointment}>
              Save appointment
            </Button>
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Family member" options={memberOptions} value={form.member_id} onChange={(event) => setForm((prev) => ({ ...prev, member_id: event.target.value }))} />
          <Select
            label="Appointment type"
            options={APPOINTMENT_TYPE_OPTIONS}
            value={form.appointment_type}
            onChange={(event) => setForm((prev) => ({ ...prev, appointment_type: event.target.value as AppointmentFormInputs['appointment_type'] }))}
          />
          <Input label="Title" value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="Quarterly diabetes review" />
          <Input label="Provider name" value={form.provider_name} onChange={(event) => setForm((prev) => ({ ...prev, provider_name: event.target.value }))} placeholder="Dr. Mehta" />
          <Input label="Provider contact" value={form.provider_contact} onChange={(event) => setForm((prev) => ({ ...prev, provider_contact: event.target.value }))} placeholder="+91 98xxxxxx12" />
          <Select
            label="Provider role"
            options={[
              { label: 'Doctor', value: 'doctor' },
              { label: 'Hospital', value: 'hospital' },
            ]}
            value={form.provider_role ?? ''}
            onChange={(event) => setForm((prev) => ({ ...prev, provider_role: event.target.value as AppointmentFormInputs['provider_role'] }))}
            placeholder="Choose role"
          />
          <Input label="Scheduled for" type="datetime-local" value={form.scheduled_for} onChange={(event) => setForm((prev) => ({ ...prev, scheduled_for: event.target.value }))} />
          <Input label="Location" value={form.location} onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))} placeholder="Clinic / hospital / lab" />
          <Select
            label="Mode"
            options={[
              { label: 'Clinic', value: 'clinic' },
              { label: 'Video', value: 'video' },
              { label: 'Home visit', value: 'home' },
            ]}
            value={form.mode ?? 'clinic'}
            onChange={(event) => setForm((prev) => ({ ...prev, mode: event.target.value as AppointmentFormInputs['mode'] }))}
          />
          <Input label="Follow-up date" type="date" value={form.follow_up_date ?? ''} onChange={(event) => setForm((prev) => ({ ...prev, follow_up_date: event.target.value }))} />
          <div className="sm:col-span-2">
            <Input label="Notes" multiline value={form.notes ?? ''} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} placeholder="Bring fasting report, continue current medicines, ask about refill." />
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(showSummary)}
        onClose={() => setShowSummary(null)}
        title="Visit summary"
        description="Capture diagnosis, follow-up instructions, and patient-facing advice after the consultation."
        size="lg"
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowSummary(null)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={handleSaveSummary}>
              Save summary
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input label="Diagnosis" value={visitSummary.diagnosis} onChange={(event) => setVisitSummary((prev) => ({ ...prev, diagnosis: event.target.value }))} />
          <Input label="Visit summary" multiline value={visitSummary.visit_summary} onChange={(event) => setVisitSummary((prev) => ({ ...prev, visit_summary: event.target.value }))} />
          <Input label="Advice / follow-up instructions" multiline value={visitSummary.advice_summary} onChange={(event) => setVisitSummary((prev) => ({ ...prev, advice_summary: event.target.value }))} />
          <Input label="Follow-up date" type="date" value={visitSummary.follow_up_date} onChange={(event) => setVisitSummary((prev) => ({ ...prev, follow_up_date: event.target.value }))} />
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(rescheduleTarget)}
        onClose={() => setRescheduleTarget(null)}
        title="Reschedule appointment"
        description="Update the visit time while preserving the appointment history."
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="ghost" onClick={() => setRescheduleTarget(null)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={handleReschedule}>
              Confirm new time
            </Button>
          </div>
        }
      >
        <Input label="New date and time" type="datetime-local" value={rescheduledFor} onChange={(event) => setRescheduledFor(event.target.value)} />
      </Modal>
    </Layout>
  );
}
