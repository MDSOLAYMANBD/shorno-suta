import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PhoneCall, CheckCircle2, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Props {
  conversationId: string | null;
}

export default function CallHistorySection({ conversationId }: Props) {
  const { data: calls = [] } = useQuery({
    queryKey: ['inbox-sim-calls', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      const { data } = await supabase
        .from('inbox_simulated_calls' as any)
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(10);
      return (data || []) as any[];
    },
    enabled: !!conversationId,
  });

  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
        <PhoneCall className="h-3 w-3" /> কল হিস্টরি
      </p>
      {calls.length === 0 ? (
        <p className="text-xs text-muted-foreground">কোনো কল রেকর্ড নেই</p>
      ) : (
        <div className="space-y-1">
          {calls.map((c: any) => (
            <div key={c.id} className="flex items-center gap-2 text-xs border rounded px-2 py-1">
              {c.outcome === 'confirmed' ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-destructive" />
              )}
              <span className="flex-1 capitalize">{c.outcome}</span>
              <span className="text-muted-foreground">
                {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
