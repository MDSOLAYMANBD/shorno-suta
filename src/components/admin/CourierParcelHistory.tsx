import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Package } from 'lucide-react';

interface Props {
  orderId: string;
}

interface ParcelRow {
  id: string;
  courier_name: string;
  consignment_id: string | null;
  tracking_code: string | null;
  cod_amount: number | null;
  status: string | null;
  is_active: boolean;
  reason: string | null;
  created_at: string;
  archived_at: string | null;
  deleted_at: string | null;
}

export default function CourierParcelHistory({ orderId }: Props) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['order-courier-history', orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_courier_parcels' as any)
        .select('id, courier_name, consignment_id, tracking_code, cod_amount, status, is_active, reason, created_at, archived_at, deleted_at')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as unknown as ParcelRow[]) || [];
    },
    enabled: !!orderId,
    staleTime: 30_000,
  });

  if (isLoading || rows.length === 0) return null;

  const active = rows.find((r) => r.is_active);
  const history = rows.filter((r) => !r.is_active);

  return (
    <div className="space-y-2 border border-border rounded-md p-3 bg-muted/20">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Package className="h-4 w-4 text-primary" />
        Courier Parcel
      </div>

      {active && (
        <div className="rounded-md border border-primary/30 bg-background p-2 text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-mono">#{active.consignment_id}</span>
            <Badge variant="default" className="text-[10px]">Active</Badge>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground">
            {active.tracking_code && <span>Tracking: {active.tracking_code}</span>}
            <span>COD: ৳{Math.round(Number(active.cod_amount) || 0)}</span>
            <span>Status: {active.status || '—'}</span>
            <span>{new Date(active.created_at).toLocaleString('en-GB')}</span>
          </div>
          {active.reason && active.reason !== 'seed_initial' && (
            <div className="text-[10px] text-muted-foreground italic">Reason: {active.reason}</div>
          )}
        </div>
      )}

      {history.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            History ({history.length})
          </summary>
          <div className="mt-2 space-y-1.5">
            {history.map((r) => (
              <div key={r.id} className="rounded border border-border/60 bg-background/50 p-2 space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono">#{r.consignment_id}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    Archived{r.deleted_at ? ' + Deleted' : ''}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground">
                  <span>COD: ৳{Math.round(Number(r.cod_amount) || 0)}</span>
                  <span>Status: {r.status || '—'}</span>
                  <span>{new Date(r.created_at).toLocaleString('en-GB')}</span>
                </div>
                {r.reason && <div className="text-[10px] text-muted-foreground italic">Reason: {r.reason}</div>}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
