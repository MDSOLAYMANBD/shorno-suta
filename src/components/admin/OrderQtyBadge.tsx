import { ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';

/** How many pieces an order has (every item's quantity added up). */
export const orderPieces = (items: { quantity?: number | null }[] | null | undefined) =>
  (items ?? []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

/**
 * The order's piece count as a small pill ("৪ পিস"), under the total on the orders list.
 * Nothing until the order's items have loaded. The same as the CORE Shop engine.
 */
export function OrderQtyBadge({ items, className }: { items: { quantity?: number | null }[] | null | undefined; className?: string }) {
  const pieces = orderPieces(items);
  if (!items || items.length === 0 || pieces <= 0) return null;
  const label = `${pieces.toLocaleString('bn-BD')} পিস`;
  return (
    <span
      title={label}
      className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-primary/10 px-2 py-0.5 text-[10.5px] font-bold text-primary', className)}
    >
      <ShoppingBag className="h-3 w-3" aria-hidden="true" />
      {label}
    </span>
  );
}
