// Centralized profit/loss calculator for courier deliveries.
// All amounts in BDT.

export type AreaKey = 'dhaka_inside' | 'dhaka_suburb' | 'dhaka_outside';
export type ProviderKey = string; // 'steadfast' | 'pathao' | 'redx' | ...

export interface ProviderRate {
  dhaka_inside: number;
  dhaka_suburb: number;
  dhaka_outside: number;
  failed: number;   // courier still charges this for failed/cancelled
  partial: number;  // courier charge for partial deliveries
}

export type CourierRateMatrix = Record<ProviderKey, ProviderRate>;

export const DEFAULT_RATE_MATRIX: CourierRateMatrix = {
  steadfast: { dhaka_inside: 60, dhaka_suburb: 80, dhaka_outside: 110, failed: 50, partial: 50 },
  pathao:    { dhaka_inside: 60, dhaka_suburb: 80, dhaka_outside: 120, failed: 50, partial: 50 },
  redx:      { dhaka_inside: 55, dhaka_suburb: 75, dhaka_outside: 100, failed: 50, partial: 50 },
};

const DEFAULT_PROVIDER: ProviderRate = { dhaka_inside: 60, dhaka_suburb: 80, dhaka_outside: 110, failed: 50, partial: 50 };

// Steadfast official published fee schedule — same as STEADFAST_BILL in AdminCourierPanel.
// All providers currently mapped to this (Pathao/RedX provider-specific in future).
export const STEADFAST_FEE = {
  delivered: { dhaka_inside: 60, dhaka_suburb: 80, dhaka_outside: 110 },
  return:    { dhaka_inside: 50, dhaka_suburb: 70, dhaka_outside: 90 },
} as const;

export function steadfastDeliveredFee(area: AreaKey): number { return STEADFAST_FEE.delivered[area]; }
export function steadfastReturnFee(area: AreaKey): number { return STEADFAST_FEE.return[area]; }

export interface OrderRow {
  id: string;
  created_at: string;
  status: string;
  courier_status: string | null;
  courier_provider: string | null;
  delivery_area: string | null;
  delivery_charge: number | string | null;
  paid_amount: number | string | null;
  free_shipping: boolean | null;
  return_pending: boolean | null;
  return_received_at: string | null;
}

// Status buckets from courier_status
export type Bucket = 'delivered' | 'failed' | 'partial' | 'exchange' | 'returned' | 'in_transit' | 'cancelled' | 'other';

export function bucketOf(o: OrderRow): Bucket {
  const cs = (o.courier_status || '').toLowerCase();
  if (cs === 'delivered' || cs === 'delivered_approval_pending') {
    // Exchange: delivered AND was return-flagged at some point
    if (o.return_received_at) return 'exchange';
    return 'delivered';
  }
  if (cs === 'partial_delivered' || cs === 'partial_delivered_approval_pending') return 'partial';
  if (cs === 'cancelled' || cs === 'cancelled_approval_pending') return 'cancelled';
  if (cs === 'unknown' || cs === 'unknown_approval_pending' || cs === 'pickup_failed' || cs === 'pickup_cancelled') return 'failed';
  if (cs === 'pending' || cs === 'in_review' || cs === 'hold' || cs === 'pickup_on_hold' || cs === 'pickup_requested') return 'in_transit';
  if (o.return_pending) return 'returned';
  return 'other';
}

export function rateFor(matrix: CourierRateMatrix, provider: string | null): ProviderRate {
  const key = (provider || '').toLowerCase();
  return matrix[key] || DEFAULT_PROVIDER;
}

export function areaKey(area: string | null): AreaKey {
  const a = (area || '').toLowerCase();
  if (a === 'dhaka_suburb') return 'dhaka_suburb';
  if (a === 'dhaka_outside') return 'dhaka_outside';
  return 'dhaka_inside';
}

