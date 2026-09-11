import { Banknote, CreditCard, Wallet, type LucideIcon } from 'lucide-react';

// Central registry for checkout payment methods. Adding a future gateway
// (SSLCommerz, Nagad, Rocket, ...) means: write its <gateway>-checkout /
// <gateway>-verify edge functions, add one entry here, add one settings
// card in AdminPaymentSettings — no changes to Checkout.tsx's structure.
export interface PaymentMethodDef {
  id: string;
  label: string;
  labelBn: string;
  sublabel: string;
  icon: LucideIcon;
  /** store_settings key controlling visibility. Absent = always shown (COD). */
  settingKey?: string;
  /** Whether this method is enabled when its settingKey is missing/unset. */
  defaultEnabled: boolean;
  /** Shown in checkout but not yet selectable — displays an "Upcoming" badge
   * instead of letting the customer pick it. Remove once the gateway is fully
   * wired up (edge functions deployed + merchant credentials configured). */
  comingSoon?: boolean;
  /** Optional gateway-brand styling for methods with a recognizable wallet
   * identity (e.g. bKash pink). Callers fall back to the theme's primary
   * color when this is absent. */
  brand?: {
    /** Icon circle background classes. */
    iconBg: string;
    /** Icon color class. */
    iconColor: string;
    /** Color class for the selected-state checkmark and accents. */
    accentText: string;
    /** Border + background classes applied when this method is selected. */
    selectedBorder: string;
    /** Animation class applied continuously to the icon circle for brand presence. */
    glowClassName?: string;
  };
}

export const PAYMENT_METHODS: PaymentMethodDef[] = [
  {
    id: 'cod',
    label: 'Cash on Delivery',
    labelBn: 'ক্যাশ অন ডেলিভারি',
    sublabel: 'COD',
    icon: Banknote,
    defaultEnabled: true, // COD is never gated — always available
  },
  {
    id: 'uddoktapay',
    label: 'Online Payment',
    labelBn: 'অনলাইন পেমেন্ট',
    sublabel: 'উদ্যোক্তাপে',
    icon: CreditCard,
    settingKey: 'payment_uddoktapay_enabled',
    defaultEnabled: true, // preserves current behavior for existing stores
    comingSoon: true, // gateway not configured yet — visible, not selectable
  },
  {
    id: 'bkash',
    label: 'bKash',
    labelBn: 'বিকাশ',
    sublabel: 'bKash Payment',
    icon: Wallet,
    settingKey: 'payment_bkash_enabled',
    defaultEnabled: true, // shown as "upcoming" until the gateway is wired up
    comingSoon: true, // gateway not configured yet — visible, not selectable
    brand: {
      iconBg: 'bg-gradient-to-br from-[#F0509C] to-[#E2136E]',
      iconColor: 'text-white',
      accentText: 'text-[#E2136E]',
      selectedBorder: 'border-[#E2136E] bg-[#E2136E]/5',
      glowClassName: 'animate-bkash-glow',
    },
  },
];
