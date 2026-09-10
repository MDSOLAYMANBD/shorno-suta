import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logAccActivity } from '@/hooks/useAccActivityLog';
import { computeAccruedInterest } from '@/lib/loanInterest';

export interface AccLoan {
  id: string;
  name: string;
  principal_amount: number;
  interest_rate: number;
  total_installments: number;
  monthly_installment: number;
  start_date: string;
  status: string;
  created_at: string;
  unit_id?: string | null;
  loan_type?: string;
  lender_name?: string | null;
  deposit_account_id?: string | null;
  interest_type?: string;
  monthly_interest_amount?: number;
}


export interface AccLoanPayment {
  id: string;
  loan_id: string;
  amount: number;
  payment_date: string;
  payment_source: string;
  account_id: string | null;
  note: string | null;
  created_at: string;
}

export interface AccInvestment {
  id: string;
  amount: number;
  description: string | null;
  date: string;
  source: string;
  created_at: string;
}

export function useLoans(filter?: { unitId?: string | null }) {
  return useQuery({
    queryKey: ['acc-loans', filter?.unitId === undefined ? 'all' : (filter.unitId ?? 'global')],
    queryFn: async () => {
      let q: any = (supabase.from('acc_loans' as any) as any).select('*').order('created_at', { ascending: false });
      if (filter && 'unitId' in filter) {
        if (filter.unitId === null) q = q.is('unit_id', null);
        else if (filter.unitId) q = q.eq('unit_id', filter.unitId);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as AccLoan[];
    },
  });
}

export function useCreateLoan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (loan: Omit<AccLoan, 'id' | 'created_at'> & { unit_id?: string | null; loan_type?: string; lender_name?: string | null; deposit_account_id?: string | null; interest_type?: string; monthly_interest_amount?: number }) => {
      const { data, error } = await (supabase.from('acc_loans' as any) as any).insert(loan).select().single();
      if (error) throw error;

      // Record deposit transaction so live cash/bank balance updates (matches dashboard
      // formula). Same fix as useCreateLoanPayment below: check the error, and if it fails,
      // delete the loan row we just inserted instead of leaving a loan on record with no
      // matching deposit in the cash ledger.
      if (loan.deposit_account_id && Number(loan.principal_amount) > 0) {
        const { data: { session } } = await supabase.auth.getSession();
        const BANK_ID = 'c0831bd8-c223-4663-a051-5b923bdb4256';
        const src = loan.deposit_account_id === BANK_ID ? 'bank' : 'cash';
        const txDate = loan.start_date
          ? new Date(loan.start_date + 'T12:00:00').toISOString()
          : new Date().toISOString();
        const { error: txError } = await (supabase.from('acc_transactions' as any) as any).insert({
          account_id: loan.deposit_account_id,
          unit_id: loan.unit_id || null,
          type: 'deposit',
          amount: Number(loan.principal_amount),
          description: `[ঋণ গ্রহণ] ${loan.lender_name || loan.name}`,
          source: src,
          reference_id: (data as any)?.id,
          reference_type: 'acc_loans',
          created_by: session?.user?.id,
          created_at: txDate,
        });
        if (txError) {
          await (supabase.from('acc_loans' as any) as any).delete().eq('id', (data as any).id);
          throw txError;
        }
      }
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['acc-loans'] });
      qc.invalidateQueries({ queryKey: ['acc-transactions'] });
      qc.invalidateQueries({ queryKey: ['accounting-financials'] });
      qc.invalidateQueries({ queryKey: ['live-cash-bank'] });
    },
  });
}



export function useUpdateLoan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; status?: string }) => {
      const { error } = await (supabase.from('acc_loans' as any) as any).update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['acc-loans'] }),
  });
}

export function useDeleteLoan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Remove each payment's linked expense transaction too, otherwise those stay behind and
      // permanently understate the live cash/bank balance after the loan (and its payments) are gone.
      const { data: payments } = await (supabase.from('acc_loan_payments' as any) as any).select('id').eq('loan_id', id);
      const paymentIds = ((payments || []) as { id: string }[]).map(p => p.id);
      if (paymentIds.length > 0) {
        await (supabase.from('acc_transactions' as any) as any)
          .delete().eq('reference_type', 'acc_loan_payments').in('reference_id', paymentIds);
      }
      await (supabase.from('acc_loan_payments' as any) as any).delete().eq('loan_id', id);
      // Remove the deposit transaction useCreateLoan wrote for this loan's principal, otherwise
      // the amount stays permanently added to the live cash/bank balance after the loan is gone.
      await (supabase.from('acc_transactions' as any) as any)
        .delete().eq('reference_type', 'acc_loans').eq('reference_id', id);
      const { error } = await (supabase.from('acc_loans' as any) as any).delete().eq('id', id);
      if (error) throw error;
      const { data: stillThere } = await (supabase.from('acc_loans' as any) as any).select('id').eq('id', id).maybeSingle();
      if (stillThere) throw new Error('ডিলিট করার অনুমতি নেই');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['acc-loans'] });
      qc.invalidateQueries({ queryKey: ['acc-loan-payment-counts'] });
      qc.invalidateQueries({ queryKey: ['acc-loan-payments'] });
      qc.invalidateQueries({ queryKey: ['acc-transactions'] });
      qc.invalidateQueries({ queryKey: ['accounting-financials'] });
      qc.invalidateQueries({ queryKey: ['live-cash-bank'] });
    },
  });
}

