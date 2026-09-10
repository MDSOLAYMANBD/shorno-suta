/**
 * Unified discount extraction helpers for orders.
 * Used across admin, public memo, customer dashboard, order status pages.
 */

/** Parse discount amount from discount_note like "কুপন: RETURN10 (-৳99)" → 99 */
export function extractDiscountFromNote(discount_note: string | null | undefined): number {
  if (!discount_note) return 0;
  // Match patterns like (-৳99), -৳99, ৳99
  const match = discount_note.match(/[-\(]?৳(\d+(?:\.\d+)?)\)?/);
  return match ? parseFloat(match[1]) : 0;
}

/**
 * Get order discount reliably from any order object.
 * Priority:
 * 1) Explicit order.discount field (set by admin preview dialog)
 * 2) subtotal + delivery_charge - total (if > 0)
 * 3) Parse from discount_note as fallback
 */
export function getOrderDiscount(order: {
  discount?: number;
  subtotal?: number;
  delivery_charge?: number;
  total?: number;
  free_shipping?: boolean;
  discount_note?: string | null;
}): number {
  // 1) Explicit discount
  if (typeof order.discount === 'number' && order.discount > 0) return order.discount;

  // 2) Calculate from stored values
  const sub = Number(order.subtotal) || 0;
  const del = order.free_shipping ? 0 : (Number(order.delivery_charge) || 0);
  const tot = Number(order.total) || 0;
  const calc = sub + del - tot;
  if (calc > 0) return Math.round(calc);

  // 3) Fallback: parse from discount_note
  return extractDiscountFromNote(order.discount_note);
}
