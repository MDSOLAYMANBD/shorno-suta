import { useState } from 'react';
import {
  useLatestSnapshot, useStartNewSnapshot, useAddStockItem, useUpdateStockItem, useDeleteStockItem,
  useAddPartyDue, useUpdatePartyDue, useDeletePartyDue,
  useAddLoanDue, useUpdateLoanDue, useDeleteLoanDue,
  type AccSnapshotStockItem, type AccSnapshotPartyDue, type AccSnapshotLoanDue,
} from '@/hooks/useSnapshots';
import { usePersons } from '@/hooks/usePersons';
import { useLoans, useAllLoanPaymentCounts } from '@/hooks/useLoans';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Pencil, Check, X, Package, Users, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { toLocalDateStr } from '@/lib/utils';

const MANUAL = '__manual__';
const fmt = (n: number) => `৳${n.toLocaleString('bn-BD')}`;

// ===================== Stock =====================

function StockRow({ item }: { item: AccSnapshotStockItem }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ product_name: item.product_name, quantity: String(item.quantity), unit_price: String(item.unit_price) });
  const update = useUpdateStockItem();
  const del = useDeleteStockItem();

  if (editing) {
    return (
      <div className="flex gap-1.5 items-center py-1">
        <Input className="flex-1 h-8 text-xs" value={draft.product_name} onChange={e => setDraft(d => ({ ...d, product_name: e.target.value }))} />
        <Input className="w-14 h-8 text-xs" type="number" value={draft.quantity} onChange={e => setDraft(d => ({ ...d, quantity: e.target.value }))} />
        <Input className="w-20 h-8 text-xs" type="number" value={draft.unit_price} onChange={e => setDraft(d => ({ ...d, unit_price: e.target.value }))} />
        <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600" onClick={() => {
          update.mutate({ id: item.id, product_name: draft.product_name.trim(), quantity: Number(draft.quantity) || 0, unit_price: Number(draft.unit_price) || 0 }, { onSuccess: () => setEditing(false) });
        }}><Check className="h-3.5 w-3.5" /></Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(false)}><X className="h-3.5 w-3.5" /></Button>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between py-1 text-xs">
      <span className="flex-1 min-w-0 truncate">{item.product_name}</span>
      <span className="text-muted-foreground w-20 text-right shrink-0">{item.quantity} × {fmt(item.unit_price)}</span>
      <span className="w-20 text-right font-medium shrink-0">{fmt(item.quantity * item.unit_price)}</span>
      <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => setEditing(true)}><Pencil className="h-3 w-3" /></Button>
      <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-red-600" onClick={() => del.mutate(item.id)}><Trash2 className="h-3 w-3" /></Button>
    </div>
  );
}

function AddStockRow({ snapshotId, ensureSnapshotId }: { snapshotId?: string; ensureSnapshotId: () => Promise<string> }) {
  const [form, setForm] = useState({ product_name: '', quantity: '', unit_price: '' });
  const add = useAddStockItem();
  const submit = async () => {
    if (!form.product_name.trim()) { toast.error('পণ্যের নাম দিন'); return; }
    const id = snapshotId ?? await ensureSnapshotId();
    add.mutate({ snapshot_id: id, product_name: form.product_name.trim(), quantity: Number(form.quantity) || 0, unit_price: Number(form.unit_price) || 0 }, {
      onSuccess: () => setForm({ product_name: '', quantity: '', unit_price: '' }),
    });
  };
  return (
    <div className="flex gap-1.5 items-center pt-1.5 border-t border-border/60 mt-1">
      <Input className="flex-1 h-8 text-xs" placeholder="পণ্যের নাম" value={form.product_name} onChange={e => setForm(f => ({ ...f, product_name: e.target.value }))} />
      <Input className="w-14 h-8 text-xs" type="number" placeholder="পিস" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
      <Input className="w-20 h-8 text-xs" type="number" placeholder="দাম/পিস" value={form.unit_price} onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))} />
      <Button size="icon" className="h-8 w-8 shrink-0" onClick={submit} disabled={add.isPending}><Plus className="h-3.5 w-3.5" /></Button>
    </div>
  );
}

// ===================== Party dues =====================

function PartyRow({ row }: { row: AccSnapshotPartyDue }) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(row.amount));
  const update = useUpdatePartyDue();
  const del = useDeletePartyDue();

  if (editing) {
    return (
      <div className="flex gap-1.5 items-center py-1">
        <span className="flex-1 min-w-0 truncate text-xs">{row.party_name}</span>
        <Input className="w-24 h-8 text-xs" type="number" value={amount} onChange={e => setAmount(e.target.value)} />
        <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600" onClick={() => update.mutate({ id: row.id, amount: Number(amount) || 0 }, { onSuccess: () => setEditing(false) })}><Check className="h-3.5 w-3.5" /></Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(false)}><X className="h-3.5 w-3.5" /></Button>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between py-1 text-xs">
      <span className="flex-1 min-w-0 truncate">{row.party_name}</span>
      <span className="w-24 text-right font-medium shrink-0">{fmt(row.amount)}</span>
      <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => setEditing(true)}><Pencil className="h-3 w-3" /></Button>
      <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-red-600" onClick={() => del.mutate(row.id)}><Trash2 className="h-3 w-3" /></Button>
    </div>
  );
}

