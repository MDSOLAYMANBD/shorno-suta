import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { IncludeMode } from '@/lib/audience/types';

interface Props {
  mode: IncludeMode;
  onChange: (m: IncludeMode) => void;
}

export default function IncludeModeToggle({ mode, onChange }: Props) {
  return (
    <div className="rounded-md border bg-muted/30 p-2 space-y-2">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Info className="h-3 w-3" /> ইনক্লুড ফিল্টার কীভাবে যুক্ত হবে
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => onChange('AND')}
          className={cn(
            'rounded-md border px-2 py-1.5 text-left transition',
            mode === 'AND' ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/20' : 'hover:bg-muted/60',
          )}
        >
          <div className="text-xs font-semibold">Match ALL (AND)</div>
          <div className="text-[10px] text-muted-foreground">প্রতিটি অডিয়েন্স পূরণ করতে হবে</div>
        </button>
        <button
          type="button"
          onClick={() => onChange('OR')}
          className={cn(
            'rounded-md border px-2 py-1.5 text-left transition',
            mode === 'OR' ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/20' : 'hover:bg-muted/60',
          )}
        >
          <div className="text-xs font-semibold">Match ANY (OR)</div>
          <div className="text-[10px] text-muted-foreground">যেকোনো একটি পূরণ করলেই হবে</div>
        </button>
      </div>
    </div>
  );
}
