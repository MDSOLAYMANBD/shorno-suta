import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Flame, Clock, Sparkles, ListChecks, AlertTriangle } from 'lucide-react';

interface Props {
  conversationId: string | null;
  conversation: any | null;
  onPickSuggestion: (text: string) => void;
}

const leadColor: Record<string, string> = {
  hot: 'bg-destructive text-destructive-foreground',
  medium: 'bg-yellow-500 text-white',
  cold: 'bg-muted text-muted-foreground',
};

export default function AutomationStrip({ conversationId, conversation, onPickSuggestion }: Props) {
  // Live-tick for SLA countdown
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Detected order (pending)
  const { data: detected } = useQuery({
    queryKey: ['inbox-detected-order', conversationId],
    queryFn: async () => {
      if (!conversationId) return null;
      const { data } = await supabase
        .from('inbox_detected_orders' as any)
        .select('*')
        .eq('conversation_id', conversationId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
    enabled: !!conversationId,
    refetchInterval: 5000,
  });

  // Logs (drawer)
  const { data: logs = [] } = useQuery({
    queryKey: ['inbox-automation-logs', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      const { data } = await supabase
        .from('inbox_automation_logs' as any)
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(50);
      return (data || []) as any[];
    },
    enabled: !!conversationId,
    refetchInterval: 8000,
  });

  // AI suggestions
  const { data: suggestions, isFetching: aiLoading, refetch: refetchAi } = useQuery({
    queryKey: ['inbox-ai-suggestions', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      const { data, error } = await supabase.functions.invoke('inbox-ai-assist', {
        body: { conversation_id: conversationId, kind: 'suggestions' },
      });
      if (error) throw error;
      return Array.isArray(data?.payload) ? (data.payload as string[]) : [];
    },
    enabled: !!conversationId,
    staleTime: 30_000,
  });

  if (!conversationId) return null;

  const lead = (conversation?.lead_score as string) || 'cold';
  const slaDue = conversation?.sla_due_at ? new Date(conversation.sla_due_at).getTime() : null;
  const slaBreached = !!conversation?.sla_breached;
  const remainingMs = slaDue ? slaDue - Date.now() : null;

  let slaLabel = 'SLA: idle';
  let slaCls = 'bg-muted text-muted-foreground';
  if (slaDue !== null) {
    if (slaBreached || (remainingMs !== null && remainingMs < 0)) {
      slaLabel = 'SLA: breached';
      slaCls = 'bg-destructive text-destructive-foreground';
    } else if (remainingMs !== null) {
      const mm = Math.floor(remainingMs / 60_000);
      const ss = Math.floor((remainingMs % 60_000) / 1000).toString().padStart(2, '0');
      slaLabel = `SLA: ${mm}:${ss}`;
      slaCls = remainingMs < 60_000 ? 'bg-yellow-500 text-white' : 'bg-emerald-600 text-white';
    }
  }

  return (
    <div className="border-b bg-card/50 px-3 py-2 flex flex-wrap items-center gap-2 text-xs">
      <Badge className={leadColor[lead] || leadColor.cold}>
        <Flame className="h-3 w-3 mr-1" />
        {lead === 'hot' ? '🔥 Hot Lead' : lead === 'medium' ? '🟡 Medium' : '⚪ Cold'}
      </Badge>

      <Badge className={slaCls}>
        <Clock className="h-3 w-3 mr-1" />
        {slaLabel}
      </Badge>

      {detected && detected.status === 'pending' && (
        <Badge variant="outline" className="border-orange-500 text-orange-600">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Order Detected: ৳{detected.detected_price}
        </Badge>
      )}
      {detected && detected.status === 'confirmed' && (
        <Badge className="bg-emerald-600 text-white">✅ Confirmed ৳{detected.detected_price}</Badge>
      )}
      {detected && detected.status === 'cancelled' && (
        <Badge variant="outline" className="text-muted-foreground">❌ Cancelled</Badge>
      )}

      <div className="flex-1" />

      <Sheet>
        <SheetTrigger asChild>
          <Button size="sm" variant="ghost" className="h-7 px-2">
            <ListChecks className="h-3.5 w-3.5 mr-1" /> Logs
          </Button>
        </SheetTrigger>
        <SheetContent className="w-[420px] sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Automation log</SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-100px)] mt-3">
            <div className="space-y-2 pr-4">
              {logs.length === 0 && <p className="text-xs text-muted-foreground">No events yet.</p>}
              {logs.map((l) => (
                <div key={l.id} className="rounded-md border p-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono">{l.event}</span>
                    <span className="text-muted-foreground">
                      {new Date(l.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  {l.payload && Object.keys(l.payload).length > 0 && (
                    <pre className="mt-1 text-[10px] text-muted-foreground whitespace-pre-wrap break-all">
                      {JSON.stringify(l.payload)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <div className="basis-full flex flex-wrap items-center gap-1.5 pt-1">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span className="text-muted-foreground mr-1">AI:</span>
        {aiLoading && <span className="text-muted-foreground">generating…</span>}
        {!aiLoading && (suggestions || []).map((s, i) => (
          <Button
            key={i}
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => onPickSuggestion(s)}
          >
            {s.length > 50 ? s.slice(0, 47) + '…' : s}
          </Button>
        ))}
        {!aiLoading && (!suggestions || suggestions.length === 0) && (
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => refetchAi()}>
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}
