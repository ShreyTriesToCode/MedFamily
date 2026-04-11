import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { FamilyGroup, FamilyMember, FamilyMemberFormInputs } from '@/lib/types';
import { handleSupabaseError, logError } from '@/utils/errorHandler';

interface FamilyMemberStats {
  recordCount: number;
  activeReminderCount: number;
  prescriptionCount: number;
}

export function useFamilyMembers() {
  const { user, familyGroup } = useAuth();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [memberStats, setMemberStats] = useState<Record<string, FamilyMemberStats>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    if (!familyGroup?.id) {
      setMembers([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const { data, error: membersError } = await supabase
        .from('family_members')
        .select('*')
        .eq('group_id', familyGroup.id)
        .order('created_at', { ascending: true });

      if (membersError) {
        throw membersError;
      }

      const nextMembers = (data ?? []) as FamilyMember[];
      setMembers(nextMembers);

      if (!nextMembers.length) {
        setMemberStats({});
        setLoading(false);
        return;
      }

      const memberIds = nextMembers.map((member) => member.id);
      const [recordsRes, prescriptionsRes, remindersRes] = await Promise.all([
        supabase.from('patient_records').select('id, member_id').in('member_id', memberIds),
        supabase.from('prescriptions').select('id, member_id').in('member_id', memberIds),
        supabase
          .from('medicine_reminders')
          .select('id, member_id')
          .in('member_id', memberIds)
          .eq('is_active', true),
      ]);

      const statsSeed: Record<string, FamilyMemberStats> = {};
      for (const memberId of memberIds) {
        statsSeed[memberId] = { recordCount: 0, activeReminderCount: 0, prescriptionCount: 0 };
      }

      for (const row of recordsRes.data ?? []) {
        statsSeed[row.member_id].recordCount += 1;
      }

      for (const row of prescriptionsRes.data ?? []) {
        statsSeed[row.member_id].prescriptionCount += 1;
      }

      for (const row of remindersRes.data ?? []) {
        statsSeed[row.member_id].activeReminderCount += 1;
      }

      setMemberStats(statsSeed);
      setError(null);
    } catch (err) {
      logError(err, 'useFamilyMembers.fetchMembers');
      setError(handleSupabaseError(err as { message: string; code?: string }));
    } finally {
      setLoading(false);
    }
  }, [familyGroup?.id]);

  useEffect(() => {
    void fetchMembers();
  }, [fetchMembers]);

  const addMember = useCallback(
    async (input: FamilyMemberFormInputs) => {
      if (!familyGroup?.id) {
        return { error: 'No family group found.' };
      }

      try {
        const { error } = await supabase.from('family_members').insert({
          group_id: familyGroup.id,
          name: input.name,
          relation: input.relation,
          date_of_birth: input.date_of_birth || null,
          phone: input.phone || null,
          blood_group: input.blood_group || null,
          allergies: input.allergies ?? [],
          chronic_conditions: input.chronic_conditions ?? [],
          emergency_contact_name: input.emergency_contact_name || null,
          emergency_contact_phone: input.emergency_contact_phone || null,
          notes: input.notes || null,
        });

        if (error) {
          return { error: handleSupabaseError(error) };
        }

        await fetchMembers();
        return { error: null };
      } catch (err) {
        logError(err, 'useFamilyMembers.addMember');
        return { error: 'Failed to add family member.' };
      }
    },
    [familyGroup?.id, fetchMembers]
  );

  const updateMember = useCallback(
    async (memberId: string, input: FamilyMemberFormInputs) => {
      try {
        const { error } = await supabase
          .from('family_members')
          .update({
            name: input.name,
            relation: input.relation,
            date_of_birth: input.date_of_birth || null,
            phone: input.phone || null,
            blood_group: input.blood_group || null,
            allergies: input.allergies ?? [],
            chronic_conditions: input.chronic_conditions ?? [],
            emergency_contact_name: input.emergency_contact_name || null,
            emergency_contact_phone: input.emergency_contact_phone || null,
            notes: input.notes || null,
          })
          .eq('id', memberId);

        if (error) {
          return { error: handleSupabaseError(error) };
        }

        await fetchMembers();
        return { error: null };
      } catch (err) {
        logError(err, 'useFamilyMembers.updateMember');
        return { error: 'Failed to update family member.' };
      }
    },
    [fetchMembers]
  );

  const deleteMember = useCallback(
    async (memberId: string) => {
      try {
        const { error } = await supabase.from('family_members').delete().eq('id', memberId);
        if (error) {
          return { error: handleSupabaseError(error) };
        }

        setMembers((prev) => prev.filter((member) => member.id !== memberId));
        setMemberStats((prev) => {
          const next = { ...prev };
          delete next[memberId];
          return next;
        });
        return { error: null };
      } catch (err) {
        logError(err, 'useFamilyMembers.deleteMember');
        return { error: 'Failed to delete family member.' };
      }
    },
    []
  );

  const createFamilyGroup = useCallback(
    async (groupName: string) => {
      if (!user) {
        return { error: 'You need to sign in first.' };
      }

      try {
        const { error } = await supabase.from('family_groups').insert({
          admin_id: user.id,
          group_name: groupName,
        });

        if (error) {
          return { error: handleSupabaseError(error) };
        }

        await fetchMembers();
        return { error: null };
      } catch (err) {
        logError(err, 'useFamilyMembers.createFamilyGroup');
        return { error: 'Failed to create family group.' };
      }
    },
    [fetchMembers, user]
  );

  return {
    members,
    familyGroup: familyGroup as FamilyGroup | null,
    memberStats,
    loading,
    error,
    addMember,
    updateMember,
    deleteMember,
    createFamilyGroup,
    refetch: fetchMembers,
  };
}
