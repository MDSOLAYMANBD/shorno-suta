
-- Add allowed_types column to acc_units
ALTER TABLE public.acc_units ADD COLUMN allowed_types text[] NOT NULL DEFAULT '{employee}';

-- Update existing units to have all types
UPDATE public.acc_units SET allowed_types = '{employee,production_staff,party,supplier}';
