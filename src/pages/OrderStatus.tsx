import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/layout/Layout';
import SEOHead from '@/components/SEOHead';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Package, CheckCircle, Circle, Truck, MapPin, XCircle, Clock, Loader2, User, Phone, Building2 } from 'lucide-react';

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  price: number;
  size: string | null;
  color: string | null;
}

interface TrackingEvent {
  id: string;
  status: string | null;
  note: string | null;
  rider_name: string | null;
  rider_phone: string | null;
  hub_name: string | null;
  hub_phone: string | null;
  created_at: string;
}

interface Order {
  id: string;
  order_number: string;
  delivery_charge: number;
  subtotal: number;
  total: number;
  status: string;
  created_at: string;
  courier_consignment_id: string | null;
  courier_status: string | null;
  discount_note: string | null;
  free_shipping: boolean | null;
  items: OrderItem[];
  tracking_events: TrackingEvent[];
}

const STATUS_STEPS = [
  { key: 'pending', label: 'অর্ডার গৃহীত', icon: Clock },
  { key: 'confirmed', label: 'নিশ্চিত', icon: CheckCircle },
  { key: 'shipped', label: 'শিপিং', icon: Truck },
  { key: 'delivered', label: 'ডেলিভারি সম্পন্ন', icon: MapPin },
];

function getStepIndex(status: string) {
  const idx = STATUS_STEPS.findIndex(s => s.key === status);
  return idx === -1 ? -1 : idx;
}

