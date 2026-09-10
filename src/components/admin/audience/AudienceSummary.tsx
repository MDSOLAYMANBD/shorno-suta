import { memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { resolveAudiencePhones } from '@/lib/audience/engine';
import { audienceKeys, AUDIENCE_CACHE_DEFAULTS } from '@/lib/audience/cache';
import { estimateSmsCost, smsParts } from '@/lib/audience/helpers';
import type { AudienceFilter, AudienceSummary as AudienceSummaryType } from '@/lib/audience/types';
import { cn } from '@/lib/utils';

interface Props {
  filter: AudienceFilter;
  message: string;
  summary?: AudienceSummaryType;
  resolving?: boolean;
  className?: string;
}

function AudienceSummary({ filter, message, summary, resolving, className }: Props) {
  const filterIsEmpty =
    filter.include.length + filter.exclude.length + filter.districts.length +
    filter.parcelStatuses.length + (filter.manualInclude?.length || 0) === 0;
  const parts = smsParts(message || '');

  const { data, isLoading } = useQuery({
    queryKey: audienceKeys.summary(filter),
    queryFn: () => resolveAudiencePhones(filter, ''),
    enabled: !filterIsEmpty && !summary,
    ...AUDIENCE_CACHE_DEFAULTS,
  });

  const baseSummary = summary || data?.summary;
  const s = baseSummary
    ? {
        ...baseSummary,
        smsParts: parts,
        estimatedCost: estimateSmsCost(parts, baseSummary.finalCount),
      }
    : undefined;

  return (
    <Card className={cn('p-3 sticky top-2', className)}>
      <div className="text-xs font-semibold mb-2 flex items-center justify-between">
        <span>Audience Summary</span>
        <span className="text-[10px] text-muted-foreground font-normal">Live</span>
      </div>
      {filterIsEmpty ? (
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <Stat label="Database Audience" value={0} />
          <Stat label="Manual Numbers" value={0} tone="indigo" />
          <Stat label="Duplicate Removed" value={0} tone="amber" />
          <Stat label="Invalid Numbers" value={0} tone="rose" />
          <Stat label="Final SMS" value={0} tone="emerald" big />
          <Stat label="SMS Parts" value={parts} />
        </div>
      ) : !s && (resolving || isLoading) ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-5 w-full" />)}
        </div>
      ) : s ? (
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <Stat label="Database Audience" value={s.databaseCount} />
          <Stat label="Manual Numbers"    value={s.manualCount} tone="indigo" />
          <Stat label="Duplicate Removed" value={s.duplicatesRemoved} tone="amber" />
          <Stat label="Invalid Numbers"   value={s.invalid + s.manualInvalid} tone="rose" />
          <Stat label="Excluded"          value={s.excluded} tone="rose" />
          <Stat label="Unique Phones"     value={s.uniquePhones} />
          <Stat label="Final SMS"         value={s.finalCount} tone="emerald" big />
          <Stat label="Est. Cost"         value={`৳${s.estimatedCost.toFixed(2)}`} big />
          <Stat label="SMS Parts"         value={s.smsParts} />
          <Stat label="Source"            value={s.source} />
          <Stat label="Delivered %"       value={`${s.deliveredPercent}%`} />
          <Stat label="Avg Spend"         value={`৳${s.averageSpend.toFixed(0)}`} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <Stat label="Database Audience" value={0} />
          <Stat label="Manual Numbers" value={0} tone="indigo" />
          <Stat label="Final SMS" value={0} tone="emerald" big />
          <Stat label="SMS Parts" value={parts} />
        </div>
      )}
    </Card>
  );
}

function Stat({ label, value, tone, big }: { label: string; value: any; tone?: 'emerald' | 'amber' | 'rose' | 'indigo'; big?: boolean }) {
  const toneCls =
    tone === 'emerald' ? 'text-emerald-600'
    : tone === 'amber' ? 'text-amber-600'
    : tone === 'rose' ? 'text-rose-600'
    : tone === 'indigo' ? 'text-indigo-600'
    : 'text-foreground';
  return (
    <div className="rounded-md border bg-muted/30 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn('font-mono font-semibold', big ? 'text-base' : 'text-sm', toneCls)}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
    </div>
  );
}

export default memo(AudienceSummary);

