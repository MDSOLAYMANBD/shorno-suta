import { useState } from 'react';
import { useSnapshots, useStartNewSnapshot, useDeleteSnapshot } from '@/hooks/useSnapshots';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Scale, Plus, Trash2, TrendingUp, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { toLocalDateStr } from '@/lib/utils';

const fmt = (n: number) => `৳${n.toLocaleString('bn-BD')}`;

export default function SnapshotHistorySection() {
  const { data: snapshots = [] } = useSnapshots();
  const startNew = useStartNewSnapshot();
  const deleteSnapshot = useDeleteSnapshot();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [snapshotDate, setSnapshotDate] = useState(toLocalDateStr());
  const [label, setLabel] = useState('');

  const handleStart = async () => {
    if (!label.trim()) { toast.error('একটা নাম দিন (যেমন: ব্যবসা শুরু)'); return; }
    try {
      await startNew.mutateAsync({ snapshot_date: snapshotDate, label: label.trim() });
      toast.success('নতুন হিসাব মিলান শুরু হয়েছে — এখন উপরের "মূলধন ও বিনিয়োগ" সেকশনে যা যোগ/পরিবর্তন করবে তা এই নতুন হিসাবে যাবে');
      setDialogOpen(false);
      setLabel('');
      setSnapshotDate(toLocalDateStr());
    } catch (e: any) {
      toast.error(e.message || 'শুরু করা যায়নি');
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Scale className="h-4 w-4 text-purple-600" /> হিসাব মিলান
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)} className="h-7 text-xs">
            <Plus className="h-3 w-3 mr-1" /> নতুন মিলান
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {snapshots.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">এখনো কোনো হিসাব মিলান নেই। উপরে "মূলধন ও বিনিয়োগ"-এ স্টক/পার্টি/ঋণ যোগ করলে প্রথমটা automatic তৈরি হয়ে যাবে — পরে বছর শেষে বা ঈদে তুলনা করতে চাইলে এখান থেকে "নতুন মিলান" দিয়ে দ্বিতীয়টা শুরু করো।</p>
        ) : (
          <div className="space-y-2">
            {[...snapshots].reverse().map(s => {
              const expanded = expandedId === s.id;
              const isLatest = s.id === snapshots[snapshots.length - 1].id;
              return (
                <div key={s.id} className="rounded-lg border border-border overflow-hidden">
                  <button type="button" className="w-full flex items-center justify-between p-2.5 text-left hover:bg-muted/50" onClick={() => setExpandedId(expanded ? null : s.id)}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold truncate">{s.label}</span>
                        <Badge variant="outline" className="text-[10px]">{new Date(s.snapshot_date).toLocaleDateString('bn-BD')}</Badge>
                        {isLatest && <Badge className="text-[10px] bg-purple-500/15 text-purple-700 hover:bg-purple-500/15">চলমান</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">নীট সম্পদ: <span className="font-medium text-foreground">{fmt(s.net_worth)}</span></div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {s.profit_loss !== null && (
                        <Badge className={s.profit_loss >= 0 ? 'bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15' : 'bg-red-500/15 text-red-700 hover:bg-red-500/15'}>
                          {s.profit_loss >= 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                          {s.profit_loss >= 0 ? 'লাভ ' : 'লস '}{fmt(Math.abs(s.profit_loss))}
                        </Badge>
                      )}
                      {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </button>
                  {expanded && (
                    <div className="p-2.5 pt-0 space-y-2 text-xs border-t border-border">
                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <div className="rounded bg-muted/50 p-2"><div className="text-muted-foreground">ক্যাশ</div><div className="font-medium">{fmt(s.cash_amount)}</div></div>
                        <div className="rounded bg-muted/50 p-2"><div className="text-muted-foreground">ব্যাংক</div><div className="font-medium">{fmt(s.bank_amount)}</div></div>
                        <div className="rounded bg-muted/50 p-2"><div className="text-muted-foreground">স্টক মূল্য ({s.stock_items.length} পণ্য)</div><div className="font-medium">{fmt(s.stock_value)}</div></div>
                        <div className="rounded bg-muted/50 p-2"><div className="text-muted-foreground">মোট দেনা</div><div className="font-medium text-red-600">{fmt(s.total_party_dues + s.total_loan_dues)}</div></div>
                      </div>
                      {s.party_dues.length > 0 && (
                        <div>
                          <div className="font-medium text-muted-foreground mb-1">পার্টি-দেনা</div>
                          {s.party_dues.map(d => <div key={d.id} className="flex justify-between py-0.5"><span>{d.party_name}</span><span>{fmt(Number(d.amount))}</span></div>)}
                        </div>
                      )}
                      {s.loan_dues.length > 0 && (
                        <div>
                          <div className="font-medium text-muted-foreground mb-1">ঋণ</div>
                          {s.loan_dues.map(d => <div key={d.id} className="flex justify-between py-0.5"><span>{d.loan_name}</span><span>{fmt(Number(d.amount))}</span></div>)}
                        </div>
                      )}
                      {isLatest && (
                        <p className="text-[11px] text-muted-foreground italic">এটাই এখন "চলমান" হিসাব — উপরে "মূলধন ও বিনিয়োগ" সেকশন থেকে এডিট/যোগ করা যাবে।</p>
                      )}
                      <Button
                        size="sm" variant="ghost"
                        className="w-full text-red-600 hover:text-red-700 h-7 text-xs mt-1"
                        onClick={() => {
                          if (!confirm('এই হিসাব মিলানটা ডিলিট করবেন? এর সব স্টক/পার্টি/ঋণ তথ্যও মুছে যাবে।')) return;
                          deleteSnapshot.mutate(s.id, { onSuccess: () => toast.success('ডিলিট হয়েছে') });
                        }}
                      >
                        <Trash2 className="h-3 w-3 mr-1" /> ডিলিট করুন
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>নতুন হিসাব মিলান শুরু করুন</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">তারিখ</Label><Input type="date" value={snapshotDate} onChange={e => setSnapshotDate(e.target.value)} /></div>
            <div><Label className="text-xs">নাম</Label><Input value={label} onChange={e => setLabel(e.target.value)} placeholder="যেমন: ব্যবসা শুরু, ঈদ ২০২৭ মিলান" /></div>
            <p className="text-[11px] text-muted-foreground">শুরু করার পর উপরে "মূলধন ও বিনিয়োগ" সেকশনে গিয়ে ক্যাশ/ব্যাংক/স্টক/পার্টি-দেনা/ঋণ একটা একটা করে কয়েক দিনে যোগ করতে পারবে।</p>
            <Button onClick={handleStart} disabled={startNew.isPending} className="w-full">
              {startNew.isPending ? 'শুরু হচ্ছে...' : 'শুরু করুন'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
