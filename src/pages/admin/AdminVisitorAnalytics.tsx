import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import { Loader2, Package, ChevronRight, Eye, ShoppingCart, Users, ClipboardCheck, Facebook, Search, Instagram, MessageCircle, Video, Youtube, Link2, ExternalLink, Phone, Send } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { bn } from 'date-fns/locale';
import { useIsMobile } from '@/hooks/use-mobile';
import { useVisitorOverview, useRecentVisitorJourneys, type VisitorTabKey } from '@/hooks/useVisitorAnalytics';

// Same icon/color language as AnalyticsOverview.tsx's "অর্ডার সোর্স" card, so this reads as
// the same kind of breakdown, just for raw visits instead of placed orders.
const SOURCE_DISPLAY: Record<string, { label: string; icon: any; color: string }> = {
  facebook: { label: 'Facebook', icon: Facebook, color: '#1877F2' },
  google: { label: 'Google', icon: Search, color: '#4285F4' },
  instagram: { label: 'Instagram', icon: Instagram, color: '#E4405F' },
  whatsapp: { label: 'WhatsApp', icon: MessageCircle, color: '#25D366' },
  tiktok: { label: 'TikTok', icon: Video, color: '#000000' },
  youtube: { label: 'YouTube', icon: Youtube, color: '#FF0000' },
  direct: { label: 'সরাসরি / অর্গানিক', icon: Link2, color: 'hsl(var(--primary))' },
  referral: { label: 'অন্যান্য ওয়েবসাইট', icon: ExternalLink, color: '#F59E0B' },
};
function sourceDisplay(key: string) {
  return SOURCE_DISPLAY[key] || { label: key, icon: ExternalLink, color: '#94A3B8' };
}

