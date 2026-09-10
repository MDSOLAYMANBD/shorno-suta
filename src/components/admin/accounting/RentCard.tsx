import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Home, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { toLocalDateStr } from '@/lib/utils';
import { useCreateRentIncrement, useRentUnitSummary } from '@/hooks/useRent';

interface Props {
  unitId: string;
  rentAmount: number;
  rentStartDate: string | null;
  onPayClick?: () => void;
}

export default function RentCard({ unitId, rentAmount, rentStartDate, onPayClick }: Props) {
  const summary = useRentUnitSummary(unitId, rentAmount, rentStartDate);
  const createIncrement = useCreateRentIncrement();
  const [incOpen, setIncOpen] = useState(false);
  const [incAdd, setIncAdd] = useState('');
  const [incDate, setIncDate] = useState(toLocalDateStr());
  const [incNote, setIncNote] = useState('');

  const progressPercent = summary.totalOwed > 0 ? Math.min(100, (summary.totalPaid / summary.totalOwed) * 100) : 0;
  const monthsBehind = summary.rows.filter(r => r.due > 0).length;

  const handleSaveIncrement = async () => {
    const add = Number(incAdd);
    if (!add || add <= 0) { toast.error('বাড়ানোর অংক দিন'); return; }
    try {
      await createIncrement.mutateAsync({
        unit_id: unitId, old_amount: rentAmount, new_amount: rentAmount + add,
        effective_date: incDate, note: incNote || undefined,
      });
      toast.success('ভাড়া বাড়ানো হয়েছে');
      setIncOpen(false); setIncAdd(''); setIncNote(''); setIncDate(toLocalDateStr());
    } catch (e: any) { toast.error(e?.message || 'সমস্যা হয়েছে'); }
  };

  return (
    <Card className="border shadow-none">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="font-medium text-sm flex items-center gap-1.5">
            <Home className="h-3.5 w-3.5 text-rose-600" /> ভাড়া
          </div>
          <Popover open={incOpen} onOpenChange={(o) => { setIncOpen(o); if (o) { setIncAdd(''); setIncNote(''); setIncDate(toLocalDateStr()); } }}>
            <PopoverTrigger asChild>
              <button className="text-green-600 hover:text-green-700 text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                + বাড়ান
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-3" align="end">
              <div className="text-xs font-bold text-center border-b pb-1.5 mb-2">─── ভাড়া বাড়ান ───</div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between bg-muted/40 rounded p-2">
                  <span className="text-muted-foreground">বর্তমান ভাড়া</span>
                  <span className="font-bold">৳{rentAmount.toLocaleString('bn-BD')}</span>
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1">কত টাকা বাড়াবেন?</label>
                  <Input type="number" inputMode="numeric" value={incAdd} onChange={e => setIncAdd(e.target.value)} placeholder="যেমন: 1000" className="h-8 text-sm" autoFocus />
                </div>
                <div className="flex justify-between bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded p-2">
                  <span className="text-muted-foreground">নতুন ভাড়া হবে</span>
                  <span className="text-lg font-extrabold text-green-700 dark:text-green-400">
                    ৳{(rentAmount + (Number(incAdd) || 0)).toLocaleString('bn-BD')}
                  </span>
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1">কার্যকর তারিখ (কোন মাস থেকে নতুন ভাড়া প্রযোজ্য)</label>
                  <Input type="date" value={incDate} onChange={e => setIncDate(e.target.value)} className="h-8 text-sm" />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1">নোট (ঐচ্ছিক)</label>
                  <Input value={incNote} onChange={e => setIncNote(e.target.value)} placeholder="ঐচ্ছিক" className="h-8 text-sm" />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" className="flex-1 h-8" onClick={() => setIncOpen(false)}>বাতিল</Button>
                  <Button size="sm" className="flex-1 h-8 bg-green-600 hover:bg-green-700" onClick={handleSaveIncrement} disabled={createIncrement.isPending}>
                    ✅ বাড়াও
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="text-xs text-muted-foreground">মাসিক ভাড়া: <span className="font-medium text-foreground">৳{rentAmount.toLocaleString('bn-BD')}</span></div>

        <Progress value={progressPercent} className="h-2" />
        <div className="flex justify-between text-xs">
          <span>৳{summary.totalPaid.toLocaleString('bn-BD')}/৳{summary.totalOwed.toLocaleString('bn-BD')}</span>
          <span className="font-medium text-destructive">বাকি: ৳{summary.totalDue.toLocaleString('bn-BD')}</span>
        </div>
        {monthsBehind > 0 && (
          <div className="text-[10px] text-muted-foreground">{monthsBehind} মাসের ভাড়া বাকি</div>
        )}

        {onPayClick && (
          <Button size="sm" variant="default" className="w-full h-7 text-xs" onClick={onPayClick}>
            <CreditCard className="h-3 w-3 mr-1" /> পরিশোধ করুন
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
