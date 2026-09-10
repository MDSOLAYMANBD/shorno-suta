import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { RefreshCw, ChevronDown, Search, Plus, Minus, Trash2, Loader2, Store, User, ArrowLeftRight, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface ExchangeItem {
  product_id?: string;
  product_name: string;
  price: number;
  quantity: number;
  size?: string;
  color?: string;
  image?: string;
}

interface OrderData {
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  delivery_area: string;
  delivery_charge: number;
  order_number: string;
  city?: string;
}

interface ExchangeSectionProps {
  orderId: string;
  orderItems: any[];
  deliveryCharge: number;
  orderData: OrderData;
  onExchangeSaved?: () => void;
}

const EXCHANGE_TYPES = [
  { value: 'store_fault', label: '🏪 দোকানের ভুল', desc: 'ফ্রি — কোনো চার্জ নেই', icon: Store },
  { value: 'customer_fault', label: '👤 কাস্টমারের ভুল', desc: 'শুধু ডেলিভারি চার্জ', icon: User },
  { value: 'product_swap', label: '🔄 প্রোডাক্ট পরিবর্তন', desc: 'দামের পার্থক্য + ডেলিভারি', icon: ArrowLeftRight },
] as const;

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  shipped: 'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  delivered: 'bg-green-100 text-green-700',
  exchange: 'bg-indigo-100 text-indigo-700',
};

const getDefaultNote = (type: string) => {
  if (type === 'store_fault') return 'আমাদের ভুলের জন্য আন্তরিকভাবে দুঃখিত। আপনার সঠিক প্রোডাক্ট পাঠানো হচ্ছে।';
  if (type === 'customer_fault') return 'আপনার অনুরোধ অনুযায়ী প্রোডাক্ট পরিবর্তন করা হচ্ছে। ডেলিভারি চার্জ প্রযোজ্য।';
  return 'আপনার পছন্দের নতুন প্রোডাক্ট পাঠানো হচ্ছে।';
};

