import React from 'react';
import { Truck, Gift, Sparkles, PartyPopper } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatFreeShippingMessage, type FreeShippingEvalForCampaign, type FreeShippingCampaign } from '@/lib/freeShipping';
import { useFreeShipping, useFreeShippingUnlockEffect } from '@/hooks/useFreeShipping';

export type FreeShippingVariant = 'compact' | 'banner' | 'inline' | 'sticky';

interface BaseProps {
  items: Array<{ id: string; quantity: number; price: number }>;
  appliedCouponCode?: string | null;
  variant?: FreeShippingVariant;
  className?: string;
  /** when true, fires confetti on unlock (default true for cart/checkout, false for product page preview) */
  celebrate?: boolean;
}

export function FreeShippingProgress({
  items,
  appliedCouponCode,
  variant = 'inline',
  className,
  celebrate = true,
}: BaseProps) {
  const { applied, nextBest, campaigns } = useFreeShipping({ items, appliedCouponCode });
  useFreeShippingUnlockEffect(celebrate && applied ? applied.id : null);

  // Build the eval-style object even when applied (so we can show "unlocked" UI)
  const visible: FreeShippingEvalForCampaign | null = applied
    ? {
        campaign: applied,
        qualified: true,
        progress: 1,
        missingQty: 0,
        missingAmount: 0,
        matchedQuantity: items.reduce((s, i) => s + i.quantity, 0),
        matchedSubtotal: items.reduce((s, i) => s + i.price * i.quantity, 0),
      }
    : nextBest;

  if (!visible || campaigns.length === 0) return null;
  // Hide if nothing in cart and rule needs quantity progress
  const cartEmpty = items.length === 0;
  if (cartEmpty && variant !== 'compact') return null;

  return <FreeShippingCard evaluation={visible} variant={variant} className={className} />;
}

