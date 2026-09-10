// Flat monthly interest: for a loan with interest_type='monthly_flat', a fixed
// taka amount (monthly_interest_amount) is owed for every full month that has
// elapsed since start_date — e.g. borrow on 1/9, owe +1500 starting 1/10, then
// another +1500 on 1/11 if still unpaid, and so on until the loan is settled.
// This is simple (not compounding) interest: the accrued amount itself never
// earns further interest, it just keeps adding up month after month.

export interface InterestBearingLoan {
  interest_type?: string | null;
  monthly_interest_amount?: number | string | null;
  start_date: string;
}

// Full calendar months elapsed between start_date and asOf (floor'd — the
// day-of-month must have passed for a month to count, matching "1/9 → 1/10
// is when the first 1500 is owed", not the 30th or some partial month).
export function elapsedMonths(startDate: string, asOf: Date = new Date()): number {
  const start = new Date(startDate + 'T00:00:00');
  if (asOf < start) return 0;
  let months = (asOf.getFullYear() - start.getFullYear()) * 12 + (asOf.getMonth() - start.getMonth());
  if (asOf.getDate() < start.getDate()) months -= 1;
  return Math.max(0, months);
}

export function computeAccruedInterest(loan: InterestBearingLoan, asOf: Date = new Date()): number {
  if (loan.interest_type !== 'monthly_flat') return 0;
  const monthly = Number(loan.monthly_interest_amount) || 0;
  if (monthly <= 0) return 0;
  return elapsedMonths(loan.start_date, asOf) * monthly;
}

// What's actually owed right now: original principal + interest accrued so
// far. This — not the bare principal_amount column — is what "remaining"
// should be measured against for an interest-bearing loan.
export function totalOwed(loan: InterestBearingLoan & { principal_amount: number | string }, asOf: Date = new Date()): number {
  return Number(loan.principal_amount) + computeAccruedInterest(loan, asOf);
}
