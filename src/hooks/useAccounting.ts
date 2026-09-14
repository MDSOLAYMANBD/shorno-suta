import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/supabaseHelpers';
import { logAccActivity } from '@/hooks/useAccActivityLog';
import { allocatePaymentToSalaryRecords } from '@/hooks/useSalary';
import { toLocalDateStr } from '@/lib/utils';

// Readable labels for acc_transactions.type — used in activity-log entity names.
const txTypeLabel: Record<string, string> = {
  sale: 'বিক্রয়', salary: 'বেতন', production_payment: 'প্রোডাকশন পেমেন্ট',
  party_payment: 'পার্টি পেমেন্ট', courier_withdrawal: 'কুরিয়ার উত্তোলন',
  expense: 'খরচ', adjustment: 'সমন্বয়', deposit: 'জমা', advance: 'অ্যাডভান্স', bonus: 'বোনাস',
};

export interface AccAccount {
  id: string;
  name: string;
  type: string;
  balance: number;
  created_at: string;
}

export interface AccTransaction {
  id: string;
  account_id: string;
  person_id: string | null;
  unit_id: string | null;
  type: string;
  amount: number;
  description: string;
  reference_id: string | null;
  reference_type: string | null;
  created_by: string | null;
  created_at: string;
  acc_persons?: { name: string; type: string } | null;
  acc_accounts?: { name: string; type: string } | null;
  acc_units?: { name: string } | null;
}

export interface AccUnit {
  id: string;
  name: string;
  is_active: boolean;
  allowed_types: string[];
  settings: Record<string, any>;
  created_at: string;
}

export interface UnitMaterial {
  id: string;
  unit_id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  total: number;
  date: string;
  description: string | null;
  created_at: string;
}

export interface UnitFixedExpense {
  id: string;
  unit_id: string;
  category: string;
  amount: number;
  month: number;
  year: number;
  description: string | null;
  created_at: string;
}

const FINANCIALS_DEBIT_TYPES = ['salary', 'production_payment', 'party_payment', 'expense', 'advance', 'bonus'];

export interface AccountingFinancials {
  totalReceivable: number;
  totalBank: number;
  totalCash: number;
  totalExpenses: number;
  cashExpenses: number;
  bankExpenses: number;
  transferOutBank: number;
  transferOutCash: number;
  officeSellCash: number;
  officeSellBank: number;
  depositCash: number;
  depositBank: number;
  /** Per-day (YYYY-MM-DD local date) breakdown — sum a date range for period sales/expenses/etc. */
  dailyChanges: Record<string, { bankChange: number; cashChange: number; sales: number; expenses: number; withdrawals: number }>;
}

/**
 * Shared source of truth for the accounting dashboard's sales/expenses/
 * balance figures (queryKey 'accounting-financials', invalidated from many
 * places — loans, transactions, courier payments, etc). Originally lived
 * only inside AdminAccounting.tsx; extracted so other admin pages (e.g. the
 * হিসাব মিলান reconciliation) can pull the same period-accurate sales/
 * expense totals via dailyChanges instead of re-deriving their own.
 */
