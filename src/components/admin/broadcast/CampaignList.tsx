import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Send, Users, Eye, CheckCircle2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const statusColor: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  scheduled: 'bg-blue-100 text-blue-700',
  sending: 'bg-amber-100 text-amber-700',
  sent: 'bg-emerald-100 text-emerald-700',
};

export default function CampaignList() {
  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['broadcast-campaigns'],
    queryFn: async () => {
      const { data } = await supabase
        .from('inbox_broadcast_campaigns' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      return (data || []) as any[];
    },
    refetchInterval: 5000,
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">লোড হচ্ছে...</p>;
  if (campaigns.length === 0) return <p className="text-sm text-muted-foreground">কোনো ক্যাম্পেইন নেই</p>;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {campaigns.map((c: any) => (
        <Card key={c.id}>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-semibold text-sm truncate flex-1 min-w-0">{c.name}</h4>
              <Badge className={statusColor[c.status] || ''}>{c.status}</Badge>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">{c.message}</p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {c.audience_size}</span>
              <span className="flex items-center gap-1"><Send className="h-3 w-3" /> {c.sent_count}</span>
              <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> {c.delivered_count}</span>
              <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {c.opened_count}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {c.platform} • {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
