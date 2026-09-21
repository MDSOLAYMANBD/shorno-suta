import { useState, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, ExternalLink, Truck, Plus, Receipt, ChevronDown, Phone, Landmark, Banknote, XCircle, Printer, X } from 'lucide-react';
import { useSiteConfig, DEFAULT_INVOICE_CONFIG, DEFAULT_NAVBAR_CONFIG } from '@/hooks/useSiteConfig';
import { useCourierRateMatrix } from '@/hooks/useCourierRateMatrix';
import { rateFor, areaKey } from '@/lib/courierFinance';
import { format, parse, isValid } from 'date-fns';

const PASTE_DATE_FORMATS = [
  'dd/MM/yyyy', 'dd-MM-yyyy', 'dd.MM.yyyy',
  'MM/dd/yyyy', 'yyyy-MM-dd', 'dd/MM/yy', 'dd-MM-yy',
  'MMM dd, yyyy', 'MMMM dd, yyyy', 'dd MMM yyyy', 'dd MMMM yyyy',
];

const smartParseDate = (text: string): string | null => {
  const trimmed = text.trim();
  for (const fmt of PASTE_DATE_FORMATS) {
    const d = parse(trimmed, fmt, new Date());
    if (isValid(d) && d.getFullYear() > 2000) return format(d, 'yyyy-MM-dd');
  }
  const fallback = new Date(trimmed);
  if (isValid(fallback) && fallback.getFullYear() > 2000) return format(fallback, 'yyyy-MM-dd');
  return null;
};
import { toast } from 'sonner';


function formatBDT(n: number) {
  return '৳' + n.toLocaleString('bn-BD');
}

async function invokeStfn(action: string, body: any = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/steadfast-courier?action=${action}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText);
  }
  return res.json();
}

