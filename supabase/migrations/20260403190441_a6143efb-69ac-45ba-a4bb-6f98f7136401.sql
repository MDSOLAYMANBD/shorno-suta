UPDATE public.acc_units
SET allowed_types = array_append(allowed_types, 'salaried_production')
WHERE NOT ('salaried_production' = ANY(allowed_types))
  AND ('employee' = ANY(allowed_types) OR 'production_staff' = ANY(allowed_types));