import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Download, Eye, Filter, Trash2, UploadCloud } from 'lucide-react';
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
import { useAuth } from '@/context/AuthContext';
import { RECORD_TYPE_OPTIONS } from '@/lib/constants';
import type { FilterState, PatientRecord } from '@/lib/types';
import { usePatientRecords } from '@/hooks/usePatientRecords';
import { showErrorToast, showSuccessToast } from '@/utils/errorHandler';

export default function PatientRecords() {
  const { role } = useAuth();
  const { members, records, loading, uploading, fetchRecords, uploadRecord, removeRecord, downloadRecord } =
    usePatientRecords();

  const [filters, setFilters] = useState<FilterState>({});
  const [showUpload, setShowUpload] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [memberId, setMemberId] = useState('');
  const [recordType, setRecordType] = useState('');
  const [notes, setNotes] = useState('');

  const memberOptions = useMemo(
    () => members.map((member) => ({ label: member.name, value: member.id })),
    [members]
  );

  const canUpload = role === 'patient_admin';

  const handleFilterChange = (next: Partial<FilterState>) => {
    const merged = { ...filters, ...next };
    setFilters(merged);
    void fetchRecords(merged);
  };

  const handleUpload = async () => {
    if (!file || !memberId || !recordType) {
      showErrorToast('Choose a patient, a record type, and a file to continue.');
      return;
    }

    const result = await uploadRecord(file, memberId, recordType, notes);
    if (result.error) {
      showErrorToast(result.error);
      return;
    }

    setShowUpload(false);
    setFile(null);
    setMemberId('');
    setRecordType('');
    setNotes('');
    showSuccessToast('Medical record uploaded successfully.');
  };

  const handleDownload = async (record: PatientRecord) => {
    const url = await downloadRecord(record);
    if (!url) {
      showErrorToast('Failed to generate a secure preview link.');
      return;
    }

    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleDelete = async (record: PatientRecord) => {
    const confirmed = window.confirm(`Delete "${record.file_name}"?`);
    if (!confirmed) {
      return;
    }

    const result = await removeRecord(record);
    if (result.error) {
      showErrorToast(result.error);
      return;
    }

    showSuccessToast('Record deleted.');
  };

  return (
    <Layout pageTitle="Patient Records">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Clinical records"
          title="Patient records"
          description="Search, filter, preview, and securely share reports across your approved care network."
          showBackButton
          stats={[
            { label: 'Vault records', value: records.length, helper: 'Securely stored files in your workspace.', tone: 'brand' },
            { label: 'Patient profiles', value: members.length, helper: 'Member-wise separation across one family workspace.', tone: 'accent' },
            { label: 'Access mode', value: canUpload ? 'Manage' : 'View only', helper: 'Upload and delete rights remain role-aware.', tone: 'neutral' },
          ]}
          highlights={[
            'Member-wise record separation is active',
            'Secure preview and download links are generated on demand',
            `${new Set(records.map((record) => record.record_type)).size} record categories currently indexed`,
          ]}
          actions={
            canUpload ? (
              <Button icon={<UploadCloud className="h-4 w-4" />} onClick={() => setShowUpload(true)}>
                Upload record
              </Button>
            ) : undefined
          }
        />

        <Card className="rounded-[30px]">
          <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
            <SearchBar
              value={filters.search ?? ''}
              onChange={(value) => handleFilterChange({ search: value })}
              placeholder="Search by file name or patient"
            />
            <Select
              options={memberOptions}
              value={filters.member_id ?? ''}
              onChange={(event) => handleFilterChange({ member_id: event.target.value || undefined })}
              placeholder="All patients"
            />
            <Select
              options={RECORD_TYPE_OPTIONS}
              value={filters.record_type ?? ''}
              onChange={(event) =>
                handleFilterChange({
                  record_type: (event.target.value || undefined) as FilterState['record_type'],
                })
              }
              placeholder="All record types"
            />
          </div>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-background-strong px-4 py-2 text-xs font-semibold text-text-secondary">
            <Filter className="h-3.5 w-3.5" />
            {records.length} records available in your workspace
          </div>
        </Card>

        {loading ? (
          <LoadingSpinner />
        ) : records.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {records.map((record) => (
              <Card key={record.id} className="rounded-[30px]" hoverable>
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-bold text-text-primary">{record.file_name}</p>
                      <p className="mt-1 text-sm text-text-secondary">
                        {record.member_name} · {record.record_type}
                      </p>
                    </div>
                    <div className="theme-active-surface rounded-full px-3 py-1.5 text-xs font-semibold">
                      {format(new Date(record.upload_date), 'dd MMM yyyy')}
                    </div>
                  </div>

                  {record.notes ? (
                    <div className="rounded-[24px] bg-background-strong p-4 text-sm text-text-secondary">
                      {record.notes}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" icon={<Eye className="h-4 w-4" />} onClick={() => handleDownload(record)}>
                      Preview
                    </Button>
                    <Button size="sm" variant="ghost" icon={<Download className="h-4 w-4" />} onClick={() => handleDownload(record)}>
                      Download
                    </Button>
                    {canUpload ? (
                      <Button size="sm" variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => handleDelete(record)}>
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
            title="No records yet"
            description="Upload your first report or wait for an approved provider workspace to expose available documents."
            actionLabel={canUpload ? 'Upload first record' : undefined}
            onAction={canUpload ? () => setShowUpload(true) : undefined}
          />
        )}
      </div>

      <Modal
        isOpen={showUpload}
        onClose={() => setShowUpload(false)}
        title="Upload patient record"
        description="Private files are stored securely in Supabase storage and only visible through approved access scopes."
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowUpload(false)}>
              Cancel
            </Button>
            <Button loading={uploading} onClick={handleUpload}>
              Save record
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Select label="Patient" options={memberOptions} value={memberId} onChange={(event) => setMemberId(event.target.value)} />
          <Select
            label="Record type"
            options={RECORD_TYPE_OPTIONS}
            value={recordType}
            onChange={(event) => setRecordType(event.target.value)}
          />
          <Input
            label="Clinical note"
            multiline
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Add context such as visit reason, test center, or urgency."
          />
          <FileUpload onFileSelect={(files) => setFile(files[0] ?? null)} label="Attachment" />
        </div>
      </Modal>
    </Layout>
  );
}
