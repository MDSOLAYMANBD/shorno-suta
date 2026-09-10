import { useStoreSettings } from './useStoreSettings';
import { parseLoyaltyTiers, LoyaltyTierConfig } from '@/lib/customerLoyalty';
import { useMemo } from 'react';

export function useLoyaltyTiers(): LoyaltyTierConfig[] {
  const { data: settings } = useStoreSettings();
  return useMemo(() => parseLoyaltyTiers(settings?.loyalty_tiers), [settings?.loyalty_tiers]);
}
