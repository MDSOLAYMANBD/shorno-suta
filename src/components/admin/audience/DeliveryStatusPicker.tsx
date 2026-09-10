import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';
import { PARCEL_STATUSES } from '@/lib/audience/parcelStatuses';
import type { ParcelStatus } from '@/lib/audience/types';
import { useParcelStatusCounts } from '@/hooks/useAudienceCounts';
import { cn } from '@/lib/utils';

interface Props {
  selected: ParcelStatus[];
  onToggle: (id: ParcelStatus) => void;
}

const toneClasses: Record<string, string> = {
  positive: 'border-emerald-200 text-emerald-700 dark:text-emerald-300',
  neutral: 'border-amber-200 text-amber-700 dark:text-amber-300',
  negative: 'border-rose-200 text-rose-700 dark:text-rose-300',
};

export default function DeliveryStatusPicker({ selected, onToggle }: Props) {
  const { data: counts = {}, isLoading } = useParcelStatusCounts();
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
      {PARCEL_STATUSES.map((s) => {
        const isSel = selected.includes(s.id);
        return (
          <button key={s.id} type="button" onClick={() => onToggle(s.id)} className="text-left">
            <Card
              className={cn(
                'relative p-3 cursor-pointer transition-all hover:shadow-sm h-full',
                isSel
                  ? 'border-2 border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20'
                  : 'border-border',
              )}
            >
              {isSel && (
                <div className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-emerald-500 text-white grid place-items-center">
                  <Check className="h-3 w-3" />
                </div>
              )}
              <div className="text-sm font-semibold leading-tight">{s.label}</div>
              <div className="text-[10px] text-muted-foreground line-clamp-1">{s.bn}</div>
              <Badge
                variant="outline"
                className={cn('mt-2 text-[10px] font-mono', toneClasses[s.tone])}
              >
                {isLoading ? '…' : (counts[s.id] ?? 0).toLocaleString()}
              </Badge>
            </Card>
          </button>
        );
      })}
    </div>
  );
}
