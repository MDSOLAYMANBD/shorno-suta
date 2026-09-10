import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Calls the inbox-automation-process edge function once per new message id.
 * Fire-and-forget; failures are logged to the console only.
 */
export function useAutomationTrigger(conversationId: string | null, messages: any[]) {
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!conversationId || !messages.length) return;
    const latest = messages[messages.length - 1];
    if (!latest?.id || seen.current.has(latest.id)) return;
    seen.current.add(latest.id);

    supabase.functions
      .invoke('inbox-automation-process', {
        body: { conversation_id: conversationId, message_id: latest.id },
      })
      .catch((err) => console.warn('[automation] trigger failed', err));

    // Also schedule follow-ups (10m / 1h / 6h) for visitor messages.
    // The schedule function cancels existing pending rows for the conv first, so it's safe.
    if (latest.sender_type === 'visitor' || latest.sender_type === 'customer') {
      supabase.functions
        .invoke('inbox-followup-schedule', {
          body: { conversation_id: conversationId, last_message_id: latest.id },
        })
        .catch((err) => console.warn('[followup] schedule failed', err));
    }
  }, [conversationId, messages]);

  // Reset memory when switching conversations (keeps the Set bounded)
  useEffect(() => {
    seen.current = new Set();
  }, [conversationId]);
}