export function useAccountingFinancials() {
  return useQuery({
    queryKey: ['accounting-financials'],
    queryFn: async (): Promise<AccountingFinancials> => {
      const { data: cpData, error: cpErr } = await supabase.from('courier_payments').select('receivable_amount, bank_amount, cash_amount, receive_method, date, created_at');
      if (cpErr) throw cpErr;
      const withMethod = (cpData || []).filter((r: any) => r.receive_method);
      const COURIER_PAYMENT_CUTOFF = '2026-03-17';
      const withMethodCounted = withMethod.filter((r: any) => ((r.date || r.created_at || '') >= COURIER_PAYMENT_CUTOFF));
      const totalReceivable = withMethodCounted.reduce((s: number, r: any) => s + (Number(r.receivable_amount) || 0), 0);
      const totalBank = withMethodCounted.reduce((s: number, r: any) => s + (Number(r.bank_amount) || 0), 0);
      const totalCash = withMethodCounted.reduce((s: number, r: any) => s + (Number(r.cash_amount) || 0), 0);

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

      const resolveSource = (tx: { source: string | null; account_id: string }) => {
        if (tx.account_id === bankAccId) return 'bank';
        if (tx.source === 'bank') return 'bank';
        if (tx.source === 'cash') return 'cash';
        return 'cash';
      };

      const dailyChanges: AccountingFinancials['dailyChanges'] = {};
      const ensureDay = (d: string) => { if (!dailyChanges[d]) dailyChanges[d] = { bankChange: 0, cashChange: 0, sales: 0, expenses: 0, withdrawals: 0 }; };
      const toLocalDate = (iso: string) => {
        const dt = new Date(iso);
        return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      };

      for (const tx of txs) {
        const amt = Number(tx.amount);
        const day = toLocalDate(tx.created_at);
        const src = resolveSource(tx);
        ensureDay(day);
        if (FINANCIALS_DEBIT_TYPES.includes(tx.type)) {
          totalExpenses += amt;
          dailyChanges[day].expenses += amt;
          if (src === 'cash') { cashExpenses += amt; dailyChanges[day].cashChange -= amt; }
          else { bankExpenses += amt; dailyChanges[day].bankChange -= amt; }
        } else if (tx.type === 'courier_withdrawal') {
          dailyChanges[day].withdrawals += amt;
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
}

export function useAccounts() {
  return useQuery({
    queryKey: ['acc-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('acc_accounts' as any).select('*').order('created_at');
      if (error) throw error;
      return (data || []) as unknown as AccAccount[];
    },
  });
}

export function useUnits() {
  return useQuery({
    queryKey: ['acc-units'],
    queryFn: async () => {
      const { data, error } = await supabase.from('acc_units' as any).select('*').eq('is_active', true).order('name');
      if (error) throw error;
      return (data || []).map((u: any) => ({ ...u, settings: u.settings || {} })) as AccUnit[];
    },
  });
}

export function useUnitMaterials(unitId?: string) {
  return useQuery({
    queryKey: ['acc-unit-materials', unitId],
    enabled: !!unitId,
    queryFn: async () => {
      const { data, error } = await supabase.from('acc_unit_materials' as any).select('*').eq('unit_id', unitId).order('date', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as UnitMaterial[];
    },
  });
}

export function useCreateUnitMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (m: { unit_id: string; item_name: string; quantity?: number; unit_price?: number; total: number; date?: string; description?: string }) => {
      const { data, error } = await supabase.from('acc_unit_materials' as any).insert(m as any).select().single();
      if (error) throw error;
      logAccActivity({ action: 'create', entity_type: 'material', entity_id: (data as any)?.id, entity_name: m.item_name, description: `৳${m.total} — ${m.item_name}`, new_data: m });
      return data;
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ['acc-unit-materials', v.unit_id] }),
  });
}

export function useDeleteUnitMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, unit_id, item_name, old_data }: { id: string; unit_id: string; item_name?: string; old_data?: Record<string, any> }) => {
      const { data: existing } = old_data ? { data: null } : await supabase.from('acc_unit_materials' as any).select('*').eq('id', id).single();
      const { error } = await supabase.from('acc_unit_materials' as any).delete().eq('id', id);
      if (error) throw error;
      const snapshot = old_data || (existing as any) || {};
      logAccActivity({ action: 'delete', entity_type: 'material', entity_id: id, entity_name: item_name || snapshot.item_name || '', description: `ম্যাটেরিয়াল ডিলিট`, old_data: { ...snapshot, id } });
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ['acc-unit-materials', v.unit_id] }),
  });
}

export function useUnitFixedExpenses(unitId?: string, month?: number, year?: number) {
  return useQuery({
    queryKey: ['acc-unit-fixed-expenses', unitId, month, year],
    enabled: !!unitId,
    queryFn: async () => {
      let q = (supabase.from('acc_unit_fixed_expenses' as any) as any).select('*').eq('unit_id', unitId).order('created_at', { ascending: false });
      if (month !== undefined) q = q.eq('month', month);
      if (year !== undefined) q = q.eq('year', year);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as UnitFixedExpense[];
    },
  });
}

