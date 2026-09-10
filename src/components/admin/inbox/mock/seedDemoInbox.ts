import { supabase } from '@/integrations/supabase/client';

/**
 * If the inbox is completely empty, seed 3 demo conversations + a few
 * customer-side demo messages so the UI is never blank.
 *
 * - Idempotent: skips if any conversation tagged `demo` already exists.
 * - Never throws — failure is silent so it can't break the page.
 * - Writes into the real `inbox_conversations` / `inbox_messages` tables;
 *   demo rows are tagged `demo` and `metadata.demo = true` so they can
 *   be identified and removed later.
 */
export async function ensureDemoConversations(): Promise<void> {
  try {
    // Already has demo rows? bail.
    const { data: existingDemo } = await supabase
      .from('inbox_conversations' as any)
      .select('id')
      .contains('tags', ['demo'])
      .limit(1);
    if (existingDemo && existingDemo.length > 0) return;

    // Already has any real conversations? don't pollute — only seed when empty.
    const { count } = await supabase
      .from('inbox_conversations' as any)
      .select('id', { count: 'exact', head: true });
    if ((count ?? 0) > 0) return;

    const demos = [
      {
        customer_name: 'Demo • Rina (Website)',
        customer_phone: '01700000001',
        platform: 'website',
        messages: ['price koto?', '850 taka nibo', 'delivery koto din?'],
      },
      {
        customer_name: 'Demo • Hasan (Messenger)',
        customer_phone: '01700000002',
        platform: 'messenger',
        messages: ['ready ache?', 'kobe pabo?'],
      },
      {
        customer_name: 'Demo • Mim (WhatsApp)',
        customer_phone: '01700000003',
        platform: 'whatsapp',
        messages: ['order korte chai', 'cash on delivery ache?'],
      },
    ];

    for (const d of demos) {
      const { data: conv, error: convErr } = await supabase
        .from('inbox_conversations' as any)
        .insert({
          customer_name: d.customer_name,
          customer_phone: d.customer_phone,
          platform: d.platform,
          tags: ['demo'],
          metadata: { demo: true },
          last_message: d.messages[d.messages.length - 1],
          last_message_at: new Date().toISOString(),
        } as any)
        .select('id')
        .maybeSingle();

      if (convErr || !conv) continue;
      const convId = (conv as any).id as string;

      const rows = d.messages.map((m, i) => ({
        conversation_id: convId,
        sender_type: 'customer',
        sender_name: d.customer_name,
        message: m,
        metadata: { demo: true },
        // stagger created_at so order is preserved
        created_at: new Date(Date.now() - (d.messages.length - i) * 60_000).toISOString(),
      }));

      await supabase.from('inbox_messages' as any).insert(rows as any);
    }
  } catch {
    // intentionally silent
  }
}
