import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useCreateLoanPayment, useLoans, useAllLoanPaymentCounts } from '@/hooks/useLoans';
import { toLocalDateStr } from '@/lib/utils';

interface Account { id: string; name: string; balance: number }

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loanId: string | null;
  defaultAmount?: number;
  accounts: Account[];
}

export default function PayInstallmentDialog({ open, onOpenChange, loanId, accounts }: Props) {
  const createLoanPayment = useCreateLoanPayment();
  const { data: loans = [] } = useLoans();
  const { data: paymentCounts = {} } = useAllLoanPaymentCounts();

  const loan = useMemo(() => loans.find(l => l.id === loanId), [loans, loanId]);
  const totalPaid = loanId ? (paymentCounts[loanId]?.totalPaid || 0) : 0;
  const principal = Number(loan?.principal_amount) || 0;
  const remaining = Math.max(0, principal - totalPaid);

  const [form, setForm] = useState({
    amount: '',
    payment_date: toLocalDateStr(),
    account_id: '',
    note: '',
  });

  useEffect(() => {
    if (open) {
      setForm({
        amount: remaining > 0 ? String(remaining) : '',
        payment_date: toLocalDateStr(),
        account_id: accounts[0]?.id || '',
        note: '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loanId, remaining]);

  // Guards against a genuine double-submit (e.g. a fast double-tap on mobile):
  // `disabled={createLoanPayment.isPending}` alone isn't enough, since both
  // clicks can fire before React re-renders the button with the new isPending
  // state — this ref is set synchronously on the very first call, closing
  // that race window. Was causing real duplicate loan-payment rows.
  const isSubmittingRef = useRef(false);

  const handlePay = async () => {
    if (!loanId || isSubmittingRef.current) return;
    const amt = Number(form.amount);
    if (!amt || amt <= 0) { toast.error('পরিমাণ দিন'); return; }
    if (amt > remaining) { toast.error(`সর্বোচ্চ ৳${remaining.toLocaleString('bn-BD')} দিতে পারবেন`); return; }
    if (!form.payment_date) { toast.error('তারিখ দিন'); return; }
    if (!form.account_id) { toast.error('অ্যাকাউন্ট নির্বাচন করুন'); return; }
    const BANK_ID = 'c0831bd8-c223-4663-a051-5b923bdb4256';
    const src = form.account_id === BANK_ID ? 'bank' : 'cash';
    isSubmittingRef.current = true;
    try {
      await createLoanPayment.mutateAsync({
        loan_id: loanId,
        amount: amt,
        payment_date: form.payment_date,
        payment_source: src,
        account_id: form.account_id,
        note: form.note || undefined,
      });
      const newRemaining = remaining - amt;
      toast.success(newRemaining <= 0 ? 'সম্পূর্ণ পরিশোধ হয়েছে — ঋণ সম্পন্ন' : `পরিশোধ হয়েছে — বাকি ৳${newRemaining.toLocaleString('bn-BD')}`);
      onOpenChange(false);
    } catch (e: any) { toast.error(e.message); }
    finally { isSubmittingRef.current = false; }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>ঋণ পরিশোধ {loan ? `— ${loan.name}` : ''}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-xs bg-muted/50 rounded p-2">
            <div><div className="text-muted-foreground">মূলধন</div><div className="font-bold">৳{principal.toLocaleString('bn-BD')}</div></div>
            <div><div className="text-muted-foreground">পরিশোধিত</div><div className="font-bold text-green-700">৳{totalPaid.toLocaleString('bn-BD')}</div></div>
            <div><div className="text-muted-foreground">বাকি</div><div className="font-bold text-destructive">৳{remaining.toLocaleString('bn-BD')}</div></div>
          </div>
          <div>
            <Label>পরিমাণ (৳) — যেকোনো amount দিতে পারবেন</Label>
            <Input
              type="number"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              placeholder={`সর্বোচ্চ ৳${remaining.toLocaleString('bn-BD')}`}
            />
            <div className="flex gap-1 mt-1">
              {[500, 1000, 5000, 10000].filter(v => v <= remaining).map(v => (
                <Button key={v} type="button" size="sm" variant="outline" className="h-6 text-[10px]"
                  onClick={() => setForm(f => ({ ...f, amount: String(v) }))}>৳{v.toLocaleString('bn-BD')}</Button>
              ))}
              {remaining > 0 && (
                <Button type="button" size="sm" variant="outline" className="h-6 text-[10px]"
                  onClick={() => setForm(f => ({ ...f, amount: String(remaining) }))}>সম্পূর্ণ</Button>
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
          <Button onClick={handlePay} disabled={createLoanPayment.isPending || remaining <= 0} className="w-full">
            {createLoanPayment.isPending ? 'পরিশোধ হচ্ছে...' : 'পরিশোধ করুন'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