function MetricBox({ label, value, sub, icon: Icon }: { label: string; value: string | number; sub?: string; icon?: any }) {
  return (
    <div className="rounded-md border bg-muted/30 p-2 text-center">
      <div className="flex items-center justify-center gap-1 mb-0.5">
        {Icon && <Icon className="h-3 w-3 text-muted-foreground" />}
        <p className="font-bold text-lg truncate">{value}</p>
      </div>
      <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
      {sub && <p className="text-[9px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// Scrollable chart wrapper for mobile — same pattern as AnalyticsOverview.tsx
function ScrollableChart({ children, dataLength, isMobile, height = 200 }: { children: React.ReactNode; dataLength: number; isMobile: boolean; height?: number }) {
  if (!isMobile) {
    return (
      <div className="overflow-hidden">
        <ResponsiveContainer width="100%" height={height}>{children as any}</ResponsiveContainer>
      </div>
    );
  }
  const chartWidth = Math.max(dataLength * 40, 320);
  return (
    <div className="overflow-x-auto -mx-1 pb-1">
      <div style={{ width: chartWidth, height }}>{children}</div>
    </div>
  );
}

function FunnelStep({ label, value, pctOfPrev, isFirst }: { label: string; value: number; pctOfPrev: number | null; isFirst?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      {!isFirst && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
      <div className="text-center min-w-[52px]">
        <p className="text-sm font-bold">{value.toLocaleString('bn-BD')}</p>
        <p className="text-[9px] text-muted-foreground leading-tight">{label}</p>
        {pctOfPrev !== null && <p className="text-[9px] text-primary font-medium">{pctOfPrev}%</p>}
      </div>
    </div>
  );
}

function ProductListCard({ title, items, emptyText }: { title: string; items: { id: string | null; name: string; image: string | null; count: number }[]; emptyText: string }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent className="pt-0">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">{emptyText}</p>
        ) : (
          <div className="space-y-1">
            {items.map((p, i) => (
              <div key={p.id || p.name}>
                <div className="flex items-center gap-2.5 py-2">
                  <div className="h-9 w-9 rounded-md overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center">
                    {p.image ? <img src={p.image} alt={p.name} className="h-full w-full object-cover" /> : <Package className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <p className="text-xs font-medium truncate flex-1 min-w-0">{p.name}</p>
                  <span className="text-xs font-semibold flex-shrink-0">{p.count}</span>
                </div>
                {i < items.length - 1 && <Separator />}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminVisitorAnalytics() {
  const [tab, setTab] = useState<VisitorTabKey>('today');
  const isMobile = useIsMobile();
  const { data, isLoading } = useVisitorOverview(tab);
  const { data: journeys = [], isLoading: journeysLoading } = useRecentVisitorJourneys();

  // "অর্ডার (মোট)" is deliberately excluded from the %-of-previous-stage chain — orders in
  // range aren't filtered from this range's cart-adders (orders has no session_id to link
  // them), so a "% of cart-adds" figure would misleadingly suggest a causal funnel step
  // that doesn't actually exist (e.g. can read >100% when phone/manual orders come in).
  const funnel = [
    { label: 'সেশন', value: data?.totalSessions || 0, showPct: true },
    { label: 'প্রোডাক্ট দেখেছেন', value: data?.viewedSessions || 0, showPct: true },
    { label: 'কার্টে যোগ করেছেন', value: data?.cartSessions || 0, showPct: true },
    { label: 'অর্ডার (মোট)', value: data?.orderCount || 0, showPct: false },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-xl md:text-2xl font-bold">ভিজিটর অ্যানালিটিক্স</h1>

      <Card>
        <CardHeader className="pb-1 pt-3 px-3">
          <CardTitle className="text-sm font-semibold">ওভারভিউ</CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3 pt-1">
          <Tabs value={tab} onValueChange={v => setTab(v as VisitorTabKey)}>
            <TabsList className="w-full h-8 mb-2">
              <TabsTrigger value="today" className="text-xs flex-1 h-7">আজ</TabsTrigger>
              <TabsTrigger value="weekly" className="text-xs flex-1 h-7">গত ৭ দিন</TabsTrigger>
              <TabsTrigger value="monthly" className="text-xs flex-1 h-7">এই মাস</TabsTrigger>
            </TabsList>
          </Tabs>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-2 mb-3">
                <MetricBox label="সেশন" value={(data?.totalSessions || 0).toLocaleString('bn-BD')} icon={Users} />
                <MetricBox label="প্রোডাক্ট ভিউ" value={(data?.viewedSessions || 0).toLocaleString('bn-BD')} icon={Eye} />
                <MetricBox label="কার্টে যোগ" value={(data?.cartSessions || 0).toLocaleString('bn-BD')} icon={ShoppingCart} />
                <MetricBox label="অর্ডার" value={(data?.orderCount || 0).toLocaleString('bn-BD')} icon={ClipboardCheck} />
              </div>

              <ScrollableChart dataLength={data?.chartData.length || 0} isMobile={isMobile} height={180}>
                <AreaChart data={data?.chartData || []} width={isMobile ? Math.max((data?.chartData.length || 0) * 40, 320) : undefined} height={180} margin={{ left: -5, right: 5, top: 24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="visitorGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.4)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" interval={isMobile ? 0 : 'preserveStartEnd'} />
                  <YAxis width={28} tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip content={() => null} />
                  <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#visitorGrad)">
                    <LabelList
                      dataKey="count"
                      content={({ x, y, value }: any) => {
                        const v = Number(value) || 0;
                        if (v === 0) return null;
                        return (
                          <text x={x} y={(y || 0) - 8} textAnchor="middle" fontSize={10} fill="hsl(var(--primary))" fontWeight={600}>{v}</text>
                        );
                      }}
                    />
                  </Area>
                </AreaChart>
              </ScrollableChart>

              <Separator className="my-3" />
              <div className="flex items-center justify-center flex-wrap gap-1">
                {funnel.map((f, i) => (
                  <FunnelStep
                    key={f.label}
                    label={f.label}
                    value={f.value}
                    isFirst={i === 0}
                    pctOfPrev={(i === 0 || !f.showPct) ? null : (funnel[i - 1].value > 0 ? Math.round((f.value / funnel[i - 1].value) * 100) : 0)}
                  />
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">ভিজিটর সোর্স</CardTitle>
          <p className="text-[10px] text-muted-foreground">কে কোথা থেকে সাইটে এসেছে — শুধু এই ফিচার চালুর পর থেকে যেসব ভিজিট রেকর্ড হয়েছে তা নিয়ে</p>
        </CardHeader>
        <CardContent className="pt-0">
          {(data?.sourceBreakdown || []).length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">এই সময়ে সোর্স তথ্যসহ কোনো ভিজিট নেই</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {data!.sourceBreakdown.map(s => {
                const disp = sourceDisplay(s.source);
                return (
                  <div key={s.source} className="flex items-center gap-2 rounded-lg border bg-background px-2.5 py-2">
                    <div className="h-8 w-8 rounded-md flex items-center justify-center shrink-0 bg-muted/40">
                      <disp.icon className="h-5 w-5" style={{ color: disp.color }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] text-muted-foreground truncate">{disp.label}</p>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-sm font-bold">{s.count}</span>
                        <span className="text-[9px] text-muted-foreground">({s.pct}%)</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">সোর্স অনুযায়ী কন্টাক্ট ক্লিক</CardTitle>
          <p className="text-[10px] text-muted-foreground">কোন সোর্সের ভিজিটর কল / WhatsApp / Messenger বাটনে ক্লিক করেছে — বটম ন্যাভ, ল্যান্ডিং পেজ হেডার ও প্রোডাক্ট পেজ থেকে ট্র্যাক করা হয়</p>
        </CardHeader>
        <CardContent className="pt-0">
          {(data?.contactClicksBySource || []).length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">এই সময়ে কোনো কন্টাক্ট বাটন ক্লিক রেকর্ড হয়নি</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b">
                    <th className="text-left font-medium py-1.5 pr-2">সোর্স</th>
                    <th className="text-right font-medium py-1.5 px-2"><Phone className="h-3 w-3 inline mb-0.5" /> কল</th>
                    <th className="text-right font-medium py-1.5 px-2"><MessageCircle className="h-3 w-3 inline mb-0.5" /> WhatsApp</th>
                    <th className="text-right font-medium py-1.5 px-2"><Send className="h-3 w-3 inline mb-0.5" /> Messenger</th>
                    <th className="text-right font-medium py-1.5 pl-2">মোট</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.contactClicksBySource.map(row => {
                    const disp = sourceDisplay(row.source);
                    return (
                      <tr key={row.source} className="border-b last:border-0">
                        <td className="py-1.5 pr-2">
                          <span className="flex items-center gap-1.5">
                            <disp.icon className="h-3.5 w-3.5 shrink-0" style={{ color: disp.color }} />
                            <span className="truncate">{row.source === 'অজানা' ? row.source : disp.label}</span>
                          </span>
                        </td>
                        <td className="text-right py-1.5 px-2 font-semibold">{row.call}</td>
                        <td className="text-right py-1.5 px-2 font-semibold">{row.whatsapp}</td>
                        <td className="text-right py-1.5 px-2 font-semibold">{row.messenger}</td>
                        <td className="text-right py-1.5 pl-2 font-bold text-primary">{row.total}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ProductListCard title="সবচেয়ে বেশি দেখা প্রোডাক্ট" items={data?.topViewedProducts || []} emptyText="এই সময়ে কোনো প্রোডাক্ট দেখা হয়নি" />
        <ProductListCard title="কার্টে সবচেয়ে বেশি যোগ হওয়া প্রোডাক্ট" items={data?.topCartProducts || []} emptyText="এই সময়ে কার্টে কিছু যোগ হয়নি" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">জনপ্রিয় ক্যাটাগরি</CardTitle></CardHeader>
          <CardContent className="pt-0 space-y-2.5">
            {(data?.topCategories || []).length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">এই সময়ে কোনো ক্যাটাগরি দেখা হয়নি</p>
            ) : data!.topCategories.map(c => (
              <div key={c.name}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium truncate">{c.name}</span>
                  <span className="text-muted-foreground shrink-0 ml-2">{c.count} ({c.pct}%)</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary/70" style={{ width: `${c.pct}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">টপ প্রবেশ পৃষ্ঠা</CardTitle></CardHeader>
          <CardContent className="pt-0">
            {(data?.topPages || []).length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">এই সময়ে কোনো ভিজিট নেই</p>
            ) : (
              <div className="space-y-1">
                {data!.topPages.map((p, i) => (
                  <div key={p.path}>
                    <div className="flex items-center justify-between py-1.5 text-xs">
                      <span className="truncate flex-1 min-w-0">{p.label}</span>
                      <span className="font-semibold shrink-0 ml-2">{p.count}</span>
                    </div>
                    {i < data!.topPages.length - 1 && <Separator />}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">সাম্প্রতিক ভিজিটর জার্নি</CardTitle>
          <p className="text-[10px] text-muted-foreground">সর্বশেষ ২০টা সেশন কোন কোন পেজে ঘুরেছে — যেকোনো সময়-রেঞ্জ থেকে স্বাধীন, সবসময় সবচেয়ে সাম্প্রতিক</p>
        </CardHeader>
        <CardContent className="pt-0">
          {journeysLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : journeys.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">এখনো কোনো ভিজিটর জার্নি রেকর্ড হয়নি</p>
          ) : (
            <ScrollArea className="max-h-[420px]">
              <div className="space-y-3">
                {journeys.map((j, idx) => {
                  const visibleChips = j.labeledPages.slice(0, 5);
                  const extra = j.labeledPages.length - visibleChips.length;
                  return (
                    <div key={j.sessionId}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(j.lastSeen), { addSuffix: true, locale: bn })}
                        </span>
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0">{j.labeledPages.length} পেজ</Badge>
                      </div>
                      <div className="flex items-center flex-wrap gap-1">
                        {visibleChips.map((p, i) => (
                          <span key={i} className="flex items-center gap-1">
                            {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 font-normal whitespace-nowrap">{p.label}</Badge>
                          </span>
                        ))}
                        {extra > 0 && (
                          <span className="flex items-center gap-1">
                            <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 font-normal">+{extra} আরও</Badge>
                          </span>
                        )}
                      </div>
                      {idx < journeys.length - 1 && <Separator className="mt-3" />}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
