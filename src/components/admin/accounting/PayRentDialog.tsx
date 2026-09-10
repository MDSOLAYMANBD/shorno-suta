import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useAccounts } from '@/hooks/useAccounting';
import { useAllocateRentPayment, useRentUnitSummary } from '@/hooks/useRent';
import { toLocalDateStr } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unitId: string | null;
  unitName?: string;
  rentAmount?: number;
  rentStartDate?: string | null;
}

export default function PayRentDialog({ open, onOpenChange, unitId, unitName, rentAmount, rentStartDate }: Props) {
  const { data: accounts = [] } = useAccounts();
  const allocate = useAllocateRentPayment();
  const summary = useRentUnitSummary(unitId || undefined, rentAmount, rentStartDate);
  const due = summary.totalDue;

  const [form, setForm] = useState({ amount: '', payment_date: toLocalDateStr(), account_id: '', note: '' });

  useEffect(() => {
    if (open) {
      setForm({
        amount: due > 0 ? String(due) : '',
        payment_date: toLocalDateStr(),
        account_id: accounts[0]?.id || '',
        note: '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, unitId, due]);

  const handlePay = async () => {
    if (!unitId) return;
    const amt = Number(form.amount);
    if (!amt || amt <= 0) { toast.error('পরিমাণ দিন'); return; }
    if (!form.payment_date) { toast.error('তারিখ দিন'); return; }
    if (!form.account_id) { toast.error('অ্যাকাউন্ট নির্বাচন করুন'); return; }
    try {
      const result = await allocate.mutateAsync({
        unit_id: unitId, amount: amt, account_id: form.account_id,
        payment_date: form.payment_date, note: form.note || undefined,
      });
      toast.success(`পরিশোধ হয়েছে — ${result.appliedTo.join(', ')}`);
      onOpenChange(false);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>ভাড়া পরিশোধ {unitName ? `— ${unitName}` : ''}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-xs bg-muted/50 rounded p-2">
            <div><div className="text-muted-foreground">মোট বকেয়া</div><div className="font-bold">৳{summary.totalOwed.toLocaleString('bn-BD')}</div></div>
            <div><div className="text-muted-foreground">পরিশোধিত</div><div className="font-bold text-green-700">৳{summary.totalPaid.toLocaleString('bn-BD')}</div></div>
            <div><div className="text-muted-foreground">বাকি</div><div className="font-bold text-destructive">৳{due.toLocaleString('bn-BD')}</div></div>
          </div>
          <div className="text-[11px] text-muted-foreground">
            যত টাকাই দিন, সবচেয়ে পুরনো বকেয়া মাস থেকে শুরু করে মিলিয়ে দেওয়া হবে — কোন মাসের জন্য দিচ্ছেন তা বেছে নেওয়ার দরকার নেই।
            সব বকেয়ার চেয়ে বেশি দিলে বাকি টাকা পরবর্তী মাসের অগ্রিম হিসেবে জমা হবে।
          </div>
          <div>
            <Label>পরিমাণ (৳)</Label>
            <Input
              type="number"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              placeholder={due > 0 ? `বাকি ৳${due.toLocaleString('bn-BD')}` : 'অগ্রিম দিতে চাইলে অংক দিন'}
            />
            <div className="flex gap-1 mt-1 flex-wrap">
              {[500, 1000, 5000, 10000].map(v => (
                <Button key={v} type="button" size="sm" variant="outline" className="h-6 text-[10px]"
                  onClick={() => setForm(f => ({ ...f, amount: String(v) }))}>৳{v.toLocaleString('bn-BD')}</Button>
              ))}
              {due > 0 && (
                <Button type="button" size="sm" variant="outline" className="h-6 text-[10px]"
                  onClick={() => setForm(f => ({ ...f, amount: String(due) }))}>সম্পূর্ণ</Button>
              )}
            </div>
          </div>
          <div>
            <Label>তারিখ</Label>
            <Input type="date" value={form.payment_date} onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))} />
          </div>
          <div>
            <Label>অ্যাকাউন্ট</Label>
            <Select value={form.account_id} onValueChange={v => setForm(f => ({ ...f, account_id: v }))}>
              <SelectTrigger><SelectValue placeholder="অ্যাকাউন্ট নির্বাচন করুন" /></SelectTrigger>
              <SelectContent>
                {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name} — ৳{Number(a.balance).toLocaleString('bn-BD')}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>নোট</Label>
            <Input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="ঐচ্ছিক নোট" />
          </div>
          <Button onClick={handlePay} disabled={allocate.isPending} className="w-full">
            {allocate.isPending ? 'পরিশোধ হচ্ছে...' : 'পরিশোধ করুন'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
