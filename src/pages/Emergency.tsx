import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { format, isFuture } from 'date-fns';
import {
  AlertTriangle,
  Download,
  FileHeart,
  HeartHandshake,
  PhoneCall,
  Printer,
  ShieldAlert,
  Siren,
} from 'lucide-react';
import Layout from '@/components/layout/Layout';
import PageHeader from '@/components/app/PageHeader';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import Select from '@/components/ui/Select';
import { supabase } from '@/lib/supabase';
import { useAppointments } from '@/hooks/useAppointments';
import { useHealthHub } from '@/hooks/useHealthHub';
import { usePrescriptions } from '@/hooks/usePrescriptions';
import { useReminders } from '@/hooks/useReminders';
import type { FamilyMember, Profile } from '@/lib/types';
import { downloadTextFile, printHtmlDocument } from '@/utils/exportHelpers';

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

function EmergencyContactCard({
  title,
  subtitle,
  phone,
  icon,
}: {
  title: string;
  subtitle: string;
  phone: string | null | undefined;
  icon: ReactNode;
}) {
  return (
    <Card className="rounded-[28px]">
      <div className="flex items-start gap-4">
        <div className="theme-icon-badge-coral flex h-12 w-12 items-center justify-center rounded-[20px]">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-text-primary">{title}</p>
          <p className="mt-1 text-xs text-text-secondary">{subtitle}</p>
          <p className="mt-3 text-sm font-semibold text-text-primary">{phone || 'Contact not saved'}</p>
          {phone ? (
            <a
              href={`tel:${phone}`}
              className="theme-active-surface mt-3 inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold"
            >
              <PhoneCall className="h-3.5 w-3.5" />
              Call now
            </a>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

export default function EmergencyPage() {
  const { members, vitals, accessibleFamilies } = useHealthHub();
  const { reminders } = useReminders();
  const { appointments } = useAppointments();
  const { prescriptions } = usePrescriptions();
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [focusMode, setFocusMode] = useState(false);
  const [adminProfiles, setAdminProfiles] = useState<Record<string, Profile>>({});

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
    const adminIds = [...new Set(accessibleFamilies.map((family) => family.group.admin_id))].filter(Boolean);
    if (!adminIds.length) {
      setAdminProfiles({});
      return;
    }

    void supabase
      .from('profiles')
      .select('*')
      .in('id', adminIds)
      .then(({ data }) => {
        const next: Record<string, Profile> = {};
        for (const profile of (data ?? []) as Profile[]) {
          next[profile.id] = profile;
        }
        setAdminProfiles(next);
      });
  }, [accessibleFamilies]);

  const selectedMember = useMemo(
    () => members.find((member) => member.id === selectedMemberId) ?? members[0] ?? null,
    [members, selectedMemberId]
  );

  const selectedFamily = useMemo(
    () =>
      accessibleFamilies.find((family) =>
        family.members.some((member) => member.id === selectedMember?.id)
      ) ?? null,
    [accessibleFamilies, selectedMember?.id]
  );

  const memberOptions = useMemo(
    () => members.map((member) => ({ label: `${member.name} (${member.relation})`, value: member.id })),
    [members]
  );

  const currentMedicines = useMemo(
    () => reminders.filter((reminder) => (selectedMember ? reminder.member_id === selectedMember.id : true)),
    [reminders, selectedMember]
  );

  const latestVitals = useMemo(
    () =>
      vitals
        .filter((entry) => (selectedMember ? entry.member_id === selectedMember.id : true))
        .slice(0, 4),
    [selectedMember, vitals]
  );

  const upcomingAppointment = useMemo(
    () =>
      appointments.find(
        (appointment) =>
          (!selectedMember || appointment.member_id === selectedMember.id) &&
          (appointment.status === 'scheduled' || appointment.status === 'confirmed') &&
          isFuture(new Date(appointment.scheduled_for))
      ) ?? null,
    [appointments, selectedMember]
  );

  const latestPrescription = useMemo(
    () =>
      prescriptions.find((prescription) =>
        selectedMember ? prescription.member_id === selectedMember.id : true
      ) ?? null,
    [prescriptions, selectedMember]
  );

  const adminProfile = selectedFamily ? adminProfiles[selectedFamily.group.admin_id] : null;
  const doctorPhone = upcomingAppointment?.provider_contact ?? null;

  const summaryText = useMemo(() => {
    if (!selectedMember) {
      return '';
    }

    return [
      `MedFamily Emergency Summary - ${selectedMember.name}`,
      `Relation: ${selectedMember.relation}`,
      `Age group: ${getAgeGroup(selectedMember)}`,
      `Blood group: ${selectedMember.blood_group || 'Not set'}`,
      `Allergies: ${selectedMember.allergies.join(', ') || 'None saved'}`,
      `Chronic conditions: ${selectedMember.chronic_conditions.join(', ') || 'None saved'}`,
      `Emergency contact: ${selectedMember.emergency_contact_name || 'Not set'} (${selectedMember.emergency_contact_phone || 'No phone'})`,
      `Family admin: ${adminProfile?.full_name || 'Not set'} (${adminProfile?.phone || 'No phone'})`,
      `Doctor contact: ${doctorPhone || 'Not available'}`,
      '',
      'Current medicines:',
      ...currentMedicines.map(
        (reminder) =>
          `- ${reminder.medicine_name} ${reminder.dosage} at ${reminder.reminder_times.join(', ')}`
      ),
      '',
      'Latest vitals:',
      ...latestVitals.map(
        (entry) =>
          `- ${entry.metric_type.replace('_', ' ')}: ${entry.value_primary}${
            entry.value_secondary ? `/${entry.value_secondary}` : ''
          } ${entry.unit || ''} on ${format(new Date(entry.recorded_at), 'dd MMM yyyy, hh:mm a')}`
      ),
      '',
      upcomingAppointment
        ? `Upcoming appointment: ${upcomingAppointment.title} on ${format(
            new Date(upcomingAppointment.scheduled_for),
            'dd MMM yyyy, hh:mm a'
          )}`
        : 'Upcoming appointment: None scheduled',
    ].join('\n');
  }, [adminProfile?.full_name, adminProfile?.phone, currentMedicines, doctorPhone, latestVitals, selectedMember, upcomingAppointment]);

  const handleDownload = () => {
    if (!selectedMember) {
      return;
    }

    downloadTextFile(`medfamily-emergency-${selectedMember.name.toLowerCase().replace(/\s+/g, '-')}.txt`, summaryText);
  };

  const handlePrint = () => {
    if (!selectedMember) {
      return;
    }

    const html = `
      <h1>MedFamily Emergency Summary</h1>
      <div class="section">
        <h2>${selectedMember.name}</h2>
        <p><strong>Relation:</strong> ${selectedMember.relation}</p>
        <p><strong>Age group:</strong> ${getAgeGroup(selectedMember)}</p>
        <p><strong>Blood group:</strong> ${selectedMember.blood_group || 'Not set'}</p>
        <p><strong>Emergency contact:</strong> ${selectedMember.emergency_contact_name || 'Not set'} (${selectedMember.emergency_contact_phone || 'No phone'})</p>
      </div>
      <div class="section">
        <h3>Clinical flags</h3>
        <span class="pill">Allergies: ${selectedMember.allergies.join(', ') || 'None saved'}</span>
        <span class="pill">Chronic conditions: ${selectedMember.chronic_conditions.join(', ') || 'None saved'}</span>
      </div>
      <div class="section">
        <h3>Current medicines</h3>
        <ul>
          ${
            currentMedicines.length
              ? currentMedicines
                  .map(
                    (reminder) =>
                      `<li>${reminder.medicine_name} ${reminder.dosage} · ${reminder.reminder_times.join(', ')}</li>`
                  )
                  .join('')
              : '<li>No active medicines saved</li>'
          }
        </ul>
      </div>
      <div class="section">
        <h3>Recent vitals</h3>
        <ul>
          ${
            latestVitals.length
              ? latestVitals
                  .map(
                    (entry) =>
                      `<li>${entry.metric_type.replace('_', ' ')} · ${entry.value_primary}${
                        entry.value_secondary ? `/${entry.value_secondary}` : ''
                      } ${entry.unit || ''} · ${format(new Date(entry.recorded_at), 'dd MMM yyyy, hh:mm a')}</li>`
                  )
                  .join('')
              : '<li>No vitals logged</li>'
          }
        </ul>
      </div>
      <div class="section">
        <h3>Care contacts</h3>
        <p><strong>Family admin:</strong> ${adminProfile?.full_name || 'Not set'} (${adminProfile?.phone || 'No phone'})</p>
        <p><strong>Doctor contact:</strong> ${doctorPhone || 'Not available'}</p>
        <small>Generated from MedFamily emergency mode.</small>
      </div>
    `;

    printHtmlDocument(`MedFamily Emergency Summary - ${selectedMember.name}`, html);
  };

  return (
    <Layout pageTitle="Emergency Summary">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Critical situation mode"
          title="Emergency summary"
          description="Fast-access patient summary with key health facts, current medicines, quick contacts, and export-ready clinic handoff details."
          showBackButton
          stats={[
            { label: 'Current medicines', value: currentMedicines.length, helper: 'Active medication schedules tied to this patient.', tone: 'brand' },
            { label: 'Recent vitals', value: latestVitals.length, helper: 'Most recent structured readings available right now.', tone: 'accent' },
            {
              label: 'Contact points',
              value: [selectedMember?.emergency_contact_phone, adminProfile?.phone, doctorPhone].filter(Boolean).length,
              helper: 'Emergency, family, and provider contacts available from this summary.',
              tone: 'neutral',
            },
            { label: 'Fast mode', value: focusMode ? 'On' : 'Off', helper: 'High-emphasis display for urgent handoff situations.', tone: 'warm' },
          ]}
          highlights={[
            selectedMember ? `${selectedMember.name} emergency sheet is export-ready` : 'Choose a patient to unlock the emergency sheet',
            'Allergies, conditions, medicines, vitals, and contacts are grouped for fast handoff',
          ]}
          actions={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" icon={<Printer className="h-4 w-4" />} onClick={handlePrint}>
                Print / Save PDF
              </Button>
              <Button variant="outline" icon={<Download className="h-4 w-4" />} onClick={handleDownload}>
                Download summary
              </Button>
              <Button icon={<Siren className="h-4 w-4" />} onClick={() => setFocusMode((current) => !current)}>
                {focusMode ? 'Exit fast mode' : 'Fast access mode'}
              </Button>
            </div>
          }
        />

        {!selectedMember ? (
          <EmptyState
            title="No patient summary available"
            description="Add or link a patient member first to unlock the emergency-ready view."
          />
        ) : (
          <>
            <Card
              className={`rounded-[34px] border ${
                focusMode
                  ? 'border-coral-200 bg-linear-to-br from-coral-50 via-white to-warning-50 shadow-[0_24px_70px_rgba(241,93,52,0.12)]'
                  : 'rounded-[34px]'
              }`}
            >
              <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                <div className="space-y-5">
                  <div className="flex flex-wrap items-start gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-coral-50 text-coral-500">
                      <ShieldAlert className="h-7 w-7" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-bold text-text-primary">{selectedMember.name}</h2>
                      <p className="mt-2 text-sm text-text-secondary">
                        {selectedMember.relation} · {getAgeGroup(selectedMember)}
                        {getAgeYears(selectedMember.date_of_birth) !== null
                          ? ` · ${getAgeYears(selectedMember.date_of_birth)} yrs`
                          : ''}
                      </p>
                    </div>
                  </div>

                  <Select
                    label="Patient summary"
                    options={memberOptions}
                    value={selectedMemberId}
                    onChange={(event) => setSelectedMemberId(event.target.value)}
                  />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[24px] bg-background-strong p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-text-tertiary">Blood group</p>
                      <p className="mt-2 text-3xl font-bold text-text-primary">
                        {selectedMember.blood_group || 'N/A'}
                      </p>
                    </div>
                    <div className="rounded-[24px] bg-background-strong p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-text-tertiary">Emergency contact</p>
                      <p className="mt-2 text-lg font-bold text-text-primary">
                        {selectedMember.emergency_contact_name || 'Not saved'}
                      </p>
                      <p className="mt-1 text-sm text-text-secondary">
                        {selectedMember.emergency_contact_phone || 'No phone saved'}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[26px] bg-background-strong p-5">
                    <p className="text-sm font-bold text-text-primary">Quick-access health facts</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {(selectedMember.allergies.length
                        ? selectedMember.allergies
                        : ['No allergies saved']
                      ).map((item) => (
                        <span key={`allergy-${item}`} className="theme-chip rounded-full px-3 py-2 text-xs font-semibold">
                          Allergy: {item}
                        </span>
                      ))}
                      {(selectedMember.chronic_conditions.length
                        ? selectedMember.chronic_conditions
                        : ['No chronic conditions saved']
                      ).map((item) => (
                        <span
                          key={`condition-${item}`}
                          className="theme-chip rounded-full px-3 py-2 text-xs font-semibold"
                        >
                          Condition: {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <Card title="Current medicines" className="rounded-[28px] border border-transparent shadow-none">
                    {currentMedicines.length ? (
                      <div className="space-y-3">
                        {currentMedicines.slice(0, 5).map((reminder) => (
                          <div key={reminder.id} className="rounded-[20px] bg-background-strong p-4">
                            <p className="text-sm font-bold text-text-primary">{reminder.medicine_name}</p>
                            <p className="mt-1 text-xs text-text-secondary">
                              {reminder.dosage} · {reminder.reminder_times.join(', ')}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState title="No active medicines" description="Active reminders will surface here." />
                    )}
                  </Card>

                  <Card title="Clinical handoff" className="rounded-[28px] border border-transparent shadow-none">
                    <div className="space-y-3 text-sm text-text-secondary">
                      <p>
                        <strong className="text-text-primary">Latest prescription:</strong>{' '}
                        {latestPrescription
                          ? `${latestPrescription.doctor_name || 'MedFamily prescription'} on ${format(
                              new Date(latestPrescription.prescription_date),
                              'dd MMM yyyy'
                            )}`
                          : 'No prescription saved'}
                      </p>
                      <p>
                        <strong className="text-text-primary">Upcoming visit:</strong>{' '}
                        {upcomingAppointment
                          ? `${upcomingAppointment.title} on ${format(
                              new Date(upcomingAppointment.scheduled_for),
                              'dd MMM yyyy, hh:mm a'
                            )}`
                          : 'No upcoming appointment'}
                      </p>
                    </div>
                  </Card>
                </div>
              </div>
            </Card>

            <div className="grid gap-4 lg:grid-cols-3">
              <EmergencyContactCard
                title="Emergency contact"
                subtitle="Fastest family or guardian contact saved for this patient."
                phone={selectedMember.emergency_contact_phone}
                icon={<HeartHandshake className="h-5 w-5" />}
              />
              <EmergencyContactCard
                title="Family admin"
                subtitle="Primary MedFamily account holder for approvals and context."
                phone={adminProfile?.phone}
                icon={<FileHeart className="h-5 w-5" />}
              />
              <EmergencyContactCard
                title="Doctor / provider"
                subtitle="Next consultation or latest known provider contact."
                phone={doctorPhone}
                icon={<AlertTriangle className="h-5 w-5" />}
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
              <Card title="Latest vitals" eyebrow="Immediate context" className="rounded-[30px]">
                {latestVitals.length ? (
                  <div className="space-y-3">
                    {latestVitals.map((entry) => (
                      <div key={entry.id} className="rounded-[24px] bg-background-strong p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-text-primary">
                              {entry.metric_type.replace('_', ' ')}
                            </p>
                            <p className="mt-1 text-xs text-text-secondary">
                              {entry.value_primary}
                              {entry.value_secondary ? `/${entry.value_secondary}` : ''} {entry.unit || ''}
                            </p>
                          </div>
                          <span className="theme-chip rounded-full px-3 py-1.5 text-[11px] font-semibold">
                            {format(new Date(entry.recorded_at), 'dd MMM · hh:mm a')}
                          </span>
                        </div>
                        {entry.symptoms.length ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {entry.symptoms.map((symptom) => (
                              <span key={`${entry.id}-${symptom}`} className="theme-chip rounded-full px-3 py-2 text-xs font-semibold">
                                {symptom}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="No vitals recorded yet" description="Health readings will surface here when added." />
                )}
              </Card>

              <Card title="Emergency-ready notes" eyebrow="Prepared for clinic handoff" className="rounded-[30px]">
                <div className="space-y-4 rounded-[24px] bg-background-strong p-5 text-sm text-text-secondary">
                  <p>
                    MedFamily keeps the minimum critical context together: allergies, chronic conditions, current
                    medicines, emergency contact details, and the next known consultation touchpoint.
                  </p>
                  <p>
                    Use the export buttons above to print or save this summary as a visit-ready sheet for a hospital,
                    ambulance team, or consulting doctor.
                  </p>
                  {selectedMember.notes ? (
                    <div className="theme-surface-soft rounded-[20px] px-4 py-3">
                      <p className="font-semibold text-text-primary">Member note</p>
                      <p className="mt-2 text-text-secondary">{selectedMember.notes}</p>
                    </div>
                  ) : null}
                </div>
              </Card>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
