import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Copy,
  Cpu,
  Crown,
  Database,
  ExternalLink,
  HardDrive,
  Lock,
  MessageCircle,
  Phone,
  Send,
  Wifi,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useCoreBilling } from '@/hooks/useCoreBilling';
import CoreAddonCard from '@/components/admin/CoreAddonCard';
import CoreAddonOffer from '@/components/admin/CoreAddonOffer';
import {
  coreAction,
  formatBnDate,
  formatTaka,
  type CoreInvoice,
  type CorePlan,
  type CoreStatus,
} from '@/lib/coreConnect';

// Billing & package: this site's monthly package and bills from CORE Automation
// (src/lib/coreConnect.ts). Bills, payments and package changes all live at CORE.

const STATE: Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  active: { label: 'সব বিল পরিশোধিত', className: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  due: { label: 'বিল বাকি', className: 'bg-amber-100 text-amber-700', icon: Clock },
  overdue: { label: 'শেষ তারিখ পার হয়েছে', className: 'bg-red-100 text-red-700', icon: AlertCircle },
  locked: { label: 'প্যানেল লক', className: 'bg-red-600 text-white', icon: Lock },
};

const INVOICE_STATE: Record<string, { label: string; className: string }> = {
  sent: { label: 'বাকি', className: 'bg-amber-100 text-amber-700' },
  overdue: { label: 'তারিখ পার', className: 'bg-red-100 text-red-700' },
  paid: { label: 'পরিশোধিত', className: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'বাতিল', className: 'bg-muted text-muted-foreground' },
};

const PAYMENT_STATE: Record<string, { label: string; className: string }> = {
  pending: { label: 'যাচাই হচ্ছে', className: 'bg-amber-100 text-amber-700' },
  approved: { label: 'গ্রহণ হয়েছে', className: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'বাতিল', className: 'bg-muted text-muted-foreground' },
};

const METHOD_LABEL: Record<string, string> = {
  bkash: 'bKash',
  nagad: 'Nagad',
  rocket: 'Rocket',
  bank: 'ব্যাংক',
  cash: 'ক্যাশ',
  other: 'অন্যান্য',
};

const copy = (text: string) => navigator.clipboard.writeText(text).then(() => toast.success('কপি হয়েছে'));

