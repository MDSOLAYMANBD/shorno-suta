import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Globe, Ban, Search, AlertTriangle, Calendar, Hash, TrendingUp, Users } from 'lucide-react';
import { useUpdateSetting, useStoreSettings } from '@/hooks/useStoreSettings';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface IpStats {
  ip: string;
  total: number;
  today: number;
  cancelled: number;
  pending: number;
  phones: Set<string>;
  names: Set<string>;
  lastOrderAt: string;
}

export default function FraudIpOverviewTab() {
  const { data: settings } = useStoreSettings();
  const updateSetting = useUpdateSetting();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'today' | 'suspicious' | 'repeat'>('all');

  const blockedIps: string[] = useMemo(() => {
    try { return JSON.parse(settings?.['blocked_ips'] || '[]'); } catch { return []; }
  }, [settings]);

  const { data: orders = [] } = useQuery({
    queryKey: ['fraud-ip-overview-orders'],
    queryFn: async () => {
      const sinceIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('orders')
        .select('customer_phone, customer_name, status, created_at, order_attribution')
        .is('deleted_at', null)
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const ipStats = useMemo(() => {
    const map = new Map<string, IpStats>();
    const todayStr = new Date().toISOString().slice(0, 10);

    for (const o of orders) {
      const ip = (o.order_attribution as any)?.client_ip;
      if (!ip || ip === 'unknown') continue;
      if (!map.has(ip)) {
        map.set(ip, { ip, total: 0, today: 0, cancelled: 0, pending: 0, phones: new Set(), names: new Set(), lastOrderAt: o.created_at });
      }
      const s = map.get(ip)!;
      s.total++;
      if (o.created_at?.startsWith(todayStr)) s.today++;
      if (['cancelled', 'delivery_failed', 'paid_return'].includes(o.status)) s.cancelled++;
      if (['pending', 'confirmed'].includes(o.status)) s.pending++;
      if (o.customer_phone) s.phones.add(o.customer_phone);
      if (o.customer_name) s.names.add(o.customer_name);
      if (o.created_at > s.lastOrderAt) s.lastOrderAt = o.created_at;
    }

    let arr = Array.from(map.values());

    if (filter === 'today') arr = arr.filter(s => s.today >= 2);
    if (filter === 'suspicious') arr = arr.filter(s => s.phones.size >= 3 || s.cancelled >= 2);
    if (filter === 'repeat') arr = arr.filter(s => s.total >= 3);

    if (search) {
      const q = search.toLowerCase();
      arr = arr.filter(s =>
        s.ip.includes(q) ||
        Array.from(s.phones).some(p => p.includes(q)) ||
        Array.from(s.names).some(n => n.toLowerCase().includes(q))
      );
    }

    arr.sort((a, b) => b.phones.size - a.phones.size || b.total - a.total);
    return arr;
  }, [orders, filter, search]);

  const blockIp = async (ip: string) => {
    if (blockedIps.includes(ip)) { toast.error('এই IP আগেই ব্লক করা আছে'); return; }
    const updated = [...blockedIps, ip];
    await updateSetting.mutateAsync({ key: 'blocked_ips', value: JSON.stringify(updated) });
    toast.success(`${ip} ব্লক করা হয়েছে`);
  };

  const filters = [
    { key: 'all', label: 'সব', icon: Hash },
    { key: 'today', label: 'আজকে ২+', icon: Calendar },
    { key: 'suspicious', label: 'সন্দেহজনক', icon: AlertTriangle },
    { key: 'repeat', label: 'বারবার (৩+)', icon: TrendingUp },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="IP, ফোন বা নাম দিয়ে খুঁজুন..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
              filter === f.key
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card border-border text-muted-foreground hover:border-primary/40'
            }`}
          >
            <f.icon className="h-3 w-3" />
            {f.label}
          </button>
        ))}
      </div>

      <div className="text-xs text-muted-foreground">
        মোট {ipStats.length} টি IP পাওয়া গেছে (শেষ ৩০ দিন)
      </div>

      <div className="space-y-2">
        {ipStats.slice(0, 100).map(s => {
          const isBlocked = blockedIps.includes(s.ip);
          const isSuspicious = s.phones.size >= 3 || s.cancelled >= 2;

          return (
            <Card key={s.ip} className={isSuspicious ? 'border-destructive/40' : ''}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm font-mono font-semibold">{s.ip}</span>
                      {isBlocked && (
                        <Badge variant="destructive" className="text-[9px] px-1.5 py-0">ব্লকড</Badge>
                      )}
                      {isSuspicious && !isBlocked && (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-destructive/50 text-destructive">
                          <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />সন্দেহজনক
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {Array.from(s.names).slice(0, 3).join(', ')}
                    </p>
                    <p className="text-[11px] text-muted-foreground font-mono truncate">
                      {Array.from(s.phones).slice(0, 4).join(', ')}
                      {s.phones.size > 4 && ` +${s.phones.size - 4}`}
                    </p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                      <span className="flex items-center gap-1">
                        <Hash className="h-3 w-3" /> অর্ডার: <strong>{s.total}</strong>
                      </span>
                      <span className="flex items-center gap-1 text-primary">
                        <Users className="h-3 w-3" /> ফোন: <strong>{s.phones.size}</strong>
                      </span>
                      {s.today > 0 && (
                        <span className="flex items-center gap-1 text-orange-600">
                          <Calendar className="h-3 w-3" /> আজকে: <strong>{s.today}</strong>
                        </span>
                      )}
                      {s.cancelled > 0 && (
                        <span className="text-destructive">বাতিল: {s.cancelled}</span>
                      )}
                      {s.pending > 0 && (
                        <span className="text-primary">পেন্ডিং: {s.pending}</span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      শেষ অর্ডার: {format(new Date(s.lastOrderAt), 'dd/MM/yyyy hh:mm a')}
                    </p>
                  </div>
                  {!isBlocked && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 text-destructive border-destructive/30 hover:bg-destructive hover:text-destructive-foreground text-xs gap-1"
                      onClick={() => blockIp(s.ip)}
                      disabled={updateSetting.isPending}
                    >
                      <Ban className="h-3 w-3" />
                      ব্লক
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {ipStats.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            কোনো IP ডেটা পাওয়া যায়নি। নতুন অর্ডার থেকে IP ক্যাপচার শুরু হবে।
          </p>
        )}
      </div>
    </div>
  );
}
