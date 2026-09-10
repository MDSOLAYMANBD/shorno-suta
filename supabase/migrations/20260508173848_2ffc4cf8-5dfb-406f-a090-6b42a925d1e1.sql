-- Grant column-level access for category_pinned_at since products has column-level GRANT model (cost_price revoked)
GRANT SELECT (category_pinned_at) ON public.products TO anon, authenticated;
GRANT UPDATE (category_pinned_at) ON public.products TO authenticated;
NOTIFY pgrst, 'reload schema';