import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient, QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logAccActivity } from '@/hooks/useAccActivityLog';
import { CASH_ACCOUNT_ID, BANK_ACCOUNT_ID } from '@/hooks/useLiveCashBank';
import { toLocalDateStr } from '@/lib/utils';

export interface AccUnitRentRecord {
  id: string;
  unit_id: string;
  month: number;
  year: number;
  rent_amount: number;
  paid_amount: number;
  is_paid: boolean;
  created_at: string;
}

export interface AccUnitRentIncrement {
  id: string;
  unit_id: string;
  old_amount: number;
  new_amount: number;
  effective_date: string;
  note: string | null;
  created_at: string;
}

export interface RentAllocation { record_id: string; month: number; year: number; amount: number }

export interface AccUnitRentPayment {
  id: string;
  unit_id: string;
  amount: number;
  payment_date: string;
  account_id: string | null;
  source: string;
  note: string | null;
  allocations: RentAllocation[];
  created_at: string;
}

export interface RentMonthRow {
  month: number; year: number; rentAmount: number; paid: number; due: number;
  materialized: boolean; recordId?: string;
}

/** Mirrors isSalaryMonthBeforeJoining — months before the anchor are never tracked/owed. */
export function isRentMonthBeforeStart(month: number, year: number, rentStartDate?: string | null): boolean {
  if (!rentStartDate) return true;
  const [sy, sm] = rentStartDate.slice(0, 10).split('-').map(Number);
  if (!sy || !sm) return true;
  return year < sy || (year === sy && month < sm);
}

/** Picks the rate in effect for a given month from the increments log — mirrors the
 *  back-dated base_salary resolver already used for person salary history. */
export function resolveRentAmountForMonth(
  month: number, year: number, currentAmount: number, increments: AccUnitRentIncrement[]
): number {
  if (!increments || increments.length === 0) return currentAmount;
  const monthEnd = new Date(year, month, 0);
  const sorted = [...increments].sort((a, b) => +new Date(a.effective_date) - +new Date(b.effective_date));
  let eff = Number(sorted[0].old_amount) || currentAmount;
  for (const inc of sorted) {
    if (new Date(inc.effective_date) <= monthEnd) eff = Number(inc.new_amount);
  }
  return eff || currentAmount;
}

/** Convert YYYY-MM-DD date string to ISO timestamp preserving current time, so
 *  chronological order within a day is maintained — mirrors useSalary.ts's helper. */
function dateStrToIso(dateStr?: string): string | undefined {
  if (!dateStr) return undefined;
  const time = new Date().toTimeString().slice(0, 8);
  return new Date(`${dateStr}T${time}`).toISOString();
}

async function getUnitSettings(unitId: string): Promise<Record<string, any>> {
  const { data } = await (supabase.from('acc_units' as any) as any).select('settings').eq('id', unitId).maybeSingle();
  return ((data as any)?.settings || {}) as Record<string, any>;
}

function invalidateRentQueries(qc: QueryClient, unitId?: string) {
  qc.invalidateQueries({ queryKey: ['acc-unit-rent-records', unitId] });
  qc.invalidateQueries({ queryKey: ['acc-unit-rent-increments', unitId] });
  qc.invalidateQueries({ queryKey: ['acc-unit-rent-payments', unitId] });
  qc.invalidateQueries({ queryKey: ['acc-units'] });
  qc.invalidateQueries({ queryKey: ['acc-accounts'] });
  qc.invalidateQueries({ queryKey: ['acc-transactions'] });
  qc.invalidateQueries({ queryKey: ['acc-transaction-summary'] });
  qc.invalidateQueries({ queryKey: ['accounting-financials'] });
  qc.invalidateQueries({ queryKey: ['live-cash-bank'] });
}

export function useRentRecords(unitId?: string) {
  return useQuery({
    queryKey: ['acc-unit-rent-records', unitId],
    enabled: !!unitId,
    queryFn: async () => {
      const { data, error } = await (supabase.from('acc_unit_rent_records' as any) as any)
        .select('*').eq('unit_id', unitId).order('year', { ascending: true }).order('month', { ascending: true });
      if (error) throw error;
      return (data || []) as AccUnitRentRecord[];
    },
  });
}

