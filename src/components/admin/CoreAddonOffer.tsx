import { useState } from 'react';
import { toast } from 'sonner';
import { Check, CheckCircle2, Clock, Lock, Music, PhoneCall, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { coreAction, formatTaka, type CoreAddonOffer, type CoreAddonPrice } from '@/lib/coreConnect';

const toBn = (s: string) => s.replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)]);

/** "+8809617888821" in a price note → "+৮৮০ ৯৬১৭ ৮৮৮৮২১", repeated digits lit up. */
function ExampleNumber({ note, light }: { note: string | null; light: boolean }) {
  const raw = note?.match(/\+?\d[\d\s-]{8,}\d/)?.[0].replace(/[\s-]/g, '');
  if (!raw) return null;
  const m = raw.match(/^(\+?880)(\d{4})(\d{6})$/);
  const parts = m ? [m[1], m[2], m[3]] : [raw];
  const last = parts[parts.length - 1];
  const lit = new Set([...last.matchAll(/(\d)\1{2,}/g)].flatMap((r) => Array.from({ length: r[0].length }, (_, i) => r.index! + i)));
  return (
    <div className="mt-2 font-mono text-base font-bold tracking-wide">
      <span className={cn('mr-1.5 font-sans text-[11px] font-normal', light ? 'text-white/60' : 'text-muted-foreground')}>যেমন</span>
      {parts.slice(0, -1).map((p) => (
        <span key={p}>{toBn(p)} </span>
      ))}
      {[...last].map((d, i) => (
        <span key={i} className={lit.has(i) ? (light ? 'text-teal-300' : 'text-teal-600') : undefined}>
          {toBn(d)}
        </span>
      ))}
    </div>
  );
}

function Tick({ on, locked }: { on: boolean; locked?: boolean }) {
  return (
    <span
      className={cn(
        'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2',
        on ? (locked ? 'border-slate-900 bg-slate-900 text-teal-300' : 'border-teal-600 bg-teal-600 text-white') : 'border-muted-foreground/30',
      )}
    >
      {on && (locked ? <Lock className="h-3 w-3" /> : <Check className="h-3.5 w-3.5" />)}
    </span>
  );
}

/**
 * A service CORE offers on top of the package (e.g. IP Number & SMS Service): a card, and
 * the order form — a plan, one number (required), the required charges ticked and locked,
 * optional extras — sent to CORE, which calls back to set it up.
 */
