// Non-blocking progress dialog for any audience-engine send pipeline.
// State is owned by the parent so the dialog can be re-opened across renders
// without losing the run.

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Hourglass, Send } from 'lucide-react';

export interface ProgressState {
  total: number;
  done: number;
  ok: number;
  fail: number;
  status: 'idle' | 'running' | 'done' | 'error';
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  progress: ProgressState;
  title?: string;
}

export default function SendProgressDialog({ open, onOpenChange, progress, title = 'পাঠানো চলছে' }: Props) {
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  const remaining = Math.max(0, progress.total - progress.done);

  return (
    <Dialog open={open} onOpenChange={(o) => progress.status !== 'running' && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4" /> {title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Progress value={pct} />
            <p className="text-xs text-center text-muted-foreground">{progress.done} / {progress.total} ({pct}%)</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <Pill icon={CheckCircle2} label="সফল" value={progress.ok} tone="emerald" />
            <Pill icon={XCircle} label="ব্যর্থ" value={progress.fail} tone="rose" />
            <Pill icon={Hourglass} label="বাকি" value={remaining} tone="amber" />
          </div>
          <p className="text-[11px] text-center text-muted-foreground">
            ডায়ালগ বন্ধ করলেও পাঠানো ব্যাকগ্রাউন্ডে চলতে থাকবে
          </p>
          {progress.status === 'done' && (
            <Badge variant="default" className="w-full justify-center py-1">সম্পন্ন</Badge>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Pill({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number; tone: 'emerald' | 'rose' | 'amber' }) {
  const cls = tone === 'emerald' ? 'text-emerald-600 border-emerald-200 bg-emerald-50'
    : tone === 'rose' ? 'text-rose-600 border-rose-200 bg-rose-50'
    : 'text-amber-700 border-amber-200 bg-amber-50';
  return (
    <div className={`rounded-md border p-2 flex flex-col items-center ${cls}`}>
      <Icon className="h-3.5 w-3.5 mb-0.5" />
      <span className="text-[10px]">{label}</span>
      <span className="font-mono font-semibold">{value}</span>
    </div>
  );
}