export function useCreateUnitFixedExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (e: { unit_id: string; category: string; amount: number; month: number; year: number; description?: string }) => {
      const { data, error } = await supabase.from('acc_unit_fixed_expenses' as any).insert(e as any).select().single();
      if (error) throw error;
      logAccActivity({ action: 'create', entity_type: 'fixed_expense', entity_id: (data as any)?.id, entity_name: e.category, description: `৳${e.amount} — ${e.category}`, new_data: e });
      return data;
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ['acc-unit-fixed-expenses', v.unit_id] }),
  });
}

export function useDeleteUnitFixedExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, unit_id, old_data }: { id: string; unit_id: string; old_data?: Record<string, any> }) => {
      const { data: existing } = old_data ? { data: null } : await supabase.from('acc_unit_fixed_expenses' as any).select('*').eq('id', id).single();
      const { error } = await supabase.from('acc_unit_fixed_expenses' as any).delete().eq('id', id);
      if (error) throw error;
      const snapshot = old_data || (existing as any) || {};
      logAccActivity({ action: 'delete', entity_type: 'fixed_expense', entity_id: id, entity_name: snapshot.category || '', description: `নিয়মিত খরচ ডিলিট`, old_data: { ...snapshot, id } });
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ['acc-unit-fixed-expenses', v.unit_id] }),
  });
}

export function useTransactions(filters?: { account_id?: string; person_id?: string; unit_id?: string; type?: string; limit?: number; dateFrom?: string; dateTo?: string }) {
  return useQuery({
    queryKey: ['acc-transactions', filters],
    queryFn: async () => {
      let q = (supabase.from('acc_transactions' as any) as any)
        .select('*, acc_persons(name, type), acc_accounts(name, type), acc_units(name)')
        .order('created_at', { ascending: false });
      if (filters?.account_id) q = q.eq('account_id', filters.account_id);
      if (filters?.person_id) q = q.eq('person_id', filters.person_id);
      if (filters?.unit_id) q = q.eq('unit_id', filters.unit_id);
      if (filters?.type) q = q.eq('type', filters.type);
      if (filters?.dateFrom) q = q.gte('created_at', filters.dateFrom);
      if (filters?.dateTo) q = q.lt('created_at', filters.dateTo);
      if (filters?.limit) q = q.limit(filters.limit);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as AccTransaction[];
    },
  });
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (txIn: {
      account_id: string;
      person_id?: string;
      unit_id?: string;
      type: string;
      amount: number;
      description?: string;
      reference_id?: string;
      reference_type?: string;
      source?: string;
      created_at?: string;
      // Display-only context for the activity log — never written to acc_transactions.
      person_name?: string;
      unit_name?: string;
    }) => {
      const { person_name, unit_name, ...tx } = txIn;
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.from('acc_transactions' as any).insert({
        ...tx,
        created_by: session?.user?.id,
      } as any).select().single();
      if (error) throw error;

      // Update account balance
      const { data: acc } = await supabase.from('acc_accounts' as any).select('balance').eq('id', tx.account_id).single();
      if (acc) {
        const isDebit = ['salary', 'production_payment', 'party_payment', 'expense', 'advance', 'bonus'].includes(tx.type);
        const newBalance = Number((acc as any).balance) + (isDebit ? -tx.amount : tx.amount);
        await supabase.from('acc_accounts' as any).update({ balance: newBalance } as any).eq('id', tx.account_id);
      }

      // Money given to a person (advance or an expense entry against them) is
      // always salary-related here — apply it against their oldest unpaid
      // salary month first, then spill into newer months, so the salary
      // cards actually reflect what's been paid instead of staying "বাকি".
      if (tx.person_id && (tx.type === 'expense' || tx.type === 'advance')) {
        try {
          await allocatePaymentToSalaryRecords(tx.person_id, tx.amount);
        } catch (e) {
          console.error('[allocatePaymentToSalaryRecords]', e);
        }
      }

      const nameSuffix = [person_name, unit_name].filter(Boolean).join(' — ');
      logAccActivity({
        action: 'create', entity_type: 'transaction', entity_id: (data as any)?.id,
        entity_name: `৳${tx.amount} ${txTypeLabel[tx.type] || tx.type}${nameSuffix ? ` (${nameSuffix})` : ''}`,
        description: tx.description || '',
        new_data: { ...tx, person_name, unit_name },
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['acc-accounts'] });
      qc.invalidateQueries({ queryKey: ['acc-transactions'] });
      qc.invalidateQueries({ queryKey: ['acc-transaction-summary'] });
      qc.invalidateQueries({ queryKey: ['acc-daily-history'] });
      qc.invalidateQueries({ queryKey: ['accounting-financials'] });
      qc.invalidateQueries({ queryKey: ['acc-transactions-paginated'] });
      qc.invalidateQueries({ queryKey: ['sales-history'] });
      qc.invalidateQueries({ queryKey: ['withdrawal-history'] });
      qc.invalidateQueries({ queryKey: ['all-courier-payments-history'] });
      qc.invalidateQueries({ queryKey: ['acc-salary-records'] });
      qc.invalidateQueries({ queryKey: ['acc-monthly-salary-summary'] });
      qc.invalidateQueries({ queryKey: ['acc-person-financial'] });
    },
  });
}

