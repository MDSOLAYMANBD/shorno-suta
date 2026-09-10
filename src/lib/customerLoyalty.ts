// Loyalty tier helper — single source of truth for customer recognition badges across admin.
// Based on `customers.delivered_orders` (counts delivered + office_sell, kept fresh by trigger).

export type LoyaltyTierKey = string;

export interface LoyaltyTier {
  key: LoyaltyTierKey;
  label: string;
  shortLabel: string;
  emoji: string;
  className: string;
  minDelivered: number;
}

export interface LoyaltyTierConfig {
  key: string;
  label: string;
  shortLabel: string;
  emoji: string;
  minDelivered: number;
  color: string; // preset name
}

export const COLOR_PRESETS: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-800 border-blue-300',
  yellow: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  purple: 'bg-purple-100 text-purple-800 border-purple-300',
  green: 'bg-green-100 text-green-800 border-green-300',
  pink: 'bg-pink-100 text-pink-800 border-pink-300',
  orange: 'bg-orange-100 text-orange-800 border-orange-300',
  red: 'bg-red-100 text-red-800 border-red-300',
};

const NEW_TIER: LoyaltyTier = {
  key: 'new',
  label: 'নতুন কাস্টমার',
  shortLabel: 'নতুন',
  emoji: '🆕',
  className: 'bg-muted text-muted-foreground border-border',
  minDelivered: 0,
};

export const DEFAULT_LOYALTY_TIERS: LoyaltyTierConfig[] = [
  { key: 'repeat', label: 'রিপিট কাস্টমার', shortLabel: 'রিপিট', emoji: '🔁', minDelivered: 2, color: 'blue' },
  { key: 'star', label: 'স্টার কাস্টমার', shortLabel: 'স্টার', emoji: '⭐', minDelivered: 5, color: 'yellow' },
  { key: 'vip', label: 'ভিআইপি কাস্টমার', shortLabel: 'ভিআইপি', emoji: '👑', minDelivered: 10, color: 'purple' },
];

export function getLoyaltyTier(deliveredOrders: number | null | undefined, customTiers?: LoyaltyTierConfig[] | null): LoyaltyTier {
  const n = Math.max(0, Number(deliveredOrders || 0));
  const tiers = (customTiers && customTiers.length > 0 ? customTiers : DEFAULT_LOYALTY_TIERS)
    .slice()
    .sort((a, b) => b.minDelivered - a.minDelivered); // highest threshold first

  for (const t of tiers) {
    if (n >= t.minDelivered && t.minDelivered > 0) {
      return {
        key: t.key,
        label: t.label,
        shortLabel: t.shortLabel,
        emoji: t.emoji,
        minDelivered: t.minDelivered,
        className: COLOR_PRESETS[t.color] || COLOR_PRESETS.blue,
      };
    }
  }
  return NEW_TIER;
}

export function parseLoyaltyTiers(raw: string | undefined | null): LoyaltyTierConfig[] {
  if (!raw) return DEFAULT_LOYALTY_TIERS;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as LoyaltyTierConfig[];
  } catch { /* ignore */ }
  return DEFAULT_LOYALTY_TIERS;
}

export function normalizePhoneVariants(phone: string): string[] {
  const clean = (phone || '').replace(/[\s-]/g, '').replace(/^\+?88/, '');
  if (!clean) return [];
  return Array.from(new Set([clean, '+88' + clean, '88' + clean]));
}
