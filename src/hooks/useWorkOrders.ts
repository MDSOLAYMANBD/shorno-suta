import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logAccActivity } from '@/hooks/useAccActivityLog';

export interface WorkOrder {
  id: string;
  unit_id: string;
  order_number: string;
  product_name: string;
  total_quantity: number;
  pricing: number;
  wage: number;
  status: string;
  created_at: string;
}

export interface WorkOrderEntry {
  id: string;
  work_order_id: string;
  person_id: string;
  quantity: number;
  rate: number;
  date: string;
  created_at: string;
  acc_persons?: { name: string } | null;
}

export function useWorkOrders(unit_id?: string) {
  return useQuery({
    queryKey: ['work-orders', unit_id],
    enabled: !!unit_id,
    queryFn: async () => {
      const { data, error } = await (supabase.from('acc_work_orders' as any) as any)
        .select('*')
        .eq('unit_id', unit_id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as WorkOrder[];
    },
  });
}

export function useWorkOrderEntries(work_order_id?: string) {
  return useQuery({
    queryKey: ['work-order-entries', work_order_id],
    enabled: !!work_order_id,
    queryFn: async () => {
      const { data, error } = await (supabase.from('acc_work_order_entries' as any) as any)
        .select('*, acc_persons(name)')
        .eq('work_order_id', work_order_id)
        .order('date', { ascending: false });
      if (error) throw error;
      return (data || []) as WorkOrderEntry[];
    },
  });
}

// Fetch entries for ALL work orders of a unit in one query
export function useAllWorkOrderEntries(workOrderIds: string[]) {
  return useQuery({
    queryKey: ['work-order-entries-all', workOrderIds],
    enabled: workOrderIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase.from('acc_work_order_entries' as any) as any)
        .select('*, acc_persons(name)')
        .in('work_order_id', workOrderIds);
      if (error) throw error;
      return (data || []) as WorkOrderEntry[];
    },
  });
}

export function useCreateWorkOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { unit_id: string; order_number: string; product_name: string; total_quantity: number; pricing?: number; wage?: number }) => {
      const { data, error } = await (supabase.from('acc_work_orders' as any) as any)
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      logAccActivity({ action: 'create', entity_type: 'work_order', entity_id: (data as any)?.id, entity_name: `${input.order_number} — ${input.product_name}`, description: `নতুন ওয়ার্ক অর্ডার`, new_data: input });
      return data as WorkOrder;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['work-orders', vars.unit_id] });
    },
  });
}

export function useCreateWorkOrderEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { work_order_id: string; person_id: string; quantity: number; rate: number; date?: string; product_name: string; order_number?: string; order_total_quantity?: number }) => {
      const { product_name, order_number, order_total_quantity, ...entryInput } = input;
      const { data, error } = await (supabase.from('acc_work_order_entries' as any) as any)
        .insert({ work_order_id: entryInput.work_order_id, person_id: entryInput.person_id, quantity: entryInput.quantity, rate: entryInput.rate, date: entryInput.date })
        .select()
        .single();
      if (error) throw error;
      // Dual-write to acc_production_entries
      await (supabase.from('acc_production_entries' as any) as any)
        .insert({
          person_id: input.person_id,
          date: input.date || new Date().toISOString().slice(0, 10),
          product_name,
          quantity: input.quantity,
          pricing: input.rate,
          total: input.quantity * input.rate,
          is_submission: false,
          order_number: order_number || null,
          order_total_quantity: order_total_quantity || null,
        });
      return data as WorkOrderEntry;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-order-entries-all'] });
      qc.invalidateQueries({ queryKey: ['work-order-entries'] });
      qc.invalidateQueries({ queryKey: ['production-entries'] });
    },
  });
}

export function useUpdateWorkOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; status?: string; order_number?: string; product_name?: string; total_quantity?: number; pricing?: number; wage?: number }) => {
      const { error } = await (supabase.from('acc_work_orders' as any) as any)
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-orders'] });
    },
  });
}

export function useDeleteWorkOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      // Fetch work order for logging
      const { data: wo } = await (supabase.from('acc_work_orders' as any) as any).select('*').eq('id', orderId).single();
      const { data: entries } = await (supabase.from('acc_work_order_entries' as any) as any)
        .select('*')
        .eq('work_order_id', orderId);
      if (entries && entries.length > 0) {
        for (const entry of entries) {
          await (supabase.from('acc_production_entries' as any) as any)
            .delete()
            .eq('person_id', entry.person_id)
            .eq('quantity', entry.quantity)
            .eq('date', entry.date)
            .eq('is_submission', false);
        }
      }
      await (supabase.from('acc_work_order_entries' as any) as any)
        .delete()
        .eq('work_order_id', orderId);
      const { error } = await (supabase.from('acc_work_orders' as any) as any)
        .delete()
        .eq('id', orderId);
      if (error) throw error;
      logAccActivity({ action: 'delete', entity_type: 'work_order', entity_id: orderId, entity_name: wo ? `${wo.order_number} — ${wo.product_name}` : '', description: `ওয়ার্ক অর্ডার ডিলিট`, old_data: { ...(wo || {}), id: orderId } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-orders'] });
      qc.invalidateQueries({ queryKey: ['work-order-entries-all'] });
      qc.invalidateQueries({ queryKey: ['work-order-entries'] });
      qc.invalidateQueries({ queryKey: ['acc-production-entries'] });
      qc.invalidateQueries({ queryKey: ['production-entries'] });
    },
  });
}

export function useDeleteWorkOrderEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Fetch entry details first for dual-delete
      const { data: entry } = await (supabase.from('acc_work_order_entries' as any) as any)
        .select('*')
        .eq('id', id)
        .single();
      // Delete the work order entry
      const { error } = await (supabase.from('acc_work_order_entries' as any) as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
      // Dual-delete: remove matching production entry
      if (entry) {
        await (supabase.from('acc_production_entries' as any) as any)
          .delete()
          .eq('person_id', entry.person_id)
          .eq('quantity', entry.quantity)
          .eq('date', entry.date)
          .eq('is_submission', false);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-order-entries-all'] });
      qc.invalidateQueries({ queryKey: ['work-order-entries'] });
      qc.invalidateQueries({ queryKey: ['acc-production-entries'] });
      qc.invalidateQueries({ queryKey: ['production-entries'] });
    },
  });
}
