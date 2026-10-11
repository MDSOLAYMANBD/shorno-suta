import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import {
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Monitor,
  Music,
  PhoneCall,
  PlayCircle,
  Server,
  Smartphone,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { formatBnDate, formatTaka, type CoreAddon, type CoreAddonAccess, type CoreGuideStep } from '@/lib/coreConnect';

const STATUS: Record<CoreAddon['status'], { label: string; className: string; dot: string }> = {
  active: { label: 'চালু আছে', className: 'bg-emerald-400/20 text-emerald-200', dot: 'bg-emerald-400' },
  setting_up: { label: 'চালু হচ্ছে', className: 'bg-amber-400/20 text-amber-200', dot: 'bg-amber-400' },
  paused: { label: 'সাময়িক বন্ধ', className: 'bg-white/10 text-white/70', dot: 'bg-white/50' },
  cancelled: { label: 'বন্ধ', className: 'bg-white/10 text-white/70', dot: 'bg-white/50' },
};

const isPhoneApp = (label: string) => /android|iphone|ios|mobile|play\s*store|app\s*store/i.test(label);
const bnDigits = (n: number) => String(n).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)]);
const copy = (text: string) =>
  navigator.clipboard.writeText(text).then(
    () => toast.success('কপি হয়েছে'),
    () => toast.error('কপি করা যায়নি'),
  );

const iconButton =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground';

function CopyButton({ value, label }: { value: string; label: string }) {
  return (
    <button type="button" onClick={() => copy(value)} aria-label={label} title={label} className={iconButton}>
      <Copy className="h-4 w-4" />
    </button>
  );
}

/** A value with a copy button. */
function Value({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex min-w-0 items-center gap-0.5">
      <span className="min-w-0 flex-1 truncate font-mono text-sm font-semibold">{value}</span>
      <CopyButton value={value} label={label} />
    </div>
  );
}

