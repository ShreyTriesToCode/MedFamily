import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useCareWorkspace } from '@/hooks/useCareWorkspace';
import { createAuditLog, createNotification } from '@/lib/appActions';
import type {
  Appointment,
  AppointmentFormInputs,
  AppointmentStatus,
  FamilyMember,
} from '@/lib/types';
import { handleSupabaseError, logError } from '@/utils/errorHandler';

interface AppointmentState {
  appointments: Appointment[];
  loading: boolean;
  saving: boolean;
  error: string | null;
}

export function useAppointments() {
  const { user, familyGroup } = useAuth();
  const { members, accessibleFamilies } = useCareWorkspace('summary');
  const [state, setState] = useState<AppointmentState>({
    appointments: [],
    loading: true,
    saving: false,
    error: null,
  });

  const memberMap = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);

  const fetchAppointments = useCallback(async () => {
    if (!members.length) {
      setState((prev) => ({ ...prev, appointments: [], loading: false, error: null }));
      return;
    }

    setState((prev) => ({ ...prev, loading: true }));

    try {
      const memberIds = members.map((member) => member.id);
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .in('member_id', memberIds)
        .order('scheduled_for', { ascending: true });

      if (error) {
        throw error;
      }

      setState((prev) => ({
        ...prev,
        appointments: ((data ?? []) as Appointment[]).map((appointment) => ({
          ...appointment,
          member_name: memberMap.get(appointment.member_id)?.name ?? 'Patient',
        })),
        loading: false,
        error: null,
      }));
    } catch (err) {
      logError(err, 'useAppointments.fetchAppointments');
      setState((prev) => ({
        ...prev,
        appointments: [],
        loading: false,
        error: handleSupabaseError(err as { message: string; code?: string }),
      }));
    }
  }, [memberMap, members]);

  useEffect(() => {
    void fetchAppointments();
  }, [fetchAppointments]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const channel = supabase
      .channel(`appointments-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        void fetchAppointments();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchAppointments, user]);

  const createAppointment = useCallback(
    async (input: AppointmentFormInputs) => {
      if (!user) {
        return { error: 'You need to sign in first.' };
      }

      const member = memberMap.get(input.member_id);
      if (!member?.group_id) {
        return { error: 'Select a valid family member first.' };
      }

      setState((prev) => ({ ...prev, saving: true }));

      try {
        const { data, error } = await supabase
          .from('appointments')
          .insert({
            family_group_id: member.group_id,
            member_id: input.member_id,
            title: input.title,
            appointment_type: input.appointment_type,
            provider_name: input.provider_name || null,
            provider_contact: input.provider_contact || null,
            provider_role: input.provider_role || null,
            scheduled_for: input.scheduled_for,
            location: input.location || null,
            mode: input.mode || null,
            notes: input.notes || null,
            follow_up_date: input.follow_up_date || null,
            status: 'scheduled',
            booked_by: user.id,
            updated_by: user.id,
          })
          .select('*')
          .single();

        if (error) {
          return { error: handleSupabaseError(error) };
        }

        await createAuditLog({
          actor_id: user.id,
          target_group_id: member.group_id,
          member_id: input.member_id,
          action: 'appointment_created',
          entity_type: 'appointment',
          entity_id: data.id,
          metadata: {
            title: input.title,
            scheduled_for: input.scheduled_for,
            appointment_type: input.appointment_type,
          },
        });

        if (familyGroup?.admin_id) {
          await createNotification({
            user_id: familyGroup.admin_id,
            title: 'Appointment scheduled',
            body: `${member.name} has a ${input.appointment_type.replace('_', ' ')} scheduled.`,
            category: 'appointment',
            entity_type: 'appointment',
            entity_id: data.id,
          });
        }

        await fetchAppointments();
        return { error: null, appointment: data as Appointment };
      } catch (err) {
        logError(err, 'useAppointments.createAppointment');
        return { error: 'Failed to create appointment.' };
      } finally {
        setState((prev) => ({ ...prev, saving: false }));
      }
    },
    [familyGroup?.admin_id, fetchAppointments, memberMap, user]
  );

  const updateAppointmentStatus = useCallback(
    async (appointment: Appointment, status: AppointmentStatus, scheduledFor?: string) => {
      if (!user) {
        return { error: 'You need to sign in first.' };
      }

      try {
        const payload = {
          status,
          scheduled_for: scheduledFor ?? appointment.scheduled_for,
          updated_by: user.id,
        };

        const { error } = await supabase.from('appointments').update(payload).eq('id', appointment.id);
        if (error) {
          return { error: handleSupabaseError(error) };
        }

        await createAuditLog({
          actor_id: user.id,
          target_group_id: appointment.family_group_id,
          member_id: appointment.member_id,
          action: 'appointment_status_updated',
          entity_type: 'appointment',
          entity_id: appointment.id,
          metadata: { status, scheduled_for: payload.scheduled_for },
        });

        await fetchAppointments();
        return { error: null };
      } catch (err) {
        logError(err, 'useAppointments.updateAppointmentStatus');
        return { error: 'Failed to update appointment.' };
      }
    },
    [fetchAppointments, user]
  );

  const saveVisitSummary = useCallback(
    async (
      appointment: Appointment,
      input: Pick<Appointment, 'diagnosis' | 'visit_summary' | 'advice_summary' | 'follow_up_date'>
    ) => {
      if (!user) {
        return { error: 'You need to sign in first.' };
      }

      try {
        const nextStatus = appointment.status === 'scheduled' || appointment.status === 'confirmed' ? 'completed' : appointment.status;
        const { error } = await supabase
          .from('appointments')
          .update({
            diagnosis: input.diagnosis,
            visit_summary: input.visit_summary,
            advice_summary: input.advice_summary,
            follow_up_date: input.follow_up_date,
            status: nextStatus,
            updated_by: user.id,
          })
          .eq('id', appointment.id);

        if (error) {
          return { error: handleSupabaseError(error) };
        }

        await createAuditLog({
          actor_id: user.id,
          target_group_id: appointment.family_group_id,
          member_id: appointment.member_id,
          action: 'visit_summary_saved',
          entity_type: 'appointment',
          entity_id: appointment.id,
          metadata: {
            diagnosis: input.diagnosis,
            follow_up_date: input.follow_up_date,
          },
        });

        await fetchAppointments();
        return { error: null };
      } catch (err) {
        logError(err, 'useAppointments.saveVisitSummary');
        return { error: 'Failed to save visit summary.' };
      }
    },
    [fetchAppointments, user]
  );

  return {
    ...state,
    members: members as FamilyMember[],
    accessibleFamilies,
    fetchAppointments,
    createAppointment,
    updateAppointmentStatus,
    saveVisitSummary,
  };
}