export function FreeShippingCard({
  evaluation,
  variant = 'inline',
  className,
}: {
  evaluation: FreeShippingEvalForCampaign;
  variant?: FreeShippingVariant;
  className?: string;
}) {
  const { title, sub, tone } = formatFreeShippingMessage(evaluation);
  const pct = Math.round(evaluation.progress * 100);
  const toneStyles = {
    success: 'from-emerald-500/15 to-green-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
    urgent: 'from-orange-500/15 to-amber-500/10 border-orange-500/40 text-orange-700 dark:text-orange-300',
    info: 'from-primary/10 to-primary/5 border-primary/30 text-foreground',
  }[tone];
  const barColor = {
    success: 'bg-gradient-to-r from-emerald-500 to-green-500',
    urgent: 'bg-gradient-to-r from-orange-500 to-amber-500',
    info: 'bg-gradient-to-r from-primary to-primary/70',
  }[tone];

  const Icon = tone === 'success' ? PartyPopper : tone === 'urgent' ? Sparkles : Gift;

  if (variant === 'compact' || variant === 'sticky') {
    return (
      <div
        className={cn(
          'rounded-lg border bg-gradient-to-r px-3 py-2 text-xs sm:text-sm flex items-center gap-2',
          toneStyles,
          className,
        )}
      >
        <Truck className="h-4 w-4 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{title}</div>
          {sub && <div className="opacity-80 truncate text-[11px] sm:text-xs">{sub}</div>}
          <div className="mt-1 h-1.5 bg-background/60 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-500 ease-out', barColor)}
              
              style={{ width: `${pct}%` }}
              
            />
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'banner') {
    const bannerTone = {
      success: {
        bg: 'bg-gradient-to-br from-rose-500 via-red-500 to-amber-500',
        ring: 'ring-rose-300/60',
        chip: 'bg-white/25 text-white',
        text: 'text-white',
        sub: 'text-white/90',
        bar: 'bg-white',
        track: 'bg-white/25',
      },
      urgent: {
        bg: 'bg-gradient-to-br from-rose-500 via-red-500 to-amber-500',
        ring: 'ring-amber-300/60',
        chip: 'bg-white/25 text-white',
        text: 'text-white',
        sub: 'text-white/90',
        bar: 'bg-white',
        track: 'bg-white/25',
      },
      info: {
        bg: 'bg-gradient-to-br from-rose-500 via-red-500 to-amber-500',
        ring: 'ring-rose-300/60',
        chip: 'bg-white/25 text-white',
        text: 'text-white',
        sub: 'text-white/90',
        bar: 'bg-white',
        track: 'bg-white/25',
      },
    }[tone];

    return (
      <div
        className={cn(
          'group relative overflow-hidden rounded-xl shadow-md animate-fs-glow ring-1',
          bannerTone.ring,
          className,
        )}
      >
        <div className={cn('relative overflow-hidden px-2.5 py-2 sm:px-3 sm:py-2.5', bannerTone.bg)}>
          {/* Banner image faint overlay */}
          {evaluation.campaign.banner_image && (
            <img
              src={evaluation.campaign.banner_image}
              alt=""
              className="absolute inset-0 w-full h-full object-cover opacity-15 pointer-events-none mix-blend-overlay"
            />
          )}

          {/* Shimmer sweep */}
          <div className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-fs-shimmer" />

          <div className="relative flex items-center gap-2 sm:gap-2.5">
            {/* Icon medallion */}
            <div className={cn('relative shrink-0 rounded-full p-1.5 backdrop-blur-md border border-white/30 shadow-sm animate-fs-float', bannerTone.chip)}>
              <Truck className={cn('h-3.5 w-3.5 sm:h-4 sm:w-4', tone !== 'success' && 'animate-fs-truck')} />
              {tone === 'success' && (
                <PartyPopper className="absolute -top-1 -right-1 h-2.5 w-2.5 text-yellow-200 animate-fs-sparkle" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className={cn('font-bold text-[11px] sm:text-xs leading-tight truncate', bannerTone.text)}>
                  <span
                    className="bg-clip-text text-transparent bg-[length:200%_100%] animate-fs-text-shine"
                    style={{
                      backgroundImage: 'linear-gradient(90deg, #ffffff 0%, #fff7c2 25%, #ffffff 50%, #fff7c2 75%, #ffffff 100%)',
                    }}
                  >
                    {title}
                  </span>
                </div>
                <span className={cn('shrink-0 text-[9px] sm:text-[10px] font-mono font-bold tabular-nums px-1.5 py-0.5 rounded-md backdrop-blur-sm', bannerTone.chip)}>
                  {pct}%
                </span>
              </div>
              {sub && (
                <div className={cn('text-[10px] sm:text-[11px] mt-0.5 font-medium truncate', bannerTone.sub)}>
                  {sub}
                </div>
              )}

              {/* Progress bar */}
              <div className={cn('mt-1.5 h-1 rounded-full overflow-hidden relative', bannerTone.track)}>
                <div
                  className={cn('h-full rounded-full transition-all duration-700 ease-out relative overflow-hidden', bannerTone.bar)}
                  style={{ width: `${pct}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-fs-shimmer" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }


  // inline
  return (
    <div
      className={cn(
        'rounded-lg border bg-gradient-to-r p-3 flex items-center gap-3',
        toneStyles,
        className,
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="font-semibold text-sm">{title}</div>
          <span className="text-xs font-mono opacity-70">{pct}%</span>
        </div>
        {sub && <div className="text-xs opacity-90 mt-0.5">{sub}</div>}
        <div className="mt-1.5 h-1.5 bg-background/60 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500 ease-out', barColor)}
            
            style={{ width: `${pct}%` }}
            
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Static preview card (used in admin editor preview / product page teaser).
 */
export function FreeShippingTeaser({
  campaign,
  className,
}: {
  campaign: FreeShippingCampaign;
  className?: string;
}) {
  const sub =
    campaign.rule_type === 'amount' || campaign.rule_type === 'product_amount'
      ? `৳${campaign.min_amount} অর্ডার করলেই ফ্রি ডেলিভারি!`
      : campaign.rule_type === 'combo'
        ? `${campaign.min_quantity || 0} টি প্রোডাক্ট ${campaign.combine_logic === 'and' ? 'এবং' : 'অথবা'} ৳${campaign.min_amount || 0} অর্ডারে ফ্রি ডেলিভারি!`
        : `${campaign.min_quantity} টি প্রোডাক্ট নিলেই ফ্রি ডেলিভারি!`;
  return (
    <div
      className={cn(
        'rounded-lg border border-emerald-500/40 bg-gradient-to-r from-emerald-500/10 to-green-500/5 text-emerald-700 dark:text-emerald-300 px-3 py-2 flex items-center gap-2 text-xs sm:text-sm',
        className,
      )}
    >
      <Truck className="h-4 w-4 shrink-0" />
      <div className="flex-1">
        <div className="font-semibold">🚚 ফ্রি ডেলিভারি অফার</div>
        <div className="opacity-90">{sub}</div>
      </div>
    </div>
  );
}
