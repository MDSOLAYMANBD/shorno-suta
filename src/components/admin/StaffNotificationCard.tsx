import { useState, useCallback, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import DOMPurify from 'dompurify';

/** Lightweight markdown-to-HTML for notification messages */
function formatMessage(text: string): string {
  if (!text) return '';
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  // bold **text**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // italic *text*
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // double newline → paragraph break
  html = html.replace(/\n\n+/g, '</p><p>');
  // single newline → <br>
  html = html.replace(/\n/g, '<br/>');
  return DOMPurify.sanitize(`<p>${html}</p>`, { ALLOWED_TAGS: ['p', 'br', 'strong', 'em'] });
}
import { MessageCircle, Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { formatDistanceToNow } from 'date-fns';
import { bn } from 'date-fns/locale';
import { toast } from 'sonner';

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'] as const;

type Reaction = { id: string; group_id: string; user_id: string; emoji: string; created_at: string };
type Comment = { id: string; group_id: string; user_id: string; user_name: string; comment: string; created_at: string };

interface StaffNotificationCardProps {
  notification: any;
  currentUserId: string;
  currentUserName: string;
  onMarkRead?: (id: string) => void;
  employees?: any[];
}

export default function StaffNotificationCard({
  notification: n,
  currentUserId,
  currentUserName,
  onMarkRead,
  employees = [],
}: StaffNotificationCardProps) {
  const queryClient = useQueryClient();
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [bouncingEmoji, setBouncingEmoji] = useState<string | null>(null);

  const groupId = n.group_id || n.id;

  // Realtime subscription for reactions and comments
  useEffect(() => {
    if (!groupId) return;
    const channel = supabase
      .channel(`notif-${groupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_notification_reactions', filter: `group_id=eq.${groupId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['notif-reactions', groupId] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_notification_comments', filter: `group_id=eq.${groupId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['notif-comments', groupId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [groupId, queryClient]);

  // Helper to resolve employee info by user_id
  const getEmployee = useCallback((uid: string) => {
    return employees.find((e: any) => e.user_id === uid);
  }, [employees]);

  const getEmployeeName = useCallback((uid: string) => {
    const emp = getEmployee(uid);
    return emp?.full_name || 'Unknown';
  }, [getEmployee]);

  const getEmployeeAvatar = useCallback((uid: string) => {
    const emp = getEmployee(uid);
    return emp?.avatar_url || '';
  }, [getEmployee]);

  // Resolve current user's display name (prefer full_name over email)
  const resolvedCurrentUserName = useMemo(() => {
    const emp = getEmployee(currentUserId);
    if (emp?.full_name) return emp.full_name;
    // If currentUserName looks like email, try to extract name part
    if (currentUserName && !currentUserName.includes('@')) return currentUserName;
    return emp?.full_name || currentUserName || 'Unknown';
  }, [currentUserId, currentUserName, getEmployee]);

  const { data: reactions = [] } = useQuery({
    queryKey: ['notif-reactions', groupId],
    queryFn: async () => {
      if (!groupId) return [];
      const { data } = await supabase
        .from('staff_notification_reactions' as any)
        .select('*')
        .eq('group_id', groupId);
      return (data as unknown as Reaction[]) || [];
    },
    enabled: !!groupId,
  });

  const { data: comments = [] } = useQuery({
    queryKey: ['notif-comments', groupId],
    queryFn: async () => {
      if (!groupId) return [];
      const { data } = await supabase
        .from('staff_notification_comments' as any)
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: true });
      return (data as unknown as Comment[]) || [];
    },
    enabled: !!groupId,
  });

  const myReaction = reactions.find(r => r.user_id === currentUserId);

  const handleReact = useCallback(async (emoji: string) => {
    if (!groupId) return;
    setBouncingEmoji(emoji);
    setTimeout(() => setBouncingEmoji(null), 600);
    try {
      if (myReaction) {
        if (myReaction.emoji === emoji) {
          await supabase.from('staff_notification_reactions' as any).delete().eq('id', myReaction.id);
        } else {
          await supabase.from('staff_notification_reactions' as any).update({ emoji }).eq('id', myReaction.id);
        }
      } else {
        await supabase.from('staff_notification_reactions' as any).insert({
          group_id: groupId,
          user_id: currentUserId,
          emoji,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['notif-reactions', groupId] });
    } catch {
      toast.error('রিঅ্যাকশন দিতে সমস্যা হয়েছে');
    }
  }, [groupId, myReaction, currentUserId, queryClient]);

  const handleComment = useCallback(async () => {
    if (!commentText.trim() || !groupId) return;
    setSendingComment(true);
    try {
      await supabase.from('staff_notification_comments' as any).insert({
        group_id: groupId,
        user_id: currentUserId,
        user_name: resolvedCurrentUserName,
        comment: commentText.trim(),
      });
      setCommentText('');
      queryClient.invalidateQueries({ queryKey: ['notif-comments', groupId] });
    } catch {
      toast.error('কমেন্ট করতে সমস্যা হয়েছে');
    } finally {
      setSendingComment(false);
    }
  }, [commentText, groupId, currentUserId, resolvedCurrentUserName, queryClient]);

  const reactionGroups = EMOJIS.map(emoji => {
    const users = reactions.filter(r => r.emoji === emoji);
    return { emoji, count: users.length, users };
  }).filter(g => g.count > 0);

  const senderName = getEmployeeName(n.sender_id) || n.sender_name || 'অ্যাডমিন';
  const senderAvatar = getEmployeeAvatar(n.sender_id);

  return (
    <div
      className={cn(
        'relative rounded-2xl border transition-all duration-500 animate-fade-in overflow-hidden group',
        'hover:shadow-lg hover:scale-[1.008] hover:-translate-y-0.5',
        !n.is_read
          ? 'bg-gradient-to-br from-primary/[0.06] via-card to-primary/[0.03] border-primary/25 shadow-[0_0_20px_-5px_hsl(var(--primary)/0.2)]'
          : 'bg-card border-border/60 hover:border-border'
      )}
      onClick={() => !n.is_read && onMarkRead?.(n.id)}
      role={!n.is_read ? 'button' : undefined}
    >
      {!n.is_read && (
        <div className="absolute top-2 right-2 text-primary/30 animate-pulse">
          <Sparkles className="h-4 w-4" />
        </div>
      )}

      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, hsl(var(--foreground)) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      />

      <div className="flex relative">
        <div className={cn(
          'w-1.5 shrink-0 rounded-l-2xl transition-all duration-500',
          !n.is_read
            ? 'bg-gradient-to-b from-primary via-primary/60 to-primary/20'
            : 'bg-gradient-to-b from-muted-foreground/15 via-muted-foreground/10 to-transparent'
        )} />

        <div className="flex-1 p-4 sm:p-5 space-y-3.5">
          {/* Header: sender avatar + name + time */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Avatar className={cn(
                'h-10 w-10 ring-2 transition-all duration-300',
                !n.is_read ? 'ring-primary/30' : 'ring-border/30'
              )}>
                <AvatarImage src={senderAvatar} alt={senderName} />
                <AvatarFallback className={cn(
                  'text-xs font-bold',
                  !n.is_read
                    ? 'bg-gradient-to-br from-primary to-primary/70 text-primary-foreground'
                    : 'bg-gradient-to-br from-muted to-muted/80 text-muted-foreground'
                )}>
                  {senderName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-semibold text-foreground">{senderName}</p>
                <p className="text-[11px] text-muted-foreground">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: bn })}
                </p>
              </div>
            </div>
            {!n.is_read && (
              <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_hsl(var(--primary)/0.5)]" />
            )}
          </div>

          {/* Message with better typography */}
          <div className={cn(
            'text-base leading-7 tracking-wide [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:font-bold [&_em]:italic',
            !n.is_read
              ? 'font-medium text-foreground'
              : 'text-muted-foreground'
          )}
            style={{ wordBreak: 'break-word', lineHeight: '1.8' }}
            dangerouslySetInnerHTML={{ __html: formatMessage(n.message) }}
          />

          {/* Reactions bar */}
          <TooltipProvider delayDuration={200}>
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              {reactionGroups.map(g => (
                <Tooltip key={g.emoji}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleReact(g.emoji); }}
                      className={cn(
                        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition-all duration-200',
                        g.users.some(u => u.user_id === currentUserId)
                          ? 'bg-primary/15 border-primary/30 text-primary shadow-sm'
                          : 'bg-muted/50 border-border hover:bg-muted hover:border-border/80',
                        bouncingEmoji === g.emoji && 'animate-bounce'
                      )}
                    >
                      <span className="text-sm">{g.emoji}</span>
                      <span className="font-semibold">{g.count}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    {g.users.map(u => getEmployeeName(u.user_id)).join(', ')}
                  </TooltipContent>
                </Tooltip>
              ))}

              <div className="flex items-center gap-0.5 ml-1">
                {EMOJIS.filter(e => !reactionGroups.some(g => g.emoji === e)).map(emoji => (
                  <button
                    key={emoji}
                    onClick={(e) => { e.stopPropagation(); handleReact(emoji); }}
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-base opacity-50 hover:opacity-100 hover:bg-muted/80 transition-all duration-200 hover:scale-125',
                      bouncingEmoji === emoji && 'animate-bounce opacity-100'
                    )}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </TooltipProvider>

          {/* Comments section */}
          <div className="border-t border-border/50 pt-3">
            <button
              onClick={(e) => { e.stopPropagation(); setShowComments(!showComments); }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors group/comment"
            >
              <MessageCircle className="h-4 w-4 group-hover/comment:text-primary transition-colors" />
              <span className="font-medium">মন্তব্য {comments.length > 0 && `(${comments.length})`}</span>
            </button>

            {showComments && (
              <div className="mt-3 space-y-2.5 animate-fade-in">
                {comments.map((c) => {
                  const commenterName = getEmployeeName(c.user_id) || c.user_name;
                  const commenterAvatar = getEmployeeAvatar(c.user_id);
                  return (
                    <div key={c.id} className="flex items-start gap-2.5 animate-fade-in">
                      <Avatar className="h-7 w-7 shrink-0 mt-0.5 ring-1 ring-border/20">
                        <AvatarImage src={commenterAvatar} alt={commenterName} />
                        <AvatarFallback className="text-[10px] font-bold bg-gradient-to-br from-accent to-accent/70 text-accent-foreground">
                          {commenterName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0 bg-muted/30 rounded-xl px-3 py-2">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs font-semibold text-foreground">{commenterName}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: bn })}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{c.comment}</p>
                      </div>
                    </div>
                  );
                })}

                <div className="flex items-center gap-2 pt-1">
                  <Input
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="মন্তব্য লিখুন..."
                    className="h-9 text-xs rounded-xl bg-muted/30 border-border/50 focus:border-primary/50"
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleComment()}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 shrink-0 rounded-xl hover:bg-primary/10 hover:text-primary"
                    disabled={!commentText.trim() || sendingComment}
                    onClick={(e) => { e.stopPropagation(); handleComment(); }}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
