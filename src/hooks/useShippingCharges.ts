import { useAllSettings } from './useAllSettings';

export const SHIPPING_DEFAULTS = {
  dhaka_inside: 70,
  dhaka_suburb: 100,
  dhaka_outside: 130,
} as const;

export type ShippingArea = keyof typeof SHIPPING_DEFAULTS;

/**
 * Centralized shipping charges sourced from `store_settings`.
 * Admin can edit values from Admin Settings → Shipping Charges, and every
 * customer/admin surface (Checkout, QuickOrder, LandingOrderForm, ManualOrder,
 * GiveawayOrder, AbandonedCheckoutEditor, OrderPreviewDialog, LandingPage
 * brand defaults) reads from this hook.
 */
export function useShippingCharges() {
  const { data: settings, isLoading } = useAllSettings();

  const parse = (key: string, fallback: number) => {
    const raw = settings?.[key];
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };

  // Prefer authoritative `shipping_*` keys; fall back to legacy `delivery_charge_*_dhaka`
  // so older configurations keep working.
  const pick = (primary: string, legacy: string, fallback: number) => {
    const rawPrimary = settings?.[primary];
    const nPrimary = Number(rawPrimary);
    if (Number.isFinite(nPrimary) && nPrimary >= 0 && rawPrimary !== undefined && rawPrimary !== null && rawPrimary !== '') {
      return nPrimary;
    }
    return parse(legacy, fallback);
  };

  return {
    isLoading,
    charges: {
      dhaka_inside: pick('shipping_dhaka_inside', 'delivery_charge_inside_dhaka', SHIPPING_DEFAULTS.dhaka_inside),
      dhaka_suburb: pick('shipping_dhaka_suburb', 'delivery_charge_dhaka_suburb', SHIPPING_DEFAULTS.dhaka_suburb),
      dhaka_outside: pick('shipping_dhaka_outside', 'delivery_charge_outside_dhaka', SHIPPING_DEFAULTS.dhaka_outside),
    },
  };
}

/** Resolve a shipping charge for a given delivery_area string. Falls back to outside. */
export function resolveShippingCharge(
  charges: { dhaka_inside: number; dhaka_suburb: number; dhaka_outside: number },
  area: string | null | undefined,
): number {
  switch (area) {
    case 'dhaka_inside': return charges.dhaka_inside;
    case 'dhaka_suburb': return charges.dhaka_suburb;
    case 'dhaka_outside':
    default: return charges.dhaka_outside;
  }
}
