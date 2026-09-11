import { useParams, useNavigate } from 'react-router-dom';
import AccountingShareButton from '@/components/admin/AccountingShareButton';
import SalesPartyPaymentDialog from '@/components/admin/SalesPartyPaymentDialog';
import { Textarea } from '@/components/ui/textarea';
import { logAccActivity } from '@/hooks/useAccActivityLog';
import { usePerson, usePersons, useUpdatePerson } from '@/hooks/usePersons';
import { useTransactions, useAccounts, useUnits, useDeleteTransaction, useUnitInternalSettlement } from '@/hooks/useAccounting';
import { usePersonAttendance, useMarkAttendance } from '@/hooks/useAttendance';
import { isSalaryMonthBeforeJoining, useSalaryIncrements, usePersonFinancialSummary, useMonthlySalarySummary, useGenerateSalary, useSalaryRecords, useCreateIncrement, useUpdateIncrement, useDeleteIncrement, useUpdateSalaryRecord, usePersonPastStints, allocatePaymentToSalaryRecords, type PersonPastStint } from '@/hooks/useSalary';
import { usePartyEntries, useCreatePartyEntry, useUpdatePartyEntry, useDeletePartyEntry, useProductionEntries, useCreateProductionEntry, useUpdateProductionEntry, useDeleteProductionEntry } from '@/hooks/useProductionEntries';
import { useLoanPayments, useUpdateLoan, useDeleteLoan, useAllLoanPaymentCounts, useDeleteLoanPayment } from '@/hooks/useLoans';
import LoanCard from '@/components/admin/accounting/LoanCard';
import PayInstallmentDialog from '@/components/admin/accounting/PayInstallmentDialog';
import { WorkOrderContent } from '@/components/admin/WorkOrderSection';
import { useWorkOrders } from '@/hooks/useWorkOrders';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSiteConfig, DEFAULT_NAVBAR_CONFIG } from '@/hooks/useSiteConfig';
import { Card, CardContent } from '@/components/ui/card';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format, differenceInMonths, differenceInYears, eachDayOfInterval, isFriday, parseISO, getDay, differenceInMinutes, getDaysInMonth } from 'date-fns';
import { bn } from 'date-fns/locale';
import { ArrowUpRight, ArrowDownRight, Plus, ArrowLeft, Printer, Pencil, Trash2, ChevronLeft, ChevronRight, ClipboardList, CalendarIcon, Clock, Settings2, Package, Receipt, Home, Landmark, Phone, Copy, Send } from 'lucide-react';
import { sendPartyLedgerSMS } from '@/lib/sms';
import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { toLocalDateStr } from '@/lib/utils';
import { openSalarySlip } from '@/lib/salaryPrint';
import { calculateMonthlySalary, salaryFormulaFinal } from '@/lib/salaryMath';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';

const dayNamesBn: Record<number, string> = {
  0: 'রবিবার', 1: 'সোমবার', 2: 'মঙ্গলবার', 3: 'বুধবার', 4: 'বৃহস্পতিবার', 5: 'শুক্রবার', 6: 'শনিবার',
};

const txTypeLabel: Record<string, string> = {
  sale: 'বিক্রয়', salary: 'বেতন', production_payment: 'প্রোডাকশন পেমেন্ট',
  party_payment: 'পার্টি পেমেন্ট', courier_withdrawal: 'কুরিয়ার উত্তোলন',
  expense: 'খরচ', adjustment: 'সমন্বয়', deposit: 'জমা', advance: 'অ্যাডভান্স', bonus: 'বোনাস',
};

const monthNames: Record<number, string> = {
  1: 'জানুয়ারি', 2: 'ফেব্রুয়ারি', 3: 'মার্চ', 4: 'এপ্রিল',
  5: 'মে', 6: 'জুন', 7: 'জুলাই', 8: 'আগস্ট',
  9: 'সেপ্টেম্বর', 10: 'অক্টোবর', 11: 'নভেম্বর', 12: 'ডিসেম্বর',
};

function getWorkDuration(joiningDate: string | null): string {
  if (!joiningDate) return '—';
  const start = new Date(joiningDate);
  const now = new Date();
  const years = differenceInYears(now, start);
  const months = differenceInMonths(now, start) % 12;
  if (years > 0 && months > 0) return `${years} বছর ${months} মাস`;
  if (years > 0) return `${years} বছর`;
  if (months > 0) return `${months} মাস`;
  return 'সদ্য যোগদান';
}

const typeLabel: Record<string, string> = {
  employee: 'কর্মচারী', salaried_production: 'কর্মচারী (প্রোডাকশন)', production_staff: 'প্রোডাকশন স্টাফ', party: 'পার্টি', supplier: 'সাপ্লায়ার',
  sales_party: 'বিক্রি পার্টি', work_party: 'কাজ পার্টি', loan_kisti: 'ঋণ কিস্তি',
};

const statusLabel: Record<string, string> = {
  present: 'উপস্থিত', absent: 'অনুপস্থিত', off_day: 'ছুটি', late: 'লেট',
};

