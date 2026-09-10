// Reusable channel-agnostic confirmation dialog for any Audience Engine
// driven campaign (SMS today; WhatsApp/Email/Push tomorrow).
//
// Renders a validation summary, dry-run toggle, and in-progress bar while sending.

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Send, FlaskConical } from 'lucide-react';
import { useState } from 'react';
import type { AudienceSummary } from '@/lib/audience/types';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  summary?: AudienceSummary;
  previewMessage: string;
  invalid?: number;
  blacklisted?: number;
  sending?: boolean;
  progress?: { done: number; total: number; ok: number; fail: number };
  onConfirm: (opts: { dryRun: boolean }) => void;
  confirmLabel?: string;
  allowDryRun?: boolean;
}

export default function AudienceConfirmDialog({
  open, onOpenChange, summary, previewMessage, invalid = 0, blacklisted = 0,
  sending, progress, onConfirm, confirmLabel = 'এখনই পাঠান', allowDryRun = true,
}: Props) {
  const s = summary;
  const [dryRun, setDryRun] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(o) => !sending && onOpenChange(o)}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>পাঠানো নিশ্চিত করুন</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <Cell label="Total Selected" value={s?.recipients ?? 0} />
            <Cell label="Duplicates Removed" value={s?.duplicatesRemoved ?? 0} tone="amber" />
            <Cell label="Excluded" value={s?.excluded ?? 0} tone="rose" />
            <Cell label="Invalid Numbers" value={invalid} tone="rose" />
            <Cell label="Blacklisted" value={blacklisted} tone="rose" />
            <Cell label="SMS Parts" value={s?.smsParts ?? 0} />
            <Cell label="Final Recipients" value={s?.finalCount ?? 0} tone="emerald" big />
            <Cell label="Estimated Cost" value={`৳${(s?.estimatedCost ?? 0).toFixed(2)}`} big />
          </div>

          <div className="rounded-md border bg-muted/30 p-2">
            <p className="text-[11px] text-muted-foreground mb-1">প্রিভিউ মেসেজ:</p>
            <p className="text-xs whitespace-pre-wrap">{previewMessage || <span className="italic text-muted-foreground">(empty)</span>}</p>
          </div>

          {allowDryRun && (
            <div className="flex items-center justify-between rounded-md border bg-amber-50 dark:bg-amber-950/20 p-2">
              <div className="flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-amber-600" />
                <div>
                  <Label htmlFor="dry-run" className="text-xs font-medium cursor-pointer">ড্রাই রান মোড</Label>
                  <p className="text-[10px] text-muted-foreground">SMS পাঠানো হবে না — শুধু ভ্যালিডেশন ও কস্ট</p>
                </div>
              </div>
              <Switch id="dry-run" checked={dryRun} onCheckedChange={setDryRun} disabled={sending} />
            </div>
          )}

          {sending && progress && (
            <div className="space-y-1">
              <Progress value={(progress.done / Math.max(progress.total, 1)) * 100} />
              <p className="text-xs text-muted-foreground text-center">
                {progress.done} / {progress.total} — ✓ {progress.ok} ✗ {progress.fail}
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>বাতিল</Button>
          <Button onClick={() => onConfirm({ dryRun })} disabled={sending || (s?.finalCount ?? 0) === 0}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : dryRun ? <FlaskConical className="h-4 w-4 mr-1" /> : <Send className="h-4 w-4 mr-1" />}
            {dryRun ? 'ড্রাই রান চালান' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Cell({ label, value, tone, big }: { label: string; value: any; tone?: 'emerald' | 'amber' | 'rose'; big?: boolean }) {
  const cls = tone === 'emerald' ? 'text-emerald-600' : tone === 'amber' ? 'text-amber-600' : tone === 'rose' ? 'text-rose-600' : 'text-foreground';
  return (
    <div className="rounded-md border p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`font-mono font-semibold ${big ? 'text-base' : 'text-sm'} ${cls}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
    </div>
  );
}
