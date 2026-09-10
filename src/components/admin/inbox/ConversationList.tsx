import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Search, MessageCircle, Instagram, Facebook, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { bn } from 'date-fns/locale';

interface Conversation {
  id: string;
  platform: string;
  customer_name: string;
  customer_phone: string;
  last_message: string;
  last_message_at: string;
  unread_count: number;
  status: string;
  tags: string[];
  lead_score?: string | null;
}

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isLoading: boolean;
}

const platformIcon: Record<string, React.ReactNode> = {
  website: <MessageCircle className="h-3 w-3" />,
  messenger: <Facebook className="h-3 w-3" />,
  instagram: <Instagram className="h-3 w-3" />,
  whatsapp: <Phone className="h-3 w-3" />,
};

const platformColor: Record<string, string> = {
  website: 'bg-emerald-100 text-emerald-700',
  messenger: 'bg-blue-100 text-blue-700',
  instagram: 'bg-pink-100 text-pink-700',
  whatsapp: 'bg-green-100 text-green-700',
};

export default function ConversationList({ conversations, selectedId, onSelect, isLoading }: ConversationListProps) {
  const [search, setSearch] = useState('');

  const filtered = conversations.filter(c =>
    c.customer_name.toLowerCase().includes(search.toLowerCase()) ||
    c.customer_phone.includes(search) ||
    c.last_message.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full border-r">
      <div className="p-3 border-b space-y-2">
        <h3 className="font-semibold text-sm">কথোপকথন</h3>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="খুঁজুন..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-xs text-muted-foreground">লোড হচ্ছে...</div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">কোনো কথোপকথন নেই</div>
        ) : (
          filtered.map(c => (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={cn(
                'w-full text-left p-3 border-b transition-colors hover:bg-muted/50',
                selectedId === c.id && 'bg-primary/5 border-l-2 border-l-primary'
              )}
            >
              <div className="flex items-start gap-2.5">
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarFallback className="text-xs bg-muted">
                    {c.customer_name?.charAt(0) || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-sm font-medium truncate">{c.customer_name || 'অজানা'}</span>
                    {c.unread_count > 0 && (
                      <span className="bg-primary text-primary-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                        {c.unread_count}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{c.last_message || '...'}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={cn('inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium', platformColor[c.platform] || 'bg-muted text-muted-foreground')}>
                      {platformIcon[c.platform]} {c.platform}
                    </span>
                    {c.lead_score === 'hot' && <span className="text-[10px]">🔥</span>}
                    {c.lead_score === 'medium' && <span className="text-[10px]">🟡</span>}
                    {Array.isArray(c.tags) && c.tags.includes('demo') && (
                      <span className="px-1 py-0 rounded bg-muted text-muted-foreground text-[9px] font-semibold tracking-wide">DEMO</span>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: true, locale: bn })}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
