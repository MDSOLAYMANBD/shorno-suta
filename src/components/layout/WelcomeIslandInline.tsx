import { Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWelcomeIslandMessages } from '@/hooks/useWelcomeIslandMessages';

// Mobile-only — fills the empty gap in the navbar between the logo and the
// search/menu icons with the same rotating welcome messages the desktop
// version shows as a floating pill (CustomerWelcomeIsland).
export default function WelcomeIslandInline() {
  const { cfg, messages, visible, isExiting, index, fading, hide, handleClick } = useWelcomeIslandMessages({ persistent: true });

  if (!cfg.enabled || !visible || messages.length === 0) return null;

  return (
    <div
      className={cn(
        'lg:hidden flex-1 min-w-0 flex justify-center px-1.5 select-none',
        isExiting ? 'animate-island-collapse-inline' : 'animate-island-expand-inline',
      )}
      role="status"
      aria-live="polite"
    >
      <div
        onClick={handleClick}
        className="cursor-pointer flex items-center gap-1.5 max-w-full px-3 py-1.5 pr-1 rounded-full shadow-md border border-white/20 backdrop-blur-md"
        style={{
          background: `linear-gradient(135deg, ${cfg.gradient_from} 0%, ${cfg.gradient_via} 50%, ${cfg.gradient_to} 100%)`,
          color: cfg.text_color,
          boxShadow: `0 6px 16px -6px ${cfg.gradient_from}88, 0 0 0 1px hsl(0 0% 100% / 0.08) inset`,
        }}
      >
        <Sparkles className="h-3 w-3 shrink-0 animate-pulse" style={{ color: cfg.icon_color }} />
        <span
          className={cn(
            'text-[11px] font-medium leading-none truncate transition-all duration-300',
            fading ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0',
          )}
        >
          {messages[index]}
        </span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); hide(); }}
          aria-label="Close"
          className="shrink-0 h-4 w-4 inline-flex items-center justify-center rounded-full hover:bg-white/15 transition-colors"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      </div>
    </div>
  );
}
