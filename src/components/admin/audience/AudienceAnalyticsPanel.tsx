// Reusable analytics card for any audience engine consumer.
// Renders the AudienceStats produced by `computeAudienceStats`.

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3 } from 'lucide-react';
import type { AudienceStats } from '@/lib/audience/analytics';

interface Props {
  stats: AudienceStats;
  loading?: boolean;
}

export default function AudienceAnalyticsPanel({ stats, loading }: Props) {
  const cod = stats.codCount;
  const prepaid = stats.prepaidCount;
  const codPct = stats.total ? Math.round((cod / stats.total) * 100) : 0;
  const prepaidPct = 100 - codPct;
  const maxDistrict = stats.districts[0]?.count || 1;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <BarChart3 className="h-4 w-4" /> অডিয়েন্স এনালিটিক্স
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Stat label="মোট" value={stats.total} />
          <Stat label="VIP" value={stats.vip} tone="amber" />
          <Stat label="রিপিট" value={stats.repeat} tone="blue" />
          <Stat label="ডেলিভার্ড" value={stats.delivered} tone="emerald" />
          <Stat label="গড় অর্ডার" value={stats.averageOrders} />
          <Stat label="গড় খরচ" value={`৳${stats.averageSpend.toLocaleString()}`} />
          <Stat label="COD" value={`${cod} (${codPct}%)`} />
          <Stat label="Prepaid" value={`${prepaid} (${prepaidPct}%)`} />
        </div>

        {stats.districts.length > 0 && (
          <div>
            <p className="text-[11px] font-medium text-muted-foreground mb-1.5">শীর্ষ জেলা</p>
            <div className="space-y-1">
              {stats.districts.map((d) => (
                <div key={d.name} className="flex items-center gap-2 text-xs">
                  <span className="w-20 truncate">{d.name}</span>
                  <div className="flex-1 h-1.5 bg-muted rounded overflow-hidden">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${(d.count / maxDistrict) * 100}%` }}
                    />
                  </div>
                  <Badge variant="secondary" className="h-4 px-1 text-[10px]">{d.count}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading && <p className="text-[11px] text-muted-foreground">লোড হচ্ছে...</p>}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, tone }: { label: string; value: any; tone?: 'amber' | 'blue' | 'emerald' }) {
  const cls = tone === 'amber' ? 'text-amber-600'
    : tone === 'blue' ? 'text-blue-600'
    : tone === 'emerald' ? 'text-emerald-600'
    : 'text-foreground';
  return (
    <div className="rounded-md border p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`font-mono text-sm font-semibold ${cls}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
    </div>
  );
}
