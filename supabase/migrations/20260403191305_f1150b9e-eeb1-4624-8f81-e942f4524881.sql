ALTER TABLE public.acc_persons DROP CONSTRAINT IF EXISTS acc_persons_type_check;
ALTER TABLE public.acc_persons ADD CONSTRAINT acc_persons_type_check 
  CHECK (type = ANY (ARRAY['employee','salaried_production','production_staff','party','supplier']));