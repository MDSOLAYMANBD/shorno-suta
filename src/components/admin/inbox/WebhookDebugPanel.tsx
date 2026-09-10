import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, ChevronDown, ChevronRight, Bug } from 'lucide-react';

interface LogRow {
  id: string;
  created_at: string;
  platform: string | null;
  object_type: string | null;
  event_type: string | null;
  parsed_count: number | null;
  saved_count: number | null;
  skipped_reasons: any;
  raw_preview: string | null;
  error: string | null;
  has_signature: boolean | null;
}

export default function WebhookDebugPanel() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase
        .from('webhook_event_logs' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) {
        setErrorMsg(error.message);
        setLogs([]);
      } else {
        setLogs((data || []) as any);
      }
    } catch (e: any) {
      setErrorMsg(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, []);

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bug className="h-4 w-4 text-primary" />
            Webhook Debug Panel
          </CardTitle>
          <Button size="sm" variant="ghost" onClick={load} disabled={loading} className="h-7 px-2">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {errorMsg && (
          <p className="text-xs text-destructive mb-2">{errorMsg}</p>
        )}
        {!errorMsg && logs.length === 0 && !loading && (
          <p className="text-xs text-muted-foreground">
            এখনো কোনো webhook event log নেই — Test message ব্যবহার করুন।
          </p>
        )}
        <div className="space-y-1">
          {logs.map(l => {
            const ok = !l.error && (l.saved_count ?? 0) >= 0;
            const isOpen = openId === l.id;
            const platform = l.platform || 'unknown';
            const event = l.event_type || l.object_type || '—';
            return (
              <div key={l.id} className="border rounded-md text-xs">
                <button
                  type="button"
                  className="w-full flex items-center justify-between gap-2 px-2 py-1.5 hover:bg-accent/50 text-left"
                  onClick={() => setOpenId(isOpen ? null : l.id)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isOpen ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
                    <span className="text-muted-foreground shrink-0">
                      {new Date(l.created_at).toLocaleTimeString()}
                    </span>
                    <Badge variant="outline" className="text-[10px] px-1 py-0">{platform}</Badge>
                    <span className="truncate">{event}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-muted-foreground">
                      saved {l.saved_count ?? 0}/{l.parsed_count ?? 0}
                    </span>
                    {l.error ? (
                      <Badge variant="destructive" className="text-[10px] px-1 py-0">Failed</Badge>
                    ) : (
                      <Badge className="text-[10px] px-1 py-0 bg-emerald-600 hover:bg-emerald-600">Received</Badge>
                    )}
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t bg-muted/30 p-2 space-y-1">
                    {l.error && (
                      <p className="text-destructive">Error: {l.error}</p>
                    )}
                    {l.skipped_reasons && (
                      <div>
                        <p className="font-semibold text-[10px] text-muted-foreground mb-0.5">skipped_reasons</p>
                        <pre className="text-[10px] whitespace-pre-wrap break-all">
                          {JSON.stringify(l.skipped_reasons, null, 2)}
                        </pre>
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-[10px] text-muted-foreground mb-0.5">raw_preview</p>
                      <pre className="text-[10px] whitespace-pre-wrap break-all max-h-64 overflow-y-auto">
                        {l.raw_preview || '(empty)'}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
