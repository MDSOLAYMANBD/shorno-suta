
-- Clean up stale sale entries for non-office_sell orders
-- SD-006020 (cancelled, ৳970) and SD-005511 (confirmed, ৳5660)

-- Reverse the balance: current 13500 - 970 - 5660 = 6870
UPDATE acc_accounts SET balance = balance - 6630 WHERE id = '0c788629-b021-4296-90aa-39c0b3667058';

-- Delete the stale transactions
DELETE FROM acc_transactions WHERE id IN ('d5c19b3e-3f8d-4c62-8fbd-25df0f5c259d', '6cb2e267-8f5e-412d-ba6e-c3dd29e1a559');

-- Log cleanup in activity logs
INSERT INTO acc_activity_logs (action, entity_type, entity_name, description, old_data)
VALUES 
('delete', 'transaction', 'বিক্রি ৳970 #SD-006020', 'Stale sale entry cleanup — order cancelled', '{"amount": 970, "order_number": "SD-006020", "order_status": "cancelled"}'::jsonb),
('delete', 'transaction', 'বিক্রি ৳5660 #SD-005511', 'Stale sale entry cleanup — order confirmed (not office_sell)', '{"amount": 5660, "order_number": "SD-005511", "order_status": "confirmed"}'::jsonb);
