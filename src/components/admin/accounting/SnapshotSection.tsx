import { useState } from 'react';
import { useSnapshots, useCreateSnapshot, useDeleteSnapshot } from '@/hooks/useSnapshots';
import { usePersons } from '@/hooks/usePersons';
import { useLoans, useAllLoanPaymentCounts } from '@/hooks/useLoans';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Scale, Plus, Trash2, TrendingUp, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { toLocalDateStr } from '@/lib/utils';

const MANUAL = '__manual__';

type StockRow = { product_name: string; quantity: string; unit_price: string };
type PartyRow = { person_id: string; party_name: string; amount: string };
type LoanRow = { loan_id: string; loan_name: string; amount: string };

const emptyStock: StockRow = { product_name: '', quantity: '', unit_price: '' };
const emptyParty: PartyRow = { person_id: MANUAL, party_name: '', amount: '' };
const emptyLoanRow: LoanRow = { loan_id: MANUAL, loan_name: '', amount: '' };

export default function SnapshotSection() {
  const { data: snapshots = [] } = useSnapshots();
  const createSnapshot = useCreateSnapshot();
  const deleteSnapshot = useDeleteSnapshot();
  const { data: persons = [] } = usePersons();
  const { data: loans = [] } = useLoans({ unitId: null });
  const { data: loanPaymentCounts = {} } = useAllLoanPaymentCounts();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [snapshotDate, setSnapshotDate] = useState(toLocalDateStr());
  const [label, setLabel] = useState('');
  const [cashAmount, setCashAmount] = useState('');
  const [bankAmount, setBankAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [stockRows, setStockRows] = useState<StockRow[]>([{ ...emptyStock }]);
  const [partyRows, setPartyRows] = useState<PartyRow[]>([{ ...emptyParty }]);
  const [loanRows, setLoanRows] = useState<LoanRow[]>([{ ...emptyLoanRow }]);

  const resetForm = () => {
    setSnapshotDate(toLocalDateStr());
    setLabel('');
    setCashAmount('');
    setBankAmount('');
    setNotes('');
    setStockRows([{ ...emptyStock }]);
    setPartyRows([{ ...emptyParty }]);
    setLoanRows([{ ...emptyLoanRow }]);
  };

  const outstandingForLoan = (loanId: string) => {
    const loan = loans.find(l => l.id === loanId);
    if (!loan) return 0;
    const paid = loanPaymentCounts[loanId]?.totalPaid || 0;
    return Math.max(0, Number(loan.principal_amount) - paid);
  };

  const handleLoanSelect = (index: number, loanId: string) => {
    setLoanRows(rows => rows.map((r, i) => {
      if (i !== index) return r;
      if (loanId === MANUAL) return { loan_id: MANUAL, loan_name: '', amount: r.amount };
      const loan = loans.find(l => l.id === loanId);
      return { loan_id: loanId, loan_name: loan?.name || '', amount: String(outstandingForLoan(loanId)) };
    }));
  };

  const handlePartySelect = (index: number, personId: string) => {
    setPartyRows(rows => rows.map((r, i) => {
      if (i !== index) return r;
      if (personId === MANUAL) return { person_id: MANUAL, party_name: '', amount: r.amount };
      const person = persons.find(p => p.id === personId);
      return { person_id: personId, party_name: person?.name || '', amount: r.amount };
    }));
  };

  const handleCreate = async () => {
    if (!label.trim()) { toast.error('একটা নাম দিন (যেমন: ব্যবসা শুরু)'); return; }
    try {
      await createSnapshot.mutateAsync({
        snapshot_date: snapshotDate,
        label: label.trim(),
        cash_amount: Number(cashAmount) || 0,
        bank_amount: Number(bankAmount) || 0,
        notes: notes.trim() || undefined,
        stock_items: stockRows
          .filter(r => r.product_name.trim())
          .map(r => ({ product_name: r.product_name.trim(), quantity: Number(r.quantity) || 0, unit_price: Number(r.unit_price) || 0 })),
        party_dues: partyRows
          .filter(r => r.party_name.trim())
          .map(r => ({ person_id: r.person_id === MANUAL ? null : r.person_id, party_name: r.party_name.trim(), amount: Number(r.amount) || 0 })),
        loan_dues: loanRows
          .filter(r => r.loan_name.trim())
          .map(r => ({ loan_id: r.loan_id === MANUAL ? null : r.loan_id, loan_name: r.loan_name.trim(), amount: Number(r.amount) || 0 })),
      });
      toast.success('হিসাব মিলান সেভ হয়েছে');
      setDialogOpen(false);
      resetForm();
    } catch (e: any) {
      toast.error(e.message || 'সেভ করা যায়নি');
    }
  };

  const fmt = (n: number) => `৳${n.toLocaleString('bn-BD')}`;

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
          <p className="text-xs text-muted-foreground text-center py-4">এখনো কোনো হিসাব মিলান নেই। শুরুর তারিখ দিয়ে প্রথমটা যোগ করুন।</p>
        ) : (
          <div className="space-y-2">
            {snapshots.map(s => {
              const expanded = expandedId === s.id;
              return (
                <div key={s.id} className="rounded-lg border border-border overflow-hidden">
                  <button type="button" className="w-full flex items-center justify-between p-2.5 text-left hover:bg-muted/50" onClick={() => setExpandedId(expanded ? null : s.id)}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold truncate">{s.label}</span>
                        <Badge variant="outline" className="text-[10px]">{new Date(s.snapshot_date).toLocaleDateString('bn-BD')}</Badge>
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
                      {s.notes && <div className="text-muted-foreground italic">{s.notes}</div>}
                      <Button
                        size="sm" variant="ghost"
                        className="w-full text-red-600 hover:text-red-700 h-7 text-xs mt-1"
                        onClick={() => {
                          if (!confirm('এই হিসাব মিলানটা ডিলিট করবেন?')) return;
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

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>নতুন হিসাব মিলান</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">তারিখ</Label><Input type="date" value={snapshotDate} onChange={e => setSnapshotDate(e.target.value)} /></div>
              <div><Label className="text-xs">নাম</Label><Input value={label} onChange={e => setLabel(e.target.value)} placeholder="যেমন: ব্যবসা শুরু" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">ক্যাশ (৳)</Label><Input type="number" value={cashAmount} onChange={e => setCashAmount(e.target.value)} placeholder="0" /></div>
              <div><Label className="text-xs">ব্যাংক (৳)</Label><Input type="number" value={bankAmount} onChange={e => setBankAmount(e.target.value)} placeholder="0" /></div>
            </div>

            {/* Stock items */}
            <div>
              <Label className="text-xs font-semibold">স্টক (প্রতিটা প্রোডাক্ট আলাদা লাইনে)</Label>
              <div className="space-y-2 mt-1.5">
                {stockRows.map((row, i) => (
                  <div key={i} className="flex gap-1.5 items-start">
                    <Input className="flex-1" placeholder="পণ্যের নাম" value={row.product_name} onChange={e => setStockRows(rows => rows.map((r, ri) => ri === i ? { ...r, product_name: e.target.value } : r))} />
                    <Input className="w-16" type="number" placeholder="পিস" value={row.quantity} onChange={e => setStockRows(rows => rows.map((r, ri) => ri === i ? { ...r, quantity: e.target.value } : r))} />
                    <Input className="w-20" type="number" placeholder="দাম/পিস" value={row.unit_price} onChange={e => setStockRows(rows => rows.map((r, ri) => ri === i ? { ...r, unit_price: e.target.value } : r))} />
                    <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-red-600" onClick={() => setStockRows(rows => rows.filter((_, ri) => ri !== i))} disabled={stockRows.length === 1}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" className="w-full mt-2 h-7 text-xs" onClick={() => setStockRows(rows => [...rows, { ...emptyStock }])}>
                <Plus className="h-3 w-3 mr-1" /> পণ্য যোগ করুন
              </Button>
            </div>

            {/* Party dues */}
            <div>
              <Label className="text-xs font-semibold">পার্টি-দেনা (যাদের টাকা দিতে হবে)</Label>
              <div className="space-y-2 mt-1.5">
                {partyRows.map((row, i) => (
                  <div key={i} className="flex gap-1.5 items-start">
                    <Select value={row.person_id} onValueChange={v => handlePartySelect(i, v)}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="পার্টি বাছাই করুন" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={MANUAL}>➕ অন্য পার্টি (নাম লিখুন)</SelectItem>
                        {persons.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {row.person_id === MANUAL && (
                      <Input className="flex-1" placeholder="পার্টির নাম" value={row.party_name} onChange={e => setPartyRows(rows => rows.map((r, ri) => ri === i ? { ...r, party_name: e.target.value } : r))} />
                    )}
                    <Input className="w-24" type="number" placeholder="টাকা" value={row.amount} onChange={e => setPartyRows(rows => rows.map((r, ri) => ri === i ? { ...r, amount: e.target.value } : r))} />
                    <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-red-600" onClick={() => setPartyRows(rows => rows.filter((_, ri) => ri !== i))} disabled={partyRows.length === 1}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" className="w-full mt-2 h-7 text-xs" onClick={() => setPartyRows(rows => [...rows, { ...emptyParty }])}>
                <Plus className="h-3 w-3 mr-1" /> পার্টি যোগ করুন
              </Button>
            </div>

            {/* Loan dues */}
            <div>
              <Label className="text-xs font-semibold">ঋণ</Label>
              <div className="space-y-2 mt-1.5">
                {loanRows.map((row, i) => (
                  <div key={i} className="flex gap-1.5 items-start">
                    <Select value={row.loan_id} onValueChange={v => handleLoanSelect(i, v)}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="ঋণ বাছাই করুন" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={MANUAL}>➕ অন্য ঋণ (নাম লিখুন)</SelectItem>
                        {loans.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {row.loan_id === MANUAL && (
                      <Input className="flex-1" placeholder="ঋণের নাম" value={row.loan_name} onChange={e => setLoanRows(rows => rows.map((r, ri) => ri === i ? { ...r, loan_name: e.target.value } : r))} />
                    )}
                    <Input className="w-24" type="number" placeholder="টাকা" value={row.amount} onChange={e => setLoanRows(rows => rows.map((r, ri) => ri === i ? { ...r, amount: e.target.value } : r))} />
                    <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-red-600" onClick={() => setLoanRows(rows => rows.filter((_, ri) => ri !== i))} disabled={loanRows.length === 1}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">বিদ্যমান ঋণ বাছাই করলে বকেয়া টাকা automatic বসে যাবে, চাইলে বদলাতে পারবেন।</p>
              <Button variant="outline" size="sm" className="w-full mt-2 h-7 text-xs" onClick={() => setLoanRows(rows => [...rows, { ...emptyLoanRow }])}>
                <Plus className="h-3 w-3 mr-1" /> ঋণ যোগ করুন
              </Button>
            </div>

            <div><Label className="text-xs">নোট (ঐচ্ছিক)</Label><Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} className="text-xs" /></div>

            <Button onClick={handleCreate} disabled={createSnapshot.isPending} className="w-full">
              {createSnapshot.isPending ? 'সেভ হচ্ছে...' : 'হিসাব মিলান সেভ করুন'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
