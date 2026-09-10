// CRM Audience Engine — analytics aggregator.
// Channel-agnostic: takes the same `AudienceCustomer[]` rows that the
// engine resolves and returns reusable stats for any marketing dashboard.

import type { AudienceCustomer } from './types';

export interface AudienceStats {
  total: number;
  vip: number;            // ≥5 delivered
  repeat: number;         // ≥2 delivered
  newCustomers: number;   // 0 delivered (or order in last 30d, single)
  delivered: number;      // has any delivered order
  codCount: number;
  prepaidCount: number;
  districts: Array<{ name: string; count: number }>;
  averageOrders: number;
  averageSpend: number;
}

export function computeAudienceStats(customers: AudienceCustomer[]): AudienceStats {
  const total = customers.length;
  if (total === 0) {
    return {
      total: 0, vip: 0, repeat: 0, newCustomers: 0, delivered: 0,
      codCount: 0, prepaidCount: 0, districts: [], averageOrders: 0, averageSpend: 0,
    };
  }

  let vip = 0, repeat = 0, newCustomers = 0, delivered = 0;
  let cod = 0, prepaid = 0;
  let sumOrders = 0, sumSpend = 0;
  const dist: Record<string, number> = {};

  for (const c of customers) {
    const d = c.delivered_orders || 0;
    if (d >= 5) vip++;
    if (d >= 2) repeat++;
    if (d === 0) newCustomers++;
    if (d > 0) delivered++;

    sumOrders += c.total_orders || 0;
    sumSpend += c.total_spent || 0;

    // payment heuristic: customer_type may carry "COD"/"Prepaid" tags; fallback unknown
    const t = (c.customer_type || '').toLowerCase();
    if (t.includes('prepaid')) prepaid++;
    else cod++; // BD market default

    const dn = (c.district || 'অজানা').trim() || 'অজানা';
    dist[dn] = (dist[dn] || 0) + 1;
  }

  const districts = Object.entries(dist)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  return {
    total, vip, repeat, newCustomers, delivered,
    codCount: cod, prepaidCount: prepaid,
    districts,
    averageOrders: Number((sumOrders / total).toFixed(2)),
    averageSpend: Number((sumSpend / total).toFixed(2)),
  };
}
