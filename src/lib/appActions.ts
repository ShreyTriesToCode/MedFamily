import { supabase } from '@/lib/supabase';
import type { NotificationCategory } from '@/lib/types';

interface AuditLogInput {
  actor_id?: string | null;
  target_group_id?: string | null;
  member_id?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  metadata?: Record<string, unknown> | null;
}

interface NotificationInput {
  user_id: string;
  title: string;
  body: string;
  category: NotificationCategory;
  entity_type?: string | null;
  entity_id?: string | null;
}

export async function createAuditLog(input: AuditLogInput): Promise<void> {
  await supabase.from('access_audit_logs').insert({
    actor_id: input.actor_id ?? null,
    target_group_id: input.target_group_id ?? null,
    member_id: input.member_id ?? null,
    action: input.action,
    entity_type: input.entity_type,
    entity_id: input.entity_id ?? null,
    metadata: input.metadata ?? null,
  });
}

export async function createNotification(input: NotificationInput): Promise<void> {
  await supabase.from('notifications').insert({
    user_id: input.user_id,
    title: input.title,
    body: input.body,
    category: input.category,
    entity_type: input.entity_type ?? null,
    entity_id: input.entity_id ?? null,
  });
}
