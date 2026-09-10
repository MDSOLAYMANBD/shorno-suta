// Reusable customer profile drawer. Future modules (Orders / Live Chat /
// Marketing) mount this same component with `phone` prop.
import { useQuery } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { detectDistrict } from '@/lib/audience/districts';

interface Props {
  phone: string | null;
  onClose: () => void;
}

interface CustomerDetail {
  id: string | null;
  phone: string;
  name: string;
  address: string;
  total_orders: number;
  delivered_orders: number;
  total_spent: number;
  last_order_date: string | null;
  created_at: string | null;
  district: string | null;
  tags: { id: string; name: string; color: string | null }[];
  notes: { id: string; note: string; created_at: string }[];
  recentOrders: { id: string; order_number: string; total: number; status: string; created_at: string }[];
}

export default function CustomerDrawer({ phone, onClose }: Props) {
  const { data, isLoading } = useQuery({
    enabled: !!phone,
    queryKey: ['customer-detail', phone],
    queryFn: async (): Promise<CustomerDetail | null> => {
      if (!phone) return null;
      const variants = [phone.replace(/^880/, ''), phone.replace(/^880/, '0'), phone, '+' + phone];
      const { data: cust } = await supabase
        .from('customers')
        .select('id, phone, name, address, total_orders, delivered_orders, total_spent, last_order_date, created_at')
        .in('phone', variants).maybeSingle();
      const base = cust as any;

      let tags: any[] = [];
      let notes: any[] = [];
      if (base?.id) {
        const [{ data: ct }, { data: nt }] = await Promise.all([
          (supabase.from('crm_customer_tags') as any).select('tag_id, crm_tags(id, name, color)').eq('customer_id', base.id),
          (supabase.from('crm_notes') as any).select('id, note, created_at').eq('customer_id', base.id).order('created_at', { ascending: false }).limit(5),
        ]);
        tags = (ct || []).map((r: any) => r.crm_tags).filter(Boolean);
        notes = nt || [];
      }

      const { data: orders } = await supabase
        .from('orders')
        .select('id, order_number, total, status, created_at')
        .in('customer_phone', variants)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(5);

      const addr = base?.address || '';
      return {
        id: base?.id ?? null,
        phone,
        name: base?.name || '—',
        address: addr,
        total_orders: base?.total_orders ?? 0,
        delivered_orders: base?.delivered_orders ?? 0,
        total_spent: Number(base?.total_spent ?? 0),
        last_order_date: base?.last_order_date ?? null,
        created_at: base?.created_at ?? null,
        district: detectDistrict(addr)?.name ?? null,
        tags,
        notes,
        recentOrders: (orders as any[]) ?? [],
      };
    },
  });

  return (
    <Sheet open={!!phone} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Customer Profile</SheetTitle>
        </SheetHeader>
        {isLoading || !data ? (
          <div className="space-y-2 mt-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : (
          <div className="space-y-4 mt-4 text-sm">
            <section>
              <div className="text-lg font-bold">{data.name}</div>
              <div className="font-mono text-xs text-muted-foreground">{data.phone}</div>
              <div className="text-xs text-muted-foreground mt-1">{data.address || '—'}</div>
              {data.district && <Badge variant="secondary" className="mt-1">📍 {data.district}</Badge>}
            </section>

            <section className="grid grid-cols-3 gap-2">
              <Stat label="Orders" value={data.total_orders} />
              <Stat label="Delivered" value={data.delivered_orders} />
              <Stat label="Spent" value={`৳${Math.round(data.total_spent).toLocaleString()}`} />
            </section>

            <section>
              <SectionTitle>Tags</SectionTitle>
              <div className="flex flex-wrap gap-1">
                {data.tags.length === 0 ? <span className="text-xs text-muted-foreground italic">No tags</span>
                  : data.tags.map((t) => (
                    <Badge key={t.id} variant="outline" style={t.color ? { borderColor: t.color, color: t.color } : undefined}>{t.name}</Badge>
                  ))}
              </div>
            </section>

            <section>
              <SectionTitle>Recent Orders</SectionTitle>
              {data.recentOrders.length === 0 ? <p className="text-xs text-muted-foreground italic">No orders</p> :
                <ul className="space-y-1">
                  {data.recentOrders.map((o) => (
                    <li key={o.id} className="flex items-center justify-between border rounded-md px-2 py-1.5 text-xs">
                      <span className="font-mono">{o.order_number}</span>
                      <span>৳{Math.round(o.total).toLocaleString()}</span>
                      <Badge variant="secondary" className="text-[10px]">{o.status}</Badge>
                    </li>
                  ))}
                </ul>
              }
            </section>

            <section>
              <SectionTitle>Notes</SectionTitle>
              {data.notes.length === 0 ? <p className="text-xs text-muted-foreground italic">No notes</p> :
                <ul className="space-y-1">
                  {data.notes.map((n) => (
                    <li key={n.id} className="rounded-md border bg-muted/30 px-2 py-1.5 text-xs">{n.note}</li>
                  ))}
                </ul>
              }
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-md border bg-muted/30 px-2 py-1.5 text-center">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono font-semibold">{value}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: any }) {
  return <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">{children}</div>;
}