// ==================== Payment Invoice Dialog (Steadfast portal style) ====================
function PaymentInvoiceDialog({ detailPayment, detailData, detailLoading, onClose }: {
  detailPayment: any; detailData: any; detailLoading: boolean; onClose: () => void;
}) {
  const { data: savedInvoice } = useSiteConfig('invoice_config');
  const { data: navbarConfig } = useSiteConfig('navbar_config');
  const { matrix: rateMatrix } = useCourierRateMatrix();
  const inv = { ...DEFAULT_INVOICE_CONFIG, ...savedInvoice };
  const navbar = { ...DEFAULT_NAVBAR_CONFIG, ...navbarConfig };

  // Steadfast এর JSON API per-parcel bill দেয় না, তাই Steadfast এর official
  // published fee schedule হার্ডকোড করা হয়েছে (area-wise)।
  // - delivered/exchange: full delivery charge (area-based)
  // - cancelled/failed/partial: return charge (area-based)
  //   inside=50, suburb=70, outside=90
  const STEADFAST_BILL = {
    delivered: { dhaka_inside: 60, dhaka_suburb: 80, dhaka_outside: 110 },
    return:    { dhaka_inside: 50, dhaka_suburb: 70, dhaka_outside: 90 },
  } as const;

  // Future-proof: যদি Steadfast কখনো API তে per-row bill যোগ করে, আগে সেটাই নেব।
  const readParcelBill = (c: any): number | null => {
    const candidates = [
      c?.delivery_charge, c?.delivery_bill, c?.bill, c?.bills,
      c?.charge, c?.courier_charge, c?.shipping_charge,
      c?.payable_charge, c?.payable_amount,
    ];
    for (const v of candidates) {
      if (v !== undefined && v !== null && v !== '' && !isNaN(Number(v))) {
        return Number(v);
      }
    }
    return null;
  };

  const computeParcelBill = (status: string, deliveryArea: string | null): number => {
    const s = (status || '').toLowerCase();
    const area = areaKey(deliveryArea);
    if (s.includes('deliver') && !s.includes('partial')) return STEADFAST_BILL.delivered[area];
    // partial / cancelled / unknown / pickup_failed / pickup_cancelled / return → return fee
    return STEADFAST_BILL.return[area];
  };

  // Steadfast response shape: { payment: { ...summary, consignments: [...] } }
  // Edge function spreads root, so payment lives at detailData.payment.
  const apiPayment: any = detailData?.payment || detailData || {};
  const consignments: any[] = (
    (Array.isArray(detailData?.consignments) && detailData.consignments.length ? detailData.consignments : null)
    || apiPayment?.consignments
    || detailData?.data?.consignments
    || (Array.isArray(detailData) ? detailData : null)
    || []
  );

  // Merge DB payment row with live API payment (API values win when present).
  const sum = {
    invoice_number: detailPayment?.invoice_number || apiPayment.payment_id,
    date: detailPayment?.date || apiPayment.created_at,
    collected_amount: Number(apiPayment.amount ?? detailPayment?.collected_amount ?? 0),
    delivery_bill: Number(apiPayment.due_bills ?? detailPayment?.delivery_bill ?? 0),
    sub_total: Number(
      apiPayment.sub_total
        ?? (apiPayment.amount != null && apiPayment.due_bills != null
              ? Number(apiPayment.amount) - Number(apiPayment.due_bills)
              : detailPayment?.sub_total ?? 0)
    ),
    cod_charge: Number(apiPayment.charges ?? detailPayment?.cod_charge ?? 0),
    receivable_amount: Number(apiPayment.total ?? detailPayment?.receivable_amount ?? 0),
    status: (apiPayment.status_label || detailPayment?.status || 'Pending'),
    method: apiPayment.method || detailData?.method,
    paid_at: apiPayment.paid_at || detailData?.paid_at,
  };

  // Fetch matching internal orders by invoice (= order_number) so we can show
  // per-parcel hishab: our subtotal/total + mismatch with COD.
  const invoiceList = consignments
    .map((c: any) => String(c.invoice || c.tracking_code || '').trim())
    .filter(Boolean);
  const { data: ordersMap = {}, isLoading: ordersLoading } = useQuery({
    queryKey: ['payment-invoice-orders', invoiceList.sort().join(',')],
    enabled: invoiceList.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('order_number, subtotal, total, delivery_charge, free_shipping, status, courier_status, delivery_area')
        .in('order_number', invoiceList);
      if (error) throw error;
      const map: Record<string, any> = {};
      (data || []).forEach((o: any) => { map[o.order_number] = o; });
      return map;
    },
  });

  const fmtDate = (d: any) => {
    if (!d) return '—';
    try {
      return format(new Date(d), 'dd/MM/yyyy');
    } catch { return String(d); }
  };

  const statusBadge = (s: string) => {
    const v = (s || '').toLowerCase();
    if (v.includes('deliver') && !v.includes('partial')) return 'bg-emerald-100 text-emerald-700 border-emerald-300';
    if (v.includes('cancel') || v.includes('return')) return 'bg-red-100 text-red-700 border-red-300';
    if (v.includes('partial')) return 'bg-blue-100 text-blue-700 border-blue-300';
    return 'bg-amber-100 text-amber-700 border-amber-300';
  };

  const handlePrint = () => {
    const node = document.getElementById('payment-invoice-printable');
    if (!node) return window.print();
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) return;
    w.document.write(`<html><head><title>${detailPayment?.invoice_number || 'Payment'}</title>
      <script src="https://cdn.tailwindcss.com"></script></head>
      <body class="p-6">${node.outerHTML}</body></html>`);
    w.document.close();
    setTimeout(() => { w.print(); w.close(); }, 500);
  };

  return (
    <Dialog open={!!detailPayment} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto p-0 [&>button.absolute]:hidden">
        <DialogHeader className="px-4 py-2 border-b sticky top-0 bg-background z-20 flex flex-row items-center justify-between gap-2">
          <DialogTitle className="flex items-center gap-1.5 text-sm">
            <Receipt className="h-4 w-4 text-primary" />
            পেমেন্ট ইনভয়েস — {detailPayment?.invoice_number}
          </DialogTitle>
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="outline" onClick={handlePrint} className="h-7 gap-1 text-xs px-2">
              <Printer className="h-3.5 w-3.5" /> প্রিন্ট
            </Button>
            <Button size="icon" variant="ghost" onClick={onClose} className="h-7 w-7" aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {detailLoading ? (
          <div className="space-y-2 p-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
        ) : (
          <div id="payment-invoice-printable" className="px-4 py-3 space-y-3 bg-white text-foreground">
            {/* Header — Steadfast brand + memo info (compact) */}
            <div className="rounded-md border px-3 py-2 flex items-center justify-between gap-3 text-[11px]">
              <div className="min-w-0">
                <div className="text-sm font-bold text-primary leading-tight">Steadfast Courier Limited</div>
                <div className="text-muted-foreground leading-tight">Hotline: 09678-045045 · info@steadfast.com.bd</div>
              </div>
              <div className="text-right whitespace-nowrap">
                <div className="font-bold uppercase tracking-wider text-primary">Delivery Memo</div>
                <div className="font-semibold">#{sum.invoice_number} · {fmtDate(sum.date)}</div>
              </div>
            </div>

            {/* Bill To (compact, single row) */}
            <div className="border-l-4 border-primary px-3 py-1.5 text-[11px] flex flex-wrap items-baseline gap-x-2">
              <span className="font-bold uppercase text-muted-foreground tracking-wide text-[10px]">Bill To:</span>
              <span className="text-xs font-bold">{navbar.brand_name || 'স্বর্ণ সুতা'}</span>
              {inv.address && <span className="text-muted-foreground">· {inv.address}</span>}
              {inv.phone && <span className="text-muted-foreground">· 📞 {inv.phone}</span>}
            </div>

            {/* Payment Details (compact) */}
            <div>
              <div className="text-xs font-semibold mb-1.5">Payment Details</div>
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-xs">
                  <tbody>
                    <tr className="border-b">
                      <td className="px-3 py-1.5 text-muted-foreground">Amount Delivered</td>
                      <td className="px-3 py-1.5 text-right font-semibold">{formatBDT(sum.collected_amount)}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-3 py-1.5 text-muted-foreground">Payable Delivery Charge</td>
                      <td className="px-3 py-1.5 text-right font-semibold text-red-600">−{formatBDT(sum.delivery_bill)}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-3 py-1.5 text-muted-foreground">Sub-Total</td>
                      <td className="px-3 py-1.5 text-right font-semibold">{formatBDT(sum.sub_total)}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-3 py-1.5 text-muted-foreground">COD Charge</td>
                      <td className="px-3 py-1.5 text-right font-semibold text-red-600">−{formatBDT(sum.cod_charge)}</td>
                    </tr>
                    <tr className="bg-emerald-50">
                      <td className="px-3 py-2 font-bold">Available Balance (BDT)</td>
                      <td className="px-3 py-2 text-right font-bold text-emerald-700 text-sm">{formatBDT(sum.receivable_amount)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px]">
                <Badge variant="outline" className={`px-2 py-0 font-semibold ${/paid/i.test(sum.status) ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-amber-50 text-amber-700 border-amber-300'}`}>
                  {sum.status}
                </Badge>
                {sum.method && <span className="text-muted-foreground">Method: <span className="font-medium text-foreground">{sum.method}</span></span>}
                {sum.paid_at && <span className="text-muted-foreground">Paid: <span className="font-medium text-foreground">{sum.paid_at}</span></span>}
              </div>
            </div>

            {/* Cleared Consignment table */}
            {consignments.length > 0 ? (
              <div>
                <div className="text-center text-sm font-bold mb-2">Cleared Consignment ({consignments.length})</div>
                <div className="rounded-lg border overflow-auto max-h-[420px]">
                  <Table>
                    <TableHeader className="bg-muted/40 sticky top-0">
                      <TableRow>
                        <TableHead className="text-[11px] uppercase">Approved Date</TableHead>
                        <TableHead className="text-[11px] uppercase">Id</TableHead>
                        <TableHead className="text-[11px] uppercase">Invoice</TableHead>
                        <TableHead className="text-[11px] uppercase">Customer</TableHead>
                        <TableHead className="text-[11px] uppercase text-right">COD</TableHead>
                        <TableHead className="text-[11px] uppercase text-right">Bills</TableHead>
                        <TableHead className="text-[11px] uppercase">Status</TableHead>
                        <TableHead className="text-[11px] uppercase">Note</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const actualTotal = Number(sum.delivery_bill) || 0;
                        // Per-parcel bill: prefer Steadfast's actual field; fall back to rate matrix.
                        const perParcel = consignments.map((c: any) => {
                          const direct = readParcelBill(c);
                          if (direct !== null) return direct;
                          const status = c.delivery_status || c.status || '';
                          const inv = String(c.invoice || c.tracking_code || '').trim();
                          const o = inv ? ordersMap[inv] : null;
                          return computeParcelBill(status, o?.delivery_area ?? null);
                        });

                        let tCod = 0, tBills = 0;
                        const rows = consignments.map((c: any, i: number) => {
                          const status = c.delivery_status || c.status || '';
                          const isCancelled = /cancel|return/i.test(status);
                          const cod = Number(c.cod_amount || c.amount || 0);
                          const invoice = String(c.invoice || c.tracking_code || '').trim();
                          const bill = perParcel[i] || 0;
                          if (!isCancelled) tCod += cod;
                          tBills += bill;
                          return (
                            <TableRow key={i} className="text-xs">
                              <TableCell className="whitespace-nowrap">{fmtDate(c.approved_at || c.delivered_at || c.updated_at || c.created_at)}</TableCell>
                              <TableCell className="font-mono text-[10px] text-muted-foreground">{c.consignment_id || '—'}</TableCell>
                              <TableCell className="font-mono text-[11px] font-medium">{invoice || '—'}</TableCell>
                              <TableCell>
                                <div className="font-medium max-w-[160px] truncate">{c.recipient_name || c.name || '—'}</div>
                                {(c.recipient_phone || c.phone) && (
                                  <a href={`tel:${c.recipient_phone || c.phone}`} className="text-primary text-[10px] flex items-center gap-0.5 mt-0.5">
                                    <Phone className="h-2.5 w-2.5" />{c.recipient_phone || c.phone}
                                  </a>
                                )}
                              </TableCell>
                              <TableCell className={`text-right font-medium ${isCancelled ? 'line-through text-muted-foreground' : ''}`}>{formatBDT(cod)}</TableCell>
                              <TableCell className="text-right font-medium">{formatBDT(bill)}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={`px-2 py-0 text-[10px] font-medium ${statusBadge(status)}`}>
                                  {status || '—'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-[10px] text-muted-foreground max-w-[160px] truncate" title={c.note || ''}>
                                {c.note && c.note !== '-' ? c.note : '—'}
                              </TableCell>
                            </TableRow>
                          );
                        });
                        // Footer shows the sum of actual per-parcel bills.
                        // If rows mismatch Steadfast official total, show both for transparency.
                        const footerBills = tBills;
                        const mismatch = actualTotal > 0 && Math.abs(footerBills - actualTotal) > 0;
                        return <>
                          {rows}
                          <TableRow className="bg-muted/60 font-bold text-xs sticky bottom-0">
                            <TableCell colSpan={4} className="text-right">মোট ({consignments.length})</TableCell>
                            <TableCell className="text-right">{formatBDT(tCod)}</TableCell>
                            <TableCell className="text-right text-red-600">
                              {formatBDT(footerBills)}
                              {mismatch && (
                                <div className="text-[9px] font-normal text-muted-foreground">
                                  Steadfast: {formatBDT(actualTotal)}
                                </div>
                              )}
                            </TableCell>
                            <TableCell colSpan={2} />
                          </TableRow>
                        </>;
                      })()}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5 px-1">
                  <span className="font-semibold">Bills</span> = Steadfast এর official fee schedule অনুযায়ী হিসাব করা — delivered হলে delivery charge (inside ৳60 / suburb ৳80 / outside ৳110), cancelled / partial / failed হলে return charge (inside ৳50 / suburb ৳70 / outside ৳90)। মোট Steadfast এর <span className="font-semibold">Payable Delivery Charge</span> এর সাথে মিল না হলে নিচে আসল মান দেখানো হয়।
                </p>
              </div>
            ) : !detailLoading && (
              <p className="text-sm text-muted-foreground text-center py-4 bg-muted/30 rounded-lg">কনসাইনমেন্ট তথ্য পাওয়া যায়নি</p>
            )}

            {/* Raw debug */}
            {detailData?.raw_response && (
              <Collapsible>
                <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                  <ChevronDown className="h-3 w-3" /> Raw API Response
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <pre className="mt-2 text-[10px] bg-muted/50 rounded-lg p-3 overflow-auto max-h-[200px] whitespace-pre-wrap break-all">
                    {JSON.stringify(detailData.raw_response, null, 2)}
                  </pre>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ==================== Payment Section ====================
const PAYMENT_PAGE_SIZE = 10;

function PaymentSection() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [detailPayment, setDetailPayment] = useState<any>(null);
  const [detailData, setDetailData] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [methodPopover, setMethodPopover] = useState<string | null>(null);
  const [splitAmounts, setSplitAmounts] = useState({ bank: '', cash: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [form, setForm] = useState({
    invoice_number: '', date: format(new Date(), 'yyyy-MM-dd'),
    collected_amount: '', delivery_bill: '', sub_total: '', cod_charge: '', receivable_amount: '',
  });

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['courier-payments', 'steadfast'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courier_payments')
        .select('*')
        .eq('courier_provider', 'steadfast')
        .order('date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });

  // Auto-sync removed — DB already has payments, sync only on button click

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('courier-payments-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'courier_payments' }, () => {
        queryClient.invalidateQueries({ queryKey: ['courier-payments', 'steadfast'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await invokeStfn('fetch_payments');
      await queryClient.invalidateQueries({ queryKey: ['courier-payments', 'steadfast'] });
      if (result.saved > 0) {
        toast.success(`${result.saved}টি পেমেন্ট সেভ হয়েছে (মোট ${result.synced}টি)${result.skipped ? ` | ${result.skipped}টি স্কিপ` : ''}`);
      } else if (result.synced > 0) {
        toast.warning(`API থেকে ${result.synced}টি পেমেন্ট পাওয়া গেছে কিন্তু DB-তে সেভ হয়নি। কনসোল চেক করুন।`, { duration: 8000 });
        console.error('[PaymentSync] Fetched but not saved. Raw:', JSON.stringify(result.raw_response).substring(0, 1000));
      } else {
        toast.info('API থেকে কোনো পেমেন্ট পাওয়া যায়নি');
      }
    } catch (e: any) {
      toast.error(e.message || 'সিঙ্ক করতে সমস্যা হয়েছে');
    } finally { setSyncing(false); }
  };

  const handleViewDetail = async (p: any) => {
    setDetailPayment(p);
    setDetailLoading(true);
    setDetailData(null);
    try {
      const result = await invokeStfn('fetch_payment_detail', { payment_id: p.invoice_number });
      setDetailData(result);
    } catch { setDetailData(null); }
    finally { setDetailLoading(false); }
  };

  const addMutation = useMutation({
    mutationFn: () => invokeStfn('add_payment', {
      ...form,
      collected_amount: Number(form.collected_amount) || 0,
      delivery_bill: Number(form.delivery_bill) || 0,
      sub_total: Number(form.sub_total) || 0,
      cod_charge: Number(form.cod_charge) || 0,
      receivable_amount: Number(form.receivable_amount) || 0,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courier-payments', 'steadfast'] });
      toast.success('পেমেন্ট রেকর্ড যোগ হয়েছে');
      setShowAdd(false);
      setForm({ invoice_number: '', date: format(new Date(), 'yyyy-MM-dd'), collected_amount: '', delivery_bill: '', sub_total: '', cod_charge: '', receivable_amount: '' });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleStatus = useMutation({
    mutationFn: (p: any) => invokeStfn('update_payment', {
      payment_id: p.id,
      status: 'Pending',
      receive_method: null, bank_amount: 0, cash_amount: 0,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courier-payments', 'steadfast'] });
      queryClient.invalidateQueries({ queryKey: ['accounting-financials'] });
      queryClient.invalidateQueries({ queryKey: ['all-courier-payments-history'] });
      queryClient.invalidateQueries({ queryKey: ['sales-history'] });
      toast.success('স্ট্যাটাস আপডেট হয়েছে');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMethod = useMutation({
    mutationFn: (params: { id: string; receive_method: string; bank_amount: number; cash_amount: number; status?: string }) => invokeStfn('update_payment', {
      payment_id: params.id,
      receive_method: params.receive_method,
      bank_amount: params.bank_amount,
      cash_amount: params.cash_amount,
      status: params.status || 'Paid',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courier-payments', 'steadfast'] });
      queryClient.invalidateQueries({ queryKey: ['accounting-financials'] });
      queryClient.invalidateQueries({ queryKey: ['all-courier-payments-history'] });
      queryClient.invalidateQueries({ queryKey: ['sales-history'] });
      setMethodPopover(null);
      toast.success('পেমেন্ট মেথড আপডেট হয়েছে');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleSetMethod = (p: any, method: 'cash' | 'bank') => {
    const amount = Number(p.receivable_amount) || 0;
    updateMethod.mutate({
      id: p.id,
      receive_method: method,
      bank_amount: method === 'bank' ? amount : 0,
      cash_amount: method === 'cash' ? amount : 0,
      status: 'Paid',
    });
  };

  const handleSplitMethod = (p: any) => {
    const bankAmt = Number(splitAmounts.bank) || 0;
    const cashAmt = Number(splitAmounts.cash) || 0;
    updateMethod.mutate({
      id: p.id,
      receive_method: 'split',
      bank_amount: bankAmt,
      cash_amount: cashAmt,
      status: 'Paid',
    });
  };

  // Summary calculations
  const totalCollected = payments.reduce((s: number, p: any) => s + (Number(p.collected_amount) || 0), 0);
  const totalDeliveryBill = payments.reduce((s: number, p: any) => s + (Number(p.delivery_bill) || 0), 0);
  const totalReceivable = payments.reduce((s: number, p: any) => s + (Number(p.receivable_amount) || 0), 0);
  const totalSubTotal = payments.reduce((s: number, p: any) => s + (Number(p.sub_total) || 0), 0);
  const totalCodCharge = payments.reduce((s: number, p: any) => s + (Number(p.cod_charge) || 0), 0);
  const totalBankAmount = payments.reduce((s: number, p: any) => s + (Number(p.bank_amount) || 0), 0);
  const totalCashAmount = payments.reduce((s: number, p: any) => s + (Number(p.cash_amount) || 0), 0);
  const unsetPaidCount = payments.filter((p: any) => p.status === 'Paid' && !p.receive_method).length;
  const totalPages = Math.ceil(payments.length / PAYMENT_PAGE_SIZE);
  const paginatedPayments = payments.slice((currentPage - 1) * PAYMENT_PAGE_SIZE, currentPage * PAYMENT_PAGE_SIZE);


  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    try { return format(new Date(dateStr), 'dd/MM/yyyy hh:mm a'); } catch { return dateStr?.substring(0, 10) || '—'; }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5 flex-wrap">
          <Receipt className="h-4 w-4" /> পেমেন্ট হিস্টোরি
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            অটো সিঙ্ক চালু · প্রতি ১ ঘণ্টায় · Paid → ব্যাংক
          </span>
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleSync} disabled={syncing}>
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'সিঙ্ক হচ্ছে...' : 'Steadfast থেকে সিঙ্ক'}
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setShowAdd(true)}>
            <Plus className="h-3.5 w-3.5" /> ম্যানুয়াল যোগ
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {payments.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-[11px] text-muted-foreground">মোট সংগৃহীত</p>
            <p className="text-sm font-bold">{formatBDT(totalCollected)}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-[11px] text-muted-foreground">ডেলিভারি বিল</p>
            <p className="text-sm font-bold">{formatBDT(totalDeliveryBill)}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-[11px] text-muted-foreground">সাব-টোটাল</p>
            <p className="text-sm font-bold">{formatBDT(totalSubTotal)}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-[11px] text-muted-foreground">মোট প্রাপ্য</p>
            <p className="text-sm font-bold text-green-600">{formatBDT(totalReceivable)}</p>
          </div>
          <div className="rounded-lg p-3 text-center border border-blue-200 bg-blue-50/50">
            <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1"><Landmark className="h-3 w-3" /> ব্যাংক</p>
            <p className="text-sm font-bold text-blue-600">{formatBDT(totalBankAmount)}</p>
          </div>
          <div className="rounded-lg p-3 text-center border border-emerald-200 bg-emerald-50/50">
            <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1"><Banknote className="h-3 w-3" /> ক্যাশ</p>
            <p className="text-sm font-bold text-emerald-600">{formatBDT(totalCashAmount)}</p>
          </div>
          {unsetPaidCount > 0 && (
            <div className="rounded-lg p-3 text-center border border-amber-200 bg-amber-50/50">
              <p className="text-[11px] text-muted-foreground">মেথড সেট নেই</p>
              <p className="text-sm font-bold text-amber-600">{unsetPaidCount}টি Paid</p>
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : payments.length === 0 ? (
        <div className="text-center py-8 space-y-3">
          <p className="text-muted-foreground text-sm">কোনো পেমেন্ট রেকর্ড নেই</p>
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
            Steadfast থেকে লোড করুন
          </Button>
        </div>
      ) : (
        <>
        <div className="rounded-lg border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/70">
                <TableHead className="text-[11px] uppercase font-semibold w-10">#</TableHead>
                <TableHead className="text-[11px] uppercase font-semibold">Date</TableHead>
                <TableHead className="text-[11px] uppercase font-semibold">Invoice</TableHead>
                <TableHead className="text-[11px] uppercase font-semibold text-right font-mono">Collected</TableHead>
                <TableHead className="text-[11px] uppercase font-semibold text-right font-mono">Delivery Bill</TableHead>
                <TableHead className="text-[11px] uppercase font-semibold text-right font-mono">Sub Total</TableHead>
                <TableHead className="text-[11px] uppercase font-semibold text-right font-mono">COD Charge</TableHead>
                <TableHead className="text-[11px] uppercase font-semibold text-right font-mono">Receivable</TableHead>
                <TableHead className="text-[11px] uppercase font-semibold text-center">Status</TableHead>
                <TableHead className="text-[11px] uppercase font-semibold text-center">মেথড</TableHead>
                <TableHead className="text-[11px] uppercase font-semibold text-center">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedPayments.map((p: any, idx: number) => (
                <TableRow
                  key={p.id}
                  className={`text-xs transition-colors hover:bg-primary/5 ${idx % 2 === 0 ? 'bg-muted/20' : ''}`}
                >
                  <TableCell className="text-muted-foreground font-medium">{(currentPage - 1) * PAYMENT_PAGE_SIZE + idx + 1}</TableCell>
                  <TableCell className="whitespace-nowrap text-[12px]">{formatDate(p.date)}</TableCell>
                  <TableCell className="font-mono font-medium text-[12px]">{p.invoice_number || '—'}</TableCell>
                  <TableCell className="text-right font-mono">{formatBDT(Number(p.collected_amount))}</TableCell>
                  <TableCell className="text-right font-mono">{formatBDT(Number(p.delivery_bill))}</TableCell>
                  <TableCell className="text-right font-mono">{formatBDT(Number(p.sub_total))}</TableCell>
                  <TableCell className="text-right font-mono">{formatBDT(Number(p.cod_charge))}</TableCell>
                  <TableCell className="text-right font-mono font-medium">{formatBDT(Number(p.receivable_amount))}</TableCell>
                  <TableCell className="text-center" onClick={e => e.stopPropagation()}>
                    {p.status === 'Paid' ? (
                      <Badge
                        variant="outline"
                        className="cursor-pointer text-[11px] px-3 py-0.5 rounded-full border font-semibold bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100"
                        onClick={() => toggleStatus.mutate(p)}
                      >
                        Paid
                      </Badge>
                    ) : (
                      <Popover open={methodPopover === `status-${p.id}`} onOpenChange={(open) => {
                        setMethodPopover(open ? `status-${p.id}` : null);
                        if (open) setSplitAmounts({ bank: '', cash: '' });
                      }}>
                        <PopoverTrigger asChild>
                          <Badge
                            variant="outline"
                            className="cursor-pointer text-[11px] px-3 py-0.5 rounded-full border font-semibold bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100"
                          >
                            Pending
                          </Badge>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-3" align="center">
                          <div className="space-y-2">
                            <p className="text-xs font-semibold">Paid মার্ক করুন — মেথড বাছুন</p>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" className="flex-1 h-8 text-xs gap-1 bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100" onClick={() => handleSetMethod(p, 'cash')}>
                                <Banknote className="h-3 w-3" /> Cash
                              </Button>
                              <Button size="sm" variant="outline" className="flex-1 h-8 text-xs gap-1 bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100" onClick={() => handleSetMethod(p, 'bank')}>
                                <Landmark className="h-3 w-3" /> Bank
                              </Button>
                            </div>
                            <div className="border-t pt-2 space-y-1.5">
                              <p className="text-[10px] text-muted-foreground font-medium">Split (ভাগ করুন)</p>
                              <div className="flex gap-1.5">
                                <Input placeholder="ব্যাংক" type="number" className="h-7 text-xs" value={splitAmounts.bank} onChange={e => setSplitAmounts(s => ({ ...s, bank: e.target.value }))} />
                                <Input placeholder="ক্যাশ" type="number" className="h-7 text-xs" value={splitAmounts.cash} onChange={e => setSplitAmounts(s => ({ ...s, cash: e.target.value }))} />
                              </div>
                              <Button size="sm" variant="default" className="w-full h-7 text-xs" onClick={() => handleSplitMethod(p)} disabled={!splitAmounts.bank && !splitAmounts.cash}>
                                সেভ
                              </Button>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                  </TableCell>
                  <TableCell className="text-center" onClick={e => e.stopPropagation()}>
                    <Popover open={methodPopover === p.id} onOpenChange={(open) => {
                      setMethodPopover(open ? p.id : null);
                      if (open) setSplitAmounts({ bank: '', cash: '' });
                    }}>
                      <PopoverTrigger asChild>
                        <button className="inline-flex items-center gap-1">
                          {p.receive_method === 'bank' ? (
                            <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 border-blue-300 cursor-pointer hover:bg-blue-100">
                              <Landmark className="h-3 w-3 mr-0.5" /> Bank {formatBDT(Number(p.bank_amount))}
                            </Badge>
                          ) : p.receive_method === 'cash' ? (
                            <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-700 border-emerald-300 cursor-pointer hover:bg-emerald-100">
                              <Banknote className="h-3 w-3 mr-0.5" /> Cash {formatBDT(Number(p.cash_amount))}
                            </Badge>
                          ) : p.receive_method === 'split' ? (
                            <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-purple-50 text-purple-700 border-purple-300 cursor-pointer hover:bg-purple-100">
                              Split <span className="ml-0.5">B:{formatBDT(Number(p.bank_amount))} C:{formatBDT(Number(p.cash_amount))}</span>
                            </Badge>
                          ) : p.status === 'Paid' ? (
                            <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-600 border-amber-300 cursor-pointer hover:bg-amber-100 animate-pulse">
                              সেট করুন
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-[10px]">—</span>
                          )}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-56 p-3" align="center">
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground">রিসিভ মেথড</p>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="flex-1 h-8 text-xs gap-1 bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100" onClick={() => handleSetMethod(p, 'cash')}>
                              <Banknote className="h-3 w-3" /> Cash
                            </Button>
                            <Button size="sm" variant="outline" className="flex-1 h-8 text-xs gap-1 bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100" onClick={() => handleSetMethod(p, 'bank')}>
                              <Landmark className="h-3 w-3" /> Bank
                            </Button>
                          </div>
                          <div className="border-t pt-2 space-y-1.5">
                            <p className="text-[10px] text-muted-foreground font-medium">Split (ভাগ করুন)</p>
                            <div className="flex gap-1.5">
                              <Input placeholder="ব্যাংক" type="number" className="h-7 text-xs" value={splitAmounts.bank} onChange={e => setSplitAmounts(s => ({ ...s, bank: e.target.value }))} />
                              <Input placeholder="ক্যাশ" type="number" className="h-7 text-xs" value={splitAmounts.cash} onChange={e => setSplitAmounts(s => ({ ...s, cash: e.target.value }))} />
                            </div>
                            <Button size="sm" variant="default" className="w-full h-7 text-xs" onClick={() => handleSplitMethod(p)} disabled={!splitAmounts.bank && !splitAmounts.cash}>
                              সেভ
                            </Button>
                          </div>
                          {p.receive_method && (
                            <div className="pt-1 border-t space-y-1.5">
                              <div className="text-[10px] text-muted-foreground">
                                {p.bank_amount > 0 && <span>ব্যাংক: {formatBDT(Number(p.bank_amount))} </span>}
                                {p.cash_amount > 0 && <span>ক্যাশ: {formatBDT(Number(p.cash_amount))}</span>}
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full h-7 text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                                onClick={() => updateMethod.mutate({ id: p.id, receive_method: null as any, bank_amount: 0, cash_amount: 0, status: 'Paid' })}
                              >
                                <XCircle className="h-3 w-3" /> মেথড সরান
                              </Button>
                            </div>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-3 text-[11px] bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600 hover:text-white rounded-md"
                      onClick={() => handleViewDetail(p)}
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="bg-muted/60 font-semibold text-xs">
                <TableCell colSpan={3} className="text-right uppercase text-[11px] text-muted-foreground">মোট</TableCell>
                <TableCell className="text-right font-mono">{formatBDT(totalCollected)}</TableCell>
                <TableCell className="text-right font-mono">{formatBDT(totalDeliveryBill)}</TableCell>
                <TableCell className="text-right font-mono">{formatBDT(totalSubTotal)}</TableCell>
                <TableCell className="text-right font-mono">{formatBDT(totalCodCharge)}</TableCell>
                <TableCell className="text-right font-mono font-bold">{formatBDT(totalReceivable)}</TableCell>
                <TableCell />
                <TableCell />
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1.5 pt-3">
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2 text-xs"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
            >
              পূর্ববর্তী
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
              // Show first, last, current and neighbors
              if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                return (
                  <Button
                    key={page}
                    size="sm"
                    variant={page === currentPage ? 'default' : 'outline'}
                    className="h-8 w-8 p-0 text-xs"
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </Button>
                );
              }
              if (page === currentPage - 2 || page === currentPage + 2) {
                return <span key={page} className="text-muted-foreground text-xs px-1">...</span>;
              }
              return null;
            })}
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2 text-xs"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
            >
              পরবর্তী
            </Button>
          </div>
        )}
        </>
      )}


      {/* Payment Detail Dialog — Steadfast portal style invoice */}
      <PaymentInvoiceDialog
        detailPayment={detailPayment}
        detailData={detailData}
        detailLoading={detailLoading}
        onClose={() => setDetailPayment(null)}
      />

      {/* Add Payment Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>নতুন পেমেন্ট রেকর্ড</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">ইনভয়েস নম্বর</Label>
              <Input placeholder="SFC-XXXXXXX" value={form.invoice_number} onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">তারিখ</Label>
              <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} onPaste={e => { const parsed = smartParseDate(e.clipboardData.getData('text')); if (parsed) { e.preventDefault(); setForm(f => ({ ...f, date: parsed })); } }} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">সংগৃহীত টাকা</Label>
                <Input type="number" value={form.collected_amount} onChange={e => setForm(f => ({ ...f, collected_amount: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">ডেলিভারি বিল</Label>
                <Input type="number" value={form.delivery_bill} onChange={e => setForm(f => ({ ...f, delivery_bill: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">COD চার্জ</Label>
                <Input type="number" value={form.cod_charge} onChange={e => setForm(f => ({ ...f, cod_charge: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">প্রাপ্য টাকা</Label>
                <Input type="number" value={form.receivable_amount} onChange={e => setForm(f => ({ ...f, receivable_amount: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>বাতিল</Button>
            <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
              {addMutation.isPending ? 'সেভ হচ্ছে...' : 'সেভ করুন'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== Generic Courier Payment Section ====================
const GENERIC_PAGE_SIZE = 10;

function GenericCourierPaymentSection({ provider, portalUrl, portalLabel }: { provider: string; portalUrl: string; portalLabel: string }) {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [methodPopover, setMethodPopover] = useState<string | null>(null);
  const [splitAmounts, setSplitAmounts] = useState({ bank: '', cash: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [form, setForm] = useState({
    invoice_number: '', date: format(new Date(), 'yyyy-MM-dd'),
    collected_amount: '', delivery_bill: '', cod_charge: '', receivable_amount: '',
  });

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['courier-payments', provider],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courier_payments')
        .select('*')
        .eq('courier_provider', provider)
        .order('date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`courier-payments-${provider}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'courier_payments' }, () => {
        queryClient.invalidateQueries({ queryKey: ['courier-payments', provider] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient, provider]);

  const addMutation = useMutation({
    mutationFn: async () => {
      const sub_total = (Number(form.collected_amount) || 0) - (Number(form.delivery_bill) || 0);
      const { error } = await supabase.from('courier_payments').insert({
        invoice_number: form.invoice_number || '',
        date: form.date || new Date().toISOString(),
        collected_amount: Number(form.collected_amount) || 0,
        delivery_bill: Number(form.delivery_bill) || 0,
        sub_total,
        cod_charge: Number(form.cod_charge) || 0,
        receivable_amount: Number(form.receivable_amount) || 0,
        status: 'Pending',
        courier_provider: provider,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courier-payments', provider] });
      toast.success('পেমেন্ট রেকর্ড যোগ হয়েছে');
      setShowAdd(false);
      setForm({ invoice_number: '', date: format(new Date(), 'yyyy-MM-dd'), collected_amount: '', delivery_bill: '', cod_charge: '', receivable_amount: '' });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updatePayment = useMutation({
    mutationFn: async (params: { id: string; updates: Record<string, any> }) => {
      const { error } = await supabase.from('courier_payments').update(params.updates as any).eq('id', params.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courier-payments', provider] });
      queryClient.invalidateQueries({ queryKey: ['accounting-financials'] });
      queryClient.invalidateQueries({ queryKey: ['all-courier-payments-history'] });
      queryClient.invalidateQueries({ queryKey: ['sales-history'] });
      setMethodPopover(null);
      toast.success('আপডেট হয়েছে');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleSetMethod = (p: any, method: 'cash' | 'bank') => {
    const amount = Number(p.receivable_amount) || 0;
    updatePayment.mutate({
      id: p.id,
      updates: {
        receive_method: method,
        bank_amount: method === 'bank' ? amount : 0,
        cash_amount: method === 'cash' ? amount : 0,
        status: 'Paid',
      },
    });
  };

  const handleSplitMethod = (p: any) => {
    updatePayment.mutate({
      id: p.id,
      updates: {
        receive_method: 'split',
        bank_amount: Number(splitAmounts.bank) || 0,
        cash_amount: Number(splitAmounts.cash) || 0,
        status: 'Paid',
      },
    });
  };

  const toggleToPending = (p: any) => {
    updatePayment.mutate({
      id: p.id,
      updates: { status: 'Pending', receive_method: null, bank_amount: 0, cash_amount: 0 },
    });
  };

  const totalCollected = payments.reduce((s: number, p: any) => s + (Number(p.collected_amount) || 0), 0);
  const totalDeliveryBill = payments.reduce((s: number, p: any) => s + (Number(p.delivery_bill) || 0), 0);
  const totalReceivable = payments.reduce((s: number, p: any) => s + (Number(p.receivable_amount) || 0), 0);
  const totalBankAmount = payments.reduce((s: number, p: any) => s + (Number(p.bank_amount) || 0), 0);
  const totalCashAmount = payments.reduce((s: number, p: any) => s + (Number(p.cash_amount) || 0), 0);
  const totalCodCharge = payments.reduce((s: number, p: any) => s + (Number(p.cod_charge) || 0), 0);
  const unsetPaidCount = payments.filter((p: any) => p.status === 'Paid' && !p.receive_method).length;
  const totalPages = Math.ceil(payments.length / GENERIC_PAGE_SIZE);
  const paginatedPayments = payments.slice((currentPage - 1) * GENERIC_PAGE_SIZE, currentPage * GENERIC_PAGE_SIZE);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    try { return format(new Date(dateStr), 'dd/MM/yyyy hh:mm a'); } catch { return dateStr?.substring(0, 10) || '—'; }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
          <Receipt className="h-4 w-4" /> পেমেন্ট হিস্টোরি
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" asChild>
            <a href={portalUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" /> {portalLabel}
            </a>
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setShowAdd(true)}>
            <Plus className="h-3.5 w-3.5" /> ম্যানুয়াল যোগ
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {payments.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-[11px] text-muted-foreground">মোট সংগৃহীত</p>
            <p className="text-sm font-bold">{formatBDT(totalCollected)}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-[11px] text-muted-foreground">ডেলিভারি বিল</p>
            <p className="text-sm font-bold">{formatBDT(totalDeliveryBill)}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-[11px] text-muted-foreground">COD চার্জ</p>
            <p className="text-sm font-bold">{formatBDT(totalCodCharge)}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-[11px] text-muted-foreground">মোট প্রাপ্য</p>
            <p className="text-sm font-bold text-green-600">{formatBDT(totalReceivable)}</p>
          </div>
          <div className="rounded-lg p-3 text-center border border-blue-200 bg-blue-50/50">
            <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1"><Landmark className="h-3 w-3" /> ব্যাংক</p>
            <p className="text-sm font-bold text-blue-600">{formatBDT(totalBankAmount)}</p>
          </div>
          <div className="rounded-lg p-3 text-center border border-emerald-200 bg-emerald-50/50">
            <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1"><Banknote className="h-3 w-3" /> ক্যাশ</p>
            <p className="text-sm font-bold text-emerald-600">{formatBDT(totalCashAmount)}</p>
          </div>
          {unsetPaidCount > 0 && (
            <div className="rounded-lg p-3 text-center border border-amber-200 bg-amber-50/50">
              <p className="text-[11px] text-muted-foreground">মেথড সেট নেই</p>
              <p className="text-sm font-bold text-amber-600">{unsetPaidCount}টি Paid</p>
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : payments.length === 0 ? (
        <div className="text-center py-8 space-y-3">
          <p className="text-muted-foreground text-sm">কোনো পেমেন্ট রেকর্ড নেই</p>
          <p className="text-xs text-muted-foreground">ম্যানুয়ালি যোগ করুন অথবা {portalLabel} থেকে তথ্য নিয়ে এখানে এন্ট্রি দিন</p>
        </div>
      ) : (
        <>
        <div className="rounded-lg border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/70">
                <TableHead className="text-[11px] uppercase font-semibold w-10">#</TableHead>
                <TableHead className="text-[11px] uppercase font-semibold">Date</TableHead>
                <TableHead className="text-[11px] uppercase font-semibold">Invoice</TableHead>
                <TableHead className="text-[11px] uppercase font-semibold text-right font-mono">Collected</TableHead>
                <TableHead className="text-[11px] uppercase font-semibold text-right font-mono">Delivery Bill</TableHead>
                <TableHead className="text-[11px] uppercase font-semibold text-right font-mono">COD Charge</TableHead>
                <TableHead className="text-[11px] uppercase font-semibold text-right font-mono">Receivable</TableHead>
                <TableHead className="text-[11px] uppercase font-semibold text-center">Status</TableHead>
                <TableHead className="text-[11px] uppercase font-semibold text-center">মেথড</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedPayments.map((p: any, idx: number) => (
                <TableRow key={p.id} className={`text-xs transition-colors hover:bg-primary/5 ${idx % 2 === 0 ? 'bg-muted/20' : ''}`}>
                  <TableCell className="text-muted-foreground font-medium">{(currentPage - 1) * GENERIC_PAGE_SIZE + idx + 1}</TableCell>
                  <TableCell className="whitespace-nowrap text-[12px]">{formatDate(p.date)}</TableCell>
                  <TableCell className="font-mono font-medium text-[12px]">{p.invoice_number || '—'}</TableCell>
                  <TableCell className="text-right font-mono">{formatBDT(Number(p.collected_amount))}</TableCell>
                  <TableCell className="text-right font-mono">{formatBDT(Number(p.delivery_bill))}</TableCell>
                  <TableCell className="text-right font-mono">{formatBDT(Number(p.cod_charge))}</TableCell>
                  <TableCell className="text-right font-mono font-medium">{formatBDT(Number(p.receivable_amount))}</TableCell>
                  <TableCell className="text-center" onClick={e => e.stopPropagation()}>
                    {p.status === 'Paid' ? (
                      <Badge
                        variant="outline"
                        className="cursor-pointer text-[11px] px-3 py-0.5 rounded-full border font-semibold bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100"
                        onClick={() => toggleToPending(p)}
                      >
                        Paid
                      </Badge>
                    ) : (
                      <Popover open={methodPopover === `status-${p.id}`} onOpenChange={(open) => {
                        setMethodPopover(open ? `status-${p.id}` : null);
                        if (open) setSplitAmounts({ bank: '', cash: '' });
                      }}>
                        <PopoverTrigger asChild>
                          <Badge variant="outline" className="cursor-pointer text-[11px] px-3 py-0.5 rounded-full border font-semibold bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100">
                            Pending
                          </Badge>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-3" align="center">
                          <div className="space-y-2">
                            <p className="text-xs font-semibold">Paid মার্ক করুন — মেথড বাছুন</p>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" className="flex-1 h-8 text-xs gap-1 bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100" onClick={() => handleSetMethod(p, 'cash')}>
                                <Banknote className="h-3 w-3" /> Cash
                              </Button>
                              <Button size="sm" variant="outline" className="flex-1 h-8 text-xs gap-1 bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100" onClick={() => handleSetMethod(p, 'bank')}>
                                <Landmark className="h-3 w-3" /> Bank
                              </Button>
                            </div>
                            <div className="border-t pt-2 space-y-1.5">
                              <p className="text-[10px] text-muted-foreground font-medium">Split (ভাগ করুন)</p>
                              <div className="flex gap-1.5">
                                <Input placeholder="ব্যাংক" type="number" className="h-7 text-xs" value={splitAmounts.bank} onChange={e => setSplitAmounts(s => ({ ...s, bank: e.target.value }))} />
                                <Input placeholder="ক্যাশ" type="number" className="h-7 text-xs" value={splitAmounts.cash} onChange={e => setSplitAmounts(s => ({ ...s, cash: e.target.value }))} />
                              </div>
                              <Button size="sm" variant="default" className="w-full h-7 text-xs" onClick={() => handleSplitMethod(p)} disabled={!splitAmounts.bank && !splitAmounts.cash}>
                                সেভ
                              </Button>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                  </TableCell>
                  <TableCell className="text-center" onClick={e => e.stopPropagation()}>
                    <Popover open={methodPopover === p.id} onOpenChange={(open) => {
                      setMethodPopover(open ? p.id : null);
                      if (open) setSplitAmounts({ bank: '', cash: '' });
                    }}>
                      <PopoverTrigger asChild>
                        <button className="inline-flex items-center gap-1">
                          {p.receive_method === 'bank' ? (
                            <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 border-blue-300 cursor-pointer hover:bg-blue-100">
                              <Landmark className="h-3 w-3 mr-0.5" /> Bank {formatBDT(Number(p.bank_amount))}
                            </Badge>
                          ) : p.receive_method === 'cash' ? (
                            <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-700 border-emerald-300 cursor-pointer hover:bg-emerald-100">
                              <Banknote className="h-3 w-3 mr-0.5" /> Cash {formatBDT(Number(p.cash_amount))}
                            </Badge>
                          ) : p.receive_method === 'split' ? (
                            <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-purple-50 text-purple-700 border-purple-300 cursor-pointer hover:bg-purple-100">
                              Split <span className="ml-0.5">B:{formatBDT(Number(p.bank_amount))} C:{formatBDT(Number(p.cash_amount))}</span>
                            </Badge>
                          ) : p.status === 'Paid' ? (
                            <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-600 border-amber-300 cursor-pointer hover:bg-amber-100 animate-pulse">
                              সেট করুন
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-[10px]">—</span>
                          )}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-56 p-3" align="center">
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground">রিসিভ মেথড</p>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="flex-1 h-8 text-xs gap-1 bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100" onClick={() => handleSetMethod(p, 'cash')}>
                              <Banknote className="h-3 w-3" /> Cash
                            </Button>
                            <Button size="sm" variant="outline" className="flex-1 h-8 text-xs gap-1 bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100" onClick={() => handleSetMethod(p, 'bank')}>
                              <Landmark className="h-3 w-3" /> Bank
                            </Button>
                          </div>
                          <div className="border-t pt-2 space-y-1.5">
                            <p className="text-[10px] text-muted-foreground font-medium">Split (ভাগ করুন)</p>
                            <div className="flex gap-1.5">
                              <Input placeholder="ব্যাংক" type="number" className="h-7 text-xs" value={splitAmounts.bank} onChange={e => setSplitAmounts(s => ({ ...s, bank: e.target.value }))} />
                              <Input placeholder="ক্যাশ" type="number" className="h-7 text-xs" value={splitAmounts.cash} onChange={e => setSplitAmounts(s => ({ ...s, cash: e.target.value }))} />
                            </div>
                            <Button size="sm" variant="default" className="w-full h-7 text-xs" onClick={() => handleSplitMethod(p)} disabled={!splitAmounts.bank && !splitAmounts.cash}>
                              সেভ
                            </Button>
                          </div>
                          {p.receive_method && (
                            <div className="pt-1 border-t space-y-1.5">
                              <div className="text-[10px] text-muted-foreground">
                                {p.bank_amount > 0 && <span>ব্যাংক: {formatBDT(Number(p.bank_amount))} </span>}
                                {p.cash_amount > 0 && <span>ক্যাশ: {formatBDT(Number(p.cash_amount))}</span>}
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full h-7 text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                                onClick={() => updatePayment.mutate({ id: p.id, updates: { receive_method: null, bank_amount: 0, cash_amount: 0, status: 'Paid' } })}
                              >
                                <XCircle className="h-3 w-3" /> মেথড সরান
                              </Button>
                            </div>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="bg-muted/60 font-semibold text-xs">
                <TableCell colSpan={3} className="text-right uppercase text-[11px] text-muted-foreground">মোট</TableCell>
                <TableCell className="text-right font-mono">{formatBDT(totalCollected)}</TableCell>
                <TableCell className="text-right font-mono">{formatBDT(totalDeliveryBill)}</TableCell>
                <TableCell className="text-right font-mono">{formatBDT(totalCodCharge)}</TableCell>
                <TableCell className="text-right font-mono font-bold">{formatBDT(totalReceivable)}</TableCell>
                <TableCell />
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1.5 pt-3">
            <Button size="sm" variant="outline" className="h-8 px-2 text-xs" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
              পূর্ববর্তী
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
              if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                return (
                  <Button key={page} size="sm" variant={page === currentPage ? 'default' : 'outline'} className="h-8 w-8 p-0 text-xs" onClick={() => setCurrentPage(page)}>
                    {page}
                  </Button>
                );
              }
              if (page === currentPage - 2 || page === currentPage + 2) {
                return <span key={page} className="text-muted-foreground text-xs px-1">...</span>;
              }
              return null;
            })}
            <Button size="sm" variant="outline" className="h-8 px-2 text-xs" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
              পরবর্তী
            </Button>
          </div>
        )}
        </>
      )}

      {/* Add Payment Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>নতুন পেমেন্ট রেকর্ড — {provider === 'pathao' ? 'Pathao' : 'RedX'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">ইনভয়েস নম্বর</Label>
              <Input placeholder={provider === 'pathao' ? 'PTH-XXXXX' : 'RDX-XXXXX'} value={form.invoice_number} onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">তারিখ</Label>
              <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} onPaste={e => { const parsed = smartParseDate(e.clipboardData.getData('text')); if (parsed) { e.preventDefault(); setForm(f => ({ ...f, date: parsed })); } }} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">সংগৃহীত টাকা</Label>
                <Input type="number" value={form.collected_amount} onChange={e => setForm(f => ({ ...f, collected_amount: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">ডেলিভারি বিল</Label>
                <Input type="number" value={form.delivery_bill} onChange={e => setForm(f => ({ ...f, delivery_bill: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">COD চার্জ</Label>
                <Input type="number" value={form.cod_charge} onChange={e => setForm(f => ({ ...f, cod_charge: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">প্রাপ্য টাকা</Label>
                <Input type="number" value={form.receivable_amount} onChange={e => setForm(f => ({ ...f, receivable_amount: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>বাতিল</Button>
            <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
              {addMutation.isPending ? 'সেভ হচ্ছে...' : 'সেভ করুন'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== Other Courier Payment Section ====================
export const OTHER_COURIERS = [
  { value: 'sa_poribohon', label: 'S A পরিবহন' },
  { value: 'sundorbon', label: 'সুন্দরবন কুরিয়ার' },
  { value: 'korotoa', label: 'করতোয়া কুরিয়ার' },
  { value: 'jononi', label: 'জননী কুরিয়ার' },
  { value: 'paperfly', label: 'Paperfly' },
  { value: 'continental', label: 'Continental কুরিয়ার' },
  { value: 'dhl', label: 'DHL' },
];

const OTHER_PROVIDERS = OTHER_COURIERS.map(c => c.value);

function OtherCourierPaymentSection() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [methodPopover, setMethodPopover] = useState<string | null>(null);
  const [splitAmounts, setSplitAmounts] = useState({ bank: '', cash: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [filterProvider, setFilterProvider] = useState<string>('all');
  const [customCourier, setCustomCourier] = useState('');
  const [form, setForm] = useState({
    courier_provider: '',
    invoice_number: '', date: format(new Date(), 'yyyy-MM-dd'),
    collected_amount: '', delivery_bill: '', cod_charge: '', receivable_amount: '',
  });

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['courier-payments', 'other'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courier_payments')
        .select('*')
        .not('courier_provider', 'in', '("steadfast","pathao","redx")')
        .order('date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    const channel = supabase
      .channel('courier-payments-other')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'courier_payments' }, () => {
        queryClient.invalidateQueries({ queryKey: ['courier-payments', 'other'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const addMutation = useMutation({
    mutationFn: async () => {
      const provider = form.courier_provider === '__custom' ? customCourier.trim().toLowerCase().replace(/\s+/g, '_') : form.courier_provider;
      if (!provider) throw new Error('কুরিয়ার নাম নির্বাচন করুন');
      const sub_total = (Number(form.collected_amount) || 0) - (Number(form.delivery_bill) || 0);
      const { error } = await supabase.from('courier_payments').insert({
        invoice_number: form.invoice_number || '',
        date: form.date || new Date().toISOString(),
        collected_amount: Number(form.collected_amount) || 0,
        delivery_bill: Number(form.delivery_bill) || 0,
        sub_total,
        cod_charge: Number(form.cod_charge) || 0,
        receivable_amount: Number(form.receivable_amount) || 0,
        status: 'Pending',
        courier_provider: provider,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courier-payments', 'other'] });
      toast.success('পেমেন্ট রেকর্ড যোগ হয়েছে');
      setShowAdd(false);
      setCustomCourier('');
      setForm({ courier_provider: '', invoice_number: '', date: format(new Date(), 'yyyy-MM-dd'), collected_amount: '', delivery_bill: '', cod_charge: '', receivable_amount: '' });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updatePayment = useMutation({
    mutationFn: async (params: { id: string; updates: Record<string, any> }) => {
      const { error } = await supabase.from('courier_payments').update(params.updates as any).eq('id', params.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courier-payments', 'other'] });
      queryClient.invalidateQueries({ queryKey: ['accounting-financials'] });
      queryClient.invalidateQueries({ queryKey: ['all-courier-payments-history'] });
      queryClient.invalidateQueries({ queryKey: ['sales-history'] });
      setMethodPopover(null);
      toast.success('আপডেট হয়েছে');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleSetMethod = (p: any, method: 'cash' | 'bank') => {
    const amount = Number(p.receivable_amount) || 0;
    updatePayment.mutate({
      id: p.id,
      updates: { receive_method: method, bank_amount: method === 'bank' ? amount : 0, cash_amount: method === 'cash' ? amount : 0, status: 'Paid' },
    });
  };

  const handleSplitMethod = (p: any) => {
    updatePayment.mutate({
      id: p.id,
      updates: { receive_method: 'split', bank_amount: Number(splitAmounts.bank) || 0, cash_amount: Number(splitAmounts.cash) || 0, status: 'Paid' },
    });
  };

  const toggleToPending = (p: any) => {
    updatePayment.mutate({ id: p.id, updates: { status: 'Pending', receive_method: null, bank_amount: 0, cash_amount: 0 } });
  };

  const getCourierLabel = (provider: string) => {
    const found = OTHER_COURIERS.find(c => c.value === provider);
    return found ? found.label : provider;
  };

  // Get unique providers from data for filter
  const uniqueProviders = Array.from(new Set(payments.map((p: any) => p.courier_provider)));

  const filteredPayments = filterProvider === 'all' ? payments : payments.filter((p: any) => p.courier_provider === filterProvider);

  const totalCollected = filteredPayments.reduce((s: number, p: any) => s + (Number(p.collected_amount) || 0), 0);
  const totalDeliveryBill = filteredPayments.reduce((s: number, p: any) => s + (Number(p.delivery_bill) || 0), 0);
  const totalReceivable = filteredPayments.reduce((s: number, p: any) => s + (Number(p.receivable_amount) || 0), 0);
  const totalBankAmount = filteredPayments.reduce((s: number, p: any) => s + (Number(p.bank_amount) || 0), 0);
  const totalCashAmount = filteredPayments.reduce((s: number, p: any) => s + (Number(p.cash_amount) || 0), 0);
  const totalCodCharge = filteredPayments.reduce((s: number, p: any) => s + (Number(p.cod_charge) || 0), 0);
  const totalPages = Math.ceil(filteredPayments.length / GENERIC_PAGE_SIZE);
  const paginatedPayments = filteredPayments.slice((currentPage - 1) * GENERIC_PAGE_SIZE, currentPage * GENERIC_PAGE_SIZE);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    try { return format(new Date(dateStr), 'dd/MM/yyyy hh:mm a'); } catch { return dateStr?.substring(0, 10) || '—'; }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
          <Receipt className="h-4 w-4" /> অন্যান্য কুরিয়ার পেমেন্ট
        </h2>
        <div className="flex gap-2">
          {uniqueProviders.length > 1 && (
            <select
              className="h-8 rounded-md border bg-background px-2 text-xs"
              value={filterProvider}
              onChange={e => { setFilterProvider(e.target.value); setCurrentPage(1); }}
            >
              <option value="all">সব কুরিয়ার</option>
              {uniqueProviders.map(p => (
                <option key={p} value={p}>{getCourierLabel(p)}</option>
              ))}
            </select>
          )}
          <Button size="sm" className="gap-1.5" onClick={() => setShowAdd(true)}>
            <Plus className="h-3.5 w-3.5" /> বিল যোগ করুন
          </Button>
        </div>
      </div>

      {/* Summary */}
      {filteredPayments.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-[11px] text-muted-foreground">মোট সংগৃহীত</p>
            <p className="text-sm font-bold">{formatBDT(totalCollected)}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-[11px] text-muted-foreground">ডেলিভারি বিল</p>
            <p className="text-sm font-bold">{formatBDT(totalDeliveryBill)}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-[11px] text-muted-foreground">COD চার্জ</p>
            <p className="text-sm font-bold">{formatBDT(totalCodCharge)}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-[11px] text-muted-foreground">মোট প্রাপ্য</p>
            <p className="text-sm font-bold text-green-600">{formatBDT(totalReceivable)}</p>
          </div>
          <div className="rounded-lg p-3 text-center border border-blue-200 bg-blue-50/50">
            <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1"><Landmark className="h-3 w-3" /> ব্যাংক</p>
            <p className="text-sm font-bold text-blue-600">{formatBDT(totalBankAmount)}</p>
          </div>
          <div className="rounded-lg p-3 text-center border border-emerald-200 bg-emerald-50/50">
            <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1"><Banknote className="h-3 w-3" /> ক্যাশ</p>
            <p className="text-sm font-bold text-emerald-600">{formatBDT(totalCashAmount)}</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : filteredPayments.length === 0 ? (
        <div className="text-center py-8 space-y-3">
          <p className="text-muted-foreground text-sm">কোনো পেমেন্ট রেকর্ড নেই</p>
          <p className="text-xs text-muted-foreground">বিল যোগ করুন বাটনে ক্লিক করে ম্যানুয়ালি এন্ট্রি দিন</p>
        </div>
      ) : (
        <>
        <div className="rounded-lg border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/70">
                <TableHead className="text-[11px] uppercase font-semibold w-10">#</TableHead>
                <TableHead className="text-[11px] uppercase font-semibold">কুরিয়ার</TableHead>
                <TableHead className="text-[11px] uppercase font-semibold">Date</TableHead>
                <TableHead className="text-[11px] uppercase font-semibold">Invoice</TableHead>
                <TableHead className="text-[11px] uppercase font-semibold text-right font-mono">Collected</TableHead>
                <TableHead className="text-[11px] uppercase font-semibold text-right font-mono">Delivery Bill</TableHead>
                <TableHead className="text-[11px] uppercase font-semibold text-right font-mono">COD Charge</TableHead>
                <TableHead className="text-[11px] uppercase font-semibold text-right font-mono">Receivable</TableHead>
                <TableHead className="text-[11px] uppercase font-semibold text-center">Status</TableHead>
                <TableHead className="text-[11px] uppercase font-semibold text-center">মেথড</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedPayments.map((p: any, idx: number) => (
                <TableRow key={p.id} className={`text-xs transition-colors hover:bg-primary/5 ${idx % 2 === 0 ? 'bg-muted/20' : ''}`}>
                  <TableCell className="text-muted-foreground font-medium">{(currentPage - 1) * GENERIC_PAGE_SIZE + idx + 1}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-violet-50 text-violet-700 border-violet-200">
                      {getCourierLabel(p.courier_provider)}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-[12px]">{formatDate(p.date)}</TableCell>
                  <TableCell className="font-mono font-medium text-[12px]">{p.invoice_number || '—'}</TableCell>
                  <TableCell className="text-right font-mono">{formatBDT(Number(p.collected_amount))}</TableCell>
                  <TableCell className="text-right font-mono">{formatBDT(Number(p.delivery_bill))}</TableCell>
                  <TableCell className="text-right font-mono">{formatBDT(Number(p.cod_charge))}</TableCell>
                  <TableCell className="text-right font-mono font-medium">{formatBDT(Number(p.receivable_amount))}</TableCell>
                  <TableCell className="text-center" onClick={e => e.stopPropagation()}>
                    {p.status === 'Paid' ? (
                      <Badge variant="outline" className="cursor-pointer text-[11px] px-3 py-0.5 rounded-full border font-semibold bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100" onClick={() => toggleToPending(p)}>
                        Paid
                      </Badge>
                    ) : (
                      <Popover open={methodPopover === `status-${p.id}`} onOpenChange={(open) => { setMethodPopover(open ? `status-${p.id}` : null); if (open) setSplitAmounts({ bank: '', cash: '' }); }}>
                        <PopoverTrigger asChild>
                          <Badge variant="outline" className="cursor-pointer text-[11px] px-3 py-0.5 rounded-full border font-semibold bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100">
                            Pending
                          </Badge>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-3" align="center">
                          <div className="space-y-2">
                            <p className="text-xs font-semibold">Paid মার্ক করুন — মেথড বাছুন</p>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" className="flex-1 h-8 text-xs gap-1 bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100" onClick={() => handleSetMethod(p, 'cash')}>
                                <Banknote className="h-3 w-3" /> Cash
                              </Button>
                              <Button size="sm" variant="outline" className="flex-1 h-8 text-xs gap-1 bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100" onClick={() => handleSetMethod(p, 'bank')}>
                                <Landmark className="h-3 w-3" /> Bank
                              </Button>
                            </div>
                            <div className="border-t pt-2 space-y-1.5">
                              <p className="text-[10px] text-muted-foreground font-medium">Split (ভাগ করুন)</p>
                              <div className="flex gap-1.5">
                                <Input placeholder="ব্যাংক" type="number" className="h-7 text-xs" value={splitAmounts.bank} onChange={e => setSplitAmounts(s => ({ ...s, bank: e.target.value }))} />
                                <Input placeholder="ক্যাশ" type="number" className="h-7 text-xs" value={splitAmounts.cash} onChange={e => setSplitAmounts(s => ({ ...s, cash: e.target.value }))} />
                              </div>
                              <Button size="sm" variant="default" className="w-full h-7 text-xs" onClick={() => handleSplitMethod(p)} disabled={!splitAmounts.bank && !splitAmounts.cash}>
                                সেভ
                              </Button>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                  </TableCell>
                  <TableCell className="text-center" onClick={e => e.stopPropagation()}>
                    <Popover open={methodPopover === p.id} onOpenChange={(open) => { setMethodPopover(open ? p.id : null); if (open) setSplitAmounts({ bank: '', cash: '' }); }}>
                      <PopoverTrigger asChild>
                        <button className="inline-flex items-center gap-1">
                          {p.receive_method === 'bank' ? (
                            <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 border-blue-300 cursor-pointer hover:bg-blue-100">
                              <Landmark className="h-3 w-3 mr-0.5" /> Bank {formatBDT(Number(p.bank_amount))}
                            </Badge>
                          ) : p.receive_method === 'cash' ? (
                            <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-700 border-emerald-300 cursor-pointer hover:bg-emerald-100">
                              <Banknote className="h-3 w-3 mr-0.5" /> Cash {formatBDT(Number(p.cash_amount))}
                            </Badge>
                          ) : p.receive_method === 'split' ? (
                            <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-purple-50 text-purple-700 border-purple-300 cursor-pointer hover:bg-purple-100">
                              Split <span className="ml-0.5">B:{formatBDT(Number(p.bank_amount))} C:{formatBDT(Number(p.cash_amount))}</span>
                            </Badge>
                          ) : p.status === 'Paid' ? (
                            <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-600 border-amber-300 cursor-pointer hover:bg-amber-100 animate-pulse">
                              সেট করুন
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-[10px]">—</span>
                          )}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-56 p-3" align="center">
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground">রিসিভ মেথড</p>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="flex-1 h-8 text-xs gap-1 bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100" onClick={() => handleSetMethod(p, 'cash')}>
                              <Banknote className="h-3 w-3" /> Cash
                            </Button>
                            <Button size="sm" variant="outline" className="flex-1 h-8 text-xs gap-1 bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100" onClick={() => handleSetMethod(p, 'bank')}>
                              <Landmark className="h-3 w-3" /> Bank
                            </Button>
                          </div>
                          <div className="border-t pt-2 space-y-1.5">
                            <p className="text-[10px] text-muted-foreground font-medium">Split (ভাগ করুন)</p>
                            <div className="flex gap-1.5">
                              <Input placeholder="ব্যাংক" type="number" className="h-7 text-xs" value={splitAmounts.bank} onChange={e => setSplitAmounts(s => ({ ...s, bank: e.target.value }))} />
                              <Input placeholder="ক্যাশ" type="number" className="h-7 text-xs" value={splitAmounts.cash} onChange={e => setSplitAmounts(s => ({ ...s, cash: e.target.value }))} />
                            </div>
                            <Button size="sm" variant="default" className="w-full h-7 text-xs" onClick={() => handleSplitMethod(p)} disabled={!splitAmounts.bank && !splitAmounts.cash}>
                              সেভ
                            </Button>
                          </div>
                          {p.receive_method && (
                            <div className="pt-1 border-t space-y-1.5">
                              <div className="text-[10px] text-muted-foreground">
                                {p.bank_amount > 0 && <span>ব্যাংক: {formatBDT(Number(p.bank_amount))} </span>}
                                {p.cash_amount > 0 && <span>ক্যাশ: {formatBDT(Number(p.cash_amount))}</span>}
                              </div>
                              <Button size="sm" variant="outline" className="w-full h-7 text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => updatePayment.mutate({ id: p.id, updates: { receive_method: null, bank_amount: 0, cash_amount: 0, status: 'Paid' } })}>
                                <XCircle className="h-3 w-3" /> মেথড সরান
                              </Button>
                            </div>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="bg-muted/60 font-semibold text-xs">
                <TableCell colSpan={4} className="text-right uppercase text-[11px] text-muted-foreground">মোট</TableCell>
                <TableCell className="text-right font-mono">{formatBDT(totalCollected)}</TableCell>
                <TableCell className="text-right font-mono">{formatBDT(totalDeliveryBill)}</TableCell>
                <TableCell className="text-right font-mono">{formatBDT(totalCodCharge)}</TableCell>
                <TableCell className="text-right font-mono font-bold">{formatBDT(totalReceivable)}</TableCell>
                <TableCell />
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1.5 pt-3">
            <Button size="sm" variant="outline" className="h-8 px-2 text-xs" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
              পূর্ববর্তী
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
              if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                return <Button key={page} size="sm" variant={page === currentPage ? 'default' : 'outline'} className="h-8 w-8 p-0 text-xs" onClick={() => setCurrentPage(page)}>{page}</Button>;
              }
              if (page === currentPage - 2 || page === currentPage + 2) return <span key={page} className="text-muted-foreground text-xs px-1">...</span>;
              return null;
            })}
            <Button size="sm" variant="outline" className="h-8 px-2 text-xs" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
              পরবর্তী
            </Button>
          </div>
        )}
        </>
      )}

      {/* Add Payment Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>নতুন কুরিয়ার বিল যোগ করুন</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">কুরিয়ার সার্ভিস</Label>
              <select
                className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                value={form.courier_provider}
                onChange={e => setForm(f => ({ ...f, courier_provider: e.target.value }))}
              >
                <option value="">— নির্বাচন করুন —</option>
                {OTHER_COURIERS.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
                <option value="__custom">✏️ কাস্টম নাম লিখুন</option>
              </select>
            </div>
            {form.courier_provider === '__custom' && (
              <div>
                <Label className="text-xs">কুরিয়ারের নাম</Label>
                <Input placeholder="যেমন: কুরিয়ারের নাম" value={customCourier} onChange={e => setCustomCourier(e.target.value)} />
              </div>
            )}
            <div>
              <Label className="text-xs">ইনভয়েস নম্বর</Label>
              <Input placeholder="INV-XXXXX" value={form.invoice_number} onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">তারিখ</Label>
              <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} onPaste={e => { const parsed = smartParseDate(e.clipboardData.getData('text')); if (parsed) { e.preventDefault(); setForm(f => ({ ...f, date: parsed })); } }} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">সংগৃহীত টাকা</Label>
                <Input type="number" value={form.collected_amount} onChange={e => setForm(f => ({ ...f, collected_amount: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">ডেলিভারি বিল</Label>
                <Input type="number" value={form.delivery_bill} onChange={e => setForm(f => ({ ...f, delivery_bill: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">COD চার্জ</Label>
                <Input type="number" value={form.cod_charge} onChange={e => setForm(f => ({ ...f, cod_charge: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">প্রাপ্য টাকা</Label>
                <Input type="number" value={form.receivable_amount} onChange={e => setForm(f => ({ ...f, receivable_amount: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>বাতিল</Button>
            <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending || (!form.courier_provider || (form.courier_provider === '__custom' && !customCourier.trim()))}>
              {addMutation.isPending ? 'সেভ হচ্ছে...' : 'সেভ করুন'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== Main Component ====================
export default function AdminCourierPanel() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Truck className="h-6 w-6" /> কুরিয়ার পেমেন্ট
      </h1>
      <Tabs defaultValue="steadfast" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="steadfast">Steadfast</TabsTrigger>
          <TabsTrigger value="pathao">Pathao</TabsTrigger>
          <TabsTrigger value="redx">RedX</TabsTrigger>
          <TabsTrigger value="other">অন্যান্য</TabsTrigger>
        </TabsList>
        <TabsContent value="steadfast">
          <PaymentSection />
        </TabsContent>
        <TabsContent value="pathao">
          <GenericCourierPaymentSection
            provider="pathao"
            portalUrl="https://merchant.pathao.com"
            portalLabel="Pathao পোর্টাল"
          />
        </TabsContent>
        <TabsContent value="redx">
          <GenericCourierPaymentSection
            provider="redx"
            portalUrl="https://merchant.redx.com.bd"
            portalLabel="RedX পোর্টাল"
          />
        </TabsContent>
        <TabsContent value="other">
          <OtherCourierPaymentSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