export function useLoanPayments(loanId?: string) {
  return useQuery({
    queryKey: ['acc-loan-payments', loanId],
    enabled: !!loanId,
    queryFn: async () => {
      const { data, error } = await (supabase.from('acc_loan_payments' as any) as any)
        .select('*').eq('loan_id', loanId).order('payment_date', { ascending: false });
      if (error) throw error;
      return (data || []) as AccLoanPayment[];
    },
  });
}

export function useAllLoanPaymentCounts() {
  return useQuery({
    queryKey: ['acc-loan-payment-counts'],
    queryFn: async () => {
      const { data, error } = await (supabase.from('acc_loan_payments' as any) as any).select('loan_id, amount');
      if (error) throw error;
      const counts: Record<string, { count: number; totalPaid: number }> = {};
      for (const row of (data || [])) {
        if (!counts[row.loan_id]) counts[row.loan_id] = { count: 0, totalPaid: 0 };
        counts[row.loan_id].count++;
        counts[row.loan_id].totalPaid += Number(row.amount);
      }
      return counts;
    },
  });
}

export function useCreateLoanPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payment: { loan_id: string; amount: number; payment_date: string; payment_source: string; account_id?: string; note?: string }) => {
      const { data, error } = await (supabase.from('acc_loan_payments' as any) as any).insert(payment).select().single();
      if (error) throw error;

      // Record expense transaction so live cash/bank balance updates (matches dashboard formula).
      // This insert previously wasn't error-checked, so a failure here (network blip, RLS
      // hiccup, etc.) silently left a "paid" loan_payments row with no matching cash-ledger
      // entry and no unit/tag info in the daily transaction list. Now: check the error, and
      // if it fails, delete the loan_payments row we just inserted rather than leave the two
      // tables out of sync (no multi-table transaction available from the client).
      if (payment.account_id && payment.amount > 0) {
        const { data: { session } } = await supabase.auth.getSession();
        const BANK_ID = 'c0831bd8-c223-4663-a051-5b923bdb4256';
        const src = payment.account_id === BANK_ID ? 'bank' : 'cash';
        const txDate = payment.payment_date
          ? new Date(payment.payment_date + 'T12:00:00').toISOString()
          : new Date().toISOString();
        const { data: loan } = await (supabase.from('acc_loans' as any) as any)
          .select('unit_id, lender_name, name').eq('id', payment.loan_id).maybeSingle();
        const lenderLabel = (loan as any)?.lender_name || (loan as any)?.name || '';
        const { error: txError } = await (supabase.from('acc_transactions' as any) as any).insert({
          account_id: payment.account_id,
          unit_id: (loan as any)?.unit_id || null,
          type: 'expense',
          amount: payment.amount,
          description: `[ঋণ পরিশোধ] ${lenderLabel}${payment.note ? ': ' + payment.note : ''}`,
          source: src,
          reference_id: (data as any)?.id,
          reference_type: 'acc_loan_payments',
          created_by: session?.user?.id,
          created_at: txDate,
        });
        if (txError) {
          await (supabase.from('acc_loan_payments' as any) as any).delete().eq('id', (data as any).id);
          throw txError;
        }
      }

      // Auto-complete loan if total paid >= principal + interest accrued so far
      try {
        const { data: loan } = await (supabase.from('acc_loans' as any) as any)
          .select('principal_amount, status, interest_type, monthly_interest_amount, start_date').eq('id', payment.loan_id).maybeSingle();
        if (loan && loan.status === 'active') {
          const { data: allPayments } = await (supabase.from('acc_loan_payments' as any) as any)
            .select('amount').eq('loan_id', payment.loan_id);
          const totalPaid = (allPayments || []).reduce((s: number, p: any) => s + Number(p.amount), 0);
          const owed = Number(loan.principal_amount) + computeAccruedInterest(loan as any);
          if (totalPaid >= owed) {
            await (supabase.from('acc_loans' as any) as any)
              .update({ status: 'completed' }).eq('id', payment.loan_id);
          }
        }
      } catch { /* non-fatal */ }

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['acc-loan-payments'] });
      qc.invalidateQueries({ queryKey: ['acc-loan-payment-counts'] });
      qc.invalidateQueries({ queryKey: ['acc-loans'] });
      qc.invalidateQueries({ queryKey: ['acc-transactions'] });
      qc.invalidateQueries({ queryKey: ['accounting-financials'] });
      qc.invalidateQueries({ queryKey: ['live-cash-bank'] });
    },
  });
}

