
-- Add person_code column
ALTER TABLE public.acc_persons ADD COLUMN person_code text;

-- Backfill existing rows with sequential codes based on created_at
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn
  FROM public.acc_persons
)
UPDATE public.acc_persons p
SET person_code = 'EMP-' || LPAD(n.rn::text, 3, '0')
FROM numbered n
WHERE p.id = n.id;

-- Add unique constraint
ALTER TABLE public.acc_persons ADD CONSTRAINT acc_persons_person_code_key UNIQUE (person_code);
