import { Badge } from '@/components/ui/badge';
import { X, Plus, Minus } from 'lucide-react';
import { PRESET_BY_ID } from '@/lib/audience/presets';
import type { PresetId } from '@/lib/audience/types';
import { cn } from '@/lib/utils';

interface Props {
  include: PresetId[];
  exclude: PresetId[];
  districts: string[];
  onRemoveInclude: (id: PresetId) => void;
  onRemoveExclude: (id: PresetId) => void;
  onRemoveDistrict: (name: string) => void;
  onMoveToExclude: (id: PresetId) => void;
  onMoveToInclude: (id: PresetId) => void;
}

export default function IncludeExcludePanel({
  include, exclude, districts,
  onRemoveInclude, onRemoveExclude, onRemoveDistrict,
  onMoveToExclude, onMoveToInclude,
}: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <Column
        title="Include"
        bn="অন্তর্ভুক্ত"
        tone="emerald"
        icon={<Plus className="h-3.5 w-3.5" />}
      >
        {include.length === 0 && districts.length === 0 ? (
          <Empty text="No filters yet. Pick audience cards or districts above." />
        ) : (
          <>
            {include.map((id) => (
              <Chip
                key={`inc-${id}`}
                tone="emerald"
                label={PRESET_BY_ID[id]?.title || id}
                onRemove={() => onRemoveInclude(id)}
                onSwap={() => onMoveToExclude(id)}
                swapTitle="Move to Exclude"
              />
            ))}
            {districts.map((d) => (
              <Chip
                key={`dist-${d}`}
                tone="indigo"
                label={`📍 ${d}`}
                onRemove={() => onRemoveDistrict(d)}
              />
            ))}
          </>
        )}
      </Column>

      <Column
        title="Exclude"
        bn="বাদ"
        tone="rose"
        icon={<Minus className="h-3.5 w-3.5" />}
      >
        {exclude.length === 0 ? (
          <Empty text="Nothing excluded. Click a card here to exclude it." />
        ) : (
          exclude.map((id) => (
            <Chip
              key={`exc-${id}`}
              tone="rose"
              label={PRESET_BY_ID[id]?.title || id}
              onRemove={() => onRemoveExclude(id)}
              onSwap={() => onMoveToInclude(id)}
              swapTitle="Move to Include"
            />
          ))
        )}
      </Column>
    </div>
  );
}

function Column({ title, bn, tone, icon, children }: any) {
  const toneCls = tone === 'emerald'
    ? 'border-emerald-300 bg-emerald-50/30 dark:bg-emerald-950/10'
    : 'border-rose-300 bg-rose-50/30 dark:bg-rose-950/10';
  return (
    <div className={cn('rounded-lg border-2 border-dashed p-3 min-h-[100px]', toneCls)}>
      <div className="flex items-center gap-2 mb-2">
        <Badge variant="outline" className="gap-1">
          {icon}
          <span className="text-xs">{title}</span>
        </Badge>
        <span className="text-[10px] text-muted-foreground">{bn}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-[11px] text-muted-foreground italic">{text}</p>;
}

function Chip({ tone, label, onRemove, onSwap, swapTitle }: any) {
  const cls = tone === 'emerald'
    ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-200'
    : tone === 'rose'
    ? 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-200'
    : 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950/40 dark:text-indigo-200';
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]', cls)}>
      {label}
      {onSwap && (
        <button type="button" onClick={onSwap} title={swapTitle} className="opacity-60 hover:opacity-100">
          ⇄
        </button>
      )}
      <button type="button" onClick={onRemove} className="opacity-70 hover:opacity-100">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
