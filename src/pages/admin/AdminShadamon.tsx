// Dropshipping: Shadamon Shop's products in this shop (admin → ড্রপশিপিং), the same page as
// the CORE Shop engine's. The shop picks the ones it likes and adds them, Shadamon's name in
// their text changed to the shop's. An order of them goes to Shadamon from the order's
// courier menu ("Shadamon"): Shadamon packs and delivers it, and the profit lands in the
// shop's Shadamon wallet, which is taken out here. Everything goes through the supplier
// edge function.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowDownToLine, BadgeCheck, Check, Clock, Download, Flame, Loader2, Minimize2, PackagePlus, PlayCircle, Search, Sparkles, TrendingUp, Truck, Wallet, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { bnText as trNow, callSupplier } from '@/lib/supplier';
import { SUPPLIER_PRODUCTS_KEY } from '@/components/admin/products/SupplierNote';
import { downloadImagesWithToast, productPhotos } from '@/lib/downloadImages';

interface CatalogProduct {
  id: string;
  name: string;
  name_bn: string | null;
  images: string[];
  category: { name: string; name_bn: string | null } | null;
  sizes: string[];
  price: number;
  compare_at_price: number | null;
  wholesale_price: number | null;
  profit: number | null;
  stock: number;
  allow_pre_order: boolean;
  on_sale: boolean;
  available: boolean;
  video_url?: string | null;
  /** from Shadamon (newer partner API): when it was added and pieces sold there */
  created_at?: string;
  sold?: number;
  /** the shop's copy, when it added the product */
  added: { id: string; is_active: boolean; price: number } | null;
}

interface Withdrawal {
  id: string;
  amount: number;
  method: string;
  account_number: string;
  status: 'pending' | 'paid' | 'rejected' | 'cancelled';
  transaction_id: string | null;
  requested_at: string;
}

interface Account {
  /** what the shop's open orders of these products will earn once delivered */
  pending_profit?: number;
  pending_orders?: number;
  wallet_balance: number;
  delivered_orders: number;
  orders_need_review: boolean;
  delivery_charges: Record<string, number>;
  withdrawals: Withdrawal[];
}

const CATALOG_KEY = ['shadamon', 'catalog'];
const ACCOUNT_KEY = ['shadamon', 'account'];
const money = (n: number) => `৳${Math.round(n).toLocaleString('en-IN')}`;
const PAYOUT: Record<string, { bn: string; en: string }> = {
  bkash: { bn: 'বিকাশ', en: 'bKash' }, nagad: { bn: 'নগদ', en: 'Nagad' }, bank: { bn: 'ব্যাংক', en: 'Bank' },
};
const WITHDRAWAL_STATUS: Record<Withdrawal['status'], { bn: string; en: string; tone: string }> = {
  pending: { bn: 'অপেক্ষায়', en: 'Waiting', tone: 'bg-amber-100 text-amber-800' },
  paid: { bn: 'পাঠানো হয়েছে', en: 'Paid', tone: 'bg-green-100 text-green-800' },
  rejected: { bn: 'বাতিল', en: 'Rejected', tone: 'bg-red-100 text-red-700' },
  cancelled: { bn: 'বাতিল', en: 'Cancelled', tone: 'bg-muted text-muted-foreground' },
};

type Filter = 'all' | 'new' | 'added';
type Sort = 'newest' | 'profit' | 'trending' | 'best';

const DAY = 86_400_000;
const ageDays = (p: CatalogProduct) => (p.created_at ? (Date.now() - new Date(p.created_at).getTime()) / DAY : 365);
const profitOf = (p: CatalogProduct) => (p.wholesale_price ? (p.added ? p.added.price : p.price) - p.wholesale_price : p.profit ?? 0);
/** sells fast for its age: pieces sold per day since it came */
const heat = (p: CatalogProduct) => (p.sold ?? 0) / Math.max(ageDays(p), 3);
const bn = (n: number) => n.toLocaleString('bn-BD');

