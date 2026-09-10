import { useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, X, Eraser } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  phones: string[];
  onRemove: (phone: string) => void;
  onClear: () => void;
}

// Right-side drawer of selected customers. We only have the phone set here —
// for displayed name/details we lazy-fetch in a follow-up, this Phase 3
// keeps it lightweight (phones + search + remove).
export default function SelectedDrawer({ open, onOpenChange, phones, onRemove, onClear }: Props) {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return phones;
    return phones.filter((p) => p.toLowerCase().includes(term));
  }, [q, phones]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-sm flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <span>Selected ({phones.length.toLocaleString()})</span>
            <Button size="sm" variant="outline" onClick={onClear} className="h-7 text-xs gap-1">
              <Eraser className="h-3 w-3" /> Clear all
            </Button>
          </SheetTitle>
        </SheetHeader>
        <div className="relative mt-3">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by phone…" className="pl-8 h-9" />
        </div>
        <ScrollArea className="flex-1 mt-3 -mx-6 px-6">
          <div className="space-y-1">
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground italic text-center py-6">
                {phones.length === 0 ? 'No customers selected yet.' : 'No matches.'}
              </p>
            ) : filtered.map((p) => (
              <div key={p} className="flex items-center justify-between rounded-md border px-2 py-1.5 text-xs">
                <span className="font-mono">{p}</span>
                <button onClick={() => onRemove(p)} className="text-muted-foreground hover:text-rose-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </ScrollArea>
        <div className="pt-3 border-t mt-3">
          <Badge variant="outline" className="text-[10px]">
            Showing {filtered.length.toLocaleString()} / {phones.length.toLocaleString()}
          </Badge>
        </div>
      </SheetContent>
    </Sheet>
  );
}
