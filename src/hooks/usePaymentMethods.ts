import { useMemo } from 'react';
import { useAllSettings } from './useAllSettings';
import { PAYMENT_METHODS, type PaymentMethodDef } from '@/lib/paymentMethods';

/** Returns the payment methods that should be visible on checkout right now,
 * driven by the same store_settings toggles the admin Payment Settings page
 * writes to. COD is never gated. */
export function useEnabledPaymentMethods(): { methods: PaymentMethodDef[]; isLoading: boolean } {
  const { data: settings, isLoading } = useAllSettings();

  const methods = useMemo(() => {
    return PAYMENT_METHODS.filter((m) => {
      if (!m.settingKey) return true;
      const raw = settings?.[m.settingKey];
      if (raw === undefined) return m.defaultEnabled;
      return raw === 'true';
    });
  }, [settings]);

  return { methods, isLoading };
}
