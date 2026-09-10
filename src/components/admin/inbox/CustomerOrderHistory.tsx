import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ShoppingBag } from 'lucide-react';

interface Props {
  customerPhone: string | null;
}

function normalizePhone(phone: string): string[] {
  const clean = phone.replace(/[\s-]/g, '').replace(/^\+?88/, '');
  return [clean, '+88' + clean, '88' + clean, '0' + clean.replace(/^0/, '')].filter(Boolean);
}

export default function CustomerOrderHistory({ customerPhone }: Props) {
  const { data: orders = [] } = useQuery({
    queryKey: ['inbox-customer-orders', customerPhone],
    queryFn: async () => {
      if (!customerPhone) return [];
      const phones = normalizePhone(customerPhone);
      const { data } = await supabase
        .from('orders')
        .select('id, order_number, total, status, created_at')
        .in('customer_phone', phones)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(5);
      return (data || []) as any[];
    },
    enabled: !!customerPhone,
  });

  if (!customerPhone) return null;

  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
        <ShoppingBag className="h-3 w-3" /> অর্ডার হিস্টরি
      </p>
      {orders.length === 0 ? (
        <p className="text-xs text-muted-foreground">কোনো অর্ডার নেই</p>
      ) : (
        <div className="space-y-1">
          {orders.map((o: any) => (
            <a
              key={o.id}
              href={`/admin/orders?id=${o.id}`}
              className="flex items-center justify-between gap-2 text-xs border rounded px-2 py-1 hover:bg-muted/50 transition-colors"
            >
              <span className="font-mono">{o.order_number}</span>
              <span className="text-muted-foreground capitalize">{o.status}</span>
              <span className="font-semibold">৳{Number(o.total).toLocaleString('bn-BD')}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
