-- ১. পুরনো ব্যাকফিল মুছে ফেলো (২৫ মার্চের আগের অর্ডার)
DELETE FROM acc_transactions 
WHERE description LIKE '%ব্যাকফিল%' 
  AND reference_id IN (
    SELECT id::text FROM orders 
    WHERE status = 'office_sell' AND created_at < '2026-03-25'
  );

-- ২. বাকি ৩টি এন্ট্রির তারিখ অর্ডারের তারিখে সেট করো
UPDATE acc_transactions t
SET created_at = o.created_at
FROM orders o
WHERE t.reference_id = o.id::text
  AND t.description LIKE '%ব্যাকফিল%';

-- ৩. ক্যাশ ব্যালেন্স থেকে মুছে ফেলা এন্ট্রির টাকা বাদ দাও
UPDATE acc_accounts 
SET balance = balance - 46620 
WHERE id = '0c788629-b021-4296-90aa-39c0b3667058';