import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useCareWorkspace } from '@/hooks/useCareWorkspace';
import { createAuditLog, createNotification } from '@/lib/appActions';
import type {
  CareTask,
  CareTaskFormInputs,
  FamilyMember,
  VitalEntry,
  VitalEntryFormInputs,
} from '@/lib/types';
import { handleSupabaseError, logError } from '@/utils/errorHandler';

interface HealthHubState {
  vitals: VitalEntry[];
  careTasks: CareTask[];
  loading: boolean;
  saving: boolean;
  error: string | null;
}

export function useHealthHub() {
  const { user, familyGroup, profile, role } = useAuth();
  const { members, accessibleFamilies } = useCareWorkspace('summary');
  const [state, setState] = useState<HealthHubState>({
    vitals: [],
    careTasks: [],
    loading: true,
    saving: false,
    error: null,
  });

  const memberMap = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);

  const fetchHealthData = useCallback(async () => {
    if (!members.length) {
      setState((prev) => ({
        ...prev,
        vitals: [],
        careTasks: [],
        loading: false,
        error: null,
      }));
      return;
    }

    setState((prev) => ({ ...prev, loading: true }));

    try {
      const memberIds = members.map((member) => member.id);
      const [vitalsRes, tasksRes] = await Promise.all([
        supabase.from('vital_entries').select('*').in('member_id', memberIds).order('recorded_at', { ascending: false }),
        supabase.from('care_tasks').select('*').in('member_id', memberIds).order('created_at', { ascending: false }),
      ]);

      if (vitalsRes.error) {
        throw vitalsRes.error;
      }

      if (tasksRes.error) {
        throw tasksRes.error;
      }

      setState((prev) => ({
        ...prev,
        vitals: ((vitalsRes.data ?? []) as VitalEntry[]).map((entry) => ({
          ...entry,
          member_name: memberMap.get(entry.member_id)?.name ?? 'Patient',
        })),
        careTasks: ((tasksRes.data ?? []) as CareTask[]).map((task) => ({
          ...task,
          member_name: memberMap.get(task.member_id)?.name ?? 'Patient',
        })),
        loading: false,
        error: null,
      }));
    } catch (err) {
      logError(err, 'useHealthHub.fetchHealthData');
      setState((prev) => ({
        ...prev,
        vitals: [],
        careTasks: [],
        loading: false,
        error: handleSupabaseError(err as { message: string; code?: string }),
      }));
    }
  }, [memberMap, members]);

  useEffect(() => {
    void fetchHealthData();
  }, [fetchHealthData]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const channel = supabase
      .channel(`health-hub-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vital_entries' }, () => {
        void fetchHealthData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'care_tasks' }, () => {
        void fetchHealthData();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchHealthData, user]);

  const addVitalEntry = useCallback(
    async (input: VitalEntryFormInputs) => {
      if (!user) {
        return { error: 'You need to sign in first.' };
      }

      const member = memberMap.get(input.member_id);
      if (!member?.group_id) {
        return { error: 'Choose a valid family member first.' };
      }

      setState((prev) => ({ ...prev, saving: true }));

      try {
        const { error } = await supabase.from('vital_entries').insert({
          family_group_id: member.group_id,
          member_id: input.member_id,
          metric_type: input.metric_type,
          value_primary: input.value_primary,
          value_secondary: input.value_secondary || null,
          unit: input.unit || null,
          symptoms: input.symptoms ?? [],
          notes: input.notes || null,
          recorded_at: input.recorded_at,
          recorded_by: user.id,
        });

        if (error) {
          return { error: handleSupabaseError(error) };
        }

        await createAuditLog({
          actor_id: user.id,
          target_group_id: member.group_id,
          member_id: member.id,
          action: 'vital_recorded',
          entity_type: 'vital_entry',
          metadata: {
            metric_type: input.metric_type,
            value_primary: input.value_primary,
            value_secondary: input.value_secondary ?? null,
          },
        });

        if (familyGroup?.admin_id && familyGroup.admin_id !== user.id && role === 'caretaker') {
          await createNotification({
            user_id: familyGroup.admin_id,
            title: 'New health reading added',
            body: `${profile?.full_name || 'Your caretaker'} logged a ${input.metric_type.replace('_', ' ')} update.`,
            category: 'health_alert',
            entity_type: 'vital_entry',
          });
        }

        await fetchHealthData();
        return { error: null };
      } catch (err) {
        logError(err, 'useHealthHub.addVitalEntry');
        return { error: 'Failed to save the health reading.' };
      } finally {
        setState((prev) => ({ ...prev, saving: false }));
      }
    },
    [familyGroup?.admin_id, fetchHealthData, memberMap, profile?.full_name, role, user]
  );

  const createCareTask = useCallback(
    async (input: CareTaskFormInputs) => {
      if (!user) {
        return { error: 'You need to sign in first.' };
      }

      const member = memberMap.get(input.member_id);
      if (!member?.group_id) {
        return { error: 'Choose a valid family member first.' };
      }

      setState((prev) => ({ ...prev, saving: true }));

      try {
        const { error } = await supabase.from('care_tasks').insert({
          family_group_id: member.group_id,
          member_id: input.member_id,
          title: input.title,
          description: input.description || null,
          due_at: input.due_at || null,
          assigned_to_user_id: input.assigned_to_user_id || null,
          created_by: user.id,
          status: 'pending',
        });

        if (error) {
          return { error: handleSupabaseError(error) };
        }

        await createAuditLog({
          actor_id: user.id,
          target_group_id: member.group_id,
          member_id: member.id,
          action: 'care_task_created',
          entity_type: 'care_task',
          metadata: { title: input.title, due_at: input.due_at ?? null },
        });

        if (input.assigned_to_user_id && input.assigned_to_user_id !== user.id) {
          await createNotification({
            user_id: input.assigned_to_user_id,
            title: 'New care task assigned',
            body: `${member.name} has a new care checklist item: ${input.title}.`,
            category: 'health_alert',
            entity_type: 'care_task',
          });
        }

        await fetchHealthData();
        return { error: null };
      } catch (err) {
        logError(err, 'useHealthHub.createCareTask');
        return { error: 'Failed to create the care task.' };
      } finally {
        setState((prev) => ({ ...prev, saving: false }));
      }
    },
    [fetchHealthData, memberMap, user]
  );

  const updateCareTaskStatus = useCallback(
    async (task: CareTask, status: CareTask['status']) => {
      if (!user) {
        return { error: 'You need to sign in first.' };
      }

      try {
        const { error } = await supabase
          .from('care_tasks')
          .update({
            status,
            completed_at: status === 'completed' ? new Date().toISOString() : null,
          })
          .eq('id', task.id);

        if (error) {
          return { error: handleSupabaseError(error) };
        }

        await createAuditLog({
          actor_id: user.id,
          target_group_id: task.family_group_id,
          member_id: task.member_id,
          action: status === 'completed' ? 'care_task_completed' : 'care_task_reopened',
          entity_type: 'care_task',
          entity_id: task.id,
          metadata: { title: task.title },
        });

        if (task.created_by && task.created_by !== user.id && status === 'completed') {
          await createNotification({
            user_id: task.created_by,
            title: 'Care task completed',
            body: `${task.member_name || 'Patient'} care checklist item "${task.title}" was completed.`,
            category: 'health_alert',
            entity_type: 'care_task',
            entity_id: task.id,
          });
        }

        await fetchHealthData();
        return { error: null };
      } catch (err) {
        logError(err, 'useHealthHub.updateCareTaskStatus');
        return { error: 'Failed to update the care task.' };
      }
    },
    [fetchHealthData, user]
  );

  return {
    ...state,
    members: members as FamilyMember[],
    accessibleFamilies,
    fetchHealthData,
    addVitalEntry,
    createCareTask,
    updateCareTaskStatus,
  };
}
