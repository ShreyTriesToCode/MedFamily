import { Send } from 'lucide-react';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import type { OrderChatMessage } from '@/lib/types';

interface ChatPanelProps {
  messages: OrderChatMessage[];
  sending?: boolean;
  onSend: (message: string) => Promise<void> | void;
  currentUserId?: string | null;
}

export default function ChatPanel({
  messages,
  sending = false,
  onSend,
  currentUserId,
}: ChatPanelProps) {
  const [draft, setDraft] = useState('');

  return (
    <Card title="Order conversation" eyebrow="Live coordination" className="rounded-[28px]">
      <div className="space-y-4">
        <p className="text-xs text-text-secondary">
          Keep delivery clarifications, stock updates, and receiver notes attached to the order timeline.
        </p>
        <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
          {messages.length ? (
            messages.map((message) => {
              const mine = currentUserId === message.sender_id;

              return (
                <div
                  key={message.id}
                  className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-[22px] px-4 py-3 text-sm ${
                      mine
                        ? 'theme-brand-solid'
                        : 'bg-background-strong text-text-primary'
                    }`}
                  >
                    <p className={`text-[11px] font-semibold ${mine ? 'text-white/80' : 'text-text-secondary'}`}>
                      {message.sender_name ?? 'Participant'}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">{message.message}</p>
                    <p className={`mt-1 text-[11px] ${mine ? 'text-white/70' : 'text-text-tertiary'}`}>
                      {new Date(message.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="theme-surface-soft rounded-[24px] p-4 text-sm text-text-secondary">
              No messages yet. Use the order chat for delivery notes, stock clarifications, or address confirmations.
            </div>
          )}
        </div>

        <div className="flex items-end gap-2">
          <Input
            multiline
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Type a message for this order..."
          />
          <Button
            size="sm"
            loading={sending}
            icon={<Send className="h-4 w-4" />}
            onClick={async () => {
              const next = draft.trim();
              if (!next) {
                return;
              }
              await onSend(next);
              setDraft('');
            }}
          >
            Send
          </Button>
        </div>
      </div>
    </Card>
  );
}
