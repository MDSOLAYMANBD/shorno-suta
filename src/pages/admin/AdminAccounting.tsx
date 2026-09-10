import { useState, useMemo, useEffect } from 'react';
import { backfillPaidOrderSaleEntries } from '@/lib/officeSellSaleEntry';
import { useAllSettings } from '@/hooks/useAllSettings';
import { useAccounts, useCreateTransaction, useDeleteTransaction, useUpdateTransaction, useTransactionSummary, type AccTransaction } from '@/hooks/useAccounting';
import { useUnits } from '@/hooks/useAccounting';
import { usePersons } from '@/hooks/usePersons';
import { allocatePaymentToRentRecords } from '@/hooks/useRent';
import { useLoans, useCreateLoanPayment, useAllLoanPaymentCounts } from '@/hooks/useLoans';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Plus, Landmark, Banknote, Building2, ChevronLeft, ChevronRight, Trash2, Pencil, CalendarIcon, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/supabaseHelpers';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import SalesPartyPaymentDialog from '@/components/admin/SalesPartyPaymentDialog';
import { cn, toLocalDateStr } from '@/lib/utils';

/** Convert YYYY-MM-DD date string to ISO timestamp preserving current time. */
function dateStrToIso(dateStr?: string): string | undefined {
  if (!dateStr) return undefined;
  const time = new Date().toTimeString().slice(0, 8);
  return new Date(`${dateStr}T${time}`).toISOString();
}

const txTypeLabel: Record<string, string> = {
  sale: 'বিক্রয়', salary: 'বেতন', production_payment: 'প্রোডাকশন পেমেন্ট',
  party_payment: 'পার্টি পেমেন্ট', courier_withdrawal: 'কুরিয়ার উত্তোলন',
  expense: 'খরচ', adjustment: 'সমন্বয়', deposit: 'জমা', advance: 'অ্যাডভান্স', bonus: 'বোনাস',
};

const accountTypeMap: Record<string, string[]> = {
  cash: ['deposit', 'courier_withdrawal', 'salary', 'expense', 'advance', 'bonus', 'adjustment'],
  sale: ['sale', 'production_payment', 'party_payment'],
};

const typePersonFilter: Record<string, string[]> = {
  salary: ['employee', 'salaried_production'], advance: ['employee', 'salaried_production'], bonus: ['employee', 'salaried_production'],
  production_payment: ['production_staff', 'salaried_production'],
  party_payment: ['party'],
};

const DEBIT_TYPES = ['salary', 'production_payment', 'party_payment', 'expense', 'advance', 'bonus'];

const BANGLA_MONTHS = ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];

const isDebit = (type: string) => DEBIT_TYPES.includes(type);

const PAGE_SIZE = 200;

