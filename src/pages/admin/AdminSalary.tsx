import { useState, useMemo, useEffect, useRef } from 'react';
import { usePersons } from '@/hooks/usePersons';
import { useAccounts } from '@/hooks/useAccounting';
import { isSalaryMonthBeforeJoining, useSalaryRecords, useGenerateSalary, usePaySalary, useCreateIncrement, useUpdateSalaryRecord } from '@/hooks/useSalary';
import { supabase } from '@/integrations/supabase/client';
import SalaryEmployeeCard from '@/components/admin/SalaryEmployeeCard';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { getDaysInMonth } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toLocalDateStr } from '@/lib/utils';
import { openSalarySlip } from '@/lib/salaryPrint';
import { calculateMonthlySalary, salaryFormulaFinal } from '@/lib/salaryMath';
import { useSiteConfig, DEFAULT_NAVBAR_CONFIG } from '@/hooks/useSiteConfig';

const months = [
  { value: 1, label: 'জানুয়ারি' }, { value: 2, label: 'ফেব্রুয়ারি' }, { value: 3, label: 'মার্চ' },
  { value: 4, label: 'এপ্রিল' }, { value: 5, label: 'মে' }, { value: 6, label: 'জুন' },
  { value: 7, label: 'জুলাই' }, { value: 8, label: 'আগস্ট' }, { value: 9, label: 'সেপ্টেম্বর' },
  { value: 10, label: 'অক্টোবর' }, { value: 11, label: 'নভেম্বর' }, { value: 12, label: 'ডিসেম্বর' },
];