export function useRentIncrements(unitId?: string) {
  return useQuery({
    queryKey: ['acc-unit-rent-increments', unitId],
    enabled: !!unitId,
    queryFn: async () => {
      const { data, error } = await (supabase.from('acc_unit_rent_increments' as any) as any)
        .select('*').eq('unit_id', unitId).order('effective_date', { ascending: false });
      if (error) throw error;
      return (data || []) as AccUnitRentIncrement[];
    },
  });
}

export function useRentPayments(unitId?: string) {
  return useQuery({
    queryKey: ['acc-unit-rent-payments', unitId],
    enabled: !!unitId,
    queryFn: async () => {
      const { data, error } = await (supabase.from('acc_unit_rent_payments' as any) as any)
        .select('*').eq('unit_id', unitId)
        .order('payment_date', { ascending: false }).order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as AccUnitRentPayment[];
    },
  });
}

/** Owed calculation. Rent accrues purely from the calendar with zero required admin
 *  action, so this hybridizes real DB rows with in-memory "virtual" rows for any
 *  anchor→current-month gap that hasn't been materialized yet. Pure read/derive. */
export function useRentUnitSummary(unitId?: string, currentAmount?: number, rentStartDate?: string | null) {
  const { data: records = [] } = useRentRecords(unitId);
  const { data: increments = [] } = useRentIncrements(unitId);
  return useMemo(() => {
    if (!unitId || !rentStartDate) return { rows: [] as RentMonthRow[], totalOwed: 0, totalPaid: 0, totalDue: 0 };
    const now = new Date();
    const curM = now.getMonth() + 1, curY = now.getFullYear();
    const byKey = new Map(records.map(r => [`${r.year}-${r.month}`, r]));
    const rows: RentMonthRow[] = [];
    const [sy, sm] = rentStartDate.slice(0, 10).split('-').map(Number);
    let y = sy, m = sm, guard = 0;
    while ((y < curY || (y === curY && m <= curM)) && guard < 600) {
      guard++;
      const real = byKey.get(`${y}-${m}`);
      const rentAmount = real ? Number(real.rent_amount) : resolveRentAmountForMonth(m, y, currentAmount || 0, increments);
      const paid = real ? Number(real.paid_amount) : 0;
      rows.push({ month: m, year: y, rentAmount, paid, due: Math.max(0, rentAmount - paid), materialized: !!real, recordId: real?.id });
      m += 1; if (m > 12) { m = 1; y += 1; }
    }
    return {
      rows,
      totalOwed: rows.reduce((s, r) => s + r.rentAmount, 0),
      totalPaid: rows.reduce((s, r) => s + r.paid, 0),
      totalDue: Math.max(0, rows.reduce((s, r) => s + (r.rentAmount - r.paid), 0)),
    };
  }, [unitId, rentStartDate, currentAmount, records, increments]);
}

export function useCreateRentIncrement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ unit_id, old_amount, new_amount, effective_date, note }: {
      unit_id: string; old_amount: number; new_amount: number; effective_date: string; note?: string;
    }) => {
      const { error: incErr } = await supabase.from('acc_unit_rent_increments' as any)
        .insert({ unit_id, old_amount, new_amount, effective_date, note: note || null } as any);
      if (incErr) throw incErr;
      const settings = await getUnitSettings(unit_id);
      const { error } = await supabase.from('acc_units' as any)
        .update({ settings: { ...settings, rent_amount: new_amount } } as any).eq('id', unit_id);
      if (error) throw error;
      logAccActivity({
        action: 'create', entity_type: 'rent_increment', entity_id: unit_id,
        entity_name: `ভাড়া বৃদ্ধি ৳${old_amount} → ৳${new_amount}`,
        new_data: { unit_id, old_amount, new_amount, effective_date, note },
      });
    },
    onSuccess: (_, v) => invalidateRentQueries(qc, v.unit_id),
  });
}

