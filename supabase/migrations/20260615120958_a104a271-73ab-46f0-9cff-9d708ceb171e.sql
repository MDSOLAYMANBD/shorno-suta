
GRANT SELECT ON public.free_shipping_campaigns TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.free_shipping_campaigns TO authenticated;
GRANT ALL ON public.free_shipping_campaigns TO service_role;

GRANT SELECT ON public.free_shipping_campaign_stats TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.free_shipping_campaign_stats TO authenticated;
GRANT ALL ON public.free_shipping_campaign_stats TO service_role;
