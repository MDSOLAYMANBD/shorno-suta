import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, MapPin, Search, RefreshCw } from 'lucide-react';
import { ACTIVE_LOCATION_LEVELS } from '@/lib/audience/locations';
import { DISTRICTS } from '@/lib/audience/districts';
import { useDistrictCounts } from '@/hooks/useAudienceCounts';
import { useQueryClient } from '@tanstack/react-query';
import { audienceKeys } from '@/lib/audience/cache';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Props {
  selectedDistricts: string[];
  onToggleDistrict: (name: string) => void;
}

// Hierarchy-ready picker. Iterates ACTIVE_LOCATION_LEVELS so Upazila / Area
// can be enabled later without rewriting the component.
export default function LocationPicker({ selectedDistricts, onToggleDistrict }: Props) {
  const qc = useQueryClient();
  const { data: counts = {}, isLoading } = useDistrictCounts();
  const [search, setSearch] = useState('');
  const totalDetected = Object.values(counts).reduce((s, n) => s + (n as number), 0);
  const rescan = () => qc.invalidateQueries({ queryKey: audienceKeys.districtCounts() });

  const districtItems = useMemo(() => {
    const list = DISTRICTS.map((d) => ({
      name: d.name,
      bn: d.bn,
      division: d.division,
      count: counts[d.name] || 0,
    }));
    if (counts.Unknown) list.push({ name: 'Unknown', bn: 'অজানা', division: '-', count: counts.Unknown });
    const q = search.trim().toLowerCase();
    const filtered = q
      ? list.filter((d) => d.name.toLowerCase().includes(q) || d.bn.includes(search.trim()))
      : list;
    return filtered.sort((a, b) => b.count - a.count);
  }, [counts, search]);

  return (
    <div className="space-y-2">
      {ACTIVE_LOCATION_LEVELS.map((level) => (
        <div key={level.level} className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">{level.label}</span>
              <span className="text-xs text-muted-foreground">({level.bn})</span>
            </div>
            <Badge variant="outline" className="text-[10px]">
              {selectedDistricts.length} selected
            </Badge>
          </div>

          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8 h-9"
              placeholder={`Search ${level.label.toLowerCase()}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <ScrollArea className="h-60 rounded-md border">
            <div className="p-2 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {isLoading ? (
                <div className="col-span-full text-center text-xs text-muted-foreground py-6">
                  Loading districts…
                </div>
              ) : totalDetected === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center text-center gap-2 py-6">
                  <div className="text-xs text-muted-foreground">
                    No customer addresses are currently indexed.
                  </div>
                  <Button size="sm" variant="outline" onClick={rescan}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1" /> Rescan Addresses
                  </Button>
                </div>
              ) : districtItems.length === 0 ? (
                <div className="col-span-full text-center text-xs text-muted-foreground py-6">
                  No matches
                </div>
              ) : (
                districtItems.map((d) => {
                  const isSel = selectedDistricts.includes(d.name);
                  return (
                    <button
                      key={d.name}
                      type="button"
                      onClick={() => onToggleDistrict(d.name)}
                      className={cn(
                        'flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition-colors',
                        isSel
                          ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20'
                          : 'hover:bg-muted/50',
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{d.name}</div>
                        <div className="truncate text-[10px] text-muted-foreground">{d.bn}</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {d.count.toLocaleString()}
                        </span>
                        {isSel && (
                          <div className="h-4 w-4 rounded-full bg-emerald-500 text-white grid place-items-center">
                            <Check className="h-2.5 w-2.5" />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>
      ))}
    </div>
  );
}
