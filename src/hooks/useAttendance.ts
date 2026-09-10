import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { logAccActivity } from '@/hooks/useAccActivityLog';

export interface AccAttendance {
  id: string;
  person_id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: string;
  note: string | null;
  marked_by: string | null;
  created_at: string;
  acc_persons?: { name: string; type: string; unit_id: string | null } | null;
}

export function useAttendance(date: Date, unitId?: string) {
  const dateStr = format(date, 'yyyy-MM-dd');
  return useQuery({
    queryKey: ['acc-attendance', dateStr, unitId],
    queryFn: async () => {
      let q = (supabase.from('acc_attendance' as any) as any)
        .select('*, acc_persons(name, type, unit_id)')
        .eq('date', dateStr);
      const { data, error } = await q;
      if (error) throw error;
      let records = (data || []) as AccAttendance[];
      if (unitId) {
        records = records.filter(r => (r.acc_persons as any)?.unit_id === unitId);
      }
      return records;
    },
  });
}

export function usePersonAttendance(personId: string | undefined, month?: number, year?: number) {
  return useQuery({
    queryKey: ['acc-person-attendance', personId, month, year],
    queryFn: async () => {
      let q = (supabase.from('acc_attendance' as any) as any)
        .select('*')
        .eq('person_id', personId)
        .order('date', { ascending: false });
      if (month && year) {
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
        q = q.gte('date', startDate).lt('date', endDate);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as AccAttendance[];
    },
    enabled: !!personId,
  });
}

export function useMarkAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (record: { person_id: string; date: string; status: string; check_in?: string; check_out?: string; note?: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.from('acc_attendance' as any).upsert({
        ...record,
        marked_by: session?.user?.id,
      } as any, { onConflict: 'person_id,date' }).select().single();
      if (error) throw error;
      logAccActivity({ action: 'update', entity_type: 'attendance', entity_id: (data as any)?.id, entity_name: `${record.date} — ${record.status}`, description: `উপস্থিতি মার্ক`, new_data: record });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['acc-attendance'] });
      qc.invalidateQueries({ queryKey: ['acc-person-attendance'] });
    },
  });
}
