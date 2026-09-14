import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AccSnapshotStockItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
}

export interface AccSnapshotPartyDue {
  id: string;
  person_id: string | null;
  party_name: string;
  amount: number;
}

export interface AccSnapshotLoanDue {
  id: string;
  loan_id: string | null;
  loan_name: string;
  amount: number;
}

export interface AccSnapshot {
  id: string;
  snapshot_date: string;
  label: string;
  cash_amount: number;
  bank_amount: number;
  notes: string | null;
  created_at: string;
  stock_items: AccSnapshotStockItem[];
  party_dues: AccSnapshotPartyDue[];
  loan_dues: AccSnapshotLoanDue[];
  stock_value: number;
  total_party_dues: number;
  total_loan_dues: number;
  net_worth: number;
  /** null for the earliest snapshot — nothing to compare it against. */
  profit_loss: number | null;
}

function computeDerived(rows: Omit<AccSnapshot, 'stock_value' | 'total_party_dues' | 'total_loan_dues' | 'net_worth' | 'profit_loss'>[]): AccSnapshot[] {
  const sorted = [...rows].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date) || a.created_at.localeCompare(b.created_at));
  let prevNetWorth: number | null = null;
  return sorted.map((s) => {
    const stock_value = s.stock_items.reduce((sum, it) => sum + Number(it.quantity) * Number(it.unit_price), 0);
    const total_party_dues = s.party_dues.reduce((sum, d) => sum + Number(d.amount), 0);
    const total_loan_dues = s.loan_dues.reduce((sum, d) => sum + Number(d.amount), 0);
    const net_worth = Number(s.cash_amount) + Number(s.bank_amount) + stock_value - total_party_dues - total_loan_dues;
    const profit_loss = prevNetWorth === null ? null : net_worth - prevNetWorth;
    prevNetWorth = net_worth;
    return { ...s, stock_value, total_party_dues, total_loan_dues, net_worth, profit_loss };
  });
}

export function useSnapshots() {
  return useQuery({
    queryKey: ['acc-snapshots'],
    queryFn: async () => {
      const { data, error } = await (supabase.from('acc_snapshots' as any) as any)
        .select('*, acc_snapshot_stock_items(*), acc_snapshot_party_dues(*), acc_snapshot_loan_dues(*)')
        .order('snapshot_date', { ascending: true });
      if (error) throw error;
      const rows = ((data || []) as any[]).map((r) => ({
        id: r.id,
        snapshot_date: r.snapshot_date,
        label: r.label,
        cash_amount: Number(r.cash_amount),
        bank_amount: Number(r.bank_amount),
        notes: r.notes,
        created_at: r.created_at,
        stock_items: r.acc_snapshot_stock_items || [],
        party_dues: r.acc_snapshot_party_dues || [],
        loan_dues: r.acc_snapshot_loan_dues || [],
      }));
      return computeDerived(rows);
    },
  });
}

export interface CreateSnapshotInput {
  snapshot_date: string;
  label: string;
  cash_amount: number;
  bank_amount: number;
  notes?: string;
  stock_items: { product_name: string; quantity: number; unit_price: number }[];
  party_dues: { person_id?: string | null; party_name: string; amount: number }[];
  loan_dues: { loan_id?: string | null; loan_name: string; amount: number }[];
}

export function useCreateSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateSnapshotInput) => {
      const { data: snapshot, error: snapError } = await (supabase.from('acc_snapshots' as any) as any)
        .insert({
          snapshot_date: input.snapshot_date,
          label: input.label,
          cash_amount: input.cash_amount,
          bank_amount: input.bank_amount,
          notes: input.notes || null,
        })
        .select()
        .single();
      if (snapError) throw snapError;
      const snapshotId = (snapshot as any).id;

      const cleanupAndThrow = async (err: unknown) => {
        await (supabase.from('acc_snapshots' as any) as any).delete().eq('id', snapshotId);
        throw err;
      };

      const stockRows = input.stock_items
        .filter((it) => it.product_name.trim())
        .map((it) => ({ snapshot_id: snapshotId, product_name: it.product_name, quantity: it.quantity, unit_price: it.unit_price }));
      if (stockRows.length > 0) {
        const { error } = await (supabase.from('acc_snapshot_stock_items' as any) as any).insert(stockRows);
        if (error) await cleanupAndThrow(error);
      }

      const partyRows = input.party_dues
        .filter((d) => d.party_name.trim())
        .map((d) => ({ snapshot_id: snapshotId, person_id: d.person_id || null, party_name: d.party_name, amount: d.amount }));
      if (partyRows.length > 0) {
        const { error } = await (supabase.from('acc_snapshot_party_dues' as any) as any).insert(partyRows);
        if (error) await cleanupAndThrow(error);
      }

      const loanRows = input.loan_dues
        .filter((d) => d.loan_name.trim())
        .map((d) => ({ snapshot_id: snapshotId, loan_id: d.loan_id || null, loan_name: d.loan_name, amount: d.amount }));
      if (loanRows.length > 0) {
        const { error } = await (supabase.from('acc_snapshot_loan_dues' as any) as any).insert(loanRows);
        if (error) await cleanupAndThrow(error);
      }

      return snapshot;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['acc-snapshots'] }),
  });
}

export function useDeleteSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from('acc_snapshots' as any) as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['acc-snapshots'] }),
  });
}
