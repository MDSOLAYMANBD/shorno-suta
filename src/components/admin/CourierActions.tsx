import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Truck, MapPin } from 'lucide-react';
import CourierTrackingDialog from './CourierTrackingDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const SUPABASE_URL = 'https://xxucasikopqtcztbgfbw.supabase.co';

type CourierProvider = 'steadfast' | 'pathao' | 'redx';

const PROVIDER_CONFIG: Record<CourierProvider, { label: string; color: string; functionName: string }> = {
  steadfast: { label: 'Steadfast', color: 'bg-blue-100 text-blue-700', functionName: 'steadfast-courier' },
  pathao: { label: 'Pathao', color: 'bg-green-100 text-green-700', functionName: 'pathao-courier' },
  redx: { label: 'RedX', color: 'bg-red-100 text-red-700', functionName: 'redx-courier' },
};

interface CourierActionsProps {
  orderId: string;
  orderNumber?: string;
  consignmentId?: string | null;
  courierStatus?: string | null;
  courierProvider?: string | null;
  onUpdate: () => void;
}

export default function CourierActions({ orderId, orderNumber, consignmentId, courierStatus, courierProvider, onUpdate }: CourierActionsProps) {
  const [loading, setLoading] = useState(false);
  const [trackingOpen, setTrackingOpen] = useState(false);

  const resolvedProvider: CourierProvider = (courierProvider as CourierProvider) || 'steadfast';
  const providerInfo = PROVIDER_CONFIG[resolvedProvider] || PROVIDER_CONFIG.steadfast;

  const callCourier = async (provider: CourierProvider, action: string, body: any) => {
    const config = PROVIDER_CONFIG[provider];
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${config.functionName}?action=${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Courier API error');
    return data;
  };

  const sendToCourier = async (provider: CourierProvider) => {
    setLoading(true);
    try {
      const result = await callCourier(provider, 'create_order', { order_id: orderId });
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(`${PROVIDER_CONFIG[provider].label} এ পাঠানো হয়েছে! ID: ${result?.tracking_id || ''}`);
        onUpdate();
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };


  const shortId = consignmentId && consignmentId.length > 10 ? consignmentId.slice(0, 10) + '…' : consignmentId;

  return (
    <>
      {!consignmentId ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" disabled={loading} className="h-7 text-xs px-2">
              <Truck className="h-3 w-3 mr-1" /> কুরিয়ার
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="z-[1100]" sideOffset={5}>
            <DropdownMenuItem onClick={() => sendToCourier('steadfast')}>
              <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-2" />Steadfast
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => sendToCourier('pathao')}>
              <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-2" />Pathao
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => sendToCourier('redx')}>
              <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-2" />RedX
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="flex flex-col gap-0.5 items-end">
          <div className="flex items-center gap-1 flex-wrap justify-end">
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${providerInfo.color}`}>{providerInfo.label}</span>
            <span className="text-[10px] text-muted-foreground font-mono">{shortId}</span>
          </div>
          <div className="flex items-center gap-0.5">
            {courierStatus && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground max-w-[80px] truncate">{courierStatus}</span>
            )}
            <Button size="icon" variant="ghost" onClick={() => setTrackingOpen(true)} title="ট্র্যাকিং দেখুন" className="h-6 w-6">
              <MapPin className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      <CourierTrackingDialog
        open={trackingOpen}
        onOpenChange={setTrackingOpen}
        orderId={orderId}
        orderNumber={orderNumber}
        consignmentId={consignmentId}
        courierStatus={courierStatus}
        courierProvider={courierProvider}
        onUpdate={onUpdate}
      />
    </>
  );
}
