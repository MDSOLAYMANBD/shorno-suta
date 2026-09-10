import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Phone, MapPin, ShoppingCart, Package, CheckCircle, XCircle, Clock, TrendingUp, Star, Copy } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { getColorPrimaryImage } from '@/lib/productVariants';

function getOrderItemImage(item: any): string | null {
  const colorImages = (item.products?.variant_images as any)?.color_images;
  return getColorPrimaryImage(colorImages, item.color) || item.products?.images?.[0] || null;
}

interface CustomerProfileDialogProps {
  customer: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: 'পেন্ডিং', color: 'bg-yellow-100 text-yellow-800' },
  confirmed: { label: 'কনফার্মড', color: 'bg-blue-100 text-blue-800' },
  shipped: { label: 'শিপড', color: 'bg-purple-100 text-purple-800' },
  delivered: { label: 'ডেলিভারড', color: 'bg-green-100 text-green-800' },
  cancelled: { label: 'ক্যান্সেলড', color: 'bg-red-100 text-red-800' },
  delivery_failed: { label: 'ফেইলড', color: 'bg-orange-100 text-orange-800' },
  paid_return: { label: 'রিটার্ন', color: 'bg-gray-100 text-gray-800' },
  office_sell: { label: 'অফিস সেল', color: 'bg-teal-100 text-teal-800' },
};

