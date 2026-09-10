import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAllSettings } from './useAllSettings';
import { SHIPPING_DEFAULTS } from './useShippingCharges';

/**
 * Central Checkout Fields & Shipping configuration.
 * Stored in store_settings under key `checkout_config` (JSON string).
 *
 * Backward compat: legacy keys `shipping_dhaka_inside/suburb/outside` are
 * mirrored on save so existing readers (place-order edge fn, OrderPreviewDialog,
 * AbandonedCheckoutEditor, Landing brand defaults, etc.) continue to work.
 */

export type BuiltInFieldKey = 'name' | 'phone' | 'address' | 'email' | 'note';

export interface BuiltInFieldConfig {
  show: boolean;
  required: boolean;
  label: string;
  placeholder?: string;
}

export interface CustomFieldConfig {
  id: string;
  label: string;
  placeholder?: string;
  type: 'text' | 'textarea' | 'number';
  required: boolean;
  show: boolean;
  order: number;
}

export interface ShippingZoneConfig {
  id: string;
  label: string;
  price: number;
  default: boolean;
  show: boolean;
  order: number;
}

export interface CheckoutConfig {
  fields: Record<BuiltInFieldKey, BuiltInFieldConfig>;
  custom_fields: CustomFieldConfig[];
  shipping_zones: ShippingZoneConfig[];
}

export const DEFAULT_FIELDS: Record<BuiltInFieldKey, BuiltInFieldConfig> = {
  name: { show: true, required: true, label: 'নাম', placeholder: 'আপনার পূর্ণ নাম' },
  phone: { show: true, required: true, label: 'ফোন', placeholder: '01XXXXXXXXX' },
  address: { show: true, required: true, label: 'ঠিকানা', placeholder: 'বিস্তারিত ঠিকানা লিখুন' },
  email: { show: true, required: false, label: 'ইমেইল (ঐচ্ছিক)', placeholder: 'example@gmail.com' },
  note: { show: true, required: false, label: 'নোট (ঐচ্ছিক)', placeholder: 'বিশেষ কোনো নির্দেশনা...' },
};

export const RESERVED_ZONE_IDS = ['dhaka_inside', 'dhaka_suburb', 'dhaka_outside'] as const;

export function buildDefaultConfig(legacy?: Record<string, string>): CheckoutConfig {
  const ins = Number(legacy?.['shipping_dhaka_inside']);
  const sub = Number(legacy?.['shipping_dhaka_suburb']);
  const out = Number(legacy?.['shipping_dhaka_outside']);
  return {
    fields: { ...DEFAULT_FIELDS },
    custom_fields: [],
    shipping_zones: [
      { id: 'dhaka_inside', label: 'ঢাকা সিটি', price: Number.isFinite(ins) ? ins : SHIPPING_DEFAULTS.dhaka_inside, default: false, show: true, order: 1 },
      { id: 'dhaka_suburb', label: 'সাব-এরিয়া', price: Number.isFinite(sub) ? sub : SHIPPING_DEFAULTS.dhaka_suburb, default: false, show: true, order: 2 },
      { id: 'dhaka_outside', label: 'সারাদেশে / ঢাকার বাইরে', price: Number.isFinite(out) ? out : SHIPPING_DEFAULTS.dhaka_outside, default: true, show: true, order: 3 },
    ],
  };
}

function safeParse(raw: string | undefined, legacy?: Record<string, string>): CheckoutConfig {
  if (!raw) return buildDefaultConfig(legacy);
  try {
    const parsed = JSON.parse(raw);
    const fallback = buildDefaultConfig(legacy);
    const fields: Record<BuiltInFieldKey, BuiltInFieldConfig> = { ...fallback.fields };
    if (parsed?.fields && typeof parsed.fields === 'object') {
      (Object.keys(fields) as BuiltInFieldKey[]).forEach(k => {
        if (parsed.fields[k]) fields[k] = { ...fields[k], ...parsed.fields[k] };
      });
    }
    const custom_fields: CustomFieldConfig[] = Array.isArray(parsed?.custom_fields)
      ? parsed.custom_fields.filter((f: any) => f && f.id && f.label).map((f: any, i: number) => ({
          id: String(f.id), label: String(f.label), placeholder: f.placeholder ? String(f.placeholder) : '',
          type: ['text', 'textarea', 'number'].includes(f.type) ? f.type : 'text',
          required: !!f.required, show: f.show !== false, order: Number(f.order) || i + 1,
        })).sort((a: CustomFieldConfig, b: CustomFieldConfig) => a.order - b.order)
      : [];
    const shipping_zones: ShippingZoneConfig[] = Array.isArray(parsed?.shipping_zones) && parsed.shipping_zones.length > 0
      ? parsed.shipping_zones.filter((z: any) => z && z.id && z.label).map((z: any, i: number) => ({
          id: String(z.id), label: String(z.label),
          price: Number(z.price) >= 0 ? Number(z.price) : 0,
          default: !!z.default, show: z.show !== false, order: Number(z.order) || i + 1,
        })).sort((a: ShippingZoneConfig, b: ShippingZoneConfig) => a.order - b.order)
      : fallback.shipping_zones;
    return { fields, custom_fields, shipping_zones };
  } catch {
    return buildDefaultConfig(legacy);
  }
}

export function useCheckoutConfig() {
  const { data: settings, isLoading } = useAllSettings();
  const config = safeParse(settings?.['checkout_config'], settings);

  const visibleZones = config.shipping_zones.filter(z => z.show !== false);
  const defaultZone = visibleZones.find(z => z.default) || visibleZones[0];

  const resolveZonePrice = (zoneId: string | null | undefined): number => {
    const z = config.shipping_zones.find(z => z.id === zoneId);
    if (z) return z.price;
    return defaultZone?.price ?? SHIPPING_DEFAULTS.dhaka_outside;
  };

  return {
    isLoading,
    config,
    fields: config.fields,
    customFields: config.custom_fields.filter(f => f.show),
    shippingZones: visibleZones,
    defaultZoneId: defaultZone?.id || 'dhaka_outside',
    resolveZonePrice,
  };
}

export function useSaveCheckoutConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cfg: CheckoutConfig) => {
      // Mirror legacy shipping keys for backward compat
      const findZone = (id: string) => cfg.shipping_zones.find(z => z.id === id);
      const inside = findZone('dhaka_inside');
      const suburb = findZone('dhaka_suburb');
      const outside = findZone('dhaka_outside');

      const writes: Array<{ key: string; value: string }> = [
        { key: 'checkout_config', value: JSON.stringify(cfg) },
      ];
      if (inside) writes.push({ key: 'shipping_dhaka_inside', value: String(inside.price) });
      if (suburb) writes.push({ key: 'shipping_dhaka_suburb', value: String(suburb.price) });
      if (outside) writes.push({ key: 'shipping_dhaka_outside', value: String(outside.price) });

      for (const w of writes) {
        const { data: existing } = await supabase.from('store_settings').select('id').eq('key', w.key).maybeSingle();
        if (existing) {
          const { error } = await supabase.from('store_settings').update({ value: w.value }).eq('key', w.key);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('store_settings').insert({ key: w.key, value: w.value });
          if (error) throw error;
        }
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['all-settings'] }),
  });
}
