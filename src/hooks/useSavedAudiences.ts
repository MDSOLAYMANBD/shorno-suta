// CRUD for crm_saved_audiences. Used by every marketing channel.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { audienceKeys } from '@/lib/audience/cache';
import type { AudienceFilter, SavedAudience } from '@/lib/audience/types';

export function useSavedAudiences(channelHint?: string) {
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: [...audienceKeys.saved(), channelHint ?? null],
    queryFn: async (): Promise<SavedAudience[]> => {
      let q: any = supabase
        .from('crm_saved_audiences' as any)
        .select('*')
        .order('updated_at', { ascending: false });
      if (channelHint) q = q.or(`channel_hint.eq.${channelHint},channel_hint.is.null`);
      const { data, error } = await q;
      if (error) throw error;
      return (data as any[]) as SavedAudience[];
    },
  });

  const save = useMutation({
    mutationFn: async (input: {
      id?: string;
      name: string;
      description?: string;
      filters: AudienceFilter;
      channel_hint?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (input.id) {
        const { data, error } = await (supabase.from('crm_saved_audiences' as any) as any)
          .update({
            name: input.name,
            description: input.description ?? null,
            filters: input.filters,
            channel_hint: input.channel_hint ?? null,
          })
          .eq('id', input.id)
          .select('*')
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await (supabase.from('crm_saved_audiences' as any) as any)
        .insert({
          name: input.name,
          description: input.description ?? null,
          filters: input.filters,
          channel_hint: input.channel_hint ?? null,
          created_by: user?.id ?? null,
        })
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: audienceKeys.saved() }),
  });

  const duplicate = useMutation({
    mutationFn: async (a: SavedAudience) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await (supabase.from('crm_saved_audiences' as any) as any)
        .insert({
          name: `${a.name} (copy)`,
          description: a.description,
          filters: a.filters,
          channel_hint: a.channel_hint,
          created_by: user?.id ?? null,
        })
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: audienceKeys.saved() }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('crm_saved_audiences' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: audienceKeys.saved() }),
  });

  return { list, save, duplicate, remove };
}
