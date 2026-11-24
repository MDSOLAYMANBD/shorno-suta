// Shadamon Shop as this shop's supplier (admin → ড্রপশিপিং; the supplier edge function):
// what its partner API's order states mean here, which of its three delivery areas the
// shop's area is, how an order's prices are fitted to what the customer pays, and how its
// product text is told apart from the shop's. The same file as the CORE Shop engine's. No
// Deno-only code, so the admin's tests use it too.

/**
 * Shadamon's order states in the courier words the shop already understands (the ones
 * Steadfast uses), which the database turns into the order's own status
 * (public.map_courier_to_order_status). null: Shadamon cancelled it before it went out.
 */
const STATUS: Record<string, string | null> = {
  pending: 'in_review',
  confirmed: 'in_review',
  with_courier: 'in_review',
  shipped: 'pending',
  on_hold: 'hold',
  delivered: 'delivered',
  partially_delivered: 'partial_delivered',
  returned: 'cancelled',
  cancelled: null,
};

/** The courier status for a Shadamon order state (undefined: a state not known here). */
export function shadamonStatus(state: unknown): string | null | undefined {
  const s = String(state ?? '').toLowerCase();
  return s in STATUS ? STATUS[s] : undefined;
}

/** Courier statuses of orders Shadamon is still working on. */
export const SHADAMON_ACTIVE_STATUSES = ['in_review', 'pending', 'hold'];

export type ShadamonArea = 'dhaka_inside' | 'dhaka_suburb' | 'dhaka_outside';

/**
 * Shadamon's delivery area for the shop's: the shop's three original areas are the same
 * ones; an area the shop named itself goes by its name (inside Dhaka city, around Dhaka,
 * else the rest of the country).
 */
export function shadamonArea(id: unknown, label?: unknown): ShadamonArea {
  const key = String(id ?? '');
  if (key === 'dhaka_inside' || key === 'dhaka_suburb' || key === 'dhaka_outside') return key;
  const text = `${key} ${String(label ?? '')}`.toLowerCase();
  if (/(বাইরে|outside|সারাদেশ|সারা দেশ|nationwide)/.test(text)) return 'dhaka_outside';
  if (/(সাব|suburb|সাভার|savar|গাজীপুর|gazipur|নারায়ণগঞ্জ|narayanganj|কেরানীগঞ্জ|keraniganj)/.test(text)) return 'dhaka_suburb';
  if (/(ঢাকা|dhaka)/.test(text)) return 'dhaka_inside';
  return 'dhaka_outside';
}

export interface PricedLine {
  /** what the customer paid for one */
  unitPrice: number;
  quantity: number;
  /** the least Shadamon takes for one (its own price) */
  minPrice: number;
}

export type Fitted =
  | { ok: true; unitPrices: number[]; total: number; short: number }
  | { ok: false; least: number };

/**
 * Unit prices for Shadamon so that the products plus Shadamon's delivery charge come to
 * what Shadamon collects from the customer (`collect`: the order's due, after any advance
 * or discount). The difference from the shop's own prices (its delivery charge, a
 * discount, an advance) is spread over the lines by their price, never below Shadamon's
 * price. Prices are whole taka, so a few taka may be left over: `short` is how much less
 * than `collect` Shadamon then collects (never more than it, so the customer is never
 * asked for more than the shop's order says). Not possible (`ok: false`) when even
 * Shadamon's prices come to more; `least` is then the smallest `collect` that works.
 */
export function fitToCollect(lines: PricedLine[], delivery: number, collect: number): Fitted {
  const mins = lines.map((l) => Math.ceil(l.minPrice));
  const least = lines.reduce((s, l, i) => s + mins[i] * l.quantity, 0) + delivery;
  if (lines.length === 0 || collect < least) return { ok: false, least };

  const target = collect - delivery;
  const units = lines.map((l, i) => Math.max(mins[i], Math.round(l.unitPrice)));
  const sum = () => units.reduce((s, u, i) => s + u * lines[i].quantity, 0);
  const base = sum();

  // spread the difference by price, then settle what rounding left, single items first
  let rest = target - base;
  if (rest !== 0 && base > 0) {
    units.forEach((u, i) => { units[i] = Math.max(mins[i], u + Math.trunc((rest * u) / base)); });
  }
  const order = lines.map((_, i) => i).sort((a, b) => lines[a].quantity - lines[b].quantity);
  for (let pass = 0; pass < 3; pass++) {
    for (const i of order) {
      rest = target - sum();
      const step = Math.trunc(rest / lines[i].quantity);
      if (step !== 0) units[i] = Math.max(mins[i], units[i] + step);
    }
  }
  // still above what the customer owes: take a taka more off somewhere
  for (const i of order) {
    while (sum() > target && units[i] > mins[i]) units[i]--;
  }
  const total = sum() + delivery;
  return { ok: true, unitPrices: units, total, short: collect - total };
}

/** Shadamon's own names in product text (Bangla and English spellings, its web address). */
export const SHADAMON_BRAND = /(shadamon\s*shop|shadamonshop(\.com)?|shadamon|sadamon|সাদামন\s*শপ|সাদামন|সাদামোন|শাদামন)/gi;

/** Whether a text names Shadamon (only those go to the AI). */
export function mentionsShadamon(text: unknown): boolean {
  SHADAMON_BRAND.lastIndex = 0;
  const found = SHADAMON_BRAND.test(String(text ?? ''));
  SHADAMON_BRAND.lastIndex = 0;
  return found;
}

const BANGLA_NAME = /(সাদামন\s*শপ|সাদামোন\s*শপ|শাদামন\s*শপ|সাদামন|সাদামোন|শাদামন)(ের|এর|কে|ে)?/g;
const BANGLA_ENDING: Record<string, string> = { 'ের': '-এর', 'এর': '-এর', 'কে': '-কে', 'ে': '-এ' };

/**
 * Plain swap of Shadamon's names for the shop's, when the AI is not there: Bangla for
 * Bangla (its ending kept apart: "সাদামন শপের" → "রূপকথা-এর"), English for English.
 */
export function swapBrand(text: string, brandBn: string, brandEn: string): string {
  return String(text ?? '')
    .replace(BANGLA_NAME, (_m, _name, ending) => brandBn + (ending ? BANGLA_ENDING[ending] : ''))
    .replace(SHADAMON_BRAND, brandEn);
}