export default function ExchangeSection({ orderId, orderItems, deliveryCharge, orderData, onExchangeSaved }: ExchangeSectionProps) {
  const qc = useQueryClient();
  const [exchangeOpen, setExchangeOpen] = useState(false);
  const [exchangeType, setExchangeType] = useState<string>('');
  const [selectedOldItems, setSelectedOldItems] = useState<Set<string>>(new Set());
  const [newItems, setNewItems] = useState<ExchangeItem[]>([]);
  const [search, setSearch] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (exchangeType) setNote(getDefaultNote(exchangeType));
  }, [exchangeType]);

  // Fetch exchange history
  const { data: exchanges = [], refetch: refetchExchanges } = useQuery({
    queryKey: ['order-exchanges', orderId],
    queryFn: async () => {
      const { data } = await (supabase.from('order_exchanges' as any) as any)
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!orderId,
  });

  // Fetch new order details for exchanges that have new_order_id
  const newOrderIds = (exchanges as any[]).map((ex: any) => ex.new_order_id).filter(Boolean);
  const { data: newOrders = [] } = useQuery({
    queryKey: ['exchange-new-orders', newOrderIds],
    queryFn: async () => {
      if (newOrderIds.length === 0) return [];
      const { data } = await supabase.from('orders').select('id, order_number, status').in('id', newOrderIds);
      return data || [];
    },
    enabled: newOrderIds.length > 0,
  });

  const newOrderMap = new Map((newOrders as any[]).map((o: any) => [o.id, o]));

  // Product search
  const { data: searchResults = [] } = useQuery({
    queryKey: ['exchange-product-search', search],
    queryFn: async () => {
      let query = supabase.from('products').select('id, name, name_bn, price, original_price, images, sizes, colors, variant_images')
        .eq('is_active', true).limit(10);
      if (search) query = query.or(`name.ilike.%${search}%,name_bn.ilike.%${search}%`);
      const { data } = await query;
      return data || [];
    },
    enabled: search.length >= 1,
  });

  const toggleOldItem = (itemId: string) => {
    setSelectedOldItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });
  };

  const addNewItem = (product: any) => {
    const basePrice = (product.original_price && product.original_price > 0 && product.original_price < product.price)
      ? product.original_price : product.price;
    setNewItems(prev => [...prev, {
      product_id: product.id,
      product_name: product.name,
      price: basePrice,
      quantity: 1,
      size: product.sizes?.[0] || '',
      color: product.colors?.[0] || '',
      image: product.images?.[0] || '',
    }]);
    setSearch('');
  };

  const removeNewItem = (idx: number) => setNewItems(prev => prev.filter((_, i) => i !== idx));
  const updateNewItem = (idx: number, key: string, val: any) => {
    setNewItems(prev => prev.map((item, i) => i === idx ? { ...item, [key]: val } : item));
  };

  // Calculations
  const oldItemsTotal = orderItems
    .filter(i => selectedOldItems.has(i.id))
    .reduce((s, i) => s + (i.price * i.quantity), 0);
  const newItemsTotal = newItems.reduce((s, i) => s + (i.price * i.quantity), 0);
  const priceDiff = newItemsTotal - oldItemsTotal;
  const extraDelivery = exchangeType === 'store_fault' ? 0 : deliveryCharge;

  let customerOwes = 0;
  let storeOwes = 0;
  if (exchangeType === 'store_fault') { customerOwes = 0; storeOwes = 0; }
  else if (exchangeType === 'customer_fault') { customerOwes = extraDelivery; storeOwes = 0; }
  else if (exchangeType === 'product_swap') {
    if (priceDiff > 0) { customerOwes = priceDiff + extraDelivery; }
    else { storeOwes = Math.abs(priceDiff); customerOwes = extraDelivery; }
  }

  // Save mutation — creates a new order
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!exchangeType) throw new Error('এক্সচেঞ্জ টাইপ সিলেক্ট করুন');
      if (selectedOldItems.size === 0) throw new Error('কমপক্ষে ১টি পুরোনো আইটেম সিলেক্ট করুন');

      const oldItemsData = orderItems
        .filter(i => selectedOldItems.has(i.id))
        .map(i => ({ product_name: i.product_name, price: i.price, quantity: i.quantity, size: i.size, color: i.color, image: i.image || null }));

      // store_fault: auto-copy old items if no new items selected; others require new items
      let finalNewItems = newItems;
      if (newItems.length === 0) {
        if (exchangeType === 'store_fault') {
          finalNewItems = orderItems
            .filter(i => selectedOldItems.has(i.id))
            .map(i => ({
              product_id: i.product_id || undefined,
              product_name: i.product_name,
              price: i.price,
              quantity: i.quantity,
              size: i.size || '',
              color: i.color || '',
              image: '',
            }));
        } else {
          throw new Error('নতুন আইটেম যোগ করুন');
        }
      }

      const newItemsData = finalNewItems.map(i => ({
        product_id: i.product_id,
        product_name: i.product_name, price: i.price, quantity: i.quantity, size: i.size, color: i.color, image: i.image,
      }));

      const { data: { session } } = await supabase.auth.getSession();

      // 1. Create a new order — billing reflects already-paid credit
      const exchangeNote = `এক্সচেঞ্জ অর্ডার — মূল অর্ডার: #${orderData.order_number}${note ? `\n${note}` : ''}`;
      const finalNewTotal = finalNewItems.reduce((s, i) => s + (i.price * i.quantity), 0);

      let creditDiscount = 0;
      let finalOrderTotal = 0;
      if (exchangeType === 'store_fault') {
        creditDiscount = finalNewTotal;
        finalOrderTotal = 0;
      } else if (exchangeType === 'customer_fault') {
        creditDiscount = finalNewTotal;
        finalOrderTotal = extraDelivery;
      } else { // product_swap
        if (priceDiff >= 0) {
          creditDiscount = oldItemsTotal;
          finalOrderTotal = priceDiff + extraDelivery;
        } else {
          creditDiscount = finalNewTotal;
          finalOrderTotal = extraDelivery;
        }
      }
      const discountNote = `এক্সচেঞ্জ ক্রেডিট: পূর্বে পরিশোধিত (-৳${creditDiscount})${note ? ` | ${note}` : ''}`;

      const { data: newOrder, error: orderErr } = await supabase.from('orders').insert({
        customer_name: orderData.customer_name,
        customer_phone: orderData.customer_phone,
        customer_address: orderData.customer_address,
        city: orderData.city || '',
        delivery_area: orderData.delivery_area as any,
        delivery_charge: extraDelivery,
        subtotal: finalNewTotal,
        total: finalOrderTotal,
        status: 'confirmed' as any,
        notes: exchangeNote,
        order_origin: 'exchange' as any,
        discount_note: discountNote,
        free_shipping: exchangeType === 'store_fault',
      } as any).select('id, order_number').single();

      if (orderErr) throw orderErr;

      // 2. Insert order items
      if (finalNewItems.length > 0) {
        const orderItemsToInsert = finalNewItems.map(item => ({
          order_id: newOrder.id,
          product_id: item.product_id || null,
          product_name: item.product_name,
          quantity: item.quantity,
          price: item.price,
          size: item.size || null,
          color: item.color || null,
        }));
        const { error: itemsErr } = await supabase.from('order_items').insert(orderItemsToInsert);
        if (itemsErr) throw itemsErr;
      }

      // 3. Save exchange record with new_order_id
      const { error: exErr } = await (supabase.from('order_exchanges' as any) as any).insert({
        order_id: orderId,
        exchange_type: exchangeType,
        old_items: oldItemsData,
        new_items: newItemsData,
        old_total: oldItemsTotal,
        new_total: newItemsTotal,
        price_difference: priceDiff,
        extra_delivery_charge: extraDelivery,
        customer_owes: customerOwes,
        store_owes: storeOwes,
        note: note || null,
        status: 'confirmed',
        created_by: session?.user?.id || null,
        new_order_id: newOrder.id,
      });
      if (exErr) throw exErr;

      // 4. Update original order status to 'exchange'
      await supabase.from('orders').update({ status: 'exchange' } as any).eq('id', orderId);

      // 5. Order notes
      const typeLabels: Record<string, string> = {
        store_fault: 'দোকানের ভুল (ফ্রি)',
        customer_fault: 'কাস্টমারের ভুল (ডেলিভারি চার্জ)',
        product_swap: 'প্রোডাক্ট পরিবর্তন',
      };
      await supabase.from('order_notes').insert({
        order_id: orderId,
        note: `📦 এক্সচেঞ্জ: ${typeLabels[exchangeType]} | নতুন অর্ডার: #${newOrder.order_number} | পুরোনো: ৳${oldItemsTotal} → নতুন: ৳${newItemsTotal}${note ? ` | ${note}` : ''}`,
      });

      // 6. Activity log
      if (session?.user?.id) {
        await supabase.from('activity_logs' as any).insert({
          user_id: session.user.id,
          action_type: 'order_exchange',
          entity_type: 'order',
          entity_id: orderId,
          description: `এক্সচেঞ্জ — নতুন অর্ডার #${newOrder.order_number} তৈরি হয়েছে`,
          metadata: { exchange_type: exchangeType, new_order_id: newOrder.id, new_order_number: newOrder.order_number },
        } as any);
      }

      return newOrder;
    },
    onSuccess: (newOrder) => {
      toast.success(`এক্সচেঞ্জ সেভ হয়েছে! নতুন অর্ডার: #${newOrder.order_number}`);
      refetchExchanges();
      setExchangeType('');
      setSelectedOldItems(new Set());
      setNewItems([]);
      setNote('');
      setExchangeOpen(false);
      onExchangeSaved?.();
      qc.invalidateQueries({ queryKey: ['order-notes', orderId] });
      qc.invalidateQueries({ queryKey: ['order-activity-logs', orderId] });
      qc.invalidateQueries({ queryKey: ['admin-orders'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openNewOrder = (newOrderId: string) => {
    // Navigate to the order preview by setting URL param
    const url = new URL(window.location.href);
    url.searchParams.set('preview', newOrderId);
    window.history.pushState({}, '', url.toString());
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <div className="border-t border-border pt-4">
      <Collapsible open={exchangeOpen} onOpenChange={setExchangeOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-foreground w-full">
          <RefreshCw className="h-4 w-4" />
          <span>এক্সচেঞ্জ ({exchanges.length})</span>
          <ChevronDown className="h-4 w-4 ml-auto transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 space-y-4">

          {/* Exchange History */}
          {exchanges.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">পূর্বের এক্সচেঞ্জ</p>
              {(exchanges as any[]).map((ex: any) => {
                const typeLabel = ex.exchange_type === 'store_fault' ? '🏪 দোকানের ভুল' :
                  ex.exchange_type === 'customer_fault' ? '👤 কাস্টমারের ভুল' : '🔄 প্রোডাক্ট পরিবর্তন';
                const newOrder = ex.new_order_id ? newOrderMap.get(ex.new_order_id) : null;
                const orderStatus = newOrder?.status || ex.status;
                const statusColor = STATUS_COLORS[orderStatus] || STATUS_COLORS.pending;

                return (
                  <div key={ex.id} className="p-3 rounded-lg bg-muted/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{typeLabel}</span>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full', statusColor)}>
                        {newOrder ? (
                          {
                            pending: 'পেন্ডিং', confirmed: 'কনফার্মড', shipped: 'শিপড',
                            delivered: 'ডেলিভার্ড', cancelled: 'বাতিল', completed: 'সম্পন্ন',
                            exchange: 'এক্সচেঞ্জ',
                          }[orderStatus] || orderStatus
                        ) : ex.status}
                      </span>
                    </div>

                    {/* New order link */}
                    {newOrder && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">নতুন অর্ডার:</span>
                        <button
                          onClick={() => openNewOrder(ex.new_order_id)}
                          className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                        >
                          #{newOrder.order_number}
                          <ExternalLink className="h-3 w-3" />
                        </button>
                      </div>
                    )}

                    {/* Items summary */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-muted-foreground">পুরোনো:</span> ৳{ex.old_total}</div>
                      <div><span className="text-muted-foreground">নতুন:</span> ৳{ex.new_total}</div>
                      {ex.customer_owes > 0 && <div className="text-orange-600 font-medium">কাস্টমার দেবে: ৳{ex.customer_owes}</div>}
                      {ex.store_owes > 0 && <div className="text-blue-600 font-medium">দোকান ফেরত দেবে: ৳{ex.store_owes}</div>}
                    </div>
                    {ex.note && <p className="text-xs text-muted-foreground">📝 {ex.note}</p>}
                    <p className="text-[10px] text-muted-foreground">{format(new Date(ex.created_at), 'dd MMM yyyy, hh:mm a')}</p>

                    {/* View order button */}
                    {newOrder && (
                      <div className="pt-1 border-t border-border/50">
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                          onClick={() => openNewOrder(ex.new_order_id)}>
                          <ExternalLink className="h-3 w-3" /> অর্ডার দেখুন · প্রিন্ট · কুরিয়ার
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* New Exchange Form */}
          <div className="space-y-3 p-3 rounded-lg border border-dashed border-border">
            <p className="text-sm font-semibold">নতুন এক্সচেঞ্জ</p>

            {/* Exchange Type */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {EXCHANGE_TYPES.map(t => (
                <button key={t.value} type="button" onClick={() => setExchangeType(t.value)}
                  className={cn('p-2.5 rounded-lg border text-left text-xs transition-colors',
                    exchangeType === t.value ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-muted')}>
                  <span className="font-medium block">{t.label}</span>
                  <span className="text-muted-foreground">{t.desc}</span>
                </button>
              ))}
            </div>

            {exchangeType && (
              <>
                {/* Old Items Selection */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">পুরোনো আইটেম সিলেক্ট করুন</p>
                  {orderItems.map((item: any) => (
                    <label key={item.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer">
                      <Checkbox checked={selectedOldItems.has(item.id)} onCheckedChange={() => toggleOldItem(item.id)} />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm truncate block">{item.product_name}</span>
                        <span className="text-xs text-muted-foreground">
                          ৳{item.price} × {item.quantity}
                          {item.size && ` · ${item.size}`}
                          {item.color && ` · ${item.color}`}
                        </span>
                      </div>
                      <span className="text-sm font-medium">৳{item.price * item.quantity}</span>
                    </label>
                  ))}
                </div>

                {/* New Items */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">নতুন আইটেম যোগ করুন</p>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="প্রোডাক্ট খুঁজুন..."
                      className="pl-9 h-9 text-sm" />
                  </div>
                  {search && searchResults.length > 0 && (
                    <div className="border rounded-md max-h-40 overflow-y-auto">
                      {searchResults.map((p: any) => (
                        <button key={p.id} type="button" onClick={() => addNewItem(p)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted">
                          {p.images?.[0] && <img src={p.images[0]} className="w-8 h-8 rounded object-cover" alt="" />}
                          <div className="flex-1 min-w-0">
                            <span className="truncate block">{p.name}</span>
                            <span className="text-xs text-muted-foreground">৳{p.original_price && p.original_price < p.price ? p.original_price : p.price}</span>
                          </div>
                          <Plus className="h-4 w-4 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  )}

                  {newItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm truncate block">{item.product_name}</span>
                        <div className="flex items-center gap-2 mt-1">
                          <Input type="number" value={item.price} onChange={e => updateNewItem(idx, 'price', Number(e.target.value))}
                            className="w-20 h-7 text-xs" />
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => updateNewItem(idx, 'quantity', Math.max(1, item.quantity - 1))} className="p-0.5 rounded hover:bg-muted">
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="text-xs w-6 text-center">{item.quantity}</span>
                            <button type="button" onClick={() => updateNewItem(idx, 'quantity', item.quantity + 1)} className="p-0.5 rounded hover:bg-muted">
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                      <span className="text-sm font-medium">৳{item.price * item.quantity}</span>
                      <button type="button" onClick={() => removeNewItem(idx)} className="p-1 rounded hover:bg-destructive/10">
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Calculation Summary */}
                {(selectedOldItems.size > 0 || newItems.length > 0) && (
                  <div className="p-3 rounded-lg bg-accent/50 border border-border space-y-1.5 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">পুরোনো আইটেম মোট</span><span>৳{oldItemsTotal}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">নতুন আইটেম মোট</span><span>৳{newItemsTotal}</span></div>
                    {exchangeType === 'product_swap' && (
                      <div className="flex justify-between"><span className="text-muted-foreground">পার্থক্য</span>
                        <span className={priceDiff > 0 ? 'text-orange-600' : priceDiff < 0 ? 'text-blue-600' : ''}>
                          {priceDiff > 0 ? '+' : ''}৳{priceDiff}
                        </span>
                      </div>
                    )}
                    {extraDelivery > 0 && (
                      <div className="flex justify-between"><span className="text-muted-foreground">ডেলিভারি চার্জ</span><span>৳{extraDelivery}</span></div>
                    )}
                    <div className="border-t border-border pt-1.5 mt-1.5">
                      {customerOwes > 0 && (
                        <div className="flex justify-between font-semibold text-orange-600">
                          <span>কাস্টমার দেবে</span><span>৳{customerOwes}</span>
                        </div>
                      )}
                      {storeOwes > 0 && (
                        <div className="flex justify-between font-semibold text-blue-600">
                          <span>দোকান ফেরত দেবে</span><span>৳{storeOwes}</span>
                        </div>
                      )}
                      {customerOwes === 0 && storeOwes === 0 && (
                        <div className="flex justify-between font-semibold text-green-600">
                          <span>কোনো পাওনা নেই</span><span>৳0</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Note */}
                <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="নোট (মেমোতে প্রিন্ট হবে)..." rows={2} className="text-sm" />

                {/* Save */}
                <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || selectedOldItems.size === 0}
                  className="w-full">
                  {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1.5" />}
                  এক্সচেঞ্জ সেভ করুন
                </Button>
              </>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
