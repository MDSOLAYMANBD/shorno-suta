-- Move wrongly-placed order #111 from অফিস to সাপ্লায়ার
UPDATE acc_work_orders 
SET unit_id = '4477537a-0c5d-4c85-9803-cdff18a60a49'
WHERE id = 'ef1dada0-c591-4f60-8216-d71e398175f5';