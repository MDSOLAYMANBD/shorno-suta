import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Zap } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface QuickRepliesProps {
  onSelect: (message: string) => void;
}

export default function QuickReplies({ onSelect }: QuickRepliesProps) {
  const { data: replies = [] } = useQuery({
    queryKey: ['inbox-quick-replies'],
    queryFn: async () => {
      const { data } = await supabase
        .from('inbox_quick_replies' as any)
        .select('*')
        .order('sort_order');
      return (data || []) as any[];
    },
  });

  if (replies.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Zap className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <p className="text-xs font-medium text-muted-foreground mb-2">দ্রুত উত্তর</p>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {replies.map((r: any) => (
            <button
              key={r.id}
              onClick={() => onSelect(r.message)}
              className="w-full text-left px-2 py-1.5 rounded-md hover:bg-muted text-xs transition-colors"
            >
              <span className="font-medium">{r.title}</span>
              <p className="text-muted-foreground truncate">{r.message}</p>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
