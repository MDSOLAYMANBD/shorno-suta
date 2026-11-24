// The product editor's note for a product the shop takes from Shadamon (admin →
// ড্রপশিপিং): the least it may sell for, what it costs the shop, and that stock and price follow
// Shadamon by themselves. Nothing for the shop's own products.
import { useQuery } from '@tanstack/react-query';
import { Truck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { bnText as trNow } from '@/lib/supplier';

interface SupplierProduct {
  id: string;
  supplier: string;
  supplier_price: number | null;
  cost_price: number | null;
  supplier_paused: boolean;
}

export const SUPPLIER_PRODUCTS_KEY = ['supplier-products'];

export function useSupplierProducts() {
  return useQuery({
    queryKey: SUPPLIER_PRODUCTS_KEY,
    queryFn: async () => {
      // before the dropshipping migration there is no such function: no supplier products then
      const rpc = supabase.rpc as unknown as (fn: string) => Promise<{ data: SupplierProduct[] | null; error: unknown }>;
      const { data, error } = await rpc('get_supplier_products');
      if (error) return new Map<string, SupplierProduct>();
      return new Map<string, SupplierProduct>((data ?? []).map((p) => [p.id, p]));
    },
    staleTime: 60_000,
  });
}

const money = (n: number) => `৳${Math.round(n).toLocaleString('en-IN')}`;

/** A Shadamon product in the products list: the badge and what one sale earns. */
export function SupplierBadge({ productId, price }: { productId: string; price: number }) {
  const { data } = useSupplierProducts();
  const p = data?.get(productId);
  if (!p) return null;
  const profit = price - (Number(p.cost_price) || 0);
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#0e7cc7] to-[#18a957] px-2 py-0.5 text-[10px] font-bold text-white">
      <Truck className="h-3 w-3" /> {trNow('ড্রপশিপিং', 'Dropship')}
      {Number(p.cost_price) > 0 && <span className="rounded-full bg-white/25 px-1.5">{trNow('লাভ', 'profit')} {money(Math.max(profit, 0))}</span>}
    </span>
  );
}

export default function SupplierNote({ productId, price }: { productId?: string; price: number }) {
  const { data } = useSupplierProducts();
  const p = productId ? data?.get(productId) : undefined;
  if (!p) return null;
  const least = Number(p.supplier_price) || 0;
  const cost = Number(p.cost_price) || 0;
  return (
    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-sm text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
      <p className="flex items-center gap-1.5 font-semibold"><Truck className="h-4 w-4" /> {trNow('এই পণ্য Shadamon থেকে আসে', 'This product comes from Shadamon')}</p>
      <p className="mt-1 text-xs">
        {trNow(
          `Shadamon-এর দাম ${money(least)} — এর কমে বিক্রি করা যাবে না, বেশিতে পারবেন। আপনার খরচ ${money(cost)}, এই দামে লাভ ${money(Math.max(price - cost, 0))}। স্টক, দাম আর চালু/বন্ধ Shadamon-এর সাথে নিজে থেকেই মিলে থাকে; অর্ডার এলে কুরিয়ার মেনু থেকে "Shadamon" বেছে নিন।`,
          `Shadamon's price is ${money(least)}: you may sell for more, never less. It costs you ${money(cost)}, so this price makes ${money(Math.max(price - cost, 0))}. Stock, price and on/off follow Shadamon by themselves; send its orders with "Shadamon" in the courier menu.`,
        )}
      </p>
      {p.supplier_paused && <p className="mt-1 text-xs font-semibold text-red-700">{trNow('Shadamon এখন এটা বিক্রি করছে না, তাই বন্ধ আছে।', 'Shadamon stopped selling it for now, so it is off.')}</p>}
    </div>
  );
}