function Specs({ plan, dark }: { plan: CorePlan; dark?: boolean }) {
  const specs = [
    { icon: Database, label: 'RAM', value: plan.ram },
    { icon: Cpu, label: 'CPU', value: plan.cpu },
    { icon: HardDrive, label: 'স্টোরেজ', value: plan.storage },
    { icon: Wifi, label: 'ব্যান্ডউইথ', value: plan.bandwidth },
  ].filter((s) => s.value);
  if (specs.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-2">
      {specs.map((s) => (
        <div key={s.label} className={cn('flex items-center gap-2 rounded-xl px-3 py-2', dark ? 'bg-white/10' : 'bg-muted/60')}>
          <s.icon className={cn('h-4 w-4 shrink-0', dark ? 'text-lime-300' : 'text-primary')} />
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-bold">{s.value}</div>
            <div className={cn('text-[11px]', dark ? 'text-white/70' : 'text-muted-foreground')}>{s.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function PlanCard({ plan, onChoose, busy }: { plan: CorePlan; onChoose: () => void; busy: boolean }) {
  const dark = Boolean(plan.badge) && !plan.current;
  return (
    <div
      className={cn(
        'relative flex h-full flex-col rounded-2xl border p-5',
        plan.current
          ? 'border-primary bg-primary/5 ring-2 ring-primary'
          : dark
            ? 'border-transparent bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-xl'
            : 'bg-background',
      )}
    >
      {(plan.current || plan.badge) && (
        <span
          className={cn(
            'absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-0.5 text-[11px] font-bold',
            plan.current ? 'bg-primary text-primary-foreground' : 'bg-lime-300 text-slate-900',
          )}
        >
          {plan.current ? 'আপনার বর্তমান প্যাকেজ' : plan.badge}
        </span>
      )}
      <h3 className="text-lg font-bold">{plan.name}</h3>
      {plan.tagline && <p className={cn('text-xs', dark ? 'text-white/70' : 'text-muted-foreground')}>{plan.tagline}</p>}
      <div className="my-4 flex items-end gap-1">
        <span className={cn('text-3xl font-bold', dark && 'text-lime-300')}>{formatTaka(plan.price)}</span>
        <span className={cn('pb-1 text-sm', dark ? 'text-white/70' : 'text-muted-foreground')}>/মাস</span>
      </div>
      <Specs plan={plan} dark={dark} />
      {plan.features.length > 0 && (
        <ul className="mt-4 space-y-2 text-sm">
          {plan.features.map((f) => (
            <li key={f} className="flex items-start gap-2">
              <CheckCircle2 className={cn('mt-0.5 h-4 w-4 shrink-0', dark ? 'text-lime-300' : 'text-primary')} />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-auto pt-5">
        {plan.current ? (
          <Button variant="outline" className="w-full" disabled>
            বর্তমান প্যাকেজ
          </Button>
        ) : (
          <Button
            className={cn('w-full', dark && 'bg-lime-300 text-slate-900 hover:bg-lime-200')}
            variant={dark ? 'default' : 'outline'}
            disabled={busy}
            onClick={onChoose}
          >
            এই প্যাকেজ নিন
          </Button>
        )}
      </div>
    </div>
  );
}

function PayDialog({
  core,
  invoice,
  onClose,
}: {
  core: CoreStatus;
  invoice: CoreInvoice | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const methods = core.payment?.methods ?? [];
  const [method, setMethod] = useState(methods[0]?.method ?? (core.payment?.bank_details ? 'bank' : 'other'));
  const [trx, setTrx] = useState('');
  const [sender, setSender] = useState('');
  const [saving, setSaving] = useState(false);
  const number = methods.find((m) => m.method === method)?.number;

  const submit = async () => {
    if (!invoice) return;
    setSaving(true);
    try {
      await coreAction({
        action: 'pay',
        invoice_id: invoice.id,
        method,
        amount: invoice.amount,
        trx_id: trx.trim(),
        sender: sender.trim() || undefined,
      });
      toast.success('পেমেন্ট জমা হয়েছে। CORE যাচাই করলেই বিল পরিশোধিত হবে।');
      setTrx('');
      setSender('');
      onClose();
      queryClient.invalidateQueries({ queryKey: ['core-billing'] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(invoice)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>বিল পরিশোধ করুন</DialogTitle>
          <DialogDescription>
            {invoice?.number} · {invoice?.description}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl bg-muted/60 p-4 text-center">
          <div className="text-xs text-muted-foreground">পরিশোধ করতে হবে</div>
          <div className="text-3xl font-bold">{formatTaka(invoice?.amount)}</div>
        </div>

        <div className="space-y-4">
          <div>
            <Label>কীভাবে পাঠিয়েছেন</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {methods.map((m) => (
                  <SelectItem key={m.method} value={m.method}>
                    {m.label}
                  </SelectItem>
                ))}
                {core.payment?.bank_details && <SelectItem value="bank">ব্যাংক</SelectItem>}
                <SelectItem value="other">অন্যান্য</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {number && (
            <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
              <div>
                <div className="text-xs text-muted-foreground">{METHOD_LABEL[method]} নম্বরে Send Money করুন</div>
                <div className="font-mono text-lg font-bold">{number}</div>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => copy(number)}>
                <Copy className="mr-1 h-4 w-4" /> কপি
              </Button>
            </div>
          )}
          {method === 'bank' && core.payment?.bank_details && (
            <p className="whitespace-pre-line rounded-xl border p-3 text-sm">{core.payment.bank_details}</p>
          )}
          {core.payment?.instructions && (
            <p className="whitespace-pre-line text-xs text-muted-foreground">{core.payment.instructions}</p>
          )}

          <div>
            <Label htmlFor="core-trx">Transaction ID (TrxID)</Label>
            <Input id="core-trx" className="mt-1.5 font-mono" value={trx} onChange={(e) => setTrx(e.target.value)} placeholder="যেমন 8N7A6B5C4D" />
          </div>
          <div>
            <Label htmlFor="core-sender">যে নম্বর থেকে পাঠিয়েছেন (ঐচ্ছিক)</Label>
            <Input id="core-sender" className="mt-1.5" value={sender} onChange={(e) => setSender(e.target.value)} placeholder="01XXXXXXXXX" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            বাতিল
          </Button>
          <Button onClick={submit} disabled={saving || trx.trim().length < 4}>
            {saving ? 'জমা হচ্ছে…' : 'পেমেন্ট জমা দিন'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminBilling() {
  const queryClient = useQueryClient();
  const { data: core, isLoading, refetch, isFetching } = useCoreBilling();
  const [paying, setPaying] = useState<CoreInvoice | null>(null);
  const [choosing, setChoosing] = useState<CorePlan | null>(null);
  const [changing, setChanging] = useState(false);
  const [ticket, setTicket] = useState({ subject: '', description: '' });
  const [sendingTicket, setSendingTicket] = useState(false);

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
          <Crown className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">বিল ও প্যাকেজ</h1>
          <p className="text-sm text-muted-foreground">আপনার ওয়েবসাইটের মাসিক প্যাকেজ ও বিল · CORE Automation</p>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
        {isFetching ? 'লোড হচ্ছে…' : 'রিফ্রেশ'}
      </Button>
    </div>
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        {header}
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  if (!core?.connected) {
    return (
      <div className="space-y-6">
        {header}
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            এই ওয়েবসাইট এখনো CORE Automation-এর সাথে যুক্ত হয়নি। যুক্ত হলে এখানে আপনার প্যাকেজ ও বিল দেখাবে।
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!core.can_pay) {
    return (
      <div className="space-y-6">
        {header}
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">বিল ও প্যাকেজ শুধু অ্যাডমিন দেখতে পারবেন।</CardContent>
        </Card>
      </div>
    );
  }

  const billing = core.billing!;
  const state = STATE[billing.status] ?? STATE.active;
  const invoices = core.invoices ?? [];
  const openInvoices = invoices.filter((i) => i.status === 'sent' || i.status === 'overdue');
  const pastInvoices = invoices.filter((i) => i.status === 'paid');
  const payments = core.payments ?? [];
  const pendingFor = new Set(payments.filter((p) => p.status === 'pending').map((p) => p.invoice_id));
  const plans = core.plans ?? [];
  const addons = core.addons ?? [];
  const offers = (core.addon_offers ?? []).filter((o) => !o.running);
  const ordered = (name: string) =>
    (core.orders ?? []).some((o) => o.service_name === name && (o.status === 'new' || o.status === 'in_progress'));
  const support = core.support;
  const whatsapp = support?.whatsapp?.replace(/\D/g, '');
  const bn = (n: number) => n.toLocaleString('bn-BD');
  const dayOf = (date: string) => bn(Number(date.slice(8, 10)));
  const grace = bn(billing.grace_days ?? 3);
  const schedule =
    billing.next_bill_on && billing.next_renewal
      ? `প্রতি মাসের ${dayOf(billing.next_bill_on)} তারিখে বিল আসে, পরিশোধের শেষ তারিখ ${dayOf(billing.next_renewal)} তারিখ। এরপর আরও ${grace} দিন সময় থাকে, তারপর পরিশোধ না হলে অ্যাডমিন প্যানেল লক হয়ে যায়।`
      : `শেষ তারিখের পরে আরও ${grace} দিন সময় থাকে, তারপর পরিশোধ না হলে অ্যাডমিন প্যানেল লক হয়ে যায়।`;

  const changePlan = async () => {
    if (!choosing) return;
    setChanging(true);
    try {
      await coreAction({ action: 'plan', package_id: choosing.id });
      toast.success(`${choosing.name} প্যাকেজ নেওয়া হয়েছে। পরের বিল থেকে নতুন দাম হবে।`);
      setChoosing(null);
      queryClient.invalidateQueries({ queryKey: ['core-billing'] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setChanging(false);
    }
  };

  const sendTicket = async () => {
    setSendingTicket(true);
    try {
      const result = await coreAction<{ ticket_number: string }>({
        action: 'ticket',
        subject: ticket.subject.trim(),
        description: ticket.description.trim() || undefined,
      });
      toast.success(`পাঠানো হয়েছে। টিকেট নম্বর ${result.ticket_number}`);
      setTicket({ subject: '', description: '' });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSendingTicket(false);
    }
  };

  return (
    <div className="space-y-6">
      {header}

      {core.stale && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          এই মুহূর্তে CORE-এর সাথে যোগাযোগ হচ্ছে না, শেষ জানা তথ্য দেখানো হচ্ছে।
        </div>
      )}

      {/* Where the bill stands */}
      <Card className={cn(billing.status === 'locked' && 'border-red-300')}>
        <CardContent className="grid gap-6 p-6 md:grid-cols-3">
          <div>
            <div className="text-xs text-muted-foreground">অবস্থা</div>
            <Badge className={cn('mt-1.5 gap-1.5 px-3 py-1 text-sm hover:opacity-100', state.className)}>
              <state.icon className="h-4 w-4" /> {state.label}
            </Badge>
            {billing.status !== 'active' && billing.due_amount ? (
              <div className="mt-3">
                <div className="text-3xl font-bold">{formatTaka(billing.due_amount)}</div>
                <div className="text-xs text-muted-foreground">
                  {billing.next_due_date && <>শেষ তারিখ {formatBnDate(billing.next_due_date)}</>}
                  {billing.status !== 'locked' && billing.lock_date && <> · {formatBnDate(billing.lock_date)} লক হবে</>}
                </div>
              </div>
            ) : null}
          </div>
          <div>
            <div className="text-xs text-muted-foreground">আপনার প্যাকেজ</div>
            {core.plan ? (
              <>
                <div className="mt-1 text-xl font-bold">{core.plan.name}</div>
                <div className="text-sm text-muted-foreground">{formatTaka(core.plan.price)} / মাস</div>
              </>
            ) : (
              <div className="mt-1 text-sm text-muted-foreground">এখনো কোনো প্যাকেজ ঠিক করা হয়নি</div>
            )}
            {billing.addons_monthly ? (
              <div className="mt-2 text-xs text-muted-foreground">
                + সার্ভিস {formatTaka(billing.addons_monthly)} · মোট প্রতি মাসে{' '}
                <span className="font-semibold text-foreground">{formatTaka(billing.monthly_total)}</span>
              </div>
            ) : null}
          </div>
          <div>
            <div className="text-xs text-muted-foreground">পরের বিল</div>
            {billing.next_bill_on ? (
              <>
                <div className="mt-1 text-xl font-bold">{formatBnDate(billing.next_bill_on)}</div>
                {billing.next_renewal && (
                  <div className="text-sm text-muted-foreground">শেষ তারিখ {formatBnDate(billing.next_renewal)}</div>
                )}
              </>
            ) : (
              <div className="mt-1 text-sm text-muted-foreground">—</div>
            )}
          </div>
        </CardContent>
        <div className="border-t px-6 py-3 text-xs text-muted-foreground">
          {schedule}
        </div>
      </Card>

      {/* Bills to pay */}
      {openInvoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">পরিশোধ করতে হবে</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {openInvoices.map((inv) => (
              <div key={inv.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold">{inv.number}</span>
                    <Badge className={cn('hover:opacity-100', INVOICE_STATE[inv.status]?.className)}>
                      {INVOICE_STATE[inv.status]?.label}
                    </Badge>
                    {pendingFor.has(inv.id) && (
                      <Badge className={cn('hover:opacity-100', PAYMENT_STATE.pending.className)}>পেমেন্ট যাচাই হচ্ছে</Badge>
                    )}
                  </div>
                  <div className="mt-1 text-sm">{inv.description}</div>
                  {inv.items && inv.items.length > 1 && (
                    <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                      {inv.items.map((item, i) => (
                        <li key={i}>
                          {item.description}: {formatTaka(item.amount)}
                        </li>
                      ))}
                    </ul>
                  )}
                  {inv.due_date && <div className="text-xs text-muted-foreground">শেষ তারিখ {formatBnDate(inv.due_date)}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="mr-2 text-xl font-bold">{formatTaka(inv.amount)}</span>
                  <Button variant="outline" size="sm" asChild>
                    <a href={inv.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-1 h-4 w-4" /> দেখুন
                    </a>
                  </Button>
                  <Button size="sm" onClick={() => setPaying(inv)} disabled={pendingFor.has(inv.id)}>
                    পরিশোধ করুন
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Services on top of the package */}
      {addons.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold">আপনার সার্ভিস</h2>
          <div className="grid gap-6 xl:grid-cols-2">
            {addons.map((addon) => (
              <CoreAddonCard key={addon.id} addon={addon} />
            ))}
          </div>
        </div>
      )}

      {/* Services CORE offers on top of the package */}
      {offers.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold">আরও সার্ভিস</h2>
          {offers.map((offer) => (
            <CoreAddonOffer key={offer.id} offer={offer} ordered={ordered(offer.name)} onOrdered={() => refetch()} />
          ))}
        </div>
      )}

      {/* Packages */}
      {plans.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">প্যাকেজ</CardTitle>
            <p className="text-sm text-muted-foreground">যেকোনো সময় প্যাকেজ বদলাতে পারবেন। নতুন দাম পরের বিল থেকে ধরা হবে।</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-x-4 gap-y-8 pt-3 md:grid-cols-2 xl:grid-cols-3">
              {plans.map((plan) => (
                <PlanCard key={plan.id} plan={plan} busy={changing} onChoose={() => setChoosing(plan)} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">আগের বিল ও পেমেন্ট</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pastInvoices.length === 0 && payments.length === 0 && (
              <p className="text-sm text-muted-foreground">এখনো কিছু নেই।</p>
            )}
            {pastInvoices.map((inv) => (
              <a
                key={inv.id}
                href={inv.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm hover:bg-muted/60"
              >
                <span className="min-w-0 truncate">
                  <span className="font-mono text-xs">{inv.number}</span> · {inv.description}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {formatTaka(inv.amount)}
                  <Badge className={cn('hover:opacity-100', INVOICE_STATE.paid.className)}>পরিশোধিত</Badge>
                </span>
              </a>
            ))}
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 px-2 py-2 text-sm">
                <span className="min-w-0 truncate">
                  {formatTaka(p.amount)} · {METHOD_LABEL[p.method] ?? p.method} · <span className="font-mono text-xs">{p.trx_id}</span>
                  {p.status === 'rejected' && p.admin_note && <span className="text-muted-foreground"> · {p.admin_note}</span>}
                </span>
                <Badge className={cn('shrink-0 hover:opacity-100', PAYMENT_STATE[p.status]?.className)}>
                  {PAYMENT_STATE[p.status]?.label}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Help */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">সাহায্য দরকার?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {support && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a href={`tel:${support.phone}`}>
                    <Phone className="mr-1 h-4 w-4" /> {support.phone}
                  </a>
                </Button>
                {whatsapp && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="mr-1 h-4 w-4" /> WhatsApp
                    </a>
                  </Button>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Input
                value={ticket.subject}
                onChange={(e) => setTicket({ ...ticket, subject: e.target.value })}
                placeholder="সমস্যা বা দরকারটা এক লাইনে লিখুন"
              />
              <Textarea
                value={ticket.description}
                onChange={(e) => setTicket({ ...ticket, description: e.target.value })}
                placeholder="বিস্তারিত (ঐচ্ছিক)"
                rows={3}
              />
              <Button size="sm" onClick={sendTicket} disabled={sendingTicket || !ticket.subject.trim()}>
                <Send className="mr-1 h-4 w-4" /> {sendingTicket ? 'পাঠানো হচ্ছে…' : 'CORE-কে পাঠান'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <PayDialog core={core} invoice={paying} onClose={() => setPaying(null)} />

      <Dialog open={Boolean(choosing)} onOpenChange={(open) => !open && setChoosing(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{choosing?.name} প্যাকেজ নেবেন?</DialogTitle>
            <DialogDescription>
              পরের বিল থেকে প্রতি মাসে {formatTaka(choosing?.price)} হবে। এখনকার বাকি বিলের টাকা বদলাবে না।
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChoosing(null)}>
              না
            </Button>
            <Button onClick={changePlan} disabled={changing}>
              {changing ? 'হচ্ছে…' : 'হ্যাঁ, নেব'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