/** A password: hidden until asked, copied either way. */
function Secret({ value }: { value: string }) {
  const [shown, setShown] = useState(false);
  const toggle = shown ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখুন';
  return (
    <div className="flex min-w-0 items-center gap-0.5">
      <span className="min-w-0 flex-1 truncate font-mono text-sm">{shown ? value : '••••••••'}</span>
      <button type="button" onClick={() => setShown(!shown)} aria-label={toggle} title={toggle} className={iconButton}>
        {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
      <CopyButton value={value} label="পাসওয়ার্ড কপি করুন" />
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="w-[70px] shrink-0 text-[11px] text-muted-foreground">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** The server, accounts (e.g. extensions) and logins (e.g. call records) CORE set up for this site. */
function AccessDetails({ access }: { access: CoreAddonAccess }) {
  return (
    <div className="rounded-xl border border-teal-200 bg-teal-50/40 p-4 dark:border-teal-900 dark:bg-teal-950/20">
      <div className="flex items-center gap-2 text-sm font-bold">
        <KeyRound className="h-4 w-4 text-teal-600" /> আপনার লগইনের তথ্য
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">শুধু এই প্যানেলের মালিকরা দেখতে পান। পাসওয়ার্ড কাউকে শেয়ার করবেন না।</p>

      {access.server && (
        <div className="mt-3 flex min-w-0 flex-wrap items-center gap-x-2 rounded-lg border bg-background px-3 py-1.5">
          <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
            <Server className="h-4 w-4 text-teal-600" /> সার্ভার / SIP ডোমেইন
          </span>
          <div className="min-w-[160px] flex-1">
            <Value value={access.server} label="সার্ভার কপি করুন" />
          </div>
        </div>
      )}

      {access.accounts.length > 0 && (
        <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-2">
          {access.accounts.map((a, i) => (
            <div key={`${a.username}-${i}`} className="rounded-lg border bg-background px-3 py-2">
              <div className="mb-0.5 text-xs font-bold text-teal-700 dark:text-teal-300">এক্সটেনশন {bnDigits(i + 1)}</div>
              <Row label="ইউজারনেম">
                <Value value={a.username} label="ইউজারনেম কপি করুন" />
              </Row>
              {a.password && (
                <Row label="পাসওয়ার্ড">
                  <Secret value={a.password} />
                </Row>
              )}
            </div>
          ))}
        </div>
      )}

      {access.logins.length > 0 && (
        <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-2">
          {access.logins.map((l, i) => (
            <div key={`${l.label}-${i}`} className="rounded-lg border bg-background px-3 py-2">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 break-words text-sm font-bold">{l.label}</span>
                {l.url && (
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 rounded-md bg-teal-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-teal-700"
                  >
                    লগইন পেজ খুলুন <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              {l.username && (
                <Row label="ইউজারনেম">
                  <Value value={l.username} label="ইউজারনেম কপি করুন" />
                </Row>
              )}
              {l.password && (
                <Row label="পাসওয়ার্ড">
                  <Secret value={l.password} />
                </Row>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Setting the service up on a phone or on a computer: the app, a video and a picture, then logging in. */
function SetupSide({
  title,
  icon: Icon,
  apps,
  step,
  login,
}: {
  title: string;
  icon: LucideIcon;
  apps: { label: string; url: string }[];
  step?: CoreGuideStep;
  login: boolean;
}) {
  const [open, setOpen] = useState(false);
  const steps: { key: string; content: ReactNode }[] = [];
  if (apps.length > 0) {
    steps.push({
      key: 'apps',
      content: (
        <div className="space-y-2">
          <div className="text-sm">অ্যাপটি নামান</div>
          {apps.map((app) => (
            <a
              key={app.url}
              href={app.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-xl border bg-background px-3 py-2 transition-colors hover:border-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/50"
            >
              <span className="min-w-0 flex-1 break-words text-sm font-semibold leading-tight">{app.label}</span>
              <Download className="h-4 w-4 shrink-0 text-teal-700 dark:text-teal-300" />
            </a>
          ))}
        </div>
      ),
    });
  }
  if (step?.video || step?.image) {
    steps.push({
      key: 'guide',
      content: (
        <div className="space-y-2">
          <div className="text-sm">দেখে দেখে সেটআপ করুন</div>
          {step.video && (
            <a
              href={step.video}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
            >
              <PlayCircle className="h-4 w-4 shrink-0" /> সেটআপের ভিডিও দেখুন
            </a>
          )}
          {step.image && (
            <>
              <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label={`${title} সেটআপের ছবি বড় করে দেখুন`}
                className="block w-full overflow-hidden rounded-xl border bg-background transition-opacity hover:opacity-90"
              >
                <img src={step.image} alt={`${title} সেটআপের ছবি`} loading="lazy" className="max-h-56 w-full object-contain" />
              </button>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-3xl p-2">
                  <DialogTitle className="sr-only">{title} সেটআপের ছবি</DialogTitle>
                  <img src={step.image} alt={`${title} সেটআপের ছবি`} className="max-h-[80vh] w-full rounded-lg object-contain" />
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      ),
    });
  }
  if (steps.length === 0) return null;
  if (login) {
    steps.push({ key: 'login', content: <div className="text-sm">উপরের সার্ভার, এক্সটেনশন আর পাসওয়ার্ড দিয়ে লগইন করুন</div> });
  }

  return (
    <div className="rounded-xl border bg-muted/30 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600 text-white">
          <Icon className="h-4 w-4" />
        </span>
        {title}
      </div>
      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li key={s.key} className="flex gap-2.5">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-600/15 text-[11px] font-bold text-teal-700 dark:text-teal-300">
              {bnDigits(i + 1)}
            </span>
            <div className="min-w-0 flex-1">{s.content}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** A service this site runs on top of its package (e.g. IP Number & SMS Service), from CORE. */
export default function CoreAddonCard({ addon }: { addon: CoreAddon }) {
  const status = STATUS[addon.status] ?? STATUS.active;
  const apps = addon.apps ?? [];
  const access = addon.access;
  const hasAccess = Boolean(access && (access.server || access.accounts.length > 0 || access.logins.length > 0));
  const canLogIn = Boolean(access && (access.server || access.accounts.length > 0));
  const hasSetup = apps.length > 0 || Boolean(addon.guide);
  // The site's own caller tune, once CORE has made it; the samples are for those without one.
  const tunes = addon.tunes ?? [];
  const tookTune = addon.extras.some((label) => /টিউন|tune/i.test(label));

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

        {hasAccess && access && <AccessDetails access={access} />}

        {tunes.length > 0 ? (
          <div className="rounded-xl border border-teal-200 bg-teal-50/40 p-4 dark:border-teal-900 dark:bg-teal-950/20">
            <div className="flex items-center gap-2 text-sm font-bold">
              <Music className="h-4 w-4 text-teal-600" /> আপনার কলার টিউন
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">কেউ আপনার নম্বরে কল করলে এটা শুনবেন।</p>
            <div className="mt-3 space-y-2">
              {tunes.map((t) => (
                <div key={t.url} className="flex flex-wrap items-center gap-3 rounded-xl border bg-background px-3 py-2">
                  <span className="min-w-[110px] flex-1 text-sm font-semibold">{t.title}</span>
                  <audio controls preload="none" src={t.url} className="h-9 max-w-full" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          tookTune && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/20">
              <Music className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <span>
                <span className="font-bold">আপনার কলার টিউন তৈরি হচ্ছে।</span> তৈরি হলে এখানেই শুনতে পাবেন।
              </span>
            </div>
          )
        )}

        {hasSetup && (
          <div>
            <div className="text-sm font-bold">মোবাইল ও কম্পিউটারে সেটআপ</div>
            {!hasAccess && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                অ্যাপটি নামিয়ে আপনার নম্বর দিয়ে লগইন করুন। লগইনের তথ্য CORE Automation থেকে দেওয়া হবে।
              </p>
            )}
            <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
              <SetupSide
                title="মোবাইলে"
                icon={Smartphone}
                apps={apps.filter((a) => isPhoneApp(a.label))}
                step={addon.guide?.mobile}
                login={canLogIn}
              />
              <SetupSide
                title="কম্পিউটারে"
                icon={Monitor}
                apps={apps.filter((a) => !isPhoneApp(a.label))}
                step={addon.guide?.desktop}
                login={canLogIn}
              />
            </div>
          </div>
        )}

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

        {(addon.setup || addon.extras.length > 0) && (
          <p className="text-xs text-muted-foreground">
            নেওয়া হয়েছে: {[addon.setup, ...addon.extras].filter(Boolean).join(' · ')}
          </p>
        )}

        {addon.details && <p className="whitespace-pre-line rounded-xl border bg-muted/30 p-3 text-sm">{addon.details}</p>}

        {tunes.length === 0 && !tookTune && addon.samples.length > 0 && (
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
