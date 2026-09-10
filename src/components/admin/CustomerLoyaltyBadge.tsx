import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { getLoyaltyTier, normalizePhoneVariants } from '@/lib/customerLoyalty';
import { useLoyaltyTiers } from '@/hooks/useLoyaltyTiers';
import CustomerProfileDialog from './CustomerProfileDialog';
import { ShoppingBag } from 'lucide-react';

interface Props {
  phone: string | null | undefined;
  /** Pre-fetched customer record (e.g. from a batched query). When provided, skip the network request. */
  preloaded?: { delivered_orders?: number | null; total_orders?: number | null; name?: string | null; address?: string | null } | null;
  /** Compact mode for table rows */
  compact?: boolean;
  /** Show order count next to the badge */
  showCount?: boolean;
  /** Hide if customer has 0 delivered orders (i.e. only show repeat+) */
  hideForNew?: boolean;
}

export default function CustomerLoyaltyBadge({ phone, preloaded, compact = true, showCount = true, hideForNew = false }: Props) {
  const [open, setOpen] = useState(false);
  const tiers = useLoyaltyTiers();
  const phones = normalizePhoneVariants(phone || '');

  const { data } = useQuery({
    queryKey: ['customer-loyalty', phones[0] || ''],
    queryFn: async () => {
      if (phones.length === 0) return null;
      const { data } = await supabase
        .from('customers')
        .select('id, name, phone, address, delivered_orders, total_orders, total_spent')
        .in('phone', phones)
        .order('total_orders', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!phone && !preloaded,
    staleTime: 60_000,
  });

  const record: any = preloaded || data;
  const delivered = Number(record?.delivered_orders || 0);
  const total = Number(record?.total_orders || 0);

  if (!phone) return null;
  if (hideForNew && delivered < 2 && total < 2) return null;

  const tier = getLoyaltyTier(delivered, tiers);

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className="inline-flex items-center gap-1 group"
        title="কাস্টমারের অর্ডার হিস্ট্রি দেখুন"
      >
        <Badge variant="outline" className={`${tier.className} ${compact ? 'text-[10px] px-1.5 py-0 h-4' : 'text-xs px-2 py-0.5'} font-medium border group-hover:brightness-95 transition`}>
          <span className="mr-0.5">{tier.emoji}</span>
          {compact ? tier.shortLabel : tier.label}
        </Badge>
        {showCount && total > 0 && (
          <span className={`inline-flex items-center gap-0.5 ${compact ? 'text-[10px]' : 'text-xs'} text-muted-foreground group-hover:text-primary transition`}>
            <ShoppingBag className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
            {total}x
          </span>
        )}
      </button>
      {open && (
        <CustomerProfileDialog
          customer={{
            name: record?.name || '',
            phone: phone,
            address: record?.address || '',
          }}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </>
  );
}
