import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useCareWorkspace } from '@/hooks/useCareWorkspace';
import { createAuditLog } from '@/lib/appActions';
import { STORAGE_BUCKETS } from '@/lib/constants';
import type { FilterState, PatientRecord } from '@/lib/types';
import { handleSupabaseError, logError } from '@/utils/errorHandler';
import { deleteFile, generateUniqueFileName, getSignedUrl, uploadFile } from '@/utils/storageHelpers';

export function usePatientRecords() {
  const { user, familyGroup } = useAuth();
  const { members, loading: workspaceLoading, refresh: refreshWorkspace } = useCareWorkspace('records');
  const [records, setRecords] = useState<PatientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const memberNameMap = useMemo(
    () => new Map(members.map((member) => [member.id, member.name])),
    [members]
  );

  const fetchRecords = useCallback(
    async (filters?: FilterState) => {
      if (!members.length) {
        setRecords([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const memberIds = members.map((member) => member.id);
        let query = supabase
          .from('patient_records')
          .select('*')
          .in('member_id', memberIds)
          .order('upload_date', { ascending: false });

        if (filters?.member_id) {
          query = query.eq('member_id', filters.member_id);
        }

        if (filters?.record_type) {
          query = query.eq('record_type', filters.record_type);
        }

        if (filters?.search) {
          query = query.ilike('file_name', `%${filters.search}%`);
        }

        if (filters?.date_from) {
          query = query.gte('upload_date', filters.date_from);
        }

        if (filters?.date_to) {
          query = query.lte('upload_date', filters.date_to);
        }

        const { data, error } = await query;
        if (error) {
          throw error;
        }

        setRecords(
          (data ?? []).map((record) => ({
            ...record,
            member_name: memberNameMap.get(record.member_id) ?? 'Unknown patient',
          }))
        );
        setError(null);
      } catch (err) {
        logError(err, 'usePatientRecords.fetchRecords');
        setError(handleSupabaseError(err as { message: string; code?: string }));
      } finally {
        setLoading(false);
      }
    },
    [memberNameMap, members]
  );

  useEffect(() => {
    void fetchRecords();
  }, [fetchRecords]);

  const uploadRecord = useCallback(
    async (file: File, memberId: string, recordType: string, notes?: string) => {
      if (!user) {
        return { error: 'You need to sign in first.' };
      }

      setUploading(true);

      try {
        const path = generateUniqueFileName(user.id, memberId, file.name);
        const { path: storedPath, error: uploadError } = await uploadFile(
          STORAGE_BUCKETS.PATIENT_RECORDS,
          file,
          path
        );

        if (uploadError) {
          return { error: uploadError };
        }

        const { data, error } = await supabase
          .from('patient_records')
          .insert({
            member_id: memberId,
            file_url: storedPath,
            file_name: file.name,
            file_type: file.type,
            record_type: recordType,
            notes: notes || null,
            uploaded_by: user.id,
          })
          .select('*')
          .single();

        if (error) {
          return { error: handleSupabaseError(error) };
        }

        await createAuditLog({
          actor_id: user.id,
          target_group_id: familyGroup?.id ?? null,
          member_id: memberId,
          action: 'record_uploaded',
          entity_type: 'patient_record',
          entity_id: data.id,
          metadata: { file_name: file.name, record_type: recordType },
        });

        await fetchRecords();
        return { error: null };
      } catch (err) {
        logError(err, 'usePatientRecords.uploadRecord');
        return { error: 'Failed to upload record.' };
      } finally {
        setUploading(false);
      }
    },
    [familyGroup?.id, fetchRecords, user]
  );

  const removeRecord = useCallback(
    async (record: PatientRecord) => {
      try {
        await deleteFile(STORAGE_BUCKETS.PATIENT_RECORDS, record.file_url);
        const { error } = await supabase.from('patient_records').delete().eq('id', record.id);
        if (error) {
          return { error: handleSupabaseError(error) };
        }

        setRecords((prev) => prev.filter((item) => item.id !== record.id));
        await createAuditLog({
          actor_id: user?.id ?? null,
          target_group_id: familyGroup?.id ?? null,
          member_id: record.member_id,
          action: 'record_deleted',
          entity_type: 'patient_record',
          entity_id: record.id,
          metadata: { file_name: record.file_name },
        });
        return { error: null };
      } catch (err) {
        logError(err, 'usePatientRecords.removeRecord');
        return { error: 'Failed to delete record.' };
      }
    },
    [familyGroup?.id, user?.id]
  );

  const downloadRecord = useCallback(
    async (record: PatientRecord) => {
      const signedUrl = await getSignedUrl(STORAGE_BUCKETS.PATIENT_RECORDS, record.file_url);

      if (signedUrl) {
        await createAuditLog({
          actor_id: user?.id ?? null,
          target_group_id: familyGroup?.id ?? null,
          member_id: record.member_id,
          action: 'record_viewed',
          entity_type: 'patient_record',
          entity_id: record.id,
          metadata: { file_name: record.file_name },
        });
      }

      return signedUrl;
    },
    [familyGroup?.id, user?.id]
  );

  return {
    records,
    members,
    loading: workspaceLoading || loading,
    uploading,
    error,
    fetchRecords,
    uploadRecord,
    removeRecord,
    downloadRecord,
    refetchWorkspace: refreshWorkspace,
  };
}
