import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, UserPlus } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import PageHeader from '@/components/app/PageHeader';
import RoleBadge from '@/components/app/RoleBadge';
import SectionHeader from '@/components/app/SectionHeader';
import AccessRequestCard from '@/components/access/AccessRequestCard';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import { supabase } from '@/lib/supabase';
import {
  ACCESS_SCOPE_OPTIONS,
  BLOOD_GROUP_OPTIONS,
  DEFAULT_REQUEST_SCOPES,
  RELATION_OPTIONS,
  ROUTES,
} from '@/lib/constants';
import { useAccessRequests } from '@/hooks/useAccessRequests';
import { useAuth } from '@/context/AuthContext';
import { useFamilyMembers } from '@/hooks/useFamilyMembers';
import type { AccessRequest, AccessScope, FamilyMember, FamilyMemberFormInputs } from '@/lib/types';
import { showErrorToast, showSuccessToast } from '@/utils/errorHandler';

const emptyMemberForm: FamilyMemberFormInputs = {
  name: '',
  relation: 'Self',
  date_of_birth: '',
  phone: '',
  blood_group: '',
  allergies: [],
  chronic_conditions: [],
  emergency_contact_name: '',
  emergency_contact_phone: '',
  notes: '',
};

export default function AccessControl() {
  const { role, familyGroup } = useAuth();
  const { members, memberStats, addMember, updateMember, deleteMember } = useFamilyMembers();
  const { requests, grants, createRequest, approveRequest, rejectRequest, revokeGrant } = useAccessRequests();

  const [showMemberModal, setShowMemberModal] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [memberForm, setMemberForm] = useState<FamilyMemberFormInputs>(emptyMemberForm);
  const [requestCode, setRequestCode] = useState('');
  const [requestReason, setRequestReason] = useState('');
  const [requestScopes, setRequestScopes] = useState<AccessScope[]>(
    role === 'doctor' || role === 'hospital' || role === 'caretaker'
      ? DEFAULT_REQUEST_SCOPES[role]
      : []
  );
  const [approvalRequest, setApprovalRequest] = useState<AccessRequest | null>(null);
  const [approvalCode, setApprovalCode] = useState('');
  const [approvalScopes, setApprovalScopes] = useState<AccessScope[]>([]);
  const [approvalMemberIds, setApprovalMemberIds] = useState<string[]>([]);
  const [approvalExpiry, setApprovalExpiry] = useState('');
  const [approvalNote, setApprovalNote] = useState('');
  const [auditEntries, setAuditEntries] = useState<
    { id: string; action: string; entity_type: string; created_at: string }[]
  >([]);

  useEffect(() => {
    if (!editingMember) {
      setMemberForm(emptyMemberForm);
      return;
    }

    setMemberForm({
      name: editingMember.name,
      relation: editingMember.relation,
      date_of_birth: editingMember.date_of_birth ?? '',
      phone: editingMember.phone ?? '',
      blood_group: editingMember.blood_group ?? '',
      allergies: editingMember.allergies ?? [],
      chronic_conditions: editingMember.chronic_conditions ?? [],
      emergency_contact_name: editingMember.emergency_contact_name ?? '',
      emergency_contact_phone: editingMember.emergency_contact_phone ?? '',
      notes: editingMember.notes ?? '',
    });
  }, [editingMember]);

  useEffect(() => {
    if (!familyGroup?.id || role !== 'patient_admin') {
      setAuditEntries([]);
      return;
    }

    void supabase
      .from('access_audit_logs')
      .select('id, action, entity_type, created_at')
      .eq('target_group_id', familyGroup.id)
      .order('created_at', { ascending: false })
      .limit(6)
      .then(({ data }) => setAuditEntries((data ?? []) as typeof auditEntries));
  }, [familyGroup?.id, role]);

  const memberOptions = useMemo(
    () => members.map((member) => ({ label: member.name, value: member.id })),
    [members]
  );

  const pendingRequests = requests.filter((request) => request.status === 'pending');
  const activeGrants = grants.filter((grant) => grant.status === 'active');

  const toggleScope = (scope: AccessScope, current: AccessScope[], setter: (next: AccessScope[]) => void) => {
    setter(current.includes(scope) ? current.filter((value) => value !== scope) : [...current, scope]);
  };

  const toggleMember = (memberId: string) => {
    setApprovalMemberIds((prev) =>
      prev.includes(memberId) ? prev.filter((value) => value !== memberId) : [...prev, memberId]
    );
  };

  const openApproveModal = (request: AccessRequest) => {
    setApprovalRequest(request);
    setApprovalCode('');
    setApprovalScopes(request.requested_scopes.length ? request.requested_scopes : []);
    setApprovalMemberIds(request.member_ids.length ? request.member_ids : members.map((member) => member.id));
    setApprovalExpiry('');
    setApprovalNote('');
  };

  const handleSaveMember = async () => {
    const payload = {
      ...memberForm,
      allergies: (memberForm.allergies ?? []).filter(Boolean),
      chronic_conditions: (memberForm.chronic_conditions ?? []).filter(Boolean),
    };

    const result = editingMember
      ? await updateMember(editingMember.id, payload)
      : await addMember(payload);

    if (result.error) {
      showErrorToast(result.error);
      return;
    }

    setShowMemberModal(false);
    setEditingMember(null);
    showSuccessToast(editingMember ? 'Family member updated.' : 'Family member added.');
  };

  const handleRequestAccess = async () => {
    const result = await createRequest({
      shareCode: requestCode,
      reason: requestReason,
      requestedScopes: requestScopes,
    });

    if (result.error) {
      showErrorToast(result.error);
      return;
    }

    setRequestCode('');
    setRequestReason('');
    showSuccessToast('Access request sent. The family can now approve it with a consent code.');
  };

  const handleApproveAccess = async () => {
    if (!approvalRequest) {
      return;
    }

    const result = await approveRequest({
      request_id: approvalRequest.id,
      consent_code: approvalCode,
      permission_scopes: approvalScopes,
      member_ids: approvalMemberIds,
      expires_at: approvalExpiry || undefined,
      consultation_note: approvalNote || undefined,
    });

    if (result.error) {
      showErrorToast(result.error);
      return;
    }

    setApprovalRequest(null);
    showSuccessToast('Access approved successfully.');
  };

  return (
    <Layout pageTitle="Access Center">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Consent and permissions"
          title="Access center"
          description={
            role === 'patient_admin'
              ? 'Manage your family roster, review incoming provider requests, and control every active care grant.'
              : role === 'chemist'
                ? 'Chemists do not request patient vault access. Use this area for role context and operational guardrails.'
                : 'Request patient access with a MedFamily ID, track approvals, and review active permission scopes.'
          }
          showBackButton
          stats={
            role === 'patient_admin'
              ? [
                  { label: 'Family members', value: members.length, helper: 'Profiles inside your care workspace.', tone: 'brand' },
                  { label: 'Pending requests', value: pendingRequests.length, helper: 'Care requests awaiting your consent.', tone: 'accent' },
                  { label: 'Active grants', value: activeGrants.length, helper: 'Time-bound or ongoing access currently approved.', tone: 'neutral' },
                ]
              : [
                  { label: 'Pending requests', value: pendingRequests.length, helper: 'Requests still waiting for family approval.', tone: 'brand' },
                  { label: 'Approved grants', value: activeGrants.length, helper: 'Families currently accessible from your role.', tone: 'accent' },
                  { label: 'Scope options', value: requestScopes.length, helper: 'Permission scopes currently selected for new requests.', tone: 'neutral' },
                ]
          }
          highlights={
            role === 'patient_admin'
              ? [
                  'Every access grant can be member-specific, time-bound, and revocable',
                  familyGroup?.share_code ? `Share ID ready: ${familyGroup.share_code}` : 'Share ID will appear after family setup',
                ]
              : [
                  'Access requires explicit patient approval with a consent code',
                  'Requested scope is always visible before approval',
                ]
          }
          actions={
            role === 'patient_admin' ? (
              <div className="flex flex-wrap items-center gap-2">
                <div className="theme-chip rounded-full px-4 py-2 text-xs font-semibold">
                  MedFamily ID: <span className="text-text-primary">{familyGroup?.share_code ?? 'Pending setup'}</span>
                </div>
                <Button icon={<UserPlus className="h-4 w-4" />} onClick={() => setShowMemberModal(true)}>
                  Add member
                </Button>
              </div>
            ) : role ? (
              <RoleBadge role={role} />
            ) : undefined
          }
        />

        {role === 'patient_admin' ? (
          <>
            <SectionHeader
              eyebrow="Family foundation"
              title="Roster and access oversight"
              description="Maintain the household profile set, review audit activity, and keep consent under tight control."
            />
            <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
              <Card title="Family roster" className="rounded-[30px]">
                {members.length ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {members.map((member) => (
                      <div key={member.id} className="rounded-[24px] bg-background-strong p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-base font-bold text-text-primary">{member.name}</p>
                            <p className="mt-1 text-xs text-text-secondary">{member.relation}</p>
                          </div>
                          <Badge variant="info">{member.blood_group || 'N/A'}</Badge>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-text-secondary">
                          <span>{memberStats[member.id]?.recordCount ?? 0} records</span>
                          <span>{memberStats[member.id]?.prescriptionCount ?? 0} prescriptions</span>
                          <span>{memberStats[member.id]?.activeReminderCount ?? 0} reminders</span>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingMember(member);
                              setShowMemberModal(true);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={async () => {
                              const confirmed = window.confirm(`Remove ${member.name} from the family group?`);
                              if (!confirmed) {
                                return;
                              }
                              const result = await deleteMember(member.id);
                              if (result.error) {
                                showErrorToast(result.error);
                                return;
                              }
                              showSuccessToast('Family member removed.');
                            }}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No family members yet"
                    description="Add your first member to unlock records, reminders, and care access flows."
                    actionLabel="Add family member"
                    onAction={() => setShowMemberModal(true)}
                  />
                )}
              </Card>

              <Card title="Recent audit activity" className="rounded-[30px]">
                {auditEntries.length ? (
                  <div className="space-y-3">
                    {auditEntries.map((entry) => (
                      <div key={entry.id} className="rounded-[24px] bg-background-strong p-4">
                        <p className="text-sm font-semibold text-text-primary">{entry.action.replaceAll('_', ' ')}</p>
                        <p className="mt-1 text-xs text-text-secondary">
                          {entry.entity_type} · {new Date(entry.created_at).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="No audit events yet" description="Access approvals and record views will appear here." />
                )}
              </Card>
            </div>

            <SectionHeader
              eyebrow="Incoming requests"
              title="Approvals and active grants"
              description="Review who is asking for access, approve only the right scope, and revoke access whenever the care window ends."
            />
            <div className="grid gap-4 xl:grid-cols-2">
              <Card title="Pending access requests" className="rounded-[30px]">
                {pendingRequests.length ? (
                  <div className="space-y-3">
                    {pendingRequests.map((request) => (
                      <AccessRequestCard
                        key={request.id}
                        request={request}
                        onApprove={() => openApproveModal(request)}
                        onReject={async () => {
                          const result = await rejectRequest(request.id);
                          if (result.error) {
                            showErrorToast(result.error);
                            return;
                          }
                          showSuccessToast('Access request rejected.');
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState title="No pending requests" description="Incoming doctor, hospital, and caretaker requests will appear here." />
                )}
              </Card>

              <Card title="Active access grants" className="rounded-[30px]">
                {activeGrants.length ? (
                  <div className="space-y-3">
                    {activeGrants.map((grant) => (
                      <AccessRequestCard
                        key={grant.id}
                        grant={grant}
                        onRevoke={async () => {
                          const result = await revokeGrant(grant.id);
                          if (result.error) {
                            showErrorToast(result.error);
                            return;
                          }
                          showSuccessToast('Access revoked.');
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState title="No active grants" description="Approved care providers and caretakers will be listed here." />
                )}
              </Card>
            </div>
          </>
        ) : role === 'doctor' || role === 'hospital' || role === 'caretaker' ? (
          <>
            <SectionHeader
              eyebrow="Provider workflow"
              title="Request access and monitor approvals"
              description="Use the MedFamily ID flow to request secure patient access, then watch pending and approved states in one place."
            />
            <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
              <Card title="Request patient access" className="rounded-[30px]">
                <div className="space-y-4">
                  <Input
                    label="MedFamily ID"
                    value={requestCode}
                    onChange={(event) => setRequestCode(event.target.value.toUpperCase())}
                    placeholder="Enter the family share code"
                  />
                  <Input
                    label="Reason for access"
                    multiline
                    value={requestReason}
                    onChange={(event) => setRequestReason(event.target.value)}
                    placeholder="Explain the consultation, support need, or care context."
                  />
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-text-primary">Requested permissions</p>
                    <div className="flex flex-wrap gap-2">
                      {ACCESS_SCOPE_OPTIONS.map((scope) => (
                        <button
                          key={scope.value}
                          type="button"
                          className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                            requestScopes.includes(scope.value)
                              ? 'theme-active-surface'
                              : 'theme-chip'
                          }`}
                          onClick={() => toggleScope(scope.value, requestScopes, setRequestScopes)}
                        >
                          {scope.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Button onClick={handleRequestAccess}>Send access request</Button>
                </div>
              </Card>

              <div className="space-y-4">
                <Card title="Your pending requests" className="rounded-[30px]">
                  {pendingRequests.length ? (
                    <div className="space-y-3">
                      {pendingRequests.map((request) => (
                        <AccessRequestCard key={request.id} request={request} />
                      ))}
                    </div>
                  ) : (
                    <EmptyState title="No pending requests" description="Use a family share code to request care access." />
                  )}
                </Card>

                <Card title="Approved access" className="rounded-[30px]">
                  {activeGrants.length ? (
                    <div className="space-y-3">
                      {activeGrants.map((grant) => (
                        <AccessRequestCard key={grant.id} grant={grant} />
                      ))}
                    </div>
                  ) : (
                    <EmptyState title="No active grants" description="Once a family approves you, the grant details will appear here." />
                  )}
                </Card>
              </div>
            </div>
          </>
        ) : (
          <Card className="rounded-[30px]">
            <div className="space-y-4">
              <div className="theme-status-warning inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold">
                <ShieldCheck className="h-4 w-4" />
                Chemist role context
              </div>
              <h3 className="text-2xl font-bold text-text-primary">Chemists do not request family vault access</h3>
              <p className="text-sm text-text-secondary">
                Medication fulfilment happens through the medicine order workflow. Use the orders page to claim requests,
                update statuses, and communicate with patients in context.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => window.location.assign(ROUTES.ORDERS)}>Open orders</Button>
                <Button variant="outline" onClick={() => window.location.assign(ROUTES.NOTIFICATIONS)}>
                  View alerts
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>

      <Modal
        isOpen={showMemberModal}
        onClose={() => {
          setShowMemberModal(false);
          setEditingMember(null);
        }}
        title={editingMember ? 'Edit family member' : 'Add family member'}
        description="Capture a richer health summary so MedFamily can present the right information during access approvals."
        size="lg"
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setShowMemberModal(false);
                setEditingMember(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveMember}>{editingMember ? 'Save changes' : 'Add member'}</Button>
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Name" value={memberForm.name} onChange={(event) => setMemberForm((prev) => ({ ...prev, name: event.target.value }))} />
          <Select
            label="Relation"
            options={RELATION_OPTIONS}
            value={memberForm.relation}
            onChange={(event) => setMemberForm((prev) => ({ ...prev, relation: event.target.value as FamilyMember['relation'] }))}
          />
          <Input
            label="Date of birth"
            type="date"
            value={memberForm.date_of_birth}
            onChange={(event) => setMemberForm((prev) => ({ ...prev, date_of_birth: event.target.value }))}
          />
          <Input
            label="Phone"
            value={memberForm.phone}
            onChange={(event) => setMemberForm((prev) => ({ ...prev, phone: event.target.value }))}
          />
          <Select
            label="Blood group"
            options={BLOOD_GROUP_OPTIONS}
            value={memberForm.blood_group}
            onChange={(event) => setMemberForm((prev) => ({ ...prev, blood_group: event.target.value }))}
          />
          <Input
            label="Allergies"
            value={(memberForm.allergies ?? []).join(', ')}
            onChange={(event) =>
              setMemberForm((prev) => ({
                ...prev,
                allergies: event.target.value
                  .split(',')
                  .map((value) => value.trim())
                  .filter(Boolean),
              }))
            }
            helperText="Separate multiple items with commas."
          />
          <Input
            label="Chronic conditions"
            value={(memberForm.chronic_conditions ?? []).join(', ')}
            onChange={(event) =>
              setMemberForm((prev) => ({
                ...prev,
                chronic_conditions: event.target.value
                  .split(',')
                  .map((value) => value.trim())
                  .filter(Boolean),
              }))
            }
          />
          <Input
            label="Emergency contact name"
            value={memberForm.emergency_contact_name}
            onChange={(event) => setMemberForm((prev) => ({ ...prev, emergency_contact_name: event.target.value }))}
          />
          <Input
            label="Emergency contact phone"
            value={memberForm.emergency_contact_phone}
            onChange={(event) => setMemberForm((prev) => ({ ...prev, emergency_contact_phone: event.target.value }))}
          />
          <div className="sm:col-span-2">
            <Input
              label="Notes"
              multiline
              value={memberForm.notes}
              onChange={(event) => setMemberForm((prev) => ({ ...prev, notes: event.target.value }))}
            />
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(approvalRequest)}
        onClose={() => setApprovalRequest(null)}
        title="Approve secure access"
        description="Enter the consent code shown on the request card to confirm patient authorization."
        size="lg"
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="ghost" onClick={() => setApprovalRequest(null)}>
              Cancel
            </Button>
            <Button onClick={handleApproveAccess}>Approve access</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input label="Consent code" value={approvalCode} onChange={(event) => setApprovalCode(event.target.value)} />
          <Input
            label="Consultation note"
            multiline
            value={approvalNote}
            onChange={(event) => setApprovalNote(event.target.value)}
            placeholder="Optional note about the reason for granting access."
          />
          <Input
            label="Expiry date"
            type="date"
            value={approvalExpiry}
            onChange={(event) => setApprovalExpiry(event.target.value)}
            helperText="Leave blank for ongoing access until you revoke it."
          />

          <div className="space-y-2">
            <p className="text-sm font-semibold text-text-primary">Permission scope</p>
            <div className="flex flex-wrap gap-2">
              {ACCESS_SCOPE_OPTIONS.map((scope) => (
                <button
                  key={scope.value}
                  type="button"
                  className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                    approvalScopes.includes(scope.value)
                      ? 'theme-active-surface'
                      : 'theme-chip'
                  }`}
                  onClick={() => toggleScope(scope.value, approvalScopes, setApprovalScopes)}
                >
                  {scope.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-text-primary">Patients included in this grant</p>
            <div className="flex flex-wrap gap-2">
              {memberOptions.map((member) => (
                <button
                  key={member.value}
                  type="button"
                  className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                    approvalMemberIds.includes(member.value)
                      ? 'theme-status-success'
                      : 'theme-chip'
                  }`}
                  onClick={() => toggleMember(member.value)}
                >
                  {member.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </Layout>
  );
}
