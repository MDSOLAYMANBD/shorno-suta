import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import AccountingShareButton from '@/components/admin/AccountingShareButton';
import { buildUnitSlug } from '@/lib/hishabSlug';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useUnits, useTransactions, useTransactionSummary, useUnitMaterials, useCreateUnitMaterial, useDeleteUnitMaterial, useUnitFixedExpenses, useCreateUnitFixedExpense, useDeleteUnitFixedExpense, useUnitCustomExpenses, useCreateUnitCustomExpense, useDeleteUnitCustomExpense, useUpdateUnit, type UnitCustomExpense } from '@/hooks/useAccounting';
import { usePersons, useCreatePerson, type AccPerson } from '@/hooks/usePersons';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Users, DollarSign, TrendingDown, TrendingUp, ChevronLeft, ChevronRight, Trash2, Package, Receipt, Banknote, CircleDollarSign, ClipboardList, Pin, Clock, Landmark, ChevronDown, Building2, Home } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { format } from 'date-fns';
import { toLocalDateStr } from '@/lib/utils';
import { useWorkOrders, useAllWorkOrderEntries } from '@/hooks/useWorkOrders';
import { useSiteConfig, DEFAULT_NAVBAR_CONFIG } from '@/hooks/useSiteConfig';
import { isSalaryMonthBeforeJoining } from '@/hooks/useSalary';
import { useRentPayments } from '@/hooks/useRent';
import RentCard from '@/components/admin/accounting/RentCard';
import PayRentDialog from '@/components/admin/accounting/PayRentDialog';

