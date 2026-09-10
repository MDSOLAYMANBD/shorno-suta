import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/supabaseHelpers';
import { backfillPaidOrderSaleEntries } from '@/lib/officeSellSaleEntry';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Banknote, Printer, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

// Same union as AdminAccounting's সিঙ্ক-checked "বিক্রি হিস্টোরি" tab: courier
// settlements + office sells (acc_transactions type='sale') + sales_party/work_party
// জমা deposits — every rupee that has ever counted as বিক্রি anywhere in the app.
function useSalesHistory() {
  return useQuery({
    queryKey: ['sales-history'],
    queryFn: async () => {
      const { data: cpData, error: cpErr } = await supabase.from('courier_payments')
        .select('invoice_number, date, receivable_amount, receive_method, cash_amount, bank_amount')
        .not('receive_method', 'is', null)
        .order('date', { ascending: false });
      if (cpErr) throw cpErr;

      const courierRows = (cpData || []).map((r: any) => ({
        source: 'courier' as const,
        date: r.date,
        invoice_number: r.invoice_number,
        receive_method: r.receive_method,
        receivable_amount: Number(r.receivable_amount),
        cash_amount: Number(r.cash_amount || 0),
        bank_amount: Number(r.bank_amount || 0),
      }));

      const saleTxs = await fetchAllRows<{ amount: number; description: string | null; created_at: string; created_by: string | null; source: string | null; reference_id: string | null }>(
        () => (supabase.from('acc_transactions' as any) as any)
          .select('amount, description, created_at, created_by, source, reference_id')
          .eq('type', 'sale')
          .order('created_at', { ascending: false })
      );

      const refIds = saleTxs.map(t => t.reference_id).filter(Boolean) as string[];
      let orderNumMap: Record<string, string> = {};
      if (refIds.length > 0) {
        const { data: ordersData } = await supabase.from('orders').select('id, order_number').in('id', refIds);
        (ordersData || []).forEach((o: any) => { orderNumMap[o.id] = o.order_number; });
      }

      const saleRows = saleTxs.map(tx => {
        const orderMatch = tx.description?.match(/#(SD-\d+)/);
        const orderNum = orderMatch ? `#${orderMatch[1]}` : (tx.reference_id && orderNumMap[tx.reference_id] ? `#${orderNumMap[tx.reference_id]}` : '');
        const invoiceLabel = tx.description || 'অফিস সেল';
        return {
          source: 'office' as const,
          date: tx.created_at,
          invoice_number: invoiceLabel,
          receive_method: tx.source === 'bank' ? 'Bank' : 'Office',
          receivable_amount: Number(tx.amount),
          cash_amount: tx.source === 'bank' ? 0 : Number(tx.amount),
          bank_amount: tx.source === 'bank' ? Number(tx.amount) : 0,
          order_number: orderNum,
        };
      });

      const { data: partyDeposits } = await (supabase.from('acc_transactions' as any) as any)
        .select('amount, description, created_at, source, acc_persons!inner(name, type)')
        .eq('type', 'deposit')
        .in('acc_persons.type', ['sales_party', 'work_party'])
        .order('created_at', { ascending: false });

      const partyRows = ((partyDeposits || []) as any[]).map((tx) => ({
        source: 'party' as const,
        date: tx.created_at,
        invoice_number: `জমা — ${tx.acc_persons?.name || ''}`,
        receive_method: tx.source === 'bank' ? 'Bank' : 'Cash',
        receivable_amount: Number(tx.amount),
        cash_amount: tx.source === 'bank' ? 0 : Number(tx.amount),
        bank_amount: tx.source === 'bank' ? Number(tx.amount) : 0,
      }));

      return [...courierRows, ...saleRows, ...partyRows].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    },
  });
}

export default function AdminSalesHistory() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: salesHistory = [], isLoading } = useSalesHistory();
  const [syncing, setSyncing] = useState(false);

  const totalReceivable = salesHistory.reduce((s, r) => s + Number(r.receivable_amount), 0);
  const totalCash = salesHistory.reduce((s, r) => s + Number(r.cash_amount || 0), 0);
  const totalBank = salesHistory.reduce((s, r) => s + Number(r.bank_amount || 0), 0);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await backfillPaidOrderSaleEntries();
      if (res.created > 0) {
        qc.invalidateQueries({ queryKey: ['sales-history'] });
        qc.invalidateQueries({ queryKey: ['acc-transactions'] });
        qc.invalidateQueries({ queryKey: ['acc-transactions-paginated'] });
        qc.invalidateQueries({ queryKey: ['acc-accounts'] });
        qc.invalidateQueries({ queryKey: ['acc-transaction-summary'] });
        qc.invalidateQueries({ queryKey: ['accounting-financials'] });
      }
      toast.success(res.created > 0 ? `${res.created} টি পেমেন্ট সিঙ্ক হয়েছে` : 'সব এন্ট্রি আপ-টু-ডেট আছে');
    } catch (e: any) {
      toast.error('সিঙ্ক ব্যর্থ: ' + (e?.message || 'Unknown'));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> পেছনে যান
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={syncing} onClick={handleSync}>
            <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? 'animate-spin' : ''}`} /> সিঙ্ক
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" /> প্রিন্ট
          </Button>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden shadow-lg border-t-4 border-teal-500 bg-gradient-to-br from-teal-500/10 to-transparent">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="h-10 w-10 rounded-full flex items-center justify-center text-white shadow-sm bg-teal-600">
            <Banknote className="h-5 w-5" />
          </div>
          <div>
            <div className="text-base font-bold text-teal-700 dark:text-teal-400">মোট বিক্রি</div>
            <div className="text-[11px] text-muted-foreground">কুরিয়ার থেকে প্রাপ্ত + অফিস সেল + পার্টি জমা — সব একসাথে</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-3">
          <div className="text-[10px] text-muted-foreground font-medium">মোট বিক্রি</div>
          <div className="text-lg font-bold text-teal-600">৳{totalReceivable.toLocaleString()}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-[10px] text-muted-foreground font-medium">ক্যাশ</div>
          <div className="text-lg font-bold">৳{totalCash.toLocaleString()}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-[10px] text-muted-foreground font-medium">ব্যাংক</div>
          <div className="text-lg font-bold">৳{totalBank.toLocaleString()}</div>
        </CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">তারিখ</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">ইনভয়েস</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">মেথড</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">প্রাপ্য</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">ক্যাশ</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">ব্যাংক</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading && (
                  <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">লোড হচ্ছে...</td></tr>
                )}
                {!isLoading && salesHistory.length === 0 && (
                  <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">কোনো ডেটা নেই</td></tr>
                )}
                {salesHistory.map((row: any, i: number) => (
                  <tr key={i} className="hover:bg-muted/30">
                    <td className="px-3 py-2 text-xs whitespace-nowrap">{format(new Date(row.date), 'dd/MM/yyyy')}</td>
                    <td className="px-3 py-2 text-xs">
                      {row.order_number && <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 mr-1">{row.order_number}</span>}
                      {row.invoice_number || '—'}
                    </td>
                    <td className="px-3 py-2 text-xs capitalize">{row.receive_method || '—'}</td>
                    <td className="px-3 py-2 text-xs text-right font-medium text-green-700 dark:text-green-400">৳{Number(row.receivable_amount).toLocaleString()}</td>
                    <td className="px-3 py-2 text-xs text-right">৳{Number(row.cash_amount || 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-xs text-right">৳{Number(row.bank_amount || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
