import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useCareWorkspace } from '@/hooks/useCareWorkspace';
import { createAuditLog } from '@/lib/appActions';
import { STORAGE_BUCKETS } from '@/lib/constants';
import type { MedicineEntry, Prescription } from '@/lib/types';
import { handleSupabaseError, logError } from '@/utils/errorHandler';
import { deleteFile, generateUniqueFileName, getSignedUrl, uploadFile } from '@/utils/storageHelpers';

export function usePrescriptions() {
  const { user, familyGroup } = useAuth();
  const { members, loading: workspaceLoading } = useCareWorkspace('prescriptions');
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const memberNameMap = useMemo(
    () => new Map(members.map((member) => [member.id, member.name])),
    [members]
  );

  const fetchPrescriptions = useCallback(
    async (memberId?: string) => {
      if (!members.length) {
        setPrescriptions([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const memberIds = memberId ? [memberId] : members.map((member) => member.id);
        const { data, error } = await supabase
          .from('prescriptions')
          .select('*')
          .in('member_id', memberIds)
          .order('prescription_date', { ascending: false });

        if (error) {
          throw error;
        }

        setPrescriptions(
          (data ?? []).map((prescription) => ({
            ...prescription,
            member_name: memberNameMap.get(prescription.member_id) ?? 'Unknown patient',
          }))
        );
        setError(null);
      } catch (err) {
        logError(err, 'usePrescriptions.fetchPrescriptions');
        setError(handleSupabaseError(err as { message: string; code?: string }));
      } finally {
        setLoading(false);
      }
    },
    [memberNameMap, members]
  );

  useEffect(() => {
    void fetchPrescriptions();
  }, [fetchPrescriptions]);

  const uploadPrescription = useCallback(
    async (
      file: File,
      memberId: string,
      doctorName: string | undefined,
      prescriptionDate: string,
      medicines: MedicineEntry[]
    ) => {
      if (!user) {
        return { error: 'You need to sign in first.' };
      }

      setUploading(true);

      try {
        const path = generateUniqueFileName(user.id, memberId, file.name);
        const { path: storedPath, error: uploadError } = await uploadFile(
          STORAGE_BUCKETS.PRESCRIPTIONS,
          file,
          path
        );

        if (uploadError) {
          return { error: uploadError };
        }

        const { data, error } = await supabase
          .from('prescriptions')
          .insert({
            member_id: memberId,
            file_url: storedPath,
            doctor_name: doctorName || null,
            prescription_date: prescriptionDate,
            medicines,
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
          action: 'prescription_uploaded',
          entity_type: 'prescription',
          entity_id: data.id,
          metadata: { medicine_count: medicines.length, doctor_name: doctorName ?? null },
        });

        await fetchPrescriptions();
        return { error: null };
      } catch (err) {
        logError(err, 'usePrescriptions.uploadPrescription');
        return { error: 'Failed to save prescription.' };
      } finally {
        setUploading(false);
      }
    },
    [familyGroup?.id, fetchPrescriptions, user]
  );

  const removePrescription = useCallback(
    async (prescriptionId: string, fileUrl: string | null) => {
      try {
        if (fileUrl) {
          await deleteFile(STORAGE_BUCKETS.PRESCRIPTIONS, fileUrl);
        }

        const { error } = await supabase.from('prescriptions').delete().eq('id', prescriptionId);
        if (error) {
          return { error: handleSupabaseError(error) };
        }

        setPrescriptions((prev) => prev.filter((item) => item.id !== prescriptionId));
        await createAuditLog({
          actor_id: user?.id ?? null,
          target_group_id: familyGroup?.id ?? null,
          action: 'prescription_deleted',
          entity_type: 'prescription',
          entity_id: prescriptionId,
        });
        return { error: null };
      } catch (err) {
        logError(err, 'usePrescriptions.removePrescription');
        return { error: 'Failed to delete prescription.' };
      }
    },
    [familyGroup?.id, user?.id]
  );

  const previewPrescription = useCallback(
    async (prescription: Prescription) => {
      if (!prescription.file_url) {
        return null;
      }

      const signedUrl = await getSignedUrl(STORAGE_BUCKETS.PRESCRIPTIONS, prescription.file_url);
      if (signedUrl) {
        await createAuditLog({
          actor_id: user?.id ?? null,
          target_group_id: familyGroup?.id ?? null,
          member_id: prescription.member_id,
          action: 'prescription_viewed',
          entity_type: 'prescription',
          entity_id: prescription.id,
        });
      }

      return signedUrl;
    },
    [familyGroup?.id, user?.id]
  );

  return {
    prescriptions,
    members,
    loading: workspaceLoading || loading,
    uploading,
    error,
    fetchPrescriptions,
    uploadPrescription,
    removePrescription,
    previewPrescription,
  };
}
