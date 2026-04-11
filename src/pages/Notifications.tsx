import { useMemo, useState } from 'react';
import { BellRing } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import PageHeader from '@/components/app/PageHeader';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Select from '@/components/ui/Select';
import { NOTIFICATION_CATEGORY_OPTIONS } from '@/lib/constants';
import { useNotificationsFeed } from '@/hooks/useNotificationsFeed';
import type { NotificationCategory } from '@/lib/types';
import { showErrorToast, showSuccessToast } from '@/utils/errorHandler';

export default function NotificationsPage() {
  const [category, setCategory] = useState<NotificationCategory | 'all'>('all');
  const { notifications, loading, markAsRead, markAllAsRead, fetchNotifications } = useNotificationsFeed();

  const filteredNotifications =
    category === 'all' ? notifications : notifications.filter((notification) => notification.category === category);
  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.is_read).length,
    [notifications]
  );
  const todayCount = useMemo(
    () =>
      notifications.filter((notification) => new Date(notification.created_at).toDateString() === new Date().toDateString()).length,
    [notifications]
  );
  const activeCategoryCount = useMemo(
    () => new Set(notifications.map((notification) => notification.category)).size,
    [notifications]
  );

  return (
    <Layout pageTitle="Notifications">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Notification center"
          title="Notifications"
          description="Stay on top of access approvals, reminder activity, order status changes, and order chat alerts."
          showBackButton
          stats={[
            { label: 'Unread', value: unreadCount, helper: 'Updates still waiting for your attention.', tone: 'brand' },
            { label: 'Today', value: todayCount, helper: 'Alerts generated in the current day.', tone: 'accent' },
            { label: 'Active categories', value: activeCategoryCount, helper: 'Distinct alert streams currently present.', tone: 'neutral' },
          ]}
          highlights={[
            'Access approvals, orders, reminders, and chat updates stay in one inbox',
            category === 'all' ? 'Viewing all notification categories' : `Filtered to ${category.replaceAll('_', ' ')}`,
          ]}
          actions={
            unreadCount ? (
              <Button
                variant="outline"
                onClick={async () => {
                  const result = await markAllAsRead();
                  if (result.error) {
                    showErrorToast(result.error);
                    return;
                  }
                  showSuccessToast('All notifications marked as read.');
                }}
              >
                Mark all as read
              </Button>
            ) : undefined
          }
        />

        <Card className="rounded-[30px]">
          <div className="grid gap-3 lg:grid-cols-[0.7fr_0.3fr]">
            <Select
              options={[{ label: 'All notifications', value: 'all' }, ...NOTIFICATION_CATEGORY_OPTIONS]}
              value={category}
              onChange={async (event) => {
                const next = (event.target.value || 'all') as NotificationCategory | 'all';
                setCategory(next);
                await fetchNotifications({ category: next });
              }}
            />
          </div>
        </Card>

        {loading ? (
          <LoadingSpinner />
        ) : filteredNotifications.length ? (
          <div className="space-y-3">
            {filteredNotifications.map((notification) => (
              <Card
                key={notification.id}
                className={notification.is_read ? 'rounded-[30px]' : 'rounded-[30px] border-primary-200/40'}
                hoverable
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="max-w-2xl">
                    <div className="flex items-center gap-2">
                      <div className="theme-icon-badge flex h-10 w-10 items-center justify-center rounded-2xl">
                        <BellRing className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-text-primary">{notification.title}</p>
                        <p className="text-xs text-text-secondary">
                          {notification.category.replaceAll('_', ' ')} · {new Date(notification.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <p className="mt-4 text-sm text-text-secondary">{notification.body}</p>
                  </div>
                  {!notification.is_read ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const result = await markAsRead(notification.id);
                        if (result.error) {
                          showErrorToast(result.error);
                          return;
                        }
                        showSuccessToast('Notification marked as read.');
                      }}
                    >
                      Mark as read
                    </Button>
                  ) : (
                    <span className="theme-status-success rounded-full px-3 py-2 text-xs font-semibold">
                      Read
                    </span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState title="No notifications yet" description="Your reminder alerts, access updates, and order milestones will appear here." />
        )}
      </div>
    </Layout>
  );
}
