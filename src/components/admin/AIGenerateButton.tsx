import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface AIGenerateButtonProps {
  onClick: () => void;
  loading?: boolean;
  tooltip?: string;
  size?: 'sm' | 'icon';
  className?: string;
}

export default function AIGenerateButton({
  onClick,
  loading = false,
  tooltip = 'AI দিয়ে জেনারেট করুন',
  size = 'icon',
  className,
}: AIGenerateButtonProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size={size}
            onClick={onClick}
            disabled={loading}
            className={`shrink-0 border-primary/30 hover:border-primary hover:bg-primary/5 ${className || ''}`}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 text-primary" />
            )}
            {size === 'sm' && <span className="ml-1 text-xs">AI</span>}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
