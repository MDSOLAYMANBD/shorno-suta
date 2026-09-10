import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const FUNCTION_NAME = 'self-attendance';

async function callAttendance(action: string, extra?: Record<string, any>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const res = await supabase.functions.invoke(FUNCTION_NAME, {
    body: { action, ...extra },
  });

  if (res.error) throw new Error(res.error.message || 'Function error');
  const json = res.data;
  if (!json.success) throw new Error(json.error || 'Unknown error');
  return json;
}

export function useTodayAttendance() {
  return useQuery({
    queryKey: ['staff-attendance-today'],
    queryFn: () => callAttendance('get_today'),
    staleTime: 5 * 60 * 1000, // 5 min — invalidated on attendance action
  });
}

export function useMonthlyAttendance(month?: number, year?: number) {
  return useQuery({
    queryKey: ['staff-attendance-monthly', month, year],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const now = new Date();
      const m = month || now.getMonth() + 1;
      const y = year || now.getFullYear();
      const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
      const endDate = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;

      const { data, error } = await supabase
        .from('staff_attendance' as any)
        .select('*')
        .gte('date', startDate)
        .lt('date', endDate)
        .order('date', { ascending: false });

      if (error) throw error;
      return (data || []) as any[];
    },
  });
}

export function useAttendanceAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (action: string) => callAttendance(action),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['staff-attendance-today'] });
      qc.invalidateQueries({ queryKey: ['staff-attendance-monthly'] });
      toast({ title: result.message || 'সফল' });
    },
    onError: (err: Error) => {
      toast({ title: 'ত্রুটি', description: err.message, variant: 'destructive' });
    },
  });
}
