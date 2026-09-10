// CRUD for crm_tags. Tags are first-class CRM filters reused by every channel.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CrmTag {
  id: string;
  name: string;
  color: string | null;
  description: string | null;
  created_at: string;
}

const KEY = ['crm-tags'];

export function useCrmTags() {
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<CrmTag[]> => {
      const { data, error } = await supabase
        .from('crm_tags')
        .select('id, name, color, description, created_at')
        .order('name', { ascending: true });
      if (error) throw error;
      return (data || []) as CrmTag[];
    },
    staleTime: 5 * 60_000,
  });

  const create = useMutation({
    mutationFn: async (input: { name: string; color?: string; description?: string }) => {
      const { data, error } = await (supabase.from('crm_tags') as any)
        .insert({ name: input.name.trim(), color: input.color ?? null, description: input.description ?? null })
        .select('*').single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  const update = useMutation({
    mutationFn: async (input: Partial<CrmTag> & { id: string }) => {
      const { id, ...rest } = input;
      const { error } = await (supabase.from('crm_tags') as any).update(rest).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('crm_tags').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  return { list, create, update, remove };
}
