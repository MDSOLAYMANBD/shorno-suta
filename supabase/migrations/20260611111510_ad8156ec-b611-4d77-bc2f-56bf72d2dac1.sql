UPDATE public.acc_salary_records
SET overtime_amount = 2000,
    overtime_note = NULL,
    final_salary = GREATEST(0, base_salary - deduction + COALESCE(bonus_amount,0) + 2000)
WHERE id IN (
  SELECT s.id FROM public.acc_salary_records s
  JOIN public.acc_persons p ON p.id = s.person_id
  WHERE p.person_code = 'EMP-037'
    AND s.month = 5 AND s.year = 2026
    AND s.overtime_amount = 0
    AND s.overtime_note ~ '^[0-9]+$'
);