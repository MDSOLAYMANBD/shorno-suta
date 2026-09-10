import { useState, useMemo, useEffect } from 'react';
import { useUnits, useCreateUnit, useUpdateUnit, useAccounts, type AccUnit } from '@/hooks/useAccounting';
import { usePersons, useCreatePerson, useUpdatePerson, useDeletePerson, type AccPerson } from '@/hooks/usePersons';
import { useAllSettings } from '@/hooks/useAllSettings';
import { useUpdateSetting } from '@/hooks/useStoreSettings';
import { useLoans, useInvestments, useStockValuation, useAllLoanPaymentCounts } from '@/hooks/useLoans';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';

import { toast } from 'sonner';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, Building2, Users, Trash2, Flag, RotateCcw, Landmark, DollarSign, CreditCard, Package, ChevronRight, UserPlus, Layers, Home } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

type PersonFormType = {
  name: string; phone: string; type: string; unit_id: string; joining_date: string; base_salary: string; salary_type: string;
  principal_amount?: string; interest_rate?: string; total_installments?: string; monthly_installment?: string; start_date?: string; tracking_start_date?: string;
};

const typeLabel: Record<string, string> = {
  employee: 'কর্মচারী (বেতন)', salaried_production: 'কর্মচারী (প্রোডাকশন)', production_staff: 'প্রোডাকশন স্টাফ', party: 'পার্টি', supplier: 'সাপ্লায়ার',
  sales_party: 'বিক্রি পার্টি', work_party: 'কাজ পার্টি', loan_kisti: 'ঋণ কিস্তি',
};

const allPersonTypes = Object.keys(typeLabel);