/** Shadamon-branded header: what dropshipping is, in three short steps. */
function Hero() {
  const steps = [
    { icon: PackagePlus, bn: 'যোগ করুন', en: 'Add' },
    { icon: Truck, bn: 'Shadamon পাঠাবে', en: 'Shadamon ships' },
    { icon: Wallet, bn: 'লাভ নিন', en: 'Take the profit' },
  ];
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0b5fa5] via-[#0e7cc7] to-[#18a957] p-5 text-white shadow-[0_18px_40px_-18px_rgba(14,124,199,0.7)]">
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-14 left-10 h-36 w-36 rounded-full bg-[#ffd400]/20 blur-2xl" />
      <div className="relative flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-2xl font-black text-[#0b5fa5] shadow-lg">S</span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/75">Shadamon Shop × {trNow('আপনার দোকান', 'your shop')}</p>
          <h1 className="text-xl font-extrabold leading-tight sm:text-2xl">{trNow('ড্রপশিপিং', 'Dropshipping')}</h1>
        </div>
      </div>
      <p className="relative mt-2 text-sm text-white/85">{trNow('মাল কিনতে হবে না, প্যাকিং-ডেলিভারিও না।', 'No stock, no packing, no delivery.')}</p>
      <div className="relative mt-3 flex flex-wrap gap-1.5">
        {steps.map((s, i) => (
          <span key={s.en} className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold backdrop-blur">
            <s.icon className="h-3.5 w-3.5" /> {bn(i + 1)}. {trNow(s.bn, s.en)}
          </span>
        ))}
      </div>
    </div>
  );
}

/** The wallet (profit already earned) and what the open orders will bring. */
function Money({ account, onWithdraw }: { account: Account | undefined; onWithdraw: () => void }) {
  if (!account) return <div className="h-28 animate-pulse rounded-2xl bg-muted" />;
  const pending = account.withdrawals.find((w) => w.status === 'pending');
  const latest = account.withdrawals[0];
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl border bg-gradient-to-br from-emerald-500/15 to-transparent p-3.5">
          <p className="flex items-center gap-1 text-xs font-semibold text-muted-foreground"><Wallet className="h-3.5 w-3.5" /> {trNow('ওয়ালেটে লাভ', 'In your wallet')}</p>
          <p className="mt-1 text-2xl font-extrabold">{money(account.wallet_balance)}</p>
          <Button size="sm" onClick={onWithdraw} disabled={account.wallet_balance < 1 || !!pending} className="mt-2 h-8 w-full gap-1.5">
            <ArrowDownToLine className="h-3.5 w-3.5" /> {pending ? trNow('অনুরোধ অপেক্ষায়', 'Request waiting') : trNow('টাকা তুলুন', 'Withdraw')}
          </Button>
        </div>
        <div className="rounded-2xl border bg-gradient-to-br from-amber-500/15 to-transparent p-3.5">
          <p className="flex items-center gap-1 text-xs font-semibold text-muted-foreground"><Clock className="h-3.5 w-3.5" /> {trNow('আসন্ন লাভ', 'Coming profit')}</p>
          <p className="mt-1 text-2xl font-extrabold text-amber-600">{money(account.pending_profit ?? 0)}</p>
          <p className="mt-2 text-[11px] leading-tight text-muted-foreground">
            {trNow(`${bn(account.pending_orders ?? 0)}টি অর্ডার পথে · ${bn(account.delivered_orders)}টি ডেলিভারি হয়েছে`, `${account.pending_orders ?? 0} orders on the way · ${account.delivered_orders} delivered`)}
          </p>
        </div>
      </div>
      {account.orders_need_review && (
        <p className="flex items-start gap-2 rounded-xl bg-sky-50 p-2.5 text-xs text-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
          <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" />
          {trNow(`প্রথম ৫টি অর্ডার Shadamon ফোনে কনফার্ম করবে (${bn(account.delivered_orders)}/৫)।`, `Shadamon confirms your first 5 orders by phone (${account.delivered_orders}/5).`)}
        </p>
      )}
      {latest && (
        <p className="flex flex-wrap items-center gap-2 px-1 text-[11px] text-muted-foreground">
          {trNow('শেষ উত্তোলন:', 'Last withdrawal:')} {money(latest.amount)} · {trNow(PAYOUT[latest.method]?.bn ?? latest.method, PAYOUT[latest.method]?.en ?? latest.method)}
          <span className={cn('rounded-full px-2 py-0.5 font-medium', WITHDRAWAL_STATUS[latest.status].tone)}>
            {trNow(WITHDRAWAL_STATUS[latest.status].bn, WITHDRAWAL_STATUS[latest.status].en)}
          </span>
        </p>
      )}
    </div>
  );
}