// ========== UNIT COLOR MAPPING ==========
function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 65%, 45%)`;
}

function getUnitStyle(unitId: string | null, unitName?: string | null): { color: string; label: string } {
  const name = (unitName || '').toLowerCase();
  if (name.includes('অফিস') || name.includes('office')) return { color: '#16a34a', label: unitName || 'অফিস' };
  if (name.includes('সাপ্লায়ার') || name.includes('supplier')) return { color: '#ea580c', label: unitName || 'সাপ্লায়ার' };
  if (name.includes('সেউইং') || name.includes('কারখানা') || name.includes('factory') || name.includes('sewing')) return { color: '#6B1E2B', label: unitName || 'সেউইং ফ্যাক্টরি' };
  if (name.includes('print') || name.includes('প্রিন্ট')) return { color: '#7c3aed', label: unitName || 'Print' };
  return { color: hashColor(unitName || 'unit'), label: unitName || 'Staff' };
}

const DEBIT_TYPES = ['salary', 'production_payment', 'party_payment', 'expense', 'advance', 'bonus'];
const BANGLA_MONTHS = ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];

function DutyTimeSection({ unitId, unitSettings, updateUnit, unitStyle }: { unitId: string; unitSettings: any; updateUnit: any; unitStyle: { color: string } }) {
  const [localStart, setLocalStart] = useState((unitSettings as any).duty_start || '09:00');
  const [localEnd, setLocalEnd] = useState((unitSettings as any).duty_end || '18:00');
  const [dirty, setDirty] = useState(false);

  const handleSave = async () => {
    try {
      await updateUnit.mutateAsync({ id: unitId, settings: { ...unitSettings, duty_start: localStart, duty_end: localEnd } });
      setDirty(false);
      toast.success('ডিউটি টাইম সেভ হয়েছে');
    } catch {
      toast.error('সেভ ব্যর্থ');
    }
  };

  return (
    <div className="flex items-center gap-2 px-1 py-1.5 rounded-lg border border-border/50 bg-muted/20">
      <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-2" />
      <span className="text-[11px] font-medium text-muted-foreground shrink-0">ডিউটি:</span>
      <Input type="time" value={localStart} onChange={e => { setLocalStart(e.target.value); setDirty(true); }} className="w-24 h-7 text-xs" />
      <span className="text-[10px] text-muted-foreground">—</span>
      <Input type="time" value={localEnd} onChange={e => { setLocalEnd(e.target.value); setDirty(true); }} className="w-24 h-7 text-xs" />
      {dirty && (
        <Button size="sm" variant="outline" className="h-7 text-[11px] px-2" onClick={handleSave} disabled={updateUnit.isPending}>
          সেভ
        </Button>
      )}
    </div>
  );
}

export default function AdminUnitProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: units = [] } = useUnits();
  const { data: allPersons = [], isLoading } = usePersons({ unit_id: id });

  const unit = useMemo(() => units.find(u => u.id === id), [units, id]);
  const isOffice = unit?.name === 'অফিস' || (unit?.name || '').toLowerCase().includes('office');
  const isSupplier = unit?.name === 'সাপ্লায়ার' || (unit?.name || '').toLowerCase().includes('supplier');
  const isPrintUnit = (unit?.name || '').includes('প্রিন্ট') || (unit?.name || '').toLowerCase().includes('print');

  // Find child unit IDs for expense aggregation
  const supplierUnit = useMemo(() => units.find(u => u.name === 'সাপ্লায়ার' || u.name.toLowerCase().includes('supplier')), [units]);
  const printUnit = useMemo(() => units.find(u => u.name.toLowerCase().includes('print') || u.name.includes('প্রিন্ট')), [units]);
  const factoryUnit = useMemo(() => units.find(u => u.name.toLowerCase().includes('factory') || u.name.includes('সেউইং') || u.name.includes('কারখানা')), [units]);

  // Build aggregated unit IDs for expense chain
  const aggregatedUnitIds = useMemo(() => {
    if (!id) return [];
    if (isOffice) {
      // Office sees all: office + supplier + print + factory
      return [id, supplierUnit?.id, printUnit?.id, factoryUnit?.id].filter(Boolean) as string[];
    }
    if (isSupplier) {
      // Supplier sees: supplier + print + factory
      return [id, printUnit?.id, factoryUnit?.id].filter(Boolean) as string[];
    }
    return [id];
  }, [id, isOffice, isSupplier, supplierUnit, printUnit, factoryUnit]);

  // Aggregated expense query for supplier/office chains
  const needsAggregation = (isOffice || isSupplier) && aggregatedUnitIds.length > 1;
  const { data: aggregatedTxs = [] } = useQuery({
    queryKey: ['aggregated-unit-expenses', aggregatedUnitIds],
    enabled: needsAggregation,
    queryFn: async () => {
      const { data, error } = await (supabase.from('acc_transactions' as any) as any)
        .select('type, amount, unit_id, description, created_at')
        .in('unit_id', aggregatedUnitIds);
      if (error) throw error;
      return (data || []) as { type: string; amount: number; unit_id: string; description: string | null; created_at: string }[];
    },
  });

  // Work order data for wage/work value cards
  const { data: workOrders = [] } = useWorkOrders(id);
  const workOrderIds = useMemo(() => workOrders.map(w => w.id), [workOrders]);
  const { data: allWoEntries = [] } = useAllWorkOrderEntries(workOrderIds);
  const { data: navbarConfig } = useSiteConfig('navbar_config');

  const unitSettings = unit?.settings || {};

  const { data: allUnitTx = [] } = useTransactions({ unit_id: id });
  const { data: txSummary } = useTransactionSummary();

  // ===== Salary / Production / Party balance queries (for Analytics) =====
  const unitPersonIds = useMemo(() => allPersons.map(p => p.id), [allPersons]);
  const nowDate = new Date();
  const curMonth = nowDate.getMonth() + 1;
  const curYear = nowDate.getFullYear();

  const { data: salaryRecordsCur = [] } = useQuery({
    queryKey: ['unit-salary-records', id, curMonth, curYear, unitPersonIds.length],
    enabled: unitPersonIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase.from('acc_salary_records' as any) as any)
        .select('person_id, final_salary, paid_amount')
        .eq('month', curMonth).eq('year', curYear)
        .in('person_id', unitPersonIds);
      if (error) throw error;
      return (data || []) as { person_id: string; final_salary: number; paid_amount: number }[];
    },
  });

  const { data: partyEntriesAll = [] } = useQuery({
    queryKey: ['unit-party-entries', id, unitPersonIds.length],
    enabled: unitPersonIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase.from('acc_party_entries' as any) as any)
        .select('person_id, total, is_submission')
        .in('person_id', unitPersonIds);
      if (error) throw error;
      return (data || []) as { person_id: string; total: number; is_submission: boolean }[];
    },
  });

  const { data: productionEntriesAll = [] } = useQuery({
    queryKey: ['unit-production-entries', id, unitPersonIds.length],
    enabled: unitPersonIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase.from('acc_production_entries' as any) as any)
        .select('person_id, total, is_submission')
        .in('person_id', unitPersonIds);
      if (error) throw error;
      return (data || []) as { person_id: string; total: number; is_submission: boolean }[];
    },
  });


  // Materials & Fixed Expenses
  const { data: materials = [] } = useUnitMaterials(unitSettings.has_materials ? id : undefined);
  const createMaterial = useCreateUnitMaterial();
  const deleteMaterial = useDeleteUnitMaterial();
  const [expMonth, setExpMonth] = useState(() => new Date().getMonth() + 1);
  const [expYear, setExpYear] = useState(() => new Date().getFullYear());
  // Fetch all fixed expenses (no month/year filter) so period selector can filter client-side
  const { data: fixedExpenses = [] } = useUnitFixedExpenses(unitSettings.has_fixed_expenses ? id : undefined);
  const createFixedExpense = useCreateUnitFixedExpense();
  const deleteFixedExpense = useDeleteUnitFixedExpense();

  // Rent
  const { data: rentPayments = [] } = useRentPayments(unitSettings.has_rent ? id : undefined);
  const [payRentOpen, setPayRentOpen] = useState(false);

  // Custom expense hooks
  const createCustomExpense = useCreateUnitCustomExpense();
  const deleteCustomExpense = useDeleteUnitCustomExpense();

  // Material dialog
  const [matOpen, setMatOpen] = useState(false);
  const [matForm, setMatForm] = useState({ item_name: '', quantity: '', unit_price: '', total: '', date: toLocalDateStr(), description: '' });

  // Fixed expense dialog
  const [feOpen, setFeOpen] = useState(false);
  const [feForm, setFeForm] = useState({ category: '', amount: '', description: '' });

  // Custom expense dialog
  const [customExpOpen, setCustomExpOpen] = useState(false);
  const [customExpModule, setCustomExpModule] = useState('');
  const [customExpForm, setCustomExpForm] = useState({ date: toLocalDateStr(), amount: '', description: '', memo_number: '', shop_name: '', shop_phone: '', shop_address: '', bill_amount: '', items: [{ name: '', goj: '', rate: '' }] as { name: string; goj: string; rate: string }[] });
  const isKaporModule = customExpModule === 'কাপর';
  const customTotalGoj = customExpForm.items.reduce((s, i) => s + (Number(i.goj) || 0), 0);
  const customTotalAmount = isKaporModule ? customExpForm.items.reduce((s, i) => s + ((Number(i.goj) || 0) * (Number(i.rate) || 0)), 0) : Number(customExpForm.amount) || 0;

  // + button states
  const createPerson = useCreatePerson();
  const updateUnit = useUpdateUnit();
  const [addPopoverOpen, setAddPopoverOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const isMobile = useIsMobile();
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonType, setNewPersonType] = useState('employee');
  const [newPersonPhone, setNewPersonPhone] = useState('');
  const [newPersonJoiningDate, setNewPersonJoiningDate] = useState('');
  const [newPersonBaseSalary, setNewPersonBaseSalary] = useState('');
  const [newPersonSalaryType, setNewPersonSalaryType] = useState('monthly');
  const [addPersonDialogOpen, setAddPersonDialogOpen] = useState(false);
  const [loanForm, setLoanForm] = useState({ principal_amount: '', interest_rate: '', total_installments: '', monthly_installment: '', start_date: '', tracking_start_date: '' });
  const [newModuleName, setNewModuleName] = useState('');
  const [newModuleType, setNewModuleType] = useState('simple');

  // Active module for inline expansion (init from URL param)
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeModule, setActiveModule] = useState<string | null>(() => searchParams.get('module'));
  const [openAnalyticsModule, setOpenAnalyticsModule] = useState<string | null>(null);

  // Sync activeModule when URL param changes
  useEffect(() => {
    const mod = searchParams.get('module');
    if (mod) setActiveModule(mod);
  }, [searchParams]);

  // Pin states
  const pinKey = `pinned-chips-${id}`;
  const [pinnedItems, setPinnedItems] = useState<{ type: string; id: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem(pinKey) || '[]'); } catch { return []; }
  });
  const togglePin = (type: string, itemId: string) => {
    setPinnedItems(prev => {
      const exists = prev.some(p => p.type === type && p.id === itemId);
      const next = exists ? prev.filter(p => !(p.type === type && p.id === itemId)) : [...prev, { type, id: itemId }];
      localStorage.setItem(pinKey, JSON.stringify(next));
      return next;
    });
  };
  const isPinned = (type: string, itemId: string) => pinnedItems.some(p => p.type === type && p.id === itemId);

  const handleAddPerson = async () => {
    if (!newPersonName.trim()) { toast.error(newPersonType === 'loan_kisti' ? 'ঋণের নাম দিন' : 'নাম দিন'); return; }
    if (newPersonType !== 'loan_kisti' && !newPersonPhone.trim()) { toast.error('ফোন নম্বর দিন'); return; }
    try {
      const payload: any = {
        name: newPersonName.trim(), type: newPersonType, unit_id: id!,
        is_active: true, base_salary: Number(newPersonBaseSalary) || 0,
        salary_type: newPersonSalaryType,
        phone: newPersonPhone || null,
        joining_date: newPersonJoiningDate || null,
      };
      if (newPersonType === 'loan_kisti') {
        if (!Number(loanForm.principal_amount)) { toast.error('মূলধন দিন'); return; }
        payload.base_salary = 0;
        payload.phone = null;
        payload.joining_date = null;
        payload._loanPayload = {
          principal_amount: Number(loanForm.principal_amount) || 0,
          interest_rate: Number(loanForm.interest_rate) || 0,
          total_installments: Number(loanForm.total_installments) || 0,
          monthly_installment: Number(loanForm.monthly_installment) || 0,
          start_date: loanForm.start_date || new Date().toISOString().slice(0, 10),
          tracking_start_date: loanForm.tracking_start_date || loanForm.start_date || new Date().toISOString().slice(0, 10),
        };
      }
      await createPerson.mutateAsync(payload);
      toast.success(newPersonType === 'loan_kisti' ? 'লোন যোগ হয়েছে' : 'ব্যক্তি যোগ হয়েছে');
      setNewPersonName(''); setNewPersonPhone(''); setNewPersonJoiningDate('');
      setNewPersonBaseSalary(''); setNewPersonSalaryType('monthly'); setNewPersonType('employee');
      setLoanForm({ principal_amount: '', interest_rate: '', total_installments: '', monthly_installment: '', start_date: '', tracking_start_date: '' });
      setAddPersonDialogOpen(false); setAddPopoverOpen(false);
    } catch (e: any) { toast.error(e.message); }
  };

  // Normalize custom_modules: old string[] → { name, type }[]
  const normalizeModules = (raw: any): { name: string; type: string }[] => {
    if (!Array.isArray(raw)) return [];
    return raw.map((m: any) => typeof m === 'string' ? { name: m, type: m === 'কাপর' ? 'kapor' : 'simple' } : m);
  };

  const handleAddModule = async () => {
    if (!newModuleName.trim()) { toast.error('মডিউলের নাম দিন'); return; }
    const existing = normalizeModules(unitSettings.custom_modules);
    if (existing.some(m => m.name === newModuleName.trim())) { toast.error('এই মডিউল আগে থেকেই আছে'); return; }
    try {
      await updateUnit.mutateAsync({ id: id!, settings: { ...unitSettings, custom_modules: [...existing, { name: newModuleName.trim(), type: newModuleType }] } });
      toast.success('মডিউল যোগ হয়েছে');
      setNewModuleName(''); setNewModuleType('simple'); setAddPopoverOpen(false);
    } catch (e: any) { toast.error(e.message); }
  };

  const activePersons = useMemo(() => allPersons.filter(p => p.is_active), [allPersons]);

  // ========= Period filter (মাস + বছর + কাস্টম ড্যাশবোর্ড-এর মতো) =========
  const _today = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(_today.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(_today.getFullYear());
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const customActive = !!(customFrom && customTo);

  const periodRange = useMemo(() => {
    if (customActive) {
      const start = new Date(customFrom!); start.setHours(0, 0, 0, 0);
      const end = new Date(customTo!); end.setHours(0, 0, 0, 0); end.setDate(end.getDate() + 1);
      return { start, end };
    }
    if (selectedMonth === -1) {
      // সম্পূর্ণ বছর (whole year)
      return { start: new Date(selectedYear, 0, 1), end: new Date(selectedYear + 1, 0, 1) };
    }
    return { start: new Date(selectedYear, selectedMonth, 1), end: new Date(selectedYear, selectedMonth + 1, 1) };
  }, [customActive, customFrom, customTo, selectedMonth, selectedYear]);

  const inPeriod = useCallback((dateStr: string | null | undefined) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    return d >= periodRange.start && d < periodRange.end;
  }, [periodRange]);

  const periodLabel = customActive
    ? `${format(customFrom!, 'dd MMM')} - ${format(customTo!, 'dd MMM yyyy')}`
    : selectedMonth === -1 ? `সম্পূর্ণ ${selectedYear}` : `${BANGLA_MONTHS[selectedMonth]} ${selectedYear}`;


  const expenseTxSource = needsAggregation ? aggregatedTxs : allUnitTx;
  const filteredExpenseTxs = useMemo(() =>
    expenseTxSource.filter(t => DEBIT_TYPES.includes(t.type) && inPeriod((t as any).date || (t as any).created_at)),
    [expenseTxSource, inPeriod]
  );
  const totalExpense = useMemo(() => filteredExpenseTxs.reduce((s, t) => s + Number(t.amount), 0), [filteredExpenseTxs]);

  // Period-filtered data sources for breakdown sections below
  const filteredMaterials = useMemo(() =>
    materials.filter(m => inPeriod((m as any).date || (m as any).created_at)),
    [materials, inPeriod]
  );
  const filteredFixedExpenses = useMemo(() =>
    (fixedExpenses as any[]).filter(e => {
      // Fixed expenses have month/year; build a mid-month proxy date
      const proxy = new Date(e.year, (e.month || 1) - 1, 15);
      return proxy >= periodRange.start && proxy < periodRange.end;
    }),
    [fixedExpenses, periodRange]
  );
  const filteredRentPayments = useMemo(() =>
    (rentPayments as any[]).filter(p => inPeriod(p.payment_date)),
    [rentPayments, inPeriod]
  );
  const filteredAllUnitTx = useMemo(() =>
    (allUnitTx as any[]).filter(t => inPeriod(t.date || t.created_at)),
    [allUnitTx, inPeriod]
  );
  const filteredAggregatedTxs = useMemo(() =>
    (aggregatedTxs as any[]).filter(t => inPeriod(t.date || t.created_at)),
    [aggregatedTxs, inPeriod]
  );

  const totalSalary = useMemo(() => {
    return activePersons.reduce((s, p) => s + (p.base_salary || 0), 0);
  }, [activePersons]);

  const totalWage = useMemo(() => allWoEntries
    .filter(e => inPeriod((e as any).date || (e as any).created_at))
    .reduce((s, e) => s + (e.quantity * e.rate), 0), [allWoEntries, inPeriod]);
  const workValue = useMemo(() => workOrders
    .filter(o => inPeriod((o as any).created_at || (o as any).date))
    .reduce((s, o) => s + (o.total_quantity * (o.pricing || 0)), 0), [workOrders, inPeriod]);

  // Period-aware sales with source breakdown (office only)
  const { data: periodSales } = useQuery({
    queryKey: ['unit-period-sales', isOffice, selectedMonth, selectedYear, customActive, customFrom?.toISOString(), customTo?.toISOString()],
    enabled: isOffice,
    queryFn: async () => {
      let cq = (supabase.from('courier_payments' as any) as any)
        .select('receivable_amount, receive_method, courier_provider, date')
        .not('receive_method', 'is', null);
      let sq = (supabase.from('acc_transactions' as any) as any)
        .select('amount, source, description, created_at')
        .eq('type', 'sale');
      if (periodRange) {
        const s = toLocalDateStr(periodRange.start);
        const e = toLocalDateStr(periodRange.end);
        cq = cq.gte('date', s).lt('date', e);
        sq = sq.gte('created_at', periodRange.start.toISOString()).lt('created_at', periodRange.end.toISOString());
      }
      const [cRes, sRes] = await Promise.all([cq, sq]);
      const courier = (cRes.data || []) as any[];
      const sales = (sRes.data || []) as any[];
      const sources = new Map<string, number>();
      let total = 0;
      courier.forEach(c => {
        const key = `কুরিয়ার: ${c.courier_provider || 'অন্যান্য'} (${c.receive_method})`;
        const amt = Number(c.receivable_amount || 0);
        sources.set(key, (sources.get(key) || 0) + amt); total += amt;
      });
      sales.forEach(s => {
        const desc = String(s.description || '');
        const key = desc.includes('অনলাইন') ? `অনলাইন পেমেন্ট (${s.source || 'bank'})`
          : desc.includes('অফিস') ? `অফিস সেল (${s.source || 'cash'})`
          : `অন্যান্য বিক্রি (${s.source || 'cash'})`;
        const amt = Number(s.amount || 0);
        sources.set(key, (sources.get(key) || 0) + amt); total += amt;
      });
      const breakdown = [...sources.entries()]
        .map(([label, amount]) => ({ label, amount }))
        .sort((a, b) => b.amount - a.amount);
      return { total, breakdown };
    },
  });
  // Non-office units earn income via "sales_party"/"work_party" profiles (কাজ প্রোফাইল) scoped to this unit —
  // e.g. জসিম ভাই/রাব্বি ভাইয়ের কারখানা/প্রিন্ট/এম্ব্রয়ডারির জন্য করা কাজ, billed via মেমো এন্ট্রি.
  const salesPartyPersonIds = useMemo(() => allPersons.filter(p => p.type === 'sales_party' || p.type === 'work_party').map(p => p.id), [allPersons]);

  const { data: unitWorkSales } = useQuery({
    queryKey: ['unit-work-sales', id, salesPartyPersonIds.join(','), selectedMonth, selectedYear, customActive, customFrom?.toISOString(), customTo?.toISOString()],
    enabled: !isOffice && salesPartyPersonIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase.from('acc_party_entries' as any) as any)
        .select('person_id, total, date, is_submission')
        .in('person_id', salesPartyPersonIds);
      if (error) throw error;
      const s = toLocalDateStr(periodRange.start);
      const e = toLocalDateStr(periodRange.end);
      const rows = ((data || []) as { person_id: string; total: number; date: string; is_submission: boolean }[])
        .filter(r => !r.is_submission && r.date >= s && r.date < e);
      const nameMap = new Map(allPersons.map(p => [p.id, p.name]));
      const byPerson = new Map<string, number>();
      let total = 0;
      rows.forEach(r => {
        const amt = Number(r.total || 0);
        byPerson.set(r.person_id, (byPerson.get(r.person_id) || 0) + amt);
        total += amt;
      });
      const breakdown = [...byPerson.entries()]
        .map(([pid, amount]) => ({ label: nameMap.get(pid) || 'অজানা', amount }))
        .sort((a, b) => b.amount - a.amount);
      return { total, breakdown };
    },
  });

  // Non-office units can earn income two ways: মেমো entries against a sales_party/work_party
  // person (এম্ব্রয়ডারির pattern), or real acc_work_orders pricing (কারখানা/প্রিন্টের internal
  // work sheet, wired straight to the live WorkOrderContent engine — no মেমো rows involved at
  // all). A unit only ever populates one of the two in practice, so summing both is safe and
  // needs no per-unit special-casing.
  const workOrderBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    workOrders
      .filter(o => inPeriod((o as any).created_at || (o as any).date))
      .forEach(o => {
        const key = o.product_name || 'অজানা';
        map.set(key, (map.get(key) || 0) + o.total_quantity * (o.pricing || 0));
      });
    return [...map.entries()].map(([label, amount]) => ({ label, amount })).sort((a, b) => b.amount - a.amount);
  }, [workOrders, inPeriod]);

  const totalSales = isOffice ? (periodSales?.total || 0) : ((unitWorkSales?.total || 0) + workValue);
  const salesBreakdown = isOffice
    ? (periodSales?.breakdown || [])
    : [...(unitWorkSales?.breakdown || []), ...workOrderBreakdown].sort((a, b) => b.amount - a.amount);

  const unitExpenseBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    filteredExpenseTxs.forEach(t => {
      const uid = (t as any).unit_id || id || 'unknown';
      map.set(uid, (map.get(uid) || 0) + Number(t.amount));
    });
    const nameMap = new Map(units.map((u: any) => [u.id, u.name]));
    return [...map.entries()]
      .map(([uid, amount]) => ({ uid, label: (nameMap.get(uid) as string) || 'অজানা ইউনিট', amount, isSelf: uid === id }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredExpenseTxs, units, id]);

  const profit = useMemo(() => isOffice ? (totalSales - workValue - totalExpense) : (workValue - totalExpense - totalWage), [isOffice, totalSales, workValue, totalExpense, totalWage]);


  const handleCreateMaterial = async () => {
    if (!matForm.item_name.trim()) { toast.error('আইটেমের নাম দিন'); return; }
    const total = Number(matForm.total) || (Number(matForm.quantity) * Number(matForm.unit_price)) || 0;
    if (!total) { toast.error('মোট টাকা দিন'); return; }
    try {
      await createMaterial.mutateAsync({
        unit_id: id!, item_name: matForm.item_name, quantity: Number(matForm.quantity) || 0,
        unit_price: Number(matForm.unit_price) || 0, total, date: matForm.date, description: matForm.description,
      });
      toast.success('ম্যাটেরিয়াল যোগ হয়েছে');
      setMatOpen(false);
      setMatForm({ item_name: '', quantity: '', unit_price: '', total: '', date: toLocalDateStr(), description: '' });
    } catch (e: any) { toast.error(e.message); }
  };

  const handleCreateFixedExpense = async () => {
    if (!feForm.category.trim()) { toast.error('ক্যাটাগরি দিন'); return; }
    const amount = Number(feForm.amount);
    if (!amount) { toast.error('পরিমাণ দিন'); return; }
    try {
      await createFixedExpense.mutateAsync({
        unit_id: id!, category: feForm.category, amount, month: expMonth, year: expYear, description: feForm.description,
      });
      toast.success('খরচ যোগ হয়েছে');
      setFeOpen(false);
      setFeForm({ category: '', amount: '', description: '' });
    } catch (e: any) { toast.error(e.message); }
  };
  const handleCreateCustomExpense = async () => {
    if (isKaporModule) {
      const validItems = customExpForm.items.filter(i => i.name.trim());
      if (validItems.length === 0) { toast.error('অন্তত একটি আইটেমের নাম দিন'); return; }
      const billAmt = Number(customExpForm.bill_amount);
      const finalAmount = billAmt || customTotalAmount;
      if (!finalAmount) { toast.error('পরিমাণ দিন'); return; }
      const metadata: Record<string, any> = {};
      if (customExpForm.memo_number) metadata.memo_number = customExpForm.memo_number;
      if (customExpForm.shop_name) metadata.shop_name = customExpForm.shop_name;
      if (customExpForm.shop_phone) metadata.shop_phone = customExpForm.shop_phone;
      if (customExpForm.shop_address) metadata.shop_address = customExpForm.shop_address;
      metadata.items = validItems.map(i => ({ name: i.name, goj: i.goj, rate: i.rate, amount: String((Number(i.goj) || 0) * (Number(i.rate) || 0)) }));
      if (customTotalGoj) metadata.total_goj = String(customTotalGoj);
      metadata.total_items = String(validItems.length);
      metadata.calculated_total = customTotalAmount;
      metadata.bill_amount = finalAmount;
      const itemName = validItems.map(i => i.name).join(', ');
      try {
        await createCustomExpense.mutateAsync({
          unit_id: id!, module_name: customExpModule, item_name: itemName, amount: finalAmount, date: customExpForm.date, description: customExpForm.description,
          metadata,
        });
        toast.success('খরচ যোগ হয়েছে');
        setCustomExpOpen(false);
        setCustomExpForm({ date: toLocalDateStr(), amount: '', description: '', memo_number: '', shop_name: '', shop_phone: '', shop_address: '', bill_amount: '', items: [{ name: '', goj: '', rate: '' }] });
      } catch (e: any) { toast.error(e.message); }
    } else {
      if (!customTotalAmount) { toast.error('পরিমাণ দিন'); return; }
      try {
        await createCustomExpense.mutateAsync({
          unit_id: id!, module_name: customExpModule, item_name: customExpForm.description || customExpModule, amount: customTotalAmount, date: customExpForm.date, description: customExpForm.description,
        });
        toast.success('খরচ যোগ হয়েছে');
        setCustomExpOpen(false);
        setCustomExpForm({ date: toLocalDateStr(), amount: '', description: '', memo_number: '', shop_name: '', shop_phone: '', shop_address: '', bill_amount: '', items: [{ name: '', goj: '', rate: '' }] });
      } catch (e: any) { toast.error(e.message); }
    }
  };

  // Unit navigation (hooks must be before early return)
  const currentIndex = units.findIndex(u => u.id === id);
  const prevUnit = currentIndex > 0 ? units[currentIndex - 1] : null;
  const nextUnit = currentIndex < units.length - 1 ? units[currentIndex + 1] : null;
  const touchStartX = useRef<number | null>(null);
  const handleTouchStart = useCallback((e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; }, []);
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(diff) < 60) return;
    if (diff < 0 && nextUnit) navigate(`/admin/accounting/units/${nextUnit.id}`);
    if (diff > 0 && prevUnit) navigate(`/admin/accounting/units/${prevUnit.id}`);
  }, [nextUnit, prevUnit, navigate]);

  if (!unit && !isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">ইউনিট পাওয়া যায়নি</p>
        <Button variant="link" onClick={() => navigate('/admin/accounting')}>হিসাবে ফিরুন</Button>
      </div>
    );
  }

  const merged = { ...DEFAULT_NAVBAR_CONFIG, ...(navbarConfig || {}) };
  const logoUrl = merged.logo_url;
  const unitStyle = getUnitStyle(id || null, unit?.name);

  return (
    <div className="space-y-4 sm:pr-36">
      {/* Branded Header */}
      <div
        className="rounded-xl overflow-hidden shadow-lg"
        style={{ borderTop: `5px solid ${unitStyle.color}`, background: `linear-gradient(135deg, ${unitStyle.color}30 0%, ${unitStyle.color}08 100%)` }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/admin/accounting')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-10 w-10 rounded-full object-cover border-2 shadow-sm" style={{ borderColor: unitStyle.color }} />
            ) : (
              <div className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm" style={{ backgroundColor: unitStyle.color }}>S</div>
            )}
            <div>
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">SHORNO SUTA</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {unit?.id && (
              <AccountingShareButton entityType="unit" entityId={buildUnitSlug(unit.id, unit.name)} entityName={unit.name} />
            )}
            <div className="text-[10px] text-muted-foreground font-medium">ইউনিট প্রোফাইল</div>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => prevUnit && navigate(`/admin/accounting/units/${prevUnit.id}`)}
              disabled={!prevUnit}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-all disabled:opacity-20"
              style={{ backgroundColor: prevUnit ? `${unitStyle.color}18` : 'transparent', color: unitStyle.color }}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="text-4xl font-black tracking-wide drop-shadow-sm" style={{ color: unitStyle.color }}>{unit?.name || 'লোড হচ্ছে...'}</div>
            <button
              onClick={() => nextUnit && navigate(`/admin/accounting/units/${nextUnit.id}`)}
              disabled={!nextUnit}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-all disabled:opacity-20"
              style={{ backgroundColor: nextUnit ? `${unitStyle.color}18` : 'transparent', color: unitStyle.color }}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <div className="text-xs text-muted-foreground mt-1 uppercase tracking-widest font-medium">Unit Profile</div>
          {/* Dot indicator */}
          {units.length > 1 && (
            <div className="flex gap-1.5 mt-2">
              {units.map((u, i) => (
                <button
                  key={u.id}
                  onClick={() => navigate(`/admin/accounting/units/${u.id}`)}
                  className="w-2 h-2 rounded-full transition-all"
                  style={{
                    backgroundColor: i === currentIndex ? unitStyle.color : `${unitStyle.color}30`,
                    transform: i === currentIndex ? 'scale(1.3)' : 'scale(1)',
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Person & Module Navigation — always-visible floating rail on the right, no click needed */}
      {(() => {
        const employees = activePersons.filter(p => p.type === 'employee' || p.type === 'salaried_production');
        const productionStaff = activePersons.filter(p => p.type === 'production_staff');
        const parties = activePersons.filter(p => p.type === 'party' || p.type === 'supplier');
        const loans = activePersons.filter(p => p.type === 'loan_kisti');
        const salesParties = activePersons.filter(p => p.type === 'sales_party');
        const workParties = activePersons.filter(p => p.type === 'work_party');

        // Build all items for pin sorting
        type ChipItem = { type: 'person'; person: AccPerson } | { type: 'module'; moduleType: string; name: string };
        const allChips: ChipItem[] = [];
        employees.forEach(p => allChips.push({ type: 'person', person: p }));
        productionStaff.forEach(p => allChips.push({ type: 'person', person: p }));
        parties.forEach(p => allChips.push({ type: 'person', person: p }));
        loans.forEach(p => allChips.push({ type: 'person', person: p }));
        salesParties.forEach(p => allChips.push({ type: 'person', person: p }));
        workParties.forEach(p => allChips.push({ type: 'person', person: p }));
        if (unitSettings.has_materials) allChips.push({ type: 'module', moduleType: 'materials', name: 'ম্যাটেরিয়াল' });
        if (unitSettings.has_fixed_expenses) allChips.push({ type: 'module', moduleType: 'fixed_expenses', name: unitSettings.fixed_expenses_label || 'নিয়মিত খরচ' });
        if (unitSettings.has_rent) allChips.push({ type: 'module', moduleType: 'rent', name: 'ভাড়া' });
        allChips.push({ type: 'module', moduleType: 'loans', name: 'ঋণ / ধার' });
        normalizeModules(unitSettings.custom_modules).forEach((m) => allChips.push({ type: 'module', moduleType: `custom-${m.name}`, name: m.name }));
        {/* Once a unit has its own internal work sheet (SHORNO SUTA person), work-orders
            tracking lives there instead — this chip would just be a redundant second entry point */}
        if (!unitSettings.internal_work_party_id) {
          allChips.push({ type: 'module', moduleType: 'work-orders', name: isOffice ? 'পণ্য কেনার শীট' : isPrintUnit ? 'প্রিন্টের কাজ' : 'কারখানার কাজ' });
        }

        // Split pinned vs unpinned
        const pinnedChips = allChips.filter(c => {
          const cId = c.type === 'person' ? c.person.id : c.moduleType;
          return isPinned(c.type, cId);
        });
        const unpinnedChips = allChips.filter(c => {
          const cId = c.type === 'person' ? c.person.id : c.moduleType;
          return !isPinned(c.type, cId);
        });

        const rowBase = "flex items-center gap-1 w-full px-1.5 py-1.5 rounded-md border text-[10.5px] leading-tight font-medium text-left transition-colors";

        const renderPersonRow = (p: AccPerson) => {
          const colors: Record<string, string> = {
            employee: 'border-blue-300/50 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-700/30',
            production_staff: 'border-green-300/50 bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-950/30 dark:text-green-400 dark:border-green-700/30',
            party: 'border-orange-300/50 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-700/30',
            supplier: 'border-orange-300/50 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-700/30',
            loan_kisti: 'border-purple-300/50 bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-700/30',
            sales_party: 'border-teal-300/50 bg-teal-50 text-teal-700 hover:bg-teal-100 dark:bg-teal-950/30 dark:text-teal-400 dark:border-teal-700/30',
            work_party: 'border-amber-300/50 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-700/30',
          };
          return (
            <button key={p.id}
              onClick={() => navigate(`/admin/accounting/persons/${p.id}`)}
              onContextMenu={(e) => { e.preventDefault(); togglePin('person', p.id); }}
              className={`${rowBase} ${colors[p.type] || colors.employee}`}>
              {isPinned('person', p.id) && <Pin className="h-2.5 w-2.5 shrink-0" />}
              <span className="truncate">{p.name}</span>
            </button>
          );
        };

        const renderModuleRow = (moduleType: string, name: string) => {
          const moduleStyles: Record<string, { className: string; icon?: React.ReactNode; onClick: () => void }> = {
            materials: { className: 'border-amber-300/50 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-700/30', icon: <Package className="h-3 w-3" />, onClick: () => navigate(`/admin/accounting/units/${id}/modules/materials`) },
            fixed_expenses: { className: 'border-blue-300/50 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-700/30', icon: <Receipt className="h-3 w-3" />, onClick: () => navigate(`/admin/accounting/units/${id}/modules/fixed_expenses`) },
            rent: { className: 'border-pink-300/50 bg-pink-50 text-pink-700 hover:bg-pink-100 dark:bg-pink-950/30 dark:text-pink-400 dark:border-pink-700/30', icon: <Home className="h-3 w-3" />, onClick: () => navigate(`/admin/accounting/units/${id}/modules/rent`) },
            loans: { className: 'border-rose-300/50 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-700/30', icon: <Landmark className="h-3 w-3" />, onClick: () => navigate(`/admin/accounting/units/${id}/modules/loans`) },
            'work-orders': { className: 'border-indigo-300/50 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-700/30', icon: <ClipboardList className="h-3 w-3" />, onClick: () => navigate(`/admin/accounting/units/${id}/work-orders`) },
            'sales-history': { className: 'border-teal-300/50 bg-teal-50 text-teal-700 hover:bg-teal-100 dark:bg-teal-950/30 dark:text-teal-400 dark:border-teal-700/30', icon: <Banknote className="h-3 w-3" />, onClick: () => navigate('/admin/accounting/sales') },
          };

          const isCustom = moduleType.startsWith('custom-');
          const style = moduleStyles[moduleType] || {
            className: 'border-purple-300/50 bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-700/30',
            onClick: () => navigate(`/admin/accounting/units/${id}/modules/${moduleType}`),
          };
          return (
            <button key={moduleType}
              onClick={style.onClick}
              onContextMenu={(e) => { e.preventDefault(); togglePin('module', moduleType); }}
              className={`${rowBase} ${style.className}`}>
              {isPinned('module', moduleType) && <Pin className="h-2.5 w-2.5 shrink-0" />}
              {style.icon || (isCustom ? <span>🚀</span> : null)}
              <span className="truncate">{name}</span>
            </button>
          );
        };

        const renderRow = (c: ChipItem) => c.type === 'person' ? renderPersonRow(c.person) : renderModuleRow(c.moduleType, c.name);

        const ue = unpinnedChips.filter(c => c.type === 'person' && (c.person.type === 'employee' || c.person.type === 'salaried_production'));
        const up = unpinnedChips.filter(c => c.type === 'person' && c.person.type === 'production_staff');
        const ua = unpinnedChips.filter(c => c.type === 'person' && (c.person.type === 'party' || c.person.type === 'supplier'));
        const ul = unpinnedChips.filter(c => c.type === 'person' && c.person.type === 'loan_kisti');
        const us = unpinnedChips.filter(c => c.type === 'person' && c.person.type === 'sales_party');
        // কুরিয়ার + অফিস সেল + সব sales_party/work_party জমা — একসাথে মোট বিক্রির হিস্টোরি (অফিস ইউনিটেই প্রযোজ্য)
        const usWithTotal: ChipItem[] = isOffice
          ? [{ type: 'module', moduleType: 'sales-history', name: 'মোট বিক্রি' }, ...us]
          : us;
        const uw = unpinnedChips.filter(c => c.type === 'person' && c.person.type === 'work_party');
        // Cash-purchase sheets (নগদ টাকায় কেনা — বাকি না রেখে) belong next to পার্টি (যারা বাকিতে দেয়),
        // not lumped in with the generic module list.
        const cashModuleTypes = ['work-orders', 'custom-কাপর'];
        const uCash = unpinnedChips.filter(c => c.type === 'module' && cashModuleTypes.includes(c.moduleType));
        const um = unpinnedChips.filter(c => c.type === 'module' && !cashModuleTypes.includes(c.moduleType));

        const Section = ({ label, colorClass, items }: { label: string; colorClass: string; items: ChipItem[] }) =>
          items.length === 0 ? null : (
            <div className="space-y-1">
              <div className={`text-[9px] font-bold uppercase tracking-wider px-0.5 ${colorClass}`}>{label}</div>
              <div className="space-y-1">{items.map(renderRow)}</div>
            </div>
          );

        const railBody = (
          <>
            {/* + Button */}
            <Popover open={addPopoverOpen} onOpenChange={setAddPopoverOpen}>
              <PopoverTrigger asChild>
                <button className="flex items-center justify-center gap-1 w-full px-1.5 py-1.5 rounded-md border border-dashed border-muted-foreground/40 text-muted-foreground hover:bg-muted transition-colors text-[10.5px] font-medium">
                  <Plus className="h-3 w-3" /> যোগ
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-3" align="end" side="left">
                <Tabs defaultValue="person" className="w-full">
                  <TabsList className="w-full h-8">
                    <TabsTrigger value="person" className="text-[11px] flex-1">ব্যক্তি যোগ</TabsTrigger>
                    <TabsTrigger value="module" className="text-[11px] flex-1">মডিউল যোগ</TabsTrigger>
                  </TabsList>
                  <TabsContent value="person" className="mt-2 space-y-2">
                     <Select value={newPersonType} onValueChange={setNewPersonType}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                       <SelectContent>
                        <SelectItem value="employee">কর্মচারী (বেতন)</SelectItem>
                        <SelectItem value="salaried_production">কর্মচারী (প্রোডাকশন)</SelectItem>
                        <SelectItem value="production_staff">প্রোডাকশন স্টাফ</SelectItem>
                        <SelectItem value="party">পার্টি</SelectItem>
                        <SelectItem value="supplier">সাপ্লায়ার</SelectItem>
                        <SelectItem value="sales_party">বিক্রি পার্টি</SelectItem>
                        <SelectItem value="work_party">কাজ পার্টি</SelectItem>
                        <SelectItem value="loan_kisti">ঋণ কিস্তি</SelectItem>
                      </SelectContent>
                     </Select>
                     <Button size="sm" className="w-full h-7 text-xs" onClick={() => { setAddPopoverOpen(false); setAddPersonDialogOpen(true); }}>
                       <Plus className="h-3 w-3 mr-1" /> ব্যক্তি যোগ করুন
                     </Button>
                   </TabsContent>
                   <TabsContent value="module" className="mt-2 space-y-2">
                     <Input value={newModuleName} onChange={e => setNewModuleName(e.target.value)} placeholder="মডিউলের নাম" className="h-8 text-xs" onKeyDown={e => e.key === 'Enter' && handleAddModule()} />
                     <Select value={newModuleType} onValueChange={setNewModuleType}>
                       <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="টাইপ সিলেক্ট" /></SelectTrigger>
                       <SelectContent>
                         <SelectItem value="simple">সাধারণ (পরিমাণ ও বিবরণ)</SelectItem>
                         <SelectItem value="party">পার্টি স্টাইল (মেমো/লেজার)</SelectItem>
                         <SelectItem value="production">প্রোডাকশন স্টাইল (কাজ/জমা)</SelectItem>
                         <SelectItem value="kapor">কাপর স্টাইল (গজ/দর)</SelectItem>
                       </SelectContent>
                     </Select>
                     <Button size="sm" className="w-full h-7 text-xs" onClick={handleAddModule} disabled={updateUnit.isPending}>
                       <Plus className="h-3 w-3 mr-1" /> মডিউল তৈরি
                     </Button>
                   </TabsContent>
                </Tabs>
              </PopoverContent>
            </Popover>

            <Section label="📌" colorClass="text-foreground" items={pinnedChips} />
            <Section label="💼 বেতন" colorClass="text-blue-500" items={ue} />
            <Section label="⚙️ প্রোডাকশন" colorClass="text-green-600" items={up} />
            <Section label="🤝 পার্টি" colorClass="text-orange-600" items={ua} />
            <Section label="💵 নগদ" colorClass="text-rose-600" items={uCash} />
            <Section label="💳 ঋণ" colorClass="text-purple-600" items={ul} />
            <Section label="🛒 বিক্রি" colorClass="text-teal-600" items={usWithTotal} />
            <Section label="🧾 কাজ" colorClass="text-amber-600" items={uw} />
            <Section label="🗂️ মডিউল" colorClass="text-muted-foreground" items={um} />
          </>
        );

        if (isMobile) {
          return (
            <>
              <button
                type="button"
                onClick={() => setRailOpen(true)}
                className="fixed z-30 bottom-20 right-3 h-11 w-11 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center"
                aria-label="ব্যক্তি ও মডিউল তালিকা দেখুন"
              >
                <Users className="h-5 w-5" />
              </button>
              <Sheet open={railOpen} onOpenChange={setRailOpen}>
                <SheetContent side="right" className="w-[78vw] max-w-[280px] p-2 overflow-y-auto">
                  <div className="space-y-2 pt-6">
                    {railBody}
                  </div>
                </SheetContent>
              </Sheet>
            </>
          );
        }

        return (
          <div
            className="fixed z-30 top-1/2 -translate-y-1/2 right-1 sm:right-3 w-[104px] sm:w-32 max-h-[78vh] overflow-y-auto rounded-xl border border-border bg-background/95 backdrop-blur-sm shadow-lg p-1.5 space-y-2 no-scrollbar"
            style={{ scrollbarWidth: 'none' }}
          >
            {railBody}
          </div>
        );
      })()}



      {/* Duty Time Settings */}
      <DutyTimeSection unitId={id!} unitSettings={unitSettings} updateUnit={updateUnit} unitStyle={unitStyle} />

      {/* ========== HERO: Period-filtered বিক্রি vs খরচ ========== */}
      {(() => {
        const unitCost = totalExpense + totalSalary + (isOffice ? workValue : totalWage);
        const netProfit = totalSales - unitCost;
        return (
          <Card
            className="shadow-md overflow-hidden border-0"
            style={{
              background: `linear-gradient(135deg, ${unitStyle.color}10 0%, ${unitStyle.color}05 100%)`,
              borderTop: `4px solid ${unitStyle.color}`,
            }}
          >
            <CardContent className="p-4 sm:p-5 space-y-4">
              {/* Period Filter — same as হিসাব ড্যাশবোর্ড */}
              <div className="flex flex-wrap items-center gap-2">
                <Select value={String(selectedMonth)} onValueChange={v => setSelectedMonth(Number(v))} disabled={customActive}>
                  <SelectTrigger className={`h-8 w-[130px] text-xs ${customActive ? 'opacity-50' : ''}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="-1">সম্পূর্ণ বছর</SelectItem>
                    {BANGLA_MONTHS.map((m, i) => {
                      const disabled = selectedYear === _today.getFullYear() && i > _today.getMonth();
                      return <SelectItem key={i} value={String(i)} disabled={disabled}>{m}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
                <Select value={String(selectedYear)} disabled={customActive} onValueChange={v => {
                  const y = Number(v);
                  setSelectedYear(y);
                  if (y === _today.getFullYear() && selectedMonth > _today.getMonth()) setSelectedMonth(_today.getMonth());
                }}>
                  <SelectTrigger className={`h-8 w-[90px] text-xs ${customActive ? 'opacity-50' : ''}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: _today.getFullYear() - 2024 + 1 }, (_, i) => 2024 + i).map(y => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={`h-8 text-xs gap-1 ${customActive ? 'border-primary text-primary' : ''}`}>
                      📅 {customActive ? `${format(customFrom!, 'dd MMM')} - ${format(customTo!, 'dd MMM')}` : 'কাস্টম'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-3 space-y-3" align="end">
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div>
                        <Label className="text-xs font-medium mb-1 block">শুরু</Label>
                        <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} className="p-3 pointer-events-auto rounded-md border" />
                      </div>
                      <div>
                        <Label className="text-xs font-medium mb-1 block">শেষ</Label>
                        <Calendar mode="single" selected={customTo} onSelect={setCustomTo} disabled={(d) => customFrom ? d < customFrom : false} className="p-3 pointer-events-auto rounded-md border" />
                      </div>
                    </div>
                    {customActive && (
                      <div className="flex justify-end pt-1 border-t">
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setCustomFrom(undefined); setCustomTo(undefined); }}>Clear</Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
                <span className="text-[10px] text-muted-foreground ml-auto">{periodLabel}</span>
              </div>


              {/* Side-by-side Sales vs Expense */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Sales */}
                <div className="rounded-lg border border-emerald-300/40 bg-emerald-50/60 dark:bg-emerald-950/20 p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-[10px] uppercase tracking-wide font-medium text-emerald-700 dark:text-emerald-400">
                      {isOffice ? 'বিক্রি' : 'কাজ'} ({periodLabel})
                    </span>
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold tabular-nums text-emerald-600">
                    ৳{totalSales.toLocaleString()}
                  </div>
                  {!isOffice && salesPartyPersonIds.length === 0 && workOrders.length === 0 && (
                    <div className="text-[10px] text-muted-foreground mt-1">"কাজ" ক্লায়েন্ট যোগ করতে + বাটনে গিয়ে "কাজ পার্টি" টাইপে যোগ করুন</div>
                  )}
                  {!isOffice && (salesPartyPersonIds.length > 0 || workOrders.length > 0) && (
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {workOrders.length > 0 ? 'কাজের মূল্য অনুযায়ী (অর্ডার)' : 'কাজের বিল অনুযায়ী (মেমো)'}
                    </div>
                  )}
                </div>
                {/* Expense */}
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                    <span className="text-[10px] uppercase tracking-wide font-medium text-destructive">
                      খরচ ({periodLabel})
                    </span>
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold tabular-nums text-destructive">
                    ৳{unitCost.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    খরচ ৳{totalExpense.toLocaleString()} · বেতন ৳{totalSalary.toLocaleString()} · {isOffice ? 'পণ্য ক্রয়' : 'মজুরি'} ৳{(isOffice ? workValue : totalWage).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Net profit indicator */}
              {totalSales > 0 && (
                <div className="flex items-center justify-between rounded-md bg-background/60 border border-border/40 px-3 py-2">
                  <span className="text-[11px] font-medium text-muted-foreground">নেট ({isOffice ? 'বিক্রি' : 'কাজ'} − খরচ)</span>
                  <span className={`text-sm font-bold tabular-nums ${netProfit >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                    {netProfit >= 0 ? '+' : ''}৳{netProfit.toLocaleString()}
                  </span>
                </div>
              )}

              {/* Bottom split: Unit-wise expenses + Sales sources */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-border/30">
                {/* Unit-wise expenses */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
                      ইউনিট-ভিত্তিক খরচ
                    </span>
                  </div>
                  {unitExpenseBreakdown.length === 0 ? (
                    <div className="text-[11px] text-muted-foreground italic">এই সময়ে কোনো খরচ নেই</div>
                  ) : (
                    <div className="space-y-1.5">
                      {unitExpenseBreakdown.map(u => {
                        const pct = totalExpense > 0 ? (u.amount / totalExpense) * 100 : 0;
                        return (
                          <button
                            key={u.uid}
                            type="button"
                            onClick={() => !u.isSelf && u.uid !== 'unknown' && navigate(`/admin/accounting/units/${u.uid}`)}
                            className={`w-full rounded-md border border-border/40 bg-card px-2.5 py-1.5 text-left ${!u.isSelf && u.uid !== 'unknown' ? 'hover:bg-muted/40' : 'cursor-default'}`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-[11px] font-medium truncate">
                                {u.isSelf ? `${u.label} (এই ইউনিট)` : u.label}
                              </span>
                              <span className="text-[11px] font-bold tabular-nums text-destructive shrink-0">৳{u.amount.toLocaleString()}</span>
                            </div>
                            <div className="h-1 rounded-full bg-muted overflow-hidden">
                              <div className="h-full bg-destructive/70" style={{ width: `${pct}%` }} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Sales sources */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Banknote className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
                      {isOffice ? 'বিক্রির উৎস' : 'কাজের উৎস'}
                    </span>
                  </div>
                  {salesBreakdown.length === 0 ? (
                    <div className="text-[11px] text-muted-foreground italic">{isOffice ? 'এই সময়ে কোনো বিক্রি নেই' : 'এই সময়ে কোনো কাজ নেই'}</div>
                  ) : (
                    <div className="space-y-1.5">
                      {salesBreakdown.map((s, i) => {
                        const pct = totalSales > 0 ? (s.amount / totalSales) * 100 : 0;
                        return (
                          <div key={i} className="rounded-md border border-border/40 bg-card px-2.5 py-1.5">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-[11px] font-medium truncate">{s.label}</span>
                              <span className="text-[11px] font-bold tabular-nums text-emerald-600 shrink-0">৳{s.amount.toLocaleString()}</span>
                            </div>
                            <div className="h-1 rounded-full bg-muted overflow-hidden">
                              <div className="h-full bg-emerald-500/70" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}


      {/* ========== Compact secondary stats ========== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <Card className="shadow-sm">
          <CardContent className="p-2.5 sm:p-3 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: `${unitStyle.color}15` }}>
              <TrendingDown className="h-4 w-4 text-destructive" />
            </div>
            <div className="min-w-0">
              <div className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wide">মোট খরচ</div>
              <div className="text-sm sm:text-base font-bold tabular-nums truncate">৳{totalExpense.toLocaleString()}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-2.5 sm:p-3 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 bg-blue-50 dark:bg-blue-950/30">
              <DollarSign className="h-4 w-4 text-blue-600" />
            </div>
            <div className="min-w-0">
              <div className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wide">মোট বেতন</div>
              <div className="text-sm sm:text-base font-bold tabular-nums truncate">৳{totalSalary.toLocaleString()}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-2.5 sm:p-3 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 bg-purple-50 dark:bg-purple-950/30">
              <Users className="h-4 w-4 text-purple-600" />
            </div>
            <div className="min-w-0">
              <div className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wide">সক্রিয় ব্যক্তি</div>
              <div className="text-sm sm:text-base font-bold tabular-nums">{activePersons.length} জন</div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-2.5 sm:p-3 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 bg-orange-50 dark:bg-orange-950/30">
              {isOffice ? <Banknote className="h-4 w-4 text-orange-500" /> : <CircleDollarSign className="h-4 w-4 text-orange-500" />}
            </div>
            <div className="min-w-0">
              <div className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wide">{isOffice ? 'পণ্য ক্রয়' : 'মজুরি'}</div>
              <div className="text-sm sm:text-base font-bold tabular-nums truncate">৳{(isOffice ? workValue : totalWage).toLocaleString()}</div>
            </div>
          </CardContent>
        </Card>
      </div>


      {/* Module-wise Expense Breakdown — simple chips + dedicated analytics below */}
      {(() => {
        type DetailRow = { label: string; amount: number; count?: number; sub?: { label: string; amount: number; type?: string }[]; unitId?: string };
        type ModRow = {
          key: string; name: string; total: number;
          chipColor: string; barColor: string; textColor: string; dotColor: string;
          icon: React.ReactNode;
          kind: 'custom' | 'units' | 'simple';
          details: DetailRow[];
        };
        const moduleBreakdown: ModRow[] = [];

        // Materials
        if (unitSettings.has_materials) {
          const matTotal = filteredMaterials.reduce((s, m) => s + m.total, 0);
          if (matTotal > 0) {
            const byItem = new Map<string, { amount: number; count: number }>();
            filteredMaterials.forEach(m => {
              const k = m.item_name || 'অজানা আইটেম';
              const cur = byItem.get(k) || { amount: 0, count: 0 };
              cur.amount += m.total; cur.count += 1;
              byItem.set(k, cur);
            });
            moduleBreakdown.push({
              key: 'materials', name: 'ম্যাটেরিয়াল', total: matTotal,
              chipColor: 'border-l-amber-500 bg-amber-50 dark:bg-amber-950/30',
              barColor: 'bg-amber-500', textColor: 'text-amber-600', dotColor: 'bg-amber-500',
              icon: <Package className="h-3.5 w-3.5 text-amber-600" />,
              kind: 'custom',
              details: [...byItem.entries()].map(([label, v]) => ({ label, amount: v.amount, count: v.count })).sort((a, b) => b.amount - a.amount),
            });
          }
        }

        // Fixed expenses
        if (unitSettings.has_fixed_expenses) {
          const feTotal = filteredFixedExpenses.reduce((s: number, e: any) => s + e.amount, 0);
          if (feTotal > 0) {
            const byCat = new Map<string, { amount: number; count: number }>();
            filteredFixedExpenses.forEach((e: any) => {
              const k = e.category || 'অজানা';
              const cur = byCat.get(k) || { amount: 0, count: 0 };
              cur.amount += e.amount; cur.count += 1;
              byCat.set(k, cur);
            });
            moduleBreakdown.push({
              key: 'fixed', name: unitSettings.fixed_expenses_label || 'নিয়মিত খরচ', total: feTotal,
              chipColor: 'border-l-blue-500 bg-blue-50 dark:bg-blue-950/30',
              barColor: 'bg-blue-500', textColor: 'text-blue-600', dotColor: 'bg-blue-500',
              icon: <Receipt className="h-3.5 w-3.5 text-blue-600" />,
              kind: 'custom',
              details: [...byCat.entries()].map(([label, v]) => ({ label, amount: v.amount, count: v.count })).sort((a, b) => b.amount - a.amount),
            });
          }
        }

        // Rent
        if (unitSettings.has_rent) {
          const rentTotal = filteredRentPayments.reduce((s: number, p: any) => s + Number(p.amount), 0);
          if (rentTotal > 0) {
            moduleBreakdown.push({
              key: 'rent', name: 'ভাড়া', total: rentTotal,
              chipColor: 'border-l-rose-500 bg-rose-50 dark:bg-rose-950/30',
              barColor: 'bg-rose-500', textColor: 'text-rose-600', dotColor: 'bg-rose-500',
              icon: <Home className="h-3.5 w-3.5 text-rose-600" />,
              kind: 'custom',
              details: filteredRentPayments
                .map((p: any) => ({ label: `${p.payment_date}${p.note ? ' — ' + p.note : ''}`, amount: Number(p.amount) }))
                .sort((a, b) => b.amount - a.amount),
            });
          }
        }

        // Custom modules
        const customModulesRaw = unitSettings.custom_modules || [];
        const customModules: string[] = customModulesRaw.map((m: any) => typeof m === 'string' ? m : m?.name).filter(Boolean);
        const palette = [
          { chip: 'border-l-purple-500 bg-purple-50 dark:bg-purple-950/30', bar: 'bg-purple-500', text: 'text-purple-600', dot: 'bg-purple-500' },
          { chip: 'border-l-pink-500 bg-pink-50 dark:bg-pink-950/30', bar: 'bg-pink-500', text: 'text-pink-600', dot: 'bg-pink-500' },
          { chip: 'border-l-teal-500 bg-teal-50 dark:bg-teal-950/30', bar: 'bg-teal-500', text: 'text-teal-600', dot: 'bg-teal-500' },
          { chip: 'border-l-indigo-500 bg-indigo-50 dark:bg-indigo-950/30', bar: 'bg-indigo-500', text: 'text-indigo-600', dot: 'bg-indigo-500' },
        ];

        customModules.forEach((modName: string, idx: number) => {
          const prefix = `[${modName}]`;
          const modTxs = filteredAllUnitTx.filter((t: any) => t.type === 'expense' && t.description?.startsWith(prefix));
          const modTotal = modTxs.reduce((s, t) => s + t.amount, 0);
          if (modTotal > 0) {
            const byPurpose = new Map<string, { amount: number; count: number }>();
            modTxs.forEach(t => {
              const rest = (t.description || '').slice(prefix.length).trim().replace(/^[-–—:]\s*/, '').trim();
              const k = rest || 'অন্যান্য (নোট নেই)';
              const cur = byPurpose.get(k) || { amount: 0, count: 0 };
              cur.amount += t.amount; cur.count += 1;
              byPurpose.set(k, cur);
            });
            const c = palette[idx % palette.length];
            moduleBreakdown.push({
              key: `mod:${modName}`, name: modName, total: modTotal,
              chipColor: c.chip, barColor: c.bar, textColor: c.text, dotColor: c.dot,
              icon: <TrendingDown className={`h-3.5 w-3.5 ${c.text}`} />,
              kind: 'custom',
              details: [...byPurpose.entries()].map(([label, v]) => ({ label, amount: v.amount, count: v.count })).sort((a, b) => b.amount - a.amount),
            });
          }
        });

        // Salary
        const salaryTotal = filteredAllUnitTx.filter((t: any) => t.type === 'salary').reduce((s: number, t: any) => s + t.amount, 0);
        if (salaryTotal > 0) {
          moduleBreakdown.push({
            key: 'salary', name: 'বেতন পেমেন্ট', total: salaryTotal,
            chipColor: 'border-l-green-500 bg-green-50 dark:bg-green-950/30',
            barColor: 'bg-green-500', textColor: 'text-green-600', dotColor: 'bg-green-500',
            icon: <DollarSign className="h-3.5 w-3.5 text-green-600" />,
            kind: 'simple', details: [],
          });
        }

        // Other
        const taggedExpenseTotal = moduleBreakdown.filter(m => m.key !== 'salary').reduce((s, m) => s + m.total, 0);
        const otherTotal = totalExpense - taggedExpenseTotal - salaryTotal;
        let otherDetails: DetailRow[] = [];
        if (otherTotal > 0) {
          const TYPE_LABELS: Record<string, string> = {
            party_payment: 'পার্টি পেমেন্ট',
            production_payment: 'প্রোডাকশন পেমেন্ট',
            advance: 'অ্যাডভান্স',
            bonus: 'বোনাস',
            expense: 'বিবিধ খরচ',
          };
          const txSource: { type: string; amount: number; unit_id?: string; description: string | null }[] =
            needsAggregation ? (filteredAggregatedTxs as any) : (filteredAllUnitTx as any);
          const otherTxs = txSource.filter(t => {
            if (!DEBIT_TYPES.includes(t.type) || t.type === 'salary') return false;
            if (t.type === 'expense' && customModules.some(m => t.description?.startsWith(`[${m}]`))) return false;
            // Exclude legacy [ম্যাটেরিয়াল ক্রয়] — these are dual-written into acc_unit_materials
            if (t.type === 'expense' && t.description?.includes('[ম্যাটেরিয়াল ক্রয়]')) return false;
            return true;
          });
          const byUnit = new Map<string, { total: number; byType: Map<string, number> }>();
          otherTxs.forEach(t => {
            const uid = (t as any).unit_id || id || 'unknown';
            const cur = byUnit.get(uid) || { total: 0, byType: new Map() };
            cur.total += Number(t.amount);
            cur.byType.set(t.type, (cur.byType.get(t.type) || 0) + Number(t.amount));
            byUnit.set(uid, cur);
          });
          const unitNameMap = new Map(units.map((u: any) => [u.id, u.name]));
          otherDetails = [...byUnit.entries()].map(([uid, v]) => {
            const isSelf = uid === id;
            const name = isSelf ? `এই ইউনিটে (${unitNameMap.get(uid) || 'নিজস্ব'})` : (unitNameMap.get(uid) || 'অজানা ইউনিট');
            const sub = [...v.byType.entries()]
              .map(([type, amt]) => ({ label: TYPE_LABELS[type] || type, amount: amt, type }))
              .sort((a, b) => b.amount - a.amount);
            return { label: name, amount: v.total, sub, unitId: uid };
          }).sort((a, b) => b.amount - a.amount);

          moduleBreakdown.push({
            key: 'other', name: 'অন্যান্য', total: otherTotal,
            chipColor: 'border-l-gray-400 bg-muted/50',
            barColor: 'bg-muted-foreground', textColor: 'text-muted-foreground', dotColor: 'bg-muted-foreground',
            icon: <TrendingDown className="h-3.5 w-3.5 text-muted-foreground" />,
            kind: 'units', details: otherDetails,
          });
        }

        if (moduleBreakdown.length === 0) return null;

        const grandTotal = moduleBreakdown.reduce((s, m) => s + m.total, 0);
        const customMods = moduleBreakdown.filter(m => m.kind === 'custom' && m.details.length > 0);
        const otherMod = moduleBreakdown.find(m => m.kind === 'units');

        return (
          <>
            {/* Simple Chips removed — info now consolidated in খরচ বিশ্লেষণ below */}

            {/* ============ EXPENSE ANALYTICS SECTION ============ */}
            <Card className="shadow-md overflow-hidden" style={{ borderTop: `3px solid ${unitStyle.color}` }}>
              <CardHeader className="pb-3 pt-4" style={{ background: `linear-gradient(180deg, ${unitStyle.color}10 0%, transparent 100%)` }}>
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <TrendingDown className="h-4 w-4" style={{ color: unitStyle.color }} />
                  খরচ বিশ্লেষণ
                  <span className="text-xs font-normal text-muted-foreground ml-auto">
                    মোট ৳{grandTotal.toLocaleString()}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-5">
                {/* ===== Top grid: Where money goes (left) + People dues (right) ===== */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
                  {/* ===== LEFT: কোথায় টাকা গেছে (with inline expand) ===== */}
                  <div className="lg:col-span-3">
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
                        কোথায় টাকা গেছে
                      </div>
                      <div className="text-[10px] text-muted-foreground">{moduleBreakdown.length}টি ক্যাটাগরি</div>
                    </div>
                    <div className="space-y-1.5">
                      {moduleBreakdown.slice().sort((a, b) => b.total - a.total).map(mod => {
                        const pct = grandTotal > 0 ? (mod.total / grandTotal) * 100 : 0;
                        const expandable = mod.details && mod.details.length > 0;
                        const isOpen = openAnalyticsModule === mod.key;
                        const visible = expandable ? (isOpen ? mod.details : mod.details.slice(0, 4)) : [];
                        return (
                          <div key={`bar-${mod.key}`} className="rounded-lg border border-border/40 bg-card overflow-hidden">
                            <button
                              type="button"
                              disabled={!expandable}
                              onClick={() => expandable && setOpenAnalyticsModule(isOpen ? null : mod.key)}
                              className={`w-full px-3 py-2 text-left ${expandable ? 'hover:bg-muted/30 cursor-pointer' : 'cursor-default'} transition-colors`}
                            >
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${mod.dotColor}`} />
                                  <span className="text-xs font-semibold truncate">{mod.name}</span>
                                  {expandable && (
                                    <span className="text-[9px] text-muted-foreground">({mod.details.length})</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-[10px] text-muted-foreground tabular-nums">{pct.toFixed(1)}%</span>
                                  <span className={`text-xs font-bold tabular-nums ${mod.textColor}`}>৳{mod.total.toLocaleString()}</span>
                                </div>
                              </div>
                              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                <div className={`h-full ${mod.barColor} transition-all duration-500`} style={{ width: `${pct}%` }} />
                              </div>
                            </button>
                            {expandable && isOpen && (
                              <div className="px-3 pb-2.5 pt-1 space-y-1.5 border-t border-border/30 bg-muted/10">
                                {visible.map((d, i) => {
                                  const itemPct = mod.total > 0 ? (d.amount / mod.total) * 100 : 0;
                                  return (
                                    <div key={i} className="pt-1">
                                      <div className="flex items-center justify-between gap-2 mb-0.5">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <span className="text-[11px] truncate">{d.label}</span>
                                          {d.count != null && d.count > 1 && (
                                            <span className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground">×{d.count}</span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                          <span className="text-[9px] text-muted-foreground">{itemPct.toFixed(0)}%</span>
                                          <span className="text-[11px] font-semibold tabular-nums">৳{d.amount.toLocaleString()}</span>
                                        </div>
                                      </div>
                                      <div className="h-1 rounded-full bg-muted overflow-hidden">
                                        <div className={`h-full ${mod.barColor} opacity-60`} style={{ width: `${itemPct}%` }} />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* ===== RIGHT: মানুষের পাওনা (merged salary + work) ===== */}
                  <div className="lg:col-span-2 space-y-3">
                    {unitSettings.has_rent && unitSettings.rent_start_date && (
                      <RentCard
                        unitId={id!}
                        rentAmount={Number(unitSettings.rent_amount || 0)}
                        rentStartDate={unitSettings.rent_start_date}
                        onPayClick={() => setPayRentOpen(true)}
                      />
                    )}
                    {(() => {
                      // Salary rows
                      const employees = activePersons.filter(p =>
                        (p.type === 'employee' || p.type === 'salaried_production') &&
                        !isSalaryMonthBeforeJoining(curMonth, curYear, p.joining_date)
                      );
                      const recMap = new Map(salaryRecordsCur.map(r => [r.person_id, r]));
                      const salaryRows = employees.map(p => {
                        const r = recMap.get(p.id);
                        const total = Number(r?.final_salary ?? p.base_salary ?? 0);
                        const paid = Number(r?.paid_amount ?? 0);
                        const due = Math.max(0, total - paid);
                        return { person: p, kind: 'salary' as const, total, paid, due };
                      }).filter(r => r.total > 0 || r.paid > 0);

                      // Work rows
                      const workers = activePersons.filter(p => ['production_staff', 'party', 'supplier', 'salaried_production'].includes(p.type as any));
                      const entryAgg = new Map<string, { work: number; submitted: number }>();
                      [...partyEntriesAll, ...productionEntriesAll].forEach(e => {
                        const cur = entryAgg.get(e.person_id) || { work: 0, submitted: 0 };
                        if (e.is_submission) cur.submitted += Number(e.total);
                        else cur.work += Number(e.total);
                        entryAgg.set(e.person_id, cur);
                      });
                      const payAgg = new Map<string, number>();
                      const WORKER_DEBIT_TYPES = ['production_payment', 'party_payment', 'expense', 'salary', 'advance', 'bonus'];
                      allUnitTx.forEach(t => {
                        if (!t.person_id) return;
                        if (WORKER_DEBIT_TYPES.includes(t.type)) {
                          payAgg.set(t.person_id, (payAgg.get(t.person_id) || 0) + Number(t.amount));
                        }
                      });
                      const workRows = workers.map(p => {
                        const e = entryAgg.get(p.id) || { work: 0, submitted: 0 };
                        const paid = (payAgg.get(p.id) || 0) + e.submitted;
                        const due = e.work - paid;
                        return { person: p, kind: 'work' as const, total: e.work, paid, due };
                      }).filter(r => r.total > 0 || r.paid > 0);

                      const sumSalaryDue = salaryRows.reduce((s, r) => s + Math.max(0, r.due), 0);
                      const sumWorkDue = workRows.reduce((s, r) => s + Math.max(0, r.due), 0);
                      const totalDue = sumSalaryDue + sumWorkDue;

                      if (salaryRows.length === 0 && workRows.length === 0) {
                        return (
                          <div className="rounded-lg border border-dashed border-border/50 p-4 text-center text-xs text-muted-foreground">
                            কোনো ব্যক্তি বা স্টাফ নেই
                          </div>
                        );
                      }

                      // Combine + sort by abs(due) desc
                      const combined = [...salaryRows, ...workRows].sort((a, b) => Math.abs(b.due) - Math.abs(a.due));
                      const visible = combined.slice(0, 6);

                      return (
                        <div className="rounded-lg border border-border/50 bg-card overflow-hidden">
                          <div className="px-3 py-2 border-b border-border/40 bg-muted/30">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground flex items-center gap-1.5">
                                <Users className="h-3.5 w-3.5" /> মানুষের পাওনা
                              </span>
                              <span className="text-[10px] text-muted-foreground">{combined.length} জন</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-2">
                              <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 px-2 py-1.5">
                                <div className="text-[9px] text-muted-foreground uppercase tracking-wide">বেতন বাকি</div>
                                <div className={`text-sm font-bold tabular-nums ${sumSalaryDue > 0 ? 'text-destructive' : 'text-emerald-600'}`}>৳{sumSalaryDue.toLocaleString()}</div>
                              </div>
                              <div className="rounded-md bg-orange-50 dark:bg-orange-950/30 px-2 py-1.5">
                                <div className="text-[9px] text-muted-foreground uppercase tracking-wide">কাজের বাকি</div>
                                <div className={`text-sm font-bold tabular-nums ${sumWorkDue > 0 ? 'text-destructive' : 'text-emerald-600'}`}>৳{sumWorkDue.toLocaleString()}</div>
                              </div>
                            </div>
                            {totalDue > 0 && (
                              <div className="mt-2 text-[10px] text-center text-muted-foreground">
                                সর্বমোট পাওনা <span className="font-bold text-destructive tabular-nums">৳{totalDue.toLocaleString()}</span>
                              </div>
                            )}
                          </div>
                          <div className="divide-y divide-border/30">
                            {visible.map(r => {
                              const pct = r.total > 0 ? Math.min(100, (r.paid / r.total) * 100) : 0;
                              const badgeColor = r.kind === 'salary'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
                                : 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400';
                              const barColor = r.kind === 'salary' ? 'bg-blue-500' : 'bg-orange-500';
                              return (
                                <button
                                  key={`${r.kind}-${r.person.id}`} type="button"
                                  onClick={() => navigate(`/admin/accounting/persons/${r.person.id}`)}
                                  className="w-full text-left px-3 py-2 hover:bg-muted/30 transition-colors"
                                >
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span className={`text-[8px] px-1 py-0.5 rounded font-semibold shrink-0 ${badgeColor}`}>
                                        {r.kind === 'salary' ? 'বেতন' : 'কাজ'}
                                      </span>
                                      <span className="text-[11px] font-medium truncate">{r.person.name}</span>
                                    </div>
                                    <span className={`text-[11px] font-bold tabular-nums shrink-0 ${r.due > 0 ? 'text-destructive' : r.due < 0 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                                      {r.due > 0 ? '৳' : r.due < 0 ? '+৳' : '৳'}{Math.abs(r.due).toLocaleString()}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                                      <div className={`h-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className="text-[9px] text-muted-foreground tabular-nums">
                                      ৳{r.paid.toLocaleString()}/৳{r.total.toLocaleString()}
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                            {combined.length > 6 && (
                              <div className="px-3 py-1.5 text-center text-[10px] text-muted-foreground">
                                + আরও {combined.length - 6} জন
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* ===== BOTTOM: ইউনিট-অনুযায়ী টাকার প্রবাহ (kept as-is) ===== */}
                {otherMod && otherMod.details.length > 0 && (
                  <div className="pt-2 border-t border-border/40">
                    <div className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-2.5">
                      ইউনিট-অনুযায়ী টাকার প্রবাহ
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {otherMod.details.map((d, i) => {
                        const maxAmt = otherMod.details[0]?.amount || 1;
                        const pct = (d.amount / maxAmt) * 100;
                        const targetUnit = units.find((u: any) => u.id === d.unitId);
                        const unitColor = targetUnit ? hashColor(targetUnit.name) : 'hsl(var(--muted-foreground))';
                        const clickable = d.unitId && d.unitId !== id;
                        const content = (
                          <div className="rounded-lg border border-border/50 bg-card px-3 py-2.5 hover:shadow-sm transition-all h-full">
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="h-6 w-6 rounded-full flex items-center justify-center shrink-0" style={{ background: `${unitColor}20` }}>
                                  <Building2 className="h-3 w-3" style={{ color: unitColor }} />
                                </div>
                                <span className="text-xs font-semibold truncate">{d.label}</span>
                              </div>
                              <span className="text-sm font-bold tabular-nums shrink-0" style={{ color: unitColor }}>
                                ৳{d.amount.toLocaleString()}
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-2">
                              <div className="h-full transition-all duration-500" style={{ width: `${pct}%`, background: unitColor }} />
                            </div>
                            {d.sub && d.sub.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {d.sub.map((s, si) => (
                                  <span key={si} className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                                    {s.label}: <span className="font-semibold text-foreground">৳{s.amount.toLocaleString()}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                        return clickable ? (
                          <button key={i} type="button" onClick={() => navigate(`/admin/accounting/units/${d.unitId}`)} className="w-full text-left">
                            {content}
                          </button>
                        ) : (
                          <div key={i}>{content}</div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>

            </Card>
          </>
        );
      })()}



      <Dialog open={matOpen} onOpenChange={setMatOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>ম্যাটেরিয়াল যোগ করুন</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>আইটেম</Label><Input value={matForm.item_name} onChange={e => setMatForm(f => ({ ...f, item_name: e.target.value }))} placeholder="সুতা, বোতাম, রাবার..." /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>পরিমাণ</Label><Input type="number" value={matForm.quantity} onChange={e => setMatForm(f => ({ ...f, quantity: e.target.value }))} /></div>
              <div><Label>দর (৳)</Label><Input type="number" value={matForm.unit_price} onChange={e => setMatForm(f => ({ ...f, unit_price: e.target.value }))} /></div>
            </div>
            <div><Label>মোট (৳)</Label><Input type="number" value={matForm.total || String(Number(matForm.quantity) * Number(matForm.unit_price) || '')} onChange={e => setMatForm(f => ({ ...f, total: e.target.value }))} /></div>
            <div><Label>তারিখ</Label><Input type="date" value={matForm.date} onChange={e => setMatForm(f => ({ ...f, date: e.target.value }))} /></div>
            <div><Label>বিবরণ</Label><Input value={matForm.description} onChange={e => setMatForm(f => ({ ...f, description: e.target.value }))} placeholder="ঐচ্ছিক" /></div>
            <Button onClick={handleCreateMaterial} disabled={createMaterial.isPending} className="w-full">
              {createMaterial.isPending ? 'সেভ হচ্ছে...' : 'সেভ করুন'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fixed Expense Dialog */}
      <Dialog open={feOpen} onOpenChange={setFeOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{unitSettings.fixed_expenses_label || 'নিয়মিত খরচ'} যোগ করুন</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>ক্যাটাগরি</Label><Input value={feForm.category} onChange={e => setFeForm(f => ({ ...f, category: e.target.value }))} placeholder="ভাড়া, নাস্তা, কারেন্ট বিল..." /></div>
            <div><Label>পরিমাণ (৳)</Label><Input type="number" value={feForm.amount} onChange={e => setFeForm(f => ({ ...f, amount: e.target.value }))} /></div>
            <div><Label>বিবরণ</Label><Input value={feForm.description} onChange={e => setFeForm(f => ({ ...f, description: e.target.value }))} placeholder="ঐচ্ছিক" /></div>
            <Button onClick={handleCreateFixedExpense} disabled={createFixedExpense.isPending} className="w-full">
              {createFixedExpense.isPending ? 'সেভ হচ্ছে...' : 'সেভ করুন'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Custom Expense Dialog */}
      <Dialog open={customExpOpen} onOpenChange={setCustomExpOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{customExpModule} — খরচ যোগ করুন</DialogTitle></DialogHeader>
           <div className="space-y-3">
            {isKaporModule ? (<>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>📋 মেমো নম্বর</Label><Input value={customExpForm.memo_number} onChange={e => setCustomExpForm(f => ({ ...f, memo_number: e.target.value }))} placeholder="010" /></div>
                <div><Label>🏪 দোকানের নাম</Label><Input value={customExpForm.shop_name} onChange={e => setCustomExpForm(f => ({ ...f, shop_name: e.target.value }))} placeholder="দোকানের নাম" /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>📞 দোকানের নম্বর</Label><Input value={customExpForm.shop_phone} onChange={e => setCustomExpForm(f => ({ ...f, shop_phone: e.target.value }))} placeholder="01XXXXXXXXX" /></div>
                <div><Label>📍 ঠিকানা</Label><Input value={customExpForm.shop_address} onChange={e => setCustomExpForm(f => ({ ...f, shop_address: e.target.value }))} placeholder="ঠিকানা" /></div>
              </div>
              <hr className="border-border" />
              <div className="space-y-2">
                {customExpForm.items.map((item, idx) => (
                  <div key={idx} className="p-2 border rounded-md space-y-1.5 bg-accent/30">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">আইটেম #{idx + 1}</span>
                      {customExpForm.items.length > 1 && (
                        <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setCustomExpForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      )}
                    </div>
                    <Input value={item.name} onChange={e => setCustomExpForm(f => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, name: e.target.value } : it) }))} placeholder="আইটেমের নাম..." className="h-8 text-sm" />
                    <div className="grid grid-cols-2 gap-2">
                      <Input value={item.goj} onChange={e => setCustomExpForm(f => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, goj: e.target.value } : it) }))} placeholder="গজ" className="h-8 text-sm" />
                      <Input type="text" inputMode="decimal" value={item.rate} onChange={e => { const raw = e.target.value; if (/^\d*\.?\d*$/.test(raw)) setCustomExpForm(f => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, rate: raw } : it) })); }} placeholder="দর/গজ (৳)" className="h-8 text-sm" />
                    </div>
                    {(Number(item.goj) > 0 && Number(item.rate) > 0) && (
                      <div className="text-xs text-right text-primary font-medium">= ৳{((Number(item.goj) || 0) * (Number(item.rate) || 0)).toLocaleString('en-IN')}</div>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" className="w-full" onClick={() => setCustomExpForm(f => ({ ...f, items: [...f.items, { name: '', goj: '', rate: '' }] }))}>
                  <Plus className="h-3 w-3 mr-1" /> আইটেম যোগ করুন
                </Button>
              </div>
              <div className="flex items-center justify-between text-sm font-semibold bg-muted/50 rounded px-2 py-1.5">
                <span>মোট গজ: {customTotalGoj || '—'}</span>
                <span>মোট: ৳{customTotalAmount ? customTotalAmount.toLocaleString('en-IN') : '—'}</span>
              </div>
              <div>
                <Label>বিল পরিমাণ (৳)</Label>
                <Input type="text" inputMode="numeric" value={customExpForm.bill_amount ? Number(customExpForm.bill_amount).toLocaleString() : ''} onChange={e => { const raw = e.target.value.replace(/,/g, ''); if (/^\d*\.?\d*$/.test(raw)) setCustomExpForm(f => ({ ...f, bill_amount: raw })); }} placeholder={customTotalAmount ? customTotalAmount.toLocaleString('en-IN') : '0'} />
                <p className="text-[11px] text-muted-foreground mt-0.5">খালি রাখলে ক্যালকুলেটেড মোট ব্যবহার হবে</p>
              </div>
            </>) : (<>
              <div><Label>পরিমাণ (৳)</Label><Input type="text" inputMode="numeric" value={customExpForm.amount ? Number(customExpForm.amount).toLocaleString() : ''} onChange={e => { const raw = e.target.value.replace(/,/g, ''); if (/^\d*\.?\d*$/.test(raw)) setCustomExpForm(f => ({ ...f, amount: raw })); }} placeholder="0" /></div>
            </>)}
             <div><Label>তারিখ</Label><Input type="date" value={customExpForm.date} onChange={e => setCustomExpForm(f => ({ ...f, date: e.target.value }))} /></div>
             <div><Label>বিবরণ</Label><Input value={customExpForm.description} onChange={e => setCustomExpForm(f => ({ ...f, description: e.target.value }))} placeholder="ঐচ্ছিক" /></div>
             <Button onClick={handleCreateCustomExpense} disabled={createCustomExpense.isPending} className="w-full">
               {createCustomExpense.isPending ? 'সেভ হচ্ছে...' : 'সেভ করুন'}
             </Button>
           </div>
        </DialogContent>
      </Dialog>

      {/* Add Person Full Form Dialog */}
      <Dialog open={addPersonDialogOpen} onOpenChange={setAddPersonDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{newPersonType === 'loan_kisti' ? 'নতুন ঋণ / লোন' : 'নতুন ব্যক্তি যোগ'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>ধরন</Label>
              <Select value={newPersonType} onValueChange={setNewPersonType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">কর্মচারী (বেতন)</SelectItem>
                  <SelectItem value="salaried_production">কর্মচারী (প্রোডাকশন)</SelectItem>
                  <SelectItem value="production_staff">প্রোডাকশন স্টাফ</SelectItem>
                  <SelectItem value="party">পার্টি</SelectItem>
                  <SelectItem value="supplier">সাপ্লায়ার</SelectItem>
                  <SelectItem value="sales_party">বিক্রি পার্টি</SelectItem>
                  <SelectItem value="work_party">কাজ পার্টি</SelectItem>
                  <SelectItem value="loan_kisti">ঋণ কিস্তি</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{newPersonType === 'loan_kisti' ? 'ঋণের নাম' : 'নাম'}</Label>
              <Input value={newPersonName} onChange={e => setNewPersonName(e.target.value)} placeholder={newPersonType === 'loan_kisti' ? 'যেমন: ব্যাংক লোন' : 'নাম লিখুন'} />
            </div>
            {newPersonType === 'loan_kisti' ? (
              <div className="space-y-3 border border-purple-200 dark:border-purple-900/40 bg-purple-50/40 dark:bg-purple-950/20 rounded-lg p-3">
                <div className="text-xs font-semibold text-purple-700 dark:text-purple-300">💳 ঋণের তথ্য</div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>মূলধন (৳) *</Label><Input type="number" value={loanForm.principal_amount} onChange={e => setLoanForm(f => ({ ...f, principal_amount: e.target.value }))} placeholder="150000" /></div>
                  <div><Label>সুদের হার (%)</Label><Input type="number" step="0.01" value={loanForm.interest_rate} onChange={e => setLoanForm(f => ({ ...f, interest_rate: e.target.value }))} placeholder="0" /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>মোট কিস্তি সংখ্যা</Label><Input type="number" value={loanForm.total_installments} onChange={e => setLoanForm(f => ({ ...f, total_installments: e.target.value }))} placeholder="24" /></div>
                  <div><Label>মাসিক কিস্তি (৳)</Label><Input type="number" value={loanForm.monthly_installment} onChange={e => setLoanForm(f => ({ ...f, monthly_installment: e.target.value }))} placeholder="0" /></div>
                </div>
                <div>
                  <Label>ঋণের আসল শুরুর তারিখ</Label>
                  <Input type="date" value={loanForm.start_date} onChange={e => setLoanForm(f => ({ ...f, start_date: e.target.value }))} />
                </div>
                <div>
                  <Label>আমাদের হিসাবে কিস্তি গণনা শুরু</Label>
                  <Input type="date" value={loanForm.tracking_start_date} onChange={e => setLoanForm(f => ({ ...f, tracking_start_date: e.target.value }))} />
                  <p className="text-[10px] text-muted-foreground mt-1">ঋণ আগে নেওয়া হলেও আমাদের হিসাবে এই তারিখ থেকে কিস্তি গণনা হবে। ফাঁকা রাখলে আসল শুরুর তারিখই ব্যবহার হবে।</p>
                </div>
              </div>
            ) : (
              <>
                <div><Label>ফোন *</Label><Input value={newPersonPhone} onChange={e => setNewPersonPhone(e.target.value)} placeholder="ফোন নম্বর" /></div>
                <div><Label>যোগদানের তারিখ</Label><Input type="date" value={newPersonJoiningDate} onChange={e => setNewPersonJoiningDate(e.target.value)} /></div>
                {(newPersonType === 'employee' || newPersonType === 'salaried_production') && (
                  <>
                    <div><Label>মূল বেতন (৳)</Label><Input type="number" value={newPersonBaseSalary} onChange={e => setNewPersonBaseSalary(e.target.value)} placeholder="0" /></div>
                    <div>
                      <Label>বেতন ধরন</Label>
                      <Select value={newPersonSalaryType} onValueChange={setNewPersonSalaryType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">মাসিক</SelectItem>
                          <SelectItem value="manual">ম্যানুয়াল</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </>
            )}
            <Button onClick={handleAddPerson} disabled={createPerson.isPending} className="w-full">
              {createPerson.isPending ? 'সেভ হচ্ছে...' : (newPersonType === 'loan_kisti' ? 'লোন যোগ করুন' : 'সেভ করুন')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {unitSettings.has_rent && unitSettings.rent_start_date && (
        <PayRentDialog
          open={payRentOpen}
          onOpenChange={setPayRentOpen}
          unitId={id || null}
          unitName={unit?.name}
          rentAmount={Number(unitSettings.rent_amount || 0)}
          rentStartDate={unitSettings.rent_start_date}
        />
      )}
    </div>
  );
}

/* Inline custom module view */
function InlineCustomModule({ unitId, moduleName, onAdd, deleteCustomExpense }: {
  unitId: string; moduleName: string; onAdd: () => void;
  deleteCustomExpense: ReturnType<typeof useDeleteUnitCustomExpense>;
}) {
  const { data: entries = [] } = useUnitCustomExpenses(unitId, moduleName);

  return (
    <div className="border rounded-lg p-3 bg-card animate-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold flex items-center gap-1.5"><Receipt className="h-3.5 w-3.5" /> {moduleName}</h3>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onAdd}><Plus className="h-3 w-3 mr-1" /> যোগ</Button>
      </div>
      {entries.length === 0 ? (
        <div className="text-center py-3 text-xs text-muted-foreground">কোনো এন্ট্রি নেই</div>
      ) : (
        <>
          <div className="space-y-0.5 max-h-64 overflow-y-auto">
            {entries.map(e => (
              <div key={e.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-accent/50">
                <div className="min-w-0">
                  <div className="text-xs font-medium">{e.item_name}</div>
                  {(e.metadata?.memo_number || e.metadata?.shop_name) && (
                    <div className="text-[10px] text-primary/70 font-medium">
                      {e.metadata.memo_number && `মেমো #${e.metadata.memo_number}`}
                      {e.metadata.memo_number && e.metadata.shop_name && ' • '}
                      {e.metadata.shop_name}
                    </div>
                  )}
                  <div className="text-[10px] text-muted-foreground">
                    {format(new Date(e.date), 'dd/MM/yyyy')}
                    {e.metadata?.total_goj && ` · ${e.metadata.total_goj} গজ`}
                    {e.description && ` · ${e.description}`}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-destructive">৳{e.amount.toLocaleString()}</span>
                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => deleteCustomExpense.mutate({ id: e.id, unit_id: unitId, module_name: moduleName })}>
                    <Trash2 className="h-2.5 w-2.5 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-1.5 pt-1.5 border-t text-right text-xs font-bold">মোট: ৳{entries.reduce((s, e) => s + e.amount, 0).toLocaleString()}</div>
        </>
      )}
    </div>
  );
}

