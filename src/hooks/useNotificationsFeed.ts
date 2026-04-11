import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import type { AppNotification, NotificationFilters } from '@/lib/types';
import { handleSupabaseError, logError } from '@/utils/errorHandler';

export function useNotificationsFeed() {
  const { user } = useAuth();
  const { refreshUnreadCount } = useNotifications();
  const latestFiltersRef = useRef<NotificationFilters | undefined>(undefined);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(
    async (filters?: NotificationFilters) => {
      latestFiltersRef.current = filters;

      if (!user) {
        setNotifications([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        let query = supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (filters?.category && filters.category !== 'all') {
          query = query.eq('category', filters.category);
        }

        if (filters?.unreadOnly) {
          query = query.eq('is_read', false);
        }

        const { data, error } = await query;
        if (error) {
          throw error;
        }

        setNotifications((data ?? []) as AppNotification[]);
        setError(null);
        await refreshUnreadCount();
      } catch (err) {
        logError(err, 'useNotificationsFeed.fetchNotifications');
        setError(handleSupabaseError(err as { message: string; code?: string }));
      } finally {
        setLoading(false);
      }
    },
    [refreshUnreadCount, user]
  );

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const channel = supabase
      .channel(`notifications-feed-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        void fetchNotifications(latestFiltersRef.current);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchNotifications, user]);

  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!user) {
        return { error: 'You need to sign in first.' };
      }

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', user.id);
      if (error) {
        return { error: handleSupabaseError(error) };
      }

      setNotifications((prev) =>
        prev.map((notification) =>
          notification.id === notificationId ? { ...notification, is_read: true } : notification
        )
      );
      await refreshUnreadCount();
      return { error: null };
    },
    [refreshUnreadCount, user]
  );

  const markAllAsRead = useCallback(async () => {
    if (!user) {
      return { error: 'You need to sign in first.' };
    }

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('is_read', false)
      .eq('user_id', user.id);
    if (error) {
      return { error: handleSupabaseError(error) };
    }

    setNotifications((prev) => prev.map((notification) => ({ ...notification, is_read: true })));
    await refreshUnreadCount();
    return { error: null };
  }, [refreshUnreadCount, user]);

  return {
    notifications,
    loading,
    error,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  };
}
