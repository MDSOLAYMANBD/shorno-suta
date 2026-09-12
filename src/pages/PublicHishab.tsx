import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Phone, Globe, Package, Facebook, Youtube, TrendingUp, TrendingDown, Wallet, ListChecks } from 'lucide-react';
import { format } from 'date-fns';

type Kind = 'person' | 'unit' | 'unit-module';

interface Props { kind: Kind }

function fmt(n: number) {
  return `৳${(n || 0).toLocaleString('en-US')}`;
}

export default function PublicHishab({ kind }: Props) {
  const params = useParams();
  const id = (kind === 'unit-module' ? params.unitId : (kind === 'person' ? params.personId : params.unitId)) || '';
  const moduleType = params.moduleType || '';

  const queryString = kind === 'unit-module'
    ? `type=unit-module&id=${id}&module=${encodeURIComponent(moduleType)}`
    : `type=${kind}&id=${id}`;

  const { data, isLoading, error } = useQuery({
    queryKey: ['public-hishab', kind, id, moduleType],
    queryFn: async () => {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/accounting-memo?${queryString}`
      );
      if (!res.ok) throw new Error('Not found');
      return res.json();
    },
    enabled: !!id,
    retry: false,
    staleTime: 30 * 1000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <div className="text-center">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h1 className="text-lg font-bold">হিসাব পাওয়া যায়নি</h1>
          <p className="text-sm text-muted-foreground mt-1">এই লিংকটি সঠিক নয়।</p>
        </div>
      </div>
    );
  }

  const { entity, ledger, summary, branding } = data;
  const brandColor = branding.brand_color || '#8C6A1A';

  const kindLabel = entity.kind === 'person'
    ? 'ব্যক্তির হিসাব'
    : entity.kind === 'unit'
      ? 'ইউনিট হিসাব'
      : `${entity.module || 'মডিউল'} হিসাব`;

  return (
    <div className="min-h-screen bg-muted/30 py-4 px-3 pb-8">
      <div className="max-w-4xl mx-auto bg-card rounded-xl shadow-lg overflow-hidden" style={{ fontFamily: 'Arial, sans-serif' }}>

        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b-4 flex items-start gap-3" style={{ borderColor: brandColor }}>
          {branding.logo_url && (
            <img src={branding.logo_url} alt="Logo" className="w-12 h-12 rounded-full object-cover border-2 shrink-0" style={{ borderColor: brandColor }} />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold leading-tight" style={{ color: brandColor }}>{branding.brand_name}</div>
            {branding.brand_name_en && (
              <div className="text-[10px] tracking-widest text-muted-foreground uppercase leading-tight">{branding.brand_name_en}</div>
            )}
            <div className="text-[10px] text-muted-foreground mt-0.5">{branding.address}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: brandColor }}>{kindLabel}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          </div>
        </div>

        {/* Entity card */}
        <div className="mx-4 sm:mx-6 mt-4 rounded-lg border-2 px-4 py-3" style={{ borderColor: brandColor }}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="text-base sm:text-lg font-bold" style={{ color: brandColor }}>{entity.name}</div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {entity.code && <span className="text-[10px] font-mono font-bold bg-muted px-1.5 py-0.5 rounded">{entity.code}</span>}
                {entity.type && <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">{entity.type}</span>}
                {entity.unit_name && <span className="text-[10px] font-medium text-muted-foreground">{entity.unit_name}</span>}
                {entity.phone && <span className="text-[10px] text-muted-foreground">📞 {entity.phone}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Stat cards */}
        <div className="mx-4 sm:mx-6 mt-4 grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <StatCard label="মোট বিল" value={fmt(summary.total_bill)} tone="blue" Icon={TrendingUp} />
          <StatCard label="মোট জমা" value={fmt(summary.total_paid)} tone="green" Icon={Wallet} />
          <StatCard label="বাকি" value={fmt(summary.balance)} tone="orange" Icon={TrendingDown} highlight />
          <StatCard label="মোট পরিমাণ" value={ledger.reduce((s, e) => s + (Number(e.quantity) || 0), 0).toLocaleString('en-US')} tone="indigo" Icon={ListChecks} />
        </div>

        {/* Ledger Table */}
        <div className="mx-4 sm:mx-6 mt-4 mb-4 overflow-x-auto rounded-lg border" style={{ borderColor: `${brandColor}30` }}>
          <table className="w-full text-[11px] sm:text-xs border-collapse">
            <thead>
              <tr className="text-white" style={{ background: `linear-gradient(180deg, ${brandColor}, ${brandColor}cc)` }}>
                <th className="text-left py-2.5 px-2 font-semibold">মেমো</th>
                <th className="text-left py-2.5 px-2 font-semibold">তারিখ</th>
                <th className="text-left py-2.5 px-2 font-semibold">বিবরণ</th>
                <th className="text-right py-2.5 px-2 font-semibold">পরিমাণ</th>
                <th className="text-right py-2.5 px-2 font-semibold">দর</th>
                <th className="text-right py-2.5 px-2 font-semibold">বিল</th>
                <th className="text-right py-2.5 px-2 font-semibold">জমা</th>
                <th className="text-right py-2.5 px-2 font-semibold">বাকি</th>
              </tr>
            </thead>
            <tbody>
              {ledger.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-muted-foreground">কোনো এন্ট্রি নেই</td>
                </tr>
              )}
              {(() => {
                const groupTotals = new Map<string, { qty: number; bill: number; count: number; date: string; memo: string }>();
                ledger.forEach((e: any) => {
                  if (e.source === 'submission' || e.source === 'expense') return;
                  if (!e.memo_number) return;
                  const key = `${e.memo_number}__${e.date || ''}`;
                  const prev = groupTotals.get(key) || { qty: 0, bill: 0, count: 0, date: e.date || '', memo: e.memo_number };
                  prev.qty += Number(e.quantity) || 0;
                  prev.bill += Number(e.bill) || 0;
                  prev.count += 1;
                  groupTotals.set(key, prev);
                });

                const rendered: JSX.Element[] = [];
                let prevKey = '';
                ledger.forEach((e: any, idx: number) => {
                  const isSubmission = e.source === 'submission';
                  const isExpense = e.source === 'expense';
                  const groupKey = (!isSubmission && !isExpense && e.memo_number) ? `${e.memo_number}__${e.date || ''}` : '';

                  if (groupKey && groupKey !== prevKey) {
                    const g = groupTotals.get(groupKey);
                    if (g && g.count > 1) {
                      let gDate = '—';
                      if (g.date) {
                        try { gDate = format(new Date(g.date), 'dd/MM'); } catch { gDate = g.date; }
                      }
                      rendered.push(
                        <tr key={`sum-${groupKey}`} className="border-b font-semibold" style={{ background: `${brandColor}15` }}>
                          <td colSpan={8} className="py-1.5 px-2 text-[11px]" style={{ color: brandColor }}>
                            মেমো #{g.memo} · {gDate} · মোট পরিমাণ: {g.qty.toLocaleString('en-US')} · মোট বিল: {fmt(g.bill)} ({g.count} আইটেম)
                          </td>
                        </tr>
                      );
                    }
                  }
                  prevKey = groupKey;

                  const rowBg = isSubmission
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/20'
                    : isExpense
                      ? 'bg-orange-50/70 dark:bg-orange-950/20'
                      : (idx % 2 === 0 ? 'bg-muted/20' : 'bg-card');
                  let displayDate = '—';
                  if (e.date) {
                    try { displayDate = format(new Date(e.date), 'dd/MM'); } catch { displayDate = e.date; }
                  }
                  rendered.push(
                    <tr key={e.id} className={`border-b last:border-b-0 border-border/40 ${rowBg}`}>
                      <td className="py-1.5 px-2 font-mono text-[10px] text-muted-foreground">{e.memo_number || '—'}</td>
                      <td className="py-1.5 px-2 whitespace-nowrap text-muted-foreground">{displayDate}</td>
                      <td className="py-1.5 px-2">
                        <span className="font-medium">{e.description}</span>
                        {isSubmission && (
                          <span className="ml-1.5 inline-block text-[9px] font-semibold uppercase tracking-wide bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded-full">জমা</span>
                        )}
                        {isExpense && (
                          <span className="ml-1.5 inline-block text-[9px] font-semibold uppercase tracking-wide bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 rounded-full">খরচ</span>
                        )}
                      </td>
                      <td className="text-right py-1.5 px-2 tabular-nums">{e.quantity ?? '—'}</td>
                      <td className="text-right py-1.5 px-2 tabular-nums">{e.rate ?? '—'}</td>
                      <td className="text-right py-1.5 px-2 tabular-nums font-medium text-rose-600 dark:text-rose-400">{e.bill > 0 ? fmt(e.bill) : '—'}</td>
                      <td className="text-right py-1.5 px-2 tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">{e.paid > 0 ? fmt(e.paid) : '—'}</td>
                      <td className="text-right py-1.5 px-2 tabular-nums font-bold">{fmt(e.balance)}</td>
                    </tr>
                  );
                });
                return rendered;
              })()}
            </tbody>
            {ledger.length > 0 && (
              <tfoot>
                <tr className="font-bold border-t-2" style={{ borderColor: brandColor, background: `${brandColor}10` }}>
                  <td colSpan={5} className="py-2.5 px-2 text-right">মোট:</td>
                  <td className="py-2.5 px-2 text-right tabular-nums text-rose-600 dark:text-rose-400">{fmt(summary.total_bill)}</td>
                  <td className="py-2.5 px-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{fmt(summary.total_paid)}</td>
                  <td className="py-2.5 px-2 text-right tabular-nums" style={{ color: brandColor }}>{fmt(summary.balance)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Contact Footer */}
        <div className="mx-4 sm:mx-6 mb-4 rounded-xl border-2 overflow-hidden" style={{ borderColor: brandColor }}>
          <div className="divide-y" style={{ borderColor: `${brandColor}30` }}>
            {branding.phone && (
              <a href={`tel:${branding.phone.replace(/[^0-9+]/g, '')}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${brandColor}15` }}>
                  <Phone className="h-4 w-4" style={{ color: brandColor }} />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Helpline</p>
                  <p className="text-sm font-bold" style={{ color: brandColor }}>{branding.phone}</p>
                </div>
              </a>
            )}
            {branding.whatsapp && (
              <a href={`https://wa.me/${branding.whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40">
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-green-50">
                  <span className="text-base">📲</span>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">WhatsApp</p>
                  <p className="text-sm font-bold text-green-600">{branding.whatsapp}</p>
                </div>
              </a>
            )}
            {branding.website && (
              <a href={branding.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${brandColor}15` }}>
                  <Globe className="h-4 w-4" style={{ color: brandColor }} />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Website</p>
                  <p className="text-sm font-bold text-blue-600">{branding.website.replace(/^https?:\/\//, '')}</p>
                </div>
              </a>
            )}
            {branding.facebook && (
              <a href={branding.facebook} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: '#1877F215' }}>
                  <Facebook className="h-4 w-4" style={{ color: '#1877F2' }} />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Facebook</p>
                  <p className="text-sm font-bold" style={{ color: '#1877F2' }}>Facebook Page</p>
                </div>
              </a>
            )}
            {branding.youtube && (
              <a href={branding.youtube} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: '#FF000015' }}>
                  <Youtube className="h-4 w-4" style={{ color: '#FF0000' }} />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">YouTube</p>
                  <p className="text-sm font-bold" style={{ color: '#FF0000' }}>YouTube Channel</p>
                </div>
              </a>
            )}
          </div>
        </div>

        <div className="text-center pb-4">
          <p className="text-[10px] text-muted-foreground">
            Powered by <span className="font-bold" style={{ color: brandColor }}>{branding.brand_name}</span> ❤️
          </p>
        </div>
      </div>
    </div>
  );
}

type StatTone = 'blue' | 'green' | 'orange' | 'indigo';
const TONE: Record<StatTone, { bg: string; text: string; ring: string; iconBg: string; gradFrom: string; gradTo: string }> = {
  blue:   { bg: 'bg-blue-50 dark:bg-blue-950/30',       text: 'text-blue-700 dark:text-blue-300',       ring: 'ring-blue-200 dark:ring-blue-900/50',       iconBg: 'bg-blue-100 dark:bg-blue-900/40',       gradFrom: 'from-blue-50',    gradTo: 'to-blue-100/40' },
  green:  { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-300', ring: 'ring-emerald-200 dark:ring-emerald-900/50', iconBg: 'bg-emerald-100 dark:bg-emerald-900/40', gradFrom: 'from-emerald-50', gradTo: 'to-emerald-100/40' },
  orange: { bg: 'bg-orange-50 dark:bg-orange-950/30',   text: 'text-orange-700 dark:text-orange-300',   ring: 'ring-orange-200 dark:ring-orange-900/50',   iconBg: 'bg-orange-100 dark:bg-orange-900/40',   gradFrom: 'from-orange-50',  gradTo: 'to-orange-100/40' },
  indigo: { bg: 'bg-indigo-50 dark:bg-indigo-950/30',   text: 'text-indigo-700 dark:text-indigo-300',   ring: 'ring-indigo-200 dark:ring-indigo-900/50',   iconBg: 'bg-indigo-100 dark:bg-indigo-900/40',   gradFrom: 'from-indigo-50',  gradTo: 'to-indigo-100/40' },
};

function StatCard({ label, value, tone, Icon, highlight }: { label: string; value: string; tone: StatTone; Icon: React.ComponentType<{ className?: string }>; highlight?: boolean }) {
  const t = TONE[tone];
  return (
    <div className={`rounded-xl px-3 py-2.5 ring-1 bg-gradient-to-br ${t.gradFrom} ${t.gradTo} dark:bg-none ${t.bg} ${t.ring} ${highlight ? 'shadow-sm' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</div>
          <div className={`mt-0.5 font-bold tabular-nums ${highlight ? 'text-lg sm:text-xl' : 'text-base sm:text-lg'} ${t.text}`}>{value}</div>
        </div>
        <div className={`shrink-0 h-7 w-7 rounded-lg flex items-center justify-center ${t.iconBg}`}>
          <Icon className={`h-3.5 w-3.5 ${t.text}`} />
        </div>
      </div>
    </div>
  );
}
