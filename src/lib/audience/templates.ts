// Channel-agnostic template variable resolver for the Audience Engine.
// Variables are pure string replacements so the same template body works
// for SMS, WhatsApp, Email, Push, etc.
//
// To add a new variable: append a (token, resolver) entry to VARIABLES.

import { format } from 'date-fns';
import type { AudienceCustomer } from './types';

export interface TemplateContext {
  shop: string;
  // Future: order_id, tracking_url, coupon_code, etc.
  [key: string]: string | number | undefined;
}

type Resolver = (c: AudienceCustomer, ctx: TemplateContext) => string;

function firstName(name?: string) {
  return (name || '').trim().split(/\s+/)[0] || 'গ্রাহক';
}

export const VARIABLES: { token: string; label: string; resolver: Resolver }[] = [
  { token: '{{first_name}}',      label: 'প্রথম নাম',   resolver: (c) => firstName(c.name) },
  { token: '{{name}}',            label: 'পুরো নাম',    resolver: (c) => c.name || 'গ্রাহক' },
  { token: '{{order_count}}',     label: 'অর্ডার সংখ্যা', resolver: (c) => String(c.total_orders || 0) },
  { token: '{{last_order_date}}', label: 'শেষ অর্ডার',  resolver: (c) => c.last_order_date ? format(new Date(c.last_order_date), 'dd MMM') : '' },
  { token: '{{district}}',        label: 'জেলা',        resolver: (c) => c.district || '' },
  { token: '{{upazila}}',         label: 'উপজেলা',      resolver: (c) => c.upazila || '' },
  { token: '{{shop}}',            label: 'শপ নাম',      resolver: (_c, ctx) => ctx.shop || '' },
];

export function resolveTemplate(
  body: string,
  customer: AudienceCustomer,
  ctx: TemplateContext,
): string {
  let out = body || '';
  for (const v of VARIABLES) {
    if (!out.includes(v.token)) continue;
    out = out.split(v.token).join(v.resolver(customer, ctx));
  }
  return out;
}

export const SAMPLE_CUSTOMER: AudienceCustomer = {
  phone: '8801700000000',
  name: 'রহিম মিয়া',
  address: 'Dhaka',
  district: 'Dhaka',
  upazila: 'Dhanmondi',
  area: null,
  total_orders: 3,
  delivered_orders: 2,
  total_spent: 4500,
  last_order_date: new Date().toISOString(),
  customer_type: 'Repeat',
  tags: [],
};
