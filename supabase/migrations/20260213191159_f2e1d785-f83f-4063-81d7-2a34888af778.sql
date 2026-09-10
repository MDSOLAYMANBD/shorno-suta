UPDATE store_settings
SET value = jsonb_set(value::jsonb, '{all_products,heading}', '"সব ড্রেস দেখুন"')::text
WHERE key = 'homepage_config';