function WithdrawDialog({ open, onOpenChange, balance }: { open: boolean; onOpenChange: (v: boolean) => void; balance: number }) {
  const qc = useQueryClient();
  const [method, setMethod] = useState<'bkash' | 'nagad' | 'bank'>('bkash');
  const [amount, setAmount] = useState('');
  const [account, setAccount] = useState('');
  const [accountName, setAccountName] = useState('');
  const [bankName, setBankName] = useState('');
  const [branch, setBranch] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Math.floor(Number(amount));
    if (!(n > 0) || n > balance) return toast.error(trNow(`১ থেকে ${money(balance)} এর মধ্যে লিখুন`, `Enter 1 to ${money(balance)}`));
    setSending(true);
    try {
      await callSupplier('withdraw', {
        amount: n, method, account_number: account,
        account_name: method === 'bank' ? accountName : undefined,
        bank_name: method === 'bank' ? bankName : undefined,
        branch_name: method === 'bank' ? branch : undefined,
      });
      toast.success(trNow('অনুরোধ পাঠানো হয়েছে — Shadamon টাকা পাঠালে এখানে দেখাবে।', 'Request sent — it shows here once Shadamon pays.'));
      qc.invalidateQueries({ queryKey: ACCOUNT_KEY });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : trNow('পাঠানো যায়নি', 'Could not send'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{trNow('Shadamon ওয়ালেট থেকে টাকা তুলুন', 'Withdraw from the Shadamon wallet')}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {(['bkash', 'nagad', 'bank'] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMethod(m)}
                className={cn('h-11 rounded-lg border text-sm font-semibold', method === m ? 'border-primary bg-primary/10 text-primary' : 'border-border')}>
                {trNow(PAYOUT[m].bn, PAYOUT[m].en)}
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sdm-amount">{trNow('কত টাকা', 'Amount')} ({trNow('আছে', 'available')} {money(balance)})</Label>
            <Input id="sdm-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sdm-account">{method === 'bank' ? trNow('অ্যাকাউন্ট নম্বর', 'Account number') : trNow(`${PAYOUT[method].bn} নম্বর`, `${PAYOUT[method].en} number`)}</Label>
            <Input id="sdm-account" inputMode={method === 'bank' ? 'text' : 'tel'} value={account} onChange={(e) => setAccount(e.target.value)} placeholder={method === 'bank' ? '' : '01XXXXXXXXX'} className="h-11" />
          </div>
          {method === 'bank' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="sdm-acname">{trNow('অ্যাকাউন্টের নাম', 'Account name')}</Label><Input id="sdm-acname" value={accountName} onChange={(e) => setAccountName(e.target.value)} className="h-11" /></div>
              <div className="space-y-1.5"><Label htmlFor="sdm-bank">{trNow('ব্যাংকের নাম', 'Bank')}</Label><Input id="sdm-bank" value={bankName} onChange={(e) => setBankName(e.target.value)} className="h-11" /></div>
              <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="sdm-branch">{trNow('শাখা (ঐচ্ছিক)', 'Branch (optional)')}</Label><Input id="sdm-branch" value={branch} onChange={(e) => setBranch(e.target.value)} className="h-11" /></div>
            </div>
          )}
          <Button type="submit" disabled={sending} className="h-11 w-full">
            {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {trNow('অনুরোধ পাঠান', 'Send request')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProductCard({ p, selected, onToggle, onAdd, adding, hot }: {
  p: CatalogProduct; selected: boolean; onToggle: () => void; onAdd: () => void; adding: boolean; hot: boolean;
}) {
  const fresh = ageDays(p) <= 7;
  const name = p.name_bn || p.name;
  const sellsFor = p.added ? p.added.price : p.price;
  const profit = p.wholesale_price ? sellsFor - p.wholesale_price : p.profit;
  const canAdd = !p.added && p.on_sale;
  const [saving, setSaving] = useState(false);
  const photos = productPhotos(p.images).length;
  const savePhotos = async () => {
    setSaving(true);
    try { await downloadImagesWithToast(productPhotos(p.images), p.name); } finally { setSaving(false); }
  };
  return (
    <div className={cn('flex flex-col overflow-hidden rounded-xl border bg-card transition-shadow', selected && 'ring-2 ring-primary')}>
      <div className="relative aspect-square bg-muted">
        {p.images[0] ? <img src={p.images[0]} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
        {canAdd && (
          <label className="absolute left-2 top-2 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-background/90 shadow">
            <Checkbox checked={selected} onCheckedChange={onToggle} aria-label={trNow('বাছাই করুন', 'Select')} />
          </label>
        )}
        {p.added && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-green-600 px-2 py-0.5 text-[11px] font-semibold text-white">
            <Check className="h-3 w-3" /> {trNow('যোগ হয়েছে', 'Added')}
          </span>
        )}
        {!p.available && (
          <span className="absolute bottom-2 left-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-white">
            {p.on_sale ? trNow('স্টক শেষ', 'Out of stock') : trNow('বন্ধ', 'Off')}
          </span>
        )}
        <div className="absolute right-2 top-2 flex flex-col items-end gap-1">
          {hot && <span className="inline-flex items-center gap-0.5 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 px-2 py-0.5 text-[10px] font-bold text-white shadow"><Flame className="h-3 w-3" /> {trNow('ট্রেন্ডিং', 'Trending')}</span>}
          {fresh && <span className="rounded-full bg-sky-500 px-2 py-0.5 text-[10px] font-bold text-white shadow">{trNow('নতুন', 'New')}</span>}
        </div>
        {p.video_url && <PlayCircle className="absolute bottom-2 right-2 h-6 w-6 text-white drop-shadow" aria-label={trNow('ভিডিও আছে', 'Has video')} />}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-2.5 sm:p-3">
        <p className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-tight">{name}</p>
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted/60 p-1.5 text-center text-[11px] leading-tight">
          <div>
            <p className="text-muted-foreground">{trNow('বিক্রয়', 'Sell')}</p>
            <p className="font-bold">{money(sellsFor)}</p>
            {!p.added && p.compare_at_price ? <p className="text-[10px] text-muted-foreground line-through">{money(p.compare_at_price)}</p> : null}
          </div>
          <div>
            <p className="text-muted-foreground">{trNow('পাইকারি', 'Wholesale')}</p>
            <p className="font-bold">{p.wholesale_price ? money(p.wholesale_price) : '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{trNow('লাভ', 'Profit')}</p>
            <p className="font-bold text-green-600">{profit != null ? money(profit) : '—'}</p>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {(p.sold ?? 0) > 0 && <span className="font-semibold text-foreground">{trNow(`${bn(p.sold!)} পিস বিক্রি`, `${p.sold} sold`)} · </span>}
          {p.stock > 0 ? trNow(`স্টক ${p.stock.toLocaleString('bn-BD')}`, `${p.stock} in stock`) : p.allow_pre_order ? trNow('প্রি-অর্ডার', 'Pre-order') : trNow('স্টক নেই', 'No stock')}
          {p.sizes?.length ? ` · ${p.sizes.slice(0, 4).join(', ')}${p.sizes.length > 4 ? '…' : ''}` : ''}
        </p>
        <div className="mt-auto flex gap-1.5">
          {photos > 0 && (
            <Button size="sm" variant="outline" className="h-9 shrink-0 gap-1 px-2.5" disabled={saving} onClick={savePhotos}
              title={trNow('সব ছবি ডাউনলোড করুন', 'Download all photos')} aria-label={trNow('সব ছবি ডাউনলোড করুন', 'Download all photos')}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              <span className="text-xs">{trNow(bn(photos), String(photos))}</span>
            </Button>
          )}
          {p.added ? (
            <Button asChild size="sm" variant="outline" className="h-9 min-w-0 flex-1">
              <Link to={`/admin/products/edit/${p.added.id}`}>{trNow('দাম বদলান / দেখুন', 'Edit price / view')}</Link>
            </Button>
          ) : (
            <Button size="sm" className="h-9 min-w-0 flex-1" disabled={!canAdd || adding} onClick={onAdd}>
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackagePlus className="h-4 w-4" />} {trNow('যোগ করুন', 'Add')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

type Job = { id: string; name: string; image?: string; status: 'wait' | 'doing' | 'done' | 'fail'; error?: string };

// The products still to add are kept on this phone, so a refresh (or the app closing) carries
// on where it stopped; adding one twice does nothing (the server keeps the first).
const jobsKey = () => 'shadamon-add';
function savedJobs(): Job[] {
  try {
    const list = JSON.parse(localStorage.getItem(jobsKey()) || '[]');
    return Array.isArray(list)
      ? list.filter((j) => j && typeof j.id === 'string').map((j): Job => ({ ...j, status: j.status === 'doing' ? 'wait' : j.status }))
      : [];
  } catch {
    return [];
  }
}
function saveJobs(jobs: Job[]) {
  try {
    if (jobs.some((j) => j.status === 'wait' || j.status === 'doing')) localStorage.setItem(jobsKey(), JSON.stringify(jobs));
    else localStorage.removeItem(jobsKey());
  } catch { /* private mode: this visit only */ }
}

/**
 * Adding products: one at a time (two quick taps never race), with a progress card that
 * shows each product and can be made small while it carries on.
 */
function AddProgress({ jobs, small, onSmall, onClose }: { jobs: Job[]; small: boolean; onSmall: (v: boolean) => void; onClose: () => void }) {
  if (!jobs.length) return null;
  const done = jobs.filter((j) => j.status === 'done' || j.status === 'fail').length;
  const failed = jobs.filter((j) => j.status === 'fail').length;
  const finished = done === jobs.length;
  const pct = Math.round((done / jobs.length) * 100);
  if (small) {
    return (
      <button type="button" onClick={() => onSmall(false)}
        className="fixed bottom-24 right-4 z-40 flex items-center gap-2 rounded-full border bg-background/95 py-1.5 pl-1.5 pr-3.5 text-xs font-bold shadow-xl backdrop-blur md:bottom-6">
        <span className="relative flex h-8 w-8 items-center justify-center">
          <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90"><circle cx="18" cy="18" r="15" fill="none" className="stroke-muted" strokeWidth="4" />
            <circle cx="18" cy="18" r="15" fill="none" className="stroke-primary transition-all duration-500" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${pct * 0.94} 100`} /></svg>
          {finished ? <Check className="h-4 w-4 text-emerald-600" /> : <PackagePlus className="h-3.5 w-3.5 text-primary" />}
        </span>
        {bn(done)}/{bn(jobs.length)}
      </button>
    );
  }
  return (
    <div className="fixed inset-x-3 bottom-24 z-40 mx-auto max-w-md overflow-hidden rounded-3xl border bg-background/95 shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-6 fade-in duration-300 md:bottom-6">
      <div className="h-1 bg-muted"><div className="h-full bg-gradient-to-r from-[#0e7cc7] to-[#18a957] transition-all duration-500" style={{ width: `${pct}%` }} /></div>
      <div className="flex items-center gap-2 px-4 pb-2 pt-3">
        <p className="flex-1 text-sm font-bold">
          {finished
            ? trNow(`${bn(jobs.length - failed)}টি পণ্য যোগ হয়েছে${failed ? `, ${bn(failed)}টি হয়নি` : ''} ✨`, `${jobs.length - failed} added${failed ? `, ${failed} failed` : ''} ✨`)
            : trNow(`পণ্য যোগ হচ্ছে… ${bn(done)}/${bn(jobs.length)}`, `Adding products… ${done}/${jobs.length}`)}
        </p>
        {!finished && <button type="button" onClick={() => onSmall(true)} aria-label={trNow('ছোট করুন', 'Minimise')} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"><Minimize2 className="h-4 w-4" /></button>}
        {finished && <button type="button" onClick={onClose} aria-label={trNow('বন্ধ', 'Close')} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>}
      </div>
      <ol className="max-h-56 space-y-1.5 overflow-y-auto px-4 pb-4">
        {jobs.map((j) => (
          <li key={j.id} className={cn('flex items-center gap-2.5 rounded-xl p-1.5 transition-colors', j.status === 'doing' && 'bg-primary/5')}>
            {j.image ? <img src={j.image} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" /> : <span className="h-9 w-9 shrink-0 rounded-lg bg-muted" />}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold">{j.name}</span>
              {j.status === 'fail' && <span className="block truncate text-[10px] text-destructive">{j.error}</span>}
              {j.status === 'doing' && <span className="block text-[10px] text-primary">{trNow('যোগ হচ্ছে…', 'Adding…')}</span>}
            </span>
            {j.status === 'wait' && <Clock className="h-4 w-4 text-muted-foreground/60" />}
            {j.status === 'doing' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
            {j.status === 'done' && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white animate-in zoom-in-50"><Check className="h-3 w-3" strokeWidth={3} /></span>}
            {j.status === 'fail' && <X className="h-4 w-4 text-destructive" />}
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function AdminShadamon() {
  const qc = useQueryClient();
  const catalog = useQuery({
    queryKey: CATALOG_KEY,
    queryFn: () => callSupplier<{ products: CatalogProduct[] }>('catalog'),
    staleTime: 60_000,
    retry: false,
  });
  const account = useQuery({
    queryKey: ACCOUNT_KEY,
    queryFn: () => callSupplier<Account>('account'),
    enabled: catalog.isSuccess,
    staleTime: 60_000,
  });
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('newest');
  const [category, setCategory] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [jobs, setJobs] = useState<Job[]>(savedJobs);
  const [small, setSmall] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const running = useRef(false);

  const products = useMemo(() => catalog.data?.products ?? [], [catalog.data]);
  const categories = useMemo(() => {
    const names = new Map<string, string>();
    for (const p of products) if (p.category) names.set(p.category.name, p.category.name_bn || p.category.name);
    return [...names.entries()];
  }, [products]);
  // the hottest tenth of what sells: "trending"
  const hotIds = useMemo(() => {
    const sold = products.filter((p) => (p.sold ?? 0) > 0).sort((a, b) => heat(b) - heat(a));
    return new Set(sold.slice(0, Math.max(3, Math.ceil(sold.length / 10))).map((p) => p.id));
  }, [products]);
  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = products.filter((p) =>
      (filter === 'all' || (filter === 'added' ? !!p.added : !p.added)) &&
      (!category || p.category?.name === category) &&
      (!needle || `${p.name} ${p.name_bn ?? ''}`.toLowerCase().includes(needle)));
    const by: Record<Sort, (a: CatalogProduct, b: CatalogProduct) => number> = {
      newest: (a, b) => ageDays(a) - ageDays(b),
      profit: (a, b) => profitOf(b) - profitOf(a),
      trending: (a, b) => heat(b) - heat(a),
      best: (a, b) => (b.sold ?? 0) - (a.sold ?? 0),
    };
    // what can be sold now first
    return [...list].sort((a, b) => Number(b.available) - Number(a.available) || by[sort](a, b));
  }, [products, q, filter, category, sort]);
  const addedCount = products.filter((p) => p.added).length;
  const busyIds = useMemo(() => new Set(jobs.filter((j) => j.status === 'wait' || j.status === 'doing').map((j) => j.id)), [jobs]);

  const add = (ids: string[]) => {
    const fresh = ids.filter((id) => !jobs.some((j) => j.id === id && (j.status === 'wait' || j.status === 'doing')));
    if (!fresh.length) return;
    const finishedBefore = jobs.length > 0 && jobs.every((j) => j.status === 'done' || j.status === 'fail');
    const next = fresh.map((id): Job => {
      const p = products.find((x) => x.id === id);
      return { id, name: p ? p.name_bn || p.name : id, image: p?.images[0], status: 'wait' };
    });
    setJobs((js) => [...(finishedBefore ? [] : js), ...next]);
    setSelected(new Set());
  };

  useEffect(() => saveJobs(jobs), [jobs]);

  // one product at a time
  useEffect(() => {
    if (running.current) return;
    const job = jobs.find((j) => j.status === 'wait');
    if (!job) {
      if (jobs.length && jobs.every((j) => j.status === 'done' || j.status === 'fail')) {
        qc.invalidateQueries({ queryKey: CATALOG_KEY });
        qc.invalidateQueries({ queryKey: SUPPLIER_PRODUCTS_KEY });
        qc.invalidateQueries({ queryKey: ['admin-products'] });
        const t = window.setTimeout(() => { setJobs((js) => (js.every((j) => j.status === 'done') ? [] : js)); setSmall(false); }, 5000);
        return () => window.clearTimeout(t);
      }
      return;
    }
    running.current = true;
    setJobs((js) => js.map((j) => (j.id === job.id ? { ...j, status: 'doing' } : j)));
    callSupplier<{ results: { id: string; success: boolean; error?: string }[] }>('import', { product_ids: [job.id] })
      .then((res) => {
        const r = res.results?.[0];
        setJobs((js) => js.map((j) => (j.id === job.id ? { ...j, status: r?.success ? 'done' : 'fail', error: r?.error } : j)));
      })
      .catch((err) => setJobs((js) => js.map((j) => (j.id === job.id ? { ...j, status: 'fail', error: err instanceof Error ? err.message : '' } : j))))
      .finally(() => { running.current = false; setJobs((js) => [...js]); });
  }, [jobs, qc]);

  const toggle = (id: string) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-28">
      <Hero />

      {catalog.isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-muted" />)}
        </div>
      ) : catalog.isError ? (
        <Card><CardContent className="space-y-3 py-8 text-center">
          <p className="text-sm">{catalog.error instanceof Error ? catalog.error.message : trNow('Shadamon-এর পণ্য আনা যায়নি', "Could not load Shadamon's products")}</p>
          <Button variant="outline" onClick={() => catalog.refetch()}>{trNow('আবার চেষ্টা করুন', 'Try again')}</Button>
        </CardContent></Card>
      ) : (
        <>
          <Money account={account.data} onWithdraw={() => setWithdrawOpen(true)} />

          <div className="space-y-2.5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={trNow('পণ্য খুঁজুন', 'Search products')} className="h-11 rounded-xl pl-9" />
            </div>
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
              {([
                ['newest', Sparkles, trNow('নতুন', 'New')],
                ['profit', Wallet, trNow('বেশি লাভ', 'Most profit')],
                ['trending', Flame, trNow('ট্রেন্ডিং', 'Trending')],
                ['best', TrendingUp, trNow('বেশি বিক্রি', 'Best selling')],
              ] as [Sort, typeof Flame, string][]).map(([key, Icon, label]) => (
                <button key={key} type="button" onClick={() => setSort(key)}
                  className={cn('flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-bold transition-all',
                    sort === key ? 'border-transparent bg-gradient-to-r from-[#0e7cc7] to-[#18a957] text-white shadow-md' : 'bg-card text-muted-foreground')}>
                  <Icon className="h-3.5 w-3.5" /> {label}
                </button>
              ))}
            </div>
            <div className="flex gap-1 rounded-xl bg-muted p-1">
              {([
                ['all', trNow(`সব (${bn(products.length)})`, `All (${products.length})`)],
                ['new', trNow('যোগ হয়নি', 'Not added')],
                ['added', trNow(`যোগ হয়েছে (${bn(addedCount)})`, `Added (${addedCount})`)],
              ] as [Filter, string][]).map(([key, label]) => (
                <button key={key} type="button" onClick={() => setFilter(key)}
                  className={cn('flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold', filter === key ? 'bg-background shadow-sm' : 'text-muted-foreground')}>
                  {label}
                </button>
              ))}
            </div>
            {categories.length > 1 && (
              <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
                {[['', trNow('সব ক্যাটাগরি', 'All categories')], ...categories].map(([key, label]) => (
                  <button key={key || 'all'} type="button" onClick={() => setCategory(key)}
                    className={cn('shrink-0 rounded-full border px-3 py-1 text-xs font-medium', category === key ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card')}>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {visible.length === 0 ? (
            <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">{trNow('কোনো পণ্য পাওয়া যায়নি', 'No products found')}</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {visible.map((p) => (
                <ProductCard key={p.id} p={p} hot={hotIds.has(p.id)} selected={selected.has(p.id)} onToggle={() => toggle(p.id)} onAdd={() => add([p.id])} adding={busyIds.has(p.id)} />
              ))}
            </div>
          )}
        </>
      )}

      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-20 z-40 px-4 md:bottom-6">
          <div className="mx-auto flex max-w-md items-center gap-2 rounded-2xl border bg-background p-2 shadow-xl">
            <p className="flex-1 pl-2 text-sm font-semibold">{trNow(`${bn(selected.size)}টি বাছাই করা`, `${selected.size} selected`)}</p>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>{trNow('বাদ দিন', 'Clear')}</Button>
            <Button size="sm" onClick={() => add([...selected])} className="gap-1">
              <PackagePlus className="h-4 w-4" /> {trNow('সব যোগ করুন', 'Add all')}
            </Button>
          </div>
        </div>
      )}

      <AddProgress jobs={jobs} small={small} onSmall={setSmall} onClose={() => { setJobs([]); setSmall(false); }} />

      <WithdrawDialog open={withdrawOpen} onOpenChange={setWithdrawOpen} balance={account.data?.wallet_balance ?? 0} />
    </div>
  );
}
