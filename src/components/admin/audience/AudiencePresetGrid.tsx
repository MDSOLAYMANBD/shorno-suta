import { memo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';
import * as Icons from 'lucide-react';
import { PRESETS } from '@/lib/audience/presets';
import type { PresetId } from '@/lib/audience/types';
import { useAllPresetCounts } from '@/hooks/useAudienceCounts';
import { cn } from '@/lib/utils';

interface Props {
  selected: PresetId[];
  onToggle: (id: PresetId) => void;
  group?: string; // optional filter by preset group
  className?: string;
}

function AudiencePresetGrid({ selected, onToggle, group, className }: Props) {

  const { data: counts = {} as Record<PresetId, number>, isLoading } = useAllPresetCounts();
  const items = group ? PRESETS.filter((p) => p.group === group) : PRESETS;

  return (
    <div className={cn('grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2', className)}>
      {items.map((p) => {
        const Icon = (Icons as any)[p.icon] || Icons.Circle;
        const isSelected = selected.includes(p.id);
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onToggle(p.id)}
            className="text-left"
          >
            <Card
              className={cn(
                'relative p-3 transition-all hover:shadow-md cursor-pointer h-full',
                isSelected
                  ? 'border-2 border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20'
                  : 'border-border',
              )}
            >
              {isSelected && (
                <div className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-emerald-500 text-white grid place-items-center">
                  <Check className="h-3 w-3" />
                </div>
              )}
              <Icon className="h-5 w-5 text-primary mb-2" />
              <div className="text-sm font-semibold leading-tight">{p.title}</div>
              <div className="text-[10px] text-muted-foreground">{p.bn}</div>
              <div className="text-[10px] text-muted-foreground/80 mt-1 line-clamp-2 leading-snug">
                {p.description}
              </div>
              <Badge variant="secondary" className="mt-2 text-[10px] font-mono">
                {isLoading ? '…' : (counts[p.id] ?? 0).toLocaleString()}
              </Badge>
            </Card>
          </button>
        );
      })}
    </div>
  );
}

export default memo(AudiencePresetGrid);

