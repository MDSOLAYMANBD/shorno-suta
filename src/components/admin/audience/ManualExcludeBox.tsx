import { useMemo, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { dedupePhones } from '@/lib/audience/helpers';

interface Props {
  value: string[];                       // committed normalized phones
  onChange: (phones: string[]) => void;
}

// Paste numbers (any format) → normalized BD phones with live counters
// for invalid / duplicate inputs. Business logic lives in helpers.ts.
export default function ManualExcludeBox({ value, onChange }: Props) {
  const [raw, setRaw] = useState(value.join('\n'));

  const stats = useMemo(() => {
    const tokens = raw.split(/[\s,;\n\r]+/).map((t) => t.trim()).filter(Boolean);
    return dedupePhones(tokens);
  }, [raw]);

  const commit = () => onChange(stats.unique);

  return (
    <div className="space-y-2">
      <Label className="text-xs">Manual Exclude — paste phone numbers</Label>
      <Textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onBlur={commit}
        className="h-24 font-mono text-xs"
        placeholder="01XXXXXXXXX, 8801XXXXXXXXX&#10;one per line or comma-separated"
      />
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline" className="text-[10px]">
          Excluded: <span className="ml-1 font-mono">{stats.unique.length}</span>
        </Badge>
        <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300">
          Invalid: <span className="ml-1 font-mono">{stats.invalid}</span>
        </Badge>
        <Badge variant="outline" className="text-[10px] text-rose-700 border-rose-300">
          Duplicate: <span className="ml-1 font-mono">{stats.duplicates}</span>
        </Badge>
      </div>
    </div>
  );
}
