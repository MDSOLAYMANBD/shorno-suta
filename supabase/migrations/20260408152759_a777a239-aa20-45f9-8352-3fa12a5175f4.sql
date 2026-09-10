ALTER TABLE acc_party_entries ALTER COLUMN quantity TYPE numeric USING quantity::numeric;
ALTER TABLE acc_production_entries ALTER COLUMN quantity TYPE numeric USING quantity::numeric;