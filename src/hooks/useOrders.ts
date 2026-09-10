import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CartItem } from '@/contexts/CartContext';
import { getOrderOrigin, getOrderAttribution } from '@/hooks/useUtmCapture';

interface OrderData {
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  delivery_area: string;
  notes?: string;
  customer_email?: string;
  custom_fields?: Record<string, string>;
}

export interface DuplicateOrderError {
  type: 'duplicate_order';
  existing_order: {
    order_number: string;
    total: number;
    created_at: string;
    items: { product_name: string; quantity: number; price: number; size?: string; color?: string }[];
  };
}

export interface BlockedOrderError {
  type: 'blocked_order';
  reason?: 'phone' | 'ip' | string;
  message: string;
}

export function isDuplicateOrderError(err: unknown): err is DuplicateOrderError {
  return typeof err === 'object' && err !== null && (err as any).type === 'duplicate_order';
}

export function isBlockedOrderError(err: unknown): err is BlockedOrderError {
  return typeof err === 'object' && err !== null && (err as any).type === 'blocked_order';
}

export function usePlaceOrder() {
  return useMutation({
    mutationFn: async ({ orderData, items, subtotal, abandoned_checkout_id, coupon_code }: { orderData: OrderData; items: CartItem[]; subtotal: number; abandoned_checkout_id?: string; coupon_code?: string }) => {
      const orderItems = items.map(item => ({
        product_id: item.is_addon ? (item.parent_product_id || item.id.replace(/-addon$/, '')) : item.id,
        product_name: item.is_addon ? `[অ্যাড-অন] ${item.name_bn || item.name || 'Product'}` : (item.name_bn || item.name || 'Product'),
        quantity: item.quantity,
        price: item.price,
        size: item.size || null,
        color: item.color || null,
        item_type: item.is_addon ? 'addon' : 'normal',
        parent_product_id: item.parent_product_id || null,
      }));

      const { buildTrackingContext } = await import('@/lib/trackingIds');
      const { getConsent } = await import('@/lib/consent');
      const tracking_context = buildTrackingContext(undefined, getConsent());
      const { data, error } = await supabase.functions.invoke('place-order', {
        body: { orderData: { ...orderData, order_origin: getOrderOrigin() }, items: orderItems, order_attribution: getOrderAttribution(), tracking_context, ...(abandoned_checkout_id ? { abandoned_checkout_id } : {}), ...(coupon_code ? { coupon_code } : {}) },
      });

      // For non-2xx responses, supabase puts response in error.context
      // Try to parse the body from the error first
      if (error) {
        let errorBody: any = null;
        try {
          if (error.context && typeof error.context.json === 'function') {
            errorBody = await error.context.json();
          }
        } catch {
          // json() may fail if body already consumed — try text() fallback
          try {
            if (error.context && typeof error.context.text === 'function') {
              const txt = await error.context.text();
              if (txt) errorBody = JSON.parse(txt);
            }
          } catch {}
        }

        if (errorBody?.error === 'duplicate_order' && errorBody?.existing_order) {
          throw { type: 'duplicate_order', existing_order: errorBody.existing_order } as DuplicateOrderError;
        }
        if (errorBody?.error === 'blocked') {
          throw {
            type: 'blocked_order',
            reason: errorBody.reason,
            message: 'আপনার এই নম্বর/IP থেকে অর্ডার করা সম্ভব নয়। সাহায্যের জন্য যোগাযোগ করুন।',
          } as BlockedOrderError;
        }
        if (errorBody?.error) throw new Error(errorBody.error);
        throw new Error(error.message || 'Failed to place order');
      }
      
      if (data?.error === 'duplicate_order' && data?.existing_order) {
        throw { type: 'duplicate_order', existing_order: data.existing_order } as DuplicateOrderError;
      }
      
      if (data?.error === 'blocked') {
        throw {
          type: 'blocked_order',
          reason: data.reason,
          message: 'আপনার এই নম্বর/IP থেকে অর্ডার করা সম্ভব নয়। সাহায্যের জন্য যোগাযোগ করুন।',
        } as BlockedOrderError;
      }
      
      if (data?.error) throw new Error(data.error);

      return data.order;
    },
  });
}