const PersonFormFields = ({ f, setF, allowedTypes, allPersons }: { f: PersonFormType; setF: React.Dispatch<React.SetStateAction<PersonFormType>>; allowedTypes: string[]; allPersons?: AccPerson[] }) => {
  const isLoan = f.type === 'loan_kisti';
  const warnings: string[] = [];
  if (allPersons && !isLoan) {
    if (f.phone && f.phone.length >= 5) {
      const match = allPersons.find(p => p.phone === f.phone);
      if (match) warnings.push(`⚠️ এই নম্বরে '${match.name}' (${match.person_code || 'ID নেই'}) ${!match.is_active ? '— নিষ্ক্রিয়' : '— সক্রিয়'}`);
    }
    if (f.name.trim().length >= 3) {
      const match = allPersons.find(p => p.name.toLowerCase() === f.name.trim().toLowerCase());
      if (match) warnings.push(`⚠️ একই নামে '${match.name}' (${match.person_code || 'ID নেই'}) ${!match.is_active ? '— নিষ্ক্রিয়' : '— সক্রিয়'}`);
    }
  }
  return (
    <div className="space-y-3">
      <div>
        <Label>ধরন</Label>
        <Select value={f.type} onValueChange={v => setF(prev => ({ ...prev, type: v }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{allowedTypes.map(t => <SelectItem key={t} value={t}>{typeLabel[t] || t}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div>
        <Label>{isLoan ? 'ঋণের নাম' : 'নাম'}</Label>
        <Input value={f.name} onChange={e => setF(prev => ({ ...prev, name: e.target.value }))} placeholder={isLoan ? 'যেমন: ব্যাংক লোন' : ''} />
      </div>
      {!isLoan && (
        <div><Label>ফোন *</Label><Input value={f.phone} onChange={e => setF(prev => ({ ...prev, phone: e.target.value }))} /></div>
      )}
      {warnings.length > 0 && (
        <div className="space-y-1">
          {warnings.map((w, i) => (
            <div key={i} className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded px-2 py-1.5">{w}</div>
          ))}
        </div>
      )}
      {isLoan ? (
        <div className="space-y-3 border border-purple-200 dark:border-purple-900/40 bg-purple-50/40 dark:bg-purple-950/20 rounded-lg p-3">
          <div className="text-xs font-semibold text-purple-700 dark:text-purple-300">💳 ঋণের তথ্য</div>
          <div><Label>মূলধন (৳) *</Label><Input type="number" value={f.principal_amount || ''} onChange={e => setF(prev => ({ ...prev, principal_amount: e.target.value }))} placeholder="যেমন: 150000" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>সুদ %</Label><Input type="number" step="0.01" value={f.interest_rate || ''} onChange={e => setF(prev => ({ ...prev, interest_rate: e.target.value }))} placeholder="0" /></div>
            <div><Label>মোট কিস্তি</Label><Input type="number" value={f.total_installments || ''} onChange={e => setF(prev => ({ ...prev, total_installments: e.target.value }))} placeholder="24" /></div>
          </div>
          <div><Label>মাসিক কিস্তি (৳)</Label><Input type="number" value={f.monthly_installment || ''} onChange={e => setF(prev => ({ ...prev, monthly_installment: e.target.value }))} placeholder="0" /></div>
          <div><Label>ঋণের আসল শুরুর তারিখ</Label><Input type="date" value={f.start_date || ''} onChange={e => setF(prev => ({ ...prev, start_date: e.target.value }))} /></div>
          <div>
            <Label>আমাদের হিসাবে কিস্তি গণনা শুরু</Label>
            <Input type="date" value={f.tracking_start_date || ''} onChange={e => setF(prev => ({ ...prev, tracking_start_date: e.target.value }))} />
            <p className="text-[10px] text-muted-foreground mt-1">ফাঁকা রাখলে আসল শুরুর তারিখই ব্যবহার হবে।</p>
          </div>
        </div>
      ) : (
        <>
          <div><Label>যোগদানের তারিখ</Label><Input type="date" value={f.joining_date} onChange={e => setF(prev => ({ ...prev, joining_date: e.target.value }))} /></div>
          {(f.type === 'employee' || f.type === 'salaried_production') && (
            <>
              <div><Label>মূল বেতন (৳)</Label><Input type="number" value={f.base_salary} onChange={e => setF(prev => ({ ...prev, base_salary: e.target.value }))} /></div>
              <div>
                <Label>বেতন ধরন</Label>
                <Select value={f.salary_type} onValueChange={v => setF(prev => ({ ...prev, salary_type: v }))}>
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
    </div>
  );
};

export default function AdminAccountingSettings() {
  const navigate = useNavigate();
  const { data: units = [], isLoading: unitsLoading } = useUnits();
  const { data: persons = [], isLoading: personsLoading } = usePersons();
  const { data: allSettings } = useAllSettings();

  // Business summary data for clickable card
  const { data: loans = [] } = useLoans();
  const { data: loanPaymentCounts = {} } = useAllLoanPaymentCounts();
  const { data: investments = [] } = useInvestments();
  const { data: stockItems = [] } = useStockValuation();

  const totalStockValue = useMemo(() => stockItems.reduce((s, p) => s + (p.stock * p.price), 0), [stockItems]);
  const totalInvestment = useMemo(() => investments.reduce((s, i) => s + Number(i.amount), 0), [investments]);
  const totalLoanPrincipal = useMemo(() => loans.filter(l => l.status === 'active').reduce((s, l) => s + Number(l.principal_amount), 0), [loans]);

  const bizConfig = useMemo(() => {
    try {
      const parsed = JSON.parse(allSettings?.acc_business_config || '{}');
      const cash = parsed.opening_balance_cash ?? parsed.opening_balance ?? 0;
      const bank = parsed.opening_balance_bank ?? 0;
      return { opening_balance_cash: cash, opening_balance_bank: bank, initial_stock_value: parsed.initial_stock_value || 0 };
    } catch { return { opening_balance_cash: 0, opening_balance_bank: 0, initial_stock_value: 0 }; }
  }, [allSettings?.acc_business_config]);

  const totalCapital = bizConfig.opening_balance_cash + bizConfig.opening_balance_bank + totalInvestment;

  const createUnit = useCreateUnit();
  const updateUnit = useUpdateUnit();
  const createPerson = useCreatePerson();
  const updatePerson = useUpdatePerson();
  const deletePerson = useDeletePerson();

  const [unitOpen, setUnitOpen] = useState(false);
  const [unitName, setUnitName] = useState('');
  const [unitAllowedTypes, setUnitAllowedTypes] = useState<string[]>(['employee']);
  const [editUnitId, setEditUnitId] = useState<string | null>(null);
  const [editUnitName, setEditUnitName] = useState('');
  const [editUnitAllowedTypes, setEditUnitAllowedTypes] = useState<string[]>([]);
  const [editUnitSettings, setEditUnitSettings] = useState<Record<string, any>>({});
  const [personOpen, setPersonOpen] = useState(false);
  const [personForm, setPersonForm] = useState<PersonFormType>({ name: '', phone: '', type: 'employee', unit_id: '', joining_date: '', base_salary: '', salary_type: 'monthly', principal_amount: '', interest_rate: '', total_installments: '', monthly_installment: '', start_date: '' });
  const [editPersonOpen, setEditPersonOpen] = useState(false);
  const [editPersonId, setEditPersonId] = useState<string | null>(null);
  const [editPersonForm, setEditPersonForm] = useState<PersonFormType>({ name: '', phone: '', type: 'employee', unit_id: '', joining_date: '', base_salary: '', salary_type: 'monthly' });
  const [deletePersonId, setDeletePersonId] = useState<string | null>(null);
  const [resignPersonId, setResignPersonId] = useState<string | null>(null);
  const [addModuleUnitId, setAddModuleUnitId] = useState<string | null>(null);
  const [newModuleName, setNewModuleName] = useState('');

  const personsByUnit = useMemo(() => {
    const grouped: Record<string, AccPerson[]> = {};
    for (const p of persons) {
      const key = p.unit_id || '__none__';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(p);
    }
    return grouped;
  }, [persons]);

  const handleCreateUnit = async () => {
    if (!unitName.trim()) { toast.error('ইউনিটের নাম দিন'); return; }
    try {
      await createUnit.mutateAsync({ name: unitName.trim(), allowed_types: [] } as any);
      toast.success('ইউনিট তৈরি হয়েছে');
      setUnitName('');
      setUnitOpen(false);
    } catch (e: any) { toast.error(e.message); }
  };

  const handleUpdateUnit = async () => {
    if (!editUnitId || !editUnitName.trim()) return;
    try {
      await updateUnit.mutateAsync({ id: editUnitId, name: editUnitName.trim(), allowed_types: editUnitAllowedTypes, settings: editUnitSettings } as any);
      toast.success('আপডেট হয়েছে');
      setEditUnitId(null);
    } catch (e: any) { toast.error(e.message); }
  };

  const handleToggleUnit = async (id: string, currentActive: boolean) => {
    try {
      await updateUnit.mutateAsync({ id, is_active: !currentActive });
      toast.success(!currentActive ? 'সক্রিয় করা হয়েছে' : 'নিষ্ক্রিয় করা হয়েছে');
    } catch (e: any) { toast.error(e.message); }
  };

  const [activePersonUnitId, setActivePersonUnitId] = useState<string>('');
  const openPersonDialogForUnit = (unitId: string) => {
    const unit = units.find(u => u.id === unitId);
    const defaultType = unit?.allowed_types?.[0] || 'employee';
    setActivePersonUnitId(unitId);
    setPersonForm(f => ({ ...f, unit_id: unitId, type: defaultType, name: '', phone: '', base_salary: '', joining_date: '' }));
    setPersonOpen(true);
  };

  const handleCreatePerson = async () => {
    if (!personForm.name.trim()) { toast.error(personForm.type === 'loan_kisti' ? 'ঋণের নাম দিন' : 'নাম দিন'); return; }
    if (personForm.type !== 'loan_kisti' && !personForm.phone.trim()) { toast.error('ফোন নম্বর দিন'); return; }
    try {
      const payload: any = {
        name: personForm.name, phone: personForm.phone || null, type: personForm.type,
        unit_id: personForm.unit_id || null, joining_date: personForm.joining_date || null,
        base_salary: Number(personForm.base_salary) || 0, salary_type: personForm.salary_type,
      };
      if (personForm.type === 'loan_kisti') {
        if (!Number(personForm.principal_amount)) { toast.error('মূলধন দিন'); return; }
        payload.phone = null;
        payload.joining_date = null;
        payload.base_salary = 0;
        payload._loanPayload = {
          principal_amount: Number(personForm.principal_amount) || 0,
          interest_rate: Number(personForm.interest_rate) || 0,
          total_installments: Number(personForm.total_installments) || 0,
          monthly_installment: Number(personForm.monthly_installment) || 0,
          start_date: personForm.start_date || new Date().toISOString().slice(0, 10),
          tracking_start_date: personForm.tracking_start_date || personForm.start_date || new Date().toISOString().slice(0, 10),
        };
      }
      await createPerson.mutateAsync(payload);
      toast.success(personForm.type === 'loan_kisti' ? 'ঋণ যোগ হয়েছে' : 'ব্যক্তি যোগ হয়েছে');
      setPersonOpen(false);
      setPersonForm({ name: '', phone: '', type: 'employee', unit_id: '', joining_date: '', base_salary: '', salary_type: 'monthly', principal_amount: '', interest_rate: '', total_installments: '', monthly_installment: '', start_date: '' });
    } catch (e: any) { toast.error(e.message); }
  };

  const openEditPerson = (p: AccPerson) => {
    setEditPersonId(p.id);
    setEditPersonForm({
      name: p.name, phone: p.phone || '', type: p.type,
      unit_id: p.unit_id || '', joining_date: p.joining_date || '',
      base_salary: String(p.base_salary || ''), salary_type: p.salary_type,
    });
    setEditPersonOpen(true);
  };

  const handleUpdatePerson = async () => {
    if (!editPersonId || !editPersonForm.name.trim()) { toast.error('নাম দিন'); return; }
    try {
      await updatePerson.mutateAsync({
        id: editPersonId, name: editPersonForm.name, phone: editPersonForm.phone || null, type: editPersonForm.type,
        unit_id: editPersonForm.unit_id || null, joining_date: editPersonForm.joining_date || null,
        base_salary: Number(editPersonForm.base_salary) || 0, salary_type: editPersonForm.salary_type,
      } as any);
      toast.success('আপডেট হয়েছে');
      setEditPersonOpen(false);
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDeletePerson = async () => {
    if (!deletePersonId) return;
    try {
      await deletePerson.mutateAsync({ id: deletePersonId });
      toast.success('ব্যক্তি মুছে ফেলা হয়েছে');
      setDeletePersonId(null);
    } catch (e: any) { toast.error(e.message); }
  };

  const handleResignPerson = async () => {
    if (!resignPersonId) return;
    try {
      await updatePerson.mutateAsync({ id: resignPersonId, is_active: false, resigned_at: new Date().toISOString() } as any);
      toast.success('বিদায় চিহ্নিত করা হয়েছে');
      setResignPersonId(null);
    } catch (e: any) { toast.error(e.message); }
  };

  const handleReactivatePerson = async (id: string) => {
    try {
      await updatePerson.mutateAsync({ id, is_active: true, resigned_at: null } as any);
      toast.success('আবার সক্রিয় করা হয়েছে');
    } catch (e: any) { toast.error(e.message); }
  };

  const isResigned = (p: AccPerson) => !p.is_active && (p as any).resigned_at;

  const renderPersonRow = (p: AccPerson) => {
    const resigned = isResigned(p);
    return (
      <div key={p.id} className={`flex items-center justify-between py-2.5 px-3 rounded-md transition-colors ${resigned ? 'bg-destructive/10 border border-destructive/20' : 'hover:bg-accent/50'}`}>
        <Link to={`/admin/accounting/persons/${p.id}`} className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className={`h-7 w-7 rounded-full flex items-center justify-center ${resigned ? 'bg-destructive/20' : 'bg-primary/10'}`}>
            <Users className={`h-3.5 w-3.5 ${resigned ? 'text-destructive' : 'text-primary'}`} />
          </div>
           <div className="min-w-0">
            <div className="font-medium text-sm flex items-center gap-1.5">
              {p.name}
              {p.person_code && <span className="text-[9px] font-mono bg-muted px-1 py-0.5 rounded">{p.person_code}</span>}
              {resigned && <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4">বিদায়</Badge>}
            </div>
            <span className="px-1 py-0.5 rounded bg-muted text-[10px] text-muted-foreground">{p.type}</span>
          </div>
        </Link>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-sm font-medium mr-2">৳{(p.base_salary || 0).toLocaleString()}</span>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditPerson(p)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          {resigned ? (
            <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={() => handleReactivatePerson(p.id)} title="আবার সক্রিয় করুন">
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setResignPersonId(p.id)} title="বিদায়/রিজাইন">
              <Flag className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeletePersonId(p.id)} title="ডিলিট">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/admin/accounting')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold">হিসাব সেটিংস</h1>
        </div>
        <Button size="sm" variant="outline" onClick={() => setUnitOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> নতুন ইউনিট
        </Button>
      </div>

      {/* Clickable Business Account Summary Card */}
      <Card className="cursor-pointer hover:shadow-md transition-shadow border-primary/20" onClick={() => navigate('/admin/accounting/business')}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Landmark className="h-4 w-4" /> ব্যবসায়িক হিসাব
            </CardTitle>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-emerald-500/10 rounded-lg p-2 text-center">
              <DollarSign className="h-4 w-4 mx-auto text-emerald-600 mb-0.5" />
              <div className="text-[10px] text-muted-foreground">মূলধন</div>
              <div className="text-xs font-bold">৳{totalCapital.toLocaleString('bn-BD')}</div>
            </div>
            <div className="bg-orange-500/10 rounded-lg p-2 text-center">
              <CreditCard className="h-4 w-4 mx-auto text-orange-600 mb-0.5" />
              <div className="text-[10px] text-muted-foreground">সক্রিয় ঋণ</div>
              <div className="text-xs font-bold">৳{totalLoanPrincipal.toLocaleString('bn-BD')}</div>
            </div>
            <div className="bg-blue-500/10 rounded-lg p-2 text-center">
              <Package className="h-4 w-4 mx-auto text-blue-600 mb-0.5" />
              <div className="text-[10px] text-muted-foreground">স্টক মূল্য</div>
              <div className="text-xs font-bold">৳{totalStockValue.toLocaleString('bn-BD')}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {unitsLoading || personsLoading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">লোড হচ্ছে...</div>
      ) : (
        <>
          {units.map(u => {
            const unitPersons = personsByUnit[u.id] || [];
            const unitTypes = u.allowed_types || [];
            // Group persons by type
            const personsByType: Record<string, AccPerson[]> = {};
            for (const p of unitPersons) {
              if (!personsByType[p.type]) personsByType[p.type] = [];
              personsByType[p.type].push(p);
            }
            return (
              <Card key={u.id}>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  {editUnitId === u.id ? (
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Input value={editUnitName} onChange={e => setEditUnitName(e.target.value)} className="h-8 text-sm" autoFocus
                          onKeyDown={e => e.key === 'Enter' && handleUpdateUnit()} />
                        <Button size="sm" variant="default" onClick={handleUpdateUnit} className="h-8">সেভ</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditUnitId(null)} className="h-8">বাতিল</Button>
                      </div>
                      {/* Module settings - card style */}
                      <div className="space-y-1.5 px-1">
                        <div className="text-xs font-medium text-muted-foreground mb-1">খরচ মডিউল</div>
                        {/* Built-in modules */}
                        <div className="flex items-center justify-between bg-muted rounded-md p-2">
                          <div className="flex items-center gap-2">
                            <Package className="h-3.5 w-3.5 text-primary" />
                            <span className="text-xs font-medium">ম্যাটেরিয়াল ক্রয়</span>
                          </div>
                          <Switch checked={!!editUnitSettings.has_materials} onCheckedChange={v => setEditUnitSettings(s => ({ ...s, has_materials: v }))} />
                        </div>
                        <div className="flex items-center justify-between bg-muted rounded-md p-2">
                          <div className="flex items-center gap-2">
                            <CreditCard className="h-3.5 w-3.5 text-primary" />
                            <span className="text-xs font-medium">নিয়মিত খরচ</span>
                          </div>
                          <Switch checked={!!editUnitSettings.has_fixed_expenses} onCheckedChange={v => setEditUnitSettings(s => ({ ...s, has_fixed_expenses: v }))} />
                        </div>
                        {editUnitSettings.has_fixed_expenses && (
                          <div className="bg-muted rounded-md p-2">
                            <Label className="text-[10px] text-muted-foreground">এই ইউনিটে অন্য নামে দেখাতে চাইলে (ঐচ্ছিক, যেমন "প্রিন্ট খরচ")</Label>
                            <Input className="h-7 text-xs mt-1" value={editUnitSettings.fixed_expenses_label || ''}
                              placeholder="নিয়মিত খরচ"
                              onChange={e => setEditUnitSettings(s => ({ ...s, fixed_expenses_label: e.target.value || undefined }))} />
                          </div>
                        )}
                        <div className="flex items-center justify-between bg-muted rounded-md p-2">
                          <div className="flex items-center gap-2">
                            <Home className="h-3.5 w-3.5 text-primary" />
                            <span className="text-xs font-medium">ভাড়া</span>
                          </div>
                          <Switch checked={!!editUnitSettings.has_rent} onCheckedChange={v => setEditUnitSettings(s => ({ ...s, has_rent: v }))} />
                        </div>
                        {editUnitSettings.has_rent && !editUnitSettings.rent_start_date && (
                          <div className="space-y-1.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-md p-2">
                            <div className="text-[11px] font-medium text-rose-700 dark:text-rose-400">ভাড়া হিসাব শুরু করুন (একবারই সেট করা যাবে)</div>
                            <div>
                              <Label className="text-[10px]">মাসিক ভাড়া কত (৳)</Label>
                              <Input type="number" className="h-7 text-xs" value={editUnitSettings.rent_amount || ''}
                                onChange={e => setEditUnitSettings(s => ({ ...s, rent_amount: Number(e.target.value) || 0 }))} />
                            </div>
                            <div>
                              <Label className="text-[10px]">কোন মাস থেকে হিসাব শুরু হবে (যে মাস থেকে এখনো অপরিশোধিত)</Label>
                              <Input type="month" className="h-7 text-xs"
                                onChange={e => setEditUnitSettings(s => ({ ...s, rent_start_date: e.target.value ? `${e.target.value}-01` : undefined }))} />
                            </div>
                          </div>
                        )}
                        {editUnitSettings.has_rent && editUnitSettings.rent_start_date && (
                          <div className="bg-rose-50 dark:bg-rose-950/20 rounded-md p-2 text-[11px] text-rose-700 dark:text-rose-400">
                            মাসিক ভাড়া ৳{Number(editUnitSettings.rent_amount || 0).toLocaleString('bn-BD')} — {editUnitSettings.rent_start_date.slice(0, 7)} থেকে হিসাব শুরু।
                            ভাড়া বাড়াতে চাইলে ইউনিট প্রোফাইলের ভাড়া কার্ড থেকে করুন।
                          </div>
                        )}
                        {/* Custom modules */}
                        {(editUnitSettings.custom_modules || []).map((mod: string, idx: number) => (
                          <div key={idx} className="flex items-center justify-between bg-muted rounded-md p-2 hover:bg-accent/50 transition-colors">
                            <div className="flex items-center gap-2">
                              <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-xs font-medium">{mod}</span>
                            </div>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => {
                              setEditUnitSettings(s => ({ ...s, custom_modules: (s.custom_modules || []).filter((_: string, i: number) => i !== idx) }));
                            }}>
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        ))}
                        {/* Add new module */}
                        <div className="flex items-center gap-1.5 mt-1">
                          <Input
                            placeholder="নতুন মডিউল নাম..."
                            className="h-8 text-xs flex-1"
                            id={`new-module-${u.id}`}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                const input = e.currentTarget;
                                const val = input.value.trim();
                                if (val && !(editUnitSettings.custom_modules || []).includes(val)) {
                                  setEditUnitSettings(s => ({ ...s, custom_modules: [...(s.custom_modules || []), val] }));
                                  input.value = '';
                                }
                              }
                            }}
                          />
                          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => {
                            const input = document.getElementById(`new-module-${u.id}`) as HTMLInputElement;
                            const val = input?.value?.trim();
                            if (val && !(editUnitSettings.custom_modules || []).includes(val)) {
                              setEditUnitSettings(s => ({ ...s, custom_modules: [...(s.custom_modules || []), val] }));
                              if (input) input.value = '';
                            }
                          }}>
                            <Plus className="h-3 w-3 mr-0.5" /> যোগ
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Link to={`/admin/accounting/units/${u.id}`} className="flex items-center gap-2 hover:text-primary transition-colors">
                            <Building2 className="h-4 w-4" /> {u.name}
                          </Link>
                          <span className="text-xs text-muted-foreground font-normal">({unitPersons.length})</span>
                        </CardTitle>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {u.settings?.has_materials && (
                            <div className="flex items-center gap-1 bg-muted rounded px-1.5 py-0.5">
                              <Package className="h-3 w-3 text-primary" />
                              <span className="text-[10px] font-medium">ম্যাটেরিয়াল ক্রয়</span>
                            </div>
                          )}
                          {u.settings?.has_fixed_expenses && (
                            <div className="flex items-center gap-1 bg-muted rounded px-1.5 py-0.5">
                              <CreditCard className="h-3 w-3 text-primary" />
                              <span className="text-[10px] font-medium">{u.settings.fixed_expenses_label || 'নিয়মিত খরচ'}</span>
                            </div>
                          )}
                          {u.settings?.has_rent && (
                            <div className="flex items-center gap-1 bg-muted rounded px-1.5 py-0.5">
                              <Home className="h-3 w-3 text-primary" />
                              <span className="text-[10px] font-medium">ভাড়া ৳{Number(u.settings.rent_amount || 0).toLocaleString('bn-BD')}</span>
                            </div>
                          )}
                          {(u.settings?.custom_modules || []).map((mod: string) => (
                            <div key={mod} className="flex items-center gap-1 bg-muted rounded px-1.5 py-0.5">
                              <DollarSign className="h-3 w-3 text-muted-foreground" />
                              <span className="text-[10px] font-medium">{mod}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7">
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openPersonDialogForUnit(u.id)}>
                              <UserPlus className="h-3.5 w-3.5 mr-2" /> নতুন ব্যক্তি যোগ
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setAddModuleUnitId(u.id); setNewModuleName(''); }}>
                              <Layers className="h-3.5 w-3.5 mr-2" /> খরচ মডিউল যোগ
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Switch checked={u.is_active} onCheckedChange={() => handleToggleUnit(u.id, u.is_active)} />
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditUnitId(u.id); setEditUnitName(u.name); setEditUnitAllowedTypes(u.allowed_types || []); setEditUnitSettings(u.settings || {}); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </>
                  )}
                </CardHeader>
                <CardContent className="pt-0">
                  {unitPersons.length === 0 ? (
                    <div className="text-center py-3 text-muted-foreground text-xs">কোনো ব্যক্তি নেই</div>
                  ) : (
                    <div className="space-y-3">
                      {unitTypes.filter(t => personsByType[t]?.length > 0).map(t => (
                        <div key={t}>
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 px-3">{t}</div>
                          <div className="space-y-1">{personsByType[t].map(renderPersonRow)}</div>
                        </div>
                      ))}
                      {Object.entries(personsByType).filter(([t]) => !unitTypes.includes(t)).map(([t, ps]) => (
                        <div key={t}>
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 px-3">{t}</div>
                          <div className="space-y-1">{ps.map(renderPersonRow)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {/* Persons without unit */}
          {(personsByUnit['__none__'] || []).length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4" /> অন্যান্য (ইউনিট ছাড়া)
                  <span className="text-xs font-normal">({personsByUnit['__none__'].length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-1">{personsByUnit['__none__'].map(renderPersonRow)}</div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* New Unit Dialog */}
      <Dialog open={unitOpen} onOpenChange={setUnitOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>নতুন ইউনিট</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>ইউনিটের নাম</Label><Input value={unitName} onChange={e => setUnitName(e.target.value)} placeholder="যেমন: ফ্যাক্টরি" /></div>
            <p className="text-xs text-muted-foreground">ধরন (টাইপ) পরে ইউনিট প্রোফাইল থেকে যোগ করতে পারবেন।</p>
            <Button onClick={handleCreateUnit} disabled={createUnit.isPending} className="w-full">
              {createUnit.isPending ? 'তৈরি হচ্ছে...' : 'তৈরি করুন'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Person Dialog */}
      <Dialog open={personOpen} onOpenChange={setPersonOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>নতুন ব্যক্তি যোগ</DialogTitle></DialogHeader>
          <PersonFormFields f={personForm} setF={setPersonForm} allowedTypes={units.find(u => u.id === activePersonUnitId)?.allowed_types || []} allPersons={persons} />
          <Button onClick={handleCreatePerson} disabled={createPerson.isPending} className="w-full">
            {createPerson.isPending ? 'সেভ হচ্ছে...' : 'সেভ করুন'}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Edit Person Dialog */}
      <Dialog open={editPersonOpen} onOpenChange={setEditPersonOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>ব্যক্তি এডিট</DialogTitle></DialogHeader>
          <PersonFormFields f={editPersonForm} setF={setEditPersonForm} allowedTypes={allPersonTypes} />
          <Button onClick={handleUpdatePerson} disabled={updatePerson.isPending} className="w-full">
            {updatePerson.isPending ? 'আপডেট হচ্ছে...' : 'আপডেট করুন'}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Delete Person Confirm */}
      <AlertDialog open={!!deletePersonId} onOpenChange={open => !open && setDeletePersonId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ব্যক্তি মুছে ফেলবেন?</AlertDialogTitle>
            <AlertDialogDescription>এই ব্যক্তির সমস্ত তথ্য মুছে যাবে। এটি আর ফেরত পাওয়া যাবে না।</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>বাতিল</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePerson} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">মুছে ফেলুন</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Resign Person Confirm */}
      <AlertDialog open={!!resignPersonId} onOpenChange={open => !open && setResignPersonId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>বিদায়/রিজাইন চিহ্নিত করবেন?</AlertDialogTitle>
            <AlertDialogDescription>এই ব্যক্তি নিষ্ক্রিয় হিসেবে চিহ্নিত হবে এবং লাল ফ্ল্যাগ দেখাবে। হিস্ট্রি থেকে যাবে। পরে ডিলিট বা আবার সক্রিয় করা যাবে।</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>বাতিল</AlertDialogCancel>
            <AlertDialogAction onClick={handleResignPerson} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">বিদায় দিন</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Module Dialog */}
      <Dialog open={!!addModuleUnitId} onOpenChange={open => { if (!open) setAddModuleUnitId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>খরচ মডিউল যোগ করুন</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>মডিউলের নাম</Label><Input value={newModuleName} onChange={e => setNewModuleName(e.target.value)} placeholder="যেমন: পরিবহন খরচ" /></div>
            <Button className="w-full" disabled={!newModuleName.trim()} onClick={async () => {
              if (!addModuleUnitId || !newModuleName.trim()) return;
              const unit = units.find(u => u.id === addModuleUnitId);
              const currentModules: string[] = unit?.settings?.custom_modules || [];
              if (currentModules.includes(newModuleName.trim())) { toast.error('এই মডিউল আগে থেকেই আছে'); return; }
              try {
                await updateUnit.mutateAsync({ id: addModuleUnitId, settings: { ...(unit?.settings || {}), custom_modules: [...currentModules, newModuleName.trim()] } } as any);
                toast.success('মডিউল যোগ হয়েছে');
                setAddModuleUnitId(null);
                setNewModuleName('');
              } catch (e: any) { toast.error(e.message); }
            }}>যোগ করুন</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}