import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWorkOrders, useAllWorkOrderEntries, useCreateWorkOrder, useCreateWorkOrderEntry, useUpdateWorkOrder, useDeleteWorkOrderEntry, useDeleteWorkOrder, type WorkOrderEntry } from '@/hooks/useWorkOrders';
import { type AccPerson } from '@/hooks/usePersons';
import { useUnits } from '@/hooks/useAccounting';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Package, ChevronDown, ChevronUp, ChevronRight, CheckCircle, Trash2, TrendingUp, ClipboardList, CircleDollarSign, Pencil, CalendarDays, Banknote, ShoppingCart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toLocalDateStr } from '@/lib/utils';
import { format } from 'date-fns';

interface Props {
  unitId: string;
  persons: AccPerson[];
  // When embedded somewhere that already shows জমা/পাওনা/কাজের মূল্য from its own source
  // (e.g. a unit's internal work-party sheet), hide this component's own overlapping money
  // cards so the same figures aren't computed two different ways on one page — production
  // stats (পিস, মজুরি) stay, since this remains the only place those are tracked.
  showFinancials?: boolean;
  // The সম্পন্ন action also triggers the factory→supplier→office hand-off (creates/moves a
  // row into the সাপ্লায়ার unit), which only makes sense for a real external supply chain.
  // An internal work-party sheet has no such hand-off — piece counts logged under a worker's
  // name already are the record of what's done, so this UI is hidden there entirely.
  showCompletion?: boolean;
}