// Reverses a loan payment: deletes its linked acc_transactions row (restoring
// the account balance it had reduced) and the acc_loan_payments row itself,
// then reopens the loan if it had been auto-completed and this delete brings
// the total paid back below principal. Needed because a duplicate payment
// (e.g. an accidental double-tap on "পরিশোধ করুন") had no way to be removed
// from the UI before this — same reversal pattern as useDeleteRentPayment.
export function useDeleteLoanPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, loan_id }: { id: string; loan_id: string }) => {
      const { data: payment } = await (supabase.from('acc_loan_payments' as any) as any)
        .select('*').eq('id', id).maybeSingle();
      if (!payment) return;

      const { data: tx } = await (supabase.from('acc_transactions' as any) as any)
        .select('id, account_id, amount')
        .eq('reference_type', 'acc_loan_payments').eq('reference_id', id).maybeSingle();
      if (tx) {
        await supabase.from('acc_transactions' as any).delete().eq('id', (tx as any).id);
        const { data: acc } = await supabase.from('acc_accounts' as any).select('balance').eq('id', (tx as any).account_id).single();
        if (acc) {
          await supabase.from('acc_accounts' as any)
            .update({ balance: Number((acc as any).balance) + Number((tx as any).amount) } as any)
            .eq('id', (tx as any).account_id);
        }
      }

      await supabase.from('acc_loan_payments' as any).delete().eq('id', id);

      // Reopen the loan if this delete brings total paid back below what's owed
      const { data: loan } = await (supabase.from('acc_loans' as any) as any)
        .select('principal_amount, status, interest_type, monthly_interest_amount, start_date').eq('id', loan_id).maybeSingle();
      if (loan && loan.status === 'completed') {
        const { data: remaining } = await (supabase.from('acc_loan_payments' as any) as any)
          .select('amount').eq('loan_id', loan_id);
        const totalPaid = (remaining || []).reduce((s: number, p: any) => s + Number(p.amount), 0);
        const owed = Number(loan.principal_amount) + computeAccruedInterest(loan as any);
        if (totalPaid < owed) {
          await (supabase.from('acc_loans' as any) as any).update({ status: 'active' }).eq('id', loan_id);
        }
      }

      logAccActivity({
        action: 'delete', entity_type: 'loan_payment', entity_id: id,
        entity_name: `৳${(payment as any).amount} ঋণ পরিশোধ ডিলিট`,
        old_data: payment as any,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['acc-loan-payments'] });
      qc.invalidateQueries({ queryKey: ['acc-loan-payment-counts'] });
      qc.invalidateQueries({ queryKey: ['acc-loans'] });
      qc.invalidateQueries({ queryKey: ['acc-transactions'] });
      qc.invalidateQueries({ queryKey: ['accounting-financials'] });
      qc.invalidateQueries({ queryKey: ['live-cash-bank'] });
    },
  });
}

export function useInvestments() {
  return useQuery({
    queryKey: ['acc-investments'],
    queryFn: async () => {
      const { data, error } = await (supabase.from('acc_investments' as any) as any).select('*').order('date', { ascending: false });
      if (error) throw error;
      return (data || []) as AccInvestment[];
    },
  });
}

export function useCreateInvestment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (inv: { amount: number; description?: string; date: string; source: string }) => {
      const { data, error } = await (supabase.from('acc_investments' as any) as any).insert(inv).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['acc-investments'] }),
  });
}

export function useStockValuation() {
  return useQuery({
    queryKey: ['stock-valuation'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('id, name, stock, price, images').gt('stock', 0).order('name');
      if (error) throw error;
      const rows = (data || []) as { id: string; name: string; stock: number; price: number; images: string[] }[];
      const costMap: Record<string, number> = {};
      try {
        if (rows.length > 0) {
          const { data: costs } = await (supabase.rpc as any)('get_product_cost_prices', { p_ids: rows.map(r => r.id) });
          for (const c of (costs || [])) costMap[c.id] = Number(c.cost_price) || 0;
        }
      } catch { /* graceful: no cost access */ }
      return rows.map(r => ({ ...r, cost_price: costMap[r.id] || 0 }));
    },
  });
}
