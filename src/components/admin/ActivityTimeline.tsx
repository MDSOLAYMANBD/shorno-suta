import { useState } from 'react';
import { ShoppingCart, Package, Tag, Settings, Ticket, Globe, Edit, Trash2, Eye, MessageSquare } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

const PAGE_SIZE = 500;

const ACTION_CONFIG: Record<string, { icon: any; color: string }> = {
  order_status_change: { icon: ShoppingCart, color: 'text-blue-500' },
  note_added: { icon: MessageSquare, color: 'text-teal-500' },
  order_delete: { icon: Trash2, color: 'text-destructive' },
  product_create: { icon: Package, color: 'text-green-500' },
  product_edit: { icon: Edit, color: 'text-amber-500' },
  product_delete: { icon: Trash2, color: 'text-destructive' },
  category_create: { icon: Tag, color: 'text-green-500' },
  category_edit: { icon: Edit, color: 'text-amber-500' },
  category_delete: { icon: Trash2, color: 'text-destructive' },
  coupon_create: { icon: Ticket, color: 'text-green-500' },
  settings_change: { icon: Settings, color: 'text-purple-500' },
  default: { icon: Eye, color: 'text-muted-foreground' },
};

interface ActivityLog {
  id: string;
  action_type: string;
  description: string;
  created_at: string;
  employee_name?: string;
  employee_avatar?: string;
}

export default function ActivityTimeline({ logs }: { logs: ActivityLog[] }) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  if (!logs.length) {
    return <p className="text-sm text-muted-foreground text-center py-8">কোনো activity নেই</p>;
  }

  const visibleLogs = logs.slice(0, visibleCount);
  const hasMore = visibleCount < logs.length;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground text-right">
        দেখাচ্ছে {visibleLogs.length} / {logs.length}
      </p>
      {visibleLogs.map(log => {
        const config = ACTION_CONFIG[log.action_type] || ACTION_CONFIG.default;
        const Icon = config.icon;
        return (
          <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage src={log.employee_avatar || ''} />
              <AvatarFallback className="text-xs">{(log.employee_name || '?')[0].toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Icon className={`h-3.5 w-3.5 shrink-0 ${config.color}`} />
                <p className="text-sm truncate">{log.description}</p>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">{log.employee_name}</span>
                <span className="text-xs text-muted-foreground">•</span>
                <span className="text-xs text-muted-foreground">{format(new Date(log.created_at), 'dd MMM, hh:mm a')}</span>
              </div>
            </div>
          </div>
        );
      })}
      {hasMore && (
        <div className="text-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
          >
            আরো {Math.min(PAGE_SIZE, logs.length - visibleCount)}টি দেখুন
          </Button>
        </div>
      )}
    </div>
  );
}