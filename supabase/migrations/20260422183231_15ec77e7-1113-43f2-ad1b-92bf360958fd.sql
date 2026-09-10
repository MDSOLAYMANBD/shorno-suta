-- Anon role had a table-level SELECT grant, which overrides column-level REVOKE.
-- Strategy: revoke broad SELECT from anon, then grant SELECT only on non-sensitive columns.
REVOKE SELECT ON public.products FROM anon;

GRANT SELECT (
  id, category_id, name, name_bn, slug, description, description_bn,
  price, original_price, images, sizes, colors, stock,
  is_featured, is_active, created_at, video_url, video_file_url,
  seo_title, seo_description, product_type, variant_images,
  is_hidden_from_shop, seo_keywords, feed_title, feed_description,
  allow_pre_order, bump_product_id, bump_discount, addon_config
) ON public.products TO anon;
-- cost_price is intentionally omitted