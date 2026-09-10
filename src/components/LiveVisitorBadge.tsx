import { Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLiveVisitorCount } from '@/hooks/useLiveVisitorCount';
import { useAnimatedNumber } from '@/hooks/useAnimatedNumber';

interface LiveVisitorBadgeProps {
  className?: string;
  /** Hide the "জন দেখছেন" label below this breakpoint, keeping just the dot + number. */
  compactBelowSm?: boolean;
}

/** Small pill showing how many people are on the site right now. Shared
 * between the storefront navbar and the admin panel so both read the same
 * live count the same way. */
export default function LiveVisitorBadge({ className, compactBelowSm = true }: LiveVisitorBadgeProps) {
  const { data: count = 0 } = useLiveVisitorCount();
  const animated = useAnimatedNumber(count);

  if (!count) return null;

  return (
    <div
      className={cn(
        'flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-full border border-emerald-200 bg-emerald-50 dark:bg-emerald-500/10 dark:border-emerald-500/30 shrink-0',
        className,
      )}
      title="এই মুহূর্তে সাইটে যত জন আছেন"
    >
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </span>
      <Eye className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
        {animated.toLocaleString('bn-BD')}
      </span>
      <span className={cn('text-xs text-emerald-600/80 dark:text-emerald-400/70', compactBelowSm && 'hidden sm:inline')}>
        জন দেখছেন
      </span>
    </div>
  );
}
