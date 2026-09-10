import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Coins, RefreshCw, Pencil, Printer } from 'lucide-react';

interface SalaryEmployeeCardProps {
  person: any;
  record: any;
  month: number;
  year: number;
  onGenerate: (person: any) => void;
  onFullPay: (record: any) => void;
  onPartialPay: (record: any) => void;
  onIncrement: (person: any) => void;
  onBonus: (person: any) => void;
  onAdvance: (record: any) => void;
  onEdit: (record: any) => void;
  onPrint: (record: any, person: any) => void;
  onRefresh: (person: any) => void;
  onForgiveDays: (record: any) => void;
  generatePending: boolean;
  payPending: boolean;
}

export default function SalaryEmployeeCard({
  person, record, month, year,
  onGenerate, onFullPay, onPartialPay, onIncrement, onBonus, onAdvance,
  onEdit, onPrint, onRefresh, onForgiveDays,
  generatePending, payPending,
}: SalaryEmployeeCardProps) {
  // Defensive: always compute final from breakdown so deduction is never silently dropped
  const displayFinal = record
    ? Math.max(0, Number(record.base_salary || 0) - Number(record.deduction || 0) + Number(record.bonus_amount || 0) + Number(record.overtime_amount || 0))
    : 0;
  const advanceAmt = Number(record?.advance_amount || 0);
  const paidAmt = Number(record?.paid_amount || 0);
  const displayRemaining = record ? displayFinal - paidAmt - advanceAmt : 0;
  return (
    <Card>
      <CardContent className="p-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="font-medium text-sm">{person.name}</div>
            <div className="text-xs text-muted-foreground">বেতন: ৳{(person.base_salary || 0).toLocaleString()}</div>
          </div>
          <div className="flex gap-1">
            {record && (
              <>
                <Button variant="ghost" size="sm" className="text-xs h-7 w-7 p-0" onClick={() => onPrint(record, person)} title="প্রিন্ট">
                  <Printer className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="text-xs h-7 w-7 p-0" onClick={() => onEdit(record)} title="এডিট">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="text-xs h-7 w-7 p-0" onClick={() => onRefresh(person)} disabled={generatePending} title="রিফ্রেশ">
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={() => onIncrement(person)}>
              ইনক্রিমেন্ট
            </Button>
          </div>
        </div>

        {record ? (
          <div className="space-y-2">
            {/* Attendance Grid - 5 columns */}
            <div className="grid grid-cols-5 gap-1.5 text-center text-xs">
              <div className="bg-muted rounded p-1">
                <div className="font-bold">{record.working_days}</div>
                <div className="text-muted-foreground">কার্যদিবস</div>
              </div>
              <div className="bg-muted rounded p-1">
                <div className="font-bold text-primary">{record.present_days}</div>
                <div className="text-muted-foreground">উপস্থিত</div>
              </div>
              <div className="bg-muted rounded p-1 relative cursor-pointer group" onClick={() => onForgiveDays(record)}>
                <div className="font-bold text-destructive">{record.absent_days}</div>
                <div className="text-muted-foreground">অনুপস্থিত</div>
                <Pencil className="h-2.5 w-2.5 absolute top-0.5 right-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="bg-muted rounded p-1">
                <div className="font-bold text-amber-600">{record.off_days}</div>
                <div className="text-muted-foreground">ছুটি</div>
              </div>
              <div className="bg-primary/10 rounded p-1">
                <div className="font-bold">৳{displayFinal.toLocaleString()}</div>
                <div className="text-muted-foreground">চূড়ান্ত</div>
              </div>
            </div>

            {/* Deduction info */}
            {record.deduction > 0 && (
              <div className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1 flex justify-between">
                <span>কর্তন ({record.absent_days} দিন)</span>
                <span className="font-medium">-৳{record.deduction.toLocaleString()}</span>
              </div>
            )}

            {/* Bonus / Overtime / Advance badges */}
            {((record.bonus_amount || 0) > 0 || (record.overtime_amount || 0) > 0 || advanceAmt > 0) && (
              <div className="flex gap-1.5 flex-wrap">
                {(record.bonus_amount || 0) > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 font-medium">
                    🎁 +৳{Number(record.bonus_amount).toLocaleString()}
                  </span>
                )}
                {(record.overtime_amount || 0) > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 font-medium">
                    ⏱️ +৳{Number(record.overtime_amount).toLocaleString()}
                  </span>
                )}
                {advanceAmt > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 font-medium" title={record.advance_note || ''}>
                    🪙 অগ্রিম −৳{advanceAmt.toLocaleString()}
                  </span>
                )}
              </div>
            )}

            {displayFinal <= 0 ? (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 text-xs h-7" onClick={() => onIncrement(person)}>
                  বেতন সেট করুন
                </Button>
                <Button variant="outline" size="sm" className="flex-1 text-xs h-7" onClick={() => onBonus(person)}>
                  🎁 বোনাস
                </Button>
              </div>
            ) : record.is_paid ? (
              <div className="space-y-1.5">
                <div className="text-center text-xs font-medium text-primary">✓ পরিশোধিত (৳{displayFinal.toLocaleString()})</div>
                <div className="grid grid-cols-2 gap-1.5">
                  <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => onAdvance(record)}>
                    <Coins className="h-3.5 w-3.5 mr-1" /> অগ্রিম নিয়েছে
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => onBonus(person)}>🎁 বোনাস</Button>
                  <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => onEdit(record)}>এডিট</Button>
                  <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => onPrint(record, person)}>প্রিন্ট</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                {(paidAmt > 0 || advanceAmt > 0) && (
                  <div className="flex items-center justify-between text-xs bg-muted/50 rounded p-1.5 flex-wrap gap-1">
                    <span>দেওয়া: ৳{paidAmt.toLocaleString()}{advanceAmt > 0 ? ` · অগ্রিম: ৳${advanceAmt.toLocaleString()}` : ''}</span>
                    <span className="font-medium">বাকি: ৳{displayRemaining.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex gap-1.5">
                  <Button size="sm" className="flex-1 text-xs h-7" onClick={() => onFullPay(record)} disabled={payPending}>
                    💰 পুরো দাও
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 text-xs h-7" onClick={() => onPartialPay(record)} disabled={payPending}>
                    💵 আংশিক
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs h-7 px-2" onClick={() => onAdvance(record)} title="অগ্রিম নিয়েছে">
                    <Coins className="h-3.5 w-3.5 mr-1" /> অগ্রিম নিয়েছে
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => onBonus(person)}>
                    🎁
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => onEdit(record)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 text-xs h-7" onClick={() => onGenerate(person)} disabled={generatePending}>
                📊 জেনারেট
              </Button>
              <Button variant="outline" size="sm" className="flex-1 text-xs h-7" onClick={() => onBonus(person)}>
                🎁 বোনাস
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
