UPDATE store_settings 
SET value = jsonb_set(
  jsonb_set(value::jsonb, '{best_selling,limit}', '10'),
  '{new_products,limit}', '10'
)
WHERE key = 'homepage_config';