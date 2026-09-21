/**
 * A delivery memo may only be printed once the order is ready to ship:
 * either a courier has been booked (API or manual entry), or the order
 * is an in-person "office sell" that never needs a courier.
 */
export function isDeliveryMemoPrintable(order: { status?: string | null; courier_consignment_id?: string | null }): boolean {
  return order.status === 'office_sell' || !!order.courier_consignment_id;
}

export const PRINT_LOCKED_MESSAGE = 'কুরিয়ার এন্ট্রি করার আগে প্রিন্ট করা যাবে না';