export function useCreateUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (unit: { name: string }) => {
      const { data, error } = await supabase.from('acc_units' as any).insert(unit as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['acc-units'] }),
  });
}

export function useUpdateUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; is_active?: boolean; allowed_types?: string[]; settings?: Record<string, any> }) => {
      const { error } = await supabase.from('acc_units' as any).update(updates as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['acc-units'] }),
  });
}

const DEBIT_TYPES = ['salary', 'production_payment', 'party_payment', 'expense', 'advance', 'bonus'];

// Read-time derived settlement for a unit's internal "SHORNO SUTA" work sheet — how much of
// the unit's real spending wasn't covered by real payments from its outside work_party/sales_party
// clients. Never writes anything; recomputed fresh from source transactions every time, so it can
// never drift out of sync the way a written/synced entry could.
export function useUnitInternalSettlement(unitId?: string, internalPersonId?: string) {
  return useQuery({
    queryKey: ['unit-internal-settlement', unitId, internalPersonId],
    enabled: !!unitId && !!internalPersonId,
    queryFn: async () => {
      const { data: expenseTx } = await supabase.from('acc_transactions' as any)
        .select('amount').eq('unit_id', unitId).in('type', DEBIT_TYPES);
      const totalUnitExpense = (expenseTx || []).reduce((s: number, t: any) => s + Number(t.amount), 0);

      const { data: outsidePersons } = await supabase.from('acc_persons' as any)
        .select('id').eq('unit_id', unitId).in('type', ['work_party', 'sales_party']).neq('id', internalPersonId);
      const personIds = ((outsidePersons || []) as { id: string }[]).map(p => p.id);

      let totalOutsideDeposits = 0;
      if (personIds.length > 0) {
        const { data: depositTx } = await supabase.from('acc_transactions' as any)
          .select('amount').eq('type', 'deposit').in('person_id', personIds);
        totalOutsideDeposits = (depositTx || []).reduce((s: number, t: any) => s + Number(t.amount), 0);
      }

      return {
        totalUnitExpense, totalOutsideDeposits,
        settlementAmount: Math.max(0, totalUnitExpense - totalOutsideDeposits),
      };
    },
  });
}

