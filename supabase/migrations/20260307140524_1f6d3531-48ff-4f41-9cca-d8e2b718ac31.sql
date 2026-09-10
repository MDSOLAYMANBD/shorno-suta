
-- Generate and insert a new PUSH_WEBHOOK_SECRET into vault
SELECT vault.create_secret(
  encode(gen_random_bytes(32), 'hex'),
  'PUSH_WEBHOOK_SECRET'
);
