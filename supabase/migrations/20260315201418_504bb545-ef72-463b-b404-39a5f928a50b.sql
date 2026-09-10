INSERT INTO store_settings (key, value) 
VALUES ('meta_verify_token', 'shorno_suta_meta_verify_token')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;