function AddPartyRow({ snapshotId, ensureSnapshotId }: { snapshotId?: string; ensureSnapshotId: () => Promise<string> }) {
  const { data: persons = [] } = usePersons();
  const [personId, setPersonId] = useState(MANUAL);
  const [partyName, setPartyName] = useState('');
  const [amount, setAmount] = useState('');
  const add = useAddPartyDue();

  const onPersonSelect = (v: string) => {
    setPersonId(v);
    if (v !== MANUAL) setPartyName(persons.find(p => p.id === v)?.name || '');
    else setPartyName('');
  };

  const submit = async () => {
    if (!partyName.trim()) { toast.error('পার্টির নাম দিন'); return; }
    const id = snapshotId ?? await ensureSnapshotId();
    add.mutate({ snapshot_id: id, person_id: personId === MANUAL ? null : personId, party_name: partyName.trim(), amount: Number(amount) || 0 }, {
      onSuccess: () => { setPersonId(MANUAL); setPartyName(''); setAmount(''); },
    });
  };

  return (
    <div className="flex gap-1.5 items-center pt-1.5 border-t border-border/60 mt-1">
      <Select value={personId} onValueChange={onPersonSelect}>
        <SelectTrigger className="flex-1 h-8 text-xs"><SelectValue placeholder="পার্টি বাছাই" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={MANUAL}>➕ অন্য পার্টি (নাম লিখুন)</SelectItem>
          {persons.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
        </SelectContent>
      </Select>
      {personId === MANUAL && <Input className="flex-1 h-8 text-xs" placeholder="পার্টির নাম" value={partyName} onChange={e => setPartyName(e.target.value)} />}
      <Input className="w-24 h-8 text-xs" type="number" placeholder="টাকা" value={amount} onChange={e => setAmount(e.target.value)} />
      <Button size="icon" className="h-8 w-8 shrink-0" onClick={submit} disabled={add.isPending}><Plus className="h-3.5 w-3.5" /></Button>
    </div>
  );
}

// ===================== Loan dues =====================

function LoanRow({ row }: { row: AccSnapshotLoanDue }) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(row.amount));
  const update = useUpdateLoanDue();
  const del = useDeleteLoanDue();

  if (editing) {
    return (
      <div className="flex gap-1.5 items-center py-1">
        <span className="flex-1 min-w-0 truncate text-xs">{row.loan_name}</span>
        <Input className="w-24 h-8 text-xs" type="number" value={amount} onChange={e => setAmount(e.target.value)} />
        <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600" onClick={() => update.mutate({ id: row.id, amount: Number(amount) || 0 }, { onSuccess: () => setEditing(false) })}><Check className="h-3.5 w-3.5" /></Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(false)}><X className="h-3.5 w-3.5" /></Button>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between py-1 text-xs">
      <span className="flex-1 min-w-0 truncate">{row.loan_name}</span>
      <span className="w-24 text-right font-medium shrink-0">{fmt(row.amount)}</span>
      <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => setEditing(true)}><Pencil className="h-3 w-3" /></Button>
      <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-red-600" onClick={() => del.mutate(row.id)}><Trash2 className="h-3 w-3" /></Button>
    </div>
  );
}

