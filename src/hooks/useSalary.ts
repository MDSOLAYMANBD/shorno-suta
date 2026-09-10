import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logAccActivity } from '@/hooks/useAccActivityLog';

export interface AccSalaryRecord {
  id: string;
  person_id: string;
  month: number;
  year: number;
  working_days: number;
  present_days: number;
  absent_days: number;
  off_days: number;
  base_salary: number;
  deduction: number;
  final_salary: number;
  bonus_amount?: number;
  bonus_note?: string | null;
  overtime_amount?: number;
  overtime_note?: string | null;
  received_amount?: number;
  received_note?: string | null;
  advance_amount?: number;
  advance_note?: string | null;
  paid_amount: number;
  is_paid: boolean;
  paid_at: string | null;
  transaction_id: string | null;
  created_at: string;
  acc_persons?: { name: string; type: string; unit_id: string | null; joining_date?: string | null } | null;
}

export function isSalaryMonthBeforeJoining(month: number, year: number, joiningDate?: string | null): boolean {
  if (!joiningDate) return false;
  const [joinYear, joinMonth] = joiningDate.slice(0, 10).split('-').map(Number);
  if (!joinYear || !joinMonth) return false;
  return year < joinYear || (year === joinYear && month < joinMonth);
}

export function useSalaryRecords(month: number, year: number) {
  return useQuery({
    queryKey: ['acc-salary-records', month, year],
    queryFn: async () => {
      const { data, error } = await (supabase.from('acc_salary_records' as any) as any)
        .select('*, acc_persons(name, type, unit_id, joining_date)')
        .eq('month', month)
        .eq('year', year)
        .order('created_at');
      if (error) throw error;
      return (data || []).filter((r: any) => !isSalaryMonthBeforeJoining(r.month, r.year, r.acc_persons?.joining_date)) as AccSalaryRecord[];
    },
  });
}

export function useAdvanceTotal(personId: string | undefined, month: number, year: number) {
  return useQuery({
    queryKey: ['acc-advance-total', personId, month, year],
    queryFn: async () => {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endMonth = month === 12 ? 1 : month + 1;
      const endYear = month === 12 ? year + 1 : year;
      const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

      const { data, error } = await (supabase.from('acc_transactions' as any) as any)
        .select('amount')
        .eq('person_id', personId)
        .eq('type', 'advance')
        .gte('created_at', startDate)
        .lt('created_at', endDate);
      if (error) throw error;
      return (data || []).reduce((s: number, r: any) => s + Number(r.amount), 0);
    },
    enabled: !!personId,
  });
}

/** Convert YYYY-MM-DD date string to ISO timestamp preserving current time, so chronological order within a day is maintained. */
function dateStrToIso(dateStr?: string): string | undefined {
  if (!dateStr) return undefined;
  const time = new Date().toTimeString().slice(0, 8);
  return new Date(`${dateStr}T${time}`).toISOString();
}

export function usePayBonus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ person_id, amount, account_id, payment_date }: {
      person_id: string; amount: number; account_id: string; payment_date?: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const createdAt = dateStrToIso(payment_date);

      // Create bonus transaction
      const { error: txErr } = await supabase.from('acc_transactions' as any).insert({
        account_id,
        person_id,
        type: 'bonus',
        amount,
        description: 'বোনাস প্রদান',
        created_by: session?.user?.id,
        ...(createdAt ? { created_at: createdAt } : {}),
      } as any);
      if (txErr) throw txErr;

      // Update account balance
      const { data: acc } = await supabase.from('acc_accounts' as any).select('balance').eq('id', account_id).single();
      if (acc) {
        const newBalance = Number((acc as any).balance) - amount;
        await supabase.from('acc_accounts' as any).update({ balance: newBalance } as any).eq('id', account_id);
      }

      logAccActivity({
        action: 'create', entity_type: 'transaction',
        entity_name: `৳${amount} বোনাস প্রদান`,
        description: 'বোনাস প্রদান',
        new_data: { account_id, person_id, type: 'bonus', amount },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['acc-salary-records'] });
      qc.invalidateQueries({ queryKey: ['acc-accounts'] });
      qc.invalidateQueries({ queryKey: ['acc-transactions'] });
    },
  });
}