export function useTransactionSummary() {
  return useQuery({
    queryKey: ['acc-transaction-summary'],
    queryFn: async () => {
      const txs = await fetchAllRows<{ type: string; amount: number; created_at: string }>(
        () => (supabase.from('acc_transactions' as any) as any).select('type, amount, created_at')
      );

      const today = toLocalDateStr();

      let totalSales = 0, totalWithdrawals = 0, totalExpenses = 0;
      let todaySales = 0, todayWithdrawals = 0, todayExpenses = 0;

      for (const tx of txs) {
        const amt = Number(tx.amount);
        const txDate = toLocalDateStr(tx.created_at);
        const isToday = txDate === today;

        if (tx.type === 'sale') {
          totalSales += amt;
          if (isToday) todaySales += amt;
        } else if (tx.type === 'courier_withdrawal') {
          totalWithdrawals += amt;
          if (isToday) todayWithdrawals += amt;
        } else if (DEBIT_TYPES.includes(tx.type)) {
          totalExpenses += amt;
          if (isToday) todayExpenses += amt;
        }
      }

      // Add today's courier payments receivable as sales
      const nextDay = toLocalDateStr((() => { const d = new Date(); d.setDate(d.getDate() + 1); return d; })());
      const { data: courierToday } = await (supabase.from('courier_payments' as any) as any)
        .select('receivable_amount')
        .gte('date', today)
        .lt('date', nextDay);
      if (courierToday) {
        for (const cp of courierToday) {
          todaySales += Number(cp.receivable_amount || 0);
        }
      }

      return {
        totalSales,
        totalWithdrawals,
        totalExpenses,
        todaySales,
        todayWithdrawals,
        todayExpenses,
      };
    },
  });
}

export interface DailyHistoryRow {
  date: string;
  withdrawals: number;
  expenses: number;
  balance: number;
}

export interface UnitCustomExpense {
  id: string;
  unit_id: string;
  module_name: string;
  item_name: string;
  amount: number;
  date: string;
  description: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export function useUnitCustomExpenses(unitId?: string, moduleName?: string) {
  return useQuery({
    queryKey: ['acc-unit-custom-expenses', unitId, moduleName],
    enabled: !!unitId && !!moduleName,
    queryFn: async () => {
      const { data, error } = await supabase.from('acc_unit_custom_expenses' as any).select('*')
        .eq('unit_id', unitId).eq('module_name', moduleName).order('date', { ascending: false });
      if (error) throw error;
      return (data || []).map((d: any) => ({ ...d, metadata: d.metadata || {} })) as UnitCustomExpense[];
    },
  });
}

export function useCreateUnitCustomExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (e: { unit_id: string; module_name: string; item_name: string; amount: number; date?: string; description?: string; metadata?: Record<string, any> }) => {
      const { data, error } = await supabase.from('acc_unit_custom_expenses' as any).insert(e as any).select().single();
      if (error) throw error;
      logAccActivity({ action: 'create', entity_type: 'custom_expense', entity_id: (data as any)?.id, entity_name: `[${e.module_name}] ${e.item_name}`, description: `৳${e.amount}`, new_data: e });
      return data;
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ['acc-unit-custom-expenses', v.unit_id, v.module_name] }),
  });
}

// Custom-expense entries have no FK to the acc_transactions row created alongside
// them at creation time — they're linked only by convention (description starts
// with `[module_name]`, same amount), the same fuzzy match useDeleteTransaction
// already relies on in the reverse direction (transaction -> custom expense).
async function findMatchingCustomExpenseTx(unit_id: string, module_name: string, amount: number) {
  const { data } = await (supabase.from('acc_transactions' as any) as any)
    .select('id, account_id, amount, source')
    .eq('unit_id', unit_id)
    .eq('type', 'expense')
    .ilike('description', `[${module_name}]%`)
    .eq('amount', amount)
    .order('created_at', { ascending: false })
    .limit(1);
  return (data && data.length > 0) ? (data[0] as { id: string; account_id: string; amount: number; source: string | null }) : null;
}