export function useUpdateRentIncrement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, unit_id, new_amount, effective_date, note }: {
      id: string; unit_id: string; new_amount: number; effective_date: string; note?: string | null;
    }) => {
      const { error: upErr } = await supabase.from('acc_unit_rent_increments' as any)
        .update({ new_amount, effective_date, note: note ?? null } as any).eq('id', id);
      if (upErr) throw upErr;
      const { data: rows } = await (supabase.from('acc_unit_rent_increments' as any) as any)
        .select('id, new_amount, effective_date').eq('unit_id', unit_id)
        .order('effective_date', { ascending: false }).limit(1);
      const latest = (rows || [])[0];
      if (latest && latest.id === id) {
        const settings = await getUnitSettings(unit_id);
        await supabase.from('acc_units' as any)
          .update({ settings: { ...settings, rent_amount: new_amount } } as any).eq('id', unit_id);
      }
    },
    onSuccess: (_, v) => invalidateRentQueries(qc, v.unit_id),
  });
}

export function useDeleteRentIncrement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, unit_id }: { id: string; unit_id: string }) => {
      const { data: target } = await (supabase.from('acc_unit_rent_increments' as any) as any)
        .select('id, old_amount').eq('id', id).maybeSingle();
      const { error: delErr } = await supabase.from('acc_unit_rent_increments' as any).delete().eq('id', id);
      if (delErr) throw delErr;
      const { data: remaining } = await (supabase.from('acc_unit_rent_increments' as any) as any)
        .select('new_amount, effective_date').eq('unit_id', unit_id)
        .order('effective_date', { ascending: false }).limit(1);
      const newAmount = (remaining || [])[0]?.new_amount ?? (target as any)?.old_amount;
      if (newAmount != null) {
        const settings = await getUnitSettings(unit_id);
        await supabase.from('acc_units' as any)
          .update({ settings: { ...settings, rent_amount: newAmount } } as any).eq('id', unit_id);
      }
    },
    onSuccess: (_, v) => invalidateRentQueries(qc, v.unit_id),
  });
}

const RENT_FORWARD_CAP = 24;

/** Shared core for both payment entry points (direct-to-month and waterfall). Writes
 *  the payment row (with an allocations breakdown), the linked acc_transactions row
 *  (exact reference_type/reference_id — never fuzzy matching), and debits the account
 *  balance. `target` present ⇒ direct-pay mode; absent ⇒ waterfall (oldest-due-first,
 *  overflow rolls forward into future months rather than an "advance" bucket, since
 *  pre-paying rent is normal, unlike salary's unearned-advance concept). */