export default function CustomerProfileDialog({ customer, open, onOpenChange }: CustomerProfileDialogProps) {
  const phone = customer?.phone || '';

  const { data, isLoading } = useQuery({
    queryKey: ['customer-profile-orders', phone],
    queryFn: async () => {
      if (!phone) return { orders: [], items: [] };

      // Fetch orders by phone (normalize)
      const cleanPhone = phone.replace(/\s+/g, '').replace(/^\+?88/, '');
      const phones = [cleanPhone, '+88' + cleanPhone, '88' + cleanPhone];

      const { data: orders } = await supabase
        .from('orders')
        .select('id, order_number, status, total, created_at, delivery_charge')
        .is('deleted_at', null)
        .in('customer_phone', phones)
        .order('created_at', { ascending: false });

      if (!orders || orders.length === 0) return { orders: [], items: [] };

      // Fetch order items in batches of 50
      const orderIds = orders.map(o => o.id);
      const allItems: any[] = [];
      for (let i = 0; i < orderIds.length; i += 50) {
        const batch = orderIds.slice(i, i + 50);
        // order_items has two FKs to products (product_id, parent_product_id) —
        // the relationship must be named explicitly or PostgREST can't tell
        // which to embed and silently fails the whole query (PGRST201),
        // leaving every order in this dialog showing "প্রোডাক্ট তথ্য নেই".
        const { data: items, error: itemsError } = await supabase
          .from('order_items')
          .select('order_id, product_name, quantity, size, color, price, products!order_items_product_id_fkey(images, variant_images)')
          .in('order_id', batch);
        if (itemsError) console.error('[CustomerProfileDialog] order_items fetch failed', itemsError);
        if (items) allItems.push(...items);
      }

      return { orders, items: allItems };
    },
    enabled: open && !!phone,
  });

  const orders = data?.orders || [];
  const items = data?.items || [];

  // Status counts
  const statusCounts = orders.reduce((acc: Record<string, number>, o: any) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});

  const delivered = statusCounts['delivered'] || 0;
  const cancelled = statusCounts['cancelled'] || 0;
  const pending = (statusCounts['pending'] || 0) + (statusCounts['confirmed'] || 0);
  const totalSpent = orders.filter((o: any) => o.status === 'delivered').reduce((s: number, o: any) => s + (o.total || 0), 0);
  const avgOrderValue = delivered > 0 ? Math.round(totalSpent / delivered) : 0;

  // Group items by their own order, so each order card shows exactly what was
  // bought in that order — instead of a "products" list and an "order history"
  // table that had no visible connection to each other.
  const itemsByOrder = new Map<string, any[]>();
  items.forEach((item: any) => {
    const arr = itemsByOrder.get(item.order_id) || [];
    arr.push(item);
    itemsByOrder.set(item.order_id, arr);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Star className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-lg">{customer?.name || 'Unknown'}</p>
              <p className="text-sm font-normal text-muted-foreground flex items-center gap-1 flex-wrap">
                <Phone className="h-3 w-3" /> {customer?.phone}
                {customer?.phone && (
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard.writeText(customer.phone); toast.success('নম্বর কপি হয়েছে'); }}
                    className="p-0.5 rounded hover:bg-muted"
                    title="নম্বর কপি করুন"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                )}
                {customer?.address && (
                  <span className="ml-2 flex items-center gap-1"><MapPin className="h-3 w-3" /> {customer.address}</span>
                )}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <p className="text-center py-8 text-muted-foreground">লোড হচ্ছে...</p>
        ) : (
          <div className="space-y-4 mt-2">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Card><CardContent className="p-3 text-center">
                <ShoppingCart className="h-4 w-4 mx-auto text-primary mb-1" />
                <p className="text-xl font-bold">{orders.length}</p>
                <p className="text-[10px] text-muted-foreground">মোট অর্ডার</p>
              </CardContent></Card>
              <Card><CardContent className="p-3 text-center">
                <CheckCircle className="h-4 w-4 mx-auto text-green-500 mb-1" />
                <p className="text-xl font-bold text-green-600">{delivered}</p>
                <p className="text-[10px] text-muted-foreground">ডেলিভারড</p>
              </CardContent></Card>
              <Card><CardContent className="p-3 text-center">
                <XCircle className="h-4 w-4 mx-auto text-red-500 mb-1" />
                <p className="text-xl font-bold text-red-600">{cancelled}</p>
                <p className="text-[10px] text-muted-foreground">ক্যান্সেলড</p>
              </CardContent></Card>
              <Card><CardContent className="p-3 text-center">
                <TrendingUp className="h-4 w-4 mx-auto text-primary mb-1" />
                <p className="text-xl font-bold">৳{avgOrderValue.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">গড় অর্ডার</p>
              </CardContent></Card>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">মোট খরচ (ডেলিভারড)</p>
              <p className="text-lg font-bold text-primary">৳{totalSpent.toLocaleString()}</p>
            </div>

            {/* Order History — each order shown as one card together with exactly what
                was bought in it, instead of a separate disconnected products list. */}
            {orders.length > 0 ? (
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-1"><Clock className="h-4 w-4" /> অর্ডার হিস্ট্রি</h3>
                <div className="space-y-2">
                  {orders.map((o: any) => {
                    const st = statusLabels[o.status] || { label: o.status, color: 'bg-muted text-foreground' };
                    const orderItems = itemsByOrder.get(o.id) || [];
                    return (
                      <div key={o.id} className="border border-border rounded-lg overflow-hidden">
                        <div className="flex items-center justify-between gap-2 px-3 py-2 bg-muted/40">
                          <div className="flex items-center gap-2 min-w-0 flex-wrap">
                            <span className="text-xs font-semibold">{o.order_number}</span>
                            <span className="text-[10px] text-muted-foreground">{format(new Date(o.created_at), 'dd/MM/yy')}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                          </div>
                          <span className="text-sm font-bold shrink-0">৳{(o.total || 0).toLocaleString()}</span>
                        </div>
                        {orderItems.length > 0 ? (
                          <div className="divide-y divide-border">
                            {orderItems.map((item: any, i: number) => {
                              const variant = [item.size, item.color].filter(Boolean).join('/');
                              const img = getOrderItemImage(item);
                              return (
                                <div key={i} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm">
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    {img ? (
                                      <img src={img} alt="" loading="lazy" className="w-8 h-8 rounded border object-cover shrink-0" />
                                    ) : (
                                      <div className="w-8 h-8 rounded border bg-muted flex items-center justify-center shrink-0">
                                        <Package className="h-3 w-3 text-muted-foreground" />
                                      </div>
                                    )}
                                    <span className="truncate">{item.product_name}</span>
                                  </div>
                                  {variant && <span className="text-xs text-muted-foreground shrink-0 max-w-[100px] truncate">{variant}</span>}
                                  <Badge variant="secondary" className="text-[10px] shrink-0">{item.quantity || 1}x</Badge>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground text-center py-2">প্রোডাক্ট তথ্য নেই</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4">কোনো অর্ডার পাওয়া যায়নি</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
