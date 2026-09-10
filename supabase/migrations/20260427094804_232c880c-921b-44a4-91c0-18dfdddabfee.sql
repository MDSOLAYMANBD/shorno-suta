
-- Revoke broad table-level SELECT so column-level grants take effect
REVOKE SELECT ON public.products FROM authenticated;
REVOKE SELECT ON public.products FROM anon;

-- Grant SELECT on every column EXCEPT cost_price for both roles
GRANT SELECT (
  id, category_id, name, name_bn, slug, description, description_bn,
  price, original_price, images, sizes, colors, stock, is_featured,
  is_active, created_at, video_url, video_file_url, seo_title,
  seo_description, product_type, variant_images, is_hidden_from_shop,
  seo_keywords, feed_title, feed_description, allow_pre_order,
  bump_product_id, bump_discount, addon_config
) ON public.products TO authenticated, anon;
