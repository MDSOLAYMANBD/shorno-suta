import { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plus, Landmark } from 'lucide-react';
import { toast } from 'sonner';
import { toLocalDateStr } from '@/lib/utils';
import { useUnits } from '@/hooks/useAccounting';
import { useLoans, useCreateLoan, useAllLoanPaymentCounts, useUpdateLoan, useDeleteLoan } from '@/hooks/useLoans';
import { computeAccruedInterest } from '@/lib/loanInterest';
import { useLiveCashBank, CASH_ACCOUNT_ID, BANK_ACCOUNT_ID } from '@/hooks/useLiveCashBank';
import LoanCard from '@/components/admin/accounting/LoanCard';
import PayInstallmentDialog from '@/components/admin/accounting/PayInstallmentDialog';

export default function AdminUnitLoansModule() {
  const { unitId } = useParams<{ unitId: string }>();
  const navigate = useNavigate();
  const { data: units = [] } = useUnits();
  const unit = useMemo(() => units.find(u => u.id === unitId), [units, unitId]);
  const { data: loans = [] } = useLoans({ unitId: unitId || null });
  const { data: paymentCounts = {} } = useAllLoanPaymentCounts();
  const createLoan = useCreateLoan();
  const updateLoan = useUpdateLoan();
  const deleteLoan = useDeleteLoan();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    loan_type: 'bank' as 'bank' | 'person' | 'other',
    lender_name: '',
    principal_amount: '',
    interest_rate: '',
    total_installments: '',
    monthly_installment: '',
    start_date: '',
    deposit_account_id: '',
    interest_type: 'none' as 'none' | 'monthly_flat',
    monthly_interest_amount: '',
  });
  const [payLoanId, setPayLoanId] = useState<string | null>(null);
  const [payDefault, setPayDefault] = useState<number | undefined>();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: liveCB } = useLiveCashBank();
  const depositAccounts = useMemo(() => ([
    { id: CASH_ACCOUNT_ID, name: 'ক্যাশ', balance: liveCB?.cash ?? 0 },
    { id: BANK_ACCOUNT_ID, name: 'ব্যাংক', balance: liveCB?.bank ?? 0 },
  ]), [liveCB?.cash, liveCB?.bank]);

  const totals = useMemo(() => {
    const active = loans.filter(l => l.status === 'active');
    const principal = active.reduce((s, l) => s + Number(l.principal_amount) + computeAccruedInterest(l), 0);
    const paid = loans.reduce((s, l) => s + (paymentCounts[l.id]?.totalPaid || 0), 0);
    const monthlyDue = active.reduce((s, l) => {
      const pc = paymentCounts[l.id]?.count || 0;
      const remaining = Math.max(0, l.total_installments - pc);
      return s + (remaining > 0 ? Number(l.monthly_installment) : 0);
    }, 0);
    return { principal, paid, remaining: Math.max(0, principal - paid), monthlyDue };
  }, [loans, paymentCounts]);

  // Guards against a fast double-click/tap firing this twice before React
  // re-renders the button with isPending=true — disabled alone doesn't close
  // that race. Worse here than a plain duplicate row: each call also deposits
  // the principal into cash/bank, so a double-submit double-credits the
  // account balance too (same class of bug found in PayInstallmentDialog).
  const isCreatingRef = useRef(false);

  const handleCreate = async () => {
    if (isCreatingRef.current) return;
    if (!form.lender_name.trim()) { toast.error('ঋণদাতার নাম দিন'); return; }
    if (!form.principal_amount) { toast.error('মূলধন দিন'); return; }
    if (!form.deposit_account_id) { toast.error('জমা অ্যাকাউন্ট নির্বাচন করুন'); return; }
    isCreatingRef.current = true;
    try {
      await createLoan.mutateAsync({
        name: form.lender_name.trim(),
        principal_amount: Number(form.principal_amount),
        interest_rate: Number(form.interest_rate) || 0,
        total_installments: Number(form.total_installments) || 0,
        monthly_installment: Number(form.monthly_installment) || 0,
        start_date: form.start_date || toLocalDateStr(),
        status: 'active',
        unit_id: unitId,
        loan_type: form.loan_type,
        lender_name: form.lender_name.trim(),
        deposit_account_id: form.deposit_account_id,
        interest_type: form.interest_type,
        monthly_interest_amount: Number(form.monthly_interest_amount) || 0,
      });
      toast.success('ঋণ যোগ হয়েছে — টাকা অ্যাকাউন্টে জমা হয়েছে');
      setDialogOpen(false);
      setForm({ loan_type: 'bank', lender_name: '', principal_amount: '', interest_rate: '', total_installments: '', monthly_installment: '', start_date: '', deposit_account_id: '', interest_type: 'none', monthly_interest_amount: '' });
    } catch (e: any) { toast.error(e.message); }
    finally { isCreatingRef.current = false; }
  };

  return (
    <div className="container mx-auto p-3 sm:p-4 max-w-6xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/accounting/units/${unitId}`)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> ফিরে যান
        </Button>
        <div className="text-sm text-muted-foreground">{unit?.name} — ঋণ / ধার</div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">সক্রিয় মূলধন</div><div className="text-lg font-bold">৳{totals.principal.toLocaleString('bn-BD')}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">মোট পরিশোধ</div><div className="text-lg font-bold text-green-700">৳{totals.paid.toLocaleString('bn-BD')}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">বাকি</div><div className="text-lg font-bold text-destructive">৳{totals.remaining.toLocaleString('bn-BD')}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">মাসিক কিস্তি</div><div className="text-lg font-bold">৳{totals.monthlyDue.toLocaleString('bn-BD')}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Landmark className="h-4 w-4" /> ঋণ তালিকা</CardTitle>
          <Button size="sm" onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-1" /> নতুন ঋণ নিন</Button>
        </CardHeader>
        <CardContent>
          {loans.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">এই ইউনিটে কোনো ঋণ নেই</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {loans.map(loan => (
                <LoanCard
                  key={loan.id}
                  loan={loan as any}
                  paymentCount={paymentCounts[loan.id] || { count: 0, totalPaid: 0 }}
                  expanded={expandedId === loan.id}
                  onPayClick={() => { setPayLoanId(loan.id); setPayDefault(loan.monthly_installment); }}
                  onToggleHistory={() => setExpandedId(expandedId === loan.id ? null : loan.id)}
                  onToggleStatus={() => updateLoan.mutate({ id: loan.id, status: loan.status === 'active' ? 'closed' : 'active' }, {
                    onSuccess: () => toast.success(loan.status === 'active' ? 'বন্ধ করা হয়েছে' : 'চালু করা হয়েছে'),
                  })}
                  onDelete={() => deleteLoan.mutate(loan.id, {
                    onSuccess: () => toast.success('ঋণ ডিলিট হয়েছে'),
                    onError: (e: any) => toast.error(e.message),
                  })}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Loan Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>নতুন ঋণ নিন</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>ঋণের ধরন</Label>
              <RadioGroup value={form.loan_type} onValueChange={(v: any) => setForm(f => ({ ...f, loan_type: v }))} className="flex gap-3 mt-1">
                <label className="flex items-center gap-1.5 text-sm"><RadioGroupItem value="bank" /> ব্যাংক</label>
                <label className="flex items-center gap-1.5 text-sm"><RadioGroupItem value="person" /> ব্যক্তি</label>
                <label className="flex items-center gap-1.5 text-sm"><RadioGroupItem value="other" /> অন্যান্য</label>
              </RadioGroup>
            </div>
            <div>
              <Label>ঋণদাতার নাম</Label>
              <Input value={form.lender_name} onChange={e => setForm(f => ({ ...f, lender_name: e.target.value }))} placeholder={form.loan_type === 'bank' ? 'যেমন: ব্র্যাক ব্যাংক' : form.loan_type === 'person' ? 'যেমন: ওয়ালিদ ভাই' : 'নাম / উৎস'} />
            </div>
            <div>
              <Label>মূলধন (৳)</Label>
              <Input type="number" value={form.principal_amount} onChange={e => setForm(f => ({ ...f, principal_amount: e.target.value }))} />
            </div>
            <div>
              <Label>সুদের ধরন</Label>
              <RadioGroup value={form.interest_type} onValueChange={(v: any) => setForm(f => ({ ...f, interest_type: v }))} className="flex gap-3 mt-1">
                <label className="flex items-center gap-1.5 text-sm"><RadioGroupItem value="none" /> % হারে (বা সুদ নেই)</label>
                <label className="flex items-center gap-1.5 text-sm"><RadioGroupItem value="monthly_flat" /> প্রতি মাসে নির্দিষ্ট টাকা</label>
              </RadioGroup>
            </div>
            {form.interest_type === 'monthly_flat' ? (
              <div>
                <Label>মাসিক সুদ (৳)</Label>
                <Input type="number" value={form.monthly_interest_amount} onChange={e => setForm(f => ({ ...f, monthly_interest_amount: e.target.value }))} placeholder="যেমন: 1500" />
                <p className="text-[11px] text-muted-foreground mt-1">
                  ঋণ নেওয়ার ঠিক এক মাস পর থেকে প্রতি মাসে এই টাকাটা বকেয়ার সাথে যোগ হতে থাকবে, যতদিন না সম্পূর্ণ পরিশোধ হয়।
                </p>
              </div>
            ) : (
              <div>
                <Label>সুদের হার (%)</Label>
                <Input type="number" step="0.01" value={form.interest_rate} onChange={e => setForm(f => ({ ...f, interest_rate: e.target.value }))} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>মোট কিস্তি</Label>
                <Input type="number" value={form.total_installments} onChange={e => setForm(f => ({ ...f, total_installments: e.target.value }))} />
              </div>
              <div>
                <Label>মাসিক কিস্তি (৳)</Label>
                <Input type="number" value={form.monthly_installment} onChange={e => setForm(f => ({ ...f, monthly_installment: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>শুরুর তারিখ</Label>
              <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
            </div>
            <div>
              <Label>জমা অ্যাকাউন্ট <span className="text-destructive">*</span></Label>
              <Select value={form.deposit_account_id} onValueChange={v => setForm(f => ({ ...f, deposit_account_id: v }))}>
                <SelectTrigger><SelectValue placeholder="ক্যাশ / ব্যাংক অ্যাকাউন্ট" /></SelectTrigger>
                <SelectContent>
                  {depositAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} — ৳{Number(a.balance).toLocaleString('bn-BD')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">এই অ্যাকাউন্টে ঋণের টাকা জমা হবে</p>
            </div>
            <Button onClick={handleCreate} disabled={createLoan.isPending} className="w-full">
              {createLoan.isPending ? 'যোগ হচ্ছে...' : 'ঋণ যোগ করুন'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <PayInstallmentDialog
        open={!!payLoanId}
        onOpenChange={(o) => { if (!o) setPayLoanId(null); }}
        loanId={payLoanId}
        defaultAmount={payDefault}
        accounts={depositAccounts as any}
      />
    </div>
  );
}
