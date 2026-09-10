UPDATE acc_salary_records 
SET paid_amount = final_salary 
WHERE is_paid = true AND paid_amount = 0;