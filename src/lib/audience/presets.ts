// Audience preset cards. Each describes how to constrain a `customers` query.
// The engine consumes these via `applyPreset()`.

import type { PresetId } from './types';

export interface PresetDef {
  id: PresetId;
  title: string;
  bn: string;
  icon: string; // lucide icon name (resolved in UI)
  description: string;
  group: 'core' | 'recency' | 'frequency' | 'value' | 'payment' | 'geo' | 'risk' | 'tag';
}

export const PRESETS: PresetDef[] = [
  { id: 'all', title: 'All Customers', bn: 'সকল কাস্টমার', icon: 'Users', description: 'Every customer in the database', group: 'core' },
  { id: 'vip', title: 'VIP', bn: 'ভিআইপি', icon: 'Crown', description: '5+ delivered orders or BDT 10,000+ spent', group: 'value' },
  { id: 'repeat', title: 'Repeat Customer', bn: 'পুনরায় গ্রাহক', icon: 'Repeat', description: '2 or more delivered orders', group: 'frequency' },
  { id: 'new', title: 'New Customer', bn: 'নতুন গ্রাহক', icon: 'Sparkles', description: 'First order in last 30 days', group: 'core' },
  { id: 'today', title: "Today's Customer", bn: 'আজকের', icon: 'Sun', description: 'Ordered today (Asia/Dhaka)', group: 'recency' },
  { id: 'yesterday', title: 'Yesterday', bn: 'গতকাল', icon: 'Sunset', description: 'Ordered yesterday', group: 'recency' },
  { id: 'last_7d', title: 'Last 7 Days', bn: '৭ দিন', icon: 'CalendarDays', description: 'Ordered in the last 7 days', group: 'recency' },
  { id: 'last_30d', title: 'Last 30 Days', bn: '৩০ দিন', icon: 'CalendarRange', description: 'Ordered in the last 30 days', group: 'recency' },
  { id: 'last_90d', title: 'Last 90 Days', bn: '৯০ দিন', icon: 'Calendar', description: 'Ordered in the last 90 days', group: 'recency' },
  { id: 'no_order_30d', title: 'No Order 30 Days', bn: '৩০ দিন অর্ডার নেই', icon: 'CalendarOff', description: 'No order in the last 30 days', group: 'recency' },
  { id: 'no_order_90d', title: 'No Order 90 Days', bn: '৯০ দিন অর্ডার নেই', icon: 'CalendarX', description: 'No order in the last 90 days', group: 'recency' },
  { id: 'orders_1', title: '1 Order', bn: '১টি অর্ডার', icon: 'Hash', description: 'Exactly 1 order', group: 'frequency' },
  { id: 'orders_2_plus', title: '2+ Orders', bn: '২+ অর্ডার', icon: 'Hash', description: '2 or more orders', group: 'frequency' },
  { id: 'orders_3_plus', title: '3+ Orders', bn: '৩+ অর্ডার', icon: 'Hash', description: '3 or more orders', group: 'frequency' },
  { id: 'orders_5_plus', title: '5+ Orders', bn: '৫+ অর্ডার', icon: 'Hash', description: '5 or more orders', group: 'frequency' },
  { id: 'orders_10_plus', title: '10+ Orders', bn: '১০+ অর্ডার', icon: 'Hash', description: '10 or more orders', group: 'frequency' },
  { id: 'high_spend', title: 'High Spend', bn: 'উচ্চ ব্যয়', icon: 'TrendingUp', description: 'Total spend above configured High threshold', group: 'value' },
  { id: 'low_spend', title: 'Low Spend', bn: 'কম ব্যয়', icon: 'TrendingDown', description: 'Total spend below configured Low threshold', group: 'value' },
  { id: 'cod', title: 'COD', bn: 'COD', icon: 'Banknote', description: 'Has at least one Cash-on-Delivery order', group: 'payment' },
  { id: 'prepaid', title: 'Prepaid', bn: 'প্রিপেইড', icon: 'CreditCard', description: 'Has at least one prepaid/online order', group: 'payment' },
  { id: 'inside_dhaka', title: 'Inside Dhaka', bn: 'ঢাকা সিটি', icon: 'MapPin', description: 'Address mentions Dhaka', group: 'geo' },
  { id: 'outside_dhaka', title: 'Outside Dhaka', bn: 'ঢাকার বাইরে', icon: 'Map', description: 'Address outside Dhaka', group: 'geo' },
  { id: 'at_risk', title: 'At Risk', bn: 'রিস্কে', icon: 'AlertTriangle', description: 'Was active, no order in 60+ days', group: 'risk' },
  { id: 'blacklist', title: 'Blacklist', bn: 'ব্ল্যাকলিস্ট', icon: 'Ban', description: 'Phone in Fraud Management blocked list', group: 'risk' },
  { id: 'refunded', title: 'Refunded', bn: 'রিফান্ড', icon: 'RotateCcw', description: 'Has a returned/refunded order', group: 'risk' },
  { id: 'wholesale', title: 'Wholesale', bn: 'হোলসেল', icon: 'Package', description: 'Spend ≥ configured Wholesale threshold', group: 'tag' },
  { id: 'retail', title: 'Retail', bn: 'রিটেইল', icon: 'ShoppingBag', description: 'Spend < configured Retail threshold', group: 'tag' },
];

export const PRESET_BY_ID: Record<PresetId, PresetDef> =
  PRESETS.reduce((acc, p) => { acc[p.id] = p; return acc; }, {} as Record<PresetId, PresetDef>);
