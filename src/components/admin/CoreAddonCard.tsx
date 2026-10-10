import { toast } from 'sonner';
import { CheckCircle2, Copy, Download, Monitor, Music, PhoneCall, Smartphone } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatBnDate, formatTaka, type CoreAddon } from '@/lib/coreConnect';

const STATUS: Record<CoreAddon['status'], { label: string; className: string; dot: string }> = {
  active: { label: 'চালু আছে', className: 'bg-emerald-400/20 text-emerald-200', dot: 'bg-emerald-400' },
  setting_up: { label: 'চালু হচ্ছে', className: 'bg-amber-400/20 text-amber-200', dot: 'bg-amber-400' },
  paused: { label: 'সাময়িক বন্ধ', className: 'bg-white/10 text-white/70', dot: 'bg-white/50' },
  cancelled: { label: 'বন্ধ', className: 'bg-white/10 text-white/70', dot: 'bg-white/50' },
};

const isPhoneApp = (label: string) => /android|iphone|ios|mobile|play\s*store|app\s*store/i.test(label);

/** A service this site runs on top of its package (e.g. IP Number & SMS Service), from CORE. */
export default function CoreAddonCard({ addon }: { addon: CoreAddon }) {
  const status = STATUS[addon.status] ?? STATUS.active;
  const apps = addon.apps ?? [];
  const copy = (text: string) => navigator.clipboard.writeText(text).then(() => toast.success('কপি হয়েছে'));

  return (
    <Card className="overflow-hidden">
      <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-teal-900 p-6 text-white">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-teal-400/10" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10">
              <PhoneCall className="h-5 w-5 text-teal-300" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-bold">{addon.name}</h3>
              {addon.tagline && <p className="mt-0.5 text-xs text-white/70">{addon.tagline}</p>}
            </div>
          </div>
          <span className={cn('inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold', status.className)}>
            <span className="relative flex h-2 w-2">
              {addon.status === 'active' && (
                <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-75', status.dot)} />
              )}
              <span className={cn('relative inline-flex h-2 w-2 rounded-full', status.dot)} />
            </span>
            {status.label}
          </span>
        </div>

        {addon.phone_number && (
          <div className="relative mt-5 flex flex-wrap items-center gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-white/60">আপনার নম্বর</div>
              <div className="font-mono text-2xl font-bold tracking-wide sm:text-3xl">{addon.phone_number}</div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="bg-white/10 text-white hover:bg-white/20"
              onClick={() => copy(addon.phone_number!)}
            >
              <Copy className="mr-1 h-4 w-4" /> কপি
            </Button>
          </div>
        )}
      </div>

      <CardContent className="space-y-5 p-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-muted/60 p-3">
            <div className="text-[11px] text-muted-foreground">প্ল্যান</div>
            <div className="mt-0.5 font-bold">{addon.plan || '—'}</div>
          </div>
          <div className="rounded-xl bg-muted/60 p-3">
            <div className="text-[11px] text-muted-foreground">মাসিক চার্জ</div>
            <div className="mt-0.5 font-bold">{addon.monthly != null ? `${formatTaka(addon.monthly)} / মাস` : '—'}</div>
          </div>
          <div className="rounded-xl bg-muted/60 p-3">
            <div className="text-[11px] text-muted-foreground">চালু হয়েছে</div>
            <div className="mt-0.5 font-bold">{formatBnDate(addon.started_on)}</div>
          </div>
        </div>

        {addon.rates.length > 0 && (
          <div>
            <div className="mb-2 text-xs font-semibold text-muted-foreground">ব্যবহারের খরচ</div>
            <div className="flex flex-wrap gap-2">
              {addon.rates.map((r) => (
                <span key={r.label} className="rounded-full border px-3 py-1.5 text-sm">
                  <span className="font-semibold">{r.label}</span> {formatTaka(r.price)}
                  {r.unit}
                  {r.note && <span className="text-muted-foreground"> · {r.note}</span>}
                </span>
              ))}
            </div>
          </div>
        )}

        {addon.features.length > 0 && (
          <ul className="grid gap-2 sm:grid-cols-2">
            {addon.features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        )}

        {apps.length > 0 && (
          <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-4 dark:border-teal-900 dark:bg-teal-950/30">
            <div className="text-sm font-bold">মোবাইল ও কম্পিউটার থেকে ব্যবহার করুন</div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              অ্যাপটি নামিয়ে আপনার নম্বর দিয়ে লগইন করুন। লগইনের তথ্য CORE Automation থেকে দেওয়া হবে।
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {apps.map((app) => {
                const Icon = isPhoneApp(app.label) ? Smartphone : Monitor;
                return (
                  <a
                    key={app.url}
                    href={app.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-xl border bg-background px-3 py-2.5 transition-colors hover:border-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/50"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-600 text-white">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-sm font-semibold leading-tight">{app.label}</span>
                      <span className="block text-[11px] text-muted-foreground">ডাউনলোড করুন</span>
                    </span>
                    <Download className="h-4 w-4 shrink-0 text-teal-700 dark:text-teal-300" />
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {(addon.setup || addon.extras.length > 0) && (
          <p className="text-xs text-muted-foreground">
            নেওয়া হয়েছে: {[addon.setup, ...addon.extras].filter(Boolean).join(' · ')}
          </p>
        )}

        {addon.details && <p className="whitespace-pre-line rounded-xl border bg-muted/30 p-3 text-sm">{addon.details}</p>}

        {addon.samples.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Music className="h-3.5 w-3.5" /> কলার টিউনের নমুনা
            </div>
            <div className="space-y-2">
              {addon.samples.map((s) => (
                <div key={s.url} className="flex flex-wrap items-center gap-3 rounded-xl bg-muted/50 px-3 py-2">
                  <span className="min-w-[110px] flex-1 text-sm font-medium">{s.title}</span>
                  <audio controls preload="none" src={s.url} className="h-9 max-w-full" />
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="border-t pt-3 text-xs text-muted-foreground">
          এই সার্ভিসের মাসিক চার্জ আপনার মাসিক বিলের সাথে যোগ হয়।
        </p>
      </CardContent>
    </Card>
  );
}
