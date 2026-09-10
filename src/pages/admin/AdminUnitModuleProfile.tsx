import { useState, useRef, useCallback, useMemo } from 'react';
import AccountingShareButton from '@/components/admin/AccountingShareButton';
import { buildUnitSlug } from '@/lib/hishabSlug';
import { useParams, useNavigate } from 'react-router-dom';
import { useUnits, useAccounts, useUnitMaterials, useCreateUnitMaterial, useDeleteUnitMaterial, useUnitFixedExpenses, useCreateUnitFixedExpense, useDeleteUnitFixedExpense, useUnitCustomExpenses, useCreateUnitCustomExpense, useUpdateUnitCustomExpense, useDeleteUnitCustomExpense, useCreateTransaction } from '@/hooks/useAccounting';
import { supabase } from '@/integrations/supabase/client';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { usePersons } from '@/hooks/usePersons';
import { useSiteConfig, DEFAULT_NAVBAR_CONFIG } from '@/hooks/useSiteConfig';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Printer, ChevronLeft, ChevronRight, Plus, Package, Receipt, Trash2, Pencil, ClipboardList, Pin, MapPin, Home, Landmark } from 'lucide-react';
import { format } from 'date-fns';
import { toLocalDateStr } from '@/lib/utils';
import { toast } from 'sonner';
import { useDragScroll } from '@/hooks/useDragScroll';

