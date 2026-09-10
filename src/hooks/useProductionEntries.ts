import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logAccActivity } from '@/hooks/useAccActivityLog';

export interface PartyEntry {
  id: string;
  person_id: string;
  memo_number: string | null;
  date: string;
  product_name: string;
  quantity: number | null;
  rate: number | null;
  total: number;
  is_submission: boolean;
  created_at: string;
}

export interface ProductionEntry {
  id: string;
  person_id: string;
  date: string;
  product_name: string;
  quantity: number | null;
  pricing: number | null;
  total: number;
  is_submission: boolean;
  created_at: string;
  order_number: string | null;
  order_total_quantity: number | null;
}

export function usePartyEntries(personId: string | undefined) {
  return useQuery({
    queryKey: ['acc-party-entries', personId],
    queryFn: async () => {
      const { data, error } = await (supabase.from('acc_party_entries' as any) as any)
        .select('*')
        .eq('person_id', personId)
        .order('date', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as PartyEntry[];
    },
    enabled: !!personId,
  });
}

export function useCreatePartyEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: Omit<PartyEntry, 'id' | 'created_at'>) => {
      const { data, error } = await (supabase.from('acc_party_entries' as any) as any)
        .insert(entry).select().single();
      if (error) throw error;
      logAccActivity({ action: 'create', entity_type: 'party_entry', entity_id: (data as any)?.id, entity_name: `${entry.product_name} ৳${entry.total}`, description: entry.is_submission ? 'জমা' : 'নতুন এন্ট্রি', new_data: entry as any });
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['acc-party-entries', vars.person_id] });
    },
  });
}

export function useUpdatePartyEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, person_id, ...updates }: { id: string; person_id: string } & Partial<PartyEntry>) => {
      const { data: existing } = await (supabase.from('acc_party_entries' as any) as any).select('*').eq('id', id).single();
      const { error } = await (supabase.from('acc_party_entries' as any) as any)
        .update(updates).eq('id', id);
      if (error) throw error;
      logAccActivity({
        action: 'update', entity_type: 'party_entry', entity_id: id,
        entity_name: `${updates.product_name ?? (existing as any)?.product_name ?? ''} ৳${updates.total ?? (existing as any)?.total ?? 0}`,
        description: 'পার্টি এন্ট্রি এডিট',
        old_data: existing as any, new_data: { ...(existing as any), ...updates, id },
      });
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['acc-party-entries', vars.person_id] });
    },
  });
}

export function useDeletePartyEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, person_id }: { id: string; person_id: string }) => {
      const { data: existing } = await (supabase.from('acc_party_entries' as any) as any).select('*').eq('id', id).single();
      const { error } = await (supabase.from('acc_party_entries' as any) as any)
        .delete().eq('id', id);
      if (error) throw error;
      logAccActivity({ action: 'delete', entity_type: 'party_entry', entity_id: id, entity_name: `${(existing as any)?.product_name || ''} ৳${(existing as any)?.total || 0}`, description: `পার্টি এন্ট্রি ডিলিট`, old_data: { ...(existing as any || {}), id } });
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['acc-party-entries', vars.person_id] });
    },
  });
}

export function useProductionEntries(personId: string | undefined) {
  return useQuery({
    queryKey: ['acc-production-entries', personId],
    queryFn: async () => {
      const { data, error } = await (supabase.from('acc_production_entries' as any) as any)
        .select('*')
        .eq('person_id', personId)
        .order('date', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as ProductionEntry[];
    },
    enabled: !!personId,
  });
}

export function useCreateProductionEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: Omit<ProductionEntry, 'id' | 'created_at' | 'order_number' | 'order_total_quantity'>) => {
      const { data, error } = await (supabase.from('acc_production_entries' as any) as any)
        .insert(entry).select().single();
      if (error) throw error;
      logAccActivity({ action: 'create', entity_type: 'production_entry', entity_id: (data as any)?.id, entity_name: `${entry.product_name} ৳${entry.total}`, description: entry.is_submission ? 'জমা' : 'নতুন এন্ট্রি', new_data: entry as any });
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['acc-production-entries', vars.person_id] });
    },
  });
}

export function useUpdateProductionEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, person_id, ...updates }: { id: string; person_id: string } & Partial<ProductionEntry>) => {
      const { error } = await (supabase.from('acc_production_entries' as any) as any)
        .update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['acc-production-entries', vars.person_id] });
    },
  });
}

export function useDeleteProductionEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, person_id }: { id: string; person_id: string }) => {
      const { data: existing } = await (supabase.from('acc_production_entries' as any) as any).select('*').eq('id', id).single();
      const { error } = await (supabase.from('acc_production_entries' as any) as any)
        .delete().eq('id', id);
      if (error) throw error;
      logAccActivity({ action: 'delete', entity_type: 'production_entry', entity_id: id, entity_name: `${(existing as any)?.product_name || ''} ৳${(existing as any)?.total || 0}`, description: `প্রোডাকশন এন্ট্রি ডিলিট`, old_data: { ...(existing as any || {}), id } });
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['acc-production-entries', vars.person_id] });
    },
  });
}