export function useUpdateUnitCustomExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, unit_id, module_name, item_name, amount, date, description, metadata, source, account_id }: {
      id: string; unit_id: string; module_name: string; item_name: string; amount: number;
      date?: string; description?: string; metadata?: Record<string, any>; source?: 'cash' | 'bank'; account_id?: string;
    }) => {
      const { data: existing } = await supabase.from('acc_unit_custom_expenses' as any).select('*').eq('id', id).single();
      const oldAmount = Number((existing as any)?.amount) || 0;

      const { error } = await supabase.from('acc_unit_custom_expenses' as any)
        .update({ item_name, amount, date, description, metadata } as any).eq('id', id);
      if (error) throw error;

      logAccActivity({
        action: 'update', entity_type: 'custom_expense', entity_id: id,
        entity_name: `[${module_name}] ${item_name}`, description: `৳${amount}`,
        old_data: existing as any, new_data: { unit_id, module_name, item_name, amount, date, description, metadata },
      });

      const tx = await findMatchingCustomExpenseTx(unit_id, module_name, oldAmount);
      if (tx) {
        const newDescription = `[${module_name}] ${item_name}`;
        const txUpdate: Record<string, any> = { amount, description: newDescription };
        if (date) txUpdate.created_at = new Date(date + 'T00:00:00').toISOString();
        if (source) txUpdate.source = source;
        const targetAccountId = account_id || tx.account_id;
        if (targetAccountId !== tx.account_id) txUpdate.account_id = targetAccountId;
        await supabase.from('acc_transactions' as any).update(txUpdate as any).eq('id', tx.id);

        // expense is always a debit; move balance to reflect the new amount/account.
        if (targetAccountId !== tx.account_id) {
          const { data: oldAcc } = await supabase.from('acc_accounts' as any).select('balance').eq('id', tx.account_id).single();
          if (oldAcc) await supabase.from('acc_accounts' as any).update({ balance: Number((oldAcc as any).balance) + Number(tx.amount) } as any).eq('id', tx.account_id);
          const { data: newAcc } = await supabase.from('acc_accounts' as any).select('balance').eq('id', targetAccountId).single();
          if (newAcc) await supabase.from('acc_accounts' as any).update({ balance: Number((newAcc as any).balance) - amount } as any).eq('id', targetAccountId);
        } else {
          const { data: acc } = await supabase.from('acc_accounts' as any).select('balance').eq('id', targetAccountId).single();
          if (acc) {
            const diff = amount - Number(tx.amount);
            await supabase.from('acc_accounts' as any).update({ balance: Number((acc as any).balance) - diff } as any).eq('id', targetAccountId);
          }
        }
      }
    },
    onSuccess: (_, v) => { qc.invalidateQueries({ queryKey: ['acc-unit-custom-expenses', v.unit_id, v.module_name] }); invalidateAllAccounting(qc); },
  });
}

export function useDeleteUnitCustomExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, unit_id, module_name, old_data }: { id: string; unit_id: string; module_name: string; old_data?: Record<string, any> }) => {
      const { data: existing } = old_data ? { data: null } : await supabase.from('acc_unit_custom_expenses' as any).select('*').eq('id', id).single();
      const { error } = await supabase.from('acc_unit_custom_expenses' as any).delete().eq('id', id);
      if (error) throw error;
      const snapshot = old_data || (existing as any) || {};
      logAccActivity({ action: 'delete', entity_type: 'custom_expense', entity_id: id, entity_name: `[${module_name}] ${snapshot.item_name || ''}`, description: `কাস্টম খরচ ডিলিট`, old_data: { ...snapshot, id } });

      // Reverse the paired expense transaction + restore the account balance it debited.
      const amt = Number(snapshot.amount) || 0;
      if (amt > 0) {
        const tx = await findMatchingCustomExpenseTx(unit_id, module_name, amt);
        if (tx) {
          await supabase.from('acc_transactions' as any).delete().eq('id', tx.id);
          const { data: acc } = await supabase.from('acc_accounts' as any).select('balance').eq('id', tx.account_id).single();
          if (acc) await supabase.from('acc_accounts' as any).update({ balance: Number((acc as any).balance) + Number(tx.amount) } as any).eq('id', tx.account_id);
        }
      }
    },
    onSuccess: (_, v) => { qc.invalidateQueries({ queryKey: ['acc-unit-custom-expenses', v.unit_id, v.module_name] }); invalidateAllAccounting(qc); },
  });
}

