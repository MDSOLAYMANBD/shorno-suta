
-- Server-side validation for marketing IDs to prevent script injection
ALTER TABLE store_settings ADD CONSTRAINT check_gtm_id 
  CHECK (key != 'gtm_id' OR value ~ '^GTM-[A-Z0-9]{7,8}$' OR value = '');
ALTER TABLE store_settings ADD CONSTRAINT check_fb_pixel 
  CHECK (key != 'facebook_pixel_id' OR value ~ '^[0-9]{15,16}$' OR value = '');

-- Server-side validation for order inputs to prevent bypass of client-side checks
ALTER TABLE orders ADD CONSTRAINT check_customer_name 
  CHECK (LENGTH(TRIM(customer_name)) >= 2 AND LENGTH(customer_name) <= 100);
ALTER TABLE orders ADD CONSTRAINT check_customer_phone 
  CHECK (customer_phone ~ '^01[3-9][0-9]{8}$');
ALTER TABLE orders ADD CONSTRAINT check_customer_address 
  CHECK (LENGTH(TRIM(customer_address)) >= 5 AND LENGTH(customer_address) <= 500);