export function useMonthlySalarySummary(personId?: string, joiningDate?: string | null) {
  return useQuery({
    queryKey: ['acc-monthly-salary-summary', personId, joiningDate],
    queryFn: async () => {
      // Get all salary records for this person
      const { data: records } = await (supabase.from('acc_salary_records' as any) as any)
        .select('*')
        .eq('person_id', personId)
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      // Get all transactions for this person
      const { data: txData } = await (supabase.from('acc_transactions' as any) as any)
        .select('type, amount, created_at')
        .eq('person_id', personId)
        .in('type', ['salary', 'advance', 'bonus']);

      return {
        salaryRecords: (records || []).filter((r: any) => !isSalaryMonthBeforeJoining(r.month, r.year, joiningDate)) as any[],
        transactions: (txData || []) as any[],
      };
    },
    enabled: !!personId,
  });
}

export function useGenerateSalary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ person_id, month, year, working_days, present_days, absent_days, off_days, base_salary, deduction, final_salary }: {
      person_id: string; month: number; year: number;
      working_days: number; present_days: number; absent_days: number; off_days: number;
      base_salary: number; deduction: number; final_salary: number;
    }) => {
      const { data: person } = await (supabase.from('acc_persons' as any) as any)
        .select('joining_date')
        .eq('id', person_id)
        .maybeSingle();
      if (isSalaryMonthBeforeJoining(month, year, (person as any)?.joining_date)) {
        throw new Error('যোগদানের আগের মাসের বেতন জেনারেট করা যাবে না');
      }

      // Preserve existing bonus/overtime adjustments (they add to final_salary)
      // AND the existing paid_amount/advance_amount — those are only ever
      // written by allocatePaymentToSalaryRecords/usePaySalary (the real,
      // waterfall-aware payment tracking). Recomputing "paid" here from this
      // month's calendar-dated advance transactions used to silently clobber
      // whatever the waterfall had correctly allocated, e.g. a payment given
      // in August that rightly settled July's debt would get wiped back to
      // ৳0 the next time July's attendance was regenerated.
      const { data: existing } = await (supabase.from('acc_salary_records' as any) as any)
        .select('bonus_amount, overtime_amount, bonus_note, overtime_note, paid_amount, advance_amount')
        .eq('person_id', person_id).eq('month', month).eq('year', year).maybeSingle();
      const bonusAmt = Number((existing as any)?.bonus_amount || 0);
      const overtimeAmt = Number((existing as any)?.overtime_amount || 0);
      const adjustedFinal = final_salary + bonusAmt + overtimeAmt;

      const paidAmount = Number((existing as any)?.paid_amount || 0);
      const advanceAmt = Number((existing as any)?.advance_amount || 0);
      const isPaid = (paidAmount + advanceAmt) >= adjustedFinal && adjustedFinal > 0;

      const { data, error } = await supabase.from('acc_salary_records' as any).upsert({
        person_id, month, year, working_days, present_days, absent_days, off_days,
        base_salary, deduction, final_salary: adjustedFinal,
        bonus_amount: bonusAmt,
        overtime_amount: overtimeAmt,
        bonus_note: (existing as any)?.bonus_note ?? null,
        overtime_note: (existing as any)?.overtime_note ?? null,
        paid_amount: paidAmount,
        is_paid: isPaid,
        paid_at: isPaid ? new Date().toISOString() : null,
      } as any, { onConflict: 'person_id,month,year' }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['acc-salary-records'] });
      qc.invalidateQueries({ queryKey: ['acc-advance-total'] });
    },
  });
}

export function usePaySalary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ salary_record_id, person_id, amount, account_id, final_salary, payment_date, person_name }: {
      salary_record_id: string; person_id: string; amount: number; account_id: string; final_salary: number; payment_date?: string; person_name?: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const createdAt = dateStrToIso(payment_date);

      // Create transaction
      const { data: tx, error: txErr } = await supabase.from('acc_transactions' as any).insert({
        account_id,
        person_id,
        type: 'salary',
        amount,
        description: 'বেতন প্রদান',
        created_by: session?.user?.id,
        ...(createdAt ? { created_at: createdAt } : {}),
      } as any).select().single();
      if (txErr) throw txErr;

      // Update account balance
      const { data: acc } = await supabase.from('acc_accounts' as any).select('balance').eq('id', account_id).single();
      if (acc) {
        const newBalance = Number((acc as any).balance) - amount;
        await supabase.from('acc_accounts' as any).update({ balance: newBalance } as any).eq('id', account_id);
      }

      // Get current paid_amount (advance counts toward settlement)
      const { data: currentRecord } = await supabase.from('acc_salary_records' as any).select('paid_amount, advance_amount').eq('id', salary_record_id).single();
      const currentPaid = Number((currentRecord as any)?.paid_amount || 0);
      const advanceAmt = Number((currentRecord as any)?.advance_amount || 0);
      const newPaidAmount = currentPaid + amount;
      const fullyPaid = (newPaidAmount + advanceAmt) >= final_salary;

      // Update salary record
      const { error } = await supabase.from('acc_salary_records' as any).update({
        paid_amount: newPaidAmount,
        is_paid: fullyPaid,
        paid_at: fullyPaid ? (createdAt || new Date().toISOString()) : null,
        transaction_id: (tx as any).id,
      } as any).eq('id', salary_record_id);
      if (error) throw error;

      logAccActivity({
        action: 'create', entity_type: 'transaction',
        entity_name: `৳${amount} বেতন প্রদান${person_name ? ` (${person_name})` : ''}`,
        description: 'বেতন প্রদান',
        new_data: { account_id, person_id, type: 'salary', amount, salary_record_id, person_name },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['acc-salary-records'] });
      qc.invalidateQueries({ queryKey: ['acc-accounts'] });
      qc.invalidateQueries({ queryKey: ['acc-transactions'] });
    },
  });
}

// Applies a payment (advance or expense given to a person) against their
// oldest unpaid salary month first, spilling into newer months in order
// until the amount runs out — so giving ৳20,000 against two ৳15,000 months
// owed clears the older one fully and the next one partially, instead of
// leaving every month's card showing the full amount still due regardless
// of what's actually been paid.
export async function allocatePaymentToSalaryRecords(personId: string, amount: number) {
  if (!personId || !amount || amount <= 0) return;

  const { data: person } = await (supabase.from('acc_persons' as any) as any)
    .select('name, base_salary, joining_date').eq('id', personId).maybeSingle();
  const joiningDate = (person as any)?.joining_date ?? null;
  const baseSalary = Number((person as any)?.base_salary || 0);
  const personName = (person as any)?.name || '';

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const { data: recordsRaw } = await (supabase.from('acc_salary_records' as any) as any)
    .select('*')
    .eq('person_id', personId)
    .order('year', { ascending: true })
    .order('month', { ascending: true });

  let records = ((recordsRaw || []) as any[]).filter(
    (r) => !isSalaryMonthBeforeJoining(r.month, r.year, joiningDate)
  );

  // Materialize EVERY month from joining through the running month before
  // walking the waterfall — not just the current one. A month that simply
  // hasn't been touched yet (attendance not closed, no bonus/advance saved
  // against it) has no row at all, and the old "only ensure current month"
  // logic let the waterfall silently skip straight over such a gap and pay
  // a later month instead, breaking the oldest-first guarantee.
  const monthsToEnsure: { year: number; month: number }[] = [];
  if (joiningDate) {
    const joinYear = Number(String(joiningDate).slice(0, 4));
    const joinMonth = Number(String(joiningDate).slice(5, 7));
    let y = joinYear, m = joinMonth;
    while (y < currentYear || (y === currentYear && m <= currentMonth)) {
      monthsToEnsure.push({ year: y, month: m });
      m += 1;
      if (m > 12) { m = 1; y += 1; }
    }
  } else {
    monthsToEnsure.push({ year: currentYear, month: currentMonth });
  }

  for (const { year, month } of monthsToEnsure) {
    if (records.find((r) => r.year === year && r.month === month)) continue;
    const totalDays = new Date(year, month, 0).getDate();
    const { data: inserted } = await supabase.from('acc_salary_records' as any).insert({
      person_id: personId, month, year,
      working_days: totalDays, present_days: 0, absent_days: 0, off_days: 0,
      base_salary: baseSalary, deduction: 0, final_salary: baseSalary,
      paid_amount: 0, is_paid: false,
    } as any).select().single();
    if (inserted) records.push(inserted);
  }
  records.sort((a, b) => a.year - b.year || a.month - b.month);
  let currentRecord = records.find((r) => r.year === currentYear && r.month === currentMonth);

  let remaining = amount;
  const appliedTo: string[] = [];
  for (const rec of records) {
    if (remaining <= 0) break;
    const due = Number(rec.final_salary) - Number(rec.paid_amount || 0) - Number(rec.advance_amount || 0);
    if (due <= 0) continue;
    const apply = Math.min(remaining, due);
    const newPaid = Number(rec.paid_amount || 0) + apply;
    const fullyPaid = (newPaid + Number(rec.advance_amount || 0)) >= Number(rec.final_salary);
    await supabase.from('acc_salary_records' as any).update({
      paid_amount: newPaid,
      is_paid: fullyPaid,
      paid_at: fullyPaid ? new Date().toISOString() : rec.paid_at,
    } as any).eq('id', rec.id);
    appliedTo.push(`${rec.month}/${rec.year}: ৳${apply}`);
    remaining -= apply;
  }

  // Paid more than everything currently owed (including this running month)
  // — park the extra as an advance credit on the current month instead of
  // silently discarding it.
  if (remaining > 0 && currentRecord) {
    const { data: fresh } = await supabase.from('acc_salary_records' as any)
      .select('paid_amount, advance_amount, final_salary').eq('id', currentRecord.id).single();
    const newAdvance = Number((fresh as any)?.advance_amount || 0) + remaining;
    const fullyPaid = (Number((fresh as any)?.paid_amount || 0) + newAdvance) >= Number((fresh as any)?.final_salary || 0);
    await supabase.from('acc_salary_records' as any).update({
      advance_amount: newAdvance,
      is_paid: fullyPaid,
      paid_at: fullyPaid ? new Date().toISOString() : null,
    } as any).eq('id', currentRecord.id);
    appliedTo.push(`অগ্রিম জমা: ৳${remaining}`);
  }

  if (appliedTo.length > 0) {
    logAccActivity({
      action: 'update', entity_type: 'salary',
      entity_name: `৳${amount} বেতনের বিপরীতে জমা${personName ? ` (${personName})` : ''}`,
      description: appliedTo.join(', '),
      new_data: { person_id: personId, person_name: personName, amount, applied: appliedTo },
    });
  }
}

