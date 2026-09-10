import { useEffect, useMemo, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { dedupePhones } from '@/lib/audience/helpers';

interface Props {
  /** Committed normalized phones (8801XXXXXXXXX). */
  value: string[];
  onChange: (phones: string[]) => void;
}

/**
 * Paste-box for "Manual Numbers" audience source. Accepts any separator
 * (newline / comma / space / semicolon), normalizes Bangladesh numbers via
 * the same validator the SMS pipeline uses, and dedupes silently.
 *
 * The committed list flows into `AudienceFilter.manualInclude` so the
 * engine merges it with database audiences (Preview / Summary / Send).
 */
export default function ManualIncludeBox({ value, onChange }: Props) {
  const [raw, setRaw] = useState(value.join('\n'));

  // Keep textarea in sync if parent resets (e.g. follow-up campaign load).
  useEffect(() => {
    const joined = value.join('\n');
    setRaw((prev) => (prev.trim() === joined.trim() ? prev : joined));
  }, [value]);

  const stats = useMemo(() => {
    const tokens = raw.split(/[\s,;\n\r]+/).map((t) => t.trim()).filter(Boolean);
    return { ...dedupePhones(tokens), totalEntered: tokens.length };
  }, [raw]);

  const commit = () => onChange(stats.unique);

  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold">
        ম্যানুয়াল নাম্বার (ঐচ্ছিক) — Audience Engine-এর সাথে মার্জ হবে
      </Label>
      <Textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onBlur={commit}
        className="h-24 font-mono text-xs"
        placeholder={'01XXXXXXXXX, 8801XXXXXXXXX\nএক লাইনে একটি অথবা কমা/স্পেস দিয়ে'}
      />
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline" className="text-[10px]">
          Manual Numbers: <span className="ml-1 font-mono">{stats.unique.length}</span>
        </Badge>
        <Badge variant="outline" className="text-[10px] text-rose-700 border-rose-300">
          Invalid: <span className="ml-1 font-mono">{stats.invalid}</span>
        </Badge>
        <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300">
          Duplicate: <span className="ml-1 font-mono">{stats.duplicates}</span>
        </Badge>
      </div>
      <p className="text-[10px] text-muted-foreground">
        কোনো নাম্বার যদি ইতিমধ্যেই সিলেক্টেড অডিয়েন্সে থাকে, তাকে একবারই SMS যাবে।
      </p>
    </div>
  );
}
