UPDATE products
SET slug = lower(
  regexp_replace(
    regexp_replace(
      trim(slug),
      '[^a-zA-Z0-9\s-]', '', 'g'
    ),
    '\s+', '-', 'g'
  )
)
WHERE slug ~ '\s' OR slug ~ '[^a-z0-9-]';