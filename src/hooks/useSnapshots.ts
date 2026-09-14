import { useMemo } from 'react';
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

const SNAPSHOTS_KEY = ['acc-snapshots'];

/** Full history, oldest first, each with its computed net worth and profit/loss vs the one before it. */
export function useSnapshots() {
  return useQuery({
    queryKey: SNAPSHOTS_KEY,
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

/**
 * "মূলধন" — the current capital — is simply the most recent snapshot, kept
 * live-editable. There is no separate "current capital" table: every edit
 * here (cash/bank/stock/party/loan) edits the latest acc_snapshots row
 * directly, and starting a fresh reconciliation (useStartNewSnapshot) is
 * what moves "latest" forward and gives the previous one something to be
 * diffed against for profit/loss.
 */
export function useLatestSnapshot() {
  const { data: snapshots, ...rest } = useSnapshots();
  const latest = useMemo(() => (snapshots && snapshots.length > 0 ? snapshots[snapshots.length - 1] : undefined), [snapshots]);
  return { data: latest, ...rest };
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: SNAPSHOTS_KEY });
}

/** Starts a new dated entry (from হিসাব মিলান) with just a date + label — everything else is filled in over time from মূলধন ও বিনিয়োগ. */
export function useStartNewSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { snapshot_date: string; label: string; notes?: string }) => {
      const { data, error } = await (supabase.from('acc_snapshots' as any) as any)
        .insert({ snapshot_date: input.snapshot_date, label: input.label, cash_amount: 0, bank_amount: 0, notes: input.notes || null })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateSnapshotCore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; label?: string; snapshot_date?: string; cash_amount?: number; bank_amount?: number; notes?: string }) => {
      const { error } = await (supabase.from('acc_snapshots' as any) as any).update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(qc),
  });
}

export function useDeleteSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from('acc_snapshots' as any) as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(qc),
  });
}

// ---- Stock items ----

export function useAddStockItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: { snapshot_id: string; product_name: string; quantity: number; unit_price: number }) => {
      const { error } = await (supabase.from('acc_snapshot_stock_items' as any) as any).insert(row);
      if (error) throw error;
    },
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateStockItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; product_name?: string; quantity?: number; unit_price?: number }) => {
      const { error } = await (supabase.from('acc_snapshot_stock_items' as any) as any).update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(qc),
  });
}

export function useDeleteStockItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from('acc_snapshot_stock_items' as any) as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(qc),
  });
}

// ---- Party dues ----

export function useAddPartyDue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: { snapshot_id: string; person_id?: string | null; party_name: string; amount: number }) => {
      const { error } = await (supabase.from('acc_snapshot_party_dues' as any) as any).insert(row);
      if (error) throw error;
    },
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdatePartyDue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; person_id?: string | null; party_name?: string; amount?: number }) => {
      const { error } = await (supabase.from('acc_snapshot_party_dues' as any) as any).update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(qc),
  });
}

export function useDeletePartyDue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from('acc_snapshot_party_dues' as any) as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(qc),
  });
}

// ---- Loan dues ----

export function useAddLoanDue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: { snapshot_id: string; loan_id?: string | null; loan_name: string; amount: number }) => {
      const { error } = await (supabase.from('acc_snapshot_loan_dues' as any) as any).insert(row);
      if (error) throw error;
    },
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateLoanDue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; loan_id?: string | null; loan_name?: string; amount?: number }) => {
      const { error } = await (supabase.from('acc_snapshot_loan_dues' as any) as any).update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(qc),
  });
}

export function useDeleteLoanDue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from('acc_snapshot_loan_dues' as any) as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(qc),
  });
}