function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 65%, 45%)`;
}

function getUnitStyle(unitName?: string | null): { color: string; label: string } {
  const name = (unitName || '').toLowerCase();
  if (name.includes('অফিস') || name.includes('office')) return { color: '#16a34a', label: unitName || 'অফিস' };
  if (name.includes('সাপ্লায়ার') || name.includes('supplier')) return { color: '#ea580c', label: unitName || 'সাপ্লায়ার' };
  if (name.includes('সেউইং') || name.includes('কারখানা') || name.includes('factory') || name.includes('sewing')) return { color: '#213580', label: unitName || 'সেউইং ফ্যাক্টরি' };
  if (name.includes('print') || name.includes('প্রিন্ট')) return { color: '#7c3aed', label: unitName || 'Print' };
  return { color: hashColor(unitName || 'unit'), label: unitName || 'Staff' };
}

function getModuleLabel(moduleType: string, isOffice: boolean, fixedExpensesLabel?: string): string {
  if (moduleType === 'materials') return 'ম্যাটেরিয়াল ক্রয়';
  if (moduleType === 'fixed_expenses') return fixedExpensesLabel || 'নিয়মিত খরচ';
  if (moduleType.startsWith('custom-')) return moduleType.replace('custom-', '');
  return moduleType;
}

type ModuleConfig = { name: string; type: string };
function normalizeModules(raw: any): ModuleConfig[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((m: any) => typeof m === 'string' ? { name: m, type: m === 'কাপর' ? 'kapor' : 'simple' } : m);
}

export default function AdminUnitModuleProfile() {
  const { unitId, moduleType } = useParams<{ unitId: string; moduleType: string }>();
  const navigate = useNavigate();
  const { data: units = [] } = useUnits();
  const { data: persons = [] } = usePersons({ unit_id: unitId });
  const { data: accounts = [] } = useAccounts();
  const createTransaction = useCreateTransaction();
  const { ref: chipStripRef, onMouseDown: onChipStripMouseDown } = useDragScroll<HTMLDivElement>();
  const unit = useMemo(() => units.find(u => u.id === unitId), [units, unitId]);
  const isOffice = unit?.name === 'অফিস' || (unit?.name || '').toLowerCase().includes('office');
  const isPrintUnit = (unit?.name || '').includes('প্রিন্ট') || (unit?.name || '').toLowerCase().includes('print');
  const workLabel = isOffice ? 'পণ্য কেনার শীট' : isPrintUnit ? 'প্রিন্টের কাজ' : 'কারখানার কাজ';
  const unitSettings: any = unit?.settings || {};
  const fixedExpensesLabel: string = unitSettings.fixed_expenses_label || 'নিয়মিত খরচ';
  const unitStyle = getUnitStyle(unit?.name);
  const { data: navbarConfig } = useSiteConfig('navbar_config');
  const merged = { ...DEFAULT_NAVBAR_CONFIG, ...(navbarConfig || {}) };
  const logoUrl = merged.logo_url;

  const activePersons = useMemo(() => persons.filter(p => p.is_active), [persons]);
  const employees = activePersons.filter(p => p.type === 'employee' || p.type === 'salaried_production');
  const productionStaff = activePersons.filter(p => p.type === 'production_staff');
  const parties = activePersons.filter(p => p.type === 'party' || p.type === 'supplier');
  const salesParties = activePersons.filter(p => p.type === 'sales_party');
  const workParties = activePersons.filter(p => p.type === 'work_party');
  const loanKistis = activePersons.filter(p => p.type === 'loan_kisti');

  // Build combined nav list
  type NavItem = { type: 'person' | 'module'; id: string; name: string; navigateTo: string };
  const allSorted: NavItem[] = useMemo(() => {
    const items: NavItem[] = [];
    [...employees, ...productionStaff, ...parties, ...salesParties, ...workParties, ...loanKistis].forEach(p => items.push({ type: 'person', id: p.id, name: p.name, navigateTo: `/admin/accounting/persons/${p.id}` }));
    // Cash-purchase sheets (কাপর, work-orders) sit right after পার্টি, matching the chip strip order
    const customModules = normalizeModules(unitSettings.custom_modules);
    const kaporModule = customModules.find(m => m.name === 'কাপর');
    if (kaporModule) items.push({ type: 'module', id: `custom-${kaporModule.name}`, name: kaporModule.name, navigateTo: `/admin/accounting/units/${unitId}/modules/custom-${kaporModule.name}` });
    if (!unitSettings.internal_work_party_id) {
      items.push({ type: 'module', id: 'work-orders', name: workLabel, navigateTo: `/admin/accounting/units/${unitId}/work-orders` });
    }
    if (unitSettings.has_materials) items.push({ type: 'module', id: 'materials', name: 'ম্যাটেরিয়াল', navigateTo: `/admin/accounting/units/${unitId}/modules/materials` });
    if (unitSettings.has_fixed_expenses) items.push({ type: 'module', id: 'fixed_expenses', name: fixedExpensesLabel, navigateTo: `/admin/accounting/units/${unitId}/modules/fixed_expenses` });
    if (unitSettings.has_rent) items.push({ type: 'module', id: 'rent', name: 'ভাড়া', navigateTo: `/admin/accounting/units/${unitId}/modules/rent` });
    items.push({ type: 'module', id: 'loans', name: 'ঋণ / ধার', navigateTo: `/admin/accounting/units/${unitId}/modules/loans` });
    for (const m of customModules) {
      if (m.name === 'কাপর') continue;
      items.push({ type: 'module', id: `custom-${m.name}`, name: m.name, navigateTo: `/admin/accounting/units/${unitId}/modules/custom-${m.name}` });
    }
    return items;
  }, [employees, productionStaff, parties, unitSettings, unitId, isOffice, workLabel, fixedExpensesLabel]);

  const currentIdx = allSorted.findIndex(item => item.id === moduleType);
  const prevItem = currentIdx > 0 ? allSorted[currentIdx - 1] : null;
  const nextItem = currentIdx < allSorted.length - 1 ? allSorted[currentIdx + 1] : null;

  // Pin support
  const pinKey = `pinned-chips-${unitId}`;
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

  // Swipe
  const touchStartX = useRef<number | null>(null);
  const handleTouchStart = useCallback((e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; }, []);
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(diff) < 60) return;
    if (diff < 0 && nextItem) navigate(nextItem.navigateTo);
    if (diff > 0 && prevItem) navigate(prevItem.navigateTo);
  }, [nextItem, prevItem, navigate]);

  // Materials hooks
  const isMaterials = moduleType === 'materials';
  const { data: materials = [] } = useUnitMaterials(isMaterials ? unitId : undefined);
  const createMaterial = useCreateUnitMaterial();
  const deleteMaterial = useDeleteUnitMaterial();
  const [matOpen, setMatOpen] = useState(false);
  const [matForm, setMatForm] = useState({ item_name: '', quantity: '', unit_price: '', total: '', date: toLocalDateStr(), description: '' });

  // Fixed expense hooks
  const isFixedExpenses = moduleType === 'fixed_expenses';
  const [expMonth, setExpMonth] = useState(() => new Date().getMonth() + 1);
  const [expYear, setExpYear] = useState(() => new Date().getFullYear());
  const { data: fixedExpenses = [] } = useUnitFixedExpenses(isFixedExpenses ? unitId : undefined, expMonth, expYear);
  const createFixedExpense = useCreateUnitFixedExpense();
  const deleteFixedExpense = useDeleteUnitFixedExpense();
  const [feOpen, setFeOpen] = useState(false);
  const [feForm, setFeForm] = useState({ category: '', amount: '', description: '' });

  // Custom module hooks
  const isCustom = moduleType?.startsWith('custom-');
  const customModuleName = isCustom ? (moduleType || '').replace('custom-', '') : '';
  const { data: customEntries = [] } = useUnitCustomExpenses(isCustom ? unitId : undefined, customModuleName);
  const createCustomExpense = useCreateUnitCustomExpense();
  const updateCustomExpense = useUpdateUnitCustomExpense();
  const deleteCustomExpense = useDeleteUnitCustomExpense();
  const [customExpOpen, setCustomExpOpen] = useState(false);
  const [editingCustomExpenseId, setEditingCustomExpenseId] = useState<string | null>(null);
  const [customExpForm, setCustomExpForm] = useState({ date: toLocalDateStr(), amount: '', description: '', memo_number: '', shop_name: '', shop_phone: '', shop_address: '', bill_amount: '', source: 'cash' as 'cash' | 'bank', items: [{ name: '', goj: '', rate: '' }] as { name: string; goj: string; rate: string }[] });
  const currentModuleConfig = normalizeModules(unitSettings.custom_modules).find(m => m.name === customModuleName);
  const currentModuleType = currentModuleConfig?.type || (customModuleName === 'কাপর' ? 'kapor' : 'simple');
  const isKaporModule = currentModuleType === 'kapor';
  const customTotalGoj = customExpForm.items.reduce((s, i) => s + (Number(i.goj) || 0), 0);
  const customTotalAmount = isKaporModule ? customExpForm.items.reduce((s, i) => s + ((Number(i.goj) || 0) * (Number(i.rate) || 0)), 0) : Number(customExpForm.amount) || 0;

  if (!unitId || !moduleType) return null;

  const chipBase = "inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[11px] font-medium whitespace-nowrap border transition-colors shrink-0";
  const sep = <div className="w-px bg-border shrink-0 my-1" />;

  const getPersonChipStyle = (type: string) => {
    const styles: Record<string, string> = {
      employee: 'border-blue-300/50 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-700/30',
      production_staff: 'border-green-300/50 bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-950/30 dark:text-green-400 dark:border-green-700/30',
      party: 'border-orange-300/50 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-700/30',
      supplier: 'border-orange-300/50 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-700/30',
    };
    return styles[type] || styles.employee;
  };

  const moduleLabel = getModuleLabel(moduleType, isOffice, fixedExpensesLabel);

  const handleCreateMaterial = async () => {
    if (!matForm.item_name.trim()) { toast.error('আইটেমের নাম দিন'); return; }
    const total = Number(matForm.total) || (Number(matForm.quantity) * Number(matForm.unit_price)) || 0;
    if (!total) { toast.error('মোট টাকা দিন'); return; }
    try {
      await createMaterial.mutateAsync({ unit_id: unitId!, item_name: matForm.item_name, quantity: Number(matForm.quantity) || 0, unit_price: Number(matForm.unit_price) || 0, total, date: matForm.date, description: matForm.description });
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
      await createFixedExpense.mutateAsync({ unit_id: unitId!, category: feForm.category, amount, month: expMonth, year: expYear, description: feForm.description });
      toast.success('খরচ যোগ হয়েছে');
      setFeOpen(false);
      setFeForm({ category: '', amount: '', description: '' });
    } catch (e: any) { toast.error(e.message); }
  };

  const handleCreateCustomExpense = async () => {
    const cashAcc = accounts.find(a => a.type === 'cash');
    const bankAcc = accounts.find(a => a.type === 'bank');
    const selectedAccountId = customExpForm.source === 'bank' ? bankAcc?.id : cashAcc?.id;
    if (!selectedAccountId) { toast.error('অ্যাকাউন্ট পাওয়া যায়নি'); return; }

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
        await createTransaction.mutateAsync({ account_id: selectedAccountId, type: 'expense', amount: finalAmount, description: `[${customModuleName}] ${itemName}`, unit_id: unitId, source: customExpForm.source, created_at: new Date(customExpForm.date + 'T00:00:00').toISOString(), unit_name: unit?.name });
        await createCustomExpense.mutateAsync({ unit_id: unitId!, module_name: customModuleName, item_name: itemName, amount: finalAmount, date: customExpForm.date, description: customExpForm.description, metadata });
        toast.success('খরচ যোগ হয়েছে');
        setCustomExpOpen(false);
        resetCustomExpForm();
      } catch (e: any) { toast.error(e.message); }
    } else {
      if (!customTotalAmount) { toast.error('পরিমাণ দিন'); return; }
      try {
        await createTransaction.mutateAsync({ account_id: selectedAccountId, type: 'expense', amount: customTotalAmount, description: `[${customModuleName}] ${customExpForm.description || customModuleName}`, unit_id: unitId, source: customExpForm.source, created_at: new Date(customExpForm.date + 'T00:00:00').toISOString(), unit_name: unit?.name });
        await createCustomExpense.mutateAsync({ unit_id: unitId!, module_name: customModuleName, item_name: customExpForm.description || customModuleName, amount: customTotalAmount, date: customExpForm.date, description: customExpForm.description });
        toast.success('খরচ যোগ হয়েছে');
        setCustomExpOpen(false);
        resetCustomExpForm();
      } catch (e: any) { toast.error(e.message); }
    }
  };

  const resetCustomExpForm = () => setCustomExpForm({ date: toLocalDateStr(), amount: '', description: '', memo_number: '', shop_name: '', shop_phone: '', shop_address: '', bill_amount: '', source: 'cash', items: [{ name: '', goj: '', rate: '' }] });

  const openEditCustomExpense = async (entry: any) => {
    const meta = entry.metadata || {};
    let source: 'cash' | 'bank' = 'cash';
    try {
      const { data: matchingTx } = await (supabase.from('acc_transactions' as any) as any)
        .select('source')
        .eq('unit_id', unitId).eq('type', 'expense')
        .ilike('description', `[${customModuleName}]%`)
        .eq('amount', entry.amount)
        .order('created_at', { ascending: false })
        .limit(1);
      if (matchingTx && matchingTx.length > 0 && matchingTx[0].source === 'bank') source = 'bank';
    } catch { /* default to cash */ }

    setEditingCustomExpenseId(entry.id);
    if (isKaporModule && Array.isArray(meta.items) && meta.items.length > 0) {
      setCustomExpForm({
        date: entry.date, amount: '', description: entry.description || '',
        memo_number: meta.memo_number || '', shop_name: meta.shop_name || '',
        shop_phone: meta.shop_phone || '', shop_address: meta.shop_address || '',
        bill_amount: meta.bill_amount != null ? String(meta.bill_amount) : '',
        source,
        items: meta.items.map((i: any) => ({ name: i.name || '', goj: i.goj != null ? String(i.goj) : '', rate: i.rate != null ? String(i.rate) : '' })),
      });
    } else {
      setCustomExpForm({
        date: entry.date, amount: String(entry.amount), description: entry.description || '',
        memo_number: '', shop_name: '', shop_phone: '', shop_address: '', bill_amount: '',
        source, items: [{ name: '', goj: '', rate: '' }],
      });
    }
  };

  const handleUpdateCustomExpense = async () => {
    if (!editingCustomExpenseId) return;
    const cashAcc = accounts.find(a => a.type === 'cash');
    const bankAcc = accounts.find(a => a.type === 'bank');
    const selectedAccountId = customExpForm.source === 'bank' ? bankAcc?.id : cashAcc?.id;
    if (!selectedAccountId) { toast.error('অ্যাকাউন্ট পাওয়া যায়নি'); return; }

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
        await updateCustomExpense.mutateAsync({ id: editingCustomExpenseId, unit_id: unitId!, module_name: customModuleName, item_name: itemName, amount: finalAmount, date: customExpForm.date, description: customExpForm.description, metadata, source: customExpForm.source, account_id: selectedAccountId });
        toast.success('খরচ আপডেট হয়েছে');
        setEditingCustomExpenseId(null);
        resetCustomExpForm();
      } catch (e: any) { toast.error(e.message); }
    } else {
      if (!customTotalAmount) { toast.error('পরিমাণ দিন'); return; }
      try {
        await updateCustomExpense.mutateAsync({ id: editingCustomExpenseId, unit_id: unitId!, module_name: customModuleName, item_name: customExpForm.description || customModuleName, amount: customTotalAmount, date: customExpForm.date, description: customExpForm.description, source: customExpForm.source, account_id: selectedAccountId });
        toast.success('খরচ আপডেট হয়েছে');
        setEditingCustomExpenseId(null);
        resetCustomExpForm();
      } catch (e: any) { toast.error(e.message); }
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-2 sm:px-4 py-4 space-y-3">
        {/* Toolbar */}
        <div className="flex items-center justify-between print:hidden">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> পেছনে যান
          </Button>
          <div className="flex items-center gap-2">
            {unitId && moduleType && (
              <AccountingShareButton
                entityType="unit-module"
                entityId={buildUnitSlug(unitId, unit?.name)}
                entityName={`${unit?.name || 'ইউনিট'} — ${moduleType}`}
                extraPath={moduleType}
              />
            )}
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-1" /> প্রিন্ট
            </Button>
          </div>
        </div>

        {/* Prev/Next + Chips Bar */}
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm py-1.5 print:hidden" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          <div className="flex items-center justify-center gap-2 mb-1.5">
            <button onClick={() => prevItem && navigate(prevItem.navigateTo)} disabled={!prevItem}
              className="w-7 h-7 rounded-full flex items-center justify-center transition-all disabled:opacity-20 bg-muted/50">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-medium text-muted-foreground">
              {currentIdx >= 0 ? currentIdx + 1 : '–'}/{allSorted.length}
            </span>
            <button onClick={() => nextItem && navigate(nextItem.navigateTo)} disabled={!nextItem}
              className="w-7 h-7 rounded-full flex items-center justify-center transition-all disabled:opacity-20 bg-muted/50">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div
            ref={chipStripRef}
            onMouseDown={onChipStripMouseDown}
            className="flex gap-1.5 overflow-x-auto pb-1 px-1 no-scrollbar select-none cursor-grab active:cursor-grabbing"
            style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
          >
            <button onClick={() => navigate(`/admin/accounting/units/${unitId}`)}
              className={`${chipBase} border-muted-foreground/30 bg-muted/50 text-muted-foreground hover:bg-muted`}>
              ← ইউনিট
            </button>
            {employees.length > 0 && (
              <>
                <span className="inline-flex items-center h-7 px-1 text-[9px] font-bold uppercase tracking-wider text-blue-500 shrink-0">💼</span>
                {employees.map(p => (
                  <button key={p.id} onClick={() => navigate(`/admin/accounting/persons/${p.id}`)}
                    onContextMenu={e => { e.preventDefault(); togglePin('person', p.id); }}
                    className={`${chipBase} ${getPersonChipStyle(p.type)} hover:opacity-80`}>
                    {isPinned('person', p.id) && <Pin className="h-2.5 w-2.5" />}
                    {p.name}
                  </button>
                ))}
              </>
            )}
            {productionStaff.length > 0 && (
              <>
                {employees.length > 0 && sep}
                <span className="inline-flex items-center h-7 px-1 text-[9px] font-bold uppercase tracking-wider text-green-600 shrink-0">⚙️</span>
                {productionStaff.map(p => (
                  <button key={p.id} onClick={() => navigate(`/admin/accounting/persons/${p.id}`)}
                    onContextMenu={e => { e.preventDefault(); togglePin('person', p.id); }}
                    className={`${chipBase} ${getPersonChipStyle(p.type)} hover:opacity-80`}>
                    {isPinned('person', p.id) && <Pin className="h-2.5 w-2.5" />}
                    {p.name}
                  </button>
                ))}
              </>
            )}
            {parties.length > 0 && (
              <>
                {(employees.length > 0 || productionStaff.length > 0) && sep}
                <span className="inline-flex items-center h-7 px-1 text-[9px] font-bold uppercase tracking-wider text-orange-600 shrink-0">🤝</span>
                {parties.map(p => (
                  <button key={p.id} onClick={() => navigate(`/admin/accounting/persons/${p.id}`)}
                    onContextMenu={e => { e.preventDefault(); togglePin('person', p.id); }}
                    className={`${chipBase} ${getPersonChipStyle(p.type)} hover:opacity-80`}>
                    {isPinned('person', p.id) && <Pin className="h-2.5 w-2.5" />}
                    {p.name}
                  </button>
                ))}
              </>
            )}
            {sep}
            {/* Cash-purchase sheets (নগদ টাকায় কেনা — বাকি না রেখে) sit right after পার্টি, not with the general modules */}
            <span className="inline-flex items-center h-7 px-1 text-[9px] font-bold uppercase tracking-wider text-rose-600 shrink-0">💵</span>
            {normalizeModules(unitSettings.custom_modules).filter(mod => mod.name === 'কাপর').map((mod) => {
              const modId = `custom-${mod.name}`;
              return (
                <button key={modId} onClick={() => navigate(`/admin/accounting/units/${unitId}/modules/${modId}`)}
                  onContextMenu={e => { e.preventDefault(); togglePin('module', modId); }}
                  className={`${chipBase} ${moduleType === modId ? 'border-purple-500 bg-purple-100 text-purple-800 ring-1 ring-purple-400 dark:bg-purple-900/50 dark:text-purple-300' : 'border-purple-300/50 bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-700/30'}`}>
                  {isPinned('module', modId) && <Pin className="h-2.5 w-2.5" />}
                  🚀 {mod.name}
                </button>
              );
            })}
            {!unitSettings.internal_work_party_id && (
              <button onClick={() => navigate(`/admin/accounting/units/${unitId}/work-orders`)}
                className={`${chipBase} border-indigo-300/50 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-700/30`}>
                <ClipboardList className="h-3 w-3" /> {workLabel}
              </button>
            )}
            {sep}
            {/* Module chips */}
            {unitSettings.has_materials && (
              <button onClick={() => navigate(`/admin/accounting/units/${unitId}/modules/materials`)}
                onContextMenu={e => { e.preventDefault(); togglePin('module', 'materials'); }}
                className={`${chipBase} ${moduleType === 'materials' ? 'border-amber-500 bg-amber-100 text-amber-800 ring-1 ring-amber-400 dark:bg-amber-900/50 dark:text-amber-300' : 'border-amber-300/50 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-700/30'}`}>
                {isPinned('module', 'materials') && <Pin className="h-2.5 w-2.5" />}
                <Package className="h-3 w-3" /> ম্যাটেরিয়াল
              </button>
            )}
            {unitSettings.has_fixed_expenses && (
              <button onClick={() => navigate(`/admin/accounting/units/${unitId}/modules/fixed_expenses`)}
                onContextMenu={e => { e.preventDefault(); togglePin('module', 'fixed_expenses'); }}
                className={`${chipBase} ${moduleType === 'fixed_expenses' ? 'border-blue-500 bg-blue-100 text-blue-800 ring-1 ring-blue-400 dark:bg-blue-900/50 dark:text-blue-300' : 'border-blue-300/50 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-700/30'}`}>
                {isPinned('module', 'fixed_expenses') && <Pin className="h-2.5 w-2.5" />}
                <Receipt className="h-3 w-3" /> {fixedExpensesLabel}
              </button>
            )}
            {unitSettings.has_rent && (
              <button onClick={() => navigate(`/admin/accounting/units/${unitId}/modules/rent`)}
                onContextMenu={e => { e.preventDefault(); togglePin('module', 'rent'); }}
                className={`${chipBase} ${moduleType === 'rent' ? 'border-pink-500 bg-pink-100 text-pink-800 ring-1 ring-pink-400 dark:bg-pink-900/50 dark:text-pink-300' : 'border-pink-300/50 bg-pink-50 text-pink-700 hover:bg-pink-100 dark:bg-pink-950/30 dark:text-pink-400 dark:border-pink-700/30'}`}>
                {isPinned('module', 'rent') && <Pin className="h-2.5 w-2.5" />}
                <Home className="h-3 w-3" /> ভাড়া
              </button>
            )}
            <button onClick={() => navigate(`/admin/accounting/units/${unitId}/modules/loans`)}
              onContextMenu={e => { e.preventDefault(); togglePin('module', 'loans'); }}
              className={`${chipBase} ${moduleType === 'loans' ? 'border-rose-500 bg-rose-100 text-rose-800 ring-1 ring-rose-400 dark:bg-rose-900/50 dark:text-rose-300' : 'border-rose-300/50 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-700/30'}`}>
              {isPinned('module', 'loans') && <Pin className="h-2.5 w-2.5" />}
              <Landmark className="h-3 w-3" /> ঋণ / ধার
            </button>
            {normalizeModules(unitSettings.custom_modules).filter(mod => mod.name !== 'কাপর').map((mod) => {
              const modId = `custom-${mod.name}`;
              return (
                <button key={modId} onClick={() => navigate(`/admin/accounting/units/${unitId}/modules/${modId}`)}
                  onContextMenu={e => { e.preventDefault(); togglePin('module', modId); }}
                  className={`${chipBase} ${moduleType === modId ? 'border-purple-500 bg-purple-100 text-purple-800 ring-1 ring-purple-400 dark:bg-purple-900/50 dark:text-purple-300' : 'border-purple-300/50 bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-700/30'}`}>
                  {isPinned('module', modId) && <Pin className="h-2.5 w-2.5" />}
                  🚀 {mod.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Branded Header */}
        <div
          className="rounded-t-xl overflow-hidden shadow-lg"
          style={{ borderTop: `4px solid ${unitStyle.color}`, background: `linear-gradient(135deg, ${unitStyle.color}18 0%, ${unitStyle.color}06 100%)` }}
        >
          <div className="flex items-center gap-3 px-4 py-3">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-9 w-9 rounded-full object-cover border-2 shadow-sm" style={{ borderColor: unitStyle.color }} />
            ) : (
              <div className="h-9 w-9 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm" style={{ backgroundColor: unitStyle.color }}>S</div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-bold truncate" style={{ color: unitStyle.color }}>{moduleLabel}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold text-white shadow-sm" style={{ backgroundColor: unitStyle.color }}>
                  মডিউল
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0" />
                <span>{unit?.name || ''}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        {(() => {
          const SummaryCard = ({ label, value, icon, colorClass }: { label: string; value: string | number; icon: string; colorClass: string }) => (
            <div className={`rounded-xl border p-3 ${colorClass}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">{icon}</span>
                <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
              </div>
              <p className="text-lg font-bold">{typeof value === 'number' ? `৳${value.toLocaleString()}` : value}</p>
            </div>
          );

          if (isMaterials) {
            const totalItems = materials.length;
            const totalQty = materials.reduce((s, m) => s + (m.quantity || 0), 0);
            const totalAmount = materials.reduce((s, m) => s + m.total, 0);
            return (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <SummaryCard label="মোট আইটেম" value={`${totalItems} টি`} icon="📦" colorClass="bg-destructive/10 border-destructive/20" />
                <SummaryCard label="মোট পরিমাণ" value={`${totalQty}`} icon="📊" colorClass="bg-green-500/10 border-green-500/20" />
                <SummaryCard label="মোট টাকা" value={totalAmount} icon="💰" colorClass="bg-blue-500/10 border-blue-500/20" />
              </div>
            );
          }

          if (isFixedExpenses) {
            const totalCost = fixedExpenses.reduce((s, e) => s + e.amount, 0);
            const itemCount = fixedExpenses.length;
            return (
              <div className="grid grid-cols-2 gap-3">
                <SummaryCard label="মোট খরচ" value={totalCost} icon="💸" colorClass="bg-destructive/10 border-destructive/20" />
                <SummaryCard label="আইটেম সংখ্যা" value={`${itemCount} টি`} icon="📋" colorClass="bg-blue-500/10 border-blue-500/20" />
              </div>
            );
          }

          if (isCustom) {
            if (isKaporModule) {
              const totalGoj = customEntries.reduce((s, e) => s + (Number((e.metadata as any)?.total_goj) || 0), 0);
              const totalBill = customEntries.reduce((s, e) => s + e.amount, 0);
              return (
                <div className="grid grid-cols-2 gap-3">
                  <SummaryCard label="মোট গজ" value={`${totalGoj.toFixed(1)} গজ`} icon="🧵" colorClass="bg-destructive/10 border-destructive/20" />
                  <SummaryCard label="মোট খরচ" value={totalBill} icon="💰" colorClass="bg-blue-500/10 border-blue-500/20" />
                </div>
              );
            } else {
              const totalAmount = customEntries.reduce((s, e) => s + e.amount, 0);
              const itemCount = customEntries.length;
              return (
                <div className="grid grid-cols-2 gap-3">
                  <SummaryCard label="মোট খরচ" value={totalAmount} icon="💸" colorClass="bg-destructive/10 border-destructive/20" />
                  <SummaryCard label="এন্ট্রি সংখ্যা" value={`${itemCount} টি`} icon="📋" colorClass="bg-blue-500/10 border-blue-500/20" />
                </div>
              );
            }
          }

          return null;
        })()}

        {/* Module Content */}
        {isMaterials && (
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-1.5"><Package className="h-4 w-4" /> ম্যাটেরিয়াল ক্রয়</h3>
                <Button size="sm" onClick={() => setMatOpen(true)}><Plus className="h-3 w-3 mr-1" /> যোগ</Button>
              </div>
              {materials.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">কোনো ম্যাটেরিয়াল নেই</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left px-2 py-2 font-semibold text-muted-foreground">তারিখ</th>
                        <th className="text-left px-2 py-2 font-semibold text-muted-foreground">আইটেম</th>
                        <th className="text-right px-2 py-2 font-semibold text-muted-foreground">পরিমাণ</th>
                        <th className="text-right px-2 py-2 font-semibold text-muted-foreground">দর</th>
                        <th className="text-right px-2 py-2 font-semibold text-muted-foreground">মোট</th>
                        <th className="text-left px-2 py-2 font-semibold text-muted-foreground">বিবরণ</th>
                        <th className="px-2 py-2 print:hidden">⚙</th>
                      </tr>
                    </thead>
                    <tbody>
                      {materials.map(m => (
                        <tr key={m.id} className="border-b last:border-0 hover:bg-accent/50">
                          <td className="px-2 py-2 whitespace-nowrap">{format(new Date(m.date), 'dd/MM/yy')}</td>
                          <td className="px-2 py-2 font-medium">{m.item_name}</td>
                          <td className="px-2 py-2 text-right">{m.quantity || '—'}</td>
                          <td className="px-2 py-2 text-right">{m.unit_price ? `৳${m.unit_price}` : '—'}</td>
                          <td className="px-2 py-2 text-right font-bold text-destructive">৳{m.total.toLocaleString()}</td>
                          <td className="px-2 py-2 text-muted-foreground">{m.description || '—'}</td>
                          <td className="px-2 py-2 print:hidden">
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => deleteMaterial.mutate({ id: m.id, unit_id: unitId! })}>
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t font-bold">
                        <td colSpan={4} className="px-2 py-2 text-right">মোট:</td>
                        <td className="px-2 py-2 text-right">৳{materials.reduce((s, m) => s + m.total, 0).toLocaleString()}</td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {isFixedExpenses && (
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <Receipt className="h-4 w-4" /> {fixedExpensesLabel}
                  <Select value={`${expMonth}-${expYear}`} onValueChange={v => { const [m, y] = v.split('-'); setExpMonth(Number(m)); setExpYear(Number(y)); }}>
                    <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 6 }, (_, i) => {
                        const d = new Date(); d.setMonth(d.getMonth() - i);
                        const m = d.getMonth() + 1, y = d.getFullYear();
                        const mn: Record<number, string> = { 1: 'জানু', 2: 'ফেব্রু', 3: 'মার্চ', 4: 'এপ্রিল', 5: 'মে', 6: 'জুন', 7: 'জুলাই', 8: 'আগস্ট', 9: 'সেপ্টে', 10: 'অক্টো', 11: 'নভে', 12: 'ডিসে' };
                        return <SelectItem key={`${m}-${y}`} value={`${m}-${y}`}>{mn[m]} {y}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                </h3>
                <Button size="sm" onClick={() => setFeOpen(true)}><Plus className="h-3 w-3 mr-1" /> যোগ</Button>
              </div>
              {fixedExpenses.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">এই মাসে কোনো খরচ নেই</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left px-2 py-2 font-semibold text-muted-foreground">ক্যাটাগরি</th>
                        <th className="text-right px-2 py-2 font-semibold text-muted-foreground">পরিমাণ</th>
                        <th className="text-left px-2 py-2 font-semibold text-muted-foreground">বিবরণ</th>
                        <th className="px-2 py-2 print:hidden">⚙</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fixedExpenses.map(e => (
                        <tr key={e.id} className="border-b last:border-0 hover:bg-accent/50">
                          <td className="px-2 py-2 font-medium">{e.category}</td>
                          <td className="px-2 py-2 text-right font-bold text-destructive">৳{e.amount.toLocaleString()}</td>
                          <td className="px-2 py-2 text-muted-foreground">{e.description || '—'}</td>
                          <td className="px-2 py-2 print:hidden">
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => deleteFixedExpense.mutate({ id: e.id, unit_id: unitId! })}>
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t font-bold">
                        <td className="px-2 py-2 text-right">মোট:</td>
                        <td className="px-2 py-2 text-right">৳{fixedExpenses.reduce((s, e) => s + e.amount, 0).toLocaleString()}</td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {isCustom && (() => {
          const moduleConfig = normalizeModules(unitSettings.custom_modules).find(m => m.name === customModuleName);
          const modType = moduleConfig?.type || 'simple';
          const isKapor = modType === 'kapor';
          const isPartyType = modType === 'party';
          const isProductionType = modType === 'production';

          // Running balance for party/production
          let runningBalance = 0;

          return (
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold flex items-center gap-1.5"><Receipt className="h-4 w-4" /> {customModuleName}</h3>
                  <Button size="sm" onClick={() => setCustomExpOpen(true)}><Plus className="h-3 w-3 mr-1" /> যোগ</Button>
                </div>
                {customEntries.length === 0 ? (
                  <div className="text-center py-6 text-sm text-muted-foreground">কোনো এন্ট্রি নেই</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b">
                          {(isKapor || isPartyType) && <th className="text-left px-2 py-2 font-semibold text-muted-foreground">মেমো</th>}
                          <th className="text-left px-2 py-2 font-semibold text-muted-foreground">তারিখ</th>
                          <th className="text-left px-2 py-2 font-semibold text-muted-foreground">{isKapor ? 'আইটেম' : isProductionType ? 'পণ্য' : isPartyType ? 'পণ্য' : 'বিবরণ'}</th>
                          {(isKapor || isPartyType || isProductionType) && <th className="text-right px-2 py-2 font-semibold text-muted-foreground">{isKapor ? 'গজ' : 'পরিমাণ'}</th>}
                          {(isKapor || isPartyType || isProductionType) && <th className="text-right px-2 py-2 font-semibold text-muted-foreground">দর</th>}
                          {(isPartyType || isProductionType) && <th className="text-right px-2 py-2 font-semibold text-muted-foreground">বিল/জমা</th>}
                          <th className="text-right px-2 py-2 font-semibold text-muted-foreground">মোট</th>
                          {(isPartyType || isProductionType) && <th className="text-right px-2 py-2 font-semibold text-muted-foreground">ব্যালেন্স</th>}
                          <th className="px-2 py-2 print:hidden">⚙</th>
                        </tr>
                      </thead>
                      <tbody>
                        {customEntries.map(e => {
                          const meta = (e as any).metadata || {};
                          const isSubmission = meta.is_submission === true;
                          if (isPartyType || isProductionType) {
                            runningBalance += isSubmission ? -e.amount : e.amount;
                          }
                          return isKapor && Array.isArray(meta.items) && meta.items.length > 0 ? (
                            // Kapor: expand items as rows
                            meta.items.map((item: any, idx: number) => (
                              <tr key={`${e.id}-${idx}`} className="border-b last:border-0 hover:bg-accent/50">
                                {idx === 0 ? <td className="px-2 py-2 whitespace-nowrap" rowSpan={meta.items.length}>{meta.memo_number || '—'}</td> : null}
                                {idx === 0 ? <td className="px-2 py-2 whitespace-nowrap" rowSpan={meta.items.length}>{format(new Date(e.date), 'dd/MM/yy')}</td> : null}
                                <td className="px-2 py-2">{item.name}</td>
                                <td className="px-2 py-2 text-right">{item.goj || '—'}</td>
                                <td className="px-2 py-2 text-right">{item.rate ? `৳${item.rate}` : '—'}</td>
                                <td className="px-2 py-2 text-right font-bold">{item.amount ? `৳${Number(item.amount).toLocaleString()}` : '—'}</td>
                                {idx === 0 ? (
                                  <td className="px-2 py-2 print:hidden" rowSpan={meta.items.length}>
                                    <div className="flex items-center gap-0.5">
                                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openEditCustomExpense(e)}>
                                        <Pencil className="h-3 w-3" />
                                      </Button>
                                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => deleteCustomExpense.mutate({ id: e.id, unit_id: unitId!, module_name: customModuleName })}>
                                        <Trash2 className="h-3 w-3 text-destructive" />
                                      </Button>
                                    </div>
                                  </td>
                                ) : null}
                              </tr>
                            ))
                          ) : (
                            <tr key={e.id} className={`border-b last:border-0 hover:bg-accent/50 ${isSubmission ? 'bg-green-50/50 dark:bg-green-950/20' : ''}`}>
                              {(isKapor || isPartyType) && <td className="px-2 py-2 whitespace-nowrap">{meta.memo_number || '—'}</td>}
                              <td className="px-2 py-2 whitespace-nowrap">{format(new Date(e.date), 'dd/MM/yy')}</td>
                              <td className="px-2 py-2 font-medium">{e.item_name}</td>
                              {(isKapor || isPartyType || isProductionType) && <td className="px-2 py-2 text-right">{meta.quantity || meta.total_goj || '—'}</td>}
                              {(isKapor || isPartyType || isProductionType) && <td className="px-2 py-2 text-right">{meta.rate ? `৳${meta.rate}` : '—'}</td>}
                              {(isPartyType || isProductionType) && (
                                <td className={`px-2 py-2 text-right font-bold ${isSubmission ? 'text-green-600' : 'text-destructive'}`}>
                                  {isSubmission ? `জমা ৳${e.amount.toLocaleString()}` : `৳${e.amount.toLocaleString()}`}
                                </td>
                              )}
                              {!(isPartyType || isProductionType) && <td className="px-2 py-2 text-right font-bold text-destructive">৳{e.amount.toLocaleString()}</td>}
                              {(isPartyType || isProductionType) && <td className="px-2 py-2 text-right font-bold">৳{runningBalance.toLocaleString()}</td>}
                              <td className="px-2 py-2 print:hidden">
                                <div className="flex items-center gap-0.5">
                                  {!(isPartyType || isProductionType) && (
                                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openEditCustomExpense(e)}>
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                  )}
                                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => deleteCustomExpense.mutate({ id: e.id, unit_id: unitId!, module_name: customModuleName })}>
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t font-bold">
                          <td colSpan={isKapor ? 5 : isPartyType || isProductionType ? 5 : 2} className="px-2 py-2 text-right">মোট:</td>
                          <td className="px-2 py-2 text-right">৳{customEntries.reduce((s, e) => s + e.amount, 0).toLocaleString()}</td>
                          <td colSpan={3}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })()}

        {/* Material Dialog */}
        <Dialog open={matOpen} onOpenChange={setMatOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>ম্যাটেরিয়াল যোগ করুন</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>আইটেম</Label><Input value={matForm.item_name} onChange={e => setMatForm(f => ({ ...f, item_name: e.target.value }))} placeholder="সুতা, বোতাম..." /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>পরিমাণ</Label><Input type="number" value={matForm.quantity} onChange={e => setMatForm(f => ({ ...f, quantity: e.target.value }))} /></div>
                <div><Label>দর (৳)</Label><Input type="number" value={matForm.unit_price} onChange={e => setMatForm(f => ({ ...f, unit_price: e.target.value }))} /></div>
              </div>
              <div><Label>মোট (৳)</Label><Input type="number" value={matForm.total || String(Number(matForm.quantity) * Number(matForm.unit_price) || '')} onChange={e => setMatForm(f => ({ ...f, total: e.target.value }))} /></div>
              <div><Label>তারিখ</Label><Input type="date" value={matForm.date} onChange={e => setMatForm(f => ({ ...f, date: e.target.value }))} /></div>
              <div><Label>বিবরণ</Label><Input value={matForm.description} onChange={e => setMatForm(f => ({ ...f, description: e.target.value }))} placeholder="ঐচ্ছিক" /></div>
              <Button onClick={handleCreateMaterial} disabled={createMaterial.isPending} className="w-full">{createMaterial.isPending ? 'সেভ হচ্ছে...' : 'সেভ করুন'}</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Fixed Expense Dialog */}
        <Dialog open={feOpen} onOpenChange={setFeOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{fixedExpensesLabel} যোগ করুন</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>ক্যাটাগরি</Label><Input value={feForm.category} onChange={e => setFeForm(f => ({ ...f, category: e.target.value }))} placeholder="ভাড়া, নাস্তা..." /></div>
              <div><Label>পরিমাণ (৳)</Label><Input type="number" value={feForm.amount} onChange={e => setFeForm(f => ({ ...f, amount: e.target.value }))} /></div>
              <div><Label>বিবরণ</Label><Input value={feForm.description} onChange={e => setFeForm(f => ({ ...f, description: e.target.value }))} placeholder="ঐচ্ছিক" /></div>
              <Button onClick={handleCreateFixedExpense} disabled={createFixedExpense.isPending} className="w-full">{createFixedExpense.isPending ? 'সেভ হচ্ছে...' : 'সেভ করুন'}</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Custom Expense Dialog */}
        <Dialog
          open={customExpOpen || !!editingCustomExpenseId}
          onOpenChange={(o) => { if (!o) { setCustomExpOpen(false); setEditingCustomExpenseId(null); resetCustomExpForm(); } }}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{customModuleName} — {editingCustomExpenseId ? 'খরচ এডিট করুন' : 'খরচ যোগ করুন'}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              {isKaporModule ? (<>
                <div><Label>📋 মেমো নম্বর</Label><Input value={customExpForm.memo_number} onChange={e => setCustomExpForm(f => ({ ...f, memo_number: e.target.value }))} placeholder="010" /></div>
                <div className="grid grid-cols-3 gap-2">
                  <div><Label>🏪 দোকানের নাম</Label><Input value={customExpForm.shop_name} onChange={e => setCustomExpForm(f => ({ ...f, shop_name: e.target.value }))} placeholder="দোকানের নাম" /></div>
                  <div><Label>📞 নম্বর</Label><Input value={customExpForm.shop_phone} onChange={e => setCustomExpForm(f => ({ ...f, shop_phone: e.target.value }))} placeholder="01XXXXXXXXX" /></div>
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
              <div>
                <Label>পেমেন্ট সোর্স</Label>
                <RadioGroup value={customExpForm.source} onValueChange={(v: 'cash' | 'bank') => setCustomExpForm(f => ({ ...f, source: v }))} className="flex gap-4 mt-1">
                  <div className="flex items-center gap-1.5"><RadioGroupItem value="cash" id="src-cash" /><Label htmlFor="src-cash" className="font-normal cursor-pointer">💵 ক্যাশ</Label></div>
                  <div className="flex items-center gap-1.5"><RadioGroupItem value="bank" id="src-bank" /><Label htmlFor="src-bank" className="font-normal cursor-pointer">🏦 ব্যাংক</Label></div>
                </RadioGroup>
              </div>
              <div><Label>তারিখ</Label><Input type="date" value={customExpForm.date} onChange={e => setCustomExpForm(f => ({ ...f, date: e.target.value }))} /></div>
              <div><Label>বিবরণ</Label><Input value={customExpForm.description} onChange={e => setCustomExpForm(f => ({ ...f, description: e.target.value }))} placeholder="ঐচ্ছিক" /></div>
              {editingCustomExpenseId ? (
                <Button onClick={handleUpdateCustomExpense} disabled={updateCustomExpense.isPending} className="w-full">{updateCustomExpense.isPending ? 'আপডেট হচ্ছে...' : 'আপডেট করুন'}</Button>
              ) : (
                <Button onClick={handleCreateCustomExpense} disabled={createCustomExpense.isPending || createTransaction.isPending} className="w-full">{(createCustomExpense.isPending || createTransaction.isPending) ? 'সেভ হচ্ছে...' : 'সেভ করুন'}</Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