async function writeRentPayment(params: {
  unit_id: string;
  amount: number;
  account_id: string;
  payment_date?: string;
  note?: string;
  target?: { month: number; year: number };
}): Promise<{ paymentId: string; appliedTo: string[] }> {
  const { unit_id, amount, account_id, payment_date, note, target } = params;
  if (!amount || amount <= 0) throw new Error('পরিমাণ দিন');
  if (!account_id) throw new Error('অ্যাকাউন্ট নির্বাচন করুন');

  const settings = await getUnitSettings(unit_id);
  const rentStartDate: string | undefined = settings.rent_start_date;
  const currentAmount = Number(settings.rent_amount || 0);
  if (!rentStartDate) throw new Error('ভাড়া হিসাব শুরু করা হয়নি — আগে সেটআপ করুন');

  const { data: incrementsRaw } = await (supabase.from('acc_unit_rent_increments' as any) as any)
    .select('*').eq('unit_id', unit_id);
  const increments = (incrementsRaw || []) as AccUnitRentIncrement[];

  const { data: recordsRaw } = await (supabase.from('acc_unit_rent_records' as any) as any)
    .select('*').eq('unit_id', unit_id).order('year', { ascending: true }).order('month', { ascending: true });
  const records: AccUnitRentRecord[] = (recordsRaw || []) as AccUnitRentRecord[];

  const ensureRecord = async (month: number, year: number): Promise<AccUnitRentRecord> => {
    const found = records.find(r => r.month === month && r.year === year);
    if (found) return found;
    const rentAmount = resolveRentAmountForMonth(month, year, currentAmount, increments);
    const { data: inserted, error } = await supabase.from('acc_unit_rent_records' as any).insert({
      unit_id, month, year, rent_amount: rentAmount, paid_amount: 0, is_paid: false,
    } as any).select().single();
    if (error) throw error;
    const rec = inserted as AccUnitRentRecord;
    records.push(rec);
    return rec;
  };

  const applyToRecord = async (rec: AccUnitRentRecord, apply: number) => {
    const newPaid = Number(rec.paid_amount) + apply;
    const isPaid = newPaid >= Number(rec.rent_amount) && Number(rec.rent_amount) > 0;
    await supabase.from('acc_unit_rent_records' as any).update({ paid_amount: newPaid, is_paid: isPaid } as any).eq('id', rec.id);
    rec.paid_amount = newPaid;
  };

  const allocations: RentAllocation[] = [];
  const appliedTo: string[] = [];
  let remaining = amount;

  if (target) {
    const rec = await ensureRecord(target.month, target.year);
    await applyToRecord(rec, remaining);
    allocations.push({ record_id: rec.id, month: rec.month, year: rec.year, amount: remaining });
    appliedTo.push(`${rec.month}/${rec.year}: ৳${remaining}`);
    remaining = 0;
  } else {
    const now = new Date();
    const curM = now.getMonth() + 1, curY = now.getFullYear();
    const [sy, sm] = rentStartDate.slice(0, 10).split('-').map(Number);

    let y = sy, m = sm, guard = 0;
    while ((y < curY || (y === curY && m <= curM)) && guard < 600) {
      guard++;
      await ensureRecord(m, y);
      m += 1; if (m > 12) { m = 1; y += 1; }
    }
    records.sort((a, b) => a.year - b.year || a.month - b.month);

    for (const rec of records) {
      if (remaining <= 0) break;
      const due = Number(rec.rent_amount) - Number(rec.paid_amount);
      if (due <= 0) continue;
      const apply = Math.min(remaining, due);
      await applyToRecord(rec, apply);
      allocations.push({ record_id: rec.id, month: rec.month, year: rec.year, amount: apply });
      appliedTo.push(`${rec.month}/${rec.year}: ৳${apply}`);
      remaining -= apply;
    }

    let fwdMonth = records.length > 0 ? records[records.length - 1].month : m;
    let fwdYear = records.length > 0 ? records[records.length - 1].year : y;
    let fwdGuard = 0;
    while (remaining > 0 && fwdGuard < RENT_FORWARD_CAP) {
      fwdGuard++;
      fwdMonth += 1; if (fwdMonth > 12) { fwdMonth = 1; fwdYear += 1; }
      const rec = await ensureRecord(fwdMonth, fwdYear);
      const due = Number(rec.rent_amount) - Number(rec.paid_amount);
      const apply = fwdGuard === RENT_FORWARD_CAP ? remaining : Math.min(remaining, due > 0 ? due : remaining);
      await applyToRecord(rec, apply);
      allocations.push({ record_id: rec.id, month: rec.month, year: rec.year, amount: apply });
      appliedTo.push(`${rec.month}/${rec.year} (অগ্রিম): ৳${apply}`);
      remaining -= apply;
    }
  }

  const { data: { session } } = await supabase.auth.getSession();
  const src = account_id === BANK_ACCOUNT_ID ? 'bank' : 'cash';
  const createdAt = dateStrToIso(payment_date);

  const { data: paymentRow, error: payErr } = await supabase.from('acc_unit_rent_payments' as any).insert({
    unit_id, amount, payment_date: payment_date || toLocalDateStr(), account_id, source: src,
    note: note || '', allocations,
  } as any).select().single();
  if (payErr) throw payErr;
  const payment = paymentRow as AccUnitRentPayment;

  const { error: txErr } = await supabase.from('acc_transactions' as any).insert({
    account_id, unit_id, type: 'expense', amount,
    description: `[ভাড়া] ${appliedTo.join(', ')}`,
    source: src,
    reference_type: 'acc_unit_rent_payments',
    reference_id: payment.id,
    created_by: session?.user?.id,
    ...(createdAt ? { created_at: createdAt } : {}),
  } as any);
  if (txErr) throw txErr;

  const { data: acc } = await supabase.from('acc_accounts' as any).select('balance').eq('id', account_id).single();
  if (acc) {
    await supabase.from('acc_accounts' as any)
      .update({ balance: Number((acc as any).balance) - amount } as any).eq('id', account_id);
  }

  logAccActivity({
    action: 'create', entity_type: 'rent_payment', entity_id: payment.id,
    entity_name: `৳${amount} ভাড়া পেমেন্ট`,
    description: appliedTo.join(', '),
    new_data: { unit_id, amount, account_id, allocations },
  });

  return { paymentId: payment.id, appliedTo };
}

