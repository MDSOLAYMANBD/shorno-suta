import { useState, useMemo } from 'react';
import { usePersons, useCreatePerson, useUpdatePerson, type AccPerson } from '@/hooks/usePersons';
import { useUnits } from '@/hooks/useAccounting';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Users, Phone, Pencil, ArrowLeft, Search } from 'lucide-react';
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';

const typeLabel: Record<string, string> = {
  employee: 'কর্মচারী (বেতন)', salaried_production: 'কর্মচারী (প্রোডাকশন)', production_staff: 'প্রোডাকশন স্টাফ', party: 'পার্টি', supplier: 'সাপ্লায়ার',
  sales_party: 'বিক্রি পার্টি', work_party: 'কাজ পার্টি', loan_kisti: 'ঋণ কিস্তি',
};

const emptyForm = { name: '', phone: '', type: 'employee', unit_id: '', joining_date: '', base_salary: '', salary_type: 'monthly',
  // loan-specific
  principal_amount: '', interest_rate: '', total_installments: '', monthly_installment: '', start_date: '', tracking_start_date: '',
};

export default function AdminPersons() {
  const navigate = useNavigate();
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [unitFilter, setUnitFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const { data: persons = [], isLoading } = usePersons({ type: typeFilter || undefined, unit_id: unitFilter || undefined });
  const { data: allPersons = [] } = usePersons(); // for duplicate check
  const { data: units = [] } = useUnits();
  const createPerson = useCreatePerson();
  const updatePerson = useUpdatePerson();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);

  // Filtered persons by search
  const filteredPersons = useMemo(() => {
    if (!searchQuery.trim()) return persons;
    const q = searchQuery.toLowerCase();
    return persons.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.phone && p.phone.includes(q)) ||
      (p.person_code && p.person_code.toLowerCase().includes(q))
    );
  }, [persons, searchQuery]);

  // Duplicate check warnings
  const duplicateWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (form.phone && form.phone.length >= 5) {
      const match = allPersons.find(p => p.phone === form.phone);
      if (match) {
        warnings.push(`⚠️ এই নম্বরে আগে '${match.name}' (${match.person_code || 'ID নেই'}) ${!match.is_active ? '— নিষ্ক্রিয়' : '— সক্রিয়'}`);
      }
    }
    if (form.name.trim().length >= 3) {
      const match = allPersons.find(p => p.name.toLowerCase() === form.name.trim().toLowerCase());
      if (match) {
        warnings.push(`⚠️ একই নামে '${match.name}' (${match.person_code || 'ID নেই'}) ${!match.is_active ? '— নিষ্ক্রিয়' : '— সক্রিয়'}`);
      }
    }
    return warnings;
  }, [form.name, form.phone, allPersons]);

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast.error('নাম দিন'); return; }
    if (form.type !== 'loan_kisti' && !form.phone.trim()) { toast.error('ফোন নম্বর দিন'); return; }
    try {
      const payload: any = {
        name: form.name, phone: form.phone || null, type: form.type,
        unit_id: form.unit_id || null, joining_date: form.joining_date || null,
        base_salary: Number(form.base_salary) || 0, salary_type: form.salary_type,
      };
      if (form.type === 'loan_kisti') {
        if (!Number(form.principal_amount)) { toast.error('মূলধন দিন'); return; }
        payload._loanPayload = {
          principal_amount: Number(form.principal_amount) || 0,
          interest_rate: Number(form.interest_rate) || 0,
          total_installments: Number(form.total_installments) || 0,
          monthly_installment: Number(form.monthly_installment) || 0,
          start_date: form.start_date || new Date().toISOString().slice(0, 10),
          tracking_start_date: form.tracking_start_date || form.start_date || new Date().toISOString().slice(0, 10),
        };
      }
      await createPerson.mutateAsync(payload);
      toast.success('ব্যক্তি যোগ হয়েছে');
      setOpen(false);
      setForm(emptyForm);
    } catch (e: any) { toast.error(e.message); }
  };

  const openEdit = (p: AccPerson) => {
    setEditId(p.id);
    setEditForm({
      name: p.name, phone: p.phone || '', type: p.type,
      unit_id: p.unit_id || '', joining_date: p.joining_date || '',
      base_salary: String(p.base_salary || ''), salary_type: p.salary_type,
      principal_amount: '', interest_rate: '', total_installments: '', monthly_installment: '', start_date: '', tracking_start_date: '',
    });
    setEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!editId || !editForm.name.trim()) { toast.error('নাম দিন'); return; }
    try {
      await updatePerson.mutateAsync({
        id: editId, name: editForm.name, phone: editForm.phone || null, type: editForm.type,
        unit_id: editForm.unit_id || null, joining_date: editForm.joining_date || null,
        base_salary: Number(editForm.base_salary) || 0, salary_type: editForm.salary_type,
      } as any);
      toast.success('আপডেট হয়েছে');
      setEditOpen(false);
    } catch (e: any) { toast.error(e.message); }
  };

  const PersonFormFields = ({ f, setF, warnings }: { f: typeof emptyForm; setF: React.Dispatch<React.SetStateAction<typeof emptyForm>>; warnings?: string[] }) => (
    <div className="space-y-3">
      <div><Label>নাম *</Label><Input value={f.name} onChange={e => setF(prev => ({ ...prev, name: e.target.value }))} /></div>
      <div><Label>ফোন {f.type !== 'loan_kisti' && '*'}</Label><Input value={f.phone} onChange={e => setF(prev => ({ ...prev, phone: e.target.value }))} /></div>
      {warnings && warnings.length > 0 && (
        <div className="space-y-1">
          {warnings.map((w, i) => (
            <div key={i} className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded px-2 py-1.5">{w}</div>
          ))}
        </div>
      )}
      <div>
        <Label>ধরন</Label>
        <Select value={f.type} onValueChange={v => setF(prev => ({ ...prev, type: v }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(typeLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div>
        <Label>ইউনিট</Label>
        <Select value={f.unit_id} onValueChange={v => setF(prev => ({ ...prev, unit_id: v }))}>
          <SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
          <SelectContent>{units.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div><Label>যোগদানের তারিখ</Label><Input type="date" value={f.joining_date} onChange={e => setF(prev => ({ ...prev, joining_date: e.target.value }))} /></div>
      {f.type === 'loan_kisti' ? (
        <div className="space-y-3 border border-purple-200 dark:border-purple-900/40 bg-purple-50/40 dark:bg-purple-950/20 rounded-lg p-3">
          <div className="text-xs font-semibold text-purple-700 dark:text-purple-300">💳 ঋণের তথ্য</div>
          <div><Label>মূলধন (৳) *</Label><Input type="number" value={f.principal_amount} onChange={e => setF(prev => ({ ...prev, principal_amount: e.target.value }))} placeholder="যেমন: 150000" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>সুদ %</Label><Input type="number" step="0.01" value={f.interest_rate} onChange={e => setF(prev => ({ ...prev, interest_rate: e.target.value }))} placeholder="0" /></div>
            <div><Label>মোট কিস্তি</Label><Input type="number" value={f.total_installments} onChange={e => setF(prev => ({ ...prev, total_installments: e.target.value }))} placeholder="24" /></div>
          </div>
          <div><Label>মাসিক কিস্তি (৳)</Label><Input type="number" value={f.monthly_installment} onChange={e => setF(prev => ({ ...prev, monthly_installment: e.target.value }))} placeholder="0" /></div>
          <div><Label>ঋণের আসল শুরুর তারিখ</Label><Input type="date" value={f.start_date} onChange={e => setF(prev => ({ ...prev, start_date: e.target.value }))} /></div>
          <div>
            <Label>আমাদের হিসাবে কিস্তি গণনা শুরু</Label>
            <Input type="date" value={f.tracking_start_date} onChange={e => setF(prev => ({ ...prev, tracking_start_date: e.target.value }))} />
            <p className="text-[10px] text-muted-foreground mt-1">ফাঁকা রাখলে আসল শুরুর তারিখই ব্যবহার হবে।</p>
          </div>
        </div>
      ) : (f.type === 'employee' || f.type === 'salaried_production') ? (
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
      ) : null}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/admin/accounting')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">ব্যক্তি তালিকা</h1>
            <p className="text-sm text-muted-foreground">মোট {persons.length} জন</p>
          </div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> নতুন ব্যক্তি</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>নতুন ব্যক্তি যোগ</DialogTitle></DialogHeader>
            <PersonFormFields f={form} setF={setForm} warnings={duplicateWarnings} />
            <Button onClick={handleSubmit} disabled={createPerson.isPending} className="w-full">
              {createPerson.isPending ? 'সেভ হচ্ছে...' : 'সেভ করুন'}
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search + Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="নাম, ফোন বা আইডি দিয়ে খুঁজুন..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <Select value={typeFilter || 'all'} onValueChange={v => setTypeFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="সব ধরন" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">সব ধরন</SelectItem>
            {Object.entries(typeLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={unitFilter || 'all'} onValueChange={v => setUnitFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="সব ইউনিট" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">সব ইউনিট</SelectItem>
            {units.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">লোড হচ্ছে...</div>
      ) : (
        <div className="grid gap-3">
          {filteredPersons.map((p: AccPerson) => (
            <div key={p.id} className="relative">
              <Link to={`/admin/accounting/persons/${p.id}`}>
                <Card className={`hover:bg-accent/50 transition-colors cursor-pointer ${!p.is_active ? 'opacity-60 border-destructive/30' : ''}`}>
                  <CardContent className="flex items-center justify-between p-4 pr-12">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${!p.is_active ? 'bg-destructive/10' : 'bg-primary/10'}`}>
                        <Users className={`h-5 w-5 ${!p.is_active ? 'text-destructive' : 'text-primary'}`} />
                      </div>
                      <div>
                        <div className="font-medium flex items-center gap-1.5">
                          {p.name}
                          {p.person_code && (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 font-mono">{p.person_code}</Badge>
                          )}
                          {!p.is_active && <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4">নিষ্ক্রিয়</Badge>}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-medium">{typeLabel[p.type]}</span>
                          {p.acc_units?.name && <span>{p.acc_units.name}</span>}
                          {p.phone && <span className="flex items-center gap-0.5"><Phone className="h-3 w-3" />{p.phone}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold">৳{(p.base_salary || 0).toLocaleString()}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {p.joining_date ? format(new Date(p.joining_date), 'dd MMM yyyy', { locale: bn }) : '—'}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <Button
                variant="ghost" size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEdit(p); }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {filteredPersons.length === 0 && <div className="text-center py-10 text-muted-foreground">কোনো ব্যক্তি নেই</div>}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>ব্যক্তি এডিট</DialogTitle></DialogHeader>
          <PersonFormFields f={editForm} setF={setEditForm} />
          <Button onClick={handleUpdate} disabled={updatePerson.isPending} className="w-full">
            {updatePerson.isPending ? 'আপডেট হচ্ছে...' : 'আপডেট করুন'}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
