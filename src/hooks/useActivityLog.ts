import { supabase } from '@/integrations/supabase/client';

export function useActivityLog() {
  const logActivity = async (
    action_type: string,
    entity_type: string,
    entity_id: string | null,
    description: string,
    metadata?: Record<string, any>
  ) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await supabase.from('activity_logs' as any).insert({
        user_id: session.user.id,
        action_type,
        entity_type,
        entity_id,
        description,
        metadata: metadata || {},
      } as any);
    } catch (e) {
      console.error('Activity log error:', e);
    }
  };

  return { logActivity };
}
