import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { createAuditLog, createNotification } from '@/lib/appActions';
import { DEFAULT_REQUEST_SCOPES } from '@/lib/constants';
import type {
  AccessApprovalFormInputs,
  AccessGrant,
  AccessRequest,
  AccessRequestRole,
  AccessScope,
  FamilyGroup,
} from '@/lib/types';
import { handleSupabaseError, logError } from '@/utils/errorHandler';

interface AccessRequestCreationInput {
  shareCode: string;
  reason: string;
  requestedScopes?: AccessScope[];
  memberIds?: string[];
}

export function useAccessRequests() {
  const { user, role, profile, familyGroup } = useAuth();
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [grants, setGrants] = useState<AccessGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccessData = useCallback(async () => {
    if (!user || !role) {
      setRequests([]);
      setGrants([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      if (role === 'patient_admin') {
        if (!familyGroup?.id) {
          setRequests([]);
          setGrants([]);
          setLoading(false);
          return;
        }

        const [requestsRes, grantsRes] = await Promise.all([
          supabase
            .from('access_requests')
            .select('*')
            .eq('target_group_id', familyGroup.id)
            .order('created_at', { ascending: false }),
          supabase
            .from('access_grants')
            .select('*')
            .eq('target_group_id', familyGroup.id)
            .order('created_at', { ascending: false }),
        ]);

        if (requestsRes.error) {
          throw requestsRes.error;
        }

        if (grantsRes.error) {
          throw grantsRes.error;
        }

        setRequests((requestsRes.data ?? []) as AccessRequest[]);
        setGrants((grantsRes.data ?? []) as AccessGrant[]);
      } else if (role === 'doctor' || role === 'hospital' || role === 'caretaker') {
        const [requestsRes, grantsRes] = await Promise.all([
          supabase
            .from('access_requests')
            .select('*')
            .eq('requester_id', user.id)
            .order('created_at', { ascending: false }),
          supabase
            .from('access_grants')
            .select('*')
            .eq('grantee_user_id', user.id)
            .order('created_at', { ascending: false }),
        ]);

        if (requestsRes.error) {
          throw requestsRes.error;
        }

        if (grantsRes.error) {
          throw grantsRes.error;
        }

        setRequests((requestsRes.data ?? []) as AccessRequest[]);
        setGrants((grantsRes.data ?? []) as AccessGrant[]);
      } else {
        setRequests([]);
        setGrants([]);
      }

      setError(null);
    } catch (err) {
      logError(err, 'useAccessRequests.fetchAccessData');
      setError(handleSupabaseError(err as { message: string; code?: string }));
    } finally {
      setLoading(false);
    }
  }, [familyGroup?.id, role, user, familyGroup]);

  useEffect(() => {
    void fetchAccessData();
  }, [fetchAccessData]);

  const createRequest = useCallback(
    async (input: AccessRequestCreationInput) => {
      if (!user || !role || (role !== 'doctor' && role !== 'hospital' && role !== 'caretaker')) {
        return { error: 'Only doctors, hospitals, and caretakers can request access.' };
      }

      try {
        const { data: targetGroup, error: groupError } = await supabase
          .from('family_groups')
          .select('*')
          .eq('share_code', input.shareCode.trim().toUpperCase())
          .maybeSingle();

        if (groupError) {
          return { error: handleSupabaseError(groupError) };
        }

        if (!targetGroup) {
          return { error: 'No family was found for that MedFamily ID.' };
        }

        const requestedScopes =
          input.requestedScopes && input.requestedScopes.length
            ? input.requestedScopes
            : DEFAULT_REQUEST_SCOPES[role as AccessRequestRole];

        const { data, error } = await supabase
          .from('access_requests')
          .insert({
            requester_id: user.id,
            requester_name: profile?.full_name ?? user.email ?? user.phone ?? 'MedFamily user',
            requester_phone: profile?.phone ?? user.phone ?? null,
            requester_organization:
              role === 'doctor'
                ? profile?.full_name ?? null
                : role === 'hospital'
                  ? profile?.full_name ?? null
                  : null,
            target_group_id: targetGroup.id,
            requester_role: role,
            reason: input.reason,
            requested_scopes: requestedScopes,
            member_ids: input.memberIds ?? [],
          })
          .select('*')
          .single();

        if (error) {
          return { error: handleSupabaseError(error) };
        }

        await createNotification({
          user_id: targetGroup.admin_id,
          title: 'New access request',
          body: `${profile?.full_name ?? 'A care provider'} requested secure access to your family records.`,
          category: 'access_request',
          entity_type: 'access_request',
          entity_id: data.id,
        });

        await createAuditLog({
          actor_id: user.id,
          target_group_id: targetGroup.id,
          action: 'access_requested',
          entity_type: 'access_request',
          entity_id: data.id,
          metadata: {
            requester_role: role,
            requested_scopes: requestedScopes,
            share_code: input.shareCode.trim().toUpperCase(),
          },
        });

        await fetchAccessData();
        return { error: null, request: data as AccessRequest };
      } catch (err) {
        logError(err, 'useAccessRequests.createRequest');
        return { error: 'Failed to create access request.' };
      }
    },
    [fetchAccessData, profile?.full_name, profile?.phone, role, user]
  );

  const approveRequest = useCallback(
    async (input: AccessApprovalFormInputs) => {
      if (!user || !familyGroup?.id) {
        return { error: 'Only the patient account can approve access.' };
      }

      try {
        const { data: request, error: requestError } = await supabase
          .from('access_requests')
          .select('*')
          .eq('id', input.request_id)
          .maybeSingle();

        if (requestError) {
          return { error: handleSupabaseError(requestError) };
        }

        if (!request || request.target_group_id !== familyGroup.id) {
          return { error: 'Request not found.' };
        }

        if (request.consent_code !== input.consent_code.trim()) {
          return { error: 'The approval code does not match.' };
        }

        const { data: grant, error: grantError } = await supabase
          .from('access_grants')
          .insert({
            request_id: request.id,
            grantee_user_id: request.requester_id,
            grantee_name: request.requester_name,
            target_group_id: request.target_group_id,
            granted_by: user.id,
            grantee_role: request.requester_role,
            permission_scopes: input.permission_scopes,
            member_ids: input.member_ids,
            reason: request.reason,
            consultation_note: input.consultation_note ?? null,
            expires_at: input.expires_at || null,
          })
          .select('*')
          .single();

        if (grantError) {
          return { error: handleSupabaseError(grantError) };
        }

        const { error: requestUpdateError } = await supabase
          .from('access_requests')
          .update({
            status: 'approved',
            reviewed_at: new Date().toISOString(),
            reviewed_by: user.id,
            expires_at: input.expires_at || null,
          })
          .eq('id', request.id);

        if (requestUpdateError) {
          return { error: handleSupabaseError(requestUpdateError) };
        }

        await createNotification({
          user_id: request.requester_id,
          title: 'Access approved',
          body: `${familyGroup.group_name} approved your MedFamily access request.`,
          category: 'access_update',
          entity_type: 'access_grant',
          entity_id: grant.id,
        });

        await createAuditLog({
          actor_id: user.id,
          target_group_id: familyGroup.id,
          action: 'access_approved',
          entity_type: 'access_grant',
          entity_id: grant.id,
          metadata: {
            request_id: request.id,
            scopes: input.permission_scopes,
            member_ids: input.member_ids,
            expires_at: input.expires_at || null,
          },
        });

        await fetchAccessData();
        return { error: null };
      } catch (err) {
        logError(err, 'useAccessRequests.approveRequest');
        return { error: 'Failed to approve access.' };
      }
    },
    [familyGroup?.group_name, familyGroup?.id, fetchAccessData, user]
  );

  const rejectRequest = useCallback(
    async (requestId: string) => {
      if (!user || !familyGroup?.id) {
        return { error: 'Only the patient account can reject access.' };
      }

      try {
        const { data: request, error: requestError } = await supabase
          .from('access_requests')
          .select('*')
          .eq('id', requestId)
          .maybeSingle();

        if (requestError) {
          return { error: handleSupabaseError(requestError) };
        }

        if (!request) {
          return { error: 'Request not found.' };
        }

        const { error } = await supabase
          .from('access_requests')
          .update({
            status: 'rejected',
            reviewed_at: new Date().toISOString(),
            reviewed_by: user.id,
          })
          .eq('id', requestId);

        if (error) {
          return { error: handleSupabaseError(error) };
        }

        await createNotification({
          user_id: request.requester_id,
          title: 'Access request rejected',
          body: `${familyGroup.group_name} declined your MedFamily access request.`,
          category: 'access_update',
          entity_type: 'access_request',
          entity_id: requestId,
        });

        await fetchAccessData();
        return { error: null };
      } catch (err) {
        logError(err, 'useAccessRequests.rejectRequest');
        return { error: 'Failed to reject access.' };
      }
    },
    [familyGroup?.group_name, familyGroup?.id, fetchAccessData, user]
  );

  const revokeGrant = useCallback(
    async (grantId: string) => {
      if (!user || !familyGroup?.id) {
        return { error: 'Only the patient account can revoke access.' };
      }

      try {
        const { data: grant, error: grantError } = await supabase
          .from('access_grants')
          .select('*')
          .eq('id', grantId)
          .maybeSingle();

        if (grantError) {
          return { error: handleSupabaseError(grantError) };
        }

        if (!grant) {
          return { error: 'Grant not found.' };
        }

        const { error } = await supabase
          .from('access_grants')
          .update({
            status: 'revoked',
            revoked_at: new Date().toISOString(),
            revoked_by: user.id,
          })
          .eq('id', grantId);

        if (error) {
          return { error: handleSupabaseError(error) };
        }

        await createNotification({
          user_id: grant.grantee_user_id,
          title: 'Access revoked',
          body: `${familyGroup.group_name} revoked your MedFamily access.`,
          category: 'access_update',
          entity_type: 'access_grant',
          entity_id: grantId,
        });

        await createAuditLog({
          actor_id: user.id,
          target_group_id: familyGroup.id,
          action: 'access_revoked',
          entity_type: 'access_grant',
          entity_id: grantId,
        });

        await fetchAccessData();
        return { error: null };
      } catch (err) {
        logError(err, 'useAccessRequests.revokeGrant');
        return { error: 'Failed to revoke access.' };
      }
    },
    [familyGroup?.group_name, familyGroup?.id, fetchAccessData, user]
  );

  const lookupShareCode = useCallback(async (shareCode: string) => {
    const { data, error } = await supabase
      .from('family_groups')
      .select('id, group_name, share_code')
      .eq('share_code', shareCode.trim().toUpperCase())
      .maybeSingle();

    if (error) {
      return { error: handleSupabaseError(error), group: null };
    }

    return { error: null, group: data as FamilyGroup | null };
  }, []);

  return {
    requests,
    grants,
    loading,
    error,
    fetchAccessData,
    createRequest,
    approveRequest,
    rejectRequest,
    revokeGrant,
    lookupShareCode,
  };
}