export default function AdminSalary() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const { data: allPersons = [] } = usePersons();
  const persons = useMemo(() => allPersons.filter(p => p.type === 'employee' || p.type === 'salaried_production'), [allPersons]);
  const selectedMonthPersons = useMemo(
    () => persons.filter(p => p.salary_type === 'monthly' && !isSalaryMonthBeforeJoining(month, year, p.joining_date)),
    [persons, month, year]
  );
  const { data: accounts = [] } = useAccounts();
  const { data: salaryRecords = [], isLoading } = useSalaryRecords(month, year);
  const generateSalary = useGenerateSalary();
  const paySalary = usePaySalary();
  const createIncrement = useCreateIncrement();
  const updateSalaryRecord = useUpdateSalaryRecord();

  const [incOpen, setIncOpen] = useState(false);
  const [incPerson, setIncPerson] = useState<any>(null);
  const [newSalary, setNewSalary] = useState('');
  const [incNote, setIncNote] = useState('');

  const [partialOpen, setPartialOpen] = useState(false);
  const [partialRecord, setPartialRecord] = useState<any>(null);
  const [partialAmount, setPartialAmount] = useState('');
  const [partialDate, setPartialDate] = useState(toLocalDateStr());

  // Advance dialog (simple — separate from payment)
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [advanceRecord, setAdvanceRecord] = useState<any>(null);
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceNote, setAdvanceNote] = useState('');

  const [bonusOpen, setBonusOpen] = useState(false);
  const [bonusPerson, setBonusPerson] = useState<any>(null);
  const [bonusAmount, setBonusAmount] = useState('');

  // Forgive dialog state
  const [forgiveOpen, setForgiveOpen] = useState(false);
  const [forgiveRecord, setForgiveRecord] = useState<any>(null);
  const [forgiveDays, setForgiveDays] = useState('');

  const [editOpen, setEditOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<any>(null);
  const [editSalaryForm, setEditSalaryForm] = useState({
    base_salary: '', deduction: '', bonus_amount: '', bonus_note: '',
    overtime_amount: '', overtime_note: '', final_salary: '', received_amount: '', received_note: '',
    advance_amount: '', advance_note: '',
  });

  const cashAccount = accounts.find(a => a.type === 'cash');
  const totalDays = getDaysInMonth(new Date(year, month - 1));

  const openEditRecord = (record: any) => {
    setEditRecord(record);
    setEditSalaryForm({
      base_salary: String(record.base_salary || 0),
      deduction: String(record.deduction || 0),
      bonus_amount: String(record.bonus_amount || 0),
      bonus_note: record.bonus_note || '',
      overtime_amount: String(record.overtime_amount || 0),
      overtime_note: record.overtime_note || '',
      final_salary: String(record.final_salary || 0),
      received_amount: String(record.received_amount || record.paid_amount || 0),
      received_note: record.received_note || '',
      advance_amount: String(record.advance_amount || 0),
      advance_note: record.advance_note || '',
    });
    setEditOpen(true);
  };

  const updateEditField = (field: string, value: string) => {
    setEditSalaryForm(prev => {
      const next = { ...prev, [field]: value };
      if (['base_salary', 'deduction', 'bonus_amount', 'overtime_amount'].includes(field)) {
        const base = Number(next.base_salary) || 0;
        const deduction = Number(next.deduction) || 0;
        const bonus = Number(next.bonus_amount) || 0;
        const overtime = Number(next.overtime_amount) || 0;
        next.final_salary = String(Math.max(0, base - deduction + bonus + overtime));
      }
      return next;
    });
  };

  const handleEditSalarySubmit = async () => {
    if (!editRecord) return;
    const finalSalary = Number(editSalaryForm.final_salary) || 0;
    try {
      await updateSalaryRecord.mutateAsync({
        id: editRecord.id,
        base_salary: Number(editSalaryForm.base_salary) || 0,
        deduction: Number(editSalaryForm.deduction) || 0,
        bonus_amount: Number(editSalaryForm.bonus_amount) || 0,
        bonus_note: editSalaryForm.bonus_note || null,
        overtime_amount: Number(editSalaryForm.overtime_amount) || 0,
        overtime_note: editSalaryForm.overtime_note || null,
        received_amount: Number(editSalaryForm.received_amount) || 0,
        received_note: editSalaryForm.received_note || null,
        advance_amount: Number(editSalaryForm.advance_amount) || 0,
        advance_note: editSalaryForm.advance_note || null,
        final_salary: finalSalary,
      });
      toast.success('বেতন কার্ড আপডেট হয়েছে');
      setEditOpen(false); setEditRecord(null);
    } catch (e: any) { toast.error(e.message || 'আপডেট হয়নি'); }
  };

  const { data: navbarConfig } = useSiteConfig('navbar_config');
  const brandBn = (navbarConfig as any)?.brand_name || DEFAULT_NAVBAR_CONFIG.brand_name;
  const brandEn = (navbarConfig as any)?.brand_name_en || DEFAULT_NAVBAR_CONFIG.brand_name_en;

  const handlePrintRecord = (record: any, person: any) => {
    openSalarySlip({
      personName: person.name,
      personId: person.id,
      joiningDate: person.joining_date,
      unitName: person.unit_name || null,
      brandNameBn: brandBn,
      brandNameEn: brandEn,
      record: {
        ...record,
        final_salary: salaryFormulaFinal(record),
      },
      totalDaysInMonth: totalDays,
    });
  };

  const handleGenerate = async (person: any) => {
    const endMonth = month === 12 ? 1 : month + 1;
    const endYear = month === 12 ? year + 1 : year;
    const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;
    if (isSalaryMonthBeforeJoining(month, year, person.joining_date)) {
      toast.error('যোগদানের আগের মাসের বেতন তৈরি করা যাবে না');
      return;
    }
    const now = new Date();
    const isCurrentSelected = year === now.getFullYear() && month === now.getMonth() + 1;
    const endDay = isCurrentSelected ? now.getDate() : totalDays;

    const { data: attendance } = await (supabase.from('acc_attendance' as any) as any)
      .select('date,status')
      .eq('person_id', person.id)
      .gte('date', `${year}-${String(month).padStart(2, '0')}-01`)
      .lt('date', endDate);
    const { data: offDayRows } = await (supabase.from('acc_off_days' as any) as any)
      .select('day_of_week')
      .eq('person_id', person.id);

    const baseSalary = person.base_salary || 0;
    const calc = calculateMonthlySalary({
      year, month, baseSalary,
      joiningDate: person.joining_date,
      attendanceRows: attendance || [],
      offDays: (offDayRows || []).map((r: any) => r.day_of_week),
      endDay,
    });

    try {
      await generateSalary.mutateAsync({
        person_id: person.id, month, year, working_days: calc.workingDays,
        present_days: calc.presentDays + calc.lateDays, absent_days: calc.absentDays, off_days: calc.offDays,
        base_salary: baseSalary, deduction: calc.deduction, final_salary: baseSalary - calc.deduction,
      });
      toast.success(`${person.name} এর বেতন জেনারেট/আপডেট হয়েছে`);
    } catch (e: any) { toast.error(e.message); }
  };

  const handlePay = async (record: any, amount: number, payment_date?: string) => {
    if (!cashAccount) { toast.error('ক্যাশ একাউন্ট পাওয়া যায়নি'); return; }
    try {
      await paySalary.mutateAsync({
        salary_record_id: record.id, person_id: record.person_id,
        amount, account_id: cashAccount.id, final_salary: salaryFormulaFinal(record),
        payment_date, person_name: record.acc_persons?.name,
      });
      toast.success(`৳${amount.toLocaleString()} দেওয়া হয়েছে`);
    } catch (e: any) { toast.error(e.message); }
  };

  const handleFullPay = (record: any) => {
    const remaining = salaryFormulaFinal(record) - (record.paid_amount || 0) - (record.advance_amount || 0);
    handlePay(record, remaining);
  };

  const handlePartialSubmit = async () => {
    if (!partialRecord) return;
    const amount = Number(partialAmount || 0);
    const currentAdvance = Number(partialRecord.advance_amount || 0);
    const remaining = salaryFormulaFinal(partialRecord) - (partialRecord.paid_amount || 0) - currentAdvance;

    if (amount <= 0 || amount > remaining) {
      toast.error(`পরিমাণ ১ থেকে ৳${remaining.toLocaleString()} এর মধ্যে হতে হবে`);
      return;
    }
    await handlePay(partialRecord, amount, partialDate);

    setPartialOpen(false);
    setPartialRecord(null);
    setPartialAmount('');
    setPartialDate(toLocalDateStr());
  };

  const handleAdvanceSubmit = async () => {
    if (!advanceRecord) return;
    const amount = Number(advanceAmount || 0);
    if (amount < 0) { toast.error('অগ্রিম ০ এর কম হতে পারে না'); return; }
    try {
      await updateSalaryRecord.mutateAsync({
        id: advanceRecord.id,
        final_salary: salaryFormulaFinal(advanceRecord),
        advance_amount: amount,
        advance_note: advanceNote || null,
      });
      toast.success('অগ্রিম সংরক্ষণ হয়েছে');
      setAdvanceOpen(false);
      setAdvanceRecord(null);
      setAdvanceAmount('');
      setAdvanceNote('');
    } catch (e: any) {
      toast.error(e.message || 'অগ্রিম সংরক্ষণ ব্যর্থ');
    }
  };

  const handleIncrement = async () => {
    if (!incPerson || !newSalary) return;
    try {
      await createIncrement.mutateAsync({
        person_id: incPerson.id,
        old_salary: incPerson.base_salary || 0,
        new_salary: Number(newSalary),
        effective_date: new Date().toISOString().split('T')[0],
        note: incNote,
      });
      toast.success('ইনক্রিমেন্ট হয়েছে');
      setIncOpen(false); setIncPerson(null); setNewSalary(''); setIncNote('');
    } catch (e: any) { toast.error(e.message); }
  };

  const handleBonusSubmit = async () => {
    if (!bonusPerson || !bonusAmount) return;
    const amount = Number(bonusAmount);
    if (amount <= 0) { toast.error('পরিমাণ ০ এর বেশি হতে হবে'); return; }
    try {
      const record = recordMap[bonusPerson.id];
      if (!record) { toast.error('আগে এই মাসের বেতন জেনারেট করুন'); return; }
      const newBonusTotal = Number(record.bonus_amount || 0) + amount;
      // Recompute from base/deduction so deduction is never lost
      const correctedFinal = Math.max(
        0,
        Number(record.base_salary || 0)
          - Number(record.deduction || 0)
          + newBonusTotal
          + Number(record.overtime_amount || 0)
      );
      await updateSalaryRecord.mutateAsync({
        id: record.id,
        bonus_amount: newBonusTotal,
        bonus_note: record.bonus_note || null,
        final_salary: correctedFinal,
      });
      toast.success(`৳${amount.toLocaleString()} বোনাস বেতনের সাথে যোগ হয়েছে`);
      setBonusOpen(false); setBonusPerson(null); setBonusAmount('');
    } catch (e: any) { toast.error(e.message); }
  };

  const handleForgiveSubmit = async () => {
    if (!forgiveRecord || !forgiveDays) return;
    const forgiven = Number(forgiveDays);
    if (forgiven < 0 || forgiven > forgiveRecord.absent_days) {
      toast.error(`ক্ষমা দিন ০ থেকে ${forgiveRecord.absent_days} এর মধ্যে হতে হবে`);
      return;
    }
    const newAbsentDays = forgiveRecord.absent_days - forgiven;
    const baseSalary = forgiveRecord.base_salary;
    const perDay = totalDays > 0 ? baseSalary / totalDays : 0;
    const newDeduction = Math.round(perDay * newAbsentDays);
    const newFinalSalary = baseSalary - newDeduction + Number(forgiveRecord.bonus_amount || 0) + Number(forgiveRecord.overtime_amount || 0);

    try {
      await updateSalaryRecord.mutateAsync({
        id: forgiveRecord.id,
        absent_days: newAbsentDays,
        deduction: newDeduction,
        final_salary: newFinalSalary,
      });
      toast.success(`${forgiven} দিন ক্ষমা করা হয়েছে`);
      setForgiveOpen(false); setForgiveRecord(null); setForgiveDays('');
    } catch (e: any) { toast.error(e.message); }
  };

  const recordMap = useMemo(() => {
    const map: Record<string, any> = {};
    salaryRecords.forEach(r => { map[r.person_id] = r; });
    return map;
  }, [salaryRecords]);

  // Auto-generate salary records for persons who don't have one yet
  const autoGenRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (isLoading || persons.length === 0) return;
    // Only auto-generate for current or past months
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    if (year > currentYear || (year === currentYear && month >= currentMonth)) return;

    const missing = selectedMonthPersons
      .filter(p => !recordMap[p.id] && !autoGenRef.current.has(`${p.id}-${month}-${year}`));
    
    if (missing.length === 0) return;
    
    missing.forEach(p => {
      autoGenRef.current.add(`${p.id}-${month}-${year}`);
      handleGenerate(p);
    });
  }, [isLoading, selectedMonthPersons, recordMap, month, year]);

  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/admin/accounting')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">বেতন ব্যবস্থাপনা</h1>
            <p className="text-sm text-muted-foreground">মাসিক বেতন হিসাব ও প্রদান</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {months.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {cashAccount && (
        <Card>
          <CardContent className="p-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">ক্যাশ ব্যালেন্স</span>
            <span className="text-lg font-bold">৳{cashAccount.balance.toLocaleString()}</span>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">লোড হচ্ছে...</div>
      ) : (
        <div className="space-y-2">
          {selectedMonthPersons.map(person => {
            const record = recordMap[person.id];
            return (
              <SalaryEmployeeCard
                key={person.id}
                person={person}
                record={record}
                month={month}
                year={year}
                onGenerate={handleGenerate}
                onFullPay={handleFullPay}
                onPartialPay={(r) => { setPartialRecord(r); setPartialAmount(''); setPartialOpen(true); }}
                onIncrement={(p) => { setIncPerson(p); setIncOpen(true); }}
                onBonus={(p) => { setBonusPerson(p); setBonusAmount(''); setBonusOpen(true); }}
                onAdvance={(r) => {
                  setAdvanceRecord(r);
                  setAdvanceAmount(String(r.advance_amount || ''));
                  setAdvanceNote(r.advance_note || '');
                  setAdvanceOpen(true);
                }}
                onEdit={openEditRecord}
                onPrint={handlePrintRecord}
                onRefresh={handleGenerate}
                onForgiveDays={(r) => { setForgiveRecord(r); setForgiveDays(''); setForgiveOpen(true); }}
                generatePending={generateSalary.isPending}
                payPending={paySalary.isPending}
              />
            );
          })}
          {selectedMonthPersons.length === 0 && (
            <div className="text-center py-10 text-muted-foreground">কোনো মাসিক বেতনভোগী কর্মচারী নেই</div>
          )}
        </div>
      )}

      {/* Partial Payment Dialog */}
      <Dialog open={partialOpen} onOpenChange={setPartialOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>আংশিক বেতন প্রদান</DialogTitle></DialogHeader>
          {partialRecord && (
            <div className="space-y-3">
              {(() => {
                const correctedFinal = salaryFormulaFinal(partialRecord);
                const currentAdvance = Number(partialRecord.advance_amount || 0);
                const remaining = correctedFinal - (partialRecord.paid_amount || 0) - currentAdvance;
                return (
                  <>
              <div className="text-sm bg-muted rounded p-3 space-y-1">
                <div className="flex justify-between"><span>চূড়ান্ত বেতন:</span><span className="font-bold">৳{correctedFinal.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>ইতোমধ্যে দেওয়া:</span><span>৳{(partialRecord.paid_amount || 0).toLocaleString()}</span></div>
                {currentAdvance > 0 && (
                  <div className="flex justify-between text-blue-700 dark:text-blue-400"><span>🪙 অগ্রিম নিয়েছে:</span><span>৳{currentAdvance.toLocaleString()}</span></div>
                )}
                <div className="flex justify-between font-medium border-t pt-1 mt-1"><span>চূড়ান্ত পাওনা:</span><span>৳{remaining.toLocaleString()}</span></div>
              </div>
              <div>
                <Label>পরিমাণ (৳) — এখন দিচ্ছেন</Label>
                <Input type="number" value={partialAmount} onChange={e => setPartialAmount(e.target.value)} placeholder={`সর্বোচ্চ ৳${remaining.toLocaleString()}`} />
              </div>
              <div className="rounded border border-blue-200 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20 p-2.5 space-y-2">
                <div className="text-[11px] text-blue-700 dark:text-blue-300 font-medium">
                  🪙 অগ্রিম যোগ করতে চাইলে কার্ডের 🪙 বাটন ব্যবহার করুন।
                </div>
              </div>
                  </>
                );
              })()}
              <Button onClick={handlePartialSubmit} disabled={paySalary.isPending} className="w-full">
                💵 প্রদান করুন
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Advance Dialog */}
      <Dialog open={advanceOpen} onOpenChange={setAdvanceOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>🪙 অগ্রিম — {advanceRecord?.acc_persons?.name || ''}</DialogTitle></DialogHeader>
          {advanceRecord && (
            <div className="space-y-3">
              {(() => {
                const finalSal = salaryFormulaFinal(advanceRecord);
                const advNow = Number(advanceAmount || 0);
                const paid = Number(advanceRecord.paid_amount || 0);
                const willBe = Math.max(0, finalSal - paid - advNow);
                return (
                  <div className="text-sm bg-muted rounded p-3 space-y-1">
                    <div className="flex justify-between"><span>মোট বেতন:</span><span className="font-bold">৳{finalSal.toLocaleString()}</span></div>
                    {paid > 0 && <div className="flex justify-between"><span>ইতোমধ্যে দেওয়া:</span><span>৳{paid.toLocaleString()}</span></div>}
                    <div className="flex justify-between text-blue-700 dark:text-blue-400"><span>অগ্রিম নিয়েছে:</span><span>−৳{advNow.toLocaleString()}</span></div>
                    <div className="flex justify-between font-bold border-t pt-1 mt-1"><span>এখন পাবে:</span><span>৳{willBe.toLocaleString()}</span></div>
                  </div>
                );
              })()}
              <div>
                <Label>অগ্রিম পরিমাণ (৳)</Label>
                <Input type="number" value={advanceAmount} onChange={e => setAdvanceAmount(e.target.value)} placeholder="যেমন: 2000" autoFocus />
              </div>
              <div>
                <Label>নোট (ঐচ্ছিক)</Label>
                <Input value={advanceNote} onChange={e => setAdvanceNote(e.target.value)} placeholder="যেমন: ১০ তারিখে নগদ" />
              </div>
              <div className="text-[10px] text-muted-foreground leading-snug bg-muted/50 rounded p-2">
                ⚠️ অগ্রিম শুধু পাওনা হিসাব ক্লিয়ার দেখানোর জন্য — মূল বেতন/উপস্থিতি/বোনাসে কোনো প্রভাব পড়বে না। প্রিন্ট মেমোতে দেখাবে: মোট বেতন − অগ্রিম = এখন পাবে।
              </div>
              <Button onClick={handleAdvanceSubmit} disabled={updateSalaryRecord.isPending} className="w-full">
                সংরক্ষণ করুন
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Increment Dialog */}
      <Dialog open={incOpen} onOpenChange={setIncOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>বেতন ইনক্রিমেন্ট — {incPerson?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>বর্তমান বেতন</Label>
              <Input value={`৳${(incPerson?.base_salary || 0).toLocaleString()}`} disabled />
            </div>
            <div>
              <Label>নতুন বেতন (৳)</Label>
              <Input type="number" value={newSalary} onChange={e => setNewSalary(e.target.value)} />
            </div>
            <div>
              <Label>নোট (ঐচ্ছিক)</Label>
              <Input value={incNote} onChange={e => setIncNote(e.target.value)} />
            </div>
            <Button onClick={handleIncrement} disabled={createIncrement.isPending} className="w-full">
              সেভ করুন
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bonus Dialog */}
      <Dialog open={bonusOpen} onOpenChange={setBonusOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>🎁 বোনাস প্রদান — {bonusPerson?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-sm bg-muted rounded p-3">
              <div className="flex justify-between"><span>মূল বেতন:</span><span className="font-bold">৳{(bonusPerson?.base_salary || 0).toLocaleString()}</span></div>
            </div>
            <div>
              <Label>পরিমাণ (৳)</Label>
              <Input type="number" value={bonusAmount} onChange={e => setBonusAmount(e.target.value)} placeholder="বোনাস পরিমাণ" />
            </div>
            <Button onClick={handleBonusSubmit} disabled={updateSalaryRecord.isPending} className="w-full">
              🎁 বোনাস দাও
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Salary Card Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>বেতন কার্ড এডিট — {editRecord?.acc_persons?.name || editRecord?.person_id}</DialogTitle></DialogHeader>
          {editRecord && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>মূল বেতন</Label><Input type="number" value={editSalaryForm.base_salary} onChange={e => updateEditField('base_salary', e.target.value)} /></div>
                <div><Label>কর্তন</Label><Input type="number" value={editSalaryForm.deduction} onChange={e => updateEditField('deduction', e.target.value)} /></div>
                <div><Label>বোনাস</Label><Input type="number" value={editSalaryForm.bonus_amount} onChange={e => updateEditField('bonus_amount', e.target.value)} /></div>
                <div><Label>ওভারটাইম</Label><Input type="number" value={editSalaryForm.overtime_amount} onChange={e => updateEditField('overtime_amount', e.target.value)} /></div>
              </div>
              <div><Label>বোনাস নোট</Label><Input value={editSalaryForm.bonus_note} onChange={e => updateEditField('bonus_note', e.target.value)} /></div>
              <div><Label>ওভারটাইম নোট</Label><Input value={editSalaryForm.overtime_note} onChange={e => updateEditField('overtime_note', e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>নিয়েছে / জমা</Label><Input type="number" value={editSalaryForm.received_amount} onChange={e => updateEditField('received_amount', e.target.value)} /></div>
                <div><Label>চূড়ান্ত বেতন</Label><Input type="number" value={editSalaryForm.final_salary} onChange={e => updateEditField('final_salary', e.target.value)} className="font-bold" /></div>
              </div>
              <div><Label>জমার নোট</Label><Input value={editSalaryForm.received_note} onChange={e => updateEditField('received_note', e.target.value)} /></div>
              <div className="rounded border border-blue-200 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20 p-2.5 space-y-2">
                <Label className="text-blue-700 dark:text-blue-300">🪙 অগ্রিম (Advance)</Label>
                <Input type="number" value={editSalaryForm.advance_amount} onChange={e => updateEditField('advance_amount', e.target.value)} placeholder="অগ্রিম পরিমাণ" />
                <Input value={editSalaryForm.advance_note} onChange={e => updateEditField('advance_note', e.target.value)} placeholder="অগ্রিমের নোট" />
                <div className="text-[10px] text-muted-foreground">শুধু পাওনা ক্লিয়ার দেখানোর জন্য — মূল বেতনের কোনো পরিবর্তন হবে না।</div>
              </div>
              <div className="rounded bg-primary/10 p-3 text-sm flex justify-between">
                <span>বাকি / পাওনা</span>
                <span className="font-bold">৳{Math.max(0, (Number(editSalaryForm.final_salary) || 0) - (Number(editSalaryForm.received_amount) || 0) - (Number(editSalaryForm.advance_amount) || 0)).toLocaleString()}</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setEditOpen(false)}>বাতিল</Button>
                <Button className="flex-1" onClick={handleEditSalarySubmit} disabled={updateSalaryRecord.isPending}>সেভ করুন</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Forgive Days Dialog */}
      <Dialog open={forgiveOpen} onOpenChange={setForgiveOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>অনুপস্থিত দিন ক্ষমা</DialogTitle></DialogHeader>
          {forgiveRecord && (
            <div className="space-y-3">
              <div className="text-sm bg-muted rounded p-3 space-y-1">
                <div className="flex justify-between"><span>মোট অনুপস্থিত:</span><span className="font-bold">{forgiveRecord.absent_days} দিন</span></div>
                <div className="flex justify-between"><span>মূল বেতন:</span><span>৳{forgiveRecord.base_salary.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>বর্তমান কর্তন:</span><span className="text-destructive">৳{forgiveRecord.deduction.toLocaleString()}</span></div>
              </div>
              <div>
                <Label>কত দিন ক্ষমা করবেন?</Label>
                <Input
                  type="number"
                  value={forgiveDays}
                  onChange={e => setForgiveDays(e.target.value)}
                  placeholder={`সর্বোচ্চ ${forgiveRecord.absent_days} দিন`}
                  min={0}
                  max={forgiveRecord.absent_days}
                />
              </div>
              {forgiveDays && Number(forgiveDays) > 0 && Number(forgiveDays) <= forgiveRecord.absent_days && (
                <div className="text-sm bg-primary/10 rounded p-3 space-y-1">
                  <div className="flex justify-between"><span>ক্ষমার পর অনুপস্থিত:</span><span className="font-bold">{forgiveRecord.absent_days - Number(forgiveDays)} দিন</span></div>
                  <div className="flex justify-between">
                    <span>নতুন কর্তন:</span>
                    <span className="font-bold">
                      ৳{Math.round(
                        (forgiveRecord.working_days > 0 ? forgiveRecord.base_salary / forgiveRecord.working_days : 0) *
                        (forgiveRecord.absent_days - Number(forgiveDays))
                      ).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>নতুন চূড়ান্ত বেতন:</span>
                    <span className="font-bold text-primary">
                      ৳{(forgiveRecord.base_salary - Math.round(
                        (forgiveRecord.working_days > 0 ? forgiveRecord.base_salary / forgiveRecord.working_days : 0) *
                        (forgiveRecord.absent_days - Number(forgiveDays))
                      )).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
              <Button onClick={handleForgiveSubmit} disabled={updateSalaryRecord.isPending} className="w-full">
                ✅ ক্ষমা করুন
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
