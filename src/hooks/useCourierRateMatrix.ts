import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CourierRateMatrix, DEFAULT_RATE_MATRIX } from '@/lib/courierFinance';

const SETTINGS_KEY = 'courier_rate_matrix';

export function useCourierRateMatrix() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['courier-rate-matrix'],
    queryFn: async (): Promise<CourierRateMatrix> => {
      const { data } = await supabase
        .from('store_settings')
        .select('value')
        .eq('key', SETTINGS_KEY)
        .maybeSingle();
      if (!data?.value) return DEFAULT_RATE_MATRIX;
      try {
        const parsed = JSON.parse(data.value);
        return { ...DEFAULT_RATE_MATRIX, ...parsed };
      } catch {
        return DEFAULT_RATE_MATRIX;
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  const save = useMutation({
    mutationFn: async (matrix: CourierRateMatrix) => {
      const { error } = await supabase
        .from('store_settings')
        .upsert({ key: SETTINGS_KEY, value: JSON.stringify(matrix) }, { onConflict: 'key' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['courier-rate-matrix'] }),
  });

  return { matrix: query.data || DEFAULT_RATE_MATRIX, isLoading: query.isLoading, save };
}