export function useSalaryIncrements(personId?: string) {
  return useQuery({
    queryKey: ['acc-salary-increments', personId],
    queryFn: async () => {
      let q = (supabase.from('acc_salary_increments' as any) as any).select('*').order('effective_date', { ascending: false });
      if (personId) q = q.eq('person_id', personId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: personId ? true : false,
  });
}

export function useCreateIncrement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (inc: { person_id: string; old_salary: number; new_salary: number; effective_date: string; note?: string }) => {
      const { error: incErr } = await supabase.from('acc_salary_increments' as any).insert(inc as any);
      if (incErr) throw incErr;
      const { error } = await supabase.from('acc_persons' as any).update({ base_salary: inc.new_salary } as any).eq('id', inc.person_id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['acc-salary-increments'] });
      qc.invalidateQueries({ queryKey: ['acc-persons'] });
      qc.invalidateQueries({ queryKey: ['acc-person'] });
      qc.invalidateQueries({ queryKey: ['acc-monthly-salary-summary'] });
    },
  });
}

export function useUpdateIncrement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, person_id, new_salary, effective_date, note }: { id: string; person_id: string; new_salary: number; effective_date: string; note?: string | null }) => {
      const { error: upErr } = await supabase.from('acc_salary_increments' as any)
        .update({ new_salary, effective_date, note: note ?? null } as any).eq('id', id);
      if (upErr) throw upErr;
      const { data: rows } = await (supabase.from('acc_salary_increments' as any) as any)
        .select('id, new_salary, effective_date').eq('person_id', person_id)
        .order('effective_date', { ascending: false }).limit(1);
      const latest = (rows || [])[0];
      if (latest && latest.id === id) {
        const { error } = await supabase.from('acc_persons' as any).update({ base_salary: new_salary } as any).eq('id', person_id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['acc-salary-increments'] });
      qc.invalidateQueries({ queryKey: ['acc-persons'] });
      qc.invalidateQueries({ queryKey: ['acc-person'] });
      qc.invalidateQueries({ queryKey: ['acc-monthly-salary-summary'] });
    },
  });
}

