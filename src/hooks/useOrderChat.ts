import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { createNotification } from '@/lib/appActions';
import type { OrderChatMessage } from '@/lib/types';
import { handleSupabaseError, logError } from '@/utils/errorHandler';

export function useOrderChat(orderId: string | null) {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<OrderChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!orderId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('order_chat_messages')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      setMessages((data ?? []) as OrderChatMessage[]);
      setError(null);
    } catch (err) {
      logError(err, 'useOrderChat.fetchMessages');
      setError(handleSupabaseError(err as { message: string; code?: string }));
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    if (!orderId) {
      return;
    }

    const channel = supabase
      .channel(`order-chat-${orderId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_chat_messages', filter: `order_id=eq.${orderId}` },
        () => {
          void fetchMessages();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchMessages, orderId]);

  const sendMessage = useCallback(
    async (message: string) => {
      if (!orderId || !user) {
        return { error: 'You need to sign in first.' };
      }

      setSending(true);

      try {
        const { data: order } = await supabase
          .from('medicine_orders')
          .select('id, placed_by_user_id, chemist_id, order_number')
          .eq('id', orderId)
          .maybeSingle();

        const { data, error } = await supabase
          .from('order_chat_messages')
          .insert({
            order_id: orderId,
            sender_id: user.id,
            sender_name: profile?.full_name ?? user.email ?? user.phone ?? 'MedFamily user',
            message,
          })
          .select('*')
          .single();

        if (error) {
          return { error: handleSupabaseError(error) };
        }

        const counterpartyId =
          order?.placed_by_user_id === user.id ? order.chemist_id : order?.placed_by_user_id;

        if (counterpartyId) {
          await createNotification({
            user_id: counterpartyId,
            title: 'New order message',
            body: `You have a new message on order ${order?.order_number ?? ''}.`,
            category: 'chat_message',
            entity_type: 'order_chat',
            entity_id: orderId,
          });
        }

        setMessages((prev) => [...prev, data as OrderChatMessage]);
        return { error: null };
      } catch (err) {
        logError(err, 'useOrderChat.sendMessage');
        return { error: 'Failed to send message.' };
      } finally {
        setSending(false);
      }
    },
    [orderId, profile?.full_name, user]
  );

  return {
    messages,
    loading,
    sending,
    error,
    fetchMessages,
    sendMessage,
  };
}