// ========== UNIT COLOR MAPPING ==========
function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 65%, 45%)`;
}

function getUnitStyle(unitId: string | null, unitName?: string | null): { color: string; label: string } {
  const name = (unitName || '').toLowerCase();
  if (name.includes('অফিস') || name.includes('office')) return { color: '#16a34a', label: unitName || 'অফিস' };
  if (name.includes('সাপ্লায়ার') || name.includes('supplier')) return { color: '#ea580c', label: unitName || 'সাপ্লায়ার' };
  if (name.includes('সেউইং') || name.includes('কারখানা') || name.includes('factory') || name.includes('sewing')) return { color: '#6B1E2B', label: unitName || 'সেউইং ফ্যাক্টরি' };
  if (name.includes('print') || name.includes('প্রিন্ট')) return { color: '#7c3aed', label: unitName || 'Print' };
  return { color: hashColor(unitName || 'unit'), label: unitName || 'Staff' };
}

// ========== BRANDED HEADER ==========
function BrandedHeader({ person, actions }: { person: any; actions?: React.ReactNode }) {
  const { data: navbarConfig } = useSiteConfig('navbar_config');
  const merged = { ...DEFAULT_NAVBAR_CONFIG, ...(navbarConfig || {}) };
  const logoUrl = merged.logo_url;
  const unitStyle = getUnitStyle(person.unit_id, person.acc_units?.name);

  const typeLabel: Record<string, string> = {
    party: 'পার্টি', employee: 'কর্মচারী', supplier: 'সরবরাহকারী', production: 'প্রোডাকশন',
    salaried_production: 'কর্মচারী (প্রোডাকশন)', production_staff: 'প্রোডাকশন স্টাফ',
    sales_party: 'বিক্রি পার্টি', work_party: 'কাজ পার্টি', loan_kisti: 'ঋণ কিস্তি',
  };

  return (
    <div
      className="rounded-t-xl overflow-hidden"
      style={{ borderTop: `4px solid ${unitStyle.color}`, background: `linear-gradient(135deg, ${unitStyle.color}18 0%, ${unitStyle.color}05 100%)` }}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" className="h-9 w-9 rounded-full object-cover border-2 shadow-sm" style={{ borderColor: unitStyle.color }} />
        ) : (
          <div className="h-9 w-9 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm" style={{ backgroundColor: unitStyle.color }}>S</div>
        )}
          <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold truncate" style={{ color: unitStyle.color }}>{person.name}</h1>
            {person.person_code && (
              <span className="text-[10px] font-mono font-bold bg-muted px-1.5 py-0.5 rounded-full whitespace-nowrap">{person.person_code}</span>
            )}
            <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full whitespace-nowrap">{typeLabel[person.type] || person.type}</span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
            <span className="text-[9px] uppercase tracking-wider font-medium opacity-70">{unitStyle.label}</span>
            {person.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" /> {person.phone}
                <button
                  type="button"
                  onClick={() => { navigator.clipboard.writeText(person.phone); toast.success('নম্বর কপি হয়েছে'); }}
                  className="p-0.5 rounded hover:bg-muted"
                  title="নম্বর কপি করুন"
                >
                  <Copy className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
}

// ========== TOOLBAR (Back + Share + Print) ==========
function ProfileToolbar({ personId, personName, personCode }: { personId?: string; personName?: string; personCode?: string | null }) {
  const navigate = useNavigate();
  const slug = personCode?.trim() || personId || '';
  return (
    <div className="flex items-center justify-between mb-3 print:hidden">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
        <ArrowLeft className="h-4 w-4 mr-1" /> পেছনে যান
      </Button>
      <div className="flex items-center gap-2">
        {slug && personName && (
          <AccountingShareButton entityType="person" entityId={slug} entityName={personName} />
        )}
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-1" /> প্রিন্ট
        </Button>
      </div>
    </div>
  );
}

// ========== PARTY / SUPPLIER VIEW ==========
// Only mounted for a unit's designated internal work sheet — keeps the usePersons(unit_id)
// fetch scoped to that case instead of running on every ordinary party/sales_party profile.
function InternalWorkOrdersSection({ unitId }: { unitId: string }) {
  const { data: unitPersons = [] } = usePersons({ unit_id: unitId });
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold flex items-center gap-1.5">📦 কাজের অর্ডার (উৎপাদন ট্র্যাকিং)</h3>
      <WorkOrderContent unitId={unitId} persons={unitPersons} showFinancials={false} showCompletion={false} />
    </div>
  );
}

function PartyProfileView({ person, id, direction = 'purchase' }: { person: any; id: string; direction?: 'purchase' | 'sales' }) {
  const { data: entries = [] } = usePartyEntries(id);
  const { data: accounts = [] } = useAccounts();
  const { data: units = [] } = useUnits();
  const personUnit = units.find((u: any) => u.id === person.unit_id);
  const isInternalWorkSheet = !!person.unit_id && (personUnit?.settings as any)?.internal_work_party_id === person.id;
  // Not every internal work sheet uses acc_work_orders — এম্ব্রয়ডারি still logs its work as plain
  // memo entries (see 20260820150000 migration). Only গate the কাজের-অর্ডার UI on units that
  // actually opted into the order engine; the settlement card above is unit-agnostic either way.
  const usesWorkOrders = isInternalWorkSheet && !!(personUnit?.settings as any)?.internal_work_uses_orders;
  const { data: settlement } = useUnitInternalSettlement(
    isInternalWorkSheet ? person.unit_id : undefined,
    isInternalWorkSheet ? person.id : undefined,
  );
  const settlementAmount = isInternalWorkSheet ? (settlement?.settlementAmount || 0) : 0;
  const { data: expenseTxns = [] } = useQuery({
    queryKey: ['person-expense-txns', id],
    queryFn: async () => {
      const { data, error } = await (supabase.from('acc_transactions' as any) as any)
        .select('id, amount, description, created_at, type, account_id, source')
        .eq('person_id', id)
        .in('type', ['expense', 'salary', 'advance', 'bonus', 'party_payment', 'production_payment', 'deposit'])
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as { id: string; amount: number; description: string | null; created_at: string; type: string; account_id: string; source: string | null }[];
    },
  });
  const createEntry = useCreatePartyEntry();
  const updateEntry = useUpdatePartyEntry();
  const deleteEntry = useDeletePartyEntry();
  const deleteTx = useDeleteTransaction();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [editPaymentTx, setEditPaymentTx] = useState<any>(null);
  const [smsOpen, setSmsOpen] = useState(false);
  const [smsMessage, setSmsMessage] = useState('');
  const [smsSending, setSmsSending] = useState(false);

  const handleDeletePaymentTx = (tx: { id: string; amount: number; account_id: string; description: string | null; source: string | null }) => {
    if (!confirm('এই জমা এন্ট্রি ডিলিট করবেন? একাউন্ট ব্যালেন্স থেকেও বাদ যাবে।')) return;
    deleteTx.mutate({
      id: tx.id, account_id: tx.account_id, type: 'deposit', amount: tx.amount,
      description: tx.description, person_id: id, source: tx.source, person_name: person.name,
    }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ['person-expense-txns', id] });
        toast.success('এন্ট্রি ডিলিট হয়েছে');
      },
      onError: (e: any) => toast.error(e?.message || 'ডিলিট করতে সমস্যা হয়েছে'),
    });
  };
  const emptyItem = { product_name: '', quantity: '', rate: '' };
  const [form, setForm] = useState({ memo_number: '', date: toLocalDateStr(), items: [{ ...emptyItem }], total: '', is_submission: false });
  const [editForm, setEditForm] = useState({ memo_number: '', date: '', product_name: '', quantity: '', rate: '', total: '', is_submission: false });

  const calcItemTotal = (item: { quantity: string; rate: string }) => {
    const q = Number(item.quantity) || 0;
    const r = Number(item.rate) || 0;
    return q * r;
  };
  const calcGrandTotal = form.items.reduce((s, item) => s + calcItemTotal(item), 0);
  const calcGrandQty = form.items.reduce((s, item) => s + (parseFloat(item.quantity) || 0), 0);

  const updateItem = (idx: number, field: string, value: string) => {
    setForm(f => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [field]: value };
      return { ...f, items };
    });
  };
  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { ...emptyItem }] }));
  const removeItem = (idx: number) => setForm(f => ({ ...f, items: f.items.length > 1 ? f.items.filter((_, i) => i !== idx) : f.items }));

  // Merge party entries with expense transactions for unified ledger
  const mergedEntries = useMemo(() => {
    const partyItems = entries.map(e => ({
      ...e,
      _source: 'party' as const,
      _sortDate: new Date(e.date + 'T' + (e.created_at ? new Date(e.created_at).toISOString().slice(11) : '00:00:00')).getTime(),
    }));
    const expenseItems = expenseTxns.map(tx => ({
      id: tx.id,
      person_id: id,
      memo_number: null as string | null,
      date: toLocalDateStr(tx.created_at),
      product_name: tx.description || 'খরচ',
      quantity: null as number | null,
      rate: null as number | null,
      total: Number(tx.amount),
      is_submission: true,
      created_at: tx.created_at,
      _source: 'expense' as const,
      _sortDate: new Date(tx.created_at).getTime(),
      _txType: tx.type,
      _accountId: tx.account_id,
      _txSource: tx.source,
    }));
    return [...partyItems, ...expenseItems].sort((a, b) => b._sortDate - a._sortDate);
  }, [entries, expenseTxns, id]);

  // Compute running totals in chronological order (oldest first), then keep display order (newest first)
  const chronological = [...mergedEntries].reverse(); // oldest first
  let runningBill = 0;
  let runningPaid = 0;
  const runningMap = new Map<string, { runningBill: number; runningPaid: number }>();
  chronological.forEach(e => {
    if (e.is_submission) runningPaid += e.total;
    else runningBill += e.total;
    runningMap.set(e.id, { runningBill, runningPaid });
  });
  const enriched = mergedEntries.map(e => ({ ...e, ...runningMap.get(e.id)!, }));

  const isWorkParty = person.type === 'work_party';
  const partyLabel = isWorkParty ? 'কাজ পার্টি' : 'বিক্রি পার্টি';
  const totalLabel = isWorkParty ? 'মোট কাজ' : 'মোট বিক্রি';

  const totalBill = runningBill;
  const totalPaid = runningPaid;
  // For an order-based internal work sheet (কারখানা/প্রিন্ট), the real "billed" total lives in
  // acc_work_orders, not plain memo entries — but a memo-based one (এম্ব্রয়ডারি) has none of those
  // rows, so summing both is safe: whichever source a unit actually uses is the only one with
  // non-zero numbers.
  const { data: internalWorkOrders = [] } = useWorkOrders(isInternalWorkSheet ? person.unit_id : undefined);
  const internalWorkValue = isInternalWorkSheet
    ? internalWorkOrders.reduce((s, o) => s + o.total_quantity * (o.pricing || 0), 0)
    : 0;
  const displayBill = totalBill + internalWorkValue;
  // For the unit's own internal work sheet, "paid" additionally includes the derived settlement —
  // the real জমা history/table below stays untouched, only these summary figures fold it in.
  const displayPaid = totalPaid + settlementAmount;
  const displayDue = displayBill - totalPaid - settlementAmount;
  const totalQty = mergedEntries.filter(e => !e.is_submission && e._source === 'party').reduce((s, e) => s + (e.quantity || 0), 0);
  const internalWorkQty = isInternalWorkSheet ? internalWorkOrders.reduce((s, o) => s + o.total_quantity, 0) : 0;
  const displayQty = totalQty + internalWorkQty;

  // Manual "send account summary" SMS — unlike the auto-SMS on জমা (which
  // fires immediately since a single payment is unambiguous), work/memo
  // entries often come in batches (multiple items per pickup), so this is a
  // deliberate, reviewable send: opens with a pre-filled total-summary
  // message the admin can edit before actually sending.
  const openSmsDialog = () => {
    const lines = [
      `${person.name}, আপনার হালনাগাদ হিসাব:`,
      `মোট পরিমাণ: ${displayQty.toLocaleString('bn-BD')}`,
      `${direction === 'sales' ? totalLabel : 'মোট বিল'}: ৳${displayBill.toLocaleString('bn-BD')}`,
      `${direction === 'sales' ? 'তারা দিল' : 'জমা'}: ৳${displayPaid.toLocaleString('bn-BD')}`,
      `${direction === 'sales' ? 'পাওনা (তারা দিবে)' : 'বাকি'}: ৳${displayDue.toLocaleString('bn-BD')}`,
      '— স্বর্ণ সুতা',
    ];
    setSmsMessage(lines.join('\n'));
    setSmsOpen(true);
  };

  const handleSendSms = async () => {
    if (!person.phone) { toast.error('এই পার্টির কোনো ফোন নম্বর নেই'); return; }
    if (!smsMessage.trim()) { toast.error('মেসেজ খালি রাখা যাবে না'); return; }
    setSmsSending(true);
    try {
      const { data, error } = await sendPartyLedgerSMS(person.phone, smsMessage.trim());
      if (error || !(data as any)?.success) throw new Error((data as any)?.error || error?.message || 'SMS পাঠানো ব্যর্থ');
      toast.success('SMS পাঠানো হয়েছে');
      setSmsOpen(false);
    } catch (e: any) {
      toast.error(e?.message || 'SMS পাঠানো ব্যর্থ');
    } finally {
      setSmsSending(false);
    }
  };

  const handleSubmit = async () => {
    if (form.is_submission) {
      const total = Number(form.total) || 0;
      createEntry.mutate({
        person_id: id,
        memo_number: null,
        date: form.date,
        product_name: 'Submission',
        quantity: null, rate: null, total,
        is_submission: true,
      }, {
        onSuccess: async () => {
          if (total > 0) {
            try {
              const defaultAccount = accounts[0];
              if (defaultAccount) {
                const { data: { session } } = await supabase.auth.getSession();
                await supabase.from('acc_transactions' as any).insert({
                  account_id: defaultAccount.id,
                  person_id: id,
                  type: 'party_payment',
                  amount: total,
                  description: `পার্টি পেমেন্ট - ${person.name}`,
                  created_by: session?.user?.id,
                } as any);
                const newBalance = Number(defaultAccount.balance) - total;
                await supabase.from('acc_accounts' as any).update({ balance: newBalance } as any).eq('id', defaultAccount.id);
                qc.invalidateQueries({ queryKey: ['acc-accounts'] });
                qc.invalidateQueries({ queryKey: ['acc-transactions'] });
                qc.invalidateQueries({ queryKey: ['acc-transactions-paginated'] });
                qc.invalidateQueries({ queryKey: ['acc-transaction-summary'] });
              }
            } catch (e) { console.error('Dual-write failed:', e); }

            // Auto-SMS the party the moment a payment is recorded, same as
            // SalesPartyPaymentDialog does for the sales-direction flow.
            if (person.phone) {
              const msg = `${person.name}, আপনাকে ৳${total.toLocaleString('bn-BD')} জমা/পেমেন্ট দেওয়া হয়েছে (${form.date}) — স্বর্ণ সুতা`;
              sendPartyLedgerSMS(person.phone, msg).catch((e) => console.error('[PartyProfileView] SMS failed', e));
            }
          }
          setOpen(false);
          setForm({ memo_number: '', date: toLocalDateStr(), items: [{ ...emptyItem }], total: '', is_submission: false });
          toast.success('এন্ট্রি যোগ হয়েছে');
        },
        onError: () => toast.error('এন্ট্রি যোগ করতে সমস্যা হয়েছে'),
      });
      return;
    }

    // Multi-item: batch insert all items directly via Supabase
    const validItems = form.items.filter(item => item.product_name.trim());
    if (validItems.length === 0) { toast.error('অন্তত একটি আইটেম যোগ করুন'); return; }

    const manualTotal = form.total ? Number(form.total) : null;
    const rows = validItems.map((item, idx) => {
      const qty = Number(item.quantity) || null;
      const rate = Number(item.rate) || null;
      const lineTotal = (Number(item.quantity) || 0) * (Number(item.rate) || 0);
      return {
        person_id: id,
        memo_number: form.memo_number || null,
        date: form.date,
        product_name: item.product_name,
        quantity: qty,
        rate,
        total: lineTotal,
        is_submission: false,
      };
    });

    // If manual total override, adjust last item's total so sum matches
    if (manualTotal !== null && rows.length > 0) {
      const currentSum = rows.reduce((s, r) => s + r.total, 0);
      const diff = manualTotal - currentSum;
      rows[rows.length - 1].total += diff;
    }

    const { error } = await supabase.from('acc_party_entries' as any).insert(rows as any);
    if (error) { toast.error('এন্ট্রি যোগ করতে সমস্যা হয়েছে'); console.error(error); return; }

    qc.invalidateQueries({ queryKey: ['acc-party-entries', id] });
    setOpen(false);
    setForm({ memo_number: '', date: toLocalDateStr(), items: [{ ...emptyItem }], total: '', is_submission: false });
    toast.success(`${rows.length}টি আইটেম যোগ হয়েছে`);
  };

  const openEdit = (entry: any) => {
    setEditingEntry(entry);
    setEditForm({
      memo_number: entry.memo_number || '',
      date: entry.date,
      product_name: entry.product_name,
      quantity: entry.quantity?.toString() || '',
      rate: entry.rate?.toString() || '',
      total: entry.total.toString(),
      is_submission: entry.is_submission,
    });
    setEditOpen(true);
  };

  const handleUpdate = () => {
    if (!editingEntry) return;
    const qty = editForm.is_submission ? null : Number(editForm.quantity) || null;
    const rate = editForm.is_submission ? null : Number(editForm.rate) || null;
    const total = editForm.is_submission ? Number(editForm.total) : (qty && rate ? qty * rate : Number(editForm.total) || 0);
    updateEntry.mutate({
      id: editingEntry.id,
      person_id: id,
      memo_number: editForm.is_submission ? null : (editForm.memo_number || null),
      date: editForm.date,
      product_name: editForm.is_submission ? 'Submission' : editForm.product_name,
      quantity: qty, rate, total,
      is_submission: editForm.is_submission,
    }, {
      onSuccess: () => { setEditOpen(false); setEditingEntry(null); toast.success('এন্ট্রি আপডেট হয়েছে'); },
      onError: () => toast.error('আপডেট করতে সমস্যা হয়েছে'),
    });
  };

  const handleDelete = () => {
    if (!deleteId) return;
    const entryToDelete = entries.find(e => e.id === deleteId);
    deleteEntry.mutate({ id: deleteId, person_id: id }, {
      onSuccess: async () => {
        // Dual-delete: remove matching transaction for submissions
        if (entryToDelete?.is_submission && entryToDelete.total > 0) {
          try {
            const { data: matchingTx } = await (supabase.from('acc_transactions' as any) as any)
              .select('id, account_id, amount')
              .eq('person_id', id)
              .eq('type', 'party_payment')
              .eq('amount', entryToDelete.total)
              .order('created_at', { ascending: false })
              .limit(1);
            if (matchingTx && matchingTx.length > 0) {
              const tx = matchingTx[0];
              await supabase.from('acc_transactions' as any).delete().eq('id', tx.id);
              // Restore account balance
              const { data: acc } = await supabase.from('acc_accounts' as any).select('balance').eq('id', tx.account_id).single();
              if (acc) {
                const newBalance = Number((acc as any).balance) + Number(tx.amount);
                await supabase.from('acc_accounts' as any).update({ balance: newBalance } as any).eq('id', tx.account_id);
              }
              qc.invalidateQueries({ queryKey: ['acc-accounts'] });
              qc.invalidateQueries({ queryKey: ['acc-transactions'] });
              qc.invalidateQueries({ queryKey: ['acc-transactions-paginated'] });
              qc.invalidateQueries({ queryKey: ['acc-transaction-summary'] });
            }
          } catch (e) { console.error('Dual-delete failed:', e); }
        }
        setDeleteId(null);
        toast.success('এন্ট্রি মুছে ফেলা হয়েছে');
      },
      onError: () => toast.error('মুছতে সমস্যা হয়েছে'),
    });
  };

  return (
    <div className="space-y-3">
      <ProfileToolbar personId={person?.id} personName={person?.name} personCode={person?.person_code} />
      <Card className="overflow-hidden">
        <CardContent className="p-0">
           <BrandedHeader person={person} />
        </CardContent>
      </Card>

      {direction === 'sales' && (
        <div className="rounded-lg border-2 border-emerald-300/60 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          💰 {partyLabel} — এই হিসাবে তারা আমাদের কাছে বাকি (আমরা পাবো)
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3">
          <div className="text-[10px] text-destructive/70 font-medium">মোট পরিমাণ</div>
          <div className="text-lg font-bold text-destructive">{displayQty.toLocaleString()}</div>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3">
          <div className="text-[10px] text-green-600/70 font-medium">{direction === 'sales' ? 'তারা দিল' : 'জমা'}</div>
          <div className="text-lg font-bold text-green-600">৳{displayPaid.toLocaleString()}</div>
        </div>
        <div className={`${direction === 'sales' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-orange-500/10 border-orange-500/20'} border rounded-xl p-3`}>
          <div className={`text-[10px] font-medium ${direction === 'sales' ? 'text-emerald-700/80' : 'text-orange-600/70'}`}>
            {direction === 'sales' ? 'পাওনা (তারা দিবে)' : 'বাকি'}
          </div>
          <div className={`text-lg font-bold ${direction === 'sales' ? 'text-emerald-700' : 'text-orange-600'}`}>৳{displayDue.toLocaleString()}</div>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
          <div className="text-[10px] text-blue-600/70 font-medium">{direction === 'sales' ? totalLabel : 'মোট বিল'}</div>
          <div className="text-lg font-bold text-blue-600">৳{displayBill.toLocaleString()}</div>
        </div>
      </div>

      {isInternalWorkSheet && (
        <div className="rounded-lg border border-indigo-300/50 bg-indigo-50 dark:bg-indigo-950/20 px-3 py-2.5 text-xs">
          <div className="font-semibold text-indigo-800 dark:text-indigo-300 flex items-center gap-1.5 mb-1">
            🔄 স্বয়ংক্রিয় সমন্বয় (ইউনিটের বাড়তি খরচ থেকে)
          </div>
          <div className="text-indigo-700/80 dark:text-indigo-400/80">
            ইউনিট খরচ ৳{(settlement?.totalUnitExpense || 0).toLocaleString()} − বাইরের ক্লায়েন্টের জমা ৳{(settlement?.totalOutsideDeposits || 0).toLocaleString()} = <span className="font-bold">৳{settlementAmount.toLocaleString()}</span>
          </div>
          <div className="text-[10px] text-indigo-600/70 dark:text-indigo-400/60 mt-1">
            এটা কোনো real লেনদেন না — শুধু হিসাব দেখানো হচ্ছে, উপরের "তারা দিল"/"পাওনা"-তে যোগ করা আছে।
          </div>
        </div>
      )}

      {usesWorkOrders && <InternalWorkOrdersSection unitId={person.unit_id} />}

      {/* Add Entry Button — hidden for an order-based internal work sheet: জমা is already automatic
          (স্বয়ংক্রিয় সমন্বয় card above) and নতুন এন্ট্রি is superseded by কাজের অর্ডার's own + অর্ডার.
          A memo-based internal sheet (এম্ব্রয়ডারি) still needs নতুন এন্ট্রি — it has no order UI. */}
      {!usesWorkOrders && (
      <div className="flex justify-end gap-2 print:hidden">
        {direction === 'sales' && (
          <>
            <Button size="sm" onClick={() => { setEditPaymentTx(null); setPaymentOpen(true); }}>🏦 জমা নিন</Button>
            <SalesPartyPaymentDialog
              open={paymentOpen}
              onOpenChange={(o) => { setPaymentOpen(o); if (!o) setEditPaymentTx(null); }}
              personId={id}
              personName={person.name}
              personPhone={person.phone}
              editTx={editPaymentTx}
              partyLabel={partyLabel}
            />
          </>
        )}
        {person.phone && (
          <Button size="sm" variant="outline" onClick={openSmsDialog}>
            <Send className="h-4 w-4 mr-1" /> SMS পাঠান
          </Button>
        )}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" /> নতুন এন্ট্রি</Button>
          </DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>নতুন এন্ট্রি যোগ করুন</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_submission} onChange={e => setForm(f => ({ ...f, is_submission: e.target.checked }))} />
              এটি জমা/Submission
            </label>
            <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            {!form.is_submission ? (
              <>
                <Input placeholder="মেমো নম্বর" value={form.memo_number} onChange={e => setForm(f => ({ ...f, memo_number: e.target.value }))} />
                {form.items.map((item, idx) => (
                  <div key={idx} className="border border-border rounded-lg p-3 space-y-2 relative">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">আইটেম #{idx + 1}</span>
                      {form.items.length > 1 && (
                        <button type="button" onClick={() => removeItem(idx)} className="text-destructive hover:text-destructive/80 text-xs p-1">✕</button>
                      )}
                    </div>
                    <Input placeholder="আইটেমের নাম" value={item.product_name} onChange={e => updateItem(idx, 'product_name', e.target.value)} />
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground mb-0.5 block">পরিমাণ (গজ/পিস)</label>
                        <Input type="number" step="any" placeholder="0" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground mb-0.5 block">দর (প্রতি ইউনিট)</label>
                        <Input type="number" step="any" placeholder="0" value={item.rate} onChange={e => updateItem(idx, 'rate', e.target.value)} />
                      </div>
                    </div>
                    {calcItemTotal(item) > 0 && (
                      <div className="text-xs text-right text-muted-foreground">লাইন টোটাল: ৳{calcItemTotal(item).toLocaleString()}</div>
                    )}
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addItem} className="w-full">
                  <Plus className="h-3 w-3 mr-1" /> আইটেম যোগ করুন
                </Button>
                {calcGrandTotal > 0 && (
                  <div className="flex items-center justify-end gap-3 text-sm font-semibold">
                    <span className="text-muted-foreground">মোট পরিমাণ: <span className="text-foreground">{calcGrandQty.toLocaleString()}</span></span>
                    <span className="text-muted-foreground">·</span>
                    <span>হিসাব মোট: ৳{calcGrandTotal.toLocaleString()}</span>
                  </div>
                )}
                <div>
                  <label className="text-xs text-muted-foreground mb-0.5 block">বিল পরিমাণ (ওভাররাইড — খালি রাখলে হিসাব মোট ব্যবহার হবে)</label>
                  <Input type="number" step="any" placeholder={calcGrandTotal > 0 ? calcGrandTotal.toString() : 'মোট টাকা'} value={form.total} onChange={e => setForm(f => ({ ...f, total: e.target.value }))} />
                </div>
              </>
            ) : (
              <Input type="number" placeholder="মোট টাকা" value={form.total} onChange={e => setForm(f => ({ ...f, total: e.target.value }))} />
            )}
            <Button onClick={handleSubmit} disabled={createEntry.isPending} className="w-full">যোগ করুন</Button>
          </div>
        </DialogContent>
      </Dialog>
      </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>এন্ট্রি এডিট করুন</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editForm.is_submission} onChange={e => setEditForm(f => ({ ...f, is_submission: e.target.checked }))} />
              এটি জমা/Submission
            </label>
            <Input type="date" value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} />
            {!editForm.is_submission && (
              <>
                <Input placeholder="মেমো নম্বর" value={editForm.memo_number} onChange={e => setEditForm(f => ({ ...f, memo_number: e.target.value }))} />
                <Input placeholder="পণ্যের নাম" value={editForm.product_name} onChange={e => setEditForm(f => ({ ...f, product_name: e.target.value }))} />
                <div className="grid grid-cols-2 gap-2">
                  <Input type="number" placeholder="পরিমাণ" value={editForm.quantity} onChange={e => setEditForm(f => ({ ...f, quantity: e.target.value }))} />
                  <Input type="number" placeholder="দর" value={editForm.rate} onChange={e => setEditForm(f => ({ ...f, rate: e.target.value }))} />
                </div>
              </>
            )}
            <Input type="number" placeholder="মোট টাকা" value={editForm.total || (Number(editForm.quantity) * Number(editForm.rate) || '')} onChange={e => setEditForm(f => ({ ...f, total: e.target.value }))} />
            <Button onClick={handleUpdate} disabled={updateEntry.isPending} className="w-full">আপডেট করুন</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>এন্ট্রি মুছে ফেলবেন?</AlertDialogTitle>
            <AlertDialogDescription>এই এন্ট্রিটি মুছে ফেলা হবে। এটি আর ফেরত পাওয়া যাবে না।</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>বাতিল</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">মুছে ফেলুন</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Ledger Table — hidden for an order-based internal work sheet, whose real entries live in
          কাজের অর্ডার above instead. A memo-based sheet (এম্ব্রয়ডারি) has no order UI, so this
          table is still its actual record of logged কাজ — must stay visible. */}
      {!usesWorkOrders && (
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-2 py-2 text-left font-medium">মেমো</th>
                <th className="px-2 py-2 text-left font-medium">তারিখ</th>
                <th className="px-2 py-2 text-left font-medium">পণ্য</th>
                <th className="px-2 py-2 text-right font-medium">পরিমাণ</th>
                <th className="px-2 py-2 text-right font-medium">দর</th>
                <th className="px-2 py-2 text-right font-medium">বিল</th>
                <th className="px-2 py-2 text-right font-medium">জমা</th>
                <th className="px-2 py-2 text-right font-medium">মোট</th>
                <th className="px-1 py-2 text-center font-medium print:hidden">⚙</th>
              </tr>
            </thead>
            <tbody>
              {enriched.length === 0 && (
                <tr><td colSpan={9} className="p-4 text-center text-muted-foreground">কোনো এন্ট্রি নেই</td></tr>
              )}
              {(() => {
                // Pre-compute memo group totals (memo_number + date, party non-submission only)
                const groupTotals = new Map<string, { qty: number; bill: number; count: number }>();
                enriched.forEach((e: any) => {
                  if (e._source !== 'party' || e.is_submission || !e.memo_number) return;
                  const key = `${e.memo_number}__${e.date}`;
                  const g = groupTotals.get(key) || { qty: 0, bill: 0, count: 0 };
                  g.qty += Number(e.quantity) || 0;
                  g.bill += Number(e.total) || 0;
                  g.count += 1;
                  groupTotals.set(key, g);
                });
                const seen = new Set<string>();
                const rows: JSX.Element[] = [];
                enriched.forEach((e: any) => {
                  const groupable = e._source === 'party' && !e.is_submission && e.memo_number;
                  const key = groupable ? `${e.memo_number}__${e.date}` : '';
                  if (groupable && !seen.has(key)) {
                    seen.add(key);
                    const g = groupTotals.get(key)!;
                    if (g.count > 1) {
                      rows.push(
                        <tr key={`grp-${key}`} className="bg-primary/10 border-b border-border">
                          <td colSpan={9} className="px-2 py-1.5 text-[11px] font-semibold">
                            <span className="text-primary">মেমো #{e.memo_number}</span>
                            <span className="text-muted-foreground"> · {format(new Date(e.date), 'dd/MM')}</span>
                            <span className="text-muted-foreground"> · মোট পরিমাণ: </span>
                            <span className="text-foreground">{g.qty.toLocaleString()}</span>
                            <span className="text-muted-foreground"> · মোট বিল: </span>
                            <span className="text-foreground">৳{g.bill.toLocaleString()}</span>
                            <span className="text-muted-foreground"> ({g.count} আইটেম)</span>
                          </td>
                        </tr>
                      );
                    }
                  }
                  rows.push(
                    <tr key={e.id} className={`border-b border-border ${e._source === 'expense' ? ((e as any)._txType === 'deposit' ? 'bg-green-50 dark:bg-green-950/20' : 'bg-orange-50 dark:bg-orange-950/20') : e.is_submission ? 'bg-green-50 dark:bg-green-950/20' : ''}`}>
                      <td className="px-2 py-2">{e.memo_number || '—'}</td>
                      <td className="px-2 py-2">{format(new Date(e.date), 'dd/MM')}</td>
                      <td className="px-2 py-2 font-medium">
                        {e.product_name}
                        {e._source === 'expense' && (
                          (e as any)._txType === 'deposit'
                            ? <span className="ml-1 text-[9px] bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded-full font-medium">জমা</span>
                            : <span className="ml-1 text-[9px] bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 rounded-full font-medium">খরচ</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right">{e.quantity ?? '—'}</td>
                      <td className="px-2 py-2 text-right">{e.rate ?? '—'}</td>
                      <td className="px-2 py-2 text-right font-medium">{e.is_submission ? '' : `৳${e.total.toLocaleString()}`}</td>
                      <td className="px-2 py-2 text-right font-medium text-green-600">{e.is_submission ? `৳${e.total.toLocaleString()}` : ''}</td>
                      <td className="px-2 py-2 text-right font-bold">৳{(e.runningBill - e.runningPaid).toLocaleString()}</td>
                      <td className="px-1 py-1 text-center print:hidden">
                        {e._source === 'party' ? (
                          <div className="flex items-center gap-0.5 justify-center">
                            <button onClick={() => openEdit(e)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><Pencil className="h-3 w-3" /></button>
                            <button onClick={() => setDeleteId(e.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                          </div>
                        ) : e._source === 'expense' && (e as any)._txType === 'deposit' ? (
                          <div className="flex items-center gap-0.5 justify-center">
                            <button
                              onClick={() => {
                                setEditPaymentTx({
                                  id: e.id,
                                  account_id: (e as any)._accountId,
                                  amount: e.total,
                                  source: (e as any)._txSource,
                                  description: e.product_name,
                                  created_at: e.created_at,
                                });
                                setPaymentOpen(true);
                              }}
                              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                            ><Pencil className="h-3 w-3" /></button>
                            <button
                              onClick={() => handleDeletePaymentTx({ id: e.id, amount: e.total, account_id: (e as any)._accountId, description: e.product_name, source: (e as any)._txSource })}
                              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                            ><Trash2 className="h-3 w-3" /></button>
                          </div>
                        ) : (
                          <span className="text-[9px] text-muted-foreground">লেজার</span>
                        )}
                      </td>
                    </tr>
                  );
                });
                return rows;
              })()}
            </tbody>
          </table>
        </CardContent>
      </Card>
      )}

      <Dialog open={smsOpen} onOpenChange={setSmsOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>📩 {person.name}-কে SMS পাঠান</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">পাঠানোর আগে মেসেজটা চেক/এডিট করে নিন — কনফার্ম করলে তবেই যাবে।</p>
            <Textarea value={smsMessage} onChange={(e) => setSmsMessage(e.target.value)} rows={6} />
            <p className="text-[11px] text-muted-foreground">পাঠানো হবে: {person.phone}</p>
            <Button onClick={handleSendSms} disabled={smsSending} className="w-full">
              {smsSending ? 'পাঠানো হচ্ছে...' : <><Send className="h-4 w-4 mr-1" /> পাঠান</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ========== PRODUCTION STAFF VIEW ==========
function ProductionProfileView({ person, id }: { person: any; id: string }) {
  const { data: entries = [] } = useProductionEntries(id);
  const { data: personTxns = [] } = useQuery({
    queryKey: ['person-all-txns', id],
    queryFn: async () => {
      const { data, error } = await (supabase.from('acc_transactions' as any) as any)
        .select('id, amount, description, created_at, type')
        .eq('person_id', id)
        .in('type', ['expense', 'salary', 'advance', 'bonus', 'production_payment', 'party_payment'])
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as { id: string; amount: number; description: string | null; created_at: string; type: string }[];
    },
  });
  const createEntry = useCreateProductionEntry();
  const updateEntry = useUpdateProductionEntry();
  const deleteEntry = useDeleteProductionEntry();
  const updatePerson = useUpdatePerson();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [form, setForm] = useState({ date: toLocalDateStr(), product_name: '', quantity: '', pricing: '', total: '', is_submission: false });
  const [editForm, setEditForm] = useState({ date: '', product_name: '', quantity: '', pricing: '', total: '', is_submission: false });
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [editingPhone, setEditingPhone] = useState(person.phone || '');

  const handlePhoneSave = async () => {
    try {
      await updatePerson.mutateAsync({ id, phone: editingPhone.trim() || null });
      toast.success('নম্বর আপডেট হয়েছে');
      setPhoneOpen(false);
    } catch {
      toast.error('আপডেট ব্যর্থ');
    }
  };

  // Merge production entries with transactions for unified ledger
  const mergedEntries = useMemo(() => {
    const prodItems = entries.map(e => ({
      ...e,
      _source: 'production' as const,
      _sortDate: new Date(e.date + 'T' + (e.created_at ? new Date(e.created_at).toISOString().slice(11) : '00:00:00')).getTime(),
    }));
    const txItems = personTxns.map(tx => ({
      id: tx.id,
      person_id: id,
      date: toLocalDateStr(tx.created_at),
      product_name: tx.description || (txTypeLabel[tx.type] || tx.type),
      quantity: null as number | null,
      pricing: null as number | null,
      total: Number(tx.amount),
      is_submission: true,
      created_at: tx.created_at,
      order_number: null as string | null,
      order_total_quantity: null as number | null,
      _source: 'transaction' as const,
      _sortDate: new Date(tx.created_at).getTime(),
      _txType: tx.type,
    }));
    return [...prodItems, ...txItems].sort((a, b) => b._sortDate - a._sortDate);
  }, [entries, personTxns, id]);

  const totalWork = mergedEntries.filter(e => !e.is_submission && e._source === 'production').reduce((s, e) => s + e.total, 0);
  const totalSubmission = mergedEntries.filter(e => e.is_submission).reduce((s, e) => s + e.total, 0);
  const equale = totalWork - totalSubmission;

  // Compute running totals chronologically (oldest first), then map back to display order (newest first)
  const chronologicalProd = [...mergedEntries].reverse();
  const runMap = new Map<string, { runWork: number; runSub: number }>();
  let runWorkAcc = 0;
  let runSubAcc = 0;
  chronologicalProd.forEach(e => {
    if (e.is_submission) runSubAcc += e.total;
    else runWorkAcc += e.total;
    runMap.set(e.id, { runWork: runWorkAcc, runSub: runSubAcc });
  });
  const enriched = mergedEntries.map(e => {
    const r = runMap.get(e.id) || { runWork: 0, runSub: 0 };
    return { ...e, runWork: r.runWork, runSub: r.runSub };
  });

  const handleSubmit = () => {
    const qty = form.is_submission ? null : Number(form.quantity) || null;
    const pricing = form.is_submission ? null : Number(form.pricing) || null;
    const total = form.is_submission ? Number(form.total) : (qty && pricing ? qty * pricing : Number(form.total) || 0);
    createEntry.mutate({
      person_id: id,
      date: form.date,
      product_name: form.is_submission ? 'Submission' : form.product_name,
      quantity: qty, pricing, total,
      is_submission: form.is_submission,
    }, {
      onSuccess: () => { setOpen(false); setForm({ date: toLocalDateStr(), product_name: '', quantity: '', pricing: '', total: '', is_submission: false }); toast.success('এন্ট্রি যোগ হয়েছে'); },
      onError: () => toast.error('এন্ট্রি যোগ করতে সমস্যা হয়েছে'),
    });
  };

  const openEdit = (entry: any) => {
    setEditingEntry(entry);
    setEditForm({
      date: entry.date,
      product_name: entry.product_name,
      quantity: entry.quantity?.toString() || '',
      pricing: entry.pricing?.toString() || '',
      total: entry.total.toString(),
      is_submission: entry.is_submission,
    });
    setEditOpen(true);
  };

  const handleUpdate = () => {
    if (!editingEntry) return;
    const qty = editForm.is_submission ? null : Number(editForm.quantity) || null;
    const pricing = editForm.is_submission ? null : Number(editForm.pricing) || null;
    const total = editForm.is_submission ? Number(editForm.total) : (qty && pricing ? qty * pricing : Number(editForm.total) || 0);
    updateEntry.mutate({
      id: editingEntry.id,
      person_id: id,
      date: editForm.date,
      product_name: editForm.is_submission ? 'Submission' : editForm.product_name,
      quantity: qty, pricing, total,
      is_submission: editForm.is_submission,
    }, {
      onSuccess: () => { setEditOpen(false); setEditingEntry(null); toast.success('এন্ট্রি আপডেট হয়েছে'); },
      onError: () => toast.error('আপডেট করতে সমস্যা হয়েছে'),
    });
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteEntry.mutate({ id: deleteId, person_id: id }, {
      onSuccess: () => { setDeleteId(null); toast.success('এন্ট্রি মুছে ফেলা হয়েছে'); },
      onError: () => toast.error('মুছতে সমস্যা হয়েছে'),
    });
  };

  return (
    <div className="space-y-3 print-person-profile">
      <div className="print:hidden"><ProfileToolbar personId={person?.id} personName={person?.name} personCode={person?.person_code} /></div>
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <BrandedHeader person={person} />
          <div className="flex items-center justify-between border-b border-t border-border px-4 py-3 bg-muted/30">
            <h1 className="text-lg font-bold">{person.name}</h1>
            <span className="text-sm font-bold text-primary">{person.acc_units?.name || 'প্রোডাকশন স্টাফ'}</span>
          </div>
          <div className="grid grid-cols-2 divide-x divide-border border-b border-border">
            <div className="px-4 py-2.5">
              <div className="text-[11px] text-muted-foreground">যোগদানের তারিখ</div>
              <div className="text-sm font-semibold">{person.joining_date ? format(new Date(person.joining_date), 'dd MMM yyyy', { locale: bn }) : '—'}</div>
            </div>
            <div className="px-4 py-2.5">
              <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                নম্বর
                <Popover open={phoneOpen} onOpenChange={(o) => { setPhoneOpen(o); if (o) setEditingPhone(person.phone || ''); }}>
                  <PopoverTrigger asChild>
                    <button className="text-primary hover:text-primary/80 p-0.5"><Pencil className="h-3 w-3" /></button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-2" align="start">
                    <Input value={editingPhone} onChange={e => setEditingPhone(e.target.value)} placeholder="ফোন নম্বর" className="h-8 text-sm" autoFocus />
                    <div className="flex justify-end gap-2 pt-2">
                      <Button size="sm" variant="ghost" onClick={() => setPhoneOpen(false)}>বাতিল</Button>
                      <Button size="sm" onClick={handlePhoneSave} disabled={updatePerson.isPending}>সেভ</Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="text-sm font-semibold">{person.phone || '—'}</div>
            </div>
          </div>
          <div className="grid grid-cols-3 divide-x divide-border">
            <div className="px-3 py-2.5 bg-amber-50 dark:bg-amber-950/20 text-center">
              <div className="text-[10px] text-muted-foreground">বাকি</div>
              <div className="text-sm font-bold text-amber-700 dark:text-amber-400">৳{equale.toLocaleString()}</div>
            </div>
            <div className="px-3 py-2.5 bg-blue-50 dark:bg-blue-950/20 text-center">
              <div className="text-[10px] text-muted-foreground">মোট কাজ</div>
              <div className="text-sm font-bold text-blue-700 dark:text-blue-400">৳{totalWork.toLocaleString()}</div>
            </div>
            <div className="px-3 py-2.5 bg-green-50 dark:bg-green-950/20 text-center">
              <div className="text-[10px] text-muted-foreground">জমা</div>
              <div className="text-sm font-bold text-green-700 dark:text-green-400">৳{totalSubmission.toLocaleString()}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Entry */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" className="w-full print:hidden"><Plus className="h-4 w-4 mr-1" /> নতুন এন্ট্রি</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>নতুন এন্ট্রি যোগ করুন</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_submission} onChange={e => setForm(f => ({ ...f, is_submission: e.target.checked }))} />
              এটি জমা
            </label>
            <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            {!form.is_submission && (
              <>
                <Input placeholder="পণ্যের নাম" value={form.product_name} onChange={e => setForm(f => ({ ...f, product_name: e.target.value }))} />
                <div className="grid grid-cols-2 gap-2">
                  <Input type="number" placeholder="পরিমাণ" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
                  <Input type="number" placeholder="প্রতি পিস দর" value={form.pricing} onChange={e => setForm(f => ({ ...f, pricing: e.target.value }))} />
                </div>
              </>
            )}
            <Input type="number" placeholder="মোট টাকা" value={form.total || (Number(form.quantity) * Number(form.pricing) || '')} onChange={e => setForm(f => ({ ...f, total: e.target.value }))} />
            <Button onClick={handleSubmit} disabled={createEntry.isPending} className="w-full">যোগ করুন</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>এন্ট্রি এডিট করুন</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editForm.is_submission} onChange={e => setEditForm(f => ({ ...f, is_submission: e.target.checked }))} />
              এটি জমা
            </label>
            <Input type="date" value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} />
            {!editForm.is_submission && (
              <>
                <Input placeholder="পণ্যের নাম" value={editForm.product_name} onChange={e => setEditForm(f => ({ ...f, product_name: e.target.value }))} />
                <div className="grid grid-cols-2 gap-2">
                  <Input type="number" placeholder="পরিমাণ" value={editForm.quantity} onChange={e => setEditForm(f => ({ ...f, quantity: e.target.value }))} />
                  <Input type="number" placeholder="প্রতি পিস দর" value={editForm.pricing} onChange={e => setEditForm(f => ({ ...f, pricing: e.target.value }))} />
                </div>
              </>
            )}
            <Input type="number" placeholder="মোট টাকা" value={editForm.total || (Number(editForm.quantity) * Number(editForm.pricing) || '')} onChange={e => setEditForm(f => ({ ...f, total: e.target.value }))} />
            <Button onClick={handleUpdate} disabled={updateEntry.isPending} className="w-full">আপডেট করুন</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>এন্ট্রি মুছে ফেলবেন?</AlertDialogTitle>
            <AlertDialogDescription>এই এন্ট্রিটি মুছে ফেলা হবে। এটি আর ফেরত পাওয়া যাবে না।</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>বাতিল</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">মুছে ফেলুন</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Work Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-2 py-2 text-left font-medium">তারিখ</th>
                <th className="px-2 py-2 text-left font-medium">পণ্য</th>
                <th className="px-2 py-2 text-left font-medium">অর্ডার</th>
                <th className="px-2 py-2 text-right font-medium">অর্ডার পিস</th>
                <th className="px-2 py-2 text-right font-medium">পরিমাণ</th>
                <th className="px-2 py-2 text-right font-medium">দর</th>
                <th className="px-2 py-2 text-right font-medium">মোট</th>
                <th className="px-2 py-2 text-right font-medium">ব্যালেন্স</th>
                <th className="px-1 py-2 text-center font-medium print:hidden">⚙</th>
              </tr>
            </thead>
            <tbody>
              {enriched.length === 0 && (
                <tr><td colSpan={9} className="p-4 text-center text-muted-foreground">কোনো এন্ট্রি নেই</td></tr>
              )}
              {enriched.map(e => (
                <tr key={e.id} className={`border-b border-border ${(e as any)._source === 'transaction' ? 'bg-orange-50 dark:bg-orange-950/20' : e.is_submission ? 'bg-green-50 dark:bg-green-950/20' : ''}`}>
                  <td className="px-2 py-2">{format(new Date(e.date), 'dd/MM')}</td>
                  <td className="px-2 py-2 font-medium">
                    {e.product_name}
                    {(e as any)._source === 'transaction' && <span className="ml-1 text-[9px] bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 rounded-full font-medium">{txTypeLabel[(e as any)._txType] || 'পেমেন্ট'}</span>}
                  </td>
                  <td className="px-2 py-2 text-left text-muted-foreground">{(e as any).order_number ?? '—'}</td>
                  <td className="px-2 py-2 text-right text-muted-foreground">{(e as any).order_total_quantity ?? '—'}</td>
                  <td className="px-2 py-2 text-right">{e.quantity ?? '—'}</td>
                  <td className="px-2 py-2 text-right">{e.pricing ?? '—'}</td>
                  <td className={`px-2 py-2 text-right font-medium ${e.is_submission ? 'text-green-600' : ''}`}>
                    {e.is_submission ? `-৳${e.total.toLocaleString()}` : `৳${e.total.toLocaleString()}`}
                  </td>
                  <td className="px-2 py-2 text-right font-bold">৳{(e.runWork - e.runSub).toLocaleString()}</td>
                  <td className="px-1 py-1 text-center print:hidden">
                    {(e as any)._source === 'production' ? (
                      <div className="flex items-center gap-0.5 justify-center">
                        <button onClick={() => openEdit(e)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><Pencil className="h-3 w-3" /></button>
                        <button onClick={() => setDeleteId(e.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    ) : (
                      <span className="text-[9px] text-muted-foreground">লেজার</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

// ========== EMPLOYEE VIEW ==========
function EmployeeProfileView({ person, id }: { person: any; id: string }) {
  // Full history, including pre-rejoin transactions — the "পূর্ববর্তী কর্মকাল"
  // card (from pastStints, below) marks where an earlier stint closed, so old
  // entries stay visible in the feed instead of disappearing. Only the running
  // balance (usePersonFinancialSummary) is scoped to the current joining_date.
  const { data: transactions = [] } = useTransactions({ person_id: id });
  const { data: attendance = [] } = usePersonAttendance(id);
  const { data: increments = [] } = useSalaryIncrements(id);
  const { data: financial } = usePersonFinancialSummary(id, person.is_active, person.joining_date);
  const { data: monthlySummary } = useMonthlySalarySummary(id, person.joining_date);
  // Closed-out stint summaries (e.g. before a rejoin) — shown as cards in the
  // feed at their close date so that history survives the joining_date reset.
  const { data: pastStints = [] } = usePersonPastStints(id);
  const updatePerson = useUpdatePerson();
  const generateSalary = useGenerateSalary();
  const updateSalaryRecord = useUpdateSalaryRecord();
  const qc = useQueryClient();
  const { data: navbarConfig } = useSiteConfig('navbar_config');

  // Auto-generate salary records for current and previous month
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
  
  const { data: currentMonthRecords = [] } = useSalaryRecords(currentMonth, currentYear);
  const { data: prevMonthRecords = [] } = useSalaryRecords(prevMonth, prevYear);
  // Fetch person's off days
  const { data: offDays = [] } = useQuery({
    queryKey: ['acc-off-days', id],
    queryFn: async () => {
      const { data, error } = await (supabase.from('acc_off_days' as any) as any)
        .select('day_of_week')
        .eq('person_id', id);
      if (error) throw error;
      return (data || []).map((d: any) => d.day_of_week as number);
    },
  });
  
  const autoGenDone = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!person.base_salary || person.salary_type !== 'monthly') return;
    
    const checkAndGenerate = async (m: number, y: number, records: any[]) => {
      const key = `${id}-${m}-${y}`;
      if (autoGenDone.current.has(key)) return;
      if (records.some((r: any) => r.person_id === id)) return;
      if (isSalaryMonthBeforeJoining(m, y, person.joining_date)) return;
      
      autoGenDone.current.add(key);
      const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
      const endM = m === 12 ? 1 : m + 1;
      const endY = m === 12 ? y + 1 : y;
      const endDate = `${endY}-${String(endM).padStart(2, '0')}-01`;
      const totalDays = new Date(y, m, 0).getDate();
      const nowDate = new Date();
      const isCurrentGeneratedMonth = y === nowDate.getFullYear() && m === nowDate.getMonth() + 1;

      const { data: att } = await (supabase.from('acc_attendance' as any) as any)
        .select('date,status').eq('person_id', id).gte('date', startDate).lt('date', endDate);
      const baseSalary = person.base_salary || 0;
      const calc = calculateMonthlySalary({
        year: y, month: m, baseSalary,
        joiningDate: person.joining_date,
        attendanceRows: att || [],
        offDays,
        endDay: isCurrentGeneratedMonth ? nowDate.getDate() : totalDays,
      });

      await generateSalary.mutateAsync({
        person_id: id, month: m, year: y, working_days: calc.workingDays,
        present_days: calc.presentDays + calc.lateDays, absent_days: calc.absentDays, off_days: calc.offDays,
        base_salary: baseSalary, deduction: calc.deduction, final_salary: baseSalary - calc.deduction,
      });
    };

    // Only auto-generate for past months (not current month)
    checkAndGenerate(prevMonth, prevYear, prevMonthRecords);
  }, [id, person.base_salary, person.salary_type, person.joining_date, currentMonthRecords, prevMonthRecords, offDays]);

  // Settlement note from activity logs
  const { data: settlementLogs } = useQuery({
    queryKey: ['settlement-logs', id],
    queryFn: async () => {
      const { data, error } = await (supabase.from('acc_activity_logs' as any) as any)
        .select('*')
        .eq('entity_id', id)
        .in('action', ['settlement', 'settlement_update'])
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
    enabled: !!id && !person?.is_active,
  });

  // Settlement state
  const [settleOpen, setSettleOpen] = useState(false);
  const [settleDate, setSettleDate] = useState<Date | undefined>(undefined);
  const [settleAmount, setSettleAmount] = useState<string>('');
  const [settleNote, setSettleNote] = useState('');

  // Re-join state
  const [rejoinOpen, setRejoinOpen] = useState(false);
  const [rejoinDate, setRejoinDate] = useState<Date | undefined>(undefined);

  // Joining date edit state
  const [joiningDateOpen, setJoiningDateOpen] = useState(false);
  const [editingJoiningDate, setEditingJoiningDate] = useState<Date | undefined>(
    person.joining_date ? new Date(person.joining_date) : undefined
  );
  // Phone edit state
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [editingPhone, setEditingPhone] = useState(person.phone || '');
  const [showSettings, setShowSettings] = useState(false);
  // Fallback: person → unit settings → default 09:00/18:00
  const { data: units = [] } = useUnits();
  const unitData = units.find(u => u.id === person.unit_id);
  const unitSettingsData = (unitData as any)?.settings || {};
  const defaultDutyStart = person.duty_start || (unitSettingsData as any).duty_start || '09:00';
  const defaultDutyEnd = person.duty_end || (unitSettingsData as any).duty_end || '18:00';
  const [dutyStart, setDutyStart] = useState(defaultDutyStart);
  const [dutyEnd, setDutyEnd] = useState(defaultDutyEnd);

  // ===== Simple inline actions for Running Month card =====
  const { data: accounts = [] } = useAccounts();
  const createIncrement = useCreateIncrement();
  const updateIncrement = useUpdateIncrement();
  const deleteIncrement = useDeleteIncrement();
  const markAttendance = useMarkAttendance();
  

  // Which inline panel is open inside running card
  const [openPanel, setOpenPanel] = useState<null | 'bonus' | 'overtime' | 'pay' | 'received' | 'advance' | 'editSalary' | 'editBonus' | 'editOvertime'>(null);

  // Bonus
  const [bonusAmount, setBonusAmount] = useState('');
  const [bonusNote, setBonusNote] = useState('');

  // Overtime
  const [otHours, setOtHours] = useState('');
  const [otMins, setOtMins] = useState('');
  const [otAmount, setOtAmount] = useState('');
  const [otNote, setOtNote] = useState('');

  // Pay (joma)
  const [payAmount2, setPayAmount2] = useState('');
  const [payNote2, setPayNote2] = useState('');

  // Manually entered "এই মাসে নিয়েছে" (display-only summary, no transaction created)
  const [receivedAmount, setReceivedAmount] = useState('');
  const [receivedNote, setReceivedNote] = useState('');

  // Manually entered advance for salary clearance only
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceNote, setAdvanceNote] = useState('');

  // Edit final salary (this month override)
  const [editFinalSalaryValue, setEditFinalSalaryValue] = useState('');

  // Salary increment popover
  const [incOpen, setIncOpen] = useState(false);
  const [incAdd, setIncAdd] = useState('');
  const [incDate, setIncDate] = useState<string>(toLocalDateStr());
  const [incNote, setIncNote] = useState('');

  // Edit-increment dialog state
  const [editIncId, setEditIncId] = useState<string | null>(null);
  const [editIncNewSalary, setEditIncNewSalary] = useState('');
  const [editIncDate, setEditIncDate] = useState('');
  const [editIncNote, setEditIncNote] = useState('');
  const [editIncOldSalary, setEditIncOldSalary] = useState(0);

  const [savingAction, setSavingAction] = useState(false);

  // Edit historical salary record dialog
  const [editRecOpen, setEditRecOpen] = useState(false);
  const [editRec, setEditRec] = useState<any>(null);
  const [editRecForm, setEditRecForm] = useState({
    base_salary: '', deduction: '', bonus_amount: '', bonus_note: '',
    overtime_amount: '', overtime_note: '', final_salary: '',
  });
  // History-card advance dialog
  const [advRecOpen, setAdvRecOpen] = useState(false);
  const [advRec, setAdvRec] = useState<any>(null);
  const [advRecAmount, setAdvRecAmount] = useState('');
  const [advRecNote, setAdvRecNote] = useState('');
  const openAdvRec = (rec: any) => {
    setAdvRec(rec);
    setAdvRecAmount(String(rec.advance_amount || ''));
    setAdvRecNote(rec.advance_note || '');
    setAdvRecOpen(true);
  };
  const handleAdvRecSubmit = async () => {
    if (!advRec) return;
    const amt = Number(advRecAmount) || 0;
    if (amt < 0) { toast.error('অগ্রিম ০ এর কম হতে পারে না'); return; }
    try {
      await updateSalaryRecord.mutateAsync({
        id: advRec.id,
        final_salary: Number(advRec.final_salary || 0),
        advance_amount: amt,
        advance_note: advRecNote || null,
      } as any);
      qc.invalidateQueries({ queryKey: ['acc-salary-records'] });
      qc.invalidateQueries({ queryKey: ['acc-person-financial'] });
      qc.invalidateQueries({ queryKey: ['acc-person-financial-summary'] });
      qc.invalidateQueries({ queryKey: ['acc-monthly-salary-summary'] });
      qc.invalidateQueries({ queryKey: ['person-all-txns', id] });
      toast.success('অগ্রিম সংরক্ষণ হয়েছে');
      setAdvRecOpen(false);
      setAdvRec(null);
    } catch (e: any) {
      toast.error(e?.message || 'অগ্রিম সেভ হয়নি');
    }
  };

  // Print settlement dialog (asks "paying now" + "mark as fully paid")
  const [printDlgOpen, setPrintDlgOpen] = useState(false);
  const [printDlgPayload, setPrintDlgPayload] = useState<any>(null); // { kind: 'running'|'record', rec?, oldBalance, run? }
  const [printPayNow, setPrintPayNow] = useState('');
  const [printPayNote, setPrintPayNote] = useState('');
  const [printMarkPaid, setPrintMarkPaid] = useState(false);
  const openPrintDlg = (payload: any) => {
    setPrintDlgPayload(payload);
    setPrintPayNow('');
    setPrintPayNote('');
    setPrintMarkPaid(false);
    setPrintDlgOpen(true);
  };
  const openEditRec = (rec: any) => {
    setEditRec(rec);
    setEditRecForm({
      base_salary: String(rec.base_salary || 0),
      deduction: String(rec.deduction || 0),
      bonus_amount: String(rec.bonus_amount || 0),
      bonus_note: rec.bonus_note || '',
      overtime_amount: String(rec.overtime_amount || 0),
      overtime_note: rec.overtime_note || '',
      final_salary: String(rec.final_salary || 0),
    });
    setEditRecOpen(true);
  };
  const updateEditRecField = (field: string, value: string) => {
    setEditRecForm(prev => {
      const next: any = { ...prev, [field]: value };
      if (['base_salary', 'deduction', 'bonus_amount', 'overtime_amount'].includes(field)) {
        const b = Number(next.base_salary) || 0;
        const d = Number(next.deduction) || 0;
        const bn = Number(next.bonus_amount) || 0;
        const ot = Number(next.overtime_amount) || 0;
        next.final_salary = String(Math.max(0, b - d + bn + ot));
      }
      return next;
    });
  };
  const handleEditRecSubmit = async () => {
    if (!editRec) return;
    try {
      await updateSalaryRecord.mutateAsync({
        id: editRec.id,
        base_salary: Number(editRecForm.base_salary) || 0,
        deduction: Number(editRecForm.deduction) || 0,
        bonus_amount: Number(editRecForm.bonus_amount) || 0,
        bonus_note: editRecForm.bonus_note || null,
        overtime_amount: Number(editRecForm.overtime_amount) || 0,
        overtime_note: editRecForm.overtime_note || null,
        final_salary: Number(editRecForm.final_salary) || 0,
      });
      toast.success('বেতন কার্ড আপডেট হয়েছে');
      setEditRecOpen(false); setEditRec(null);
      invalidateAll();
    } catch (e: any) { toast.error(e?.message || 'আপডেট হয়নি'); }
  };
  const buildRecordSlipInput = (rec: any, extra: { pay_now_amount?: number; pay_now_note?: string | null; mark_paid?: boolean }) => {
    const brandBn = (navbarConfig as any)?.brand_name || DEFAULT_NAVBAR_CONFIG.brand_name;
    const brandEn = (navbarConfig as any)?.brand_name_en || DEFAULT_NAVBAR_CONFIG.brand_name_en;
    const corrected = calculateMonthlySalary({
      year: rec.year,
      month: rec.month,
      baseSalary: Number(rec.base_salary || 0),
      joiningDate: person?.joining_date,
      attendanceRows: autoAttendanceItems.filter(a => {
        const d = parseISO(a.date);
        return d.getMonth() + 1 === rec.month && d.getFullYear() === rec.year;
      }),
      offDays,
      bonusAmount: Number(rec.bonus_amount || 0),
      overtimeAmount: Number(rec.overtime_amount || 0),
    });
    return {
      personName: person?.name || '',
      personId: person?.id,
      joiningDate: person?.joining_date,
      unitName: (person as any)?.unit_name || null,
      brandNameBn: brandBn,
      brandNameEn: brandEn,
      record: {
        ...rec,
        working_days: corrected.workingDays,
        present_days: corrected.presentDays + corrected.lateDays,
        absent_days: corrected.absentDays,
        off_days: corrected.offDays,
        deduction: corrected.deduction,
        final_salary: corrected.finalSalary,
        ...extra,
      },
      totalDaysInMonth: getDaysInMonth(new Date(rec.year, rec.month - 1)),
    };
  };
  const printSalaryRecord = (rec: any) => {
    const finalSal = Number(rec.final_salary || 0);
    const paid = Number(rec.paid_amount || 0);
    const adv = Number(rec.advance_amount || 0);
    openPrintDlg({
      kind: 'record',
      oldBalance: Math.max(0, finalSal - paid - adv),
      build: (extra: any) => buildRecordSlipInput(rec, extra),
    });
  };

  const resetPanels = () => {
    setOpenPanel(null);
    setBonusAmount(''); setBonusNote('');
    setOtHours(''); setOtMins(''); setOtAmount(''); setOtNote('');
    setPayAmount2(''); setPayNote2('');
    setReceivedAmount(''); setReceivedNote('');
    setAdvanceAmount(''); setAdvanceNote('');
    setEditFinalSalaryValue('');
  };

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['acc-transactions'] });
    qc.invalidateQueries({ queryKey: ['acc-transactions-paginated'] });
    qc.invalidateQueries({ queryKey: ['acc-transaction-summary'] });
    qc.invalidateQueries({ queryKey: ['acc-monthly-salary-summary'] });
    qc.invalidateQueries({ queryKey: ['acc-person-financial-summary'] });
    qc.invalidateQueries({ queryKey: ['acc-person-financial'] });
    qc.invalidateQueries({ queryKey: ['acc-accounts'] });
    qc.invalidateQueries({ queryKey: ['acc-salary-records'] });
  };

  const insertTxn = async (type: string, amount: number, description: string) => {
    const defaultAccount = accounts[0];
    if (!defaultAccount) { toast.error('কোনো অ্যাকাউন্ট নেই'); return false; }
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase.from('acc_transactions' as any).insert({
      account_id: defaultAccount.id,
      person_id: id,
      type,
      amount,
      description,
      created_by: session?.user?.id,
    } as any);
    if (error) { toast.error(error.message); return false; }
    const newBalance = Number(defaultAccount.balance) - amount;
    await supabase.from('acc_accounts' as any).update({ balance: newBalance } as any).eq('id', defaultAccount.id);

    logAccActivity({
      action: 'create', entity_type: 'transaction',
      entity_name: `৳${amount} ${type} (${person.name})`,
      description, new_data: { account_id: defaultAccount.id, person_id: id, type, amount, description, person_name: person.name },
    });

    // Money given to this person is salary-related — apply it against their
    // oldest unpaid month first, spilling into newer months, so the cards
    // below actually reflect what's been paid.
    if (type === 'expense' || type === 'advance') {
      try {
        await allocatePaymentToSalaryRecords(id!, amount);
      } catch (e) {
        console.error('[allocatePaymentToSalaryRecords]', e);
      }
    }

    return true;
  };

  // Upsert bonus/overtime into the current month's salary record so it
  // adds to the salary owed instead of creating a separate cash expense.
  const upsertCurrentMonthAdjustment = async (opts: {
    bonusDelta?: number; overtimeDelta?: number;
    bonusNoteAppend?: string; overtimeNoteAppend?: string;
    bonusSet?: number; overtimeSet?: number;
    bonusNoteSet?: string | null; overtimeNoteSet?: string | null;
  }) => {
    const { data: existing } = await (supabase.from('acc_salary_records' as any) as any)
      .select('*')
      .eq('person_id', id)
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .maybeSingle();

    const totalDays = getDaysInMonth(new Date(currentYear, currentMonth - 1));
    const baseSalary = person?.base_salary || 0;
    const today = new Date();
    const calc = calculateMonthlySalary({
      year: currentYear, month: currentMonth, baseSalary,
      joiningDate: person.joining_date,
      attendanceRows: attendance as any[],
      offDays,
      endDay: currentYear === today.getFullYear() && currentMonth === today.getMonth() + 1 ? today.getDate() : totalDays,
      bonusAmount: 0,
      overtimeAmount: 0,
    });

    const existingBonus = Number((existing as any)?.bonus_amount || 0);
    const existingOvertime = Number((existing as any)?.overtime_amount || 0);
    const newBonus = opts.bonusSet !== undefined
      ? Math.max(0, opts.bonusSet)
      : existingBonus + (opts.bonusDelta || 0);
    const newOvertime = opts.overtimeSet !== undefined
      ? Math.max(0, opts.overtimeSet)
      : existingOvertime + (opts.overtimeDelta || 0);
    // Always recompute core salary from current attendance — this ensures deduction is
    // correctly applied even when only bonus/overtime is being adjusted.
    const finalSalary = Math.max(0, baseSalary - calc.deduction + newBonus + newOvertime);

    const mergeNote = (existingNote: string | null | undefined, addition?: string) => {
      const add = (addition || '').trim();
      if (!add) return existingNote ?? null;
      const cur = (existingNote || '').trim();
      return cur ? `${cur} | ${add}` : add;
    };

    const bonusNoteFinal = opts.bonusNoteSet !== undefined
      ? (opts.bonusNoteSet || null)
      : mergeNote((existing as any)?.bonus_note, opts.bonusNoteAppend);
    const overtimeNoteFinal = opts.overtimeNoteSet !== undefined
      ? (opts.overtimeNoteSet || null)
      : mergeNote((existing as any)?.overtime_note, opts.overtimeNoteAppend);

    const paidAmount = Number((existing as any)?.paid_amount || 0);
    const isPaid = paidAmount >= finalSalary && finalSalary > 0;

    const payload: any = {
      person_id: id, month: currentMonth, year: currentYear,
      working_days: calc.workingDays, present_days: calc.presentDays + calc.lateDays,
      absent_days: calc.absentDays, off_days: calc.offDays,
      base_salary: baseSalary, deduction: calc.deduction, final_salary: finalSalary,
      bonus_amount: newBonus, overtime_amount: newOvertime,
      bonus_note: newBonus > 0 ? bonusNoteFinal : null,
      overtime_note: newOvertime > 0 ? overtimeNoteFinal : null,
      paid_amount: paidAmount,
      is_paid: isPaid,
      paid_at: isPaid ? ((existing as any)?.paid_at || new Date().toISOString()) : null,
    };

    const { error } = await supabase.from('acc_salary_records' as any)
      .upsert(payload as any, { onConflict: 'person_id,month,year' });
    if (error) throw error;

    const changeParts: string[] = [];
    if (newBonus !== existingBonus) changeParts.push(`বোনাস ৳${existingBonus} → ৳${newBonus}`);
    if (newOvertime !== existingOvertime) changeParts.push(`ওভারটাইম ৳${existingOvertime} → ৳${newOvertime}`);
    logAccActivity({
      action: existing ? 'update' : 'create', entity_type: 'salary',
      entity_name: `${monthNames[currentMonth]} ${currentYear} বেতন — ${person.name}`,
      description: changeParts.join(', '),
      old_data: existing ? { bonus_amount: existingBonus, overtime_amount: existingOvertime } : undefined,
      new_data: { person_id: id, person_name: person.name, bonus_amount: newBonus, overtime_amount: newOvertime },
    });
  };

  const handleSaveBonus = async () => {
    const amt = Number(bonusAmount);
    if (!amt || amt <= 0) { toast.error('সঠিক টাকার অংক দিন'); return; }
    setSavingAction(true);
    try {
      await upsertCurrentMonthAdjustment({ bonusDelta: amt, bonusNoteAppend: bonusNote });
      toast.success('বোনাস বেতনের সাথে যোগ হয়েছে');
      invalidateAll();
      resetPanels();
    } catch (e: any) {
      toast.error(e?.message || 'বোনাস সেভ হয়নি');
    }
    setSavingAction(false);
  };

  const handleEditBonus = async () => {
    const amt = Number(bonusAmount) || 0;
    setSavingAction(true);
    try {
      await upsertCurrentMonthAdjustment({ bonusSet: amt, bonusNoteSet: amt > 0 ? (bonusNote || null) : null });
      toast.success('বোনাস আপডেট হয়েছে');
      invalidateAll();
      resetPanels();
    } catch (e: any) {
      toast.error(e?.message || 'আপডেট হয়নি');
    }
    setSavingAction(false);
  };

  const handleDeleteBonus = async () => {
    setSavingAction(true);
    try {
      await upsertCurrentMonthAdjustment({ bonusSet: 0, bonusNoteSet: null });
      toast.success('বোনাস মুছে ফেলা হয়েছে');
      invalidateAll();
      resetPanels();
    } catch (e: any) {
      toast.error(e?.message || 'মুছতে সমস্যা');
    }
    setSavingAction(false);
  };

  const handleSaveOvertime = async () => {
    const amt = Number(otAmount) || 0;
    if (amt <= 0) { toast.error('টাকা দিন'); return; }
    setSavingAction(true);
    try {
      await upsertCurrentMonthAdjustment({ overtimeDelta: amt, overtimeNoteAppend: otNote });
      toast.success('ওভারটাইম বেতনের সাথে যোগ হয়েছে');
      invalidateAll();
      resetPanels();
    } catch (e: any) {
      toast.error(e?.message || 'ওভারটাইম সেভ হয়নি');
    }
    setSavingAction(false);
  };

  const handleEditOvertime = async () => {
    const amt = Number(otAmount) || 0;
    setSavingAction(true);
    try {
      await upsertCurrentMonthAdjustment({ overtimeSet: amt, overtimeNoteSet: amt > 0 ? (otNote || null) : null });
      toast.success('ওভারটাইম আপডেট হয়েছে');
      invalidateAll();
      resetPanels();
    } catch (e: any) {
      toast.error(e?.message || 'আপডেট হয়নি');
    }
    setSavingAction(false);
  };

  const handleDeleteOvertime = async () => {
    setSavingAction(true);
    try {
      await upsertCurrentMonthAdjustment({ overtimeSet: 0, overtimeNoteSet: null });
      toast.success('ওভারটাইম মুছে ফেলা হয়েছে');
      invalidateAll();
      resetPanels();
    } catch (e: any) {
      toast.error(e?.message || 'মুছতে সমস্যা');
    }
    setSavingAction(false);
  };


  const handleSavePay = async () => {
    const amt = Number(payAmount2);
    if (!amt || amt <= 0) { toast.error('সঠিক টাকার অংক দিন'); return; }
    setSavingAction(true);
    const ok = await insertTxn('advance', amt, `অ্যাডভান্স${payNote2 ? ' — ' + payNote2 : ''}`);
    setSavingAction(false);
    if (ok) { toast.success('অ্যাডভান্স রেকর্ড হয়েছে'); invalidateAll(); resetPanels(); }
  };

  // Save manually entered "এই মাসে নিয়েছে" amount + note — display-only, no transaction.
  const handleSaveReceived = async () => {
    const amt = Number(receivedAmount);
    if (Number.isNaN(amt) || amt < 0) { toast.error('সঠিক টাকার অংক দিন'); return; }
    setSavingAction(true);
    try {
      // Ensure a salary row exists for this month so we can persist the value
      const { data: existing } = await (supabase.from('acc_salary_records' as any) as any)
        .select('id').eq('person_id', id).eq('month', currentMonth).eq('year', currentYear).maybeSingle();
      if (existing?.id) {
        const { error } = await supabase.from('acc_salary_records' as any)
          .update({ received_amount: amt, received_note: receivedNote || null } as any)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const totalDays = new Date(currentYear, currentMonth, 0).getDate();
        const baseSalary = person.base_salary || 0;
        const { error } = await supabase.from('acc_salary_records' as any).insert({
          person_id: id, month: currentMonth, year: currentYear,
          working_days: totalDays, present_days: 0, absent_days: 0, off_days: 0,
          base_salary: baseSalary, deduction: 0, final_salary: baseSalary,
          paid_amount: 0, is_paid: false,
          received_amount: amt, received_note: receivedNote || null,
        } as any);
        if (error) throw error;
      }
      logAccActivity({
        action: existing?.id ? 'update' : 'create', entity_type: 'salary',
        entity_name: `${monthNames[currentMonth]} ${currentYear} বেতন — ${person.name}`,
        description: `এই মাসে নিয়েছে: ৳${amt}${receivedNote ? ` — ${receivedNote}` : ''}`,
        new_data: { person_id: id, person_name: person.name, received_amount: amt, received_note: receivedNote || null },
      });
      toast.success('সংরক্ষণ হয়েছে');
      invalidateAll();
      resetPanels();
    } catch (e: any) {
      toast.error(e?.message || 'সেভ হয়নি');
    }
    setSavingAction(false);
  };

  // Save advance amount for salary-slip clearance only — no cash transaction is created.
  const handleSaveAdvance = async () => {
    const amt = Number(advanceAmount);
    if (Number.isNaN(amt) || amt < 0) { toast.error('সঠিক টাকার অংক দিন'); return; }
    setSavingAction(true);
    try {
      const { data: existing } = await (supabase.from('acc_salary_records' as any) as any)
        .select('id, paid_amount').eq('person_id', id).eq('month', currentMonth).eq('year', currentYear).maybeSingle();
      const totalDays = new Date(currentYear, currentMonth, 0).getDate();
      const baseSalary = person.base_salary || 0;
      const finalSalary = Math.max(0, baseSalary + Number((existing as any)?.bonus_amount || 0) + Number((existing as any)?.overtime_amount || 0));
      if (existing?.id) {
        const { error } = await supabase.from('acc_salary_records' as any)
          .update({ advance_amount: amt, advance_note: advanceNote || null } as any)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('acc_salary_records' as any).insert({
          person_id: id, month: currentMonth, year: currentYear,
          working_days: totalDays, present_days: 0, absent_days: 0, off_days: 0,
          base_salary: baseSalary, deduction: 0, final_salary: finalSalary,
          paid_amount: 0, is_paid: false,
          advance_amount: amt, advance_note: advanceNote || null,
        } as any);
        if (error) throw error;
      }
      logAccActivity({
        action: existing?.id ? 'update' : 'create', entity_type: 'salary',
        entity_name: `${monthNames[currentMonth]} ${currentYear} বেতন — ${person.name}`,
        description: `অগ্রিম: ৳${amt}${advanceNote ? ` — ${advanceNote}` : ''}`,
        new_data: { person_id: id, person_name: person.name, advance_amount: amt, advance_note: advanceNote || null },
      });
      toast.success('অগ্রিম সংরক্ষণ হয়েছে');
      invalidateAll();
      resetPanels();
    } catch (e: any) {
      toast.error(e?.message || 'অগ্রিম সেভ হয়নি');
    }
    setSavingAction(false);
  };



  const handleSaveIncrement = async () => {
    const add = Number(incAdd);
    const oldSalary = person.base_salary || 0;
    if (!add || add <= 0) { toast.error('বাড়ানোর অংক দিন'); return; }
    try {
      await createIncrement.mutateAsync({
        person_id: id,
        old_salary: oldSalary,
        new_salary: oldSalary + add,
        effective_date: incDate,
        note: incNote || undefined,
      });
      toast.success('বেতন বাড়ানো হয়েছে');
      setIncOpen(false);
      setIncAdd(''); setIncNote(''); setIncDate(toLocalDateStr());
    } catch (e: any) { toast.error(e?.message || 'সমস্যা হয়েছে'); }
  };



  useEffect(() => {
    setDutyStart(defaultDutyStart);
    setDutyEnd(defaultDutyEnd);
  }, [defaultDutyStart, defaultDutyEnd]);

  const handleJoiningDateSave = async () => {
    if (!editingJoiningDate) return;
    const dateStr = format(editingJoiningDate, 'yyyy-MM-dd');
    try {
      await updatePerson.mutateAsync({ id, joining_date: dateStr });
      toast.success('যোগদানের তারিখ আপডেট হয়েছে');
      setJoiningDateOpen(false);
    } catch {
      toast.error('আপডেট ব্যর্থ');
    }
  };

  const handlePhoneSave = async () => {
    try {
      await updatePerson.mutateAsync({ id, phone: editingPhone.trim() || null });
      toast.success('নম্বর আপডেট হয়েছে');
      setPhoneOpen(false);
    } catch {
      toast.error('আপডেট ব্যর্থ');
    }
  };

  const handleOffDayToggle = async (dayNum: number) => {
    const isSelected = offDays.includes(dayNum);
    if (isSelected) {
      await (supabase.from('acc_off_days' as any) as any).delete().eq('person_id', id).eq('day_of_week', dayNum);
    } else {
      await supabase.from('acc_off_days' as any).insert({ person_id: id, day_of_week: dayNum } as any);
    }
    qc.invalidateQueries({ queryKey: ['acc-off-days', id] });
  };

  const handleDutyTimeSave = async () => {
    try {
      await updatePerson.mutateAsync({ id, duty_start: dutyStart, duty_end: dutyEnd } as any);
      toast.success('ডিউটি টাইম আপডেট হয়েছে');
    } catch {
      toast.error('আপডেট ব্যর্থ');
    }
  };

  const isDebit = (type: string) => ['salary', 'production_payment', 'party_payment', 'expense', 'advance', 'bonus'].includes(type);
  const latestIncrement = increments.length > 0 ? (increments as any[])[0] : null;
  const incrementAmount = latestIncrement ? latestIncrement.new_salary - latestIncrement.old_salary : 0;
  const workDuration = getWorkDuration(person.joining_date);

  const personDutyStart = person.duty_start || (unitSettingsData as any).duty_start || '09:00';
  const personDutyEnd = person.duty_end || (unitSettingsData as any).duty_end || '18:00';

  // Generate auto attendance from joining_date to today (or resigned_at if inactive)
  const autoAttendanceItems = useMemo(() => {
    if (!person.joining_date) return [];
    const start = parseISO(person.joining_date);
    const today = new Date();
    // If person is inactive and has resigned_at, limit attendance to that date
    let endDate = today;
    if (!person.is_active && person.resigned_at) {
      const resignedDate = new Date(person.resigned_at);
      if (resignedDate < today) endDate = resignedDate;
    }
    if (start > endDate) return [];

    const allDays = eachDayOfInterval({ start, end: endDate });
    const attendanceMap = new Map<string, any>();
    attendance.forEach((a: any) => attendanceMap.set(a.date, a));

    const offDaySet = new Set<number>(offDays.length > 0 ? offDays : [5]);

    return allDays.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const existing = attendanceMap.get(dateStr);
      const dayOfWeek = getDay(day);
      if (existing) {
        return { id: existing.id, date: dateStr, status: existing.status, check_in: existing.check_in, check_out: existing.check_out, isAuto: false, dayOfWeek };
      }
      if (offDaySet.has(dayOfWeek)) {
        return { id: `auto-off-${dateStr}`, date: dateStr, status: 'off_day', check_in: null, check_out: null, isAuto: true, dayOfWeek };
      }
      return { id: `auto-present-${dateStr}`, date: dateStr, status: 'present', check_in: null, check_out: null, isAuto: true, dayOfWeek };
    });
  }, [person.joining_date, person.is_active, person.resigned_at, attendance, offDays]);

  // Calculate overtime
  const overtimeData = useMemo(() => {
    let totalMinutes = 0;
    const offDaySet = new Set<number>(offDays.length > 0 ? offDays : [5]);
    const [endH, endM] = personDutyEnd.split(':').map(Number);

    autoAttendanceItems.forEach(item => {
      if (!item.check_out) return;
      const checkOut = new Date(item.check_out);
      const dateObj = parseISO(item.date);
      const dutyEndTime = new Date(dateObj);
      dutyEndTime.setHours(endH, endM, 0, 0);

      if (offDaySet.has(item.dayOfWeek) && item.check_in) {
        // Working on off day = all time is overtime
        const checkIn = new Date(item.check_in);
        const mins = differenceInMinutes(checkOut, checkIn);
        if (mins > 0) totalMinutes += mins;
      } else if (checkOut > dutyEndTime) {
        const mins = differenceInMinutes(checkOut, dutyEndTime);
        if (mins > 0) totalMinutes += mins;
      }
    });

    return { totalMinutes, hours: Math.floor(totalMinutes / 60), mins: totalMinutes % 60 };
  }, [autoAttendanceItems, offDays, personDutyEnd]);

  // Salary balance calculation per month
  // Resolve the base salary that was effective for a given (year, month).
  // Picks the most recent increment whose effective_date <= last day of that month;
  // falls back to the earliest increment's old_salary, then to the stored record value.
  const getEffectiveBase = (year: number, month: number, fallback: number): number => {
    if (!increments || (increments as any[]).length === 0) return fallback;
    const monthEnd = new Date(year, month, 0); // last day of month
    const sorted = [...(increments as any[])].sort(
      (a, b) => new Date(a.effective_date).getTime() - new Date(b.effective_date).getTime()
    );
    let eff: number | null = null;
    for (const inc of sorted) {
      if (new Date(inc.effective_date) <= monthEnd) eff = Number(inc.new_salary);
      else break;
    }
    if (eff != null) return eff;
    // increment exists but all are AFTER this month → use earliest old_salary
    return Number(sorted[0].old_salary) || fallback;
  };

  const salaryBalanceData = useMemo(() => {
    if (!monthlySummary) return [];
    return monthlySummary.salaryRecords.map((rec: any) => {
      // count attendance stats from autoAttendanceItems for this month
      const monthItems = autoAttendanceItems.filter(a => {
        const d = parseISO(a.date);
        return d.getMonth() + 1 === rec.month && d.getFullYear() === rec.year;
      });
      const offCount = monthItems.filter(a => a.status === 'off_day').length;
      const lateCount = monthItems.filter(a => a.status === 'late').length;
      const presentCount = monthItems.filter(a => a.status === 'present').length;
      const mTotalDays = getDaysInMonth(new Date(rec.year, rec.month - 1));
      const _now = new Date();
      const isCurrent = rec.year === _now.getFullYear() && rec.month === (_now.getMonth() + 1);
      const elapsedDays = isCurrent ? _now.getDate() : mTotalDays;
      const absentCount = Math.max(0, elapsedDays - presentCount - offCount - lateCount);

      // The real, allocation-tracked amount for this month (see
      // allocatePaymentToSalaryRecords) — not a guess based on which
      // calendar month a transaction happened to be dated in, since a
      // payment made in August can legitimately settle a June debt.
      const totalPaid = Number(rec.paid_amount || 0);

      // Use the base salary that was effective in this specific month
      // (handles raises applied retroactively that didn't update old records)
      const effectiveBase = getEffectiveBase(rec.year, rec.month, Number(rec.base_salary) || 0);
      const perDay = mTotalDays > 0 ? effectiveBase / mTotalDays : 0;
      const dutyDays = presentCount + offCount + lateCount;
      const bonusAmt = Number((rec as any).bonus_amount || 0);
      const overtimeAmt = Number((rec as any).overtime_amount || 0);
      const recalcFromAttendance = Math.round(dutyDays * perDay) + bonusAmt + overtimeAmt;
      const storedFinal = Number(rec.final_salary || 0);
      const countsMismatch = Number(rec.present_days || 0) !== (presentCount + lateCount)
        || Number(rec.off_days || 0) !== offCount
        || Number(rec.absent_days || 0) !== absentCount;
      const recalcFinal = countsMismatch || storedFinal <= 0 ? recalcFromAttendance : salaryFormulaFinal(rec);
      const balance = recalcFinal - totalPaid;

      return {
        ...rec,
        effectiveBase,
        offCount, absentCount, lateCount, presentCount,
        totalPaid, recalcFinal,
        bonusAmt, overtimeAmt,
        balance,
      };
    });
  }, [monthlySummary, autoAttendanceItems, increments, person.is_active, person.resigned_at]);


  return (
    <div className="space-y-4">
      <ProfileToolbar personId={person?.id} personName={person?.name} personCode={person?.person_code} />
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <BrandedHeader person={person} actions={
            <>
              {!person.is_active && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-950/30"
                  onClick={() => { setRejoinDate(undefined); setRejoinOpen(true); }}
                >
                  🔄 পুনরায় জয়েন
                </Button>
              )}
              <button onClick={() => setShowSettings(!showSettings)} className="p-1 rounded hover:bg-muted text-muted-foreground">
                <Settings2 className="h-4 w-4" />
              </button>
            </>
          } />

          {/* Settings Panel */}
          {showSettings && (
            <div className="border-b border-border px-4 py-3 bg-muted/20 space-y-3">
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1.5">সাপ্তাহিক বন্ধ</div>
                <div className="flex flex-wrap gap-2">
                  {[5, 6, 0, 1, 2, 3, 4].map(d => (
                    <label key={d} className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <Checkbox
                        checked={offDays.includes(d)}
                        onCheckedChange={() => handleOffDayToggle(d)}
                      />
                      {dayNamesBn[d]}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1.5">
                  ডিউটি টাইম
                  {!person.duty_start && (unitSettingsData as any).duty_start && (
                    <span className="text-[10px] text-muted-foreground/60 ml-1">(ইউনিট ডিফল্ট)</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Input type="time" value={dutyStart} onChange={e => setDutyStart(e.target.value)} className="w-28 h-8 text-xs" />
                  <span className="text-xs text-muted-foreground">থেকে</span>
                  <Input type="time" value={dutyEnd} onChange={e => setDutyEnd(e.target.value)} className="w-28 h-8 text-xs" />
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleDutyTimeSave}>সেভ</Button>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-4 divide-x divide-border border-b border-border">
            <div className="px-3 py-2.5">
              <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                📅 যোগদান
                <Popover open={joiningDateOpen} onOpenChange={setJoiningDateOpen}>
                  <PopoverTrigger asChild>
                    <button className="text-primary hover:text-primary/80 p-0.5" onClick={() => setEditingJoiningDate(person.joining_date ? new Date(person.joining_date) : undefined)}>
                      <Pencil className="h-3 w-3" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={editingJoiningDate}
                      onSelect={setEditingJoiningDate}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                    <div className="flex justify-end gap-2 p-2 border-t">
                      <Button size="sm" variant="ghost" onClick={() => setJoiningDateOpen(false)}>বাতিল</Button>
                      <Button size="sm" onClick={handleJoiningDateSave} disabled={updatePerson.isPending}>সেভ</Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="text-sm font-semibold">{person.joining_date ? format(new Date(person.joining_date), 'dd MMM yyyy', { locale: bn }) : '—'}</div>
            </div>
            <div className="px-3 py-2.5">
              <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                📞 যোগাযোগ
                <Popover open={phoneOpen} onOpenChange={(o) => { setPhoneOpen(o); if (o) setEditingPhone(person.phone || ''); }}>
                  <PopoverTrigger asChild>
                    <button className="text-primary hover:text-primary/80 p-0.5"><Pencil className="h-3 w-3" /></button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-2" align="start">
                    <Input value={editingPhone} onChange={e => setEditingPhone(e.target.value)} placeholder="ফোন নম্বর" className="h-8 text-sm" autoFocus />
                    <div className="flex justify-end gap-2 pt-2">
                      <Button size="sm" variant="ghost" onClick={() => setPhoneOpen(false)}>বাতিল</Button>
                      <Button size="sm" onClick={handlePhoneSave} disabled={updatePerson.isPending}>সেভ</Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="text-sm font-semibold">{person.phone || '—'}</div>
            </div>
            <div className="px-3 py-2.5">
              <div className="text-[11px] text-muted-foreground">⏱️ কর্মকাল</div>
              <div className="text-sm font-semibold">{workDuration}</div>
            </div>
            <div className="px-3 py-2.5">
              <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                💰 বেতন
                <Popover open={incOpen} onOpenChange={(o) => { setIncOpen(o); if (o) { setIncAdd(''); setIncNote(''); setIncDate(toLocalDateStr()); } }}>
                  <PopoverTrigger asChild>
                    <button className="text-green-600 hover:text-green-700 text-[10px] font-bold ml-1 px-1.5 py-0.5 rounded bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                      + বাড়ান
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-3" align="start">
                    <div className="text-xs font-bold text-center border-b pb-1.5 mb-2">─── বেতন বাড়ান ───</div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between bg-muted/40 rounded p-2">
                        <span className="text-muted-foreground">বর্তমান বেতন</span>
                        <span className="font-bold">৳{(person.base_salary || 0).toLocaleString()}</span>
                      </div>
                      <div>
                        <label className="block text-muted-foreground mb-1">কত টাকা বাড়াবেন?</label>
                        <Input type="number" inputMode="numeric" value={incAdd} onChange={e => setIncAdd(e.target.value)} placeholder="যেমন: 1000" className="h-8 text-sm" autoFocus />
                      </div>
                      <div className="flex justify-between bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded p-2">
                        <span className="text-muted-foreground">নতুন বেতন হবে</span>
                        <span className="text-lg font-extrabold text-green-700 dark:text-green-400">
                          ৳{((person.base_salary || 0) + (Number(incAdd) || 0)).toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <label className="block text-muted-foreground mb-1">কার্যকর তারিখ</label>
                        <Input type="date" value={incDate} onChange={e => setIncDate(e.target.value)} className="h-8 text-sm" />
                      </div>
                      <div>
                        <label className="block text-muted-foreground mb-1">নোট (ঐচ্ছিক)</label>
                        <Input value={incNote} onChange={e => setIncNote(e.target.value)} placeholder="যেমন: ভালো কাজের জন্য" className="h-8 text-sm" />
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
              <div className="text-sm font-semibold flex items-center gap-1">
                ৳{(person.base_salary || 0).toLocaleString()}
                {incrementAmount > 0 && latestIncrement && (
                  <button
                    type="button"
                    title="বেতন বৃদ্ধি এডিট/ডিলিট করুন"
                    className="text-green-600 dark:text-green-400 text-xs ml-1 inline-flex items-center gap-0.5 px-1 py-0.5 rounded hover:bg-green-50 dark:hover:bg-green-950/30 border border-transparent hover:border-green-200 dark:hover:border-green-800"
                    onClick={() => {
                      setEditIncId(latestIncrement.id);
                      setEditIncOldSalary(Number(latestIncrement.old_salary) || 0);
                      setEditIncNewSalary(String(latestIncrement.new_salary));
                      setEditIncDate(latestIncrement.effective_date);
                      setEditIncNote(latestIncrement.note || '');
                    }}
                  >
                    +{incrementAmount.toLocaleString()}
                    <Pencil className="h-3 w-3 opacity-70" />
                  </button>
                )}
              </div>
            </div>

          </div>
          {(() => {
            const now = new Date();
            const currentM = now.getMonth() + 1;
            const currentY = now.getFullYear();
            const completedData = !person.is_active
              ? salaryBalanceData
              : salaryBalanceData.filter((d: any) =>
                  d.year < currentY || (d.year === currentY && d.month < currentM)
                );
            const recalcTotal = completedData.reduce((s: number, d: any) => s + (d.recalcFinal || 0), 0);
            const submission = financial?.submission || 0;
            const equale = recalcTotal - submission;
            return (
              <div className="grid grid-cols-3 gap-1 p-2">
                <div className="px-3 py-3 bg-amber-50 dark:bg-amber-950/30 text-center rounded-lg shadow-sm border border-amber-200/50 dark:border-amber-800/30">
                  <div className="text-[10px] text-muted-foreground mb-1">💵 মোট বেতন</div>
                  <div className="text-lg font-extrabold text-amber-700 dark:text-amber-400">৳{recalcTotal.toLocaleString()}</div>
                </div>
                <div className="px-3 py-3 bg-blue-50 dark:bg-blue-950/30 text-center rounded-lg shadow-sm border border-blue-200/50 dark:border-blue-800/30">
                  <div className="text-[10px] text-muted-foreground mb-1">🏦 জমা</div>
                  <div className="text-lg font-extrabold text-blue-700 dark:text-blue-400">৳{submission.toLocaleString()}</div>
                </div>
                <div className={"px-3 py-3 text-center rounded-lg shadow-sm border " + (equale >= 0 ? 'bg-green-50 dark:bg-green-950/30 border-green-200/50 dark:border-green-800/30' : 'bg-red-50 dark:bg-red-950/30 border-red-200/50 dark:border-red-800/30')}>
                  <div className="text-[10px] text-muted-foreground mb-1">{equale >= 0 ? '✅' : '⚠️'} {equale >= 0 ? 'পাওনা' : 'বেশি নিয়েছে'}</div>
                  <div className={"text-lg font-extrabold " + (equale >= 0 ? 'text-green-700 dark:text-green-400' : 'text-destructive')}>
                    {equale < 0 ? '-' : ''}৳{Math.abs(equale).toLocaleString()}
                  </div>
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Overtime Balance Card */}
      {overtimeData.totalMinutes > 0 && (
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-bold">ওভারটাইম ব্যালেন্স</span>
              </div>
              <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                {overtimeData.hours} ঘণ্টা {overtimeData.mins > 0 ? `${overtimeData.mins} মিনিট` : ''}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Running / Closed Month Card */}
      {(() => {
        // If person is inactive (closed), show closed card
        if (!person.is_active && person.resigned_at) {
          const resignedDate = new Date(person.resigned_at);
          const closedMonth = resignedDate.getMonth() + 1;
          const closedYear = resignedDate.getFullYear();
          const closedRec = salaryBalanceData.find((r: any) => r.month === closedMonth && r.year === closedYear);

          const cTotalDays = getDaysInMonth(new Date(closedYear, closedMonth - 1));
          const cMonthAtt = autoAttendanceItems.filter(a => {
            const d = parseISO(a.date);
            return d.getMonth() + 1 === closedMonth && d.getFullYear() === closedYear;
          });
          const cPresent = closedRec?.presentCount ?? cMonthAtt.filter(a => a.status === 'present').length;
          const cOff = closedRec?.offCount ?? cMonthAtt.filter(a => a.status === 'off_day').length;
          const cLate = closedRec?.lateCount ?? cMonthAtt.filter(a => a.status === 'late').length;
          const cAbsent = closedRec?.absentCount ?? Math.max(0, resignedDate.getDate() - cPresent - cOff - cLate);
          const cSalary = closedRec?.recalcFinal ?? closedRec?.final_salary ?? 0;
          const cPaid = closedRec?.totalPaid ?? 0;
          const cBalance = cSalary - cPaid;

          // Detailed calculation values
          const cBaseSalary = closedRec?.base_salary ?? person.base_salary ?? 0;
          const cPerDay = cTotalDays > 0 ? cBaseSalary / cTotalDays : 0;
          const cDutyDays = cPresent + cOff + cLate;
          const cCalculatedSalary = Math.round(cDutyDays * cPerDay);

          // Payment breakdown by type
          const cStartDate = new Date(closedYear, closedMonth - 1, 1);
          const cEndDate = new Date(closedYear, closedMonth, 1);
          const cMonthTx = (monthlySummary?.transactions || []).filter((t: any) => {
            const d = new Date(t.created_at);
            return d >= cStartDate && d < cEndDate;
          });
          const cAdvance = cMonthTx.filter((t: any) => t.type === 'advance').reduce((s: number, t: any) => s + Number(t.amount), 0);
          const cSalaryPay = cMonthTx.filter((t: any) => t.type === 'salary').reduce((s: number, t: any) => s + Number(t.amount), 0);
          const cExpense = cMonthTx.filter((t: any) => t.type === 'expense').reduce((s: number, t: any) => s + Number(t.amount), 0);
          const cBonusPay = cMonthTx.filter((t: any) => t.type === 'bonus').reduce((s: number, t: any) => s + Number(t.amount), 0);
          const cOtherPay = cPaid - cAdvance - cSalaryPay - cExpense - cBonusPay;

          // Settlement note from activity logs
          const settlementLog = settlementLogs?.find((l: any) => true);
          const settlementNoteText = settlementLog?.description || (settlementLog?.new_data as any)?.note || '';

          return (
            <Card className="border-destructive/30">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-destructive" />
                    <span className="text-sm font-bold">{monthNames[closedMonth]} {closedYear} — হিসাব বন্ধ</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400">
                    ⛔ Closed — {format(resignedDate, 'dd MMM yyyy', { locale: bn })}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1 text-[11px] mb-2">
                  <div className="text-center p-1 rounded bg-green-50 dark:bg-green-950/20">
                    <div className="text-muted-foreground">উপস্থিত</div>
                    <div className="font-bold text-green-700 dark:text-green-400">{cPresent}</div>
                  </div>
                  <div className="text-center p-1 rounded bg-blue-50 dark:bg-blue-950/20">
                    <div className="text-muted-foreground">ছুটি</div>
                    <div className="font-bold text-blue-700 dark:text-blue-400">{cOff}</div>
                  </div>
                  <div className="text-center p-1 rounded bg-red-50 dark:bg-red-950/20">
                    <div className="text-muted-foreground">অনুপস্থিত</div>
                    <div className="font-bold text-red-700 dark:text-red-400">{cAbsent}</div>
                  </div>
                  <div className="text-center p-1 rounded bg-yellow-50 dark:bg-yellow-950/20">
                    <div className="text-muted-foreground">লেট</div>
                    <div className="font-bold text-yellow-700 dark:text-yellow-400">{cLate}</div>
                  </div>
                </div>

                {/* Salary Calculation Details */}
                <div className="text-xs space-y-1 bg-muted/50 rounded p-2">
                  <div className="flex justify-between text-muted-foreground">
                    <span>📅 মাসে {cTotalDays} দিন, কাজ {cDutyDays} দিন</span>
                    <span>দৈনিক ৳{Math.round(cPerDay).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>{cDutyDays} দিন × ৳{Math.round(cPerDay).toLocaleString()}</span>
                    <span>= ৳{cCalculatedSalary.toLocaleString()}</span>
                  </div>
                  {cSalary !== cCalculatedSalary && (
                    <div className="flex justify-between text-amber-600 dark:text-amber-400">
                      <span>⚡ সেটেলমেন্ট ওভাররাইড</span>
                      <span>৳{cSalary.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="border-t border-border pt-1 flex justify-between font-bold">
                    <span>চূড়ান্ত বেতন</span>
                    <span>৳{cSalary.toLocaleString()}</span>
                  </div>
                </div>

                {/* Payment Breakdown */}
                <div className="text-xs space-y-0.5 mt-1.5">
                  <div className="text-[10px] font-medium text-muted-foreground mb-0.5">💰 জমা ব্রেকডাউন:</div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 bg-muted/30 rounded p-1.5">
                    {cSalaryPay > 0 && <div className="flex justify-between"><span className="text-muted-foreground">বেতন</span><span className="font-medium">৳{cSalaryPay.toLocaleString()}</span></div>}
                    {cAdvance > 0 && <div className="flex justify-between"><span className="text-muted-foreground">অ্যাডভান্স</span><span className="font-medium">৳{cAdvance.toLocaleString()}</span></div>}
                    {cExpense > 0 && <div className="flex justify-between"><span className="text-muted-foreground">খরচ</span><span className="font-medium">৳{cExpense.toLocaleString()}</span></div>}
                    {cBonusPay > 0 && <div className="flex justify-between"><span className="text-muted-foreground">বোনাস</span><span className="font-medium">৳{cBonusPay.toLocaleString()}</span></div>}
                    {cOtherPay > 0 && <div className="flex justify-between"><span className="text-muted-foreground">অন্যান্য</span><span className="font-medium">৳{cOtherPay.toLocaleString()}</span></div>}
                    {cPaid === 0 && <div className="text-muted-foreground col-span-2 text-center">কোনো জমা নেই</div>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs mt-1.5">
                  <div>
                    <span className="text-muted-foreground">মোট জমা: </span>
                    <span className="font-bold text-green-600 dark:text-green-400">৳{cPaid.toLocaleString()}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-muted-foreground">{cBalance > 0 ? 'পাওনা' : 'অতিরিক্ত'}: </span>
                    <span className={`font-bold ${cBalance > 0 ? 'text-destructive' : 'text-green-600 dark:text-green-400'}`}>
                      ৳{Math.abs(cBalance).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Settlement Note */}
                {settlementNoteText && (
                  <div className="text-xs bg-amber-50 dark:bg-amber-950/20 rounded p-2 mt-1.5 border border-amber-200 dark:border-amber-800/30">
                    <span className="text-muted-foreground">📝 নোট:</span> <span>{settlementNoteText}</span>
                  </div>
                )}

                <div className="flex gap-2 mt-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-7 text-xs"
                    onClick={() => {
                      setSettleDate(resignedDate);
                      setSettleAmount(closedRec?.final_salary ? String(closedRec.final_salary) : '');
                      setSettleNote('');
                      setSettleOpen(true);
                    }}
                  >
                    ✏️ এডিট ক্লোজিং
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        }

        // Active person — show running card
        const runningRec = salaryBalanceData.find((r: any) => r.month === currentMonth && r.year === currentYear);
        const currentMonthAtt = autoAttendanceItems.filter(a => {
          const d = parseISO(a.date);
          return d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear;
        });
        const rPresent = runningRec?.presentCount ?? currentMonthAtt.filter(a => a.status === 'present').length;
        const rOff = runningRec?.offCount ?? currentMonthAtt.filter(a => a.status === 'off_day').length;
        const rLate = runningRec?.lateCount ?? currentMonthAtt.filter(a => a.status === 'late').length;
        const rBaseSalary = person.base_salary || 0;
        const rTotalDays = getDaysInMonth(new Date(currentYear, currentMonth - 1));
        // For the running month, treat only days up to today as candidates for absent.
        const _rToday = new Date();
        const _rIsCurrent = currentYear === _rToday.getFullYear() && currentMonth === (_rToday.getMonth() + 1);
        const rElapsedDays = _rIsCurrent ? _rToday.getDate() : rTotalDays;
        const rAbsent = runningRec?.absentCount ?? Math.max(0, rElapsedDays - rPresent - rOff - rLate);
        const rPerDay = rTotalDays > 0 ? rBaseSalary / rTotalDays : 0;
        const rDeduction = rPerDay * rAbsent;
        const rBonus = Number((runningRec as any)?.bonus_amount || 0);
        const rOvertime = Number((runningRec as any)?.overtime_amount || 0);
        const rBonusNote = (runningRec as any)?.bonus_note || '';
        const rOvertimeNote = (runningRec as any)?.overtime_note || '';
        const rSalary = (runningRec as any)?.recalcFinal ?? (Math.round(rBaseSalary - rDeduction) + rBonus + rOvertime);
        // Manual "received this month" note, plus whatever's actually been
        // allocated to this month via allocatePaymentToSalaryRecords — the
        // two are separate, non-overlapping entry paths so they add up.
        const rReceived = Number((runningRec as any)?.received_amount || 0);
        const rReceivedNote = (runningRec as any)?.received_note || '';
        const rAdvance = Number((runningRec as any)?.advance_amount || 0);
        const rAdvanceNote = (runningRec as any)?.advance_note || '';
        const rPaid = Number((runningRec as any)?.paid_amount || 0) + rReceived;
        const rBalance = rSalary - rPaid - rAdvance;

        const rDutyDays = rPresent + rOff + rLate;
        const rEarned = Math.round(rDutyDays * rPerDay);

        const buildRunningSlipInput = (extra: { pay_now_amount?: number; pay_now_note?: string | null; mark_paid?: boolean }) => {
          const brandBn = (navbarConfig as any)?.brand_name || DEFAULT_NAVBAR_CONFIG.brand_name;
          const brandEn = (navbarConfig as any)?.brand_name_en || DEFAULT_NAVBAR_CONFIG.brand_name_en;
          return {
            personName: person.name,
            personId: person.id,
            personCode: person.person_code || undefined,
            role: (person as any).type === 'staff' ? 'কর্মচারী'
              : (person as any).type === 'employee' ? 'কর্মচারী'
              : (person as any).type === 'salaried_production' ? 'উৎপাদন কর্মী'
              : ((person as any).type || ''),
            joiningDate: person.joining_date,
            unitName: (person.acc_units as any)?.name || (person as any)?.unit_name || null,
            brandNameBn: brandBn,
            brandNameEn: brandEn,
            badgeLabel: '🔄 চলতি মাস',
            record: {
              month: currentMonth,
              year: currentYear,
              working_days: rTotalDays - rOff,
              present_days: rPresent + rLate,
              absent_days: rAbsent,
              off_days: rOff,
              base_salary: rBaseSalary,
              deduction: Math.round(rDeduction),
              bonus_amount: rBonus,
              bonus_note: rBonusNote || null,
              overtime_amount: rOvertime,
              overtime_note: rOvertimeNote || null,
              received_amount: rPaid,
              received_note: rReceivedNote || null,
              advance_amount: rAdvance,
              advance_note: rAdvanceNote || null,
              final_salary: rSalary,
              ...extra,
            },
            totalDaysInMonth: rTotalDays,
          };
        };
        const handlePrintRunning = () => {
          openPrintDlg({
            kind: 'running',
            oldBalance: Math.max(0, rBalance),
            build: buildRunningSlipInput,
          });
        };


        return (
          <Card className="border-primary/30">
            <CardContent className="p-3" id="running-summary-print">
              {/* Header */}
              <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-primary" />
                  <span className="text-base font-bold">{monthNames[currentMonth]} {currentYear} — চলতি মাস</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400">
                    🔄 চলমান
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={handlePrintRunning}>
                    🖨️ প্রিন্ট
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs px-2 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => { setSettleDate(undefined); setSettleAmount(''); setSettleNote(''); setSettleOpen(true); }}>
                    ⛔ হিসাব শেষ
                  </Button>
                </div>
              </div>

              {/* Attendance — compact pill strip */}
              <div className="flex items-center justify-around gap-2 mb-2.5 py-2 px-3 rounded-lg bg-muted/40 border border-border/50">
                <div className="text-center">
                  <div className="text-[10px] text-muted-foreground">উপস্থিত</div>
                  <div className="text-lg font-bold text-green-700 dark:text-green-400">{rPresent}</div>
                </div>
                <div className="h-8 w-px bg-border/60" />
                <div className="text-center">
                  <div className="text-[10px] text-muted-foreground">ছুটি</div>
                  <div className="text-lg font-bold text-blue-700 dark:text-blue-400">{rOff}</div>
                </div>
                <div className="h-8 w-px bg-border/60" />
                <div className="text-center">
                  <div className="text-[10px] text-muted-foreground">অনুপস্থিত</div>
                  <div className="text-lg font-bold text-red-700 dark:text-red-400">{rAbsent}</div>
                </div>
                <div className="h-8 w-px bg-border/60" />
                <div className="text-center">
                  <div className="text-[10px] text-muted-foreground">লেট</div>
                  <div className="text-lg font-bold text-yellow-700 dark:text-yellow-400">{rLate}</div>
                </div>
              </div>

              {/* Quick mark today's attendance */}
              {(() => {
                const todayStr = toLocalDateStr();
                const todayRec = (attendance as any[]).find((a: any) => a.date === todayStr);
                const todayStatus = todayRec?.status;
                const quickOptions: { value: string; label: string; cls: string; activeCls: string }[] = [
                  { value: 'present', label: 'উপস্থিত', cls: 'border-green-300 text-green-700 hover:bg-green-50 dark:hover:bg-green-950/30', activeCls: 'bg-green-600 text-white border-green-600' },
                  { value: 'off_day', label: 'ছুটি',   cls: 'border-blue-300 text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30',     activeCls: 'bg-blue-600 text-white border-blue-600' },
                  { value: 'absent',  label: 'অনুপস্থিত', cls: 'border-red-300 text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30',       activeCls: 'bg-red-600 text-white border-red-600' },
                  { value: 'late',    label: 'লেট',   cls: 'border-yellow-300 text-yellow-700 hover:bg-yellow-50 dark:hover:bg-yellow-950/30', activeCls: 'bg-yellow-500 text-white border-yellow-500' },
                ];
                return (
                  <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
                    <span className="text-[11px] text-muted-foreground shrink-0">📅 আজ মার্ক করুন:</span>
                    {quickOptions.map(opt => {
                      const active = todayStatus === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          disabled={markAttendance.isPending}
                          onClick={() => {
                            markAttendance.mutate(
                              { person_id: id!, date: todayStr, status: opt.value },
                              {
                                onSuccess: () => toast.success(`আজ ${opt.label} মার্ক হয়েছে`),
                                onError: (e: any) => toast.error(e?.message || 'মার্ক ব্যর্থ'),
                              }
                            );
                          }}
                          className={`text-[11px] px-2 py-1 rounded-md border font-medium transition-colors disabled:opacity-50 ${active ? opt.activeCls : opt.cls}`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Breakdown */}
              <div className="text-xs space-y-1 rounded-lg p-2.5 mb-2 border border-border/50">
                <div className="flex justify-between text-muted-foreground">
                  <span>এই মাসে {rTotalDays} দিন</span>
                  <span>প্রতিদিন ৳{Math.round(rPerDay).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>{rDutyDays} দিন কাজ</span>
                  <span className="font-medium">৳{rEarned.toLocaleString()}</span>
                </div>
                {rAbsent > 0 && (
                  <div className="flex justify-between text-destructive">
                    <span>{rAbsent} দিন অনুপস্থিত</span>
                    <span className="font-medium">-৳{Math.round(rDeduction).toLocaleString()}</span>
                  </div>
                )}
                {rBonus > 0 && openPanel !== 'editBonus' && (
                  <div className="flex justify-between items-center text-amber-700 dark:text-amber-400 group">
                    <span className="truncate pr-2">🎁 বোনাস{rBonusNote ? ` — ${rBonusNote}` : ''}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="font-medium">+৳{rBonus.toLocaleString()}</span>
                      <button className="opacity-60 hover:opacity-100 hover:text-primary p-0.5" title="এডিট" onClick={() => { resetPanels(); setOpenPanel('editBonus'); setBonusAmount(String(rBonus)); setBonusNote(rBonusNote || ''); }}>
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button className="opacity-60 hover:opacity-100 hover:text-destructive p-0.5" title="মুছুন" disabled={savingAction} onClick={() => { if (confirm('বোনাস মুছে ফেলবেন?')) handleDeleteBonus(); }}>
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                )}
                {openPanel === 'editBonus' && (
                  <div className="flex items-center gap-1 bg-amber-50/60 dark:bg-amber-950/20 rounded p-1.5">
                    <span className="text-amber-700 dark:text-amber-400 text-[11px] shrink-0">🎁</span>
                    <Input type="number" inputMode="numeric" className="h-7 w-20 text-xs" value={bonusAmount} onChange={e => setBonusAmount(e.target.value)} placeholder="টাকা" autoFocus />
                    <Input className="h-7 text-xs flex-1" value={bonusNote} onChange={e => setBonusNote(e.target.value)} placeholder="নোট" />
                    <Button size="sm" className="h-7 px-2 text-xs" disabled={savingAction} onClick={handleEditBonus}>সেভ</Button>
                    <Button size="sm" variant="ghost" className="h-7 px-1 text-xs" onClick={resetPanels}>✕</Button>
                  </div>
                )}
                {rOvertime > 0 && openPanel !== 'editOvertime' && (
                  <div className="flex justify-between items-center text-purple-700 dark:text-purple-400 group">
                    <span className="truncate pr-2">⏱️ ওভারটাইম{rOvertimeNote ? ` — ${rOvertimeNote}` : ''}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="font-medium">+৳{rOvertime.toLocaleString()}</span>
                      <button className="opacity-60 hover:opacity-100 hover:text-primary p-0.5" title="এডিট" onClick={() => { resetPanels(); setOpenPanel('editOvertime'); setOtAmount(String(rOvertime)); setOtNote(rOvertimeNote || ''); }}>
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button className="opacity-60 hover:opacity-100 hover:text-destructive p-0.5" title="মুছুন" disabled={savingAction} onClick={() => { if (confirm('ওভারটাইম মুছে ফেলবেন?')) handleDeleteOvertime(); }}>
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                )}
                {openPanel === 'editOvertime' && (
                  <div className="flex items-center gap-1 bg-purple-50/60 dark:bg-purple-950/20 rounded p-1.5">
                    <span className="text-purple-700 dark:text-purple-400 text-[11px] shrink-0">⏱️</span>
                    <Input type="number" inputMode="numeric" className="h-7 w-20 text-xs" value={otAmount} onChange={e => setOtAmount(e.target.value)} placeholder="টাকা" autoFocus />
                    <Input className="h-7 text-xs flex-1" value={otNote} onChange={e => setOtNote(e.target.value)} placeholder="নোট" />
                    <Button size="sm" className="h-7 px-2 text-xs" disabled={savingAction} onClick={handleEditOvertime}>সেভ</Button>
                    <Button size="sm" variant="ghost" className="h-7 px-1 text-xs" onClick={resetPanels}>✕</Button>
                  </div>
                )}
                {/* Final salary row with edit */}
                <div className="border-t border-border pt-1.5 flex justify-between items-center">
                  <span className="font-bold">চূড়ান্ত বেতন</span>
                  {openPanel === 'editSalary' ? (
                    <div className="flex items-center gap-1">
                      <span className="text-xs">৳</span>
                      <Input type="number" inputMode="numeric" className="h-7 w-24 text-sm text-right" value={editFinalSalaryValue} onChange={e => setEditFinalSalaryValue(e.target.value)} placeholder={String(rSalary)} autoFocus />
                      <Button size="sm" className="h-7 px-2 text-xs" disabled={savingAction} onClick={async () => {
                        const v = Number(editFinalSalaryValue);
                        if (!v || v < 0) { toast.error('সঠিক অংক দিন'); return; }
                        setSavingAction(true);
                        try {
                          if (runningRec?.id) {
                            await updateSalaryRecord.mutateAsync({
                              id: runningRec.id,
                              working_days: rTotalDays,
                              present_days: rPresent + rLate,
                              absent_days: rAbsent,
                              off_days: rOff,
                              base_salary: rBaseSalary,
                              deduction: Math.max(0, rBaseSalary + rBonus + rOvertime - v),
                              bonus_amount: rBonus,
                              bonus_note: rBonusNote || null,
                              overtime_amount: rOvertime,
                              overtime_note: rOvertimeNote || null,
                              final_salary: v,
                            });
                          } else {
                            await generateSalary.mutateAsync({
                              person_id: id, month: currentMonth, year: currentYear,
                              working_days: rTotalDays, present_days: rPresent + rLate,
                              absent_days: rAbsent, off_days: rOff,
                              base_salary: rBaseSalary,
                              deduction: Math.max(0, rBaseSalary + rBonus + rOvertime - v),
                              final_salary: v,
                            });
                          }
                          toast.success('চূড়ান্ত বেতন সেট হয়েছে');
                          invalidateAll();
                          resetPanels();
                        } catch (e: any) { toast.error(e?.message || 'সমস্যা'); }
                        setSavingAction(false);
                      }}>সেভ</Button>
                      <Button size="sm" variant="ghost" className="h-7 px-1 text-xs" onClick={resetPanels}>✕</Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-base">৳{rSalary.toLocaleString()}</span>
                      <button className="text-muted-foreground hover:text-primary" onClick={() => { setOpenPanel('editSalary'); setEditFinalSalaryValue(String(rSalary)); }} title="চূড়ান্ত বেতন পরিবর্তন">
                        <Pencil className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* This-month clearance — inline summary (manual entry) */}
              <div className="mb-2 px-2.5 py-1.5 rounded-lg border border-border/50 text-sm">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground text-xs">এই মাসে নিয়েছে</span>
                    <span className="font-bold">৳{rPaid.toLocaleString()}</span>
                    <button
                      className="text-muted-foreground hover:text-primary print:hidden"
                      title="এডিট করুন"
                      onClick={() => {
                        resetPanels();
                        setReceivedAmount(rReceived ? String(rReceived) : '');
                        setReceivedNote(rReceivedNote || '');
                        setOpenPanel('received');
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="h-4 w-px bg-border/60" />
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground text-xs">অগ্রিম নিয়েছে</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">৳{rAdvance.toLocaleString()}</span>
                    <button
                      className="text-muted-foreground hover:text-primary print:hidden"
                      title="অগ্রিম এডিট করুন"
                      onClick={() => {
                        resetPanels();
                        setAdvanceAmount(rAdvance ? String(rAdvance) : '');
                        setAdvanceNote(rAdvanceNote || '');
                        setOpenPanel('advance');
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="h-4 w-px bg-border/60" />
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground text-xs">{rBalance >= 0 ? 'পাবে' : 'বেশি নিয়েছে'}</span>
                    <span className={`font-bold ${rBalance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      ৳{Math.abs(rBalance).toLocaleString()}
                    </span>
                  </div>
                </div>
                {rReceivedNote && (
                  <div className="mt-1 text-[11px] text-muted-foreground italic">📝 {rReceivedNote}</div>
                )}
                {rAdvanceNote && (
                  <div className="mt-1 text-[11px] text-blue-700 dark:text-blue-400 italic">🪙 {rAdvanceNote}</div>
                )}
              </div>

              {/* Inline panel — Received (manual entry) */}
              {openPanel === 'received' && (
                <div className="mb-2 p-2.5 rounded-lg border border-border bg-muted/30 space-y-2 print:hidden">
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">এই মাসে কত টাকা নিয়েছে?</label>
                    <Input type="number" inputMode="numeric" value={receivedAmount} onChange={e => setReceivedAmount(e.target.value)} placeholder="যেমন: 5000" className="h-9 text-sm font-medium" autoFocus />
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">নোট (ঐচ্ছিক)</label>
                    <Input value={receivedNote} onChange={e => setReceivedNote(e.target.value)} placeholder="যেমন: ১৫ তারিখ ক্যাশ" className="h-8 text-sm" />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" className="flex-1 h-8" onClick={resetPanels}>বাতিল</Button>
                    <Button size="sm" className="flex-1 h-8" disabled={savingAction} onClick={handleSaveReceived}>সেভ করুন</Button>
                  </div>
                </div>
              )}

              {/* Inline panel — Advance (manual clearance entry only) */}
              {openPanel === 'advance' && (
                <div className="mb-2 p-2.5 rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/20 space-y-2 print:hidden">
                  <div className="text-xs font-medium text-blue-700 dark:text-blue-300">অগ্রিম শুধু প্রিন্ট মেমোতে বিল ক্লিয়ার দেখানোর জন্য।</div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">অগ্রিম কত টাকা নিয়েছে?</label>
                    <Input type="number" inputMode="numeric" value={advanceAmount} onChange={e => setAdvanceAmount(e.target.value)} placeholder="যেমন: 2000" className="h-9 text-sm font-medium" autoFocus />
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">নোট (ঐচ্ছিক)</label>
                    <Input value={advanceNote} onChange={e => setAdvanceNote(e.target.value)} placeholder="যেমন: মাসের আগে নিয়েছে" className="h-8 text-sm" />
                  </div>
                  <div className="text-xs rounded bg-background/70 p-2 flex justify-between">
                    <span>৳{rSalary.toLocaleString()} − ৳{(Number(advanceAmount) || 0).toLocaleString()}</span>
                    <span className="font-bold">পাবে ৳{Math.max(0, rSalary - rPaid - (Number(advanceAmount) || 0)).toLocaleString()}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" className="flex-1 h-8" onClick={resetPanels}>বাতিল</Button>
                    <Button size="sm" className="flex-1 h-8" disabled={savingAction} onClick={handleSaveAdvance}>অগ্রিম সেভ</Button>
                  </div>
                </div>
              )}

              {/* Action buttons — compact */}
              <div className="grid grid-cols-3 gap-1.5 print:hidden">
                <Button size="sm" variant={openPanel === 'bonus' ? 'default' : 'outline'} className="h-8 text-xs" onClick={() => { resetPanels(); setOpenPanel(openPanel === 'bonus' ? null : 'bonus'); }}>
                  🎁 বোনাস
                </Button>
                <Button size="sm" variant={openPanel === 'overtime' ? 'default' : 'outline'} className="h-8 text-xs" onClick={() => { resetPanels(); setOpenPanel(openPanel === 'overtime' ? null : 'overtime'); }}>
                  ⏱️ ওভারটাইম
                </Button>
                <Button size="sm" variant={openPanel === 'advance' ? 'default' : 'outline'} className="h-8 text-xs" onClick={() => { resetPanels(); setAdvanceAmount(rAdvance ? String(rAdvance) : ''); setAdvanceNote(rAdvanceNote || ''); setOpenPanel(openPanel === 'advance' ? null : 'advance'); }}>
                  🪙 অগ্রিম নিয়েছে
                </Button>
              </div>


              {/* Inline panel — Bonus (add) */}
              {openPanel === 'bonus' && (
                <div className="mt-2 p-2.5 rounded-lg border border-border bg-muted/30 space-y-2 print:hidden">
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">বোনাস টাকা</label>
                    <Input type="number" inputMode="numeric" value={bonusAmount} onChange={e => setBonusAmount(e.target.value)} placeholder="যেমন: 500" className="h-9 text-sm font-medium" autoFocus />
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">কারণ / নোট</label>
                    <Input value={bonusNote} onChange={e => setBonusNote(e.target.value)} placeholder="যেমন: ঈদ বোনাস" className="h-8 text-sm" />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" className="flex-1 h-8" onClick={resetPanels}>বাতিল</Button>
                    <Button size="sm" className="flex-1 h-8" disabled={savingAction} onClick={handleSaveBonus}>বোনাস সেভ</Button>
                  </div>
                </div>
              )}

              {/* Inline panel — Overtime (add, simplified — only amount + note) */}
              {openPanel === 'overtime' && (
                <div className="mt-2 p-2.5 rounded-lg border border-border bg-muted/30 space-y-2 print:hidden">
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">ওভারটাইম টাকা</label>
                    <Input type="number" inputMode="numeric" value={otAmount} onChange={e => setOtAmount(e.target.value)} placeholder="যেমন: 300" className="h-9 text-sm font-medium" autoFocus />
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">নোট (ঐচ্ছিক)</label>
                    <Input value={otNote} onChange={e => setOtNote(e.target.value)} placeholder="যেমন: 2ঘ extra duty" className="h-8 text-sm" />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" className="flex-1 h-8" onClick={resetPanels}>বাতিল</Button>
                    <Button size="sm" className="flex-1 h-8" disabled={savingAction} onClick={handleSaveOvertime}>ওভারটাইম সেভ</Button>
                  </div>
                </div>
              )}


            </CardContent>
          </Card>
        );
      })()}


      {/* Settlement Dialog */}
      <Dialog open={settleOpen} onOpenChange={setSettleOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>হিসাব শেষ করুন</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1 block">শেষ কর্মদিবস সিলেক্ট করুন</label>
              <Calendar
                mode="single"
                selected={settleDate}
                onSelect={(d) => { setSettleDate(d); setSettleAmount(''); }}
                disabled={(date) => date > new Date() || date < new Date('2020-01-01')}
                className={cn("p-3 pointer-events-auto rounded-md border mx-auto")}
              />
            </div>

            {settleDate && (() => {
              const sMonth = settleDate.getMonth() + 1;
              const sYear = settleDate.getFullYear();
              const sTotalDays = getDaysInMonth(new Date(sYear, sMonth - 1));
              const sBaseSalary = person.base_salary || 0;
              const sPerDay = sTotalDays > 0 ? sBaseSalary / sTotalDays : 0;

              const sAtt = autoAttendanceItems.filter(a => {
                const d = parseISO(a.date);
                return d.getMonth() + 1 === sMonth && d.getFullYear() === sYear && d <= settleDate;
              });
              const sPresent = sAtt.filter(a => a.status === 'present').length;
              const sOff = sAtt.filter(a => a.status === 'off_day').length;
              const sLate = sAtt.filter(a => a.status === 'late').length;
              const sDutyDays = sPresent + sOff + sLate;
              const sDaysUpTo = settleDate.getDate();
              const sAbsent = Math.max(0, sDaysUpTo - sDutyDays);
              const sFinalSalaryCalc = Math.round(sDutyDays * sPerDay);
              const sFinalSalary = settleAmount !== '' ? Number(settleAmount) : sFinalSalaryCalc;

              const startDate = new Date(sYear, sMonth - 1, 1);
              const endDate = new Date(sYear, sMonth, 1);
              const monthTx = (monthlySummary?.transactions || []).filter((t: any) => {
                const d = new Date(t.created_at);
                return d >= startDate && d < endDate;
              });
              const sPaid = monthTx.reduce((s: number, t: any) => s + Number(t.amount), 0);
              const sBalance = sFinalSalary - sPaid;

              return (
                <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
                  <div className="text-xs font-bold text-muted-foreground text-center border-b pb-1">── হিসাব সারাংশ ──</div>
                  <div className="flex justify-between">
                    <span>📅 কর্মদিবস (১ - {settleDate.getDate()})</span>
                    <span className="font-bold">{sDaysUpTo} দিন</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-xs">
                    <div className="text-center p-1 rounded bg-green-50 dark:bg-green-950/20">
                      <div className="text-muted-foreground">উপস্থিত</div>
                      <div className="font-bold text-green-700 dark:text-green-400">{sPresent}</div>
                    </div>
                    <div className="text-center p-1 rounded bg-blue-50 dark:bg-blue-950/20">
                      <div className="text-muted-foreground">ছুটি</div>
                      <div className="font-bold text-blue-700 dark:text-blue-400">{sOff}</div>
                    </div>
                    <div className="text-center p-1 rounded bg-red-50 dark:bg-red-950/20">
                      <div className="text-muted-foreground">অনুপস্থিত</div>
                      <div className="font-bold text-red-700 dark:text-red-400">{sAbsent}</div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center border-t pt-1">
                    <span>চূড়ান্ত বেতন</span>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground text-xs">(অটো: ৳{sFinalSalaryCalc.toLocaleString()})</span>
                      <span className="text-xs">৳</span>
                      <Input
                        type="number"
                        className="w-24 h-7 text-sm text-right font-bold"
                        placeholder={String(sFinalSalaryCalc)}
                        value={settleAmount}
                        onChange={(e) => setSettleAmount(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span>জমা</span>
                    <span className="font-bold text-green-600">৳{sPaid.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1">
                    <span className="font-bold">{sBalance > 0 ? 'পাওনা' : 'অতিরিক্ত'}</span>
                    <span className={`font-bold ${sBalance > 0 ? 'text-destructive' : 'text-green-600'}`}>
                      ৳{Math.abs(sBalance).toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })()}

            <div>
              <label className="text-sm font-medium mb-1 block">বাদ দেওয়ার কারণ / নোট</label>
              <Textarea
                placeholder="কেন বাদ দেওয়া হচ্ছে বা কাজ ছেড়ে দিচ্ছে লিখুন..."
                value={settleNote}
                onChange={(e) => setSettleNote(e.target.value)}
                rows={2}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setSettleOpen(false)}>বাতিল</Button>
              <Button
                className="flex-1"
                variant="destructive"
                disabled={!settleDate || updatePerson.isPending || generateSalary.isPending}
                onClick={async () => {
                  if (!settleDate) return;
                  try {
                    const sMonth = settleDate.getMonth() + 1;
                    const sYear = settleDate.getFullYear();
                    const sTotalDays = getDaysInMonth(new Date(sYear, sMonth - 1));
                    const sBaseSalary = person.base_salary || 0;
                    const sPerDay = sTotalDays > 0 ? sBaseSalary / sTotalDays : 0;

                    const sAtt = autoAttendanceItems.filter(a => {
                      const d = parseISO(a.date);
                      return d.getMonth() + 1 === sMonth && d.getFullYear() === sYear && d <= settleDate;
                    });
                    const sPresent = sAtt.filter(a => a.status === 'present').length;
                    const sOff = sAtt.filter(a => a.status === 'off_day').length;
                    const sLate = sAtt.filter(a => a.status === 'late').length;
                    const sDutyDays = sPresent + sOff + sLate;
                    const sDaysUpTo = settleDate.getDate();
                    const sAbsent = Math.max(0, sDaysUpTo - sDutyDays);
                    const sFinalSalaryCalc = Math.round(sDutyDays * sPerDay);
                    const sFinalSalary = settleAmount !== '' ? Number(settleAmount) : sFinalSalaryCalc;
                    const sDeduction = Math.round(sBaseSalary - sFinalSalary);

                    await generateSalary.mutateAsync({
                      person_id: id, month: sMonth, year: sYear,
                      working_days: sDaysUpTo, present_days: sPresent + sLate,
                      absent_days: sAbsent, off_days: sOff,
                      base_salary: sBaseSalary, deduction: sDeduction, final_salary: sFinalSalary,
                    });

                    await updatePerson.mutateAsync({
                      id,
                      is_active: false,
                      resigned_at: settleDate.toISOString(),
                    });

                    // Log settlement with reason
                    const logAction = person.is_active === false ? 'settlement_update' : 'settlement';
                    await logAccActivity({
                      action: logAction,
                      entity_type: 'person',
                      entity_id: id,
                      entity_name: person.name,
                      description: settleNote || 'হিসাব শেষ করা হয়েছে',
                      new_data: {
                        settle_date: format(settleDate, 'yyyy-MM-dd'),
                        final_salary: sFinalSalary,
                        note: settleNote,
                      },
                    });

                    // Comprehensive query invalidation
                    qc.invalidateQueries({ queryKey: ['acc-person'] });
                    qc.invalidateQueries({ queryKey: ['acc-persons'] });
                    qc.invalidateQueries({ queryKey: ['acc-person-financial'] });
                    qc.invalidateQueries({ queryKey: ['acc-monthly-salary-summary'] });
                    qc.invalidateQueries({ queryKey: ['acc-salary-records'] });
                    qc.invalidateQueries({ queryKey: ['acc-transactions'] });
                    qc.invalidateQueries({ queryKey: ['acc-advance-total'] });

                    toast.success('হিসাব শেষ হয়েছে — ব্যক্তি নিষ্ক্রিয় করা হয়েছে');
                    setSettleOpen(false);
                  } catch {
                    toast.error('হিসাব শেষ করতে ব্যর্থ');
                  }
                }}
              >
                নিশ্চিত করুন
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Re-join Dialog */}
      <Dialog open={rejoinOpen} onOpenChange={setRejoinOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>পুনরায় জয়েন করুন</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              নতুন জয়েনিং তারিখ সিলেক্ট করুন। এই তারিখ থেকে ডিউটি ও বেতন শুরু হবে।
            </p>
            <Calendar
              mode="single"
              selected={rejoinDate}
              onSelect={setRejoinDate}
              disabled={(date) => date < new Date('2020-01-01')}
              className={cn("p-3 pointer-events-auto rounded-md border mx-auto")}
            />
            <Button
              className="w-full"
              disabled={!rejoinDate || updatePerson.isPending}
              onClick={async () => {
                if (!rejoinDate) return;
                try {
                  await updatePerson.mutateAsync({
                    id,
                    is_active: true,
                    resigned_at: null,
                    joining_date: format(rejoinDate, 'yyyy-MM-dd'),
                  });
                  await logAccActivity({
                    action: 'settlement_rejoin',
                    entity_type: 'person',
                    entity_id: id,
                    entity_name: person.name,
                    description: `পুনরায় জয়েন — ${format(rejoinDate, 'dd MMM yyyy', { locale: bn })}`,
                    new_data: { rejoin_date: format(rejoinDate, 'yyyy-MM-dd') },
                  });
                  qc.invalidateQueries({ queryKey: ['acc-person'] });
                  qc.invalidateQueries({ queryKey: ['acc-persons'] });
                  qc.invalidateQueries({ queryKey: ['acc-person-financial'] });
                  qc.invalidateQueries({ queryKey: ['acc-monthly-salary-summary'] });
                  qc.invalidateQueries({ queryKey: ['acc-salary-records'] });
                  toast.success('পুনরায় জয়েন সফল হয়েছে');
                  setRejoinOpen(false);
                } catch {
                  toast.error('জয়েন ব্যর্থ');
                }
              }}
            >
              ✅ জয়েন নিশ্চিত করুন
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {person.type === 'salaried_production' && (
        <SalariedProductionSection personId={id} personName={person.name} totalSalaryPaid={financial?.submission || 0} />
      )}

      {/* Unified Date-wise Feed */}
      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {(() => {
              const items: { id: string; date: string; type: 'transaction' | 'attendance' | 'increment' | 'salary_entry' | 'stint_closed'; data: any }[] = [];

              pastStints.forEach((stint) => items.push({
                id: `stint-${stint.settleDate}`, date: stint.settleDate, type: 'stint_closed', data: stint,
              }));

              transactions.forEach(tx => items.push({
                id: tx.id, date: tx.created_at, type: 'transaction', data: tx,
              }));
              
              autoAttendanceItems.forEach(a => items.push({
                id: a.id, date: a.date, type: 'attendance', data: a,
              }));
              
              increments.forEach((inc: any) => items.push({
                id: inc.id, date: inc.effective_date, type: 'increment', data: inc,
              }));

              // Add salary entries on 1st of each month
              if (monthlySummary?.salaryRecords) {
                const nowDate = new Date();
                const curM = nowDate.getMonth() + 1;
                const curY = nowDate.getFullYear();
                monthlySummary.salaryRecords
                  .filter((rec: any) => rec.year < curY || (rec.year === curY && rec.month < curM))
                  .forEach((rec: any) => {
                    // Show salary on 1st of NEXT month (March salary → April 1)
                    const nextM = rec.month === 12 ? 1 : rec.month + 1;
                    const nextY = rec.month === 12 ? rec.year + 1 : rec.year;
                    items.push({
                      id: `salary-${rec.id}`,
                      date: `${nextY}-${String(nextM).padStart(2, '0')}-01`,
                      type: 'salary_entry',
                      data: rec,
                    });
                  });
              }

              items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

              if (items.length === 0) {
                return <div className="p-4 text-center text-sm text-muted-foreground">কোনো রেকর্ড নেই</div>;
              }

              return items.map(item => {
                if (item.type === 'stint_closed') {
                  const s = item.data as PersonPastStint;
                  return (
                    <div key={`stint-${item.id}`} className="p-3 bg-muted/30">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="h-4 w-4 text-destructive" />
                          <span className="text-sm font-bold">পূর্ববর্তী কর্মকাল — হিসাব বন্ধ</span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400">
                          ⛔ Closed — {format(new Date(s.settleDate), 'dd MMM yyyy', { locale: bn })}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1 text-[11px] mb-2">
                        <div className="text-center p-1.5 rounded bg-green-50 dark:bg-green-950/20">
                          <div className="text-muted-foreground">মোট কর্মদিবস</div>
                          <div className="font-bold text-green-700 dark:text-green-400">{s.workedDays} দিন</div>
                        </div>
                        <div className="text-center p-1.5 rounded bg-amber-50 dark:bg-amber-950/20">
                          <div className="text-muted-foreground">মোট বেতন</div>
                          <div className="font-bold text-amber-700 dark:text-amber-400">৳{s.totalSalary.toLocaleString()}</div>
                        </div>
                        <div className={"text-center p-1.5 rounded " + (s.equale >= 0 ? 'bg-green-50 dark:bg-green-950/20' : 'bg-red-50 dark:bg-red-950/20')}>
                          <div className="text-muted-foreground">{s.equale >= 0 ? 'পাওনা ছিল' : 'বেশি নিয়েছিল'}</div>
                          <div className={"font-bold " + (s.equale >= 0 ? 'text-green-700 dark:text-green-400' : 'text-destructive')}>৳{Math.abs(s.equale).toLocaleString()}</div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center justify-between">
                        <span>মোট জমা: <span className="font-medium text-foreground">৳{s.submission.toLocaleString()}</span></span>
                        {s.startDate && (
                          <span>{format(new Date(s.startDate), 'dd MMM yyyy', { locale: bn })}-এর পর থেকে</span>
                        )}
                      </div>
                      {s.note && (
                        <div className="text-xs bg-amber-50 dark:bg-amber-950/20 rounded p-2 mt-1.5 border border-amber-200 dark:border-amber-800/30">
                          <span className="text-muted-foreground">📝 নোট:</span> <span>{s.note}</span>
                        </div>
                      )}
                    </div>
                  );
                }

                if (item.type === 'transaction') {
                  const tx = item.data;
                  return (
                    <div key={`tx-${item.id}`} className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3">
                        {isDebit(tx.type) ? <ArrowDownRight className="h-4 w-4 text-destructive" /> : <ArrowUpRight className="h-4 w-4 text-green-600" />}
                        <div>
                          <div className="text-sm font-medium">{txTypeLabel[tx.type] || tx.type}</div>
                          <div className="text-xs text-muted-foreground">{tx.description}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-bold ${isDebit(tx.type) ? 'text-destructive' : 'text-green-600'}`}>
                          {isDebit(tx.type) ? '-' : '+'}৳{tx.amount.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-muted-foreground">{format(new Date(tx.created_at), 'dd MMM yyyy', { locale: bn })}</div>
                      </div>
                    </div>
                  );
                }

                if (item.type === 'attendance') {
                  const a = item.data;
                  // Calculate overtime for this day
                  let overtimeStr = '';
                  if (a.check_out) {
                    const offDaySet = new Set<number>(offDays.length > 0 ? offDays : [5]);
                    const [endH, endM] = personDutyEnd.split(':').map(Number);
                    const checkOut = new Date(a.check_out);
                    const dateObj = parseISO(a.date);
                    const dutyEndTime = new Date(dateObj);
                    dutyEndTime.setHours(endH, endM, 0, 0);

                    if (offDaySet.has(a.dayOfWeek) && a.check_in) {
                      const mins = differenceInMinutes(checkOut, new Date(a.check_in));
                      if (mins > 0) overtimeStr = `OT: ${Math.floor(mins / 60)}h${mins % 60 > 0 ? ` ${mins % 60}m` : ''}`;
                    } else if (checkOut > dutyEndTime) {
                      const mins = differenceInMinutes(checkOut, dutyEndTime);
                      if (mins > 0) overtimeStr = `OT: ${Math.floor(mins / 60)}h${mins % 60 > 0 ? ` ${mins % 60}m` : ''}`;
                    }
                  }

                  return (
                    <div key={`att-${item.id}`} className={`flex items-center justify-between px-4 py-3 ${a.isAuto ? 'bg-muted/10' : 'bg-muted/20'}`}>
                      <div>
                        <div className="text-sm font-medium">
                          {format(parseISO(a.date), 'dd MMMM yyyy', { locale: bn })}
                          <span className="text-xs text-muted-foreground ml-1.5">({dayNamesBn[a.dayOfWeek]})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {a.check_in && <span className="text-xs text-muted-foreground">ইন: {format(new Date(a.check_in), 'hh:mm a')}</span>}
                          {a.check_out && <span className="text-xs text-muted-foreground">আউট: {format(new Date(a.check_out), 'hh:mm a')}</span>}
                          {overtimeStr && <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">{overtimeStr}</span>}
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        a.status === 'present' ? (a.isAuto ? 'bg-green-50 text-green-600 dark:bg-green-950/20 dark:text-green-500' : 'bg-green-100 text-green-700') :
                        a.status === 'absent' ? 'bg-red-100 text-red-700' :
                        a.status === 'off_day' ? (a.isAuto ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-500' : 'bg-blue-100 text-blue-700') :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {statusLabel[a.status] || a.status}
                      </span>
                    </div>
                  );
                }

                if (item.type === 'increment') {
                  const inc = item.data;
                  return (
                    <div key={`inc-${item.id}`} className="flex items-center justify-between px-4 py-3 bg-primary/5">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">৳{inc.old_salary.toLocaleString()} → ৳{inc.new_salary.toLocaleString()}</div>
                        {inc.note && <div className="text-xs text-muted-foreground">{inc.note}</div>}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">ইনক্রিমেন্ট</span>
                          <div className="text-[10px] text-muted-foreground mt-0.5">{format(new Date(inc.effective_date), 'dd MMM yyyy', { locale: bn })}</div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <button
                            className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary"
                            title="এডিট করুন"
                            onClick={() => {
                              setEditIncId(inc.id);
                              setEditIncOldSalary(Number(inc.old_salary) || 0);
                              setEditIncNewSalary(String(inc.new_salary));
                              setEditIncDate(inc.effective_date);
                              setEditIncNote(inc.note || '');
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                            title="ডিলিট করুন"
                            onClick={() => {
                              if (!confirm('এই বেতন বৃদ্ধি ডিলিট করবেন? বেতন আগের অংকে ফিরে যাবে।')) return;
                              deleteIncrement.mutate({ id: inc.id, person_id: id! }, {
                                onSuccess: () => toast.success('ডিলিট হয়েছে'),
                                onError: (e: any) => toast.error(e?.message || 'ডিলিট ব্যর্থ'),
                              });
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                if (item.type === 'salary_entry') {
                  const rec = item.data;
                  const balData = salaryBalanceData.find((b: any) => b.month === rec.month && b.year === rec.year);
                  const pCount = balData?.presentCount ?? rec.present_days;
                  const oCount = balData?.offCount ?? rec.off_days;
                  const lCount = balData?.lateCount ?? 0;
                  const recTotalDays = getDaysInMonth(new Date(rec.year, rec.month - 1));
                  const aCount = balData?.absentCount ?? rec.absent_days;
                  // Use effectiveBase (raise-adjusted) instead of stored base_salary
                  const effBase = balData?.effectiveBase ?? rec.base_salary;
                  const recPerDay = recTotalDays > 0 ? effBase / recTotalDays : 0;
                  const recDeduction = Math.round(recPerDay * aCount);
                  const recBonus = Number((rec as any).bonus_amount || 0);
                  const recOvertime = Number((rec as any).overtime_amount || 0);
                  const recFinalSalary = Math.max(0, effBase - recDeduction + recBonus + recOvertime);
                  const tPaid = balData?.totalPaid ?? rec.paid_amount;
                  const recAdvance = Number((rec as any).advance_amount || 0);
                  const bal = recFinalSalary - tPaid - recAdvance;
                  return (
                    <div key={`sal-${item.id}`} className="px-4 py-3 bg-amber-50 dark:bg-amber-950/20 border-l-4 border-amber-500">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-bold">{monthNames[rec.month]} {rec.year} বেতন</div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                          bal <= 0
                            ? 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
                        }`}>
                          {bal <= 0 ? '✓ পরিশোধিত' : 'বাকি আছে'}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1 text-[11px] mb-2">
                        <div className="text-center p-1 rounded bg-green-50 dark:bg-green-950/20">
                          <div className="text-muted-foreground">উপস্থিত</div>
                          <div className="font-bold text-green-700 dark:text-green-400">{pCount}</div>
                        </div>
                        <div className="text-center p-1 rounded bg-blue-50 dark:bg-blue-950/20">
                          <div className="text-muted-foreground">ছুটি</div>
                          <div className="font-bold text-blue-700 dark:text-blue-400">{oCount}</div>
                        </div>
                        <div className="text-center p-1 rounded bg-red-50 dark:bg-red-950/20">
                          <div className="text-muted-foreground">অনুপস্থিত</div>
                          <div className="font-bold text-red-700 dark:text-red-400">{aCount}</div>
                        </div>
                        <div className="text-center p-1 rounded bg-yellow-50 dark:bg-yellow-950/20">
                          <div className="text-muted-foreground">লেট</div>
                          <div className="font-bold text-yellow-700 dark:text-yellow-400">{lCount}</div>
                        </div>
                      </div>
                      {/* Detailed breakdown */}
                      <div className="text-xs space-y-1 bg-muted/50 rounded p-2 mb-1">
                        <div className="flex justify-between text-muted-foreground">
                          <span>📅 {monthNames[rec.month]}-এ {recTotalDays} দিন</span>
                          <span>প্রতিদিন ৳{Math.round(recPerDay).toLocaleString()}</span>
                        </div>
                        {(() => {
                          const dutyDays = pCount + oCount + lCount;
                          const earned = Math.round(dutyDays * recPerDay);
                          return (
                            <>
                              <div className="flex justify-between">
                                <span className="text-green-700 dark:text-green-400">✅ {dutyDays} দিন duty ({pCount} উপস্থিত{oCount > 0 ? ` + ${oCount} ছুটি` : ''}{lCount > 0 ? ` + ${lCount} লেট` : ''})</span>
                                <span className="font-bold">৳{earned.toLocaleString()}</span>
                              </div>
                              {aCount > 0 && (
                                <div className="flex justify-between text-destructive">
                                  <span>❌ {aCount} দিন অনুপস্থিত × ৳{Math.round(recPerDay).toLocaleString()}</span>
                                  <span className="font-medium">-৳{recDeduction.toLocaleString()}</span>
                                </div>
                              )}
                              {recBonus > 0 && <div className="flex justify-between text-amber-700 dark:text-amber-400"><span className="truncate pr-2">🎁 বোনাস{(rec as any).bonus_note ? ` — ${(rec as any).bonus_note}` : ''}</span><span className="font-medium shrink-0">+৳{recBonus.toLocaleString()}</span></div>}
                              {recOvertime > 0 && <div className="flex justify-between text-purple-700 dark:text-purple-400"><span className="truncate pr-2">⏱️ ওভারটাইম{(rec as any).overtime_note ? ` — ${(rec as any).overtime_note}` : ''}</span><span className="font-medium shrink-0">+৳{recOvertime.toLocaleString()}</span></div>}
                              {recAdvance > 0 && <div className="flex justify-between text-blue-700 dark:text-blue-400"><span className="truncate pr-2">🪙 অগ্রিম{(rec as any).advance_note ? ` — ${(rec as any).advance_note}` : ''}</span><span className="font-medium shrink-0">−৳{recAdvance.toLocaleString()}</span></div>}
                            </>
                          );
                        })()}
                        <div className="border-t border-border pt-1 flex justify-between font-bold">
                          <span>মূল ৳{effBase.toLocaleString()} → চূড়ান্ত</span>
                          <span>৳{recFinalSalary.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">জমা: </span>
                          <span className="font-bold text-green-600 dark:text-green-400">৳{tPaid.toLocaleString()}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-muted-foreground">{bal > 0 ? 'পাওনা' : bal < 0 ? 'অতিরিক্ত' : ''}: </span>
                          <span className={`font-bold ${bal > 0 ? 'text-destructive' : 'text-green-600 dark:text-green-400'}`}>
                            {bal !== 0 ? `৳${Math.abs(bal).toLocaleString()}` : '—'}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-amber-200/50 dark:border-amber-800/30">
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openAdvRec(rec)}>
                          🪙 অগ্রিম
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openEditRec(rec)}>
                          <Pencil className="h-3 w-3 mr-1" /> এডিট
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => printSalaryRecord(rec)}>
                          <Printer className="h-3 w-3 mr-1" /> প্রিন্ট
                        </Button>
                      </div>
                    </div>
                  );
                }

                return null;
              });
            })()}
          </div>
        </CardContent>
      </Card>

      {/* Edit increment dialog */}
      <Dialog open={!!editIncId} onOpenChange={(o) => { if (!o) setEditIncId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>বেতন বৃদ্ধি এডিট</DialogTitle></DialogHeader>
          <div className="space-y-3 text-xs">
            <div className="flex justify-between bg-muted/40 rounded p-2">
              <span className="text-muted-foreground">পুরোনো বেতন</span>
              <span className="font-bold">৳{editIncOldSalary.toLocaleString()}</span>
            </div>
            <div>
              <label className="block text-muted-foreground mb-1">নতুন বেতন</label>
              <Input type="number" inputMode="numeric" value={editIncNewSalary} onChange={e => setEditIncNewSalary(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="flex justify-between bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded p-2">
              <span className="text-muted-foreground">বৃদ্ধির পরিমাণ</span>
              <span className="text-base font-extrabold text-green-700 dark:text-green-400">
                +৳{Math.max(0, (Number(editIncNewSalary) || 0) - editIncOldSalary).toLocaleString()}
              </span>
            </div>
            <div>
              <label className="block text-muted-foreground mb-1">কার্যকর তারিখ</label>
              <Input type="date" value={editIncDate} onChange={e => setEditIncDate(e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <label className="block text-muted-foreground mb-1">নোট</label>
              <Input value={editIncNote} onChange={e => setEditIncNote(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                variant="destructive"
                className="px-3"
                disabled={deleteIncrement.isPending}
                onClick={() => {
                  if (!editIncId) return;
                  if (!confirm('এই বেতন বৃদ্ধি ডিলিট করবেন? বেতন আগের অংকে ফিরে যাবে।')) return;
                  deleteIncrement.mutate(
                    { id: editIncId, person_id: id! },
                    {
                      onSuccess: () => { toast.success('ডিলিট হয়েছে'); setEditIncId(null); },
                      onError: (e: any) => toast.error(e?.message || 'ডিলিট ব্যর্থ'),
                    }
                  );
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setEditIncId(null)}>বাতিল</Button>
              <Button
                size="sm"
                className="flex-1 bg-green-600 hover:bg-green-700"
                disabled={updateIncrement.isPending}
                onClick={() => {
                  const ns = Number(editIncNewSalary);
                  if (!ns || ns <= 0) { toast.error('নতুন বেতনের অংক দিন'); return; }
                  if (!editIncDate) { toast.error('তারিখ দিন'); return; }
                  updateIncrement.mutate(
                    { id: editIncId!, person_id: id!, new_salary: ns, effective_date: editIncDate, note: editIncNote || null },
                    {
                      onSuccess: () => { toast.success('আপডেট হয়েছে'); setEditIncId(null); },
                      onError: (e: any) => toast.error(e?.message || 'আপডেট ব্যর্থ'),
                    }
                  );
                }}
              >
                সেভ
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit historical salary record dialog */}
      <Dialog open={editRecOpen} onOpenChange={(o) => { if (!o) { setEditRecOpen(false); setEditRec(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editRec ? `${monthNames[editRec.month]} ${editRec.year} — বেতন কার্ড এডিট` : 'বেতন কার্ড এডিট'}</DialogTitle></DialogHeader>
          <div className="space-y-2 text-sm">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">মূল বেতন</label>
              <Input type="number" inputMode="numeric" value={editRecForm.base_salary} onChange={e => updateEditRecField('base_salary', e.target.value)} className="h-9" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">কর্তন</label>
              <Input type="number" inputMode="numeric" value={editRecForm.deduction} onChange={e => updateEditRecField('deduction', e.target.value)} className="h-9" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">বোনাস</label>
                <Input type="number" inputMode="numeric" value={editRecForm.bonus_amount} onChange={e => updateEditRecField('bonus_amount', e.target.value)} className="h-9" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">বোনাস নোট</label>
                <Input value={editRecForm.bonus_note} onChange={e => updateEditRecField('bonus_note', e.target.value)} className="h-9" placeholder="ঈদ বোনাস" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">ওভারটাইম</label>
                <Input type="number" inputMode="numeric" value={editRecForm.overtime_amount} onChange={e => updateEditRecField('overtime_amount', e.target.value)} className="h-9" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">ওভারটাইম নোট</label>
                <Input value={editRecForm.overtime_note} onChange={e => updateEditRecField('overtime_note', e.target.value)} className="h-9" />
              </div>
            </div>
            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded p-2 flex justify-between items-center">
              <span className="text-xs text-muted-foreground">চূড়ান্ত বেতন</span>
              <Input type="number" inputMode="numeric" value={editRecForm.final_salary} onChange={e => setEditRecForm(p => ({ ...p, final_salary: e.target.value }))} className="h-9 w-32 text-right font-bold" />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => { setEditRecOpen(false); setEditRec(null); }}>বাতিল</Button>
              <Button className="flex-1" disabled={updateSalaryRecord.isPending} onClick={handleEditRecSubmit}>সেভ</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Print settlement dialog — asks "paying now" & "mark fully paid" before opening slip */}
      <Dialog open={printDlgOpen} onOpenChange={(o) => { if (!o) { setPrintDlgOpen(false); setPrintDlgPayload(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>🖨️ মেমো প্রিন্ট সেটেলমেন্ট</DialogTitle>
          </DialogHeader>
          {printDlgPayload && (() => {
            const oldBal = Number(printDlgPayload.oldBalance || 0);
            const payNow = printMarkPaid ? oldBal : (Number(printPayNow) || 0);
            const remain = Math.max(0, oldBal - payNow);
            return (
              <div className="space-y-3 text-sm">
                <div className="text-xs bg-muted/60 rounded p-2 flex justify-between">
                  <span>এখনও পাওনা:</span>
                  <span className="font-bold text-destructive">৳{oldBal.toLocaleString()}</span>
                </div>
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer p-2 rounded border border-green-300 bg-green-50 dark:bg-green-950/30">
                  <input type="checkbox" checked={printMarkPaid} onChange={e => { setPrintMarkPaid(e.target.checked); if (e.target.checked) setPrintPayNow(''); }} />
                  ✓ সম্পূর্ণ পরিশোধিত হিসেবে মেমোতে দেখাও
                </label>
                {!printMarkPaid && (
                  <>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">এখন কত পরিশোধ করছেন? (৳)</label>
                      <Input type="number" inputMode="numeric" value={printPayNow} onChange={e => setPrintPayNow(e.target.value)} placeholder={`যেমন: ${oldBal}`} autoFocus />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">নোট (ঐচ্ছিক)</label>
                      <Input value={printPayNote} onChange={e => setPrintPayNote(e.target.value)} placeholder="যেমন: নগদ" />
                    </div>
                  </>
                )}
                <div className="text-xs space-y-1 bg-muted/40 rounded p-2">
                  <div className="flex justify-between"><span>এখন পরিশোধ:</span><span className="text-cyan-700 dark:text-cyan-400 font-medium">৳{payNow.toLocaleString()}</span></div>
                  <div className="border-t border-border pt-1 flex justify-between font-bold">
                    <span>চূড়ান্ত বাকি:</span>
                    <span className={remain > 0 ? 'text-destructive' : 'text-green-600 dark:text-green-400'}>{remain > 0 ? `৳${remain.toLocaleString()}` : '✓ পরিশোধিত'}</span>
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground italic">এই মান শুধু মেমোতে দেখানো হবে — কোনো লেনদেন তৈরি হবে না।</div>
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" className="flex-1" onClick={() => { setPrintDlgOpen(false); setPrintDlgPayload(null); }}>বাতিল</Button>
                  <Button className="flex-1" onClick={() => {
                    const slipInput = printDlgPayload.build({
                      pay_now_amount: payNow,
                      pay_now_note: printPayNote || null,
                      mark_paid: printMarkPaid,
                    });
                    openSalarySlip(slipInput);
                    setPrintDlgOpen(false);
                    setPrintDlgPayload(null);
                  }}>🖨️ প্রিন্ট</Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Advance edit dialog for historical salary record */}
      <Dialog open={advRecOpen} onOpenChange={(o) => { if (!o) { setAdvRecOpen(false); setAdvRec(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{advRec ? `🪙 অগ্রিম — ${monthNames[advRec.month]} ${advRec.year}` : '🪙 অগ্রিম'}</DialogTitle>
          </DialogHeader>
          {advRec && (() => {
            const finalSal = Number(advRec.final_salary || 0);
            const paid = Number(advRec.paid_amount || 0);
            const advNow = Number(advRecAmount || 0);
            const remain = Math.max(0, finalSal - paid - advNow);
            return (
              <div className="space-y-3 text-sm">
                <div className="text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/30 rounded p-2">
                  ⚠️ অগ্রিম শুধু প্রিন্ট মেমোতে বিল ক্লিয়ার দেখানোর জন্য — মূল বেতন/উপস্থিতিতে কোনো প্রভাব পড়বে না।
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">অগ্রিম পরিমাণ (৳)</label>
                  <Input type="number" inputMode="numeric" value={advRecAmount} onChange={e => setAdvRecAmount(e.target.value)} placeholder="যেমন: 2000" autoFocus />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">নোট (ঐচ্ছিক)</label>
                  <Input value={advRecNote} onChange={e => setAdvRecNote(e.target.value)} placeholder="যেমন: মাসের আগে নিয়েছে" />
                </div>
                <div className="text-xs space-y-1 bg-muted/50 rounded p-2">
                  <div className="flex justify-between"><span>মোট বেতন:</span><span>৳{finalSal.toLocaleString()}</span></div>
                  {paid > 0 && <div className="flex justify-between"><span>পরিশোধিত:</span><span>−৳{paid.toLocaleString()}</span></div>}
                  <div className="flex justify-between text-blue-700 dark:text-blue-400"><span>অগ্রিম নিয়েছে:</span><span>−৳{advNow.toLocaleString()}</span></div>
                  <div className="border-t border-border pt-1 flex justify-between font-bold"><span>এখন পাবে:</span><span>৳{remain.toLocaleString()}</span></div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" className="flex-1" onClick={() => { setAdvRecOpen(false); setAdvRec(null); }}>বাতিল</Button>
                  <Button className="flex-1" disabled={updateSalaryRecord.isPending} onClick={handleAdvRecSubmit}>সেভ</Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ========== SALARIED PRODUCTION SECTION ==========
function SalariedProductionSection({ personId, personName, totalSalaryPaid }: { personId: string; personName: string; totalSalaryPaid: number }) {
  const { data: entries = [] } = useProductionEntries(personId);
  const createEntry = useCreateProductionEntry();
  const updateEntry = useUpdateProductionEntry();
  const deleteEntry = useDeleteProductionEntry();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [form, setForm] = useState({ date: toLocalDateStr(), product_name: '', quantity: '', pricing: '', total: '', is_submission: false });
  const [editForm, setEditForm] = useState({ date: '', product_name: '', quantity: '', pricing: '', total: '', is_submission: false });

  const totalWork = entries.filter(e => !e.is_submission).reduce((s, e) => s + e.total, 0);
  const totalSubmission = entries.filter(e => e.is_submission).reduce((s, e) => s + e.total, 0);
  const productionBalance = totalWork - totalSubmission;
  const profitLoss = totalWork - totalSalaryPaid;

  let runWork = 0;
  let runSub = 0;
  const enriched = entries.map(e => {
    if (e.is_submission) runSub += e.total;
    else runWork += e.total;
    return { ...e, runWork, runSub };
  });

  const handleSubmit = () => {
    const qty = form.is_submission ? null : Number(form.quantity) || null;
    const pricing = form.is_submission ? null : Number(form.pricing) || null;
    const total = form.is_submission ? Number(form.total) : (qty && pricing ? qty * pricing : Number(form.total) || 0);
    createEntry.mutate({
      person_id: personId, date: form.date,
      product_name: form.is_submission ? 'Submission' : form.product_name,
      quantity: qty, pricing, total, is_submission: form.is_submission,
    }, {
      onSuccess: () => { setOpen(false); setForm({ date: toLocalDateStr(), product_name: '', quantity: '', pricing: '', total: '', is_submission: false }); toast.success('এন্ট্রি যোগ হয়েছে'); },
      onError: () => toast.error('এন্ট্রি যোগ করতে সমস্যা হয়েছে'),
    });
  };

  const openEdit = (entry: any) => {
    setEditingEntry(entry);
    setEditForm({ date: entry.date, product_name: entry.product_name, quantity: entry.quantity?.toString() || '', pricing: entry.pricing?.toString() || '', total: entry.total.toString(), is_submission: entry.is_submission });
    setEditOpen(true);
  };

  const handleUpdate = () => {
    if (!editingEntry) return;
    const qty = editForm.is_submission ? null : Number(editForm.quantity) || null;
    const pricing = editForm.is_submission ? null : Number(editForm.pricing) || null;
    const total = editForm.is_submission ? Number(editForm.total) : (qty && pricing ? qty * pricing : Number(editForm.total) || 0);
    updateEntry.mutate({
      id: editingEntry.id, person_id: personId, date: editForm.date,
      product_name: editForm.is_submission ? 'Submission' : editForm.product_name,
      quantity: qty, pricing, total, is_submission: editForm.is_submission,
    }, {
      onSuccess: () => { setEditOpen(false); setEditingEntry(null); toast.success('এন্ট্রি আপডেট হয়েছে'); },
      onError: () => toast.error('আপডেট করতে সমস্যা হয়েছে'),
    });
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteEntry.mutate({ id: deleteId, person_id: personId }, {
      onSuccess: () => { setDeleteId(null); toast.success('এন্ট্রি মুছে ফেলা হয়েছে'); },
      onError: () => toast.error('মুছতে সমস্যা হয়েছে'),
    });
  };

  return (
    <div className="space-y-2">
      {/* Production Summary Cards */}
      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-2.5 border-b border-border bg-muted/30">
            <h3 className="text-sm font-bold">📊 প্রোডাকশন হিসাব</h3>
          </div>
          <div className="grid grid-cols-4 divide-x divide-border">
            <div className="px-2 py-2 text-center bg-blue-50 dark:bg-blue-950/20">
              <div className="text-[10px] text-muted-foreground">মোট কাজ</div>
              <div className="text-xs font-bold text-blue-700 dark:text-blue-400">৳{totalWork.toLocaleString()}</div>
            </div>
            <div className="px-2 py-2 text-center bg-green-50 dark:bg-green-950/20">
              <div className="text-[10px] text-muted-foreground">জমা</div>
              <div className="text-xs font-bold text-green-700 dark:text-green-400">৳{totalSubmission.toLocaleString()}</div>
            </div>
            <div className="px-2 py-2 text-center bg-amber-50 dark:bg-amber-950/20">
              <div className="text-[10px] text-muted-foreground">বাকি</div>
              <div className="text-xs font-bold text-amber-700 dark:text-amber-400">৳{productionBalance.toLocaleString()}</div>
            </div>
            <div className={`px-2 py-2 text-center ${profitLoss >= 0 ? 'bg-green-50 dark:bg-green-950/20' : 'bg-red-50 dark:bg-red-950/20'}`}>
              <div className="text-[10px] text-muted-foreground">লাভ/লোকসান</div>
              <div className={`text-xs font-bold ${profitLoss >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                {profitLoss >= 0 ? '+' : ''}৳{profitLoss.toLocaleString()}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Production Entry */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" className="w-full print:hidden"><Plus className="h-4 w-4 mr-1" /> প্রোডাকশন এন্ট্রি</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>প্রোডাকশন এন্ট্রি যোগ করুন</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_submission} onChange={e => setForm(f => ({ ...f, is_submission: e.target.checked }))} />
              এটি জমা
            </label>
            <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            {!form.is_submission && (
              <>
                <Input placeholder="পণ্যের নাম" value={form.product_name} onChange={e => setForm(f => ({ ...f, product_name: e.target.value }))} />
                <div className="grid grid-cols-2 gap-2">
                  <Input type="number" placeholder="পরিমাণ" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
                  <Input type="number" placeholder="প্রতি পিস দর" value={form.pricing} onChange={e => setForm(f => ({ ...f, pricing: e.target.value }))} />
                </div>
              </>
            )}
            <Input type="number" placeholder="মোট টাকা" value={form.total || (Number(form.quantity) * Number(form.pricing) || '')} onChange={e => setForm(f => ({ ...f, total: e.target.value }))} />
            <Button onClick={handleSubmit} disabled={createEntry.isPending} className="w-full">যোগ করুন</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>এন্ট্রি এডিট করুন</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editForm.is_submission} onChange={e => setEditForm(f => ({ ...f, is_submission: e.target.checked }))} />
              এটি জমা
            </label>
            <Input type="date" value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} />
            {!editForm.is_submission && (
              <>
                <Input placeholder="পণ্যের নাম" value={editForm.product_name} onChange={e => setEditForm(f => ({ ...f, product_name: e.target.value }))} />
                <div className="grid grid-cols-2 gap-2">
                  <Input type="number" placeholder="পরিমাণ" value={editForm.quantity} onChange={e => setEditForm(f => ({ ...f, quantity: e.target.value }))} />
                  <Input type="number" placeholder="প্রতি পিস দর" value={editForm.pricing} onChange={e => setEditForm(f => ({ ...f, pricing: e.target.value }))} />
                </div>
              </>
            )}
            <Input type="number" placeholder="মোট টাকা" value={editForm.total || (Number(editForm.quantity) * Number(editForm.pricing) || '')} onChange={e => setEditForm(f => ({ ...f, total: e.target.value }))} />
            <Button onClick={handleUpdate} disabled={updateEntry.isPending} className="w-full">আপডেট করুন</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>এন্ট্রি মুছে ফেলবেন?</AlertDialogTitle>
            <AlertDialogDescription>এই এন্ট্রিটি মুছে ফেলা হবে।</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>বাতিল</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">মুছে ফেলুন</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Production Table */}
      {enriched.length > 0 && (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-2 py-2 text-left font-medium">তারিখ</th>
                  <th className="px-2 py-2 text-left font-medium">পণ্য</th>
                  <th className="px-2 py-2 text-right font-medium">পরিমাণ</th>
                  <th className="px-2 py-2 text-right font-medium">দর</th>
                  <th className="px-2 py-2 text-right font-medium">মোট</th>
                  <th className="px-2 py-2 text-right font-medium">ব্যালেন্স</th>
                  <th className="px-1 py-2 text-center font-medium print:hidden">⚙</th>
                </tr>
              </thead>
              <tbody>
                {enriched.map(e => (
                  <tr key={e.id} className={`border-b border-border ${e.is_submission ? 'bg-green-50 dark:bg-green-950/20' : ''}`}>
                    <td className="px-2 py-2">{format(new Date(e.date), 'dd/MM')}</td>
                    <td className="px-2 py-2 font-medium">{e.product_name}</td>
                    <td className="px-2 py-2 text-right">{e.quantity ?? '—'}</td>
                    <td className="px-2 py-2 text-right">{e.pricing ?? '—'}</td>
                    <td className={`px-2 py-2 text-right font-medium ${e.is_submission ? 'text-green-600' : ''}`}>
                      {e.is_submission ? `-৳${e.total.toLocaleString()}` : `৳${e.total.toLocaleString()}`}
                    </td>
                    <td className="px-2 py-2 text-right font-bold">৳{(e.runWork - e.runSub).toLocaleString()}</td>
                    <td className="px-1 py-1 text-center print:hidden">
                      <div className="flex items-center gap-0.5 justify-center">
                        <button onClick={() => openEdit(e)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><Pencil className="h-3 w-3" /></button>
                        <button onClick={() => setDeleteId(e.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ========== PERSON CHIPS NAV BAR ==========
function PersonChipsBar({ currentId, unitId }: { currentId: string; unitId: string | null }) {
  const navigate = useNavigate();
  const { data: unitPersons = [] } = usePersons({ unit_id: unitId || undefined });
  const { data: units = [] } = useUnits();
  const unit = units.find(u => u.id === unitId);
  const unitSettings = (unit?.settings || {}) as Record<string, any>;
  const isOffice = unit?.name === 'অফিস' || (unit?.name || '').toLowerCase().includes('office');
  const isPrintUnit = (unit?.name || '').includes('প্রিন্ট') || (unit?.name || '').toLowerCase().includes('print');
  const workLabel = isOffice ? '📋 পণ্য কেনার শীট' : isPrintUnit ? '📋 প্রিন্টের কাজ' : '📋 কারখানার কাজ';

  const activePersons = unitPersons.filter(p => p.is_active);
  const employees = activePersons.filter(p => p.type === 'employee' || p.type === 'salaried_production');
  const productionStaff = activePersons.filter(p => p.type === 'production_staff');
  const parties = activePersons.filter(p => p.type === 'party' || p.type === 'supplier');
  const salesParties = activePersons.filter(p => p.type === 'sales_party');
  const workParties = activePersons.filter(p => p.type === 'work_party');
  const loanKistis = activePersons.filter(p => p.type === 'loan_kisti');

  // Build combined navigation list: persons + modules
  type NavItem = { type: 'person'; id: string; name: string; navigateTo: string } | { type: 'module'; id: string; name: string; navigateTo: string };
  const personItems: NavItem[] = [...employees, ...productionStaff, ...parties, ...salesParties, ...workParties, ...loanKistis].map(p => ({
    type: 'person', id: p.id, name: p.name, navigateTo: `/admin/accounting/persons/${p.id}`,
  }));
  const moduleItems: NavItem[] = [];
  if (unitSettings.has_materials) moduleItems.push({ type: 'module', id: 'materials', name: '📦 ম্যাটেরিয়াল', navigateTo: `/admin/accounting/units/${unitId}/modules/materials` });
  if (unitSettings.has_fixed_expenses) moduleItems.push({ type: 'module', id: 'fixed_expenses', name: `📋 ${unitSettings.fixed_expenses_label || 'নিয়মিত খরচ'}`, navigateTo: `/admin/accounting/units/${unitId}/modules/fixed_expenses` });
  if (unitSettings.has_rent) moduleItems.push({ type: 'module', id: 'rent', name: '🏠 ভাড়া', navigateTo: `/admin/accounting/units/${unitId}/modules/rent` });
  moduleItems.push({ type: 'module', id: 'loans', name: '💳 ঋণ / ধার', navigateTo: `/admin/accounting/units/${unitId}/modules/loans` });
  for (const modName of (unitSettings.custom_modules || [])) {
    moduleItems.push({ type: 'module', id: `custom-${modName}`, name: `🚀 ${modName}`, navigateTo: `/admin/accounting/units/${unitId}/modules/custom-${modName}` });
  }
  if (!unitSettings.internal_work_party_id) {
    moduleItems.push({ type: 'module', id: 'work-orders', name: workLabel, navigateTo: `/admin/accounting/units/${unitId}/work-orders` });
  }

  const allSorted = [...personItems, ...moduleItems];
  const currentIdx = allSorted.findIndex(item => item.type === 'person' && item.id === currentId);
  const prevItem = currentIdx > 0 ? allSorted[currentIdx - 1] : null;
  const nextItem = currentIdx < allSorted.length - 1 ? allSorted[currentIdx + 1] : null;

  if (activePersons.length === 0) return null;

  const rowBase = "flex items-center gap-1 w-full px-1.5 py-1.5 rounded-md border text-[10.5px] leading-tight font-medium text-left transition-colors";

  const getRowStyle = (p: any, isActive: boolean) => {
    const typeColors: Record<string, { border: string; bg: string; text: string; activeBg: string }> = {
      employee: { border: 'border-blue-300/50', bg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-700 dark:text-blue-400', activeBg: 'bg-blue-200 dark:bg-blue-800/50' },
      salaried_production: { border: 'border-cyan-300/50', bg: 'bg-cyan-50 dark:bg-cyan-950/30', text: 'text-cyan-700 dark:text-cyan-400', activeBg: 'bg-cyan-200 dark:bg-cyan-800/50' },
      production_staff: { border: 'border-green-300/50', bg: 'bg-green-50 dark:bg-green-950/30', text: 'text-green-700 dark:text-green-400', activeBg: 'bg-green-200 dark:bg-green-800/50' },
      party: { border: 'border-orange-300/50', bg: 'bg-orange-50 dark:bg-orange-950/30', text: 'text-orange-700 dark:text-orange-400', activeBg: 'bg-orange-200 dark:bg-orange-800/50' },
      supplier: { border: 'border-orange-300/50', bg: 'bg-orange-50 dark:bg-orange-950/30', text: 'text-orange-700 dark:text-orange-400', activeBg: 'bg-orange-200 dark:bg-orange-800/50' },
      sales_party: { border: 'border-teal-300/50', bg: 'bg-teal-50 dark:bg-teal-950/30', text: 'text-teal-700 dark:text-teal-400', activeBg: 'bg-teal-200 dark:bg-teal-800/50' },
      work_party: { border: 'border-amber-300/50', bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-400', activeBg: 'bg-amber-200 dark:bg-amber-800/50' },
      loan_kisti: { border: 'border-purple-300/50', bg: 'bg-purple-50 dark:bg-purple-950/30', text: 'text-purple-700 dark:text-purple-400', activeBg: 'bg-purple-200 dark:bg-purple-800/50' },
    };
    const c = typeColors[p.type] || typeColors.employee;
    return `${c.border} ${isActive ? `${c.activeBg} ${c.text} ring-1 ring-offset-1 font-bold` : `${c.bg} ${c.text} hover:opacity-80`}`;
  };

  const customModuleNames: string[] = unitSettings.custom_modules || [];
  const kaporModule = customModuleNames.find((m) => m === 'কাপর');
  const otherCustomModules = customModuleNames.filter((m) => m !== 'কাপর');

  const Section = ({ label, colorClass, children }: { label: string; colorClass: string; children: React.ReactNode }) => (
    <div className="space-y-1">
      <div className={`text-[9px] font-bold uppercase tracking-wider px-0.5 ${colorClass}`}>{label}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );

  return (
    <>
      {/* Prev/Next + current position — compact, stays at top */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm py-1.5 flex items-center justify-center gap-2">
        <button onClick={() => prevItem && navigate(prevItem.navigateTo)} disabled={!prevItem}
          className="w-7 h-7 rounded-full flex items-center justify-center transition-all disabled:opacity-20 bg-muted/50">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-xs font-medium text-muted-foreground">
          {currentIdx >= 0 ? currentIdx + 1 : '–'}/{allSorted.length}
        </span>
        <button onClick={() => nextItem && navigate(nextItem.navigateTo)} disabled={!nextItem}
          className="w-7 h-7 rounded-full flex items-center justify-center transition-all disabled:opacity-20 bg-muted/50">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Persistent floating nav rail — same pattern as the unit profile page */}
      <div
        className="fixed z-30 top-1/2 -translate-y-1/2 right-1 sm:right-3 w-[104px] sm:w-32 max-h-[78vh] overflow-y-auto rounded-xl border border-border bg-background/95 backdrop-blur-sm shadow-lg p-1.5 space-y-2 no-scrollbar"
        style={{ scrollbarWidth: 'none' }}
      >
        {unitId && (
          <button onClick={() => navigate(`/admin/accounting/units/${unitId}`)}
            className={`${rowBase} border-muted-foreground/30 bg-muted/50 text-muted-foreground hover:bg-muted`}>
            <span className="truncate">← ইউনিট</span>
          </button>
        )}
        {employees.length > 0 && (
          <Section label="💼 বেতন" colorClass="text-blue-500">
            {employees.map(p => (
              <button key={p.id} onClick={() => navigate(`/admin/accounting/persons/${p.id}`)}
                className={`${rowBase} ${getRowStyle(p, p.id === currentId)}`}>
                <span className="truncate">{p.name}</span>
              </button>
            ))}
          </Section>
        )}
        {productionStaff.length > 0 && (
          <Section label="⚙️ প্রোডাকশন" colorClass="text-green-600">
            {productionStaff.map(p => (
              <button key={p.id} onClick={() => navigate(`/admin/accounting/persons/${p.id}`)}
                className={`${rowBase} ${getRowStyle(p, p.id === currentId)}`}>
                <span className="truncate">{p.name}</span>
              </button>
            ))}
          </Section>
        )}
        {parties.length > 0 && (
          <Section label="🤝 পার্টি" colorClass="text-orange-600">
            {parties.map(p => (
              <button key={p.id} onClick={() => navigate(`/admin/accounting/persons/${p.id}`)}
                className={`${rowBase} ${getRowStyle(p, p.id === currentId)}`}>
                <span className="truncate">{p.name}</span>
              </button>
            ))}
          </Section>
        )}
        {/* Cash-purchase sheets (নগদ টাকায় কেনা — বাকি না রেখে) sit next to পার্টি, same as unit page.
            work-orders chip only shown when the unit has no internal work sheet of its own —
            otherwise this whole page's chip strip would just be a redundant second route to it. */}
        {(kaporModule || (unitId && !unitSettings.internal_work_party_id)) && (
          <Section label="💵 নগদ ক্রয়" colorClass="text-rose-600">
            {kaporModule && (
              <button onClick={() => navigate(`/admin/accounting/units/${unitId}/modules/custom-${kaporModule}`)}
                className={`${rowBase} border-purple-300/50 bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-950/30 dark:text-purple-400`}>
                <span>🚀</span><span className="truncate">{kaporModule}</span>
              </button>
            )}
            {!unitSettings.internal_work_party_id && (
              <button onClick={() => navigate(`/admin/accounting/units/${unitId}/work-orders`)}
                className={`${rowBase} border-indigo-300/50 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:text-indigo-400`}>
                <ClipboardList className="h-3 w-3 shrink-0" /> <span className="truncate">{workLabel.replace('📋 ', '')}</span>
              </button>
            )}
          </Section>
        )}
        {loanKistis.length > 0 && (
          <Section label="💳 ঋণ" colorClass="text-purple-600">
            {loanKistis.map(p => (
              <button key={p.id} onClick={() => navigate(`/admin/accounting/persons/${p.id}`)}
                className={`${rowBase} ${getRowStyle(p, p.id === currentId)}`}>
                <span className="truncate">{p.name}</span>
              </button>
            ))}
          </Section>
        )}
        {salesParties.length > 0 && (
          <Section label="🛒 বিক্রি" colorClass="text-teal-600">
            {salesParties.map(p => (
              <button key={p.id} onClick={() => navigate(`/admin/accounting/persons/${p.id}`)}
                className={`${rowBase} ${getRowStyle(p, p.id === currentId)}`}>
                <span className="truncate">{p.name}</span>
              </button>
            ))}
          </Section>
        )}
        {workParties.length > 0 && (
          <Section label="🧾 কাজ" colorClass="text-amber-600">
            {workParties.map(p => (
              <button key={p.id} onClick={() => navigate(`/admin/accounting/persons/${p.id}`)}
                className={`${rowBase} ${getRowStyle(p, p.id === currentId)}`}>
                <span className="truncate">{p.name}</span>
              </button>
            ))}
          </Section>
        )}
        <Section label="🗂️ মডিউল" colorClass="text-muted-foreground">
          {unitSettings.has_materials && (
            <button onClick={() => navigate(`/admin/accounting/units/${unitId}/modules/materials`)}
              className={`${rowBase} border-amber-300/50 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-400`}>
              <Package className="h-3 w-3 shrink-0" /> <span className="truncate">ম্যাটেরিয়াল</span>
            </button>
          )}
          {unitSettings.has_fixed_expenses && (
            <button onClick={() => navigate(`/admin/accounting/units/${unitId}/modules/fixed_expenses`)}
              className={`${rowBase} border-blue-300/50 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-400`}>
              <Receipt className="h-3 w-3 shrink-0" /> <span className="truncate">{unitSettings.fixed_expenses_label || 'নিয়মিত খরচ'}</span>
            </button>
          )}
          {unitSettings.has_rent && (
            <button onClick={() => navigate(`/admin/accounting/units/${unitId}/modules/rent`)}
              className={`${rowBase} border-pink-300/50 bg-pink-50 text-pink-700 hover:bg-pink-100 dark:bg-pink-950/30 dark:text-pink-400`}>
              <Home className="h-3 w-3 shrink-0" /> <span className="truncate">ভাড়া</span>
            </button>
          )}
          <button onClick={() => navigate(`/admin/accounting/units/${unitId}/modules/loans`)}
            className={`${rowBase} border-rose-300/50 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-400`}>
            <Landmark className="h-3 w-3 shrink-0" /> <span className="truncate">ঋণ / ধার</span>
          </button>
          {otherCustomModules.map((modName: string) => (
            <button key={modName} onClick={() => navigate(`/admin/accounting/units/${unitId}/modules/custom-${modName}`)}
              className={`${rowBase} border-purple-300/50 bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-950/30 dark:text-purple-400`}>
              <span>🚀</span><span className="truncate">{modName}</span>
            </button>
          ))}
        </Section>
      </div>
    </>
  );
}

// ========== MAIN COMPONENT ==========
export default function AdminPersonProfile() {
  const { id } = useParams();
  const { data: person, isLoading } = usePerson(id);

  if (isLoading) return <div className="flex items-center justify-center py-10 text-muted-foreground">লোড হচ্ছে...</div>;
  if (!person) return <div className="text-center py-10 text-muted-foreground">ব্যক্তি পাওয়া যায়নি</div>;

  const content = (() => {
    if (person.type === 'party' || person.type === 'supplier') {
      return <PartyProfileView person={person} id={id!} />;
    }
    if (person.type === 'sales_party' || person.type === 'work_party') {
      return <PartyProfileView person={person} id={id!} direction="sales" />;
    }
    if (person.type === 'loan_kisti') {
      return <LoanProfileView person={person} id={id!} />;
    }
    if (person.type === 'production_staff') {
      return <ProductionProfileView person={person} id={id!} />;
    }
    // employee and salaried_production both use EmployeeProfileView
    return <EmployeeProfileView person={person} id={id!} />;
  })();

  return (
    <div className="space-y-2 pr-[112px] sm:pr-36">
      <PersonChipsBar currentId={id!} unitId={person.unit_id} />
      {content}
    </div>
  );
}

// ========== LOAN PROFILE VIEW (ঋণ কিস্তি) ==========
function LoanProfileView({ person, id }: { person: any; id: string }) {
  const loanId = person.linked_loan_id as string | null;
  const { data: loanRow } = useQuery({
    queryKey: ['acc-loan', loanId],
    enabled: !!loanId,
    queryFn: async () => {
      const { data, error } = await (supabase.from('acc_loans' as any) as any).select('*').eq('id', loanId).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });
  const { data: payments = [] } = useLoanPayments(loanId || undefined);
  const { data: paymentCounts = {} } = useAllLoanPaymentCounts();
  const { data: accounts = [] } = useAccounts();
  const updateLoan = useUpdateLoan();
  const deleteLoan = useDeleteLoan();
  const deletePayment = useDeleteLoanPayment();

  const [payOpen, setPayOpen] = useState(false);
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null);

  const handleDeletePayment = async () => {
    if (!deletePaymentId || !loanId) return;
    try {
      await deletePayment.mutateAsync({ id: deletePaymentId, loan_id: loanId });
      toast.success('পেমেন্ট ডিলিট হয়েছে — হিসাব ফিরিয়ে দেওয়া হয়েছে');
      setDeletePaymentId(null);
    } catch (e: any) { toast.error(e.message); }
  };

  if (!loanId) {
    return (
      <Card><CardContent className="p-6 text-center text-muted-foreground">
        এই ঋণ ব্যক্তির সাথে কোনো ঋণ লিংক নেই। দয়া করে নতুন করে ঋণ কিস্তি ব্যক্তি তৈরি করুন।
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-3">
      <ProfileToolbar personId={person?.id} personName={person?.name} personCode={person?.person_code} />

      {loanRow && (
        <LoanCard
          loan={loanRow}
          paymentCount={paymentCounts[loanId] || { count: 0, totalPaid: 0 }}
          onPayClick={() => setPayOpen(true)}
          onToggleStatus={() => updateLoan.mutate({ id: loanId, status: loanRow?.status === 'active' ? 'closed' : 'active' }, {
            onSuccess: () => toast.success(loanRow?.status === 'active' ? 'ঋণ বন্ধ করা হয়েছে' : 'ঋণ চালু করা হয়েছে'),
          })}
          onDelete={() => deleteLoan.mutate(loanId, {
            onSuccess: () => toast.success('ঋণ ডিলিট হয়েছে'),
            onError: (e: any) => toast.error(e?.message || 'ডিলিট করা যায়নি'),
          })}
        />
      )}

      {/* Payment history */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-2 py-2 text-left font-medium">তারিখ</th>
                <th className="px-2 py-2 text-left font-medium">উৎস</th>
                <th className="px-2 py-2 text-left font-medium">নোট</th>
                <th className="px-2 py-2 text-right font-medium">পরিমাণ</th>
                <th className="px-2 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 && (
                <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">এখনও কোনো কিস্তি দেওয়া হয়নি</td></tr>
              )}
              {payments.map(p => (
                <tr key={p.id} className="border-b border-border">
                  <td className="px-2 py-2">{format(new Date(p.payment_date), 'dd/MM/yyyy')}</td>
                  <td className="px-2 py-2">{p.payment_source === 'cash' ? 'নগদ' : 'অ্যাকাউন্ট'}</td>
                  <td className="px-2 py-2 text-muted-foreground">{p.note || '—'}</td>
                  <td className="px-2 py-2 text-right font-semibold text-green-700">৳{Number(p.amount).toLocaleString()}</td>
                  <td className="px-2 py-2 text-right">
                    <button onClick={() => setDeletePaymentId(p.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <PayInstallmentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        loanId={loanId}
        defaultAmount={Number(loanRow?.monthly_installment || 0)}
        accounts={accounts as any}
      />

      <AlertDialog open={!!deletePaymentId} onOpenChange={(o) => { if (!o) setDeletePaymentId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>পেমেন্টটি ডিলিট করবেন?</AlertDialogTitle>
            <AlertDialogDescription>এই পেমেন্টটি মুছে গেলে ক্যাশ/ব্যাংক ব্যালেন্স আগের অবস্থায় ফিরে যাবে।</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>বাতিল</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePayment} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">ডিলিট করুন</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Inline Label fallback (some files import from radix; reuse existing)
function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <label className={`text-xs font-medium mb-1 block ${className || ''}`}>{children}</label>;
}
