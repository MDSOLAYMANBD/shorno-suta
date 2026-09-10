import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, Play, Copy, AlertCircle, CheckCircle2, Clipboard } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

type DiagResult = {
  label: string;
  message: string;
  request: {
    url: string; method: string; sender_id: string;
    phone_normalized: string; phone_local: string;
    msg_length: number; sms_parts: number;
    is_unicode: boolean; has_bangla: boolean; contains_url: boolean;
    payload_masked: Record<string, unknown>;
    headers: Record<string, string>;
  };
  response: {
    http_status: number; http_ok: boolean;
    headers: Record<string, string>;
    raw_body: string; parsed: unknown;
    timing_ms: { connect_and_ttfb: number; response_read: number; total: number };
  };
  outcome: { success: boolean; status_code?: string; message_id?: string; note?: string; result: 'PASS' | 'FAIL' };
};

type DiagReport = {
  phone_normalized: string;
  sender_id: string;
  url: string;
  summary: Array<{ label: string; success: boolean; status_code?: string; note?: string; raw: string }>;
  comparison: Record<string, Record<string, unknown> & { _differs: boolean }>;
  results: DiagResult[];
  error?: string;
};

export default function AutomasDiagnosticDialog({
  open,
  onOpenChange,
  senderId,
  apiUrl,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  senderId: string;
  apiUrl: string;
}) {
  const [phone, setPhone] = useState('');
  const [testMode, setTestMode] = useState(false);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<DiagReport | null>(null);

  const run = async () => {
    if (!/^01[3-9]\d{8}$/.test(phone.trim())) return toast.error('সঠিক BD মোবাইল নম্বর দিন (01XXXXXXXXX)');
    setRunning(true);
    setReport(null);
    const { data, error } = await supabase.functions.invoke('automas-diagnostic', {
      body: { phone: phone.trim(), senderId, testMode },
    });
    setRunning(false);
    if (error) return toast.error(error.message);
    if ((data as any)?.error) {
      toast.error((data as any).error);
      return;
    }
    setReport(data as DiagReport);
    const ok = (data as DiagReport).results.filter((r) => r.outcome.result === 'PASS').length;
    toast.success(`Diagnostic complete — ${ok}/${(data as DiagReport).results.length} PASS`);
  };

  const copyJson = async () => {
    if (!report) return;
    await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    toast.success('Full diagnostic copied');
  };

  const copyRaw = async (txt: string) => {
    await navigator.clipboard.writeText(txt);
    toast.success('Raw response copied');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>🚀 Automas Provider Diagnostic</DialogTitle>
        </DialogHeader>

        {/* Inputs */}
        <div className="grid sm:grid-cols-2 gap-3 border rounded-lg p-3 bg-muted/30">
          <div>
            <Label className="text-xs">Phone Number</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="017XXXXXXXX" />
          </div>
          <div>
            <Label className="text-xs">Sender ID (read-only)</Label>
            <Input value={senderId} readOnly className="bg-muted" />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">API URL (read-only)</Label>
            <Input value={apiUrl} readOnly className="bg-muted" />
          </div>
          <div className="sm:col-span-2 flex items-center gap-2">
            <Switch checked={testMode} onCheckedChange={setTestMode} id="test-mode" />
            <Label htmlFor="test-mode" className="text-xs">
              Test Mode (dry-run — build payload, do NOT send to provider)
            </Label>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={run} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
            Run 4-Test Diagnostic
          </Button>
          {report && (
            <Button variant="outline" onClick={copyJson}>
              <Copy className="h-4 w-4 mr-1" /> Copy Full Diagnostic
            </Button>
          )}
        </div>

        {/* Tests legend */}
        <div className="text-[11px] text-muted-foreground border-l-2 border-primary pl-2">
          <div><b>1.</b> Plain text · <b>2.</b> Plain text + URL · <b>3.</b> Long multipart · <b>4.</b> Long multipart + URL</div>
        </div>

        {report && (
          <>
            {/* Comparison table */}
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-2">Test</th>
                    <th className="text-left p-2">HTTP</th>
                    <th className="text-left p-2">Provider Status</th>
                    <th className="text-left p-2">Success</th>
                    <th className="text-left p-2">Total ms</th>
                    <th className="text-left p-2">TTFB ms</th>
                    <th className="text-left p-2">Read ms</th>
                    <th className="text-left p-2">Parts</th>
                    <th className="text-left p-2">URL</th>
                    <th className="text-left p-2">Unicode</th>
                    <th className="text-left p-2">Result</th>
                    <th className="text-left p-2">Raw</th>
                  </tr>
                </thead>
                <tbody>
                  {report.results.map((r) => (
                    <tr key={r.label} className="border-t align-top">
                      <td className="p-2 font-mono">{r.label}</td>
                      <td className="p-2">{r.response.http_status}</td>
                      <td className="p-2 font-mono">{r.outcome.status_code ?? '—'}</td>
                      <td className="p-2">{r.outcome.success ? '✅' : '❌'}</td>
                      <td className="p-2 tabular-nums">{r.response.timing_ms.total}</td>
                      <td className="p-2 tabular-nums">{r.response.timing_ms.connect_and_ttfb}</td>
                      <td className="p-2 tabular-nums">{r.response.timing_ms.response_read}</td>
                      <td className="p-2">{r.request.sms_parts}</td>
                      <td className="p-2">{r.request.contains_url ? 'Yes' : 'No'}</td>
                      <td className="p-2">{r.request.is_unicode ? 'Yes' : 'No'}</td>
                      <td className="p-2">
                        {r.outcome.result === 'PASS' ? (
                          <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">PASS</Badge>
                        ) : (
                          <Badge variant="destructive">FAIL</Badge>
                        )}
                      </td>
                      <td className="p-2 max-w-[260px]">
                        <div className="flex items-start gap-1">
                          <pre className="whitespace-pre-wrap break-all text-[10px] bg-muted/50 rounded p-1 flex-1">
                            {r.response.raw_body.slice(0, 300) || '—'}
                          </pre>
                          {r.response.raw_body && (
                            <button onClick={() => copyRaw(r.response.raw_body)} className="text-muted-foreground hover:text-foreground">
                              <Clipboard className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                        {r.outcome.note && (
                          <div className="mt-1 text-[10px] text-amber-700 flex items-start gap-1">
                            <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" /> {r.outcome.note}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Difference highlights */}
            <div className="border rounded-lg p-3">
              <div className="text-xs font-semibold mb-2 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Differing fields (PASS vs FAIL highlighted)
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted">
                      <th className="text-left p-2">Field</th>
                      {report.results.map((r) => (
                        <th key={r.label} className="text-left p-2 font-mono">
                          {r.label} {r.outcome.result === 'PASS' ? '✅' : '❌'}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(report.comparison)
                      .filter(([, row]) => row._differs)
                      .map(([field, row]) => (
                        <tr key={field} className="border-t bg-amber-50/60">
                          <td className="p-2 font-medium">{field}</td>
                          {report.results.map((r) => (
                            <td key={r.label} className="p-2 font-mono break-all max-w-[260px]">
                              {String((row as any)[r.label] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    {Object.values(report.comparison).every((row) => !row._differs) && (
                      <tr>
                        <td className="p-2 text-muted-foreground" colSpan={report.results.length + 1}>
                          All request fields identical — only the message body differs.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="text-[10px] text-muted-foreground">
              Note: Deno fetch does not expose separate DNS / TCP / TLS / HTTP request / HTTP response phases.
              We report what is measurable: <b>connect + TTFB</b> (DNS+TCP+TLS+request+first byte combined),
              <b> response read</b>, and <b>total</b>.
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
