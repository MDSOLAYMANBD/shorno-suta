DELETE FROM public.courier_tracking_events WHERE raw_data->>'_test' = 'true';
UPDATE public.orders SET courier_status = 'in_review' WHERE id = '9210abcc-a165-440b-ac4c-69bf2326151e';