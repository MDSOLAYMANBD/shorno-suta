import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AccActivityLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  old_data: Record<string, any>;
  new_data: Record<string, any>;
  description: string;
  created_at: string;
}

/** Fire-and-forget activity logger — call from mutation onSuccess/mutationFn */
export async function logAccActivity(params: {
  action: string;
  entity_type: string;
  entity_id?: string;
  entity_name?: string;
  description?: string;
  old_data?: Record<string, any>;
  new_data?: Record<string, any>;
}) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from('acc_activity_logs' as any).insert({
      user_id: session?.user?.id || null,
      action: params.action,
      entity_type: params.entity_type,
      entity_id: params.entity_id || null,
      entity_name: params.entity_name || null,
      old_data: params.old_data || {},
      new_data: params.new_data || {},
      description: params.description || '',
    } as any);
  } catch (e) {
    console.error('Activity log failed:', e);
  }
}

export function useAccActivityLogs(filters?: { entity_type?: string; entity_id?: string; action?: string; limit?: number }) {
  return useQuery({
    queryKey: ['acc-activity-logs', filters],
    queryFn: async () => {
      let q = (supabase.from('acc_activity_logs' as any) as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (filters?.entity_type) q = q.eq('entity_type', filters.entity_type);
      if (filters?.entity_id) q = q.eq('entity_id', filters.entity_id);
      if (filters?.action) {
        q = q.eq('action', filters.action);
      } else {
        q = q.neq('action', 'create');
      }
      q = q.limit(filters?.limit || 200);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as AccActivityLog[];
    },
  });
}

export function useRestoreEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (log: AccActivityLog) => {
      if (log.action !== 'delete' || !log.old_data || !log.entity_type) {
        throw new Error('Only deleted entries can be restored');
      }
      const old = { ...log.old_data };
      // Remove id so DB generates a new one
      delete old.id;
      delete old.created_at;

      const tableMap: Record<string, string> = {
        transaction: 'acc_transactions',
        person: 'acc_persons',
        material: 'acc_unit_materials',
        fixed_expense: 'acc_unit_fixed_expenses',
        custom_expense: 'acc_unit_custom_expenses',
        work_order: 'acc_work_orders',
        work_order_entry: 'acc_work_order_entries',
        party_entry: 'acc_party_entries',
        production_entry: 'acc_production_entries',
        attendance: 'acc_attendance',
      };
      const table = tableMap[log.entity_type];
      if (!table) throw new Error('Unknown entity type');

      const { error } = await supabase.from(table as any).insert(old as any);
      if (error) throw error;

      // If restoring a transaction, adjust account balance
      if (log.entity_type === 'transaction' && old.account_id && old.amount) {
        const DEBIT_TYPES = ['salary', 'production_payment', 'party_payment', 'expense', 'advance', 'bonus'];
        const { data: acc } = await supabase.from('acc_accounts' as any).select('balance').eq('id', old.account_id).single();
        if (acc) {
          const isDebit = DEBIT_TYPES.includes(old.type);
          const newBalance = Number((acc as any).balance) + (isDebit ? -Number(old.amount) : Number(old.amount));
          await supabase.from('acc_accounts' as any).update({ balance: newBalance } as any).eq('id', old.account_id);
        }
      }

      // Log the restore action
      await logAccActivity({
        action: 'restore',
        entity_type: log.entity_type,
        entity_name: log.entity_name || '',
        description: `রিস্টোর করা হয়েছে`,
        new_data: old,
      });
    },
    onSuccess: () => {
      // Invalidate everything
      qc.invalidateQueries({ queryKey: ['acc-activity-logs'] });
      qc.invalidateQueries({ queryKey: ['acc-accounts'] });
      qc.invalidateQueries({ queryKey: ['acc-transactions'] });
      qc.invalidateQueries({ queryKey: ['acc-persons'] });
      qc.invalidateQueries({ queryKey: ['acc-unit-materials'] });
      qc.invalidateQueries({ queryKey: ['acc-unit-fixed-expenses'] });
      qc.invalidateQueries({ queryKey: ['acc-unit-custom-expenses'] });
      qc.invalidateQueries({ queryKey: ['work-orders'] });
      qc.invalidateQueries({ queryKey: ['work-order-entries'] });
      qc.invalidateQueries({ queryKey: ['acc-party-entries'] });
      qc.invalidateQueries({ queryKey: ['acc-production-entries'] });
      qc.invalidateQueries({ queryKey: ['acc-attendance'] });
      qc.invalidateQueries({ queryKey: ['acc-transactions-paginated'] });
      qc.invalidateQueries({ queryKey: ['acc-transaction-summary'] });
    },
  });
}