export function useDailyHistory() {
  return useQuery({
    queryKey: ['acc-daily-history'],
    queryFn: async () => {
      const txs = await fetchAllRows<{ type: string; amount: number; created_at: string }>(
        () => (supabase.from('acc_transactions' as any) as any).select('type, amount, created_at').order('created_at', { ascending: true })
      );

      const dayMap = new Map<string, { withdrawals: number; expenses: number }>();

      for (const tx of txs) {
        const date = toLocalDateStr(tx.created_at);
        if (!dayMap.has(date)) dayMap.set(date, { withdrawals: 0, expenses: 0 });
        const day = dayMap.get(date)!;
        const amt = Number(tx.amount);

        if (tx.type === 'courier_withdrawal') day.withdrawals += amt;
        else if (DEBIT_TYPES.includes(tx.type)) day.expenses += amt;
      }

      // Build running balance history
      const rows: DailyHistoryRow[] = [];
      let runningBalance = 0;
      const sortedDates = [...dayMap.keys()].sort();

      for (const date of sortedDates) {
        const d = dayMap.get(date)!;
        runningBalance += d.withdrawals - d.expenses;
        rows.push({ date, withdrawals: d.withdrawals, expenses: d.expenses, balance: runningBalance });
      }

      // Return most recent first, last 30 days
      return rows.reverse().slice(0, 30);
    },
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, account_id, type, amount, description, person_id, unit_id, source, person_name, unit_name }: { id: string; account_id: string; type: string; amount: number; description?: string | null; person_id?: string | null; unit_id?: string | null; source?: string | null; person_name?: string | null; unit_name?: string | null }) => {
      // Log before delete. old_data is re-inserted verbatim by useRestoreEntry
      // on restore, so it must contain ONLY real acc_transactions columns —
      // person_name/unit_name go in entity_name for display instead.
      const nameSuffix = [person_name, unit_name].filter(Boolean).join(' — ');
      logAccActivity({
        action: 'delete', entity_type: 'transaction', entity_id: id,
        entity_name: `৳${amount} ${txTypeLabel[type] || type}${nameSuffix ? ` (${nameSuffix})` : ''}`,
        description: description || '',
        old_data: { id, account_id, type, amount, description, person_id, unit_id, source },
      });

      const { error } = await supabase.from('acc_transactions' as any).delete().eq('id', id);
      if (error) throw error;

      const { data: acc } = await supabase.from('acc_accounts' as any).select('balance').eq('id', account_id).single();
      if (acc) {
        const wasDebit = DEBIT_TYPES.includes(type);
        const newBalance = Number((acc as any).balance) + (wasDebit ? amount : -amount);
        await supabase.from('acc_accounts' as any).update({ balance: newBalance } as any).eq('id', account_id);
      }

      if (type === 'expense' && description) {
        const moduleMatch = description.match(/^\[(.+?)\]/);
        if (moduleMatch) {
          await supabase.from('acc_unit_custom_expenses' as any).delete()
            .eq('module_name', moduleMatch[1])
            .eq('amount', amount)
            .limit(1);
        }
      }

      if (type === 'party_payment' && person_id) {
        const { data: matchingEntries } = await (supabase.from('acc_party_entries' as any) as any)
          .select('id')
          .eq('person_id', person_id)
          .eq('total', amount)
          .eq('is_submission', true)
          .order('created_at', { ascending: false })
          .limit(1);
        if (matchingEntries && matchingEntries.length > 0) {
          await supabase.from('acc_party_entries' as any).delete().eq('id', matchingEntries[0].id);
        }
      }
    },
    onSuccess: () => {
      invalidateAllAccounting(qc);
      qc.invalidateQueries({ queryKey: ['acc-party-entries'] });
    },
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, account_id, type, oldAmount, newAmount, newDescription, newAccountId, newUnitId, newPersonId,
      oldDescription, oldUnitId, oldPersonId, oldSource, newSource, oldUnitName, newUnitName, oldPersonName, newPersonName, newCreatedAt,
    }: {
      id: string; account_id: string; type: string; oldAmount: number; newAmount: number; newDescription: string;
      newAccountId?: string; newUnitId?: string | null; newPersonId?: string | null;
      oldDescription?: string; oldUnitId?: string | null; oldPersonId?: string | null;
      oldSource?: string; newSource?: string;
      oldUnitName?: string; newUnitName?: string; oldPersonName?: string; newPersonName?: string;
      newCreatedAt?: string;
    }) => {
      // Fetch actual current state from DB to prevent stale balance adjustments
      const { data: currentTx } = await supabase.from('acc_transactions' as any).select('account_id, amount').eq('id', id).single();
      const actualOldAccountId = (currentTx as any)?.account_id || account_id;
      const actualOldAmount = Number((currentTx as any)?.amount) || oldAmount;

      logAccActivity({
        action: 'update', entity_type: 'transaction', entity_id: id,
        entity_name: `৳${newAmount} ${type}`, description: newDescription,
        old_data: { amount: oldAmount, description: oldDescription || '', source: oldSource || 'cash', unit_name: oldUnitName || '', person_name: oldPersonName || '', unit_id: oldUnitId || null, person_id: oldPersonId || null },
        new_data: { amount: newAmount, description: newDescription, source: newSource || oldSource || 'cash', unit_name: newUnitName || '', person_name: newPersonName || '', unit_id: newUnitId || null, person_id: newPersonId || null },
      });

      const updatePayload: Record<string, any> = {
        amount: newAmount,
        description: newDescription,
      };
      if (newSource) updatePayload.source = newSource;
      if (newUnitId !== undefined) updatePayload.unit_id = newUnitId || null;
      if (newPersonId !== undefined) updatePayload.person_id = newPersonId || null;
      if (newCreatedAt) updatePayload.created_at = newCreatedAt;

      const effectiveAccountId = newAccountId || account_id;
      if (newAccountId && newAccountId !== account_id) {
        updatePayload.account_id = newAccountId;
      }

      const { error } = await supabase.from('acc_transactions' as any).update(updatePayload as any).eq('id', id);
      if (error) throw error;

      // Handle balance changes using actual DB values
      if (newAccountId && newAccountId !== actualOldAccountId) {
        // Account changed: reverse from old, apply to new
        const wasDebit = DEBIT_TYPES.includes(type);
        const { data: oldAcc } = await supabase.from('acc_accounts' as any).select('balance').eq('id', actualOldAccountId).single();
        if (oldAcc) {
          const revert = Number((oldAcc as any).balance) + (wasDebit ? actualOldAmount : -actualOldAmount);
          await supabase.from('acc_accounts' as any).update({ balance: revert } as any).eq('id', actualOldAccountId);
        }
        const { data: newAcc } = await supabase.from('acc_accounts' as any).select('balance').eq('id', newAccountId).single();
        if (newAcc) {
          const apply = Number((newAcc as any).balance) + (wasDebit ? -newAmount : newAmount);
          await supabase.from('acc_accounts' as any).update({ balance: apply } as any).eq('id', newAccountId);
        }
      } else {
        const effectiveAccId = newAccountId || actualOldAccountId;
        const { data: acc } = await supabase.from('acc_accounts' as any).select('balance').eq('id', effectiveAccId).single();
        if (acc) {
          const wasDebit = DEBIT_TYPES.includes(type);
          const diff = newAmount - actualOldAmount;
          const balanceChange = wasDebit ? -diff : diff;
          const newBalance = Number((acc as any).balance) + balanceChange;
          await supabase.from('acc_accounts' as any).update({ balance: newBalance } as any).eq('id', effectiveAccId);
        }
      }
    },
    onSuccess: () => {
      invalidateAllAccounting(qc);
    },
  });
}

function invalidateAllAccounting(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['acc-accounts'] });
  qc.invalidateQueries({ queryKey: ['acc-transactions'] });
  qc.invalidateQueries({ queryKey: ['acc-transaction-summary'] });
  qc.invalidateQueries({ queryKey: ['acc-daily-history'] });
  qc.invalidateQueries({ queryKey: ['accounting-financials'] });
  qc.invalidateQueries({ queryKey: ['acc-transactions-paginated'] });
  qc.invalidateQueries({ queryKey: ['sales-history'] });
  qc.invalidateQueries({ queryKey: ['withdrawal-history'] });
  qc.invalidateQueries({ queryKey: ['all-courier-payments-history'] });
  qc.invalidateQueries({ queryKey: ['acc-unit-custom-expenses'] });
  qc.invalidateQueries({ queryKey: ['acc-party-entries'] });
}
