export interface SalaryAttendanceRow {
  date: string;
  status?: string | null;
}

export interface SalaryCalculationInput {
  year: number;
  month: number;
  baseSalary: number;
  joiningDate?: string | null;
  attendanceRows?: SalaryAttendanceRow[];
  offDays?: number[];
  endDay?: number;
  bonusAmount?: number;
  overtimeAmount?: number;
}

export interface SalaryCalculationResult {
  totalDays: number;
  payableDays: number;
  preJoinDays: number;
  workingDays: number;
  presentDays: number;
  lateDays: number;
  offDays: number;
  absentDays: number;
  dutyDays: number;
  perDay: number;
  earned: number;
  deduction: number;
  finalSalary: number;
  startDate: string;
  endDateExclusive: string;
}

const dateStr = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

export function calculateMonthlySalary(input: SalaryCalculationInput): SalaryCalculationResult {
  const totalDays = new Date(input.year, input.month, 0).getDate();
  const baseSalary = Number(input.baseSalary || 0);
  const endDay = Math.max(0, Math.min(input.endDay ?? totalDays, totalDays));
  const monthStart = dateStr(input.year, input.month, 1);
  const monthEndExclusive = input.month === 12
    ? `${input.year + 1}-01-01`
    : `${input.year}-${String(input.month + 1).padStart(2, '0')}-01`;

  const join = input.joiningDate?.slice(0, 10);
  let startDay = 1;
  if (join) {
    if (join >= monthEndExclusive) startDay = totalDays + 1;
    else if (join > monthStart) startDay = Number(join.slice(8, 10)) || 1;
  }

  const attendanceMap = new Map((input.attendanceRows || []).map(row => [row.date.slice(0, 10), row.status || null]));
  const offDaySet = new Set((input.offDays && input.offDays.length > 0) ? input.offDays : [5]);

  let presentDays = 0;
  let lateDays = 0;
  let offDayCount = 0;
  let markedAbsentDays = 0;

  for (let day = startDay; day <= endDay; day += 1) {
    const current = dateStr(input.year, input.month, day);
    const explicitStatus = attendanceMap.get(current);
    const jsDay = new Date(input.year, input.month - 1, day).getDay();
    const status = explicitStatus || (offDaySet.has(jsDay) ? 'off_day' : 'present');

    if (status === 'late') lateDays += 1;
    else if (status === 'off_day' || status === 'off' || status === 'leave') offDayCount += 1;
    else if (status === 'absent') markedAbsentDays += 1;
    else presentDays += 1;
  }

  const payableDays = Math.max(0, endDay - startDay + 1);
  const preJoinDays = Math.max(0, Math.min(startDay - 1, endDay));
  const dutyDays = presentDays + lateDays + offDayCount;
  const workingDays = Math.max(0, payableDays - offDayCount);
  const perDay = totalDays > 0 ? baseSalary / totalDays : 0;
  const earned = Math.round(perDay * dutyDays);
  const deduction = Math.max(0, Math.round(baseSalary - earned));
  const finalSalary = Math.max(0, earned + Number(input.bonusAmount || 0) + Number(input.overtimeAmount || 0));

  return {
    totalDays,
    payableDays,
    preJoinDays,
    workingDays,
    presentDays,
    lateDays,
    offDays: offDayCount,
    absentDays: preJoinDays + markedAbsentDays,
    dutyDays,
    perDay,
    earned,
    deduction,
    finalSalary,
    startDate: dateStr(input.year, input.month, Math.min(startDay, totalDays || 1)),
    endDateExclusive: monthEndExclusive,
  };
}

export function salaryFormulaFinal(record: any): number {
  return Math.max(
    0,
    Number(record?.base_salary || 0)
      - Number(record?.deduction || 0)
      + Number(record?.bonus_amount || 0)
      + Number(record?.overtime_amount || 0)
  );
}

/** Remaining payable after subtracting paid + advance amounts. */
export function salaryRemaining(record: any): number {
  const final = salaryFormulaFinal(record);
  const paid = Number(record?.paid_amount || 0);
  const advance = Number(record?.advance_amount || 0);
  return final - paid - advance;
}