import { useState, useMemo, useEffect, useRef } from 'react';
import { useAllSettings } from '@/hooks/useAllSettings';
import { useUpdateSetting } from '@/hooks/useStoreSettings';
import { useLoans, useCreateLoan, useAllLoanPaymentCounts, useInvestments, useCreateInvestment, useStockValuation, useUpdateLoan, useDeleteLoan } from '@/hooks/useLoans';
import { useAccounts } from '@/hooks/useAccounting';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Landmark, Save, TrendingUp, Package, CreditCard, DollarSign } from 'lucide-react';
import { toLocalDateStr } from '@/lib/utils';
import LoanCard from '@/components/admin/accounting/LoanCard';
import PayInstallmentDialog from '@/components/admin/accounting/PayInstallmentDialog';
import SnapshotSection from '@/components/admin/accounting/SnapshotSection';

export default function AdminBusinessAccount() {
  const navigate = useNavigate();
  const { data: allSettings } = useAllSettings();
  const updateSetting = useUpdateSetting();

  const { data: loans = [] } = useLoans({ unitId: null });
  const { data: loanPaymentCounts = {} } = useAllLoanPaymentCounts();
  const createLoan = useCreateLoan();
  const updateLoan = useUpdateLoan();
  const deleteLoan = useDeleteLoan();
  
  const { data: investments = [] } = useInvestments();
  const createInvestment = useCreateInvestment();
  const { data: stockItems = [] } = useStockValuation();
  const { data: accounts = [] } = useAccounts();

  const [loanDialogOpen, setLoanDialogOpen] = useState(false);
  const [loanForm, setLoanForm] = useState({ name: '', principal_amount: '', interest_rate: '', total_installments: '', monthly_installment: '', start_date: '', interest_type: 'none' as 'none' | 'monthly_flat', monthly_interest_amount: '' });
  const [payLoanId, setPayLoanId] = useState<string | null>(null);
  const [payDefaultAmount, setPayDefaultAmount] = useState<number | undefined>();
  const [invForm, setInvForm] = useState({ amount: '', description: '', date: '', source: 'cash' });
  const [expandedLoanId, setExpandedLoanId] = useState<string | null>(null);

  type BusinessConfig = { opening_balance_cash: number; opening_balance_bank: number; initial_stock_value: number; stock_note: string };
  const [bizConfig, setBizConfig] = useState<BusinessConfig>({ opening_balance_cash: 0, opening_balance_bank: 0, initial_stock_value: 0, stock_note: '' });
  const [bizDirty, setBizDirty] = useState(false);

  useEffect(() => {
    if (allSettings?.acc_business_config) {
      try {
        const parsed = JSON.parse(allSettings.acc_business_config);
        // Backward compat: migrate old opening_balance to cash
        const cash = parsed.opening_balance_cash ?? parsed.opening_balance ?? 0;
        const bank = parsed.opening_balance_bank ?? 0;
        setBizConfig({ opening_balance_cash: cash, opening_balance_bank: bank, initial_stock_value: parsed.initial_stock_value || 0, stock_note: parsed.stock_note || '' });
      } catch { /* ignore */ }
    }
  }, [allSettings?.acc_business_config]);

  const handleSaveBizConfig = async () => {
    try {
      await updateSetting.mutateAsync({ key: 'acc_business_config', value: JSON.stringify(bizConfig) });
      toast.success('সেভ হয়েছে');
      setBizDirty(false);
    } catch (e: any) { toast.error(e.message); }
  };

  const updateBiz = (patch: Partial<BusinessConfig>) => { setBizConfig(prev => ({ ...prev, ...patch })); setBizDirty(true); };

  const totalStockValue = useMemo(() => stockItems.reduce((s, p) => s + (p.stock * p.price), 0), [stockItems]);
  const totalStockCost = useMemo(() => stockItems.reduce((s, p: any) => s + (p.stock * (p.cost_price || 0)), 0), [stockItems]);
  const totalInvestment = useMemo(() => investments.reduce((s, i) => s + Number(i.amount), 0), [investments]);
  const totalLoanPrincipal = useMemo(() => loans.filter(l => l.status === 'active').reduce((s, l) => s + Number(l.principal_amount), 0), [loans]);
  const totalCapital = bizConfig.opening_balance_cash + bizConfig.opening_balance_bank + totalInvestment;

  // Guards against a fast double-click/tap firing this twice before React
  // re-renders the button with isPending=true — disabled alone doesn't close
  // that race (same class of bug found in PayInstallmentDialog: it created
  // duplicate loan-payment rows there, duplicate loans here).
  const isCreatingLoanRef = useRef(false);

  const handleCreateLoan = async () => {
    if (isCreatingLoanRef.current) return;
    if (!loanForm.name.trim() || !loanForm.principal_amount) { toast.error('নাম ও মূলধন দিন'); return; }
    isCreatingLoanRef.current = true;
    try {
      await createLoan.mutateAsync({
        name: loanForm.name, principal_amount: Number(loanForm.principal_amount),
        interest_rate: Number(loanForm.interest_rate) || 0, total_installments: Number(loanForm.total_installments) || 0,
        monthly_installment: Number(loanForm.monthly_installment) || 0, start_date: loanForm.start_date || toLocalDateStr(),
        status: 'active',
        interest_type: loanForm.interest_type,
        monthly_interest_amount: Number(loanForm.monthly_interest_amount) || 0,
      });
      toast.success('লোন যোগ হয়েছে');
      setLoanDialogOpen(false);
      setLoanForm({ name: '', principal_amount: '', interest_rate: '', total_installments: '', monthly_installment: '', start_date: '', interest_type: 'none', monthly_interest_amount: '' });
    } catch (e: any) { toast.error(e.message); }
    finally { isCreatingLoanRef.current = false; }
  };


  const handleAddInvestment = async () => {
    if (!invForm.amount) { toast.error('পরিমাণ দিন'); return; }
    try {
      await createInvestment.mutateAsync({
        amount: Number(invForm.amount), description: invForm.description,
        date: invForm.date || toLocalDateStr(), source: invForm.source,
      });
      toast.success('বিনিয়োগ যোগ হয়েছে');
      setInvForm({ amount: '', description: '', date: '', source: 'cash' });
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Landmark className="h-5 w-5" /> ব্যবসায়িক হিসাব
        </h1>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="bg-emerald-500/10 border-emerald-500/20">
          <CardContent className="p-3 text-center">
            <DollarSign className="h-5 w-5 mx-auto text-emerald-600 mb-1" />
            <div className="text-[10px] text-muted-foreground">মূলধন</div>
            <div className="text-sm font-bold text-emerald-700">৳{totalCapital.toLocaleString('bn-BD')}</div>
          </CardContent>
        </Card>
        <Card className="bg-orange-500/10 border-orange-500/20">
          <CardContent className="p-3 text-center">
            <CreditCard className="h-5 w-5 mx-auto text-orange-600 mb-1" />
            <div className="text-[10px] text-muted-foreground">সক্রিয় ঋণ</div>
            <div className="text-sm font-bold text-orange-700">৳{totalLoanPrincipal.toLocaleString('bn-BD')}</div>
          </CardContent>
        </Card>
        <Card className="bg-blue-500/10 border-blue-500/20">
          <CardContent className="p-3 text-center">
            <Package className="h-5 w-5 mx-auto text-blue-600 mb-1" />
            <div className="text-[10px] text-muted-foreground">শুরুর স্টক মূল্য</div>
            <div className="text-sm font-bold text-blue-700">৳{(bizConfig.initial_stock_value || 0).toLocaleString('bn-BD')}</div>
          </CardContent>
        </Card>
      </div>

      {/* ===== মূলধন ও বিনিয়োগ ===== */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-600" /> মূলধন ও বিনিয়োগ
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">ক্যাশ মূলধন (৳)</Label>
              <Input type="number" value={bizConfig.opening_balance_cash || ''} onChange={e => updateBiz({ opening_balance_cash: Number(e.target.value) || 0 })} placeholder="0" />
            </div>
            <div>
              <Label className="text-xs">ব্যাংক মূলধন (৳)</Label>
              <Input type="number" value={bizConfig.opening_balance_bank || ''} onChange={e => updateBiz({ opening_balance_bank: Number(e.target.value) || 0 })} placeholder="0" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">শুরুর স্টক মূল্য (৳)</Label>
              <Input type="number" value={bizConfig.initial_stock_value || ''} onChange={e => updateBiz({ initial_stock_value: Number(e.target.value) || 0 })} placeholder="0" />
            </div>
          </div>
          <div>
            <Label className="text-xs">স্টক নোট (কতো পিস প্রোডাক্ট আছে ইত্যাদি)</Label>
            <Textarea value={bizConfig.stock_note || ''} onChange={e => updateBiz({ stock_note: e.target.value })} placeholder="যেমন: ৫০ পিস শার্ট, ৩০ পিস প্যান্ট..." rows={2} className="text-xs" />
          </div>
          {bizDirty && (
            <Button onClick={handleSaveBizConfig} disabled={updateSetting.isPending} size="sm" className="w-full">
              <Save className="h-4 w-4 mr-1" /> {updateSetting.isPending ? 'সেভ হচ্ছে...' : 'সেভ করুন'}
            </Button>
          )}

          {/* Investment list */}
          <div className="border-t border-border pt-3">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-semibold">বিনিয়োগ হিস্টোরি</Label>
              <span className="text-xs font-bold text-primary">মোট: ৳{totalInvestment.toLocaleString('bn-BD')}</span>
            </div>
            {investments.length > 0 && (
              <div className="space-y-1 mb-3 max-h-40 overflow-y-auto">
                {investments.map(inv => (
                  <div key={inv.id} className="flex justify-between text-xs py-1.5 px-2 rounded bg-muted/50">
                    <span>{new Date(inv.date).toLocaleDateString('bn-BD')}</span>
                    <span className="flex-1 min-w-0 mx-2 truncate text-muted-foreground">{inv.description || '-'}</span>
                    <Badge variant="outline" className="text-[10px] mr-1">{inv.source}</Badge>
                    <span className="font-medium">৳{Number(inv.amount).toLocaleString('bn-BD')}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" placeholder="পরিমাণ (৳)" value={invForm.amount} onChange={e => setInvForm(f => ({ ...f, amount: e.target.value }))} />
              <Input placeholder="বিবরণ" value={invForm.description} onChange={e => setInvForm(f => ({ ...f, description: e.target.value }))} />
              <Input type="date" value={invForm.date} onChange={e => setInvForm(f => ({ ...f, date: e.target.value }))} />
              <Select value={invForm.source} onValueChange={v => setInvForm(f => ({ ...f, source: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">ক্যাশ</SelectItem>
                  <SelectItem value="bank">ব্যাংক</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={handleAddInvestment} disabled={createInvestment.isPending} className="w-full mt-2">
              <Plus className="h-3.5 w-3.5 mr-1" /> বিনিয়োগ যোগ করুন
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ===== ঋণ ব্যবস্থাপনা ===== */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-orange-600" /> ঋণ ব্যবস্থাপনা
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => setLoanDialogOpen(true)} className="h-7 text-xs">
              <Plus className="h-3 w-3 mr-1" /> নতুন ঋণ
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loans.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">কোনো ঋণ নেই</p>
          ) : (
            <div className="space-y-3">
              {loans.map(loan => (
                <LoanCard
                  key={loan.id}
                  loan={loan as any}
                  paymentCount={loanPaymentCounts[loan.id] || { count: 0, totalPaid: 0 }}
                  expanded={expandedLoanId === loan.id}
                  onPayClick={() => { setPayLoanId(loan.id); setPayDefaultAmount(loan.monthly_installment); }}
                  onToggleHistory={() => setExpandedLoanId(expandedLoanId === loan.id ? null : loan.id)}
                  onToggleStatus={() => updateLoan.mutate({ id: loan.id, status: loan.status === 'active' ? 'closed' : 'active' }, {
                    onSuccess: () => toast.success(loan.status === 'active' ? 'ঋণ বন্ধ করা হয়েছে' : 'ঋণ চালু করা হয়েছে'),
                  })}
                  onDelete={() => deleteLoan.mutate(loan.id, {
                    onSuccess: () => toast.success('ঋণ ডিলিট হয়েছে'),
                    onError: (e: any) => toast.error(e?.message || 'ডিলিট করা যায়নি'),
                  })}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== স্টক ভ্যালুয়েশন ===== */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4 text-blue-600" /> স্টক ভ্যালুয়েশন
            </CardTitle>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-muted-foreground">কেনা: <span className="font-bold text-orange-600">৳{totalStockCost.toLocaleString('bn-BD')}</span></span>
              <span className="text-muted-foreground">বিক্রয়: <span className="font-bold text-primary">৳{totalStockValue.toLocaleString('bn-BD')}</span></span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {stockItems.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">স্টকে কোনো পণ্য নেই</p>
          ) : (
            <div className="max-h-[300px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">পণ্য</TableHead>
                    <TableHead className="text-xs text-right">স্টক</TableHead>
                    <TableHead className="text-xs text-right">কেনা দাম</TableHead>
                    <TableHead className="text-xs text-right">মোট কেনা</TableHead>
                    <TableHead className="text-xs text-right">দাম</TableHead>
                    <TableHead className="text-xs text-right">মোট</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockItems.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs font-medium py-1.5">{p.name}</TableCell>
                      <TableCell className="text-xs text-right py-1.5">{p.stock}</TableCell>
                      <TableCell className="text-xs text-right py-1.5 text-orange-700">৳{Number(p.cost_price || 0).toLocaleString('bn-BD')}</TableCell>
                      <TableCell className="text-xs text-right py-1.5 font-medium text-orange-700">৳{(p.stock * Number(p.cost_price || 0)).toLocaleString('bn-BD')}</TableCell>
                      <TableCell className="text-xs text-right py-1.5">৳{p.price.toLocaleString('bn-BD')}</TableCell>
                      <TableCell className="text-xs text-right py-1.5 font-medium">৳{(p.stock * p.price).toLocaleString('bn-BD')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== হিসাব মিলান ===== */}
      <SnapshotSection />

      {/* New Loan Dialog */}
      <Dialog open={loanDialogOpen} onOpenChange={setLoanDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>নতুন ঋণ / লোন</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>ঋণের নাম</Label><Input value={loanForm.name} onChange={e => setLoanForm(f => ({ ...f, name: e.target.value }))} placeholder="যেমন: ব্যাংক লোন" /></div>
            <div><Label>মূলধন (৳)</Label><Input type="number" value={loanForm.principal_amount} onChange={e => setLoanForm(f => ({ ...f, principal_amount: e.target.value }))} /></div>
            <div>
              <Label>সুদের ধরন</Label>
              <RadioGroup value={loanForm.interest_type} onValueChange={(v: any) => setLoanForm(f => ({ ...f, interest_type: v }))} className="flex gap-3 mt-1">
                <label className="flex items-center gap-1.5 text-sm"><RadioGroupItem value="none" /> % হারে (বা সুদ নেই)</label>
                <label className="flex items-center gap-1.5 text-sm"><RadioGroupItem value="monthly_flat" /> প্রতি মাসে নির্দিষ্ট টাকা</label>
              </RadioGroup>
            </div>
            {loanForm.interest_type === 'monthly_flat' ? (
              <div>
                <Label>মাসিক সুদ (৳)</Label>
                <Input type="number" value={loanForm.monthly_interest_amount} onChange={e => setLoanForm(f => ({ ...f, monthly_interest_amount: e.target.value }))} placeholder="যেমন: 1500" />
                <p className="text-[11px] text-muted-foreground mt-1">
                  ঋণ নেওয়ার ঠিক এক মাস পর থেকে প্রতি মাসে এই টাকাটা বকেয়ার সাথে যোগ হতে থাকবে, যতদিন না সম্পূর্ণ পরিশোধ হয়।
                </p>
              </div>
            ) : (
              <div><Label>সুদের হার (%)</Label><Input type="number" step="0.01" value={loanForm.interest_rate} onChange={e => setLoanForm(f => ({ ...f, interest_rate: e.target.value }))} /></div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div><Label>মোট কিস্তি সংখ্যা</Label><Input type="number" value={loanForm.total_installments} onChange={e => setLoanForm(f => ({ ...f, total_installments: e.target.value }))} /></div>
              <div><Label>মাসিক কিস্তি (৳)</Label><Input type="number" value={loanForm.monthly_installment} onChange={e => setLoanForm(f => ({ ...f, monthly_installment: e.target.value }))} /></div>
            </div>
            <div><Label>কিস্তি শুরুর তারিখ</Label><Input type="date" value={loanForm.start_date} onChange={e => setLoanForm(f => ({ ...f, start_date: e.target.value }))} /></div>
            <Button onClick={handleCreateLoan} disabled={createLoan.isPending} className="w-full">
              {createLoan.isPending ? 'সেভ হচ্ছে...' : 'লোন যোগ করুন'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <PayInstallmentDialog
        open={!!payLoanId}
        onOpenChange={open => !open && setPayLoanId(null)}
        loanId={payLoanId}
        defaultAmount={payDefaultAmount}
        accounts={accounts as any}
      />
    </div>
  );
}
