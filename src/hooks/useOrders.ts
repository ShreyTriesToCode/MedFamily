import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useCareWorkspace } from '@/hooks/useCareWorkspace';
import { createAuditLog, createNotification } from '@/lib/appActions';
import { STORAGE_BUCKETS } from '@/lib/constants';
import type {
  MedicineOrder,
  MedicineOrderFormInputs,
  MedicineOrderItem,
  OrderFilters,
  OrderStatus,
  OrderStatusHistory,
} from '@/lib/types';
import { handleSupabaseError, logError } from '@/utils/errorHandler';
import { uploadFile } from '@/utils/storageHelpers';

interface OrdersState {
  orders: MedicineOrder[];
  itemsByOrderId: Record<string, MedicineOrderItem[]>;
  historyByOrderId: Record<string, OrderStatusHistory[]>;
  loading: boolean;
  placing: boolean;
  error: string | null;
}

export function useOrders() {
  const { user, role, profile } = useAuth();
  const { accessibleFamilies } = useCareWorkspace('medicine_ordering');
  const latestFiltersRef = useRef<OrderFilters | undefined>(undefined);
  const [state, setState] = useState<OrdersState>({
    orders: [],
    itemsByOrderId: {},
    historyByOrderId: {},
    loading: true,
    placing: false,
    error: null,
  });

  const fetchOrders = useCallback(
    async (filters?: OrderFilters) => {
      latestFiltersRef.current = filters;

      if (!user) {
        setState((prev) => ({ ...prev, orders: [], loading: false, error: null }));
        return;
      }

      setState((prev) => ({ ...prev, loading: true }));

      try {
        const { data, error } = await supabase
          .from('medicine_orders')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          throw error;
        }

        let orders = (data ?? []) as MedicineOrder[];
        const accessibleGroupIds = new Set(accessibleFamilies.map((family) => family.group.id));

        if (role === 'chemist') {
          orders = orders.filter(
            (order) =>
              order.chemist_id === user.id ||
              (!order.chemist_id && (order.status === 'placed' || order.status === 'awaiting_chemist_approval'))
          );
          orders = orders.sort((a, b) => {
            const score = (order: MedicineOrder) =>
              !order.chemist_id && (order.status === 'placed' || order.status === 'awaiting_chemist_approval') ? 0 : 1;
            return score(a) - score(b);
          });
        } else if (role === 'patient_admin' || role === 'family_member' || role === 'caretaker') {
          orders = orders.filter(
            (order) => accessibleGroupIds.has(order.family_group_id) || order.placed_by_user_id === user.id
          );
        } else {
          orders = orders.filter((order) => order.placed_by_user_id === user.id);
        }

        if (filters?.status && filters.status !== 'all') {
          orders = orders.filter((order) => order.status === filters.status);
        }

        if (filters?.family_group_id) {
          orders = orders.filter((order) => order.family_group_id === filters.family_group_id);
        }

        if (filters?.search) {
          const query = filters.search.trim().toLowerCase();
          orders = orders.filter(
            (order) =>
              order.order_number.toLowerCase().includes(query) ||
              order.receiver_name.toLowerCase().includes(query) ||
              order.placed_for_name.toLowerCase().includes(query)
          );
        }

        const orderIds = orders.map((order) => order.id);
        const [itemsRes, historyRes] = await Promise.all([
          orderIds.length
            ? supabase.from('medicine_order_items').select('*').in('order_id', orderIds)
            : Promise.resolve({ data: [], error: null }),
          orderIds.length
            ? supabase
                .from('order_status_history')
                .select('*')
                .in('order_id', orderIds)
                .order('created_at', { ascending: true })
            : Promise.resolve({ data: [], error: null }),
        ]);

        if (itemsRes.error) {
          throw itemsRes.error;
        }

        if (historyRes.error) {
          throw historyRes.error;
        }

        const itemsByOrderId: Record<string, MedicineOrderItem[]> = {};
        for (const item of (itemsRes.data ?? []) as MedicineOrderItem[]) {
          itemsByOrderId[item.order_id] = [...(itemsByOrderId[item.order_id] ?? []), item];
        }

        const historyByOrderId: Record<string, OrderStatusHistory[]> = {};
        for (const history of (historyRes.data ?? []) as OrderStatusHistory[]) {
          historyByOrderId[history.order_id] = [...(historyByOrderId[history.order_id] ?? []), history];
        }

        setState((prev) => ({
          ...prev,
          orders,
          itemsByOrderId,
          historyByOrderId,
          loading: false,
          error: null,
        }));
      } catch (err) {
        logError(err, 'useOrders.fetchOrders');
        setState((prev) => ({
          ...prev,
          orders: [],
          itemsByOrderId: {},
          historyByOrderId: {},
          loading: false,
          error: handleSupabaseError(err as { message: string; code?: string }),
        }));
      }
    },
    [accessibleFamilies, role, user]
  );

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const channel = supabase
      .channel(`orders-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'medicine_orders' }, () => {
        void fetchOrders(latestFiltersRef.current);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'medicine_order_items' }, () => {
        void fetchOrders(latestFiltersRef.current);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_status_history' }, () => {
        void fetchOrders(latestFiltersRef.current);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchOrders, user]);

  const placeOrder = useCallback(
    async (input: MedicineOrderFormInputs) => {
      if (!user) {
        return { error: 'You need to sign in first.' };
      }

      setState((prev) => ({ ...prev, placing: true }));

      try {
        let uploadedPrescriptionPath: string | null = null;

        if (input.uploaded_prescription) {
          const uploadPath = `${user.id}/order-prescriptions/${Date.now()}_${input.uploaded_prescription.name.replace(/\s+/g, '_')}`;
          const uploadResult = await uploadFile(
            STORAGE_BUCKETS.ORDER_PRESCRIPTIONS,
            input.uploaded_prescription,
            uploadPath
          );

          if (uploadResult.error) {
            return { error: uploadResult.error };
          }

          uploadedPrescriptionPath = uploadResult.path;
        }

        const { data: order, error: orderError } = await supabase
          .from('medicine_orders')
          .insert({
            family_group_id: input.family_group_id,
            patient_member_id: input.patient_member_id || null,
            placed_by_user_id: user.id,
            placed_by_name: profile?.full_name ?? user.email ?? user.phone ?? 'MedFamily user',
            placed_for_name: input.placed_for_name,
            placed_for_phone: input.placed_for_phone || null,
            receiver_name: input.receiver_name,
            receiver_phone: input.receiver_phone || null,
            delivery_address: input.delivery_address,
            location_text: input.location_text || null,
            map_link: input.map_link || null,
            notes: input.notes || null,
            source_prescription_id: input.source_prescription_id || null,
            uploaded_prescription_url: uploadedPrescriptionPath,
            status: 'awaiting_chemist_approval',
            total_items: input.items.length,
          })
          .select('*')
          .single();

        if (orderError) {
          return { error: handleSupabaseError(orderError) };
        }

        const itemsPayload = input.items.map((item) => ({
          order_id: order.id,
          medicine_name: item.medicine_name,
          dosage: item.dosage ?? null,
          quantity: item.quantity ?? null,
          instructions: item.instructions ?? null,
          source: item.source ?? 'manual',
          is_substitute: item.is_substitute ?? false,
          substitute_for: item.substitute_for ?? null,
        }));

        if (itemsPayload.length) {
          const { error: itemsError } = await supabase.from('medicine_order_items').insert(itemsPayload);
          if (itemsError) {
            return { error: handleSupabaseError(itemsError) };
          }
        }

        await createAuditLog({
          actor_id: user.id,
          target_group_id: input.family_group_id,
          member_id: input.patient_member_id ?? null,
          action: 'order_placed',
          entity_type: 'medicine_order',
          entity_id: order.id,
          metadata: { total_items: input.items.length },
        });

        await fetchOrders();
        return { error: null, order: order as MedicineOrder };
      } catch (err) {
        logError(err, 'useOrders.placeOrder');
        return { error: 'Failed to place order.' };
      } finally {
        setState((prev) => ({ ...prev, placing: false }));
      }
    },
    [fetchOrders, profile?.full_name, user]
  );

  const updateOrderStatus = useCallback(
    async (orderId: string, status: OrderStatus, note?: string) => {
      if (!user) {
        return { error: 'You need to sign in first.' };
      }

      try {
        const existingOrder = state.orders.find((order) => order.id === orderId);
        if (!existingOrder) {
          return { error: 'Order not found.' };
        }

        const nextPayload: Partial<MedicineOrder> & { status: OrderStatus; chemist_name?: string | null } = {
          status,
        };

        if (role === 'chemist') {
          nextPayload.chemist_id = existingOrder.chemist_id ?? user.id;
          nextPayload.chemist_name = existingOrder.chemist_name ?? profile?.full_name ?? 'Assigned chemist';
        }

        const { error } = await supabase.from('medicine_orders').update(nextPayload).eq('id', orderId);
        if (error) {
          return { error: handleSupabaseError(error) };
        }

        if (note) {
          await supabase.from('order_status_history').insert({
            order_id: orderId,
            status,
            note,
            changed_by: user.id,
          });
        }

        await createNotification({
          user_id: existingOrder.placed_by_user_id,
          title: 'Order status updated',
          body: `Order ${existingOrder.order_number} is now ${status.replaceAll('_', ' ')}.`,
          category: 'order_update',
          entity_type: 'medicine_order',
          entity_id: orderId,
        });

        await createAuditLog({
          actor_id: user.id,
          target_group_id: existingOrder.family_group_id,
          member_id: existingOrder.patient_member_id,
          action: 'order_status_updated',
          entity_type: 'medicine_order',
          entity_id: orderId,
          metadata: { status, note: note ?? null },
        });

        await fetchOrders();
        return { error: null };
      } catch (err) {
        logError(err, 'useOrders.updateOrderStatus');
        return { error: 'Failed to update order status.' };
      }
    },
    [fetchOrders, profile?.full_name, role, state.orders, user]
  );

  const activeOrders = useMemo(
    () => state.orders.filter((order) => !['delivered', 'cancelled', 'rejected'].includes(order.status)),
    [state.orders]
  );

  const pastOrders = useMemo(
    () => state.orders.filter((order) => ['delivered', 'cancelled', 'rejected'].includes(order.status)),
    [state.orders]
  );

  return {
    ...state,
    activeOrders,
    pastOrders,
    fetchOrders,
    placeOrder,
    updateOrderStatus,
  };
}