export function useDeleteIncrement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, person_id }: { id: string; person_id: string }) => {
      const { data: target } = await (supabase.from('acc_salary_increments' as any) as any)
        .select('id, old_salary').eq('id', id).maybeSingle();
      const { error: delErr } = await supabase.from('acc_salary_increments' as any).delete().eq('id', id);
      if (delErr) throw delErr;
      const { data: stillThere } = await (supabase.from('acc_salary_increments' as any) as any)
        .select('id').eq('id', id).maybeSingle();
      if (stillThere) throw new Error('ডিলিট হয়নি — অনুমতি নেই');
      const { data: remaining } = await (supabase.from('acc_salary_increments' as any) as any)
        .select('new_salary, effective_date').eq('person_id', person_id)
        .order('effective_date', { ascending: false }).limit(1);
      const newBase = (remaining || [])[0]?.new_salary ?? (target as any)?.old_salary;
      if (newBase != null) {
        const { error } = await supabase.from('acc_persons' as any).update({ base_salary: newBase } as any).eq('id', person_id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['acc-salary-increments'] });
      qc.invalidateQueries({ queryKey: ['acc-persons'] });
      qc.invalidateQueries({ queryKey: ['acc-person'] });
      qc.invalidateQueries({ queryKey: ['acc-monthly-salary-summary'] });
    },
  });
}

export function useUpdateSalaryRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...changes }: {
      id: string;
      working_days?: number;
      present_days?: number;
      absent_days?: number;
      off_days?: number;
      base_salary?: number;
      deduction?: number;
      final_salary: number;
      bonus_amount?: number;
      bonus_note?: string | null;
      overtime_amount?: number;
      overtime_note?: string | null;
      received_amount?: number;
      received_note?: string | null;
      advance_amount?: number;
      advance_note?: string | null;
    }) => {
      // Get current record to check paid status (paid + advance counts as settled)
      const { data: current } = await supabase.from('acc_salary_records' as any).select('paid_amount, advance_amount').eq('id', id).single();
      const paidAmount = Number((current as any)?.paid_amount || 0);
      const advanceAmount = Number((changes as any).advance_amount ?? (current as any)?.advance_amount ?? 0);
      const effectivePaid = paidAmount + advanceAmount;
      const isPaid = effectivePaid >= changes.final_salary && changes.final_salary > 0;

      const { error } = await supabase.from('acc_salary_records' as any).update({
        ...changes,
        is_paid: isPaid,
        paid_at: isPaid ? new Date().toISOString() : null,
      } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['acc-salary-records'] });
    },
  });
}

export function usePersonFinancialSummary(personId?: string, isActive?: boolean, joiningDate?: string | null) {
  return useQuery({
    queryKey: ['acc-person-financial', personId, isActive, joiningDate],
    queryFn: async () => {
      const { data: salaryData } = await (supabase.from('acc_salary_records' as any) as any)
        .select('final_salary, bonus_amount, overtime_amount, month, year')
        .eq('person_id', personId);
      const now = new Date();
      const currentM = now.getMonth() + 1;
      const currentY = now.getFullYear();
      // Completed months — full final_salary (already includes bonus/overtime)
      const validSalaryData = (salaryData || []).filter((r: any) => !isSalaryMonthBeforeJoining(r.month, r.year, joiningDate));
      const completedRecords = isActive === false
        ? validSalaryData
        : validSalaryData.filter((r: any) =>
            r.year < currentY || (r.year === currentY && r.month < currentM)
          );
      let totalSalary = completedRecords.reduce((s: number, r: any) => s + Number(r.final_salary), 0);

      // Current month (active person) — base attendance isn't earned yet,
      // but bonus/overtime adjustments ARE owed right now, so add them in.
      if (isActive !== false) {
        const currentRec = validSalaryData.find((r: any) => r.year === currentY && r.month === currentM);
        if (currentRec) {
          totalSalary += Number(currentRec.bonus_amount || 0) + Number(currentRec.overtime_amount || 0);
        }
      }

      // Scope to the current employment stint only — a rejoined person's
      // transactions from a previous (already-settled) stint must not bleed
      // into this period's balance, even though they stay in the DB as history.
      let txQuery = (supabase.from('acc_transactions' as any) as any)
        .select('amount')
        .eq('person_id', personId)
        .in('type', ['salary', 'expense', 'advance', 'bonus']);
      if (joiningDate) txQuery = txQuery.gte('created_at', joiningDate);
      const { data: txData } = await txQuery;
      const submission = (txData || []).reduce((s: number, r: any) => s + Number(r.amount), 0);

      const equale = totalSalary - submission;

      return { equale, submission, totalSalary };
    },
    enabled: !!personId,
  });
}

