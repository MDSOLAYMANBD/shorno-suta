import { Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWelcomeIslandMessages } from '@/hooks/useWelcomeIslandMessages';

// Desktop-only floating pill. On mobile, WelcomeIslandInline renders the same
// messages inside the navbar's logo/search gap instead (no spare screen real
// estate on desktop for that trick, so it keeps the floating overlay there).
export default function CustomerWelcomeIsland() {
  const { cfg, messages, visible, isExiting, index, fading, hide, handleClick } = useWelcomeIslandMessages();

  if (!cfg.enabled || !visible || messages.length === 0) return null;

  return (
    <div
      className={cn(
        'hidden lg:block fixed top-3 left-1/2 -translate-x-1/2 z-[9998] select-none',
        isExiting ? 'animate-island-collapse' : 'animate-island-expand',
      )}
      role="status"
      aria-live="polite"
    >
      <div
        onClick={handleClick}
        className="cursor-pointer flex items-center gap-2.5 px-4 py-2.5 pr-2 rounded-full shadow-2xl border border-white/20 max-w-[480px] backdrop-blur-md"
        style={{
          background: `linear-gradient(135deg, ${cfg.gradient_from} 0%, ${cfg.gradient_via} 50%, ${cfg.gradient_to} 100%)`,
          color: cfg.text_color,
          boxShadow: `0 10px 30px -8px ${cfg.gradient_from}88, 0 0 0 1px hsl(0 0% 100% / 0.08) inset`,
        }}
      >
        <Sparkles className="h-4 w-4 shrink-0 animate-pulse" style={{ color: cfg.icon_color }} />
        <span
          className={cn(
            'text-sm font-medium leading-snug truncate transition-all duration-300',
            fading ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0',
          )}
        >
          {messages[index]}
        </span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); hide(); }}
          aria-label="Close"
          className="ml-1 shrink-0 h-6 w-6 inline-flex items-center justify-center rounded-full hover:bg-white/15 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
