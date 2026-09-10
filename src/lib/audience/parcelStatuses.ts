// Configuration-driven parcel/order status registry.
// Labels here, counts come live from the existing `orders` table via
// useParcelStatusCounts(). Adding a new status = add one entry below.

import type { ParcelStatus } from './types';

export interface ParcelStatusDef {
  id: ParcelStatus;
  // Maps to one or more values in public.orders.status (the existing
  // delivery system). Keeping this dynamic avoids a parallel taxonomy.
  orderStatusValues: string[];
  label: string;
  bn: string;
  tone: 'positive' | 'neutral' | 'negative';
}

export const PARCEL_STATUSES: ParcelStatusDef[] = [
  { id: 'confirmed',         orderStatusValues: ['confirmed'],                    label: 'Confirmed',          bn: 'কনফার্মড',           tone: 'positive' },
  { id: 'processing',        orderStatusValues: ['in_review'],                    label: 'Processing',         bn: 'প্রসেসিং',          tone: 'neutral' },
  { id: 'packed',            orderStatusValues: ['scheduled'],                    label: 'Packed / Scheduled', bn: 'প্যাকড',             tone: 'neutral' },
  { id: 'handed_to_courier', orderStatusValues: ['shipped'],                      label: 'Handed to Courier',  bn: 'কুরিয়ারে',          tone: 'neutral' },
  { id: 'in_transit',        orderStatusValues: ['shipped'],                      label: 'In Transit',         bn: 'ট্রানজিট',          tone: 'neutral' },
  { id: 'delivery_attempt',  orderStatusValues: ['hold'],                         label: 'Delivery Attempt',   bn: 'ডেলিভারি প্রচেষ্টা', tone: 'neutral' },
  { id: 'delivered',         orderStatusValues: ['delivered'],                    label: 'Delivered',          bn: 'ডেলিভার্ড',          tone: 'positive' },
  { id: 'completed',         orderStatusValues: ['delivered', 'office_sell'],     label: 'Completed',          bn: 'সম্পন্ন',            tone: 'positive' },
  { id: 'returned',          orderStatusValues: ['paid_return'],                  label: 'Returned',           bn: 'রিটার্ন',            tone: 'negative' },
  { id: 'exchange',          orderStatusValues: ['exchange'],                     label: 'Exchange',           bn: 'এক্সচেঞ্জ',          tone: 'neutral' },
  { id: 'cancelled',         orderStatusValues: ['cancelled'],                    label: 'Cancelled',          bn: 'ক্যান্সেল',           tone: 'negative' },
  { id: 'failed_delivery',   orderStatusValues: ['delivery_failed'],              label: 'Failed Delivery',    bn: 'ফেইল্ড',             tone: 'negative' },
];

export const PARCEL_STATUS_BY_ID: Record<ParcelStatus, ParcelStatusDef> =
  PARCEL_STATUSES.reduce((acc, p) => { acc[p.id] = p; return acc; }, {} as Record<ParcelStatus, ParcelStatusDef>);
