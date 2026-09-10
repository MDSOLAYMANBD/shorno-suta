import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAllSettings } from './useAllSettings';

export function useStoreSettings() {
  const { data: allSettings, ...rest } = useAllSettings();
  return { data: allSettings, ...rest };
}

export function usePublicSettings() {
  const { data: allSettings, ...rest } = useAllSettings();
  return { data: allSettings, ...rest };
}

export function useUpdateSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const { data: existing } = await supabase.from('store_settings').select('id').eq('key', key).single();
      if (existing) {
        const { error } = await supabase.from('store_settings').update({ value }).eq('key', key);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('store_settings').insert({ key, value });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all-settings'] });
    },
  });
}
