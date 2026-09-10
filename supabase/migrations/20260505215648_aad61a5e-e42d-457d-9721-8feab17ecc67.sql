GRANT SELECT (deleted_at) ON public.products TO anon, authenticated;
GRANT UPDATE (deleted_at) ON public.products TO authenticated;