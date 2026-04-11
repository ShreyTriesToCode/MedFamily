import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useCareWorkspace } from '@/hooks/useCareWorkspace';
import { createAuditLog } from '@/lib/appActions';
import type {
  ManualReminderFormInputs,
  MedicineReminder,
  ReminderLog,
  ReminderStatus,
} from '@/lib/types';
import { handleSupabaseError, logError } from '@/utils/errorHandler';

export interface EnrichedReminder extends MedicineReminder {
  todayLogs: ReminderLog[];
}

export function useReminders() {
  const { user, familyGroup } = useAuth();
  const { members, loading: workspaceLoading } = useCareWorkspace();
  const [reminders, setReminders] = useState<EnrichedReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const memberNameMap = useMemo(
    () => new Map(members.map((member) => [member.id, member.name])),
    [members]
  );

  const fetchReminders = useCallback(async () => {
    if (!members.length) {
      setReminders([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const memberIds = members.map((member) => member.id);
      const { data, error } = await supabase
        .from('medicine_reminders')
        .select('*')
        .in('member_id', memberIds)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const reminderIds = (data ?? []).map((reminder) => reminder.id);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      const logsResponse =
        reminderIds.length > 0
          ? await supabase
              .from('reminder_logs')
              .select('*')
              .in('reminder_id', reminderIds)
              .gte('scheduled_time', today.toISOString())
              .lt('scheduled_time', tomorrow.toISOString())
          : { data: [], error: null };

      if (logsResponse.error) {
        throw logsResponse.error;
      }

      const todayLogs = logsResponse.data ?? [];

      setReminders(
        ((data ?? []) as MedicineReminder[]).map((reminder) => ({
          ...reminder,
          member_name: memberNameMap.get(reminder.member_id) ?? 'Unknown patient',
          todayLogs: todayLogs.filter((log) => log.reminder_id === reminder.id),
        }))
      );
      setError(null);
    } catch (err) {
      logError(err, 'useReminders.fetchReminders');
      setError(handleSupabaseError(err as { message: string; code?: string }));
    } finally {
      setLoading(false);
    }
  }, [memberNameMap, members]);

  useEffect(() => {
    void fetchReminders();
  }, [fetchReminders]);

  const upsertReminderLog = useCallback(
    async (reminderId: string, scheduledTime: string, status: ReminderStatus, notes?: string) => {
      try {
        const { error } = await supabase.from('reminder_logs').upsert(
          {
            reminder_id: reminderId,
            scheduled_time: scheduledTime,
            taken_at: status === 'taken' ? new Date().toISOString() : null,
            status,
            notes: notes ?? null,
          },
          { onConflict: 'reminder_id,scheduled_time' }
        );

        if (error) {
          return { error: handleSupabaseError(error) };
        }

        await fetchReminders();
        return { error: null };
      } catch (err) {
        logError(err, 'useReminders.upsertReminderLog');
        return { error: 'Failed to update reminder.' };
      }
    },
    [fetchReminders]
  );

  const markReminderTaken = useCallback(
    async (reminderId: string, scheduledTime: string) => {
      const result = await upsertReminderLog(reminderId, scheduledTime, 'taken');
      if (!result.error) {
        await createAuditLog({
          actor_id: user?.id ?? null,
          target_group_id: familyGroup?.id ?? null,
          action: 'reminder_taken',
          entity_type: 'reminder',
          entity_id: reminderId,
          metadata: { scheduled_time: scheduledTime },
        });
      }
      return result;
    },
    [familyGroup?.id, upsertReminderLog, user?.id]
  );

  const snoozeReminder = useCallback(
    async (reminderId: string, scheduledTime: string, minutes: number) => {
      return upsertReminderLog(reminderId, scheduledTime, 'snoozed', `Snoozed for ${minutes} minutes`);
    },
    [upsertReminderLog]
  );

  const skipReminder = useCallback(
    async (reminderId: string, scheduledTime: string) => {
      return upsertReminderLog(reminderId, scheduledTime, 'skipped');
    },
    [upsertReminderLog]
  );

  const createManualReminder = useCallback(
    async (input: ManualReminderFormInputs) => {
      try {
        const { error } = await supabase.from('medicine_reminders').insert({
          member_id: input.member_id,
          medicine_name: input.medicine_name,
          dosage: input.dosage,
          frequency: input.frequency,
          reminder_times: input.reminder_times,
          start_date: input.start_date,
          end_date: input.end_date,
          is_active: true,
        });

        if (error) {
          return { error: handleSupabaseError(error) };
        }

        await createAuditLog({
          actor_id: user?.id ?? null,
          target_group_id: familyGroup?.id ?? null,
          member_id: input.member_id,
          action: 'manual_reminder_created',
          entity_type: 'reminder',
          metadata: { medicine_name: input.medicine_name },
        });

        await fetchReminders();
        return { error: null };
      } catch (err) {
        logError(err, 'useReminders.createManualReminder');
        return { error: 'Failed to create reminder.' };
      }
    },
    [familyGroup?.id, fetchReminders, user?.id]
  );

  const deleteReminder = useCallback(
    async (reminderId: string) => {
      try {
        const { error } = await supabase
          .from('medicine_reminders')
          .update({ is_active: false })
          .eq('id', reminderId);

        if (error) {
          return { error: handleSupabaseError(error) };
        }

        setReminders((prev) => prev.filter((reminder) => reminder.id !== reminderId));
        return { error: null };
      } catch (err) {
        logError(err, 'useReminders.deleteReminder');
        return { error: 'Failed to archive reminder.' };
      }
    },
    []
  );

  return {
    reminders,
    members,
    loading: workspaceLoading || loading,
    error,
    fetchReminders,
    markReminderTaken,
    snoozeReminder,
    skipReminder,
    createManualReminder,
    deleteReminder,
  };
}
