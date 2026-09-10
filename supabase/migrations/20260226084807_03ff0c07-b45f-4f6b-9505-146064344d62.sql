ALTER TABLE orders ADD COLUMN discount_note text DEFAULT '';
ALTER TABLE orders ADD COLUMN free_shipping boolean DEFAULT false;