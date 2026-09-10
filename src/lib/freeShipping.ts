// Free Shipping System — shared evaluator
// Pure, no React imports.

export type FreeShippingRuleType =
  | 'quantity'
  | 'amount'
  | 'category_quantity'
  | 'product_quantity'
  | 'product_amount'
  | 'combo';

export type FreeShippingStatus = 'active' | 'draft' | 'scheduled' | 'expired';

export interface FreeShippingCampaign {
  id: string;
  name: string;
  description?: string | null;
  banner_image?: string | null;
  status: FreeShippingStatus;
  start_date?: string | null;
  end_date?: string | null;
  priority: number;
  rule_type: FreeShippingRuleType;
  combine_logic: 'and' | 'or';
  min_quantity?: number | null;
  max_quantity?: number | null;
  min_amount?: number | null;
  max_amount?: number | null;
  applicable_category_ids: string[];
  applicable_product_ids: string[];
  excluded_product_ids: string[];
  coupon_code?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface EvalCartItem {
  product_id: string;
  quantity: number;
  price: number;
  category_id?: string | null;
}

export interface EvalContext {
  items: EvalCartItem[];
  /** lowercased coupon code currently applied (if any) */
  appliedCouponCode?: string | null;
}

export interface FreeShippingEvalForCampaign {
  campaign: FreeShippingCampaign;
  qualified: boolean;
  /** 0..1 progress to qualification */
  progress: number;
  /** missing quantity to qualify (0 if qualified or rule is amount-only) */
  missingQty: number;
  /** missing amount to qualify (0 if qualified or rule is qty-only) */
  missingAmount: number;
  /** which subset of cart items contributed */
  matchedSubtotal: number;
  matchedQuantity: number;
}

export interface FreeShippingResult {
  /** highest-priority qualified campaign (null if none) */
  applied: FreeShippingCampaign | null;
  /** best next-best progress campaign to show progress bar towards */
  nextBest: FreeShippingEvalForCampaign | null;
  /** raw evaluations (qualified + visible non-qualified) */
  evaluations: FreeShippingEvalForCampaign[];
}

const now = () => Date.now();

export function isCampaignLive(c: FreeShippingCampaign, at = now()): boolean {
  if (c.status !== 'active') return false;
  if (c.start_date && new Date(c.start_date).getTime() > at) return false;
  if (c.end_date && new Date(c.end_date).getTime() < at) return false;
  return true;
}

function filterItemsForCampaign(c: FreeShippingCampaign, items: EvalCartItem[]): EvalCartItem[] {
  let pool = items.filter((i) => !c.excluded_product_ids.includes(i.product_id));
  if (c.applicable_product_ids.length > 0) {
    pool = pool.filter((i) => c.applicable_product_ids.includes(i.product_id));
  }
  if (c.applicable_category_ids.length > 0) {
    pool = pool.filter((i) => i.category_id && c.applicable_category_ids.includes(i.category_id));
  }
  return pool;
}

function evaluateCampaign(c: FreeShippingCampaign, ctx: EvalContext): FreeShippingEvalForCampaign {
  // Coupon-gated: require applied code
  if (c.coupon_code && (ctx.appliedCouponCode || '').toLowerCase() !== c.coupon_code.toLowerCase()) {
    return {
      campaign: c,
      qualified: false,
      progress: 0,
      missingQty: 0,
      missingAmount: 0,
      matchedSubtotal: 0,
      matchedQuantity: 0,
    };
  }

  const pool = filterItemsForCampaign(c, ctx.items);
  const qty = pool.reduce((s, i) => s + i.quantity, 0);
  const amount = pool.reduce((s, i) => s + i.price * i.quantity, 0);

  let qualifies = true;
  let qtyOk = true;
  let amtOk = true;
  const minQ = c.min_quantity ?? 0;
  const maxQ = c.max_quantity ?? Infinity;
  const minA = Number(c.min_amount ?? 0);
  const maxA = Number(c.max_amount ?? Infinity);

  switch (c.rule_type) {
    case 'quantity':
    case 'category_quantity':
    case 'product_quantity':
      qtyOk = qty >= minQ && qty <= maxQ;
      qualifies = qtyOk && minQ > 0;
      break;
    case 'amount':
    case 'product_amount':
      amtOk = amount >= minA && amount <= maxA;
      qualifies = amtOk && minA > 0;
      break;
    case 'combo':
      qtyOk = minQ === 0 ? true : qty >= minQ && qty <= maxQ;
      amtOk = minA === 0 ? true : amount >= minA && amount <= maxA;
      qualifies = c.combine_logic === 'or' ? (qtyOk || amtOk) : (qtyOk && amtOk);
      break;
  }

  const missingQty = qtyOk ? 0 : Math.max(0, minQ - qty);
  const missingAmount = amtOk ? 0 : Math.max(0, minA - amount);

  // Progress is the better of qty/amount progress depending on rule
  let progress = 0;
  if (c.rule_type === 'amount' || c.rule_type === 'product_amount') {
    progress = minA > 0 ? Math.min(1, amount / minA) : 0;
  } else if (
    c.rule_type === 'quantity' ||
    c.rule_type === 'category_quantity' ||
    c.rule_type === 'product_quantity'
  ) {
    progress = minQ > 0 ? Math.min(1, qty / minQ) : 0;
  } else {
    // combo
    const pQ = minQ > 0 ? Math.min(1, qty / minQ) : 1;
    const pA = minA > 0 ? Math.min(1, amount / minA) : 1;
    progress = c.combine_logic === 'or' ? Math.max(pQ, pA) : Math.min(pQ, pA);
  }
  if (qualifies) progress = 1;

  return {
    campaign: c,
    qualified: qualifies,
    progress,
    missingQty,
    missingAmount,
    matchedSubtotal: amount,
    matchedQuantity: qty,
  };
}

export function evaluateFreeShipping(
  campaigns: FreeShippingCampaign[],
  ctx: EvalContext,
): FreeShippingResult {
  const live = campaigns.filter((c) => isCampaignLive(c));
  const evals = live.map((c) => evaluateCampaign(c, ctx));

  // A campaign is "relevant" to the current cart/product only when its
  // product/category restrictions actually match at least one cart item.
  // Unrestricted (store-wide) campaigns are always relevant.
  const isRelevant = (e: FreeShippingEvalForCampaign): boolean => {
    const c = e.campaign;
    const restricted =
      (c.applicable_product_ids && c.applicable_product_ids.length > 0) ||
      (c.applicable_category_ids && c.applicable_category_ids.length > 0);
    if (!restricted) return true;
    // Restricted: require the filtered pool to be non-empty (at least one
    // cart item matched the product/category allow-list).
    return e.matchedQuantity > 0 || e.matchedSubtotal > 0 || e.qualified;
  };

  const relevant = evals.filter(isRelevant);

  const qualified = relevant
    .filter((e) => e.qualified)
    .sort((a, b) => (b.campaign.priority - a.campaign.priority) || (b.matchedSubtotal - a.matchedSubtotal));

  const applied = qualified[0]?.campaign ?? null;

  // Next-best: the non-qualified campaign with highest progress (skip coupon-gated not-applied)
  const nextBestCandidates = relevant
    .filter((e) => !e.qualified)
    .filter((e) => {
      if (!e.campaign.coupon_code) return true;
      // hide coupon-gated when coupon not applied
      return (ctx.appliedCouponCode || '').toLowerCase() === e.campaign.coupon_code.toLowerCase();
    })
    .sort((a, b) => b.progress - a.progress || b.campaign.priority - a.campaign.priority);

  return {
    applied,
    nextBest: applied ? null : (nextBestCandidates[0] ?? null),
    evaluations: evals,
  };
}

// Convert digits to Bangla numerals for friendlier display
function toBn(n: number | string): string {
  const map: Record<string, string> = { '0':'০','1':'১','2':'২','3':'৩','4':'৪','5':'৫','6':'৬','7':'৭','8':'৮','9':'৯' };
  return String(n).replace(/[0-9]/g, (d) => map[d] || d);
}

export function formatFreeShippingMessage(e: FreeShippingEvalForCampaign): { title: string; sub: string; tone: 'success' | 'urgent' | 'info' } {
  const c = e.campaign;
  const minQ = c.min_quantity ?? 0;
  const minA = Number(c.min_amount ?? 0);

  // Build a crystal-clear rule line, e.g. "নিয়ম: ৩টি আইটেম অর্ডার করলেই ফ্রি ডেলিভারি"
  let rule = '';
  if (c.rule_type === 'amount' || c.rule_type === 'product_amount') {
    rule = `নিয়ম: ৳${toBn(minA)} বা তার বেশি অর্ডার করলেই ফ্রি ডেলিভারি`;
  } else if (
    c.rule_type === 'quantity' ||
    c.rule_type === 'category_quantity' ||
    c.rule_type === 'product_quantity'
  ) {
    rule = `নিয়ম: ${toBn(minQ)}টি আইটেম অর্ডার করলেই ফ্রি ডেলিভারি`;
  } else if (c.rule_type === 'combo') {
    const join = c.combine_logic === 'and' ? 'এবং' : 'অথবা';
    rule = `নিয়ম: ${toBn(minQ)}টি আইটেম ${join} ৳${toBn(minA)} অর্ডার করলেই ফ্রি ডেলিভারি`;
  }

  if (e.qualified) {
    return {
      title: '✅ অভিনন্দন! আপনি ফ্রি ডেলিভারি আনলক করেছেন',
      sub: rule || c.name,
      tone: 'success',
    };
  }

  const ruleNeedsQty =
    c.rule_type === 'quantity' ||
    c.rule_type === 'category_quantity' ||
    c.rule_type === 'product_quantity' ||
    (c.rule_type === 'combo' && e.missingQty > 0 && (c.combine_logic === 'and' || e.missingAmount === 0));

  if (ruleNeedsQty && e.missingQty > 0) {
    const have = Math.max(0, minQ - e.missingQty);
    const title = `🎁 ${toBn(minQ)}টি আইটেম অর্ডার করলেই ফ্রি ডেলিভারি`;
    const sub = `আপনার কার্টে ${toBn(have)}টি আছে — আর মাত্র ${toBn(e.missingQty)}টি যোগ করুন!`;
    return { title, sub, tone: e.progress >= 0.66 ? 'urgent' : 'info' };
  }
  if (e.missingAmount > 0) {
    const amount = Math.ceil(e.missingAmount);
    const title = `🎁 ৳${toBn(minA)} অর্ডার করলেই ফ্রি ডেলিভারি`;
    const sub = `আর মাত্র ৳${toBn(amount)} যোগ করুন — ফ্রি ডেলিভারি আনলক!`;
    return { title, sub, tone: e.progress >= 0.66 ? 'urgent' : 'info' };
  }
  return { title: rule || c.name, sub: c.description || '', tone: 'info' };
}
