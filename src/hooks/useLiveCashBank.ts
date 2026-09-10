import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAllSettings } from '@/hooks/useAllSettings';
import { fetchAllRows } from '@/lib/supabaseHelpers';

// Canonical fixed cash/bank account IDs (same as AdminAccounting.tsx)
export const CASH_ACCOUNT_ID = '266fdf05-43ef-4dc6-8660-842a958df62e';
export const BANK_ACCOUNT_ID = 'c0831bd8-c223-4663-a051-5b923bdb4256';
const COURIER_PAYMENT_CUTOFF = '2026-03-17';
const OFFICE_SELL_CUTOFF = '2026-03-17T00:00:00';
const DEBIT_TYPES = ['salary', 'production_payment', 'party_payment', 'expense', 'advance', 'bonus'];

export interface LiveCashBank {
  cash: number;
  bank: number;
}

/**
 * Returns the SAME live cash/bank balance shown on the AdminAccounting dashboard.
 * Mirrors the financials calculation in AdminAccounting.tsx exactly.
 * The acc_accounts.balance column is intentionally NOT used (stale/incorrect).
 */
export function useLiveCashBank() {
  const { data: allSettings } = useAllSettings();

  let bizOpeningCash = 0;
  let bizOpeningBank = 0;
  try {
    const parsed = JSON.parse(allSettings?.acc_business_config || '{}');
    bizOpeningCash = parsed.opening_balance_cash ?? parsed.opening_balance ?? 0;
    bizOpeningBank = parsed.opening_balance_bank ?? 0;
  } catch { /* noop */ }

  return useQuery({
    queryKey: ['live-cash-bank', bizOpeningCash, bizOpeningBank],
    queryFn: async (): Promise<LiveCashBank> => {
      // Courier payments — cutoff applied
      const { data: cpData } = await supabase
        .from('courier_payments')
        .select('bank_amount, cash_amount, receive_method, date, created_at');
      const counted = (cpData || []).filter((r: any) =>
        r.receive_method && ((r.date || r.created_at || '') >= COURIER_PAYMENT_CUTOFF));
      const totalBank = counted.reduce((s: number, r: any) => s + (Number(r.bank_amount) || 0), 0);
      const totalCash = counted.reduce((s: number, r: any) => s + (Number(r.cash_amount) || 0), 0);

      // Transactions — use same resolver and rules as AdminAccounting
      const txs = await fetchAllRows<{ type: string; amount: number; source: string | null; account_id: string; created_at: string }>(
        () => (supabase.from('acc_transactions' as any) as any).select('type, amount, source, account_id, created_at')
      );

      const resolveSource = (tx: { source: string | null; account_id: string }): 'cash' | 'bank' => {
        if (tx.account_id === BANK_ACCOUNT_ID) return 'bank';
        if (tx.source === 'bank') return 'bank';
        if (tx.source === 'cash') return 'cash';
        return 'cash';
      };

      let cashExpenses = 0, bankExpenses = 0;
      let transferOutBank = 0, transferOutCash = 0;
      let officeSellBank = 0, officeSellCash = 0;
      let depositBank = 0, depositCash = 0;

      for (const tx of txs) {
        const amt = Number(tx.amount) || 0;
        const src = resolveSource(tx);
        if (DEBIT_TYPES.includes(tx.type)) {
          if (src === 'cash') cashExpenses += amt; else bankExpenses += amt;
        } else if (tx.type === 'courier_withdrawal') {
          if (src === 'bank') transferOutBank += amt; else transferOutCash += amt;
        } else if (tx.type === 'sale' && tx.created_at >= OFFICE_SELL_CUTOFF) {
          if (src === 'bank') officeSellBank += amt; else officeSellCash += amt;
        } else if (tx.type === 'deposit') {
          if (src === 'bank') depositBank += amt; else depositCash += amt;
        }
      }

      const bank = totalBank - bankExpenses - transferOutBank + transferOutCash
        + officeSellBank + depositBank + bizOpeningBank;
      const cash = totalCash - cashExpenses - transferOutCash + transferOutBank
        + officeSellCash + depositCash + bizOpeningCash;

      return { cash, bank };
    },
  });
}
