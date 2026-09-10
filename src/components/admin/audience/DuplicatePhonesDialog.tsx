import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, Clock, Star } from 'lucide-react';
import type { PresetId } from '@/lib/audience/types';

export interface DuplicateGroup {
  phone: string;
  count: number;
  names: string[];
  matched: PresetId[];
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  groups: DuplicateGroup[];
  onResolve: (mode: 'first' | 'latest' | 'remove', phones?: string[]) => void;
}

export default function DuplicatePhonesDialog({ open, onOpenChange, groups, onResolve }: Props) {
  const total = groups.reduce((s, g) => s + g.count, 0);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>ডুপ্লিকেট ফোন নাম্বার ({groups.length})</DialogTitle>
        </DialogHeader>
        <div className="text-xs text-muted-foreground">
          মোট {total} টি রেকর্ডে {groups.length} টি নাম্বার একাধিকবার আছে। SMS এর আগে রেজোলিউশন করুন।
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => onResolve('first')}>
            <Star className="h-3.5 w-3.5 mr-1" /> Keep First
          </Button>
          <Button size="sm" variant="outline" onClick={() => onResolve('latest')}>
            <Clock className="h-3.5 w-3.5 mr-1" /> Keep Latest
          </Button>
        </div>

        <ScrollArea className="h-72 rounded-md border">
          <table className="min-w-full text-xs">
            <thead className="sticky top-0 bg-background border-b">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium">Phone</th>
                <th className="px-2 py-1.5 text-left font-medium">Count</th>
                <th className="px-2 py-1.5 text-left font-medium">Names</th>
                <th className="px-2 py-1.5 text-left font-medium">Matched Audiences</th>
                <th className="px-2 py-1.5 w-10" />
              </tr>
            </thead>
            <tbody>
              {groups.length === 0 ? (
                <tr><td colSpan={5} className="text-center text-muted-foreground py-6">কোনো ডুপ্লিকেট নেই</td></tr>
              ) : groups.map((g) => (
                <tr key={g.phone} className="border-b last:border-0">
                  <td className="px-2 py-1.5 font-mono">{g.phone}</td>
                  <td className="px-2 py-1.5"><Badge variant="secondary">{g.count}</Badge></td>
                  <td className="px-2 py-1.5 truncate max-w-[180px]" title={g.names.join(', ')}>
                    {g.names.join(', ') || '—'}
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex flex-wrap gap-1">
                      {g.matched.map((m) => (
                        <Badge key={m} variant="outline" className="text-[10px]">{m}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <Button size="icon" variant="ghost" className="h-7 w-7"
                      onClick={() => onResolve('remove', [g.phone])} title="Remove this number">
                      <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>বন্ধ</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