/** Direct-to-one-month pay, mirrors usePaySalary. */
export function usePayRentMonth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { unit_id: string; month: number; year: number; amount: number; account_id: string; payment_date?: string; note?: string }) =>
      writeRentPayment({ ...p, target: { month: p.month, year: p.year } }),
    onSuccess: (_, v) => invalidateRentQueries(qc, v.unit_id),
  });
}

/** Waterfall: settles the oldest unpaid month(s) first — this is what makes "rent
 *  paid split across visits, or together with another month's" work without ever
 *  needing to ask which month a payment is for. */
export async function allocatePaymentToRentRecords(
  unitId: string, amount: number, opts: { account_id: string; payment_date?: string; note?: string }
) {
  return writeRentPayment({ unit_id: unitId, amount, ...opts });
}

export function useAllocateRentPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { unit_id: string; amount: number; account_id: string; payment_date?: string; note?: string }) =>
      allocatePaymentToRentRecords(p.unit_id, p.amount, p),
    onSuccess: (_, v) => invalidateRentQueries(qc, v.unit_id),
  });
}

/** Reverses a payment exactly via its allocations breakdown — decrements only the
 *  records it actually touched, deletes the linked transaction via exact reference_id
 *  match, restores the account balance. No fuzzy amount/description matching. */
export function useDeleteRentPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, unit_id }: { id: string; unit_id: string }) => {
      const { data: payment } = await (supabase.from('acc_unit_rent_payments' as any) as any)
        .select('*').eq('id', id).maybeSingle();
      if (!payment) return;
      const allocations = ((payment as any).allocations || []) as RentAllocation[];

      for (const a of allocations) {
        const { data: rec } = await (supabase.from('acc_unit_rent_records' as any) as any)
          .select('paid_amount, rent_amount').eq('id', a.record_id).maybeSingle();
        if (!rec) continue;
        const newPaid = Math.max(0, Number((rec as any).paid_amount) - Number(a.amount));
        await supabase.from('acc_unit_rent_records' as any).update({
          paid_amount: newPaid,
          is_paid: newPaid >= Number((rec as any).rent_amount) && Number((rec as any).rent_amount) > 0,
        } as any).eq('id', a.record_id);
      }

      const { data: tx } = await (supabase.from('acc_transactions' as any) as any)
        .select('id, account_id, amount')
        .eq('reference_type', 'acc_unit_rent_payments').eq('reference_id', id).maybeSingle();
      if (tx) {
        await supabase.from('acc_transactions' as any).delete().eq('id', (tx as any).id);
        const { data: acc } = await supabase.from('acc_accounts' as any).select('balance').eq('id', (tx as any).account_id).single();
        if (acc) {
          await supabase.from('acc_accounts' as any)
            .update({ balance: Number((acc as any).balance) + Number((tx as any).amount) } as any)
            .eq('id', (tx as any).account_id);
        }
      }

      await supabase.from('acc_unit_rent_payments' as any).delete().eq('id', id);

      logAccActivity({
        action: 'delete', entity_type: 'rent_payment', entity_id: id,
        entity_name: `৳${(payment as any).amount} ভাড়া পেমেন্ট ডিলিট`,
        old_data: payment as any,
      });
    },
    onSuccess: (_, v) => invalidateRentQueries(qc, v.unit_id),
  });
}

export { CASH_ACCOUNT_ID, BANK_ACCOUNT_ID };