export default function AdminAccounting() {
  const navigate = useNavigate();
  const { data: accounts = [], isLoading: accLoading } = useAccounts();
  const { data: persons = [] } = usePersons();
  const { data: units = [] } = useUnits();
  const { data: summary } = useTransactionSummary();
  const { data: allSettings } = useAllSettings();
  const [historyPage, setHistoryPage] = useState(0);
  const [filterDateFrom, setFilterDateFrom] = useState<Date | undefined>();
  const [filterDateTo, setFilterDateTo] = useState<Date | undefined>();
  const [filterUnitId, setFilterUnitId] = useState<string>('all');
  // Month/Year filter for dashboard stats + daily ledger
  const _today = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(_today.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(_today.getFullYear());
  // Custom date-range override (overrides month/year when both set)
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const customActive = !!(customFrom && customTo);
  const customFromStr = customFrom ? toLocalDateStr(customFrom) : '';
  const customToStr = customTo ? toLocalDateStr(customTo) : '';


  // Parse business config for opening balances
  const bizOpeningCash = useMemo(() => {
    try {
      const parsed = JSON.parse(allSettings?.acc_business_config || '{}');
      return parsed.opening_balance_cash ?? parsed.opening_balance ?? 0;
    } catch { return 0; }
  }, [allSettings?.acc_business_config]);
  const bizOpeningBank = useMemo(() => {
    try {
      const parsed = JSON.parse(allSettings?.acc_business_config || '{}');
      return parsed.opening_balance_bank ?? 0;
    } catch { return 0; }
  }, [allSettings?.acc_business_config]);

  // Employee profiles map for "who did this" display
  const { data: staffMap = {} } = useQuery({
    queryKey: ['employee-profiles-map'],
    queryFn: async () => {
      const { data } = await supabase.from('employee_profiles').select('user_id, full_name');
      const map: Record<string, string> = {};
      (data || []).forEach((p: any) => { map[p.user_id] = p.full_name; });
      return map;
    },
  });

  // Courier payment totals + expense source totals
  const { data: financials } = useQuery({
    queryKey: ['accounting-financials'],
    queryFn: async () => {
      // Get courier payments with method set
      const { data: cpData, error: cpErr } = await supabase.from('courier_payments').select('receivable_amount, bank_amount, cash_amount, receive_method, date, created_at');
      if (cpErr) throw cpErr;
      const withMethod = (cpData || []).filter(r => r.receive_method);
      // Cutoff: পুরনো courier invoice গুলো ইতিমধ্যে real bank এ ধরা আছে — accounting এ count করব না
      const COURIER_PAYMENT_CUTOFF = '2026-03-17';
      const withMethodCounted = withMethod.filter(r => ((r.date || r.created_at || '') >= COURIER_PAYMENT_CUTOFF));
      const totalReceivable = withMethodCounted.reduce((s, r) => s + (Number(r.receivable_amount) || 0), 0);
      const totalBank = withMethodCounted.reduce((s, r) => s + (Number(r.bank_amount) || 0), 0);
      const totalCash = withMethodCounted.reduce((s, r) => s + (Number(r.cash_amount) || 0), 0);

      // Get expense + transfer totals by source
      // Fetch account_id too so we can use it as a stronger signal than source
      const cashAccId = '266fdf05-43ef-4dc6-8660-842a958df62e';
      const bankAccId = 'c0831bd8-c223-4663-a051-5b923bdb4256';
      const txs = await fetchAllRows<{ type: string; amount: number; source: string | null; account_id: string; created_at: string }>(
        () => (supabase.from('acc_transactions' as any) as any).select('type, amount, source, account_id, created_at')
      );
      let totalExpenses = 0, cashExpenses = 0, bankExpenses = 0;
      let transferOutBank = 0, transferOutCash = 0;
      let officeSellCash = 0, officeSellBank = 0;
      let depositCash = 0, depositBank = 0;
      const OFFICE_SELL_CUTOFF = '2026-03-17T00:00:00';

      // Resolve source using both account_id and source column for maximum reliability
      const resolveSource = (tx: { source: string | null; account_id: string }) => {
        // account_id pointing to bank is strongest signal (set by edit handler)
        if (tx.account_id === bankAccId) return 'bank';
        // source column is next (set at creation time, reflects user intent)
        if (tx.source === 'bank') return 'bank';
        if (tx.source === 'cash') return 'cash';
        // Default: if account_id is cash or unknown, assume cash
        return 'cash';
      };

      // Daily changes tracking for running balance + monthly breakdown
      const dailyChanges: Record<string, { bankChange: number; cashChange: number; sales: number; expenses: number; withdrawals: number }> = {};
      const ensureDay = (d: string) => { if (!dailyChanges[d]) dailyChanges[d] = { bankChange: 0, cashChange: 0, sales: 0, expenses: 0, withdrawals: 0 }; };
      const toLocalDate = (iso: string) => {
        const dt = new Date(iso);
        return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
      };

      for (const tx of txs) {
        const amt = Number(tx.amount);
        const day = toLocalDate(tx.created_at);
        const src = resolveSource(tx);
        ensureDay(day);
        if (DEBIT_TYPES.includes(tx.type)) {
          totalExpenses += amt;
          dailyChanges[day].expenses += amt;
          if (src === 'cash') { cashExpenses += amt; dailyChanges[day].cashChange -= amt; }
          else { bankExpenses += amt; dailyChanges[day].bankChange -= amt; }
        } else if (tx.type === 'courier_withdrawal') {
          dailyChanges[day].withdrawals += amt;
          // Transfer between bank<->cash
          if (src === 'bank') { transferOutBank += amt; dailyChanges[day].bankChange -= amt; dailyChanges[day].cashChange += amt; }
          else { transferOutCash += amt; dailyChanges[day].cashChange -= amt; dailyChanges[day].bankChange += amt; }
        } else if (tx.type === 'sale' && tx.created_at >= OFFICE_SELL_CUTOFF) {
          dailyChanges[day].sales += amt;
          if (src === 'bank') { officeSellBank += amt; dailyChanges[day].bankChange += amt; }
          else { officeSellCash += amt; dailyChanges[day].cashChange += amt; }
        } else if (tx.type === 'deposit') {
          if (src === 'bank') { depositBank += amt; dailyChanges[day].bankChange += amt; }
          else { depositCash += amt; dailyChanges[day].cashChange += amt; }
        }
      }

      // Courier payment daily changes (bank/cash splits from courier settlements) — cutoff applied
      for (const cp of withMethodCounted) {
        const day = toLocalDate(cp.date || cp.created_at || '');
        ensureDay(day);
        dailyChanges[day].bankChange += Number(cp.bank_amount || 0);
        dailyChanges[day].cashChange += Number(cp.cash_amount || 0);
        dailyChanges[day].sales += Number(cp.receivable_amount || 0);
      }

      return { totalReceivable, totalBank, totalCash, totalExpenses, cashExpenses, bankExpenses, transferOutBank, transferOutCash, officeSellCash, officeSellBank, depositCash, depositBank, dailyChanges };

    },
  });

  // Sales history query (courier_payments + acc_transactions type='sale')
  const { data: salesHistory = [] } = useQuery({
    queryKey: ['sales-history'],
    queryFn: async () => {
      const { data: cpData, error: cpErr } = await supabase.from('courier_payments')
        .select('invoice_number, date, receivable_amount, receive_method, cash_amount, bank_amount')
        .not('receive_method', 'is', null)
        .order('date', { ascending: false });
      if (cpErr) throw cpErr;

      const courierRows = (cpData || []).map((r: any) => ({
        source: 'courier' as const,
        date: r.date,
        invoice_number: r.invoice_number,
        receive_method: r.receive_method,
        receivable_amount: Number(r.receivable_amount),
        cash_amount: Number(r.cash_amount || 0),
        bank_amount: Number(r.bank_amount || 0),
      }));

      // Also fetch acc_transactions where type='sale' (e.g. office sales)
      const saleTxs = await fetchAllRows<{ amount: number; description: string | null; created_at: string; created_by: string | null; source: string | null; reference_id: string | null }>(
        () => (supabase.from('acc_transactions' as any) as any)
          .select('amount, description, created_at, created_by, source, reference_id')
          .eq('type', 'sale')
          .order('created_at', { ascending: false })
      );

      // Collect unique reference_ids to lookup order numbers
      const refIds = saleTxs.map(t => t.reference_id).filter(Boolean) as string[];
      let orderNumMap: Record<string, string> = {};
      if (refIds.length > 0) {
        const { data: ordersData } = await supabase.from('orders').select('id, order_number').in('id', refIds);
        (ordersData || []).forEach((o: any) => { orderNumMap[o.id] = o.order_number; });
      }

      const saleRows = saleTxs.map(tx => {
        // Extract order number from description or lookup by reference_id
        const orderMatch = tx.description?.match(/#(SD-\d+)/);
        const orderNum = orderMatch ? `#${orderMatch[1]}` : (tx.reference_id && orderNumMap[tx.reference_id] ? `#${orderNumMap[tx.reference_id]}` : '');
        const invoiceLabel = tx.description || 'অফিস সেল';
        return {
          source: 'office' as const,
          date: tx.created_at,
          invoice_number: invoiceLabel,
          receive_method: tx.source === 'bank' ? 'Bank' : 'Office',
          receivable_amount: Number(tx.amount),
          cash_amount: tx.source === 'bank' ? 0 : Number(tx.amount),
          bank_amount: tx.source === 'bank' ? Number(tx.amount) : 0,
          order_number: orderNum,
        };
      });

      // Also fetch acc_transactions where type='deposit' from a sales_party/work_party
      // (money collected against a wholesale customer's or factory-unit work client's
      // receivable — the "জমা নিন" flow on their profile / dashboard পেমেন্ট dropdown).
      const { data: partyDeposits } = await (supabase.from('acc_transactions' as any) as any)
        .select('amount, description, created_at, source, acc_persons!inner(name, type)')
        .eq('type', 'deposit')
        .in('acc_persons.type', ['sales_party', 'work_party'])
        .order('created_at', { ascending: false });

      const partyRows = ((partyDeposits || []) as any[]).map((tx) => ({
        source: 'party' as const,
        date: tx.created_at,
        invoice_number: `জমা — ${tx.acc_persons?.name || ''}`,
        receive_method: tx.source === 'bank' ? 'Bank' : 'Cash',
        receivable_amount: Number(tx.amount),
        cash_amount: tx.source === 'bank' ? 0 : Number(tx.amount),
        bank_amount: tx.source === 'bank' ? Number(tx.amount) : 0,
      }));

      // Merge and sort by date descending
      return [...courierRows, ...saleRows, ...partyRows].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    },
  });

  // Withdrawal history query
  const { data: withdrawalHistory = [] } = useQuery({
    queryKey: ['withdrawal-history'],
    queryFn: async () => {
      const txs = await fetchAllRows<{ id: string; amount: number; description: string | null; source: string | null; created_at: string }>(
        () => (supabase.from('acc_transactions' as any) as any)
          .select('id, amount, description, source, created_at')
          .eq('type', 'courier_withdrawal')
          .order('created_at', { ascending: false })
      );
      return txs;
    },
  });

  const createTx = useCreateTransaction();
  const createLoanPayment = useCreateLoanPayment();
  const deleteTx = useDeleteTransaction();
  const updateTx = useUpdateTransaction();
  const [deleteTarget, setDeleteTarget] = useState<AccTransaction | null>(null);
  const [editTarget, setEditTarget] = useState<AccTransaction | null>(null);
  const [editForm, setEditForm] = useState({ account_id: '', person_id: '', unit_id: '', type: 'expense', amount: '', description: '', source: 'cash', expense_module: '', memo_number: '', shop_name: '', shop_phone: '', shop_address: '', bill_amount: '', date: toLocalDateStr(), items: [{ name: '', goj: '', rate: '' }] });

  const handleEditTx = async (tx: AccTransaction) => {
    const mod = tx.description?.match(/^\[(.+?)\]/)?.[1] || '';
    const src = accounts.find(a => a.id === tx.account_id)?.type || 'cash';
    let memoData: any = { memo_number: '', shop_name: '', shop_phone: '', shop_address: '', bill_amount: '', items: [{ name: '', goj: '', rate: '' }] };

    if (mod === 'কাপর' && tx.unit_id) {
      try {
        const { data } = await supabase
          .from('acc_unit_custom_expenses')
          .select('metadata')
          .eq('unit_id', tx.unit_id)
          .eq('module_name', 'কাপর')
          .order('created_at', { ascending: false })
          .limit(5);
        const match = (data || []).find((d: any) => {
          const ba = d.metadata?.bill_amount;
          return ba != null ? Number(ba) === tx.amount : false;
        }) || (data || []).find((d: any) => {
          const ct = d.metadata?.calculated_total;
          return ct != null ? Math.abs(Number(ct) - tx.amount) < 1 : false;
        }) || (data || [])[0];
        if (match?.metadata) {
          const m = match.metadata as any;
          memoData = {
            memo_number: m.memo_number || '',
            shop_name: m.shop_name || '',
            shop_phone: m.shop_phone || '',
            shop_address: m.shop_address || '',
            bill_amount: m.bill_amount != null ? String(m.bill_amount) : '',
            items: m.items?.length ? m.items.map((i: any) => ({ name: i.name || '', goj: i.goj != null ? String(i.goj) : '', rate: i.rate != null ? String(i.rate) : '' })) : [{ name: '', goj: '', rate: '' }],
          };
        }
      } catch (e) { /* fallback to empty */ }
    }

    setEditTarget(tx);
    setEditForm({
      account_id: tx.account_id,
      person_id: tx.person_id || '',
      unit_id: tx.unit_id || '',
      type: tx.type,
      amount: String(tx.amount),
      description: tx.description?.replace(/^\[.+?\]\s*/, '') || '',
      source: src,
      expense_module: mod,
      date: toLocalDateStr(tx.created_at),
      ...memoData,
    });
  };

  // Paginated all transactions (or full date-filtered fetch when filter active)
  const dateFilterKey = `${filterDateFrom ? filterDateFrom.toISOString().slice(0,10) : ''}_${filterDateTo ? filterDateTo.toISOString().slice(0,10) : ''}`;
  const dateFilterActive = !!(filterDateFrom || filterDateTo);
  const { data: allTransactions = [], isLoading: txLoading } = useQuery({
    queryKey: ['acc-transactions-paginated', dateFilterKey, selectedMonth, selectedYear, customFromStr, customToStr],
    queryFn: async () => {
      // Asia/Dhaka (+6) local day boundaries -> UTC ISO
      const toUtcStart = (d: Date) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), -6, 0, 0)).toISOString();
      const toUtcEnd = (d: Date) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 17, 59, 59, 999)).toISOString();

      if (dateFilterActive) {
        const data = await fetchAllRows<AccTransaction>(() => {
          let q: any = (supabase.from('acc_transactions' as any) as any)
            .select('*, acc_persons(name, type), acc_accounts(name, type), acc_units(name)')
            .order('created_at', { ascending: false });
          if (filterDateFrom) q = q.gte('created_at', toUtcStart(filterDateFrom));
          if (filterDateTo) q = q.lte('created_at', toUtcEnd(filterDateTo));
          return q;
        });
        return data as AccTransaction[];
      }

      // Custom range overrides month/year when both dates set; selectedMonth === -1 means সম্পূর্ণ বছর (whole year)
      const rangeStart = customActive ? customFrom! : (selectedMonth === -1 ? new Date(selectedYear, 0, 1) : new Date(selectedYear, selectedMonth, 1));
      const rangeEnd = customActive ? customTo! : (selectedMonth === -1 ? new Date(selectedYear, 11, 31) : new Date(selectedYear, selectedMonth + 1, 0));
      const data = await fetchAllRows<AccTransaction>(() =>
        (supabase.from('acc_transactions' as any) as any)
          .select('*, acc_persons(name, type), acc_accounts(name, type), acc_units(name)')
          .order('created_at', { ascending: false })
          .gte('created_at', toUtcStart(rangeStart))
          .lte('created_at', toUtcEnd(rangeEnd))
      );
      return data as AccTransaction[];
    },
  });

  // Lookup order numbers for sale transactions by reference_id
  const saleRefIds = useMemo(() => {
    return allTransactions.filter(t => t.type === 'sale' && (t as any).reference_id).map(t => (t as any).reference_id as string);
  }, [allTransactions]);

  const { data: txOrderNumMap = {} } = useQuery({
    queryKey: ['sale-order-num-lookup', saleRefIds],
    enabled: saleRefIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('orders').select('id, order_number').in('id', saleRefIds);
      const map: Record<string, string> = {};
      (data || []).forEach((o: any) => { map[o.id] = o.order_number; });
      return map;
    },
  });

  // All courier payments (settled)
  const { data: allCourierPayments = [] } = useQuery({
    queryKey: ['all-courier-payments-history'],
    queryFn: async () => {
      const data = await fetchAllRows<any>(
        () => supabase.from('courier_payments')
          .select('id, invoice_number, date, receivable_amount, receive_method, cash_amount, bank_amount, courier_provider')
          .not('receive_method', 'is', null)
          .order('date', { ascending: false })
      );
      return data;
    },
  });

  // Group transactions + courier payments by date
  const hasActiveFilters = !!(filterDateFrom || filterDateTo || (filterUnitId && filterUnitId !== 'all'));

  const groupedByDate = useMemo(() => {
    type MergedItem = { id: string; time: string; date: string; kind: 'tx' | 'sale'; tx?: AccTransaction; sale?: any };
    const items: MergedItem[] = [];

    const toLocalDate = (iso: string) => {
      const dt = new Date(iso);
      return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
    };

    // Date range filter helper
    const isInDateRange = (dateStr: string) => {
      if (!filterDateFrom && !filterDateTo) return true;
      const d = toLocalDate(dateStr);
      if (filterDateFrom) {
        const fromStr = `${filterDateFrom.getFullYear()}-${String(filterDateFrom.getMonth()+1).padStart(2,'0')}-${String(filterDateFrom.getDate()).padStart(2,'0')}`;
        if (d < fromStr) return false;
      }
      if (filterDateTo) {
        const toStr = `${filterDateTo.getFullYear()}-${String(filterDateTo.getMonth()+1).padStart(2,'0')}-${String(filterDateTo.getDate()).padStart(2,'0')}`;
        if (d > toStr) return false;
      }
      return true;
    };

    for (const tx of allTransactions) {
      if (!isInDateRange(tx.created_at)) continue;
      if (filterUnitId && filterUnitId !== 'all' && tx.unit_id !== filterUnitId) continue;
      const d = toLocalDate(tx.created_at);
      if (tx.type === 'sale') {
        const orderMatch = (tx.description || '').match(/#(SD-\d+)/);
        const refId = (tx as any).reference_id;
        const orderNum = orderMatch ? `#${orderMatch[1]}` : (refId && txOrderNumMap[refId] ? `#${txOrderNumMap[refId]}` : '');
        const label = tx.description || 'অফিস সেল';
        items.push({
          id: tx.id, time: tx.created_at, date: d, kind: 'sale',
          sale: {
            id: tx.id,
            date: tx.created_at,
            invoice_number: label,
            receive_method: (tx as any).source === 'bank' ? 'Bank' : 'Office',
            receivable_amount: Number(tx.amount),
            cash_amount: (tx as any).source === 'bank' ? 0 : Number(tx.amount),
            bank_amount: (tx as any).source === 'bank' ? Number(tx.amount) : 0,
            order_number: orderNum,
            _source_type: 'office_sell',
          },
        });
      } else {
        items.push({ id: tx.id, time: tx.created_at, date: d, kind: 'tx', tx });
      }
    }

    for (const sale of allCourierPayments) {
      const saleDate = sale.date || sale.created_at || '';
      if (!isInDateRange(saleDate)) continue;
      // Courier payments don't have unit_id, skip unit filter for them
      const d = toLocalDate(saleDate);
      items.push({ id: `sale-${sale.id}`, time: sale.date, date: d, kind: 'sale', sale: { ...sale, _source_type: 'courier' } });
    }

    // Group by date
    const groups = new Map<string, { items: MergedItem[]; sales: number; withdrawals: number; expenses: number }>();
    for (const item of items) {
      if (!groups.has(item.date)) groups.set(item.date, { items: [], sales: 0, withdrawals: 0, expenses: 0 });
      const g = groups.get(item.date)!;
      g.items.push(item);
      if (item.kind === 'sale') {
        g.sales += Number(item.sale?.receivable_amount || 0);
      } else if (item.tx) {
        if (item.tx.type === 'courier_withdrawal') g.withdrawals += Number(item.tx.amount);
        else if (DEBIT_TYPES.includes(item.tx.type)) g.expenses += Number(item.tx.amount);
      }
    }

    // Sort dates descending
    const sorted = [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));

    // Sort items within each group by time descending
    for (const [, g] of sorted) {
      g.items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    }

    // Apply selected month/year filter on top of existing date/unit filters — but only when
    // neither তারিখ nor কাস্টম range is active, since those already scope the data precisely
    // and shouldn't be silently overridden by whatever month happens to be selected.
    if (dateFilterActive || customActive) return sorted;
    const mPrefix = selectedMonth === -1 ? `${selectedYear}` : `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
    return sorted.filter(([date]) => date.startsWith(mPrefix));
  }, [allTransactions, allCourierPayments, filterDateFrom, filterDateTo, filterUnitId, selectedMonth, selectedYear, dateFilterActive, customActive]);

  const hasNextPage = false;

  const [txOpen, setTxOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [salesPartyPayOpen, setSalesPartyPayOpen] = useState(false);
  const [salesOpen, setSalesOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const qcSync = useQueryClient();

  const runSaleBackfill = async (showToast: boolean) => {
    setSyncing(true);
    try {
      const res = await backfillPaidOrderSaleEntries();
      if (res.created > 0) {
        qcSync.invalidateQueries({ queryKey: ['sales-history'] });
        qcSync.invalidateQueries({ queryKey: ['acc-transactions'] });
        qcSync.invalidateQueries({ queryKey: ['acc-transactions-paginated'] });
        qcSync.invalidateQueries({ queryKey: ['acc-accounts'] });
        qcSync.invalidateQueries({ queryKey: ['acc-transaction-summary'] });
        qcSync.invalidateQueries({ queryKey: ['accounting-financials'] });
      }
      if (showToast) {
        toast.success(res.created > 0 ? `${res.created} টি পেমেন্ট সিঙ্ক হয়েছে` : 'সব এন্ট্রি আপ-টু-ডেট আছে');
      }
    } catch (e: any) {
      if (showToast) toast.error('সিঙ্ক ব্যর্থ: ' + (e?.message || 'Unknown'));
    } finally {
      setSyncing(false);
    }
  };

  // One-time auto backfill per session
  useEffect(() => {
    const KEY = 'sale-entry-backfill-v1';
    if (sessionStorage.getItem(KEY)) return;
    sessionStorage.setItem(KEY, '1');
    const t = setTimeout(() => { runSaleBackfill(false); }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [withdrawForm, setWithdrawForm] = useState({ amount: '', description: '', from: 'bank', to: 'cash', date: toLocalDateStr() });
  const [txForm, setTxForm] = useState({ account_id: '', person_id: '', unit_id: '', loan_id: '', type: 'expense', amount: '', description: '', source: 'cash', expense_module: '', memo_number: '', shop_name: '', shop_phone: '', shop_address: '', bill_amount: '', date: toLocalDateStr(), items: [{ name: '', goj: '', rate: '' }] });

  const cashAccount = accounts.find(a => a.type === 'cash');
  const bankAccount = accounts.find(a => a.type === 'bank');

  const salesValue = financials?.totalReceivable || 0;
  const bankValue = (financials?.totalBank || 0) - (financials?.bankExpenses || 0) - (financials?.transferOutBank || 0) + (financials?.transferOutCash || 0) + (financials?.officeSellBank || 0) + (financials?.depositBank || 0) + bizOpeningBank;
  const cashValue = (financials?.totalCash || 0) - (financials?.cashExpenses || 0) - (financials?.transferOutCash || 0) + (financials?.transferOutBank || 0) + (financials?.officeSellCash || 0) + (financials?.depositCash || 0) + bizOpeningCash;

  // Compute daily ending balances by working backward from current totals
  const dailyBalances = useMemo(() => {
    const changes = financials?.dailyChanges;
    if (!changes) return {} as Record<string, { bank: number; cash: number }>;

    // Sort all dates descending
    const allDates = Object.keys(changes).sort((a, b) => b.localeCompare(a));
    const result: Record<string, { bank: number; cash: number }> = {};
    let runningBank = bankValue;
    let runningCash = cashValue;

    for (const date of allDates) {
      result[date] = { bank: runningBank, cash: runningCash };
      // Subtract this day's changes to get previous day's ending balance
      runningBank -= changes[date].bankChange;
      runningCash -= changes[date].cashChange;
    }
    return result;
  }, [financials?.dailyChanges, bankValue, cashValue]);

  // Month-filtered aggregate (sales, expenses, withdrawals, ending bank/cash balance)
  // selectedMonth === -1 means সম্পূর্ণ বছর (whole year) — monthPrefix becomes just the year,
  // which still works with startsWith() below for day-level matching.
  const monthPrefix = selectedMonth === -1 ? `${selectedYear}` : `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
  const isCurrentMonth = selectedMonth === -1 ? selectedYear === _today.getFullYear() : (selectedMonth === _today.getMonth() && selectedYear === _today.getFullYear());
  const todayStr = toLocalDateStr(_today);
  const monthAggregate = useMemo(() => {
    const changes = financials?.dailyChanges || {};
    let mSales = 0, mExpenses = 0, mWithdrawals = 0;
    let cumBank = bizOpeningBank, cumCash = bizOpeningCash;
    const rangeEnd = customActive ? customToStr : (selectedMonth === -1 ? `${selectedYear}-12-31` : `${monthPrefix}-31`);
    const rangeStart = customActive ? customFromStr : (selectedMonth === -1 ? `${selectedYear}-01-01` : `${monthPrefix}-01`);
    for (const d of Object.keys(changes)) {
      const c = changes[d];
      if (d <= rangeEnd) { cumBank += c.bankChange; cumCash += c.cashChange; }
      const inRange = customActive
        ? (d >= rangeStart && d <= rangeEnd)
        : d.startsWith(monthPrefix);
      if (inRange) {
        mSales += c.sales || 0;
        mExpenses += c.expenses || 0;
        mWithdrawals += c.withdrawals || 0;
      }
    }
    // Live override only when looking at "now" (current month, no custom range, or custom range ending today)
    const liveEligible = customActive ? customToStr >= todayStr : isCurrentMonth;
    if (liveEligible) { cumBank = bankValue; cumCash = cashValue; }
    return { sales: mSales, expenses: mExpenses, withdrawals: mWithdrawals, bank: cumBank, cash: cumCash };
  }, [financials?.dailyChanges, monthPrefix, isCurrentMonth, bankValue, cashValue, bizOpeningBank, bizOpeningCash, customActive, customFromStr, customToStr, todayStr]);


  const handleWithdraw = async () => {
    if (!withdrawForm.amount || Number(withdrawForm.amount) <= 0) {
      toast.error('পরিমাণ দিন'); return;
    }
    const targetAccount = withdrawForm.from === 'bank' ? bankAccount : cashAccount;
    if (!targetAccount) {
      toast.error('কোনো একাউন্ট পাওয়া যায়নি'); return;
    }
    try {
      await createTx.mutateAsync({
        account_id: targetAccount.id,
        type: 'courier_withdrawal',
        amount: Number(withdrawForm.amount),
        description: withdrawForm.description || `${withdrawForm.from === 'bank' ? 'ব্যাংক' : 'ক্যাশ'} → ${withdrawForm.to === 'cash' ? 'ক্যাশ' : 'ব্যাংক'} ট্রান্সফার`,
        source: withdrawForm.from,
        created_at: dateStrToIso(withdrawForm.date),
      });
      toast.success('উত্তোলন সফল');
      setWithdrawOpen(false);
      setWithdrawForm({ amount: '', description: '', from: 'bank', to: 'cash', date: toLocalDateStr() });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleTxSubmit = async () => {
    const targetAccount = txForm.source === 'bank' ? bankAccount : cashAccount;
    if (!targetAccount) {
      toast.error('একাউন্ট পাওয়া যায়নি'); return;
    }
    const builtInMods = ['ম্যাটেরিয়াল ক্রয়', 'নিয়মিত খরচ', 'ভাড়া'];
    const isCustomMod = txForm.expense_module && !builtInMods.includes(txForm.expense_module);
    const isKapor = txForm.expense_module === 'কাপর';
    const itemsTotal = isKapor ? txForm.items.reduce((s: number, it: any) => s + ((Number(it.goj) || 0) * (Number(it.rate) || 0)), 0) : 0;
    if (isKapor) {
      const billAmt = Number(txForm.bill_amount);
      if (!billAmt && !itemsTotal) { toast.error('আইটেমে দাম দিন'); return; }
    } else if (!isCustomMod && (!txForm.amount || Number(txForm.amount) <= 0)) {
      toast.error('পরিমাণ দিন'); return;
    } else if (isCustomMod && (!txForm.amount || Number(txForm.amount) <= 0)) {
      toast.error('পরিমাণ দিন'); return;
    }
    if (!txForm.source) {
      toast.error('সোর্স নির্বাচন করুন'); return;
    }
    try {
      const builtIn = ['ম্যাটেরিয়াল ক্রয়', 'নিয়মিত খরচ', 'ভাড়া'];
      const isCustomModule = txForm.expense_module && !builtIn.includes(txForm.expense_module);
      const isKaporModule = txForm.expense_module === 'কাপর';
      const isRentModule = txForm.expense_module === 'ভাড়া';
      // For kapor module: use bill_amount if set, else computed total from items
      const kaporCalculated = txForm.items.reduce((s: number, it: any) => s + ((Number(it.goj) || 0) * (Number(it.rate) || 0)), 0);
      const computedAmount = isKaporModule
        ? (Number(txForm.bill_amount) || kaporCalculated)
        : Number(txForm.amount);

      // রেন্ট has its own self-contained write path (waterfall-allocates against the
      // oldest unpaid month, writes its own linked transaction) — it must NOT also go
      // through the generic createTx call below, or the payment would be double-debited.
      if (isRentModule) {
        if (!txForm.unit_id) { toast.error('ইউনিট নির্বাচন করুন'); return; }
        const result = await allocatePaymentToRentRecords(txForm.unit_id, computedAmount, {
          account_id: targetAccount.id,
          payment_date: txForm.date,
          note: txForm.description || undefined,
        });
        toast.success(`ভাড়া পরিশোধ হয়েছে — ${result.appliedTo.join(', ')}`);
        setTxOpen(false);
        setTxForm({ account_id: '', person_id: '', unit_id: '', loan_id: '', type: 'expense', amount: '', description: '', source: 'cash', expense_module: '', memo_number: '', shop_name: '', shop_phone: '', shop_address: '', items: [{ name: '', goj: '', rate: '' }], bill_amount: '', date: toLocalDateStr() });
        qcSync.invalidateQueries({ queryKey: ['acc-unit-rent-records', txForm.unit_id] });
        qcSync.invalidateQueries({ queryKey: ['acc-unit-rent-payments', txForm.unit_id] });
        qcSync.invalidateQueries({ queryKey: ['acc-units'] });
        return;
      }

      // ঋণ পরিশোধ also has its own self-contained write path (creates an
      // acc_loan_payments row + linked transaction, auto-completes the loan when
      // fully paid) — must NOT also go through the generic createTx call below.
      if (txForm.expense_module === 'ঋণ পরিশোধ') {
        if (!txForm.loan_id) { toast.error('ঋণ নির্বাচন করুন'); return; }
        await createLoanPayment.mutateAsync({
          loan_id: txForm.loan_id,
          amount: computedAmount,
          payment_date: txForm.date || toLocalDateStr(),
          payment_source: txForm.source,
          account_id: targetAccount.id,
          note: txForm.description || undefined,
        });
        toast.success('ঋণ পরিশোধ হয়েছে');
        setTxOpen(false);
        setTxForm({ account_id: '', person_id: '', unit_id: '', loan_id: '', type: 'expense', amount: '', description: '', source: 'cash', expense_module: '', memo_number: '', shop_name: '', shop_phone: '', shop_address: '', items: [{ name: '', goj: '', rate: '' }], bill_amount: '', date: toLocalDateStr() });
        return;
      }

      const descParts: string[] = [];
      if (txForm.expense_module) descParts.push(`[${txForm.expense_module}]`);
      if (txForm.description) descParts.push(txForm.description);
      await createTx.mutateAsync({
        account_id: targetAccount.id,
        person_id: txForm.person_id || undefined,
        unit_id: txForm.unit_id || undefined,
        type: 'expense',
        amount: computedAmount,
        description: descParts.join(' ') || undefined,
        source: txForm.source,
        created_at: dateStrToIso(txForm.date),
        person_name: persons.find((p: any) => p.id === txForm.person_id)?.name,
        unit_name: units.find((u: any) => u.id === txForm.unit_id)?.name,
      });
      // Dual-write: also insert into acc_unit_custom_expenses if module selected
      if (txForm.expense_module && txForm.unit_id) {
        if (isKaporModule) {
          const itemNames = txForm.items.filter((it: any) => it.name).map((it: any) => it.name).join(', ');
          const totalGoj = txForm.items.reduce((s: number, it: any) => s + (Number(it.goj) || 0), 0);
          const metadata: any = {
            memo_number: txForm.memo_number || '',
            shop_name: txForm.shop_name || '',
            shop_phone: txForm.shop_phone || '',
            shop_address: txForm.shop_address || '',
            items: txForm.items.filter((it: any) => it.name || it.goj || it.rate).map((it: any) => ({ name: it.name, goj: it.goj, rate: it.rate, amount: String((Number(it.goj) || 0) * (Number(it.rate) || 0)) })),
            total_goj: String(totalGoj),
            total_items: String(txForm.items.length),
            calculated_total: kaporCalculated,
            bill_amount: computedAmount,
          };
          await supabase.from('acc_unit_custom_expenses' as any).insert({
            unit_id: txForm.unit_id,
            module_name: txForm.expense_module,
            item_name: itemNames || txForm.expense_module,
            amount: computedAmount,
            date: txForm.date || toLocalDateStr(),
            description: txForm.description || '',
            metadata,
          } as any);
        } else if (txForm.expense_module === 'ম্যাটেরিয়াল ক্রয়') {
          await supabase.from('acc_unit_materials' as any).insert({
            unit_id: txForm.unit_id,
            item_name: txForm.description || 'ম্যাটেরিয়াল',
            quantity: 1,
            unit_price: computedAmount,
            total: computedAmount,
            date: txForm.date || toLocalDateStr(),
            description: txForm.description || null,
          } as any);
          qcSync.invalidateQueries({ queryKey: ['acc-unit-materials', txForm.unit_id] });
        } else if (txForm.expense_module === 'নিয়মিত খরচ') {
          const d = txForm.date ? new Date(txForm.date + 'T00:00:00') : new Date();
          await supabase.from('acc_unit_fixed_expenses' as any).insert({
            unit_id: txForm.unit_id,
            category: txForm.description || 'নিয়মিত খরচ',
            amount: computedAmount,
            month: d.getMonth() + 1,
            year: d.getFullYear(),
            description: txForm.description || null,
          } as any);
          qcSync.invalidateQueries({ queryKey: ['acc-unit-fixed-expenses', txForm.unit_id] });
        } else if (isCustomModule) {
          await supabase.from('acc_unit_custom_expenses' as any).insert({
            unit_id: txForm.unit_id,
            module_name: txForm.expense_module,
            item_name: txForm.description || txForm.expense_module,
            amount: computedAmount,
            date: txForm.date || toLocalDateStr(),
            description: txForm.description || '',
          } as any);
        }

      }
      toast.success('খরচ সেভ হয়েছে');
      setTxOpen(false);
      setTxForm({ account_id: '', person_id: '', unit_id: '', loan_id: '', type: 'expense', amount: '', description: '', source: 'cash', expense_module: '', memo_number: '', shop_name: '', shop_phone: '', shop_address: '', items: [{ name: '', goj: '', rate: '' }], bill_amount: '', date: toLocalDateStr() });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (accLoading) return <div className="flex items-center justify-center py-10 text-muted-foreground">লোড হচ্ছে...</div>;

  const summaryCards = [
    { label: 'বিক্রি', value: monthAggregate.sales, color: 'text-green-700 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950/30', icon: null, clickable: true },
    { label: 'ব্যালেন্স', value: monthAggregate.bank + monthAggregate.cash, color: 'text-foreground', bg: 'bg-muted/30', icon: null, clickable: false },
    { label: 'খরচ', value: monthAggregate.expenses, color: 'text-destructive', bg: 'bg-red-50 dark:bg-red-950/30', icon: null, clickable: false },
    { label: 'ব্যাংক', value: monthAggregate.bank, color: 'text-indigo-700 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/30', icon: <Landmark className="h-4 w-4" />, clickable: false },
    { label: 'ক্যাশ', value: monthAggregate.cash, color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30', icon: <Banknote className="h-4 w-4" />, clickable: false },
  ];


  return (
    <div className="space-y-4">
      {/* Fixed Top Bar */}
      <div className="sticky top-0 md:top-0 -mt-4 -mx-4 md:-mt-6 md:-mx-6 px-4 md:px-6 pt-4 md:pt-6 pb-3 bg-background/95 backdrop-blur-sm z-20 border-b border-border">
        {units.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {units.map(u => (
              <Link key={u.id} to={`/admin/accounting/units/${u.id}`}>
                <Button variant="outline" size="sm" className="whitespace-nowrap text-xs h-7">
                  <Building2 className="h-3 w-3 mr-1" />{u.name}
                </Button>
              </Link>
            ))}
            <Link to="/admin/accounting/settings">
              <Button variant="ghost" size="sm" className="whitespace-nowrap text-xs h-7">
                <Plus className="h-3 w-3" />
              </Button>
            </Link>
            <Link to="/admin/accounting/activity-log">
              <Button variant="outline" size="sm" className="whitespace-nowrap text-xs h-7">
                📜 লগ
              </Button>
            </Link>
          </div>
        )}
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">হিসাব ড্যাশবোর্ড</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setWithdrawOpen(true)}>💸 উত্তোলন</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">💳 পেমেন্ট</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate('/admin/courier')}>🚚 কুরিয়ার পেমেন্ট</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSalesPartyPayOpen(true)}>💰 বিক্রি/কাজ পার্টি থেকে জমা</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <SalesPartyPaymentDialog open={salesPartyPayOpen} onOpenChange={setSalesPartyPayOpen} />
          <Dialog open={txOpen} onOpenChange={setTxOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> খরচ</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>নতুন খরচ</DialogTitle></DialogHeader>
              <TransactionForm
                txForm={txForm}
                setTxForm={setTxForm}
                accounts={accounts}
                units={units}
                persons={persons}
                onSubmit={handleTxSubmit}
                isPending={createTx.isPending}
              />
            </DialogContent>
          </Dialog>
        </div>
        </div>
      </div>

      {/* 6-Stat Summary */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {summaryCards.map((card, i) => (
          <Card
            key={i}
            className={`${card.bg} ${card.clickable ? 'cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all' : ''}`}
            onClick={card.clickable ? () => setSalesOpen(true) : undefined}
          >
            <CardContent className="px-3 py-3">
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground uppercase tracking-wide">
                {card.icon}
                {card.label}
              </div>
              <div className={`text-lg font-bold ${card.color}`}>৳{card.value.toLocaleString()}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Month Activity (was: Today's Activity) */}
      <Card className="border-l-4 border-l-primary bg-primary/5">
        <CardContent className="px-4 py-3">
          <div className="text-sm font-bold text-foreground mb-2">
            📊 {customActive
              ? `${format(customFrom!, 'dd MMM')} - ${format(customTo!, 'dd MMM yyyy')} — কার্যক্রম`
              : selectedMonth === -1
                ? `সম্পূর্ণ ${selectedYear} — কার্যক্রম`
                : (isCurrentMonth ? 'চলতি মাসের কার্যক্রম' : `${BANGLA_MONTHS[selectedMonth]} ${selectedYear} — কার্যক্রম`)}
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/30 px-3 py-1 text-base font-bold text-green-700 dark:text-green-400">বিক্রি: ৳{monthAggregate.sales.toLocaleString()}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-900/30 px-3 py-1 text-base font-bold text-blue-700 dark:text-blue-400">উত্তোলন: ৳{monthAggregate.withdrawals.toLocaleString()}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-3 py-1 text-base font-bold text-destructive">খরচ: ৳{monthAggregate.expenses.toLocaleString()}</span>
          </div>
        </CardContent>
      </Card>

      {/* Quick Links + Month/Year filter */}
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/admin/accounting/settings"><Button variant="outline" size="sm">👥 ব্যক্তি তালিকা</Button></Link>
        <Link to="/admin/accounting/attendance"><Button variant="outline" size="sm">📋 উপস্থিতি</Button></Link>
        <Link to="/admin/accounting/salary"><Button variant="outline" size="sm">💰 বেতন</Button></Link>
        <div className="ml-auto flex items-center gap-2">
          <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))} disabled={customActive}>
            <SelectTrigger className={cn("h-8 w-[130px] text-xs", customActive && "opacity-50")}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="-1">সম্পূর্ণ বছর</SelectItem>
              {BANGLA_MONTHS.map((m, i) => {
                const disabled = selectedYear === _today.getFullYear() && i > _today.getMonth();
                return <SelectItem key={i} value={String(i)} disabled={disabled}>{m}</SelectItem>;
              })}
            </SelectContent>
          </Select>
          <Select value={String(selectedYear)} disabled={customActive} onValueChange={(v) => {
            const y = Number(v);
            setSelectedYear(y);
            if (y === _today.getFullYear() && selectedMonth > _today.getMonth()) setSelectedMonth(_today.getMonth());
          }}>
            <SelectTrigger className={cn("h-8 w-[90px] text-xs", customActive && "opacity-50")}><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: _today.getFullYear() - 2024 + 1 }, (_, i) => 2024 + i).map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn("h-8 text-xs gap-1", customActive && "border-primary text-primary")}
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                {customActive
                  ? `${format(customFrom!, 'dd MMM')} - ${format(customTo!, 'dd MMM')}`
                  : 'কাস্টম'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3 space-y-3" align="end">
              <div className="flex flex-col sm:flex-row gap-3">
                <div>
                  <Label className="text-xs font-medium mb-1 block">শুরু</Label>
                  <Calendar
                    mode="single"
                    selected={customFrom}
                    onSelect={setCustomFrom}
                    className={cn("p-3 pointer-events-auto rounded-md border")}
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium mb-1 block">শেষ</Label>
                  <Calendar
                    mode="single"
                    selected={customTo}
                    onSelect={setCustomTo}
                    disabled={(d) => customFrom ? d < customFrom : false}
                    className={cn("p-3 pointer-events-auto rounded-md border")}
                  />
                </div>
              </div>
              <div className="flex justify-between items-center pt-1 border-t">
                <span className="text-xs text-muted-foreground">
                  {customActive ? `${format(customFrom!, 'dd MMM yyyy')} → ${format(customTo!, 'dd MMM yyyy')}` : 'দুটি তারিখ নির্বাচন করুন'}
                </span>
                {customActive && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => { setCustomFrom(undefined); setCustomTo(undefined); }}
                  >
                    <X className="h-3 w-3" /> Clear
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>


      <Dialog open={salesOpen} onOpenChange={setSalesOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2">
              <span>বিক্রি ও উত্তোলন</span>
              <Button size="sm" variant="outline" disabled={syncing} onClick={() => runSaleBackfill(true)}>
                {syncing ? 'সিঙ্ক হচ্ছে...' : 'সিঙ্ক'}
              </Button>
            </DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="sales">
            <TabsList className="w-full">
              <TabsTrigger value="sales" className="flex-1">বিক্রি হিস্টোরি</TabsTrigger>
              <TabsTrigger value="withdrawals" className="flex-1">উত্তোলন হিস্টোরি</TabsTrigger>
            </TabsList>
            <TabsContent value="sales">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">তারিখ</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">ইনভয়েস</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">মেথড</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">প্রাপ্য</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">ক্যাশ</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">ব্যাংক</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {salesHistory.length === 0 && (
                      <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">কোনো ডেটা নেই</td></tr>
                    )}
                    {salesHistory.map((row: any, i: number) => (
                      <tr key={i} className="hover:bg-muted/30">
                        <td className="px-3 py-2 text-xs whitespace-nowrap">{format(new Date(row.date), 'dd/MM/yyyy')}</td>
                        <td className="px-3 py-2 text-xs">
                          {row.order_number && <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 mr-1">{row.order_number}</span>}
                          {row.invoice_number || '—'}
                        </td>
                        <td className="px-3 py-2 text-xs capitalize">{row.receive_method || '—'}</td>
                        <td className="px-3 py-2 text-xs text-right font-medium text-green-700 dark:text-green-400">৳{Number(row.receivable_amount).toLocaleString()}</td>
                        <td className="px-3 py-2 text-xs text-right">৳{Number(row.cash_amount || 0).toLocaleString()}</td>
                        <td className="px-3 py-2 text-xs text-right">৳{Number(row.bank_amount || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>
            <TabsContent value="withdrawals">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">তারিখ</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">সোর্স</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">পরিমাণ</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">বিবরণ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {withdrawalHistory.length === 0 && (
                      <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">কোনো উত্তোলন নেই</td></tr>
                    )}
                    {withdrawalHistory.map((row: any) => (
                      <tr key={row.id} className="hover:bg-muted/30">
                        <td className="px-3 py-2 text-xs whitespace-nowrap">{format(new Date(row.created_at), 'dd/MM/yyyy hh:mm a')}</td>
                        <td className="px-3 py-2 text-xs capitalize">{row.source === 'bank' ? 'ব্যাংক' : row.source === 'cash' ? 'ক্যাশ' : '—'}</td>
                        <td className="px-3 py-2 text-xs text-right font-medium text-blue-700 dark:text-blue-400">৳{Number(row.amount).toLocaleString()}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{row.description || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader><DialogTitle>উত্তোলন / ট্রান্সফার</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>কোথা থেকে</Label>
                <Select value={withdrawForm.from} onValueChange={v => setWithdrawForm(f => ({ ...f, from: v, to: v === 'bank' ? 'cash' : 'bank' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank">ব্যাংক</SelectItem>
                    <SelectItem value="cash">ক্যাশ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>কোথায়</Label>
                <Select value={withdrawForm.to} onValueChange={v => setWithdrawForm(f => ({ ...f, to: v, from: v === 'bank' ? 'cash' : 'bank' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">ক্যাশ</SelectItem>
                    <SelectItem value="bank">ব্যাংক</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>পরিমাণ (৳)</Label>
              <Input type="text" inputMode="numeric" value={withdrawForm.amount ? Number(withdrawForm.amount).toLocaleString() : ''} onChange={e => { const raw = e.target.value.replace(/,/g, ''); if (/^\d*$/.test(raw)) setWithdrawForm(f => ({ ...f, amount: raw })); }} placeholder="0" />
            </div>
            <div>
              <Label>📅 তারিখ</Label>
              <Input type="date" value={withdrawForm.date} onChange={e => setWithdrawForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <Label>বিবরণ (ঐচ্ছিক)</Label>
              <Textarea value={withdrawForm.description} onChange={e => setWithdrawForm(f => ({ ...f, description: e.target.value }))} placeholder="উত্তোলনের কারণ..." />
            </div>
            <Button onClick={handleWithdraw} disabled={createTx.isPending} className="w-full">
              {createTx.isPending ? 'প্রসেস হচ্ছে...' : 'উত্তোলন করুন'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Daily Transactions — Paginated History */}
      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-2.5 border-b border-border bg-muted/30">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wide">দৈনিক লেনদেন</h2>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Date Range Picker */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("h-8 text-xs gap-1.5", (filterDateFrom || filterDateTo) && "border-primary text-primary")}>
                      <CalendarIcon className="h-3.5 w-3.5" />
                      {filterDateFrom && filterDateTo
                        ? `${format(filterDateFrom, 'dd/MM')} - ${format(filterDateTo, 'dd/MM')}`
                        : filterDateFrom
                          ? `${format(filterDateFrom, 'dd/MM/yy')} থেকে`
                          : filterDateTo
                            ? `${format(filterDateTo, 'dd/MM/yy')} পর্যন্ত`
                            : 'তারিখ'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-3" align="end">
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1.5">শুরু</p>
                        <Calendar
                          mode="single"
                          selected={filterDateFrom}
                          onSelect={setFilterDateFrom}
                          className="p-0 pointer-events-auto"
                          disabled={(date) => filterDateTo ? date > filterDateTo : false}
                        />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1.5">শেষ</p>
                        <Calendar
                          mode="single"
                          selected={filterDateTo}
                          onSelect={setFilterDateTo}
                          className="p-0 pointer-events-auto"
                          disabled={(date) => filterDateFrom ? date < filterDateFrom : false}
                        />
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Unit Filter */}
                <Select value={filterUnitId} onValueChange={setFilterUnitId}>
                  <SelectTrigger className={cn("h-8 w-[120px] text-xs", filterUnitId !== 'all' && "border-primary text-primary")}>
                    <SelectValue placeholder="ইউনিট" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">সকল ইউনিট</SelectItem>
                    {units.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Reset */}
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { setFilterDateFrom(undefined); setFilterDateTo(undefined); setFilterUnitId('all'); }}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {txLoading ? (
            <div className="p-6 text-center text-muted-foreground">লোড হচ্ছে...</div>
          ) : groupedByDate.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">কোনো লেনদেন নেই</div>
          ) : (
            groupedByDate.map(([date, group]) => (
              <div key={date}>
                {/* Date Header + Summary */}
                <div className="px-4 py-2.5 border-b border-t border-border bg-gradient-to-r from-primary/10 to-muted/30 border-l-4 border-l-primary">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-sm font-bold text-foreground">📅 {date}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {group.sales > 0 && <span className="inline-flex rounded-full bg-green-100 dark:bg-green-900/30 px-2.5 py-0.5 text-xs font-bold text-green-700 dark:text-green-400">বিক্রি: ৳{group.sales.toLocaleString()}</span>}
                      {group.withdrawals > 0 && <span className="inline-flex rounded-full bg-blue-100 dark:bg-blue-900/30 px-2.5 py-0.5 text-xs font-bold text-blue-700 dark:text-blue-400">উত্তোলন: ৳{group.withdrawals.toLocaleString()}</span>}
                      {group.expenses > 0 && <span className="inline-flex rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-bold text-destructive">খরচ: ৳{group.expenses.toLocaleString()}</span>}
                      {dailyBalances[date] && (
                        <>
                          <span className="inline-flex rounded-full bg-indigo-100 dark:bg-indigo-900/30 px-2.5 py-0.5 text-xs font-bold text-indigo-700 dark:text-indigo-400">🏦 ব্যাংক: ৳{Math.round(dailyBalances[date].bank).toLocaleString()}</span>
                          <span className="inline-flex rounded-full bg-teal-100 dark:bg-teal-900/30 px-2.5 py-0.5 text-xs font-bold text-teal-700 dark:text-teal-400">💵 ক্যাশ: ৳{Math.round(dailyBalances[date].cash).toLocaleString()}</span>
                          <span className="inline-flex rounded-full bg-purple-100 dark:bg-purple-900/30 px-2.5 py-0.5 text-xs font-bold text-purple-700 dark:text-purple-400">📊 মোট: ৳{Math.round(dailyBalances[date].bank + dailyBalances[date].cash).toLocaleString()}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                {/* Desktop Table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm table-fixed">
                    <thead>
                      <tr className="border-b border-border bg-muted/10">
                        <th className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground text-left w-[80px]">সময়</th>
                        <th className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground text-left w-[80px]">ধরন</th>
                        <th className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground text-left w-[140px]">ট্যাগ</th>
                        <th className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground text-left w-[80px]">ইউনিট</th>
                        <th className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground text-left w-[60px]">সোর্স</th>
                        <th className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground text-left">নোট</th>
                        <th className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground text-right w-[110px]">পরিমাণ</th>
                        <th className="w-[60px]"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {group.items.map(item => {
                        if (item.kind === 'sale') {
                          const sale = item.sale;
                          return (
                            <tr key={item.id} className="hover:bg-muted/30">
                              <td className="px-3 py-2 text-xs whitespace-nowrap text-muted-foreground">{format(new Date(sale.date), 'hh:mm a')}</td>
                              <td className="px-3 py-2"><span className="inline-block text-[11px] font-medium px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">বিক্রি</span></td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-1">
                                  {sale.order_number && <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">{sale.order_number}</span>}
                                  {sale._source_type === 'office_sell' ? (
                                    <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">অফিস সেল</span>
                                  ) : sale.courier_provider ? (
                                    <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                                      sale.courier_provider === 'steadfast' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' :
                                      sale.courier_provider === 'pathao' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                      sale.courier_provider === 'redx' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
                                      'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                                    }`}>{sale.courier_provider.charAt(0).toUpperCase() + sale.courier_provider.slice(1)}</span>
                                  ) : null}
                                </div>
                              </td>
                              <td className="px-3 py-2"><span className="text-muted-foreground text-xs">—</span></td>
                              <td className="px-3 py-2">
                                <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded ${sale.receive_method === 'Bank' ? 'bg-blue-50 text-blue-600 border border-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800' : 'bg-amber-50 text-amber-600 border border-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800'}`}>
                                  {sale.receive_method === 'Bank' ? 'ব্যাংক' : 'ক্যাশ'}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-xs">{sale.invoice_number || '—'}</td>
                              <td className="px-3 py-2 text-xs text-right font-bold text-green-600 dark:text-green-400 tabular-nums">+৳{Number(sale.receivable_amount).toLocaleString()}</td>
                              <td></td>
                            </tr>
                          );
                        }
                        const tx = item.tx!;
                        const typeColor = isDebit(tx.type) ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
                        const canDelete = isDebit(tx.type) || tx.type === 'courier_withdrawal';
                        const desc = tx.description || '';
                        const moduleMatch = desc.match(/^\[(.+?)\]\s*/);
                        const moduleTag = moduleMatch ? moduleMatch[1] : null;
                        const cleanDesc = moduleMatch ? desc.replace(moduleMatch[0], '').trim() : desc;
                        const personName = tx.acc_persons?.name;
                        const personType = tx.acc_persons?.type;
                        const personBadgeColor = personType === 'employee'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          : personType === 'party'
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                            : 'bg-muted text-muted-foreground';
                        return (
                          <tr key={item.id} className="hover:bg-muted/30">
                            <td className="px-3 py-2 text-xs whitespace-nowrap text-muted-foreground">{format(new Date(tx.created_at), 'hh:mm a')}</td>
                            <td className="px-3 py-2"><span className={`inline-block text-[11px] font-medium px-1.5 py-0.5 rounded ${typeColor}`}>{txTypeLabel[tx.type] || tx.type}</span></td>
                            <td className="px-3 py-2">
                              <div className="flex flex-wrap items-center gap-1">
                                {personName && <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full ${personBadgeColor}`}>{personName}</span>}
                                {moduleTag && <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">{moduleTag}</span>}
                                {!personName && !moduleTag && <span className="text-muted-foreground text-xs">—</span>}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              {tx.acc_units?.name ? (
                                <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">{tx.acc_units.name}</span>
                              ) : <span className="text-muted-foreground text-xs">—</span>}
                            </td>
                            <td className="px-3 py-2">
                              {tx.acc_accounts?.type && (
                                <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full ${tx.acc_accounts.type === 'bank' ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-300'}`}>
                                  {tx.acc_accounts.type === 'bank' ? 'ব্যাংক' : 'ক্যাশ'}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-xs break-words whitespace-normal">
                              <div className="space-y-0.5">
                                {cleanDesc && <div className="text-foreground">{cleanDesc}</div>}
                                {!cleanDesc && !personName && <span className="text-muted-foreground">—</span>}
                                {tx.created_by && staffMap[tx.created_by] && (
                                  <div className="text-[10px] text-muted-foreground">by: {staffMap[tx.created_by]}</div>
                                )}
                              </div>
                            </td>
                            <td className={`px-3 py-2 text-xs text-right font-bold tabular-nums ${isDebit(tx.type) ? 'text-destructive' : 'text-green-600 dark:text-green-400'}`}>
                              {isDebit(tx.type) ? '-' : '+'}৳{tx.amount.toLocaleString()}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {canDelete && (
                                <span className="inline-flex items-center gap-0.5">
                                  <button onClick={() => handleEditTx(tx)} className="p-0.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors">
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                  <button onClick={() => setDeleteTarget(tx)} className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card List */}
                <div className="sm:hidden divide-y divide-border/50">
                  {group.items.map(item => {
                    if (item.kind === 'sale') {
                      const sale = item.sale;
                      return (
                        <div key={item.id} className="px-3 py-2.5 space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="inline-block text-[11px] font-medium px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">বিক্রি</span>
                              {sale.order_number && <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">{sale.order_number}</span>}
                              {sale._source_type === 'office_sell' ? (
                                <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">অফিস সেল</span>
                              ) : sale.courier_provider ? (
                                <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                                  sale.courier_provider === 'steadfast' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' :
                                  sale.courier_provider === 'pathao' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                  sale.courier_provider === 'redx' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
                                  'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                                }`}>{sale.courier_provider.charAt(0).toUpperCase() + sale.courier_provider.slice(1)}</span>
                              ) : null}
                            </div>
                            <span className="text-[11px] text-muted-foreground">{format(new Date(sale.date), 'hh:mm a')}</span>
                          </div>
                          <div className="text-xs text-foreground">{sale.invoice_number || '—'}</div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-bold text-green-600 dark:text-green-400 tabular-nums">+৳{Number(sale.receivable_amount).toLocaleString()}</span>
                              <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded ${sale.receive_method === 'Bank' ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-300'}`}>
                                {sale.receive_method === 'Bank' ? 'ব্যাংক' : 'ক্যাশ'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    const tx = item.tx!;
                    const typeColor = isDebit(tx.type) ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
                    const canDelete = isDebit(tx.type) || tx.type === 'courier_withdrawal';
                    const moduleMatch = (tx.description || '').match(/^\[(.+?)\]\s*/);
                    const moduleTag = moduleMatch ? moduleMatch[1] : null;
                    const cleanDesc = moduleMatch ? (tx.description || '').replace(/^\[.+?\]\s*/, '') : (tx.description || '');
                    const personName = tx.acc_persons?.name || null;
                    const personType = tx.acc_persons?.type || '';
                    const personBadgeColor = personType === 'employee'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      : personType === 'party'
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                        : 'bg-muted text-muted-foreground';
                    return (
                      <div key={item.id} className="px-3 py-2.5 space-y-1.5">
                        {/* Row 1: Type badge + Module badge + Person badge + Time/Actions */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`inline-block text-[11px] font-medium px-1.5 py-0.5 rounded ${typeColor}`}>{txTypeLabel[tx.type] || tx.type}</span>
                            {moduleTag && (
                              <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded bg-accent text-accent-foreground">{moduleTag}</span>
                            )}
                            {personName && (
                              <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded ${personBadgeColor}`}>{personName}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] text-muted-foreground">{format(new Date(tx.created_at), 'hh:mm a')}</span>
                            {canDelete && (
                              <>
                                <button onClick={() => handleEditTx(tx)} className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors">
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button onClick={() => setDeleteTarget(tx)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        {/* Row 2: Clean description only */}
                        {cleanDesc && <div className="text-xs font-medium text-foreground">{cleanDesc}</div>}
                        {/* Row 3: Amount left + Editor right */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-sm font-bold tabular-nums ${isDebit(tx.type) ? 'text-destructive' : 'text-green-600 dark:text-green-400'}`}>
                              {isDebit(tx.type) ? '-' : '+'}৳{tx.amount.toLocaleString()}
                            </span>
                            {tx.acc_units?.name && (
                              <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">{tx.acc_units.name}</span>
                            )}
                            {tx.acc_accounts?.type && (
                              <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded ${tx.acc_accounts.type === 'bank' ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-300'}`}>
                                {tx.acc_accounts.type === 'bank' ? 'ব্যাংক' : 'ক্যাশ'}
                              </span>
                            )}
                          </div>
                          {tx.created_by && staffMap[tx.created_by] && (
                            <span className="text-[10px] text-muted-foreground italic">by: {staffMap[tx.created_by]}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}

          {/* Pagination — hidden when filters active */}
          {!hasActiveFilters && (
            <div className="px-4 py-3 border-t border-border flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                disabled={historyPage === 0}
                onClick={() => setHistoryPage(p => Math.max(0, p - 1))}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> আগে
              </Button>
              <span className="text-xs text-muted-foreground">পেজ {historyPage + 1}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasNextPage}
                onClick={() => setHistoryPage(p => p + 1)}
              >
                পরে <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>লেনদেন মুছে ফেলবেন?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <>৳{deleteTarget.amount.toLocaleString()} — {txTypeLabel[deleteTarget.type] || deleteTarget.type} {deleteTarget.description ? `(${deleteTarget.description})` : ''}<br />এই লেনদেন মুছে ফেললে ব্যালেন্স আপডেট হবে।</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>বাতিল</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteTarget) return;
                try {
                  await deleteTx.mutateAsync({
                    id: deleteTarget.id,
                    account_id: deleteTarget.account_id,
                    type: deleteTarget.type,
                    amount: deleteTarget.amount,
                    description: deleteTarget.description,
                    person_id: deleteTarget.person_id,
                    unit_id: deleteTarget.unit_id,
                    source: (deleteTarget as any).source,
                    person_name: deleteTarget.acc_persons?.name,
                    unit_name: deleteTarget.acc_units?.name,
                  });
                  toast.success('লেনদেন মুছে ফেলা হয়েছে');
                  setDeleteTarget(null);
                } catch (e: any) {
                  toast.error(e.message);
                }
              }}
            >
              {deleteTx.isPending ? 'মুছছে...' : 'মুছে ফেলুন'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      <Dialog open={!!editTarget} onOpenChange={open => { if (!open) setEditTarget(null); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>লেনদেন সংশোধন</DialogTitle></DialogHeader>
          <TransactionForm
            txForm={editForm}
            setTxForm={setEditForm}
            accounts={accounts}
            units={units?.filter(u => u.is_active) || []}
            persons={persons?.filter(p => p.is_active) || []}
            isPending={updateTx.isPending}
            isEditMode
            onSubmit={async () => {
              if (!editTarget || !editForm.amount) return;
              try {
                const descParts: string[] = [];
                if (editForm.expense_module) descParts.push(`[${editForm.expense_module}]`);
                if (editForm.description) descParts.push(editForm.description);
                const targetAccount = accounts.find(a => a.type === editForm.source);
                if (!targetAccount) {
                  toast.error('নির্বাচিত সোর্স অ্যাকাউন্ট পাওয়া যায়নি');
                  return;
                }
                const oldUnit = units?.find(u => u.id === editTarget.unit_id);
                const newUnit = units?.find(u => u.id === editForm.unit_id);
                const oldPerson = persons?.find(p => p.id === editTarget.person_id);
                const newPerson = persons?.find(p => p.id === editForm.person_id);
                const oldAccType = accounts.find(a => a.id === editTarget.account_id)?.type || 'cash';
                await updateTx.mutateAsync({
                  id: editTarget.id,
                  account_id: editTarget.account_id,
                  type: editTarget.type,
                  oldAmount: editTarget.amount,
                  newAmount: Number(editForm.amount),
                  newDescription: descParts.join(' '),
                  newAccountId: targetAccount.id,
                  newUnitId: editForm.unit_id || null,
                  newPersonId: editForm.person_id || null,
                  oldDescription: editTarget.description || '',
                  oldUnitId: editTarget.unit_id || null,
                  oldPersonId: editTarget.person_id || null,
                  oldSource: oldAccType,
                  newSource: editForm.source,
                  oldUnitName: oldUnit?.name || '',
                  newUnitName: newUnit?.name || '',
                  oldPersonName: oldPerson?.name || '',
                  newPersonName: newPerson?.name || '',
                  newCreatedAt: dateStrToIso(editForm.date),
                });
                toast.success('সংশোধন সফল');
                setEditTarget(null);
              } catch (e: any) {
                toast.error(e.message);
              }
            }}
            submitLabel="সংশোধন করুন"
            pendingLabel="সেভ হচ্ছে..."
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* Extracted Expense Form — Unit-wise */
function TransactionForm({ txForm, setTxForm, accounts, units, persons, onSubmit, isPending, submitLabel, pendingLabel, isEditMode }: {
  txForm: any; setTxForm: any; accounts: any[]; units: any[]; persons: any[]; onSubmit: () => void; isPending: boolean; submitLabel?: string; pendingLabel?: string; isEditMode?: boolean;
}) {
  // Filter persons by selected unit
  const filteredPersons = txForm.unit_id
    ? persons.filter((p: any) => p.unit_id === txForm.unit_id)
    : persons;

  // Active loans for the selected unit, offered as a self-contained "ঋণ পরিশোধ"
  // expense module (mirrors ভাড়া below) instead of requiring a trip to the
  // separate Unit → ঋণ/ধার page just to record one installment.
  const { data: unitLoans = [] } = useLoans({ unitId: txForm.unit_id || null });
  const { data: loanPaymentCounts = {} } = useAllLoanPaymentCounts();
  const activeUnitLoans = unitLoans.filter((l: any) => l.status === 'active');

  // Get expense modules for selected unit
  const selectedUnit = units.find((u: any) => u.id === txForm.unit_id);
  // value is the stable internal tag (used for [tag] description matching and dual-write
  // branching) — label is what's shown in the dropdown, which can be a per-unit override
  // for নিয়মিত খরচ (e.g. "প্রিন্ট খরচ") without touching any of that matching logic.
  const expenseModules: { value: string; label: string }[] = [];
  if (selectedUnit) {
    const settings = selectedUnit.settings || {};
    if (settings.has_materials) expenseModules.push({ value: 'ম্যাটেরিয়াল ক্রয়', label: 'ম্যাটেরিয়াল ক্রয়' });
    if (settings.has_fixed_expenses) expenseModules.push({ value: 'নিয়মিত খরচ', label: settings.fixed_expenses_label || 'নিয়মিত খরচ' });
    // Not offered in edit mode — selecting ভাড়া here only relabels this one transaction,
    // it doesn't run the waterfall allocator, so it wouldn't actually pay down the rent
    // ledger the way it does in the create dialog. Offering the same label with silently
    // different behavior is exactly what caused a manually-edited entry to look like a
    // rent payment without being one.
    if (settings.has_rent && !isEditMode) expenseModules.push({ value: 'ভাড়া', label: 'ভাড়া' });
    // Same reasoning as ভাড়া above — this writes a real acc_loan_payments row via its
    // own mutation, so it's a create-only path, never offered while editing an entry.
    if (activeUnitLoans.length > 0 && !isEditMode) expenseModules.push({ value: 'ঋণ পরিশোধ', label: 'ঋণ পরিশোধ' });
    const custom = (settings as any).custom_modules as string[] | undefined;
    if (custom?.length) expenseModules.push(...custom.map(m => ({ value: m, label: m })));
  }

  const builtIn = ['ম্যাটেরিয়াল ক্রয়', 'নিয়মিত খরচ'];
  const isCustomModule = txForm.expense_module && !builtIn.includes(txForm.expense_module);
  const isKaporModule = txForm.expense_module === 'কাপর';

  const customTotalGoj = isKaporModule ? (txForm.items || []).reduce((s: number, it: any) => s + (Number(it.goj) || 0), 0) : 0;
  const customTotalAmount = isKaporModule ? (txForm.items || []).reduce((s: number, it: any) => s + ((Number(it.goj) || 0) * (Number(it.rate) || 0)), 0) : 0;

  const handleItemChange = (idx: number, field: string, value: string) => {
    setTxForm((f: any) => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [field]: value };
      return { ...f, items };
    });
  };
  const addItem = () => setTxForm((f: any) => ({ ...f, items: [...f.items, { name: '', goj: '', rate: '' }] }));
  const removeItem = (idx: number) => setTxForm((f: any) => ({ ...f, items: f.items.length > 1 ? f.items.filter((_: any, i: number) => i !== idx) : f.items }));

  return (
    <div className="space-y-3">
      <div>
        <Label>📅 তারিখ</Label>
        <Input type="date" value={txForm.date || ''} onChange={e => setTxForm((f: any) => ({ ...f, date: e.target.value }))} />
      </div>
      <div>
        <Label>সোর্স (কোথা থেকে কাটবে)</Label>
        <Select value={txForm.source} onValueChange={v => setTxForm((f: any) => ({ ...f, source: v }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="cash">ক্যাশ</SelectItem>
            <SelectItem value="bank">ব্যাংক</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>ইউনিট</Label>
        <Select value={txForm.unit_id} onValueChange={v => {
          const val = v === '_clear_' ? '' : v;
          setTxForm((f: any) => ({ ...f, unit_id: val, person_id: '', expense_module: '', loan_id: '', memo_number: '', shop_name: '', shop_phone: '', shop_address: '', items: [{ name: '', goj: '', rate: '' }] }));
        }}>
          <SelectTrigger><SelectValue placeholder="ইউনিট নির্বাচন করুন" /></SelectTrigger>
          <SelectContent>
            {units.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {txForm.unit_id && (
      <div>
        <Label>ব্যক্তি</Label>
        <Select value={txForm.person_id} onValueChange={v => setTxForm((f: any) => ({ ...f, person_id: v }))}>
          <SelectTrigger><SelectValue placeholder="ব্যক্তি নির্বাচন করুন" /></SelectTrigger>
          <SelectContent>
            {filteredPersons.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">কোনো ব্যক্তি নেই</div>
            ) : (
              filteredPersons.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)
            )}
          </SelectContent>
        </Select>
      </div>
      )}
      {txForm.unit_id && expenseModules.length > 0 && (
        <div>
          <Label>খরচ মডিউল</Label>
          <Select value={txForm.expense_module} onValueChange={v => {
            const val = v === '_clear_' ? '' : v;
            setTxForm((f: any) => ({ ...f, expense_module: val, loan_id: '', memo_number: '', shop_name: '', shop_phone: '', shop_address: '', items: [{ name: '', goj: '', rate: '' }] }));
          }}>
            <SelectTrigger><SelectValue placeholder="মডিউল নির্বাচন করুন" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_clear_">নির্বাচন করুন</SelectItem>
              {expenseModules.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {txForm.expense_module === 'ঋণ পরিশোধ' && (
        <div>
          <Label>কোন ঋণ</Label>
          <Select value={txForm.loan_id} onValueChange={v => setTxForm((f: any) => ({ ...f, loan_id: v }))}>
            <SelectTrigger><SelectValue placeholder="ঋণ নির্বাচন করুন" /></SelectTrigger>
            <SelectContent>
              {activeUnitLoans.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">কোনো সক্রিয় ঋণ নেই</div>
              ) : (
                activeUnitLoans.map((l: any) => {
                  const paid = loanPaymentCounts[l.id]?.totalPaid || 0;
                  const remaining = Math.max(0, Number(l.principal_amount) - paid);
                  return (
                    <SelectItem key={l.id} value={l.id}>
                      {l.lender_name || l.name} — বাকি ৳{remaining.toLocaleString('bn-BD')}
                    </SelectItem>
                  );
                })
              )}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Custom module memo/items section */}
      {isKaporModule && (
        <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">📋 মেমো নম্বর</Label>
              <Input value={txForm.memo_number} onChange={e => setTxForm((f: any) => ({ ...f, memo_number: e.target.value }))} placeholder="মেমো নম্বর" />
            </div>
            <div>
              <Label className="text-xs">🏪 দোকান</Label>
              <Input value={txForm.shop_name} onChange={e => setTxForm((f: any) => ({ ...f, shop_name: e.target.value }))} placeholder="দোকানের নাম" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">📞 নম্বর</Label>
              <Input value={txForm.shop_phone} onChange={e => setTxForm((f: any) => ({ ...f, shop_phone: e.target.value }))} placeholder="ফোন নম্বর" />
            </div>
            <div>
              <Label className="text-xs">📍 ঠিকানা</Label>
              <Input value={txForm.shop_address} onChange={e => setTxForm((f: any) => ({ ...f, shop_address: e.target.value }))} placeholder="ঠিকানা" />
            </div>
          </div>

          <div className="border-t pt-2 space-y-2">
            {txForm.items.map((item: any, idx: number) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">আইটেম #{idx + 1}</span>
                  {txForm.items.length > 1 && (
                    <button type="button" onClick={() => removeItem(idx)} className="text-destructive hover:text-destructive/80 p-0.5">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <Input value={item.name} onChange={e => handleItemChange(idx, 'name', e.target.value)} placeholder="আইটেমের নাম" className="h-8 text-sm" />
                <div className="grid grid-cols-2 gap-2">
                  <Input type="text" inputMode="decimal" value={item.goj} onChange={e => handleItemChange(idx, 'goj', e.target.value)} placeholder="গজ" className="h-8 text-sm" />
                  <Input type="text" inputMode="decimal" value={item.rate} onChange={e => { const raw = e.target.value; if (/^\d*\.?\d*$/.test(raw)) handleItemChange(idx, 'rate', raw); }} placeholder="দর/গজ (৳)" className="h-8 text-sm" />
                </div>
                {(Number(item.goj) > 0 && Number(item.rate) > 0) && (
                  <div className="text-xs text-right text-primary font-medium">= ৳{((Number(item.goj) || 0) * (Number(item.rate) || 0)).toLocaleString('en-IN')}</div>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addItem} className="w-full h-7 text-xs">
              <Plus className="h-3 w-3 mr-1" /> আইটেম যোগ করুন
            </Button>
          </div>

          <div className="flex justify-between text-sm font-medium border-t pt-2">
            <span>মোট গজ: {customTotalGoj.toLocaleString()}</span>
            <span>মোট: ৳{customTotalAmount.toLocaleString('en-IN')}</span>
          </div>
          <div>
            <Label>বিল পরিমাণ (৳)</Label>
            <Input type="text" inputMode="numeric" value={txForm.bill_amount ? Number(txForm.bill_amount).toLocaleString() : ''} onChange={e => { const raw = e.target.value.replace(/,/g, ''); if (/^\d*\.?\d*$/.test(raw)) setTxForm((f: any) => ({ ...f, bill_amount: raw })); }} placeholder={customTotalAmount ? customTotalAmount.toLocaleString('en-IN') : '0'} />
            <p className="text-[11px] text-muted-foreground mt-0.5">খালি রাখলে ক্যালকুলেটেড মোট ব্যবহার হবে</p>
          </div>
        </div>
      )}

      {!isKaporModule && (
        <div>
          <Label>পরিমাণ (৳)</Label>
          <Input type="text" inputMode="numeric" value={txForm.amount ? Number(txForm.amount).toLocaleString() : ''} onChange={e => { const raw = e.target.value.replace(/,/g, ''); if (/^\d*\.?\d*$/.test(raw)) setTxForm((f: any) => ({ ...f, amount: raw })); }} placeholder="0" />
        </div>
      )}
      <div>
        <Label>বিবরণ</Label>
        <Textarea value={txForm.description} onChange={e => setTxForm((f: any) => ({ ...f, description: e.target.value }))} placeholder="খরচের বিবরণ লিখুন..." />
      </div>
      <Button onClick={onSubmit} disabled={isPending || !txForm.unit_id} className="w-full">
        {isPending ? (pendingLabel || 'সেভ হচ্ছে...') : (submitLabel || 'সেভ করুন')}
      </Button>
    </div>
  );
}