export function areaLabel(a: AreaKey): string {
  return a === 'dhaka_inside' ? 'ঢাকা সিটি' : a === 'dhaka_suburb' ? 'ঢাকা সাব এরিয়া' : 'ঢাকার বাইরে';
}

// Per-order computed financials
export interface OrderFinance {
  bucket: Bucket;
  revenue: number;     // delivery charge customer paid (0 if free shipping or not delivered)
  cost: number;        // courier charge to us
  profit: number;      // revenue - cost (delivered/exchange)
  loss: number;        // courier fee for failed/cancelled
  partialPL: number;   // partial collected - partial cost (signed)
}

export function computeOrderFinance(o: OrderRow, matrix: CourierRateMatrix): OrderFinance {
  const bucket = bucketOf(o);
  // Steadfast official fee schedule (matches per-parcel Bills column).
  // Provider-aware fees can be added later.
  const area = areaKey(o.delivery_area);
  const dc = Number(o.delivery_charge) || 0;
  const paid = Number(o.paid_amount) || 0;
  const isFree = !!o.free_shipping;

  let revenue = 0, cost = 0, profit = 0, loss = 0, partialPL = 0;

  if (bucket === 'delivered' || bucket === 'exchange') {
    revenue = isFree ? 0 : dc;
    cost = STEADFAST_FEE.delivered[area];
    profit = revenue - cost;
  } else if (bucket === 'cancelled' || bucket === 'failed') {
    // Customer paid nothing, parcel returned. Courier still charges return fee.
    cost = STEADFAST_FEE.return[area];
    loss = cost;
  } else if (bucket === 'partial') {
    revenue = paid;          // collected from customer
    cost = STEADFAST_FEE.return[area];
    partialPL = revenue - cost;
  }

  return { bucket, revenue, cost, profit, loss, partialPL };
}

export interface Aggregates {
  counts: Record<Bucket, number>;
  totalParcels: number;
  successRate: number;
  failureRate: number;
  exchangeRate: number;
  grossRevenue: number;
  totalCost: number;
  deliveredProfit: number;
  failedLoss: number;
  partialPL: number;
  exchangePL: number;
  netProfit: number;
}

export function aggregate(orders: OrderRow[], matrix: CourierRateMatrix): Aggregates {
  const counts: Record<Bucket, number> = {
    delivered: 0, failed: 0, partial: 0, exchange: 0, returned: 0, in_transit: 0, cancelled: 0, other: 0,
  };
  let grossRevenue = 0, totalCost = 0, deliveredProfit = 0, failedLoss = 0, partialPL = 0, exchangePL = 0;

  for (const o of orders) {
    const f = computeOrderFinance(o, matrix);
    counts[f.bucket]++;
    grossRevenue += f.revenue;
    totalCost += f.cost;
    if (f.bucket === 'delivered') deliveredProfit += f.profit;
    if (f.bucket === 'exchange') exchangePL += f.profit;
    if (f.bucket === 'failed' || f.bucket === 'cancelled') failedLoss += f.loss;
    if (f.bucket === 'partial') partialPL += f.partialPL;
  }

  const totalParcels = orders.length;
  const denom = Math.max(totalParcels, 1);
  return {
    counts,
    totalParcels,
    successRate: (counts.delivered / denom) * 100,
    failureRate: ((counts.failed + counts.cancelled) / denom) * 100,
    exchangeRate: (counts.exchange / denom) * 100,
    grossRevenue,
    totalCost,
    deliveredProfit,
    failedLoss,
    partialPL,
    exchangePL,
    netProfit: deliveredProfit + exchangePL + partialPL - failedLoss,
  };
}

export function fmtBDT(n: number): string {
  const sign = n < 0 ? '-' : '';
  const v = Math.abs(Math.round(n));
  return `${sign}৳${v.toLocaleString('en-IN')}`;
}

export function fmtPct(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return '0%';
  return `${n.toFixed(digits)}%`;
}