export default function CoreAddonOffer({
  offer,
  ordered,
  onOrdered,
}: {
  offer: CoreAddonOffer;
  ordered: boolean;
  onOrdered: () => void;
}) {
  const [open, setOpen] = useState(false);
  const popular = offer.plans.find((p) => p.popular) ?? offer.plans[0];
  const [planId, setPlanId] = useState(popular?.id ?? '');
  const [setupId, setSetupId] = useState(offer.setups[0]?.id ?? '');
  const [extraIds, setExtraIds] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  const plan = offer.plans.find((p) => p.id === planId);
  const picked: CoreAddonPrice[] = [
    ...offer.fees,
    ...offer.setups.filter((s) => s.id === setupId),
    ...offer.extras.filter((e) => extraIds.includes(e.id)),
  ];
  const once = picked.reduce((sum, p) => sum + Number(p.price), 0);
  const from = offer.plans.length > 0 ? Math.min(...offer.plans.map((p) => Number(p.price))) : null;
  const shared = [
    ...offer.rates.map((r) => `${r.label}: ${formatTaka(r.price)}${r.unit ?? ''}${r.note ? ` (${r.note})` : ''}`),
    ...offer.features,
  ];

  const send = async () => {
    setSending(true);
    try {
      await coreAction({ action: 'addon', service_id: offer.id, plan_id: planId || null, setup_id: setupId || null, extra_ids: extraIds, note: note.trim() || undefined });
      toast.success('অর্ডার পাঠানো হয়েছে। CORE শিগগিরই আপনার সাথে যোগাযোগ করবে।');
      setOpen(false);
      onOrdered();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-teal-900 p-6 text-white shadow-lg">
        <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-teal-400/10" />
        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div className="flex min-w-0 max-w-xl items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10">
              <PhoneCall className="h-5 w-5 text-teal-300" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-bold">{offer.name}</h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-teal-400/20 px-2 py-0.5 text-[11px] font-bold text-teal-200">
                  <Sparkles className="h-3 w-3" /> নতুন সার্ভিস
                </span>
              </div>
              {offer.tagline && <p className="mt-1 text-sm text-white/75">{offer.tagline}</p>}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {offer.features.slice(0, 3).map((f) => (
                  <span key={f} className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-white/85">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            {from != null && (
              <div className="text-sm text-white/70">
                মাসে <span className="text-2xl font-bold text-white">{formatTaka(from)}</span> থেকে
              </div>
            )}
            {ordered ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 px-3 py-1.5 text-xs font-bold text-amber-200">
                <Clock className="h-3.5 w-3.5" /> অর্ডার দেওয়া হয়েছে · CORE যোগাযোগ করবে
              </span>
            ) : (
              <Button className="bg-teal-400 font-bold text-slate-900 hover:bg-teal-300" onClick={() => setOpen(true)}>
                প্ল্যান দেখুন ও অর্ডার করুন
              </Button>
            )}
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto p-0">
          <DialogHeader className="border-b p-6 pb-4">
            <DialogTitle className="text-xl">{offer.name}</DialogTitle>
            <DialogDescription>যা নিতে চান টিক দিন, মোট খরচ সাথে সাথে দেখতে পাবেন।</DialogDescription>
          </DialogHeader>

          <div className="space-y-7 p-6">
            {offer.plans.length > 0 && (
              <section>
                <h4 className="mb-1 font-bold">১. প্ল্যান বেছে নিন</h4>
                <p className="mb-4 text-xs text-muted-foreground">মাসিক চার্জ, প্রতি মাসের বিলের সাথে যোগ হবে</p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-5 pt-2 sm:grid-cols-3 lg:grid-cols-5">
                  {offer.plans.map((p) => {
                    const on = p.id === planId;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPlanId(p.id)}
                        className={cn(
                          'relative flex flex-col rounded-2xl border p-4 text-left transition-all',
                          p.popular ? 'border-transparent bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-lg' : 'bg-card',
                          on && (p.popular ? 'ring-4 ring-teal-400' : 'border-teal-600 ring-2 ring-teal-600'),
                        )}
                      >
                        {p.popular && (
                          <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-teal-400 px-2.5 py-0.5 text-[10px] font-bold text-slate-900">
                            সবচেয়ে জনপ্রিয়
                          </span>
                        )}
                        <span className="text-sm font-semibold">{p.label}</span>
                        <span className={cn('mt-1 text-2xl font-bold', p.popular && 'text-teal-300')}>{formatTaka(p.price)}</span>
                        <span className={cn('text-[11px]', p.popular ? 'text-white/60' : 'text-muted-foreground')}>/ মাস</span>
                        {p.features.map((f) => (
                          <span key={f} className={cn('mt-1.5 text-[11px]', p.popular ? 'text-white/80' : 'text-muted-foreground')}>
                            {f}
                          </span>
                        ))}
                        <span
                          className={cn(
                            'mt-3 rounded-full py-1.5 text-center text-xs font-bold',
                            on ? 'bg-teal-500 text-white' : p.popular ? 'bg-white/10' : 'bg-muted',
                          )}
                        >
                          {on ? 'নির্বাচিত ✓' : 'এটা নিন'}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {shared.length > 0 && (
                  <div className="mt-4 rounded-xl bg-muted/50 p-4">
                    <div className="mb-2 text-xs font-semibold text-muted-foreground">সব প্ল্যানে যা থাকছে</div>
                    <ul className="grid gap-1.5 sm:grid-cols-2">
                      {shared.map((line) => (
                        <li key={line} className="flex items-start gap-2 text-[13px]">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}

            {offer.setups.length > 0 && (
              <section>
                <h4 className="mb-1 font-bold">২. নম্বর বেছে নিন</h4>
                <p className="mb-3 text-xs text-muted-foreground">যেকোনো একটা নিতে হবে · এককালীন</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {offer.setups.map((p) => {
                    const on = p.id === setupId;
                    const vip = /vip/i.test(p.label);
                    const dark = on && vip;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setSetupId(p.id)}
                        className={cn(
                          'rounded-2xl border-2 p-4 text-left transition-all',
                          on ? (vip ? 'border-slate-900 bg-gradient-to-br from-slate-900 to-teal-900 text-white' : 'border-teal-600 bg-teal-50 dark:bg-teal-950/40') : 'hover:border-teal-600/50',
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2 font-bold">
                            <span className={cn('flex h-5 w-5 items-center justify-center rounded-full border-2', on ? (vip ? 'border-teal-300' : 'border-teal-600') : 'border-muted-foreground/30')}>
                              {on && <span className={cn('h-2.5 w-2.5 rounded-full', vip ? 'bg-teal-300' : 'bg-teal-600')} />}
                            </span>
                            {p.label}
                          </span>
                          <span className={cn('font-bold', dark && 'text-teal-300')}>{formatTaka(p.price)}</span>
                        </div>
                        <ExampleNumber note={p.note} light={dark} />
                        {vip && <p className={cn('mt-1 text-xs', dark ? 'text-white/70' : 'text-muted-foreground')}>সহজে মনে রাখার মতো নম্বর</p>}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {(offer.fees.length > 0 || offer.extras.length > 0) && (
              <section>
                <h4 className="mb-1 font-bold">৩. এককালীন খরচ</h4>
                <p className="mb-3 text-xs text-muted-foreground">আবশ্যকগুলো টিক দেওয়াই থাকবে, বাকিগুলো ইচ্ছা হলে নিন</p>
                <div className="space-y-2">
                  {offer.fees.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 rounded-xl border bg-muted/40 px-4 py-3">
                      <Tick on locked />
                      <span className="flex-1 text-sm font-semibold">
                        {p.label}
                        <span className="ml-2 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-teal-300">আবশ্যক</span>
                      </span>
                      <span className="text-sm font-bold">{formatTaka(p.price)}</span>
                    </div>
                  ))}
                  {offer.extras.map((p) => {
                    const on = extraIds.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        onClick={() => setExtraIds((ids) => (on ? ids.filter((x) => x !== p.id) : [...ids, p.id]))}
                        className={cn('flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left', on ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/40' : 'hover:border-teal-600/50')}
                      >
                        <Tick on={on} />
                        <span className="flex-1 text-sm font-semibold">
                          {p.label}
                          <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">ঐচ্ছিক</span>
                        </span>
                        <span className="text-sm font-bold">{formatTaka(p.price)}</span>
                      </button>
                    );
                  })}
                </div>
                {offer.samples.length > 0 && offer.extras.length > 0 && (
                  <div className="mt-3 rounded-xl bg-muted/50 p-3">
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                      <Music className="h-3.5 w-3.5" /> কলার টিউনের নমুনা শুনুন
                    </div>
                    <div className="space-y-2">
                      {offer.samples.map((s) => (
                        <div key={s.url} className="flex flex-wrap items-center gap-3">
                          <span className="min-w-[110px] flex-1 text-sm">{s.title}</span>
                          <audio controls preload="none" src={s.url} className="h-9 max-w-full" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            <section>
              <h4 className="mb-2 font-bold">কিছু বলার থাকলে</h4>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="যেমন: কয়জন কল ধরবে, কবে থেকে চালু চান" />
            </section>
          </div>

          <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-4 border-t bg-background/95 p-5 backdrop-blur">
            <div className="text-sm">
              <div>
                এককালীন মোট <span className="text-xl font-bold">{formatTaka(once)}</span>
              </div>
              {plan && (
                <div className="text-muted-foreground">
                  তারপর প্রতি মাসে {formatTaka(plan.price)} · {plan.label}
                </div>
              )}
            </div>
            <Button size="lg" className="bg-teal-600 font-bold hover:bg-teal-700" disabled={sending} onClick={send}>
              {sending ? 'পাঠানো হচ্ছে…' : 'অর্ডার পাঠান'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