function StatusTimeline({ status }: { status: string }) {
  const isCancelled = status === 'cancelled';
  const currentIdx = getStepIndex(status);

  if (isCancelled) {
    return (
      <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-4 flex items-center gap-3">
        <XCircle className="h-6 w-6 text-destructive" />
        <div>
          <p className="font-semibold text-destructive">অর্ডার বাতিল করা হয়েছে</p>
          <p className="text-sm text-muted-foreground">এই অর্ডারটি বাতিল হয়ে গেছে।</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between w-full py-4">
      {STATUS_STEPS.map((step, idx) => {
        const isCompleted = idx <= currentIdx;
        const isCurrent = idx === currentIdx;

        return (
          <div key={step.key} className="flex flex-col items-center flex-1 relative">
            {idx > 0 && (
              <div
                className={`absolute top-5 -left-1/2 w-full h-0.5 -z-10 ${
                  idx <= currentIdx ? 'bg-accent' : 'bg-border'
                }`}
              />
            )}
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                isCompleted
                  ? 'bg-accent text-accent-foreground'
                  : 'bg-muted text-muted-foreground'
              } ${isCurrent ? 'ring-4 ring-accent/30 animate-pulse' : ''}`}
            >
              {isCompleted ? <CheckCircle className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
            </div>
            <span
              className={`text-xs mt-2 text-center font-medium ${
                isCompleted ? 'text-foreground' : 'text-muted-foreground'
              }`}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function TrackingTimeline({ events }: { events: TrackingEvent[] }) {
  if (events.length === 0) return null;

  return (
    <div className="space-y-1">
      <h4 className="text-sm font-semibold mb-3">কুরিয়ার ট্র্যাকিং হিস্টোরি</h4>
      <div className="relative pl-6 space-y-4">
        {/* Vertical line */}
        <div className="absolute left-[9px] top-2 bottom-2 w-0.5 bg-border" />
        {[...events].reverse().map((evt, i) => (
          <div key={evt.id} className="relative">
            <div className={`absolute -left-6 top-1 w-[18px] h-[18px] rounded-full border-2 ${
              i === 0 ? 'bg-accent border-accent' : 'bg-background border-muted-foreground/40'
            }`} />
            <div className="bg-muted/50 rounded-md p-3 text-sm space-y-1">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <span className="font-medium">{evt.status || 'আপডেট'}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(evt.created_at).toLocaleString('bn-BD', { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
              </div>
              {evt.note && <p className="text-muted-foreground">{evt.note}</p>}
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                {evt.rider_name && (
                  <span className="inline-flex items-center gap-1">
                    <User className="h-3 w-3" /> {evt.rider_name}
                    {evt.rider_phone && (
                      <a href={`tel:${evt.rider_phone}`} className="text-primary hover:underline">
                        <Phone className="h-3 w-3 inline" /> {evt.rider_phone}
                      </a>
                    )}
                  </span>
                )}
                {evt.hub_name && (
                  <span className="inline-flex items-center gap-1">
                    <Building2 className="h-3 w-3" /> {evt.hub_name}
                    {evt.hub_phone && (
                      <a href={`tel:${evt.hub_phone}`} className="text-primary hover:underline">
                        <Phone className="h-3 w-3 inline" /> {evt.hub_phone}
                      </a>
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OrderStatus() {
  const [phone, setPhone] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedPhone = phone.trim();
    if (!trimmedPhone) return;

    setLoading(true);
    setSearched(true);
    setErrorMsg('');

    try {
      const response = await supabase.functions.invoke('order-lookup', {
        body: { phone: trimmedPhone },
      });

      if (response.error) throw response.error;

      const result = response.data;
      if (result.error) {
        setErrorMsg(result.error);
        setOrders([]);
        return;
      }

      setOrders(result.orders || []);
    } catch (err) {
      console.error('Search error:', err);
      setErrorMsg('সার্চ করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <SEOHead title="অর্ডার ট্র্যাক | স্বর্ণ সুতা" description="আপনার অর্ডারের বর্তমান অবস্থা ট্র্যাক করুন। ফোন নম্বর দিয়ে সার্চ করুন।" canonical="/order-status" />
      <div className="min-h-[60vh] max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Package className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">অর্ডার ট্র্যাক করুন</h1>
          <p className="text-muted-foreground mt-2">আপনার ফোন নম্বর দিয়ে সার্চ করুন</p>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="mb-8">
          <div className="flex gap-2">
            <Input
              placeholder="ফোন নম্বর (যেমন: 01XXXXXXXXX)"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="flex-1"
              type="tel"
            />
            <Button type="submit" disabled={loading || !phone.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="ml-1 hidden sm:inline">সার্চ</span>
            </Button>
          </div>
          {errorMsg && (
            <p className="text-sm text-destructive text-center mt-2">{errorMsg}</p>
          )}
        </form>

        {/* Results */}
        {loading && (
          <div className="text-center py-12 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
            <p>সার্চ করা হচ্ছে...</p>
          </div>
        )}

        {!loading && searched && orders.length === 0 && !errorMsg && (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground">কোনো অর্ডার পাওয়া যায়নি।</p>
            <p className="text-sm text-muted-foreground mt-1">অনুগ্রহ করে সঠিক ফোন নম্বর দিন।</p>
          </div>
        )}

        {!loading && orders.length > 0 && (
          <p className="text-sm text-muted-foreground mb-4 text-center">{orders.length}টি অর্ডার পাওয়া গেছে</p>
        )}

        {!loading && orders.map(order => (
          <Card key={order.id} className="mb-6 overflow-hidden border shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-lg">{order.order_number}</CardTitle>
                <Badge
                  variant={order.status === 'delivered' ? 'default' : order.status === 'cancelled' ? 'destructive' : 'secondary'}
                >
                  {order.status === 'pending' && 'অপেক্ষমান'}
                  {order.status === 'confirmed' && 'নিশ্চিত'}
                  {order.status === 'in_review' && 'কুরিয়ারে হস্তান্তর'}
                  {order.status === 'shipped' && 'শিপিং'}
                  {order.status === 'delivered' && 'ডেলিভারি সম্পন্ন'}
                  {order.status === 'cancelled' && 'বাতিল'}
                  {!['pending', 'confirmed', 'in_review', 'shipped', 'delivered', 'cancelled'].includes(order.status) && order.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                তারিখ: {new Date(order.created_at).toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Timeline */}
              <StatusTimeline status={order.status} />

              {/* Courier info */}
              {order.courier_consignment_id && (
                <div className="rounded-md bg-muted p-3 text-sm">
                  <span className="font-medium">কুরিয়ার কনসাইনমেন্ট আইডি:</span>{' '}
                  <span className="font-mono">{order.courier_consignment_id}</span>
                  {order.courier_status && (
                    <span className="ml-2 text-muted-foreground">({order.courier_status})</span>
                  )}
                </div>
              )}

              {/* Courier Tracking Events */}
              <TrackingTimeline events={order.tracking_events} />

              {/* Order Items */}
              <div>
                <h4 className="text-sm font-semibold mb-2">অর্ডার আইটেমস</h4>
                <div className="divide-y divide-border rounded-md border">
                  {order.items.map(item => (
                    <div key={item.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <div>
                        <span className="font-medium">{item.product_name}</span>
                        {(item.size || item.color) && (
                          <span className="text-muted-foreground ml-1">
                            ({[item.size, item.color].filter(Boolean).join(', ')})
                          </span>
                        )}
                        <span className="text-muted-foreground"> × {item.quantity}</span>
                      </div>
                      <span className="font-medium">৳{item.price * item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Price Summary */}
              <div className="space-y-1 text-sm border-t pt-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">সাবটোটাল</span>
                  <span>৳{order.subtotal}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ডেলিভারি চার্জ</span>
                  <span>{order.free_shipping ? <span className="font-bold text-green-600">ফ্রি</span> : `৳${order.delivery_charge}`}</span>
                </div>
                {(() => {
                  const disc = Number(order.subtotal || 0) + (order.free_shipping ? 0 : Number(order.delivery_charge || 0)) - Number(order.total || 0);
                  return disc > 0 ? (
                    <div className="flex justify-between text-red-500">
                      <span className="text-muted-foreground">ডিসকাউন্ট</span>
                      <span>-৳{disc}</span>
                    </div>
                  ) : null;
                })()}
                {order.discount_note && (
                  <p className="text-xs italic text-muted-foreground">{order.discount_note}</p>
                )}
                <div className="flex justify-between font-bold text-base pt-1">
                  <span>মোট</span>
                  <span>৳{order.total}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </Layout>
  );
}
