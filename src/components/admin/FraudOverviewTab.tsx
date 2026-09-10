import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Shield, Ban, Search, AlertTriangle, Phone, Calendar, Hash, TrendingUp } from 'lucide-react';
import { useUpdateSetting, useStoreSettings } from '@/hooks/useStoreSettings';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface PhoneStats {
  phone: string;
  total: number;
  today: number;
  cancelled: number;
  returned: number;
  pending: number;
  lastOrderAt: string;
  names: string[];
}

export default function FraudOverviewTab() {
  const { data: settings } = useStoreSettings();
  const updateSetting = useUpdateSetting();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'today' | 'suspicious' | 'repeat'>('all');

  const blockedPhones: string[] = useMemo(() => {
    try { return JSON.parse(settings?.['blocked_phones'] || '[]'); } catch { return []; }
  }, [settings]);

  const { data: orders = [] } = useQuery({
    queryKey: ['fraud-overview-orders'],
    queryFn: async () => {
      const { data } = await supabase
        .from('orders')
        .select('customer_phone, customer_name, status, created_at')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const phoneStats = useMemo(() => {
    const map = new Map<string, PhoneStats>();
    const todayStr = new Date().toISOString().slice(0, 10);

    for (const o of orders) {
      const phone = o.customer_phone;
      if (!map.has(phone)) {
        map.set(phone, { phone, total: 0, today: 0, cancelled: 0, returned: 0, pending: 0, lastOrderAt: o.created_at, names: [] });
      }
      const s = map.get(phone)!;
      s.total++;
      if (o.created_at?.startsWith(todayStr)) s.today++;
      if (['cancelled', 'delivery_failed'].includes(o.status)) s.cancelled++;
      if (['paid_return'].includes(o.status)) s.returned++;
      if (['pending', 'confirmed'].includes(o.status)) s.pending++;
      if (!s.names.includes(o.customer_name)) s.names.push(o.customer_name);
      if (o.created_at > s.lastOrderAt) s.lastOrderAt = o.created_at;
    }

    let arr = Array.from(map.values());

    // Apply filters
    if (filter === 'today') arr = arr.filter(s => s.today >= 2);
    if (filter === 'suspicious') arr = arr.filter(s => s.cancelled + s.returned >= 2);
    if (filter === 'repeat') arr = arr.filter(s => s.total >= 3);

    // Search
    if (search) {
      const q = search.toLowerCase();
      arr = arr.filter(s => s.phone.includes(q) || s.names.some(n => n.toLowerCase().includes(q)));
    }

    // Sort by total desc
    arr.sort((a, b) => b.total - a.total);

    return arr;
  }, [orders, filter, search]);

  const blockPhone = async (phone: string) => {
    if (blockedPhones.includes(phone)) {
      toast.error('এই নম্বরটি আগেই ব্লক করা আছে');
      return;
    }
    const updated = [...blockedPhones, phone];
    await updateSetting.mutateAsync({ key: 'blocked_phones', value: JSON.stringify(updated) });
    toast.success(`${phone} ব্লক করা হয়েছে`);
  };

  const filters = [
    { key: 'all', label: 'সব', icon: Hash },
    { key: 'today', label: 'আজকে ২+ অর্ডার', icon: Calendar },
    { key: 'suspicious', label: 'সন্দেহজনক', icon: AlertTriangle },
    { key: 'repeat', label: 'বারবার (৩+)', icon: TrendingUp },
  ] as const;

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="ফোন নম্বর বা নাম দিয়ে খুঁজুন..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Filter pills */}
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

      {/* Stats summary */}
      <div className="text-xs text-muted-foreground">
        মোট {phoneStats.length} টি নম্বর পাওয়া গেছে
      </div>

      {/* Phone list */}
      <div className="space-y-2">
        {phoneStats.slice(0, 50).map(s => {
          const isBlocked = blockedPhones.includes(s.phone);
          const isSuspicious = s.cancelled + s.returned >= 2;

          return (
            <Card key={s.phone} className={isSuspicious ? 'border-destructive/40' : ''}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-mono font-semibold">{s.phone}</span>
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
                      {s.names.slice(0, 3).join(', ')}
                    </p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                      <span className="flex items-center gap-1">
                        <Hash className="h-3 w-3" /> মোট: <strong>{s.total}</strong>
                      </span>
                      {s.today > 0 && (
                        <span className="flex items-center gap-1 text-orange-600">
                          <Calendar className="h-3 w-3" /> আজকে: <strong>{s.today}</strong>
                        </span>
                      )}
                      {s.cancelled > 0 && (
                        <span className="text-destructive">বাতিল: {s.cancelled}</span>
                      )}
                      {s.returned > 0 && (
                        <span className="text-destructive">রিটার্ন: {s.returned}</span>
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
                      onClick={() => blockPhone(s.phone)}
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
        {phoneStats.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">কোনো ডেটা পাওয়া যায়নি</p>
        )}
      </div>
    </div>
  );
}