function AddLoanRow({ snapshotId, ensureSnapshotId }: { snapshotId?: string; ensureSnapshotId: () => Promise<string> }) {
  const { data: loans = [] } = useLoans({ unitId: null });
  const { data: loanPaymentCounts = {} } = useAllLoanPaymentCounts();
  const [loanId, setLoanId] = useState(MANUAL);
  const [loanName, setLoanName] = useState('');
  const [amount, setAmount] = useState('');
  const add = useAddLoanDue();

  const onLoanSelect = (v: string) => {
    setLoanId(v);
    if (v === MANUAL) { setLoanName(''); return; }
    const loan = loans.find(l => l.id === v);
    const paid = loanPaymentCounts[v]?.totalPaid || 0;
    setLoanName(loan?.name || '');
    setAmount(String(Math.max(0, Number(loan?.principal_amount || 0) - paid)));
  };

  const submit = async () => {
    if (!loanName.trim()) { toast.error('ঋণের নাম দিন'); return; }
    const id = snapshotId ?? await ensureSnapshotId();
    add.mutate({ snapshot_id: id, loan_id: loanId === MANUAL ? null : loanId, loan_name: loanName.trim(), amount: Number(amount) || 0 }, {
      onSuccess: () => { setLoanId(MANUAL); setLoanName(''); setAmount(''); },
    });
  };

  return (
    <div className="flex gap-1.5 items-center pt-1.5 border-t border-border/60 mt-1">
      <Select value={loanId} onValueChange={onLoanSelect}>
        <SelectTrigger className="flex-1 h-8 text-xs"><SelectValue placeholder="ঋণ বাছাই" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={MANUAL}>➕ অন্য ঋণ (নাম লিখুন)</SelectItem>
          {loans.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
        </SelectContent>
      </Select>
      {loanId === MANUAL && <Input className="flex-1 h-8 text-xs" placeholder="ঋণের নাম" value={loanName} onChange={e => setLoanName(e.target.value)} />}
      <Input className="w-24 h-8 text-xs" type="number" placeholder="টাকা" value={amount} onChange={e => setAmount(e.target.value)} />
      <Button size="icon" className="h-8 w-8 shrink-0" onClick={submit} disabled={add.isPending}><Plus className="h-3.5 w-3.5" /></Button>
    </div>
  );
}

// ===================== Main section =====================

export default function CurrentCapitalSection({ pendingCash = 0, pendingBank = 0 }: { pendingCash?: number; pendingBank?: number }) {
  const { data: latest, isLoading } = useLatestSnapshot();
  const startNew = useStartNewSnapshot();

  if (isLoading) return null;

  // No হিসাব মিলান entry exists yet — the first item added here creates
  // one transparently (labeled "ব্যবসা শুরু"), seeded with whatever cash/bank
  // is currently set above, so there's no separate "start" step before you
  // can record your starting stock/dues.
  const ensureSnapshotId = async (): Promise<string> => {
    const created = await startNew.mutateAsync({ snapshot_date: toLocalDateStr(), label: 'ব্যবসা শুরু', cash_amount: pendingCash, bank_amount: pendingBank });
    return created.id;
  };

  const stockItems = latest?.stock_items ?? [];
  const partyDues = latest?.party_dues ?? [];
  const loanDues = latest?.loan_dues ?? [];
  const stockValue = latest?.stock_value ?? 0;
  const netWorth = latest?.net_worth ?? 0;

  return (
    <div className="space-y-4 border-t border-border pt-3">
      {latest ? (
        <p className="text-[11px] text-muted-foreground -mt-1">সর্বশেষ হিসাব: <span className="font-medium text-foreground">{latest.label}</span> ({new Date(latest.snapshot_date).toLocaleDateString('bn-BD')}) — এখানে যা যোগ করবে তা সাথে সাথে সেভ হয়ে যাবে, একদিনে সব দিতে হবে না।</p>
      ) : (
        <p className="text-[11px] text-muted-foreground -mt-1">নিচে স্টক/পার্টি-দেনা/ঋণ যোগ করা শুরু করো — যা যা দেবে তা সাথে সাথে সেভ হয়ে যাবে, একদিনে সব দিতে হবে না।</p>
      )}

      {/* Stock */}
      <div>
        <Label className="text-xs font-semibold flex items-center gap-1.5"><Package className="h-3.5 w-3.5 text-blue-600" /> স্টক (প্রতিটা প্রোডাক্ট আলাদা লাইনে)</Label>
        <div className="mt-1.5">
          {stockItems.map(item => <StockRow key={item.id} item={item} />)}
          <AddStockRow snapshotId={latest?.id} ensureSnapshotId={ensureSnapshotId} />
        </div>
        {stockItems.length > 0 && <p className="text-[11px] text-right text-muted-foreground mt-1">মোট স্টক মূল্য: <span className="font-medium text-foreground">{fmt(stockValue)}</span></p>}
      </div>

      {/* Party dues */}
      <div>
        <Label className="text-xs font-semibold flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-orange-600" /> পার্টি-দেনা (যাদের টাকা দিতে হবে)</Label>
        <div className="mt-1.5">
          {partyDues.map(row => <PartyRow key={row.id} row={row} />)}
          <AddPartyRow snapshotId={latest?.id} ensureSnapshotId={ensureSnapshotId} />
        </div>
      </div>

      {/* Loan dues */}
      <div>
        <Label className="text-xs font-semibold flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5 text-red-600" /> ঋণ</Label>
        <div className="mt-1.5">
          {loanDues.map(row => <LoanRow key={row.id} row={row} />)}
          <AddLoanRow snapshotId={latest?.id} ensureSnapshotId={ensureSnapshotId} />
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">বিদ্যমান ঋণ বাছাই করলে বকেয়া টাকা automatic বসে যাবে, চাইলে বদলাতে পারবেন।</p>
      </div>

      <div className="rounded bg-purple-500/10 p-2.5 flex items-center justify-between text-xs">
        <span className="font-medium">নীট সম্পদ (মূলধন)</span>
        <span className="font-bold text-purple-700">{fmt(netWorth)}</span>
      </div>
    </div>
  );
}
