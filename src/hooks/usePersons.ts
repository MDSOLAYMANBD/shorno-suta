import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logAccActivity } from '@/hooks/useAccActivityLog';

export interface AccPerson {
  id: string;
  name: string;
  phone: string | null;
  type: string;
  unit_id: string | null;
  joining_date: string | null;
  base_salary: number;
  salary_type: string;
  is_active: boolean;
  resigned_at: string | null;
  created_at: string;
  duty_start: string | null;
  duty_end: string | null;
  person_code: string | null;
  linked_loan_id?: string | null;
  acc_units?: { name: string } | null;
}

export interface LoanPayload {
  principal_amount: number;
  interest_rate: number;
  total_installments: number;
  monthly_installment: number;
  start_date: string;
  tracking_start_date?: string | null;
}

export function usePersons(filters?: { type?: string; unit_id?: string }) {
  return useQuery({
    queryKey: ['acc-persons', filters],
    queryFn: async () => {
      let q = (supabase.from('acc_persons' as any) as any).select('*, acc_units(name)').order('name');
      if (filters?.type) q = q.eq('type', filters.type);
      if (filters?.unit_id) q = q.eq('unit_id', filters.unit_id);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as AccPerson[];
    },
  });
}

export function usePerson(id: string | undefined) {
  return useQuery({
    queryKey: ['acc-person', id],
    queryFn: async () => {
      const { data, error } = await (supabase.from('acc_persons' as any) as any)
        .select('*, acc_units(name)')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data as AccPerson | null;
    },
    enabled: !!id,
  });
}

export function useCreatePerson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (person: Partial<AccPerson> & { _loanPayload?: LoanPayload }) => {
      // Extract optional loan payload so it isn't sent to acc_persons insert
      const { _loanPayload, ...personData } = person;

      // If creating a loan_kisti person, first insert the loan row
      let loanId: string | null = personData.linked_loan_id || null;
      if (personData.type === 'loan_kisti' && _loanPayload) {
        const { data: loan, error: loanErr } = await (supabase.from('acc_loans' as any) as any)
          .insert({
            name: personData.name || 'Loan',
            principal_amount: _loanPayload.principal_amount,
            interest_rate: _loanPayload.interest_rate,
            total_installments: _loanPayload.total_installments,
            monthly_installment: _loanPayload.monthly_installment,
            start_date: _loanPayload.start_date,
            tracking_start_date: _loanPayload.tracking_start_date || _loanPayload.start_date,
            status: 'active',
          })
          .select('id')
          .single();
        if (loanErr) throw loanErr;
        loanId = (loan as any)?.id || null;
      }

      // Auto-generate person_code
      const { data: existing } = await (supabase.from('acc_persons' as any) as any)
        .select('person_code')
        .not('person_code', 'is', null)
        .order('person_code', { ascending: false })
        .limit(1);
      let nextNum = 1;
      if (existing && existing.length > 0 && existing[0].person_code) {
        const match = (existing[0].person_code as string).match(/EMP-(\d+)/);
        if (match) nextNum = parseInt(match[1], 10) + 1;
      }
      const person_code = `EMP-${String(nextNum).padStart(3, '0')}`;

      const insertPayload = { ...personData, person_code, linked_loan_id: loanId };
      const { data, error } = await supabase.from('acc_persons' as any).insert(insertPayload as any).select().single();
      if (error) throw error;
      logAccActivity({ action: 'create', entity_type: 'person', entity_id: (data as any)?.id, entity_name: personData.name || '', description: `নতুন ${personData.type || 'ব্যক্তি'} যোগ (${person_code})`, new_data: personData as any });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['acc-persons'] });
      qc.invalidateQueries({ queryKey: ['acc-loans'] });
    },
  });
}

export function useUpdatePerson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<AccPerson>) => {
      const { error } = await supabase.from('acc_persons' as any).update(updates as any).eq('id', id);
      if (error) throw error;
      logAccActivity({ action: 'update', entity_type: 'person', entity_id: id, entity_name: updates.name || '', description: `ব্যক্তি আপডেট`, new_data: updates as any });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['acc-persons'] });
      qc.invalidateQueries({ queryKey: ['acc-person'] });
    },
  });
}

export function useDeletePerson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name?: string }) => {
      const { data: existing } = await (supabase.from('acc_persons' as any) as any).select('*').eq('id', id).single();
      const { error } = await supabase.from('acc_persons' as any).delete().eq('id', id);
      if (error) throw error;
      logAccActivity({ action: 'delete', entity_type: 'person', entity_id: id, entity_name: name || (existing as any)?.name || '', description: `ব্যক্তি ডিলিট`, old_data: { ...(existing as any || {}), id } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['acc-persons'] });
    },
  });
}
