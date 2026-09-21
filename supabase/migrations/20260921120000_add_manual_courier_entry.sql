ALTER TABLE public.orders
  ADD COLUMN courier_manual_name text NULL;

COMMENT ON COLUMN public.orders.courier_manual_name IS
  'courier_provider = ''manual'' হলে কুরিয়ারের আসল নাম (যেমন Paperfly) এখানে থাকবে। steadfast/pathao/redx-এর জন্য NULL।';
