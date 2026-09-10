
-- Step 1: Restore source='bank' AND account_id=bank for 13 expense transactions
-- that were wrongly flipped by the previous migration.
-- Evidence: acc_activity_logs confirms these were created with source='bank'.
-- Also update account_id to bank since user intended bank payment.

UPDATE acc_transactions SET source = 'bank', account_id = 'c0831bd8-c223-4663-a051-5b923bdb4256'
WHERE id IN (
  'cb6a3204-bd0e-4f11-839a-e53c2de783bf',  -- Boost bost bill ৳90,000
  'ae58ce8c-474e-479f-a52b-32b7901a8a6f',  -- Investment kobir vai ৳700,000
  'fbc174de-7de7-4e07-9d02-bac2bd0360da',  -- Website Recharge ৳500
  'ec65a439-d4f3-4b5e-ad65-7cba3dfbf05a',  -- unnamed ৳2,000
  '1f1bf554-da47-4631-8d49-1a64bf4e23fd',  -- unnamed ৳1,000
  '7ed4da31-320f-46fa-965c-82cd6a4ea6b9',  -- ম্যাটেরিয়াল ক্রয় ৳35,500
  '0e896d1e-0aa6-49cb-a9ac-807840321613',  -- কাপর ৳42,508
  'dc583956-83b8-45ad-8c70-dc6af8a57664',  -- Boost ৳100,000
  '35af68a7-6749-4f23-ab5c-fed2c503e3ef',  -- customer refund ৳50
  '9fbad092-d14d-4a65-85a8-9bf3b55ec76b',  -- bkash ৳1,000
  '8d829ab7-d360-4bc0-8222-8e1296544a9e',  -- unnamed ৳500
  '92855c11-e2a5-49bf-94e4-73406c6a9157',  -- ওয়েবসাইট রিচার্জ ৳1,570
  '31061596-0e67-4a7d-9c50-24e396f76edb'   -- রিফান্ড ৳750
)
AND source = 'cash';  -- Safety: only update if currently wrong

-- Step 2: Backfill null source for the office sell sale transaction
UPDATE acc_transactions SET source = 'cash'
WHERE id = 'f6784537-ba40-4f76-8c7b-365602212ac1' AND source IS NULL;

-- Step 3: Backfill null source for the deposit transaction
UPDATE acc_transactions SET source = 'cash'
WHERE id = '087eb8af-9d5b-48fb-b13c-942eee1694bb' AND source IS NULL;

-- Step 4: Reconcile acc_accounts.balance to 0 for all accounts
-- The dashboard calculates balances dynamically, so stored balance
-- is secondary. Reset to 0 to avoid confusion.
UPDATE acc_accounts SET balance = 0 WHERE id IN (
  '266fdf05-43ef-4dc6-8660-842a958df62e',  -- Cash Account
  'c0831bd8-c223-4663-a051-5b923bdb4256',  -- Bank Account
  '0c788629-b021-4296-90aa-39c0b3667058'   -- Sale Account
);