// Exported full content component for the full-page route
export function WorkOrderContent({ unitId, persons, showFinancials = true, showCompletion = true }: Props) {
  const { data: orders = [], isLoading } = useWorkOrders(unitId);
  const workOrderIds = useMemo(() => orders.map(o => o.id), [orders]);
  const { data: allEntries = [] } = useAllWorkOrderEntries(workOrderIds);
  const { data: units = [] } = useUnits();
  const createOrder = useCreateWorkOrder();
  const createEntry = useCreateWorkOrderEntry();
  const updateOrder = useUpdateWorkOrder();
  const deleteEntry = useDeleteWorkOrderEntry();
  const deleteOrder = useDeleteWorkOrder();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [orderDialog, setOrderDialog] = useState(false);
  const [editOrder, setEditOrder] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ order_number: '', product_name: '', total_quantity: '', pricing: '', wage: '' });
  const emptyRow = () => ({ person_id: '', quantity: '', rate: '', date: toLocalDateStr() });
  const [editEntryRows, setEditEntryRows] = useState<Array<{ person_id: string; quantity: string; rate: string; date: string }>>([emptyRow()]);

  const [orderForm, setOrderForm] = useState({ order_number: '', product_name: '', total_quantity: '', pricing: '', wage: '' });
  const [entryForm, setEntryForm] = useState({ person_id: '', quantity: '', rate: '', date: toLocalDateStr() });
  const productionStaff = persons.filter(p => (p.type === 'production_staff' || p.type === 'salaried_production') && p.is_active);
  const currentUnit = units.find(u => u.id === unitId);
  const isOffice = !!(currentUnit && (currentUnit.name === 'অফিস' || currentUnit.name.toLowerCase().includes('office')));
  const isSupplierUnit = !!(currentUnit && currentUnit.name.includes('সাপ্লায়ার'));
  const isPrintUnit = !!(currentUnit && (currentUnit.name.includes('প্রিন্ট') || currentUnit.name.toLowerCase().includes('print')));
  const workLabel = isOffice ? 'পণ্য কেনার শীট' : isPrintUnit ? 'প্রিন্টের কাজ' : 'কারখানার কাজ';

  const entriesByOrder = useMemo(() => {
    const map: Record<string, WorkOrderEntry[]> = {};
    allEntries.forEach(e => {
      if (!map[e.work_order_id]) map[e.work_order_id] = [];
      map[e.work_order_id].push(e);
    });
    return map;
  }, [allEntries]);

  const activeOrders = orders.filter(o => o.status === 'active');
  const completedOrders = orders.filter(o => o.status === 'completed');
  const allOrders = [...activeOrders, ...completedOrders];

  // Dashboard stats
  const totalValue = allOrders.reduce((s, o) => s + o.total_quantity * (o.pricing || 0), 0);
  const activeValue = activeOrders.reduce((s, o) => s + o.total_quantity * (o.pricing || 0), 0);
  const completedValue = completedOrders.reduce((s, o) => s + o.total_quantity * (o.pricing || 0), 0);
  const completedWage = completedOrders.reduce((s, o) => s + o.total_quantity * ((o as any).wage || 0), 0);
  const totalPcs = allOrders.reduce((s, o) => s + o.total_quantity, 0);
  const donePcs = allEntries.reduce((s, e) => s + e.quantity, 0);
  const totalWage = allEntries.reduce((s, e) => s + (e.quantity * e.rate), 0);
  const totalWageFromOrders = allOrders.reduce((s, o) => s + o.total_quantity * ((o as any).wage || 0), 0);

  // Aggregated unit IDs for supplier: include factory & print unit expenses
  const factoryUnit = units.find(u => u.name.includes('সেউইং') || u.name.includes('কারখানা'));
  const printUnit = units.find(u => u.name.includes('প্রিন্ট'));
  const aggregatedIds = isOffice
    ? units.filter(u => u.id !== unitId).map(u => u.id)
    : isSupplierUnit
      ? [unitId, factoryUnit?.id, printUnit?.id].filter(Boolean) as string[]
      : [unitId];

  // Fetch unit transactions for জমা/পাওনা
  const DEBIT_TYPES = ['salary', 'production_payment', 'party_payment', 'expense', 'advance', 'bonus'];
  const { data: unitTransactions = [] } = useQuery({
    queryKey: ['unit-work-order-transactions', unitId, aggregatedIds],
    queryFn: async () => {
      const { data } = await supabase
        .from('acc_transactions')
        .select('amount, type')
        .in('unit_id', aggregatedIds);
      return data || [];
    },
  });
  const totalPaid = unitTransactions
    .filter((t: any) => DEBIT_TYPES.includes(t.type))
    .reduce((s: number, t: any) => s + Number(t.amount), 0);
  const totalDue = isSupplierUnit
    ? totalWageFromOrders - totalPaid
    : (totalValue + totalWageFromOrders) - totalPaid;

  const handleCreateOrder = async () => {
    const qty = Number(orderForm.total_quantity);
    const price = Number(orderForm.pricing) || 0;
    const wage = Number(orderForm.wage) || 0;
    if (!isOffice && !orderForm.order_number.trim()) { toast.error('অর্ডার নম্বর দিন'); return; }
    if (!orderForm.product_name.trim()) { toast.error('পণ্যের নাম দিন'); return; }
    if (!qty || qty <= 0) { toast.error('পরিমাণ দিন'); return; }
    try {
      await createOrder.mutateAsync({
        unit_id: unitId,
        order_number: isOffice ? `P-${Date.now()}` : orderForm.order_number.trim(),
        product_name: orderForm.product_name.trim(),
        total_quantity: qty,
        pricing: price,
        wage,
      });
      toast.success('অর্ডার তৈরি হয়েছে');
      setOrderDialog(false);
      setOrderForm({ order_number: '', product_name: '', total_quantity: '', pricing: '', wage: '' });
    } catch (e: any) { toast.error(e.message); }
  };

  const handleOpenEdit = (order: any) => {
    setEditForm({
      order_number: order.order_number,
      product_name: order.product_name,
      total_quantity: String(order.total_quantity),
      pricing: String(order.pricing || 0),
      wage: String((order as any).wage || 0),
    });
    setEditOrder(order);
  };

  const handleSaveEdit = async () => {
    if (!editOrder) return;
    const qty = Number(editForm.total_quantity);
    const price = Number(editForm.pricing) || 0;
    const wage = Number(editForm.wage) || 0;
    if (!isOffice && !editForm.order_number.trim()) { toast.error('অর্ডার নম্বর দিন'); return; }
    if (!editForm.product_name.trim()) { toast.error('পণ্যের নাম দিন'); return; }
    if (!qty || qty <= 0) { toast.error('পরিমাণ দিন'); return; }
    try {
      await updateOrder.mutateAsync({
        id: editOrder.id,
        order_number: editForm.order_number.trim(),
        product_name: editForm.product_name.trim(),
        total_quantity: qty,
        pricing: price,
        wage,
      });
      toast.success('অর্ডার আপডেট হয়েছে');
      setEditOrder(null);
    } catch (e: any) { toast.error(e.message); }
  };

  const isSupplier = isOffice; // only office hides wage card

  // Sell to office handler
  const handleSellToOffice = async (order: any) => {
    try {
      const officeUnit = units.find(u => u.name === 'অফিস' && u.id !== unitId) || units.find(u => u.name.toLowerCase().includes('office') && u.id !== unitId);
      if (!officeUnit) { toast.error('অফিস ইউনিট পাওয়া যায়নি!'); return; }
      // Duplicate check
      const { data: existing } = await (supabase.from('acc_work_orders' as any) as any)
        .select('id').eq('unit_id', officeUnit.id).eq('order_number', order.order_number).limit(1);
      if (existing && existing.length > 0) { toast.error('এই অর্ডার ইতোমধ্যে অফিসে আছে!'); return; }
      // Insert to office
      const { error: insertErr } = await (supabase.from('acc_work_orders' as any) as any)
        .insert({ unit_id: officeUnit.id, order_number: order.order_number, product_name: order.product_name, total_quantity: order.total_quantity, pricing: order.pricing, status: 'active' });
      if (insertErr) throw insertErr;
      // Mark supplier order completed
      await updateOrder.mutateAsync({ id: order.id, status: 'completed' });
      toast.success('অফিসে বিক্রি সম্পন্ন!');
    } catch (e: any) { toast.error('বিক্রি করতে সমস্যা: ' + (e.message || e)); }
  };

  return (
    <>
      {/* Dashboard */}
      <div className="pb-3">
        {showFinancials && (
        <div className={`grid grid-cols-2 ${(isSupplier || isSupplierUnit) ? 'lg:grid-cols-2' : 'lg:grid-cols-5'} gap-3`}>
          {!isSupplierUnit && (
            <div className="rounded-lg border border-l-[3px] border-l-primary p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <CircleDollarSign className="h-3.5 w-3.5" /> {isOffice ? 'পণ্যের বিল' : 'কাজের মোট মূল্য'}
              </div>
              <div className="text-lg font-bold text-destructive">৳{totalValue.toLocaleString()}</div>
            </div>
          )}
          <div className="rounded-lg border border-l-[3px] border-l-red-500 p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <Banknote className="h-3.5 w-3.5" /> জমা
            </div>
            <div className="text-lg font-bold text-red-600">৳{totalPaid.toLocaleString()}</div>
          </div>
          <div className="rounded-lg border border-l-[3px] border-l-emerald-500 p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <CircleDollarSign className="h-3.5 w-3.5" /> পাওনা
            </div>
            <div className={`text-lg font-bold ${totalDue > 0 ? 'text-emerald-600' : 'text-red-600'}`}>৳{totalDue.toLocaleString()}</div>
          </div>
          {!isSupplier && (
            <div className="rounded-lg border border-l-[3px] border-l-purple-500 p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Banknote className="h-3.5 w-3.5" /> কাজের মজুরি
              </div>
              <div className="text-lg font-bold text-purple-600">৳{totalWageFromOrders.toLocaleString()}</div>
            </div>
          )}
        </div>
        )}
        <div className={`grid grid-cols-2 ${!showFinancials && !isSupplier ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-3 mt-3`}>
          <div className="rounded-lg border border-l-[3px] border-l-amber-500 p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <TrendingUp className="h-3.5 w-3.5" /> সক্রিয় অর্ডার
            </div>
            <div className="text-lg font-bold">{activeOrders.length}টি</div>
            <div className="text-[11px] text-muted-foreground">৳{activeValue.toLocaleString()}</div>
          </div>
          <div className="rounded-lg border border-l-[3px] border-l-emerald-500 p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <CheckCircle className="h-3.5 w-3.5" /> সম্পন্ন অর্ডার
            </div>
            <div className="text-lg font-bold">{completedOrders.length}টি</div>
            <div className="text-[11px] text-muted-foreground">৳{completedValue.toLocaleString()}</div>
            {completedWage > 0 && <div className="text-[11px] text-purple-600">মজুরি: ৳{completedWage.toLocaleString()}</div>}
          </div>
          {!showFinancials && !isSupplier && (
            <div className="rounded-lg border border-l-[3px] border-l-purple-500 p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Banknote className="h-3.5 w-3.5" /> কাজের মজুরি
              </div>
              <div className="text-lg font-bold text-purple-600">৳{totalWageFromOrders.toLocaleString()}</div>
            </div>
          )}
          <div className="rounded-lg border border-l-[3px] border-l-blue-500 p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <ClipboardList className="h-3.5 w-3.5" /> {isOffice ? 'কত পিস কিনেছি' : 'মোট পিস'}
            </div>
            <div className="text-lg font-bold">{isOffice ? totalPcs : (isSupplierUnit ? totalPcs : donePcs)}<span className="text-sm font-normal text-muted-foreground">{isOffice ? ' পিস' : (isSupplierUnit ? ' পিস' : `/${totalPcs}`)}</span></div>
          </div>
        </div>
      </div>

      {/* Add order button */}
      <div className="pb-2 flex justify-end">
        <Button size="sm" variant="outline" onClick={() => setOrderDialog(true)}>
          <Plus className="h-4 w-4 mr-1" /> {isOffice ? 'পণ্য কিনুন' : 'অর্ডার'}
        </Button>
      </div>

      {/* Orders table */}
      <div>
        {isLoading ? (
          <div className="text-center py-4 text-sm text-muted-foreground">লোড হচ্ছে...</div>
        ) : allOrders.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">{isOffice ? 'কোনো পণ্য কেনা হয়নি' : `কোনো ${workLabel} নেই`}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead className="w-[80px]">তারিখ</TableHead>
                <TableHead className="w-[70px]">আইডি</TableHead>
                <TableHead>পণ্যের নাম</TableHead>
                <TableHead className="w-[70px] text-right">পরিমাণ</TableHead>
                <TableHead className="w-[70px] text-right">কাজের মূল্য</TableHead>
                <TableHead className="w-[90px] text-right">কাজের মোট মূল্য</TableHead>
                <TableHead className="w-[70px] text-right">মজুরি</TableHead>
                <TableHead className="w-[90px] text-right">মজুরি মোট</TableHead>
                {!isSupplierUnit && <TableHead className="w-[70px] text-right">অগ্রগতি</TableHead>}
                <TableHead className="w-[40px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allOrders.map((order, idx) => {
                const entries = entriesByOrder[order.id] || [];
                const done = entries.reduce((s, e) => s + e.quantity, 0);
                const amount = order.total_quantity * (order.pricing || 0);
                const isOpen = expandedId === order.id;
                const isCompleted = order.status === 'completed';

                return (
                  <TableRowBlock
                    key={order.id}
                    order={order}
                    entries={entries}
                    done={done}
                    amount={amount}
                    isOpen={isOpen}
                    isCompleted={isCompleted}
                    idx={idx}
                    onToggle={() => setExpandedId(isOpen ? null : order.id)}
                    entryForm={isOpen ? entryForm : undefined}
                    onEntryFormChange={(f) => setEntryForm(f)}
                    onSaveEntry={async () => {
                      const qty = Number(entryForm.quantity);
                      const rate = Number(entryForm.rate);
                      if (!entryForm.person_id) { toast.error('ব্যক্তি সিলেক্ট করুন'); return; }
                      if (!qty || qty <= 0) { toast.error('পরিমাণ দিন'); return; }
                      try {
                        await createEntry.mutateAsync({
                          work_order_id: order.id,
                          person_id: entryForm.person_id,
                          quantity: qty,
                          rate,
                          date: entryForm.date,
                          product_name: order.product_name,
                          order_number: order.order_number,
                          order_total_quantity: order.total_quantity,
                        });
                        toast.success('কাজ উঠানো হয়েছে');
                        setEntryForm({ person_id: '', quantity: '', rate: '', date: toLocalDateStr() });
                      } catch (e: any) { toast.error(e.message); }
                    }}
                    isSaving={createEntry.isPending}
                    persons={productionStaff}
                    isSupplier={isSupplierUnit}
                    isOffice={isOffice}
                    isPrint={isPrintUnit}
                    showCompletion={showCompletion}
                    onSellToOffice={() => handleSellToOffice(order)}
                    onComplete={async () => {
                      try {
                        // 1. Find supplier unit by name
                        const supplierUnit = units.find(u => u.name === 'সাপ্লায়ার' && u.id !== unitId) || units.find(u => u.name.toLowerCase().includes('সাপ্লায়ার') && u.id !== unitId);
                        if (!supplierUnit) {
                          toast.error('সাপ্লায়ার ইউনিট পাওয়া যায়নি!');
                          return;
                        }
                        // 2. Check if entry already exists in supplier unit
                        const { data: inSupplier } = await (supabase.from('acc_work_orders' as any) as any)
                          .select('id')
                          .eq('unit_id', supplierUnit.id)
                          .eq('order_number', order.order_number)
                          .limit(1);
                        if (inSupplier && inSupplier.length > 0) {
                          // Already exists in supplier — skip
                        } else {
                          // Check if it went to wrong unit (not current, not supplier)
                          const { data: wrongEntry } = await (supabase.from('acc_work_orders' as any) as any)
                            .select('id')
                            .eq('order_number', order.order_number)
                            .neq('unit_id', unitId)
                            .neq('unit_id', supplierUnit.id)
                            .limit(1);
                          if (wrongEntry && wrongEntry.length > 0) {
                            // Move it to supplier unit
                            const { error: moveErr } = await (supabase.from('acc_work_orders' as any) as any)
                              .update({ unit_id: supplierUnit.id })
                              .eq('id', wrongEntry[0].id);
                            if (moveErr) throw moveErr;
                          } else {
                            // Create new in supplier unit
                            const { error: insertErr } = await (supabase.from('acc_work_orders' as any) as any)
                              .insert({
                                unit_id: supplierUnit.id,
                                order_number: order.order_number,
                                product_name: order.product_name,
                                total_quantity: order.total_quantity,
                                pricing: 0,
                                status: 'active',
                              });
                            if (insertErr) throw insertErr;
                          }
                        }
                        // 3. Now mark original order as completed
                        await updateOrder.mutateAsync({ id: order.id, status: 'completed' });
                        toast.success('অর্ডার সম্পন্ন! সাপ্লায়ার ইউনিটে এন্ট্রি হয়েছে।');
                      } catch (e: any) {
                        toast.error('সম্পন্ন করতে সমস্যা: ' + (e.message || e));
                      }
                    }}
                    onDeleteEntry={async (id) => {
                      await deleteEntry.mutateAsync(id);
                      toast.success('মুছে ফেলা হয়েছে');
                    }}
                    onEdit={() => handleOpenEdit(order)}
                    onDelete={async () => {
                      if (!confirm('এই অর্ডার ও এর সকল এন্ট্রি মুছে ফেলতে চান?')) return;
                      try {
                        await deleteOrder.mutateAsync(order.id);
                        toast.success('অর্ডার মুছে ফেলা হয়েছে');
                      } catch (e: any) { toast.error(e.message); }
                    }}
                  />
                );
              })}
              {/* Total row */}
              <TableRow className="bg-muted/50 font-bold text-xs">
                <TableCell colSpan={3} className="text-right">মোট</TableCell>
                <TableCell className="text-right">{totalPcs}</TableCell>
                <TableCell className="text-right">—</TableCell>
                <TableCell className="text-right text-destructive">৳{totalValue.toLocaleString()}</TableCell>
                <TableCell className="text-right">—</TableCell>
                <TableCell className="text-right text-purple-600">৳{totalWageFromOrders.toLocaleString()}</TableCell>
                {!isSupplierUnit && <TableCell>—</TableCell>}
                <TableCell></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </div>

      {/* New Order Dialog */}
      <Dialog open={orderDialog} onOpenChange={setOrderDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{isOffice ? 'পণ্য কিনুন' : `নতুন ${workLabel}`}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {!isOffice && <div>
              <Label>অর্ডার নম্বর (আইডি)</Label>
              <Input value={orderForm.order_number} onChange={e => setOrderForm(f => ({ ...f, order_number: e.target.value }))} placeholder="যেমন: 105" />
            </div>}
            <div>
              <Label>পণ্যের নাম</Label>
              <Input value={orderForm.product_name} onChange={e => setOrderForm(f => ({ ...f, product_name: e.target.value }))} placeholder="যেমন: dress" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>মোট পরিমাণ (পিস)</Label>
                <Input type="number" value={orderForm.total_quantity} onChange={e => setOrderForm(f => ({ ...f, total_quantity: e.target.value }))} placeholder="100" />
              </div>
              <div>
                <Label>কাজের মূল্য (প্রতি পিস)</Label>
                <Input type="number" value={orderForm.pricing} onChange={e => setOrderForm(f => ({ ...f, pricing: e.target.value }))} placeholder="0" />
              </div>
              <div>
                <Label>মজুরি (প্রতি পিস)</Label>
                <Input type="number" value={orderForm.wage} onChange={e => setOrderForm(f => ({ ...f, wage: e.target.value }))} placeholder="0" />
              </div>
            </div>
            {orderForm.total_quantity && orderForm.pricing && (
              <div className="text-sm text-muted-foreground text-right">
                মোট: <span className="font-bold text-foreground">৳{(Number(orderForm.total_quantity) * Number(orderForm.pricing)).toLocaleString()}</span>
              </div>
            )}
            <Button onClick={handleCreateOrder} disabled={createOrder.isPending} className="w-full">
              {createOrder.isPending ? 'সেভ হচ্ছে...' : 'তৈরি করুন'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Order Dialog */}
      <Dialog open={!!editOrder} onOpenChange={(open) => { if (!open) { setEditOrder(null); setEditEntryRows([emptyRow()]); } }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>অর্ডার এডিট করুন</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {!isOffice && <div>
              <Label>অর্ডার নম্বর (আইডি)</Label>
              <Input value={editForm.order_number} onChange={e => setEditForm(f => ({ ...f, order_number: e.target.value }))} />
            </div>}
            <div>
              <Label>পণ্যের নাম</Label>
              <Input value={editForm.product_name} onChange={e => setEditForm(f => ({ ...f, product_name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>মোট পরিমাণ (পিস)</Label>
                <Input type="number" value={editForm.total_quantity} onChange={e => setEditForm(f => ({ ...f, total_quantity: e.target.value }))} />
              </div>
              <div>
                <Label>কাজের মূল্য (প্রতি পিস)</Label>
                <Input type="number" value={editForm.pricing} onChange={e => setEditForm(f => ({ ...f, pricing: e.target.value }))} />
              </div>
              <div>
                <Label>মজুরি (প্রতি পিস)</Label>
                <Input type="number" value={editForm.wage} onChange={e => setEditForm(f => ({ ...f, wage: e.target.value }))} />
              </div>
            </div>
            {editForm.total_quantity && editForm.pricing && (
              <div className="text-sm text-muted-foreground text-right">
                মোট: <span className="font-bold text-foreground">৳{(Number(editForm.total_quantity) * Number(editForm.pricing)).toLocaleString()}</span>
              </div>
            )}
            <Button onClick={handleSaveEdit} disabled={updateOrder.isPending} className="w-full">
              {updateOrder.isPending ? 'সেভ হচ্ছে...' : 'আপডেট করুন'}
            </Button>
          </div>

          {/* কাজ উঠান section — only show if production staff exists */}
          {editOrder && productionStaff.length > 0 && (
            <div className="border-t pt-4 mt-2 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold flex items-center gap-1.5">
                  <ClipboardList className="h-4 w-4" /> কাজ উঠান
                </h4>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditEntryRows(prev => [...prev, emptyRow()])}>
                  <Plus className="h-3 w-3 mr-1" /> আরো যোগ
                </Button>
              </div>

              {/* Multi-row entry form */}
              <div className="space-y-1.5">
                {editEntryRows.map((row, i) => (
                  <div key={i} className="grid grid-cols-[1fr_80px_80px_36px_auto] gap-1.5 items-center">
                    <Select value={row.person_id} onValueChange={v => setEditEntryRows(prev => prev.map((r, j) => j === i ? { ...r, person_id: v } : r))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="ব্যক্তি" /></SelectTrigger>
                      <SelectContent>
                        {productionStaff.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input type="number" className="h-8 text-xs px-2" placeholder="পিস সংখ্যা" value={row.quantity} onChange={e => setEditEntryRows(prev => prev.map((r, j) => j === i ? { ...r, quantity: e.target.value } : r))} />
                    <Input type="number" className="h-8 text-xs px-2" placeholder="৳ মজুরি" value={row.rate} onChange={e => setEditEntryRows(prev => prev.map((r, j) => j === i ? { ...r, rate: e.target.value } : r))} />
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="icon" className="h-8 w-8" title={row.date}>
                          <CalendarDays className="h-3.5 w-3.5" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="end">
                        <Calendar
                          mode="single"
                          selected={row.date ? new Date(row.date + 'T00:00:00') : undefined}
                          onSelect={(d) => {
                            if (d) {
                              const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                              setEditEntryRows(prev => prev.map((r, j) => j === i ? { ...r, date: ds } : r));
                            }
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                    {editEntryRows.length > 1 ? (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setEditEntryRows(prev => prev.filter((_, j) => j !== i))}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    ) : <div className="w-8" />}
                  </div>
                ))}
              </div>

              {/* Live pending subtotal — always visible above save button */}
              {(() => {
                const valid = editEntryRows.filter(r => r.person_id && Number(r.quantity) > 0);
                const pCount = valid.length;
                const pQty = valid.reduce((s, r) => s + Number(r.quantity), 0);
                const pWage = valid.reduce((s, r) => s + Number(r.quantity) * (Number(r.rate) || 0), 0);
                if (pCount === 0) return null;
                return (
                  <div className="sticky bottom-0 -mx-1 px-3 py-2 rounded-md bg-amber-50 border border-amber-300 text-xs font-medium text-amber-900 flex items-center justify-between gap-2 flex-wrap z-10">
                    <span>✏️ এখন যোগ হচ্ছে:</span>
                    <span className="flex gap-2 flex-wrap">
                      <span className="bg-white/70 px-1.5 py-0.5 rounded">{pCount} জন</span>
                      <span className="bg-white/70 px-1.5 py-0.5 rounded">{pQty} পিস</span>
                      <span className="bg-white/70 px-1.5 py-0.5 rounded">৳{pWage.toLocaleString()} মজুরি</span>
                    </span>
                  </div>
                );
              })()}

              <Button size="sm" className="w-full h-8 text-xs" disabled={createEntry.isPending} onClick={async () => {
                const validRows = editEntryRows.filter(r => r.person_id && Number(r.quantity) > 0);
                if (validRows.length === 0) { toast.error('অন্তত একজন ব্যক্তি ও পরিমাণ দিন'); return; }
                try {
                  for (const row of validRows) {
                    await createEntry.mutateAsync({
                      work_order_id: editOrder.id,
                      person_id: row.person_id,
                      quantity: Number(row.quantity),
                      rate: Number(row.rate) || 0,
                      date: row.date,
                      product_name: editOrder.product_name,
                      order_number: editOrder.order_number,
                      order_total_quantity: editOrder.total_quantity,
                    });
                  }
                  toast.success(`${validRows.length}টি এন্ট্রি সেভ হয়েছে`);
                  setEditEntryRows([emptyRow()]);
                } catch (e: any) { toast.error(e.message); }
              }}>
                {createEntry.isPending ? 'সেভ হচ্ছে...' : 'সেভ করুন'}
              </Button>

              {/* Existing entries list + always-visible projected summary */}
              {(() => {
                const orderEntries = entriesByOrder[editOrder.id] || [];
                const savedQty = orderEntries.reduce((s, e) => s + e.quantity, 0);
                const savedWage = orderEntries.reduce((s, e) => s + (e.quantity * (e.rate || 0)), 0);
                const valid = editEntryRows.filter(r => r.person_id && Number(r.quantity) > 0);
                const pendingQty = valid.reduce((s, r) => s + Number(r.quantity), 0);
                const pendingWage = valid.reduce((s, r) => s + Number(r.quantity) * (Number(r.rate) || 0), 0);
                const projectedQty = savedQty + pendingQty;
                const projectedWage = savedWage + pendingWage;
                const orderQty = editOrder.total_quantity || 0;
                const remaining = orderQty - projectedQty;
                const over = remaining < 0;
                const done = remaining === 0;
                const boxClass = over
                  ? 'bg-red-50 border-red-300'
                  : done
                  ? 'bg-green-50 border-green-300'
                  : 'bg-emerald-50 border-emerald-200';
                const textClass = over ? 'text-red-800' : done ? 'text-green-800' : 'text-emerald-800';
                return (
                  <div className="space-y-1.5">
                    {orderEntries.length > 0 && (
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {orderEntries.map((e) => {
                          const entryDate = (() => { try { return format(new Date(e.date), 'dd/MM'); } catch { return '—'; } })();
                          return (
                            <div key={e.id} className="flex items-center justify-between text-xs px-2 py-1.5 rounded hover:bg-muted/50 group border">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold">{e.acc_persons?.name || '—'}</span>
                                <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium">{e.quantity} পিস</span>
                                <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-medium">৳{e.rate || 0}/পিস</span>
                                <span className="bg-green-50 text-green-700 px-1.5 py-0.5 rounded font-medium">= ৳{(e.quantity * (e.rate || 0)).toLocaleString()}</span>
                                <span className="text-muted-foreground">{entryDate}</span>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                                onClick={async () => { await deleteEntry.mutateAsync(e.id); toast.success('মুছে ফেলা হয়েছে'); }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {/* Always-visible summary box with +/- projection */}
                    <div className={`space-y-1.5 px-3 py-2.5 rounded-md border ${boxClass}`}>
                      <div className={`flex items-center justify-between text-xs font-semibold ${textClass} flex-wrap gap-1`}>
                        <span>📦 অর্ডার: <span className="text-sm">{orderQty}</span> পিস</span>
                        <span>✅ উঠেছে: <span className="text-sm">{savedQty}</span>
                          {pendingQty > 0 && <span className="text-amber-700"> +{pendingQty}</span>}
                        </span>
                        <span>🎯 প্রজেক্টেড: <span className="text-sm">{projectedQty}</span></span>
                        <span>
                          {over ? '⚠️ ছাড়িয়ে গেছে: ' : '⏳ বাকি: '}
                          <span className={`text-sm ${over ? 'text-red-700' : ''}`}>{over ? Math.abs(remaining) : remaining}</span> পিস
                        </span>
                      </div>
                      <div className={`text-xs font-bold ${textClass} text-center border-t pt-1.5 flex items-center justify-center gap-2 flex-wrap`}
                        style={{ borderColor: 'currentColor', borderTopWidth: 1, opacity: 1 }}>
                        <span>💰 সেভড: ৳{savedWage.toLocaleString()}</span>
                        {pendingWage > 0 && <span className="text-amber-700">+ ৳{pendingWage.toLocaleString()}</span>}
                        <span>= 🎯 মোট: ৳{projectedWage.toLocaleString()}</span>
                      </div>
                      {orderEntries.length === 0 && pendingQty === 0 && (
                        <p className="text-[11px] text-muted-foreground text-center">এখনো কাজ উঠানো হয়নি</p>
                      )}
                    </div>
                  </div>
                );
              })()}

            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// Default export: Summary card that navigates to full page
export default function WorkOrderSection({ unitId, persons }: Props) {
  const navigate = useNavigate();
  const { data: orders = [] } = useWorkOrders(unitId);
  const { data: units = [] } = useUnits();
  const activeOrders = orders.filter(o => o.status === 'active');
  const totalValue = orders.reduce((s, o) => s + o.total_quantity * (o.pricing || 0), 0);
  const currentUnit = units.find(u => u.id === unitId);
  const isOfficeSummary = !!(currentUnit && (currentUnit.name === 'অফিস' || currentUnit.name.toLowerCase().includes('office')));

  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/admin/accounting/units/${unitId}/work-orders`)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-1.5">
            <Package className="h-4 w-4" />
            {isOfficeSummary ? `পণ্য কেনার শীট (${activeOrders.length})` : `${(() => { const n = (currentUnit?.name || ''); return n.includes('প্রিন্ট') || n.toLowerCase().includes('print') ? 'প্রিন্টের কাজ' : 'কারখানার কাজ'; })()} (${activeOrders.length})`}
          </CardTitle>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">সক্রিয় {activeOrders.length}টি</span>
          <span className="font-bold text-destructive">৳{totalValue.toLocaleString()}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// Sub-component for expandable table row
function TableRowBlock({ order, entries, done, amount, isOpen, isCompleted, idx, onToggle, entryForm, onEntryFormChange, onSaveEntry, isSaving, persons, isSupplier, isOffice, isPrint, showCompletion = true, onSellToOffice, onComplete, onDeleteEntry, onEdit, onDelete }: {
  order: any;
  entries: WorkOrderEntry[];
  done: number;
  amount: number;
  isOpen: boolean;
  isCompleted: boolean;
  idx: number;
  onToggle: () => void;
  entryForm?: { person_id: string; quantity: string; rate: string; date: string };
  onEntryFormChange: (f: { person_id: string; quantity: string; rate: string; date: string }) => void;
  onSaveEntry: () => void;
  isSaving: boolean;
  persons: AccPerson[];
  isSupplier?: boolean;
  isOffice?: boolean;
  isPrint?: boolean;
  showCompletion?: boolean;
  onSellToOffice?: () => void;
  onComplete: () => void;
  onDeleteEntry: (id: string) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const dateStr = (() => {
    try { return format(new Date(order.created_at), 'dd/MM'); } catch { return '—'; }
  })();

  return (
    <>
      <TableRow
        className={`cursor-pointer text-xs ${isCompleted ? 'opacity-60' : ''} ${idx % 2 === 0 ? 'bg-muted/30' : ''}`}
        onClick={onToggle}
      >
        <TableCell className="py-2">{dateStr}</TableCell>
        <TableCell className="py-2 font-medium">#{order.order_number}</TableCell>
        <TableCell className="py-2">
          {order.product_name}
          {showCompletion && isCompleted && <Badge variant="secondary" className="ml-1.5 text-[9px] px-1">সম্পন্ন</Badge>}
        </TableCell>
        <TableCell className="py-2 text-right">{order.total_quantity}</TableCell>
        <TableCell className="py-2 text-right">{order.pricing || 0}</TableCell>
        <TableCell className="py-2 text-right font-medium">৳{amount.toLocaleString()}</TableCell>
        <TableCell className="py-2 text-right">{order.wage || 0}</TableCell>
        <TableCell className="py-2 text-right font-medium">৳{(order.total_quantity * (order.wage || 0)).toLocaleString()}</TableCell>
        {!isSupplier && (
          <TableCell className="py-2 text-right">
            <span className={done >= order.total_quantity ? 'text-primary font-bold' : 'text-muted-foreground'}>
              {done}/{order.total_quantity}
            </span>
          </TableCell>
        )}
        <TableCell className="py-2 text-right">
          <div className="flex items-center justify-end gap-0.5">
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
              <Pencil className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
              <Trash2 className="h-3 w-3" />
            </Button>
            {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </div>
        </TableCell>
      </TableRow>

      {isOpen && (
        <TableRow className="bg-muted/10">
          <TableCell colSpan={isSupplier ? 9 : 10} className="py-2 px-4">
            <div className="space-y-1.5">
              {entries.length === 0 ? (
                <p className="text-xs text-muted-foreground">এখনো কাজ উঠানো হয়নি</p>
              ) : (
                <div className="space-y-1">
                  {entries.map((e) => {
                    const entryDate = (() => { try { return format(new Date(e.date), 'dd/MM'); } catch { return '—'; } })();
                    return (
                      <div key={e.id} className="flex items-center justify-between text-xs px-2 py-1 rounded hover:bg-muted/50 group border">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{e.acc_persons?.name || '—'}</span>
                          <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium">{e.quantity} পিস</span>
                          <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-medium">৳{e.rate || 0}/পিস</span>
                          <span className="bg-green-50 text-green-700 px-1.5 py-0.5 rounded font-medium">= ৳{(e.quantity * (e.rate || 0)).toLocaleString()}</span>
                          <span className="text-muted-foreground">{entryDate}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                          onClick={(ev) => { ev.stopPropagation(); onDeleteEntry(e.id); }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
              {/* Inline entry form — only show if persons exist (not supplier unit) */}
              {entryForm && persons.length > 0 && (
                <div className="grid grid-cols-[1fr_70px_70px_100px_auto] gap-2 items-center pt-2 border-t border-border mt-2" onClick={e => e.stopPropagation()}>
                  <Select value={entryForm.person_id} onValueChange={v => onEntryFormChange({ ...entryForm, person_id: v })}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="ব্যক্তি" /></SelectTrigger>
                    <SelectContent>
                      {persons.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input type="number" className="h-7 text-xs" placeholder="পরিমাণ" value={entryForm.quantity} onChange={e => onEntryFormChange({ ...entryForm, quantity: e.target.value })} />
                  <Input type="number" className="h-7 text-xs" placeholder="মজুরি" value={entryForm.rate} onChange={e => onEntryFormChange({ ...entryForm, rate: e.target.value })} />
                  <Input type="date" className="h-7 text-xs" value={entryForm.date} onChange={e => onEntryFormChange({ ...entryForm, date: e.target.value })} />
                  <Button size="sm" className="h-7 text-xs px-2" disabled={isSaving} onClick={onSaveEntry}>
                    {isSaving ? '...' : 'সেভ'}
                  </Button>
                </div>
              )}
              {showCompletion && !isCompleted && (persons.length > 0 || isPrint) && (
                <div className="pt-1.5">
                  <Button size="sm" variant="ghost" className="h-6 text-[11px] text-primary" onClick={(e) => { e.stopPropagation(); onComplete(); }}>
                    <CheckCircle className="h-3 w-3 mr-0.5" /> সম্পন্ন
                  </Button>
                </div>
              )}
              {isSupplier && !isCompleted && onSellToOffice && (
                <div className="pt-1.5">
                  <Button size="sm" variant="default" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); onSellToOffice(); }}>
                    <ShoppingCart className="h-3 w-3 mr-1" /> বিক্রি
                  </Button>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
