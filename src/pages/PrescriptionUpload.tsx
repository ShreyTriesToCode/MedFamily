import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Eye, Pill, Plus, Trash2 } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import PageHeader from '@/components/app/PageHeader';
import SearchBar from '@/components/app/SearchBar';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import FileUpload from '@/components/ui/FileUpload';
import Input from '@/components/ui/Input';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';
import { FREQUENCY_OPTIONS } from '@/lib/constants';
import { useAuth } from '@/context/AuthContext';
import { usePrescriptions } from '@/hooks/usePrescriptions';
import type { MedicineEntry } from '@/lib/types';
import { showErrorToast, showSuccessToast } from '@/utils/errorHandler';

function emptyMedicine(): MedicineEntry {
  return {
    name: '',
    dosage: '',
    frequency: 'Once daily',
    reminder_times: ['09:00'],
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
    notes: '',
  };
}

export default function PrescriptionUpload() {
  const { role } = useAuth();
  const { members, prescriptions, loading, uploading, uploadPrescription, removePrescription, previewPrescription } =
    usePrescriptions();

  const [search, setSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [memberId, setMemberId] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [prescriptionDate, setPrescriptionDate] = useState(new Date().toISOString().slice(0, 10));
  const [medicines, setMedicines] = useState<MedicineEntry[]>([emptyMedicine()]);

  const canUpload = role === 'patient_admin';

  const memberOptions = useMemo(
    () => members.map((member) => ({ label: member.name, value: member.id })),
    [members]
  );

  const filteredPrescriptions = useMemo(() => {
    return prescriptions.filter((prescription) => {
      const matchesMember = selectedMember ? prescription.member_id === selectedMember : true;
      const matchesSearch = search
        ? `${prescription.member_name} ${prescription.doctor_name ?? ''}`.toLowerCase().includes(search.toLowerCase())
        : true;
      return matchesMember && matchesSearch;
    });
  }, [prescriptions, search, selectedMember]);

  const medicineCount = useMemo(
    () => prescriptions.reduce((count, prescription) => count + prescription.medicines.length, 0),
    [prescriptions]
  );

  const handleUpload = async () => {
    if (!file || !memberId) {
      showErrorToast('Choose a patient and attach a prescription file.');
      return;
    }

    const result = await uploadPrescription(file, memberId, doctorName, prescriptionDate, medicines);
    if (result.error) {
      showErrorToast(result.error);
      return;
    }

    setShowModal(false);
    setFile(null);
    setMemberId('');
    setDoctorName('');
    setPrescriptionDate(new Date().toISOString().slice(0, 10));
    setMedicines([emptyMedicine()]);
    showSuccessToast('Prescription saved and reminder generation triggered.');
  };

  const handleDelete = async (prescriptionId: string, fileUrl: string | null) => {
    const confirmed = window.confirm('Delete this prescription?');
    if (!confirmed) {
      return;
    }

    const result = await removePrescription(prescriptionId, fileUrl);
    if (result.error) {
      showErrorToast(result.error);
      return;
    }

    showSuccessToast('Prescription deleted.');
  };

  return (
    <Layout pageTitle="Prescriptions">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Digitised medication history"
          title="Prescriptions"
          description="Review prescriptions, browse medicines, and power downstream reminders or medicine orders."
          showBackButton
          stats={[
            { label: 'Prescriptions saved', value: prescriptions.length, helper: 'Structured prescription files in your timeline.', tone: 'brand' },
            { label: 'Medicines tracked', value: medicineCount, helper: 'Digitised entries available for reminders and orders.', tone: 'accent' },
            { label: 'Patients covered', value: members.length, helper: 'Members with prescription context in this workspace.', tone: 'warm' },
          ]}
          highlights={[
            'Digitised medicines feed reminder generation',
            'Prescription history stays ready for reorder workflows',
            canUpload ? 'You can add and clean up prescription files here' : 'This view stays read-only for your role',
          ]}
          actions={
            canUpload ? (
              <Button icon={<Plus className="h-4 w-4" />} onClick={() => setShowModal(true)}>
                Add prescription
              </Button>
            ) : undefined
          }
        />

        <Card className="rounded-[30px]">
          <div className="grid gap-3 lg:grid-cols-[1.3fr_0.7fr]">
            <SearchBar value={search} onChange={setSearch} placeholder="Search by patient or doctor" />
            <Select
              options={memberOptions}
              value={selectedMember}
              onChange={(event) => setSelectedMember(event.target.value)}
              placeholder="All patients"
            />
          </div>
        </Card>

        {loading ? (
          <LoadingSpinner />
        ) : filteredPrescriptions.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {filteredPrescriptions.map((prescription) => (
              <Card key={prescription.id} className="rounded-[30px]" hoverable>
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-bold text-text-primary">{prescription.member_name}</p>
                      <p className="mt-1 text-sm text-text-secondary">
                        {prescription.doctor_name || 'Doctor not provided'}
                      </p>
                    </div>
                    <div className="theme-status-success rounded-full px-3 py-1.5 text-xs font-semibold">
                      {format(new Date(prescription.prescription_date), 'dd MMM yyyy')}
                    </div>
                  </div>

                  <div className="rounded-[24px] bg-background-strong p-4">
                    <div className="flex items-center gap-2">
                      <Pill className="h-4 w-4 text-primary-600" />
                      <p className="text-sm font-semibold text-text-primary">Medicines</p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {prescription.medicines.map((medicine) => (
                        <span
                          key={`${prescription.id}-${medicine.name}-${medicine.dosage}`}
                          className="theme-chip rounded-full px-3 py-2 text-xs font-semibold"
                        >
                          {medicine.name} · {medicine.dosage}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      icon={<Eye className="h-4 w-4" />}
                      onClick={async () => {
                        const url = await previewPrescription(prescription);
                        if (!url) {
                          showErrorToast('Unable to create a secure preview link.');
                          return;
                        }
                        window.open(url, '_blank', 'noopener,noreferrer');
                      }}
                    >
                      Preview
                    </Button>
                    {canUpload ? (
                      <Button
                        size="sm"
                        variant="danger"
                        icon={<Trash2 className="h-4 w-4" />}
                        onClick={() => handleDelete(prescription.id, prescription.file_url)}
                      >
                        Delete
                      </Button>
                    ) : null}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No prescriptions yet"
            description="Digitised prescriptions will appear here with medicine details for reminders and future orders."
            actionLabel={canUpload ? 'Add prescription' : undefined}
            onAction={canUpload ? () => setShowModal(true) : undefined}
          />
        )}
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Add prescription"
        description="Upload the file and capture the medicines so MedFamily can generate reminders and support medicine ordering."
        size="lg"
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button loading={uploading} onClick={handleUpload}>
              Save prescription
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Patient" options={memberOptions} value={memberId} onChange={(event) => setMemberId(event.target.value)} />
            <Input
              label="Doctor / consultant"
              value={doctorName}
              onChange={(event) => setDoctorName(event.target.value)}
              placeholder="Dr. Name"
            />
            <Input
              label="Prescription date"
              type="date"
              value={prescriptionDate}
              onChange={(event) => setPrescriptionDate(event.target.value)}
            />
          </div>

          <FileUpload onFileSelect={(files) => setFile(files[0] ?? null)} label="Prescription file" />

          <Card title="Digitised medicines" className="rounded-[28px]">
            <div className="space-y-4">
              {medicines.map((medicine, index) => (
                <div key={`medicine-${index}`} className="rounded-[24px] bg-background-strong p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      label="Medicine"
                      value={medicine.name}
                      onChange={(event) =>
                        setMedicines((prev) =>
                          prev.map((entry, currentIndex) =>
                            currentIndex === index ? { ...entry, name: event.target.value } : entry
                          )
                        )
                      }
                    />
                    <Input
                      label="Dosage"
                      value={medicine.dosage}
                      onChange={(event) =>
                        setMedicines((prev) =>
                          prev.map((entry, currentIndex) =>
                            currentIndex === index ? { ...entry, dosage: event.target.value } : entry
                          )
                        )
                      }
                    />
                    <Select
                      label="Frequency"
                      options={FREQUENCY_OPTIONS}
                      value={medicine.frequency}
                      onChange={(event) =>
                        setMedicines((prev) =>
                          prev.map((entry, currentIndex) =>
                            currentIndex === index
                              ? { ...entry, frequency: event.target.value as MedicineEntry['frequency'] }
                              : entry
                          )
                        )
                      }
                    />
                    <Input
                      label="Reminder times"
                      value={medicine.reminder_times.join(', ')}
                      onChange={(event) =>
                        setMedicines((prev) =>
                          prev.map((entry, currentIndex) =>
                            currentIndex === index
                              ? {
                                  ...entry,
                                  reminder_times: event.target.value
                                    .split(',')
                                    .map((value) => value.trim())
                                    .filter(Boolean),
                                }
                              : entry
                          )
                        )
                      }
                      helperText="Separate multiple times with commas, for example 09:00, 21:00."
                    />
                    <Input
                      label="Start date"
                      type="date"
                      value={medicine.start_date}
                      onChange={(event) =>
                        setMedicines((prev) =>
                          prev.map((entry, currentIndex) =>
                            currentIndex === index ? { ...entry, start_date: event.target.value } : entry
                          )
                        )
                      }
                    />
                    <Input
                      label="End date"
                      type="date"
                      value={medicine.end_date}
                      onChange={(event) =>
                        setMedicines((prev) =>
                          prev.map((entry, currentIndex) =>
                            currentIndex === index ? { ...entry, end_date: event.target.value } : entry
                          )
                        )
                      }
                    />
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setMedicines((prev) => [...prev, emptyMedicine()])}>
                Add another medicine
              </Button>
            </div>
          </Card>
        </div>
      </Modal>
    </Layout>
  );
}