export interface PersonPastStint {
  /** Date the stint was closed (settled), yyyy-MM-dd. */
  settleDate: string;
  /** Date the PREVIOUS stint closed, if any — this stint's data starts right after it. null = from the beginning of all records. */
  startDate: string | null;
  totalSalary: number;
  submission: number;
  /** totalSalary - submission. Positive = still owed to them at close; negative = they'd taken more than earned. */
  equale: number;
  workedDays: number;
  presentDays: number;
  offDays: number;
  lateDays: number;
  note: string;
}

// Reconstructs closed (settled) employment stints from the settlement activity
// log + the person's full salary/transaction/attendance history, bucketed by
// each settlement's close date. Used so a rejoined person's PREVIOUS stint —
// whose joining_date got overwritten by the rejoin — still shows a summary
// card instead of disappearing entirely from their history.
export function usePersonPastStints(personId?: string) {
  return useQuery({
    queryKey: ['acc-person-past-stints', personId],
    enabled: !!personId,
    queryFn: async (): Promise<PersonPastStint[]> => {
      const { data: logs } = await (supabase.from('acc_activity_logs' as any) as any)
        .select('*')
        .eq('entity_id', personId)
        .eq('entity_type', 'person')
        .in('action', ['settlement', 'settlement_update'])
        .order('created_at', { ascending: true });

      // settlement_update amends an existing close rather than creating a new
      // one — keep only the latest log per distinct settle_date.
      const bySettleDate = new Map<string, any>();
      (logs || []).forEach((l: any) => {
        const sd = (l.new_data as any)?.settle_date;
        if (sd) bySettleDate.set(sd, l);
      });
      const settleDates = Array.from(bySettleDate.keys()).sort();
      if (settleDates.length === 0) return [];

      const [{ data: salaryData }, { data: txData }, { data: attData }] = await Promise.all([
        (supabase.from('acc_salary_records' as any) as any).select('final_salary, month, year').eq('person_id', personId),
        (supabase.from('acc_transactions' as any) as any).select('amount, created_at').eq('person_id', personId).in('type', ['salary', 'expense', 'advance', 'bonus']),
        (supabase.from('acc_attendance' as any) as any).select('date, status').eq('person_id', personId),
      ]);

      const toYM = (y: number, m: number) => y * 12 + m;
      const ymOf = (dateStr: string) => {
        const [y, m] = dateStr.slice(0, 7).split('-').map(Number);
        return toYM(y, m);
      };

      let prevSettleDate: string | null = null;
      return settleDates.map((settleDate) => {
        const log = bySettleDate.get(settleDate);
        const startYM = prevSettleDate ? ymOf(prevSettleDate) : -Infinity;
        const endYM = ymOf(settleDate);

        const stintSalary = (salaryData || []).filter((r: any) => {
          const ym = toYM(r.year, r.month);
          return ym > startYM && ym <= endYM;
        });
        const totalSalary = stintSalary.reduce((s: number, r: any) => s + Number(r.final_salary), 0);

        const inStintRange = (dateStr: string) =>
          (!prevSettleDate || dateStr > prevSettleDate) && dateStr <= settleDate;

        const stintTx = (txData || []).filter((r: any) => inStintRange(String(r.created_at).slice(0, 10)));
        const submission = stintTx.reduce((s: number, r: any) => s + Number(r.amount), 0);

        const stintAtt = (attData || []).filter((r: any) => inStintRange(r.date));
        const presentDays = stintAtt.filter((a: any) => a.status === 'present').length;
        const offDays = stintAtt.filter((a: any) => a.status === 'off_day').length;
        const lateDays = stintAtt.filter((a: any) => a.status === 'late').length;

        const note = (log?.description && log.description !== 'হিসাব শেষ করা হয়েছে') ? log.description : ((log?.new_data as any)?.note || '');

        const stint: PersonPastStint = {
          settleDate,
          startDate: prevSettleDate,
          totalSalary,
          submission,
          equale: totalSalary - submission,
          workedDays: presentDays + offDays + lateDays,
          presentDays,
          offDays,
          lateDays,
          note,
        };
        prevSettleDate = settleDate;
        return stint;
      });
    },
  });
}
