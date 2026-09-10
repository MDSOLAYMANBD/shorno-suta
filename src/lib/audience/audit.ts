// CRM Audience Engine — audit log helper.
// Inserts a row into public.crm_audit_logs. RLS restricts inserts to the
// current authenticated staff user.

import { supabase } from '@/integrations/supabase/client';

export type AuditAction =
  | 'audience_created'
  | 'audience_edited'
  | 'audience_deleted'
  | 'audience_duplicated'
  | 'audience_favorited'
  | 'sms_sent'
  | 'sms_dry_run'
  | 'campaign_cancelled';

export interface AuditLogRow {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: AuditAction;
  entity_type: string;
  entity_id: string | null;
  ip: string | null;
  user_agent: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

let cachedIp: string | null | undefined;

async function getClientIp(): Promise<string | null> {
  if (cachedIp !== undefined) return cachedIp;
  try {
    const res = await fetch('https://api.ipify.org?format=json', { cache: 'force-cache' });
    if (!res.ok) { cachedIp = null; return null; }
    const j = await res.json();
    cachedIp = j?.ip || null;
  } catch {
    cachedIp = null;
  }
  return cachedIp;
}

export async function logAudit(
  action: AuditAction,
  entityType: string,
  entityId?: string | null,
  metadata: Record<string, any> = {},
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const ip = await getClientIp();
    await (supabase.from('crm_audit_logs' as any) as any).insert({
      actor_id: user.id,
      actor_email: user.email ?? null,
      action,
      entity_type: entityType,
      entity_id: entityId ?? null,
      ip,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 500) : null,
      metadata,
    });
  } catch (e) {
    // never let audit logging break a user-facing action
    console.warn('[audit]', e);
  }
}
