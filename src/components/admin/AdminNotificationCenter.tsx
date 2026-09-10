import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Bell, ShoppingCart, MessageCircle, AlertTriangle, Package, CheckCheck, BellOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { bn } from 'date-fns/locale';

type AdminNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  reference_id: string | null;
  is_read: boolean;
  created_at: string;
};

const TYPE_CONFIG: Record<string, { icon: typeof Bell; color: string }> = {
  order: { icon: ShoppingCart, color: 'bg-green-100 text-green-600' },
  order_update: { icon: Package, color: 'bg-blue-100 text-blue-600' },
  chat: { icon: MessageCircle, color: 'bg-emerald-100 text-emerald-600' },
  abandoned: { icon: AlertTriangle, color: 'bg-orange-100 text-orange-600' },
  info: { icon: Bell, color: 'bg-slate-100 text-slate-600' },
};

type Props = {
  userId?: string;
};

export default function AdminNotificationCenter({ userId }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  // Detect browser notification support & permission
  const notifSupported = typeof Notification !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
  const [browserPerm, setBrowserPerm] = useState<string>(
    notifSupported ? Notification.permission : 'unsupported'
  );

  // Fetch per-user push preference from DB
  const { data: pushPref, isLoading: prefLoading } = useQuery({
    queryKey: ['push-pref', userId],
    queryFn: async () => {
      // Try to get existing preference
      const { data, error } = await supabase
        .from('staff_notification_preferences' as any)
        .select('push_enabled')
        .eq('user_id', userId!)
        .maybeSingle();

      if (data) return (data as any).push_enabled as boolean;

      // No row yet — insert default (true)
      await supabase
        .from('staff_notification_preferences' as any)
        .insert({ user_id: userId, push_enabled: true });

      return true;
    },
    enabled: !!userId,
  });

  const pushEnabled = pushPref ?? true;

  // Mutation to toggle push preference
  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      // If enabling and browser permission not granted, request it
      if (enabled && notifSupported && Notification.permission !== 'granted') {
        const result = await Notification.requestPermission();
        setBrowserPerm(result);
        if (result !== 'granted') {
          throw new Error('Permission denied');
        }
      }

      const { error } = await supabase
        .from('staff_notification_preferences' as any)
        .update({ push_enabled: enabled, updated_at: new Date().toISOString() })
        .eq('user_id', userId!);

      if (error) throw error;
      return enabled;
    },
    onSuccess: (enabled) => {
      queryClient.setQueryData(['push-pref', userId], enabled);
    },
  });

  const handleToggle = () => {
    if (toggleMutation.isPending) return;
    toggleMutation.mutate(!pushEnabled);
  };

  const { data: notifications = [], refetch } = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: async () => {
      const { data } = await supabase
        .from('admin_notifications' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      return (data || []) as unknown as AdminNotification[];
    },
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`admin-notif-realtime-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'admin_notifications',
      }, () => {
        refetch();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refetch]);

  const markAsRead = useCallback(async (id: string) => {
    await supabase
      .from('admin_notifications' as any)
      .update({ is_read: true })
      .eq('id', id);
    queryClient.setQueryData(['admin-notifications'], (old: AdminNotification[] | undefined) =>
      (old || []).map(n => n.id === id ? { ...n, is_read: true } : n)
    );
  }, [queryClient]);

  const markAllRead = useCallback(async () => {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (!unreadIds.length) return;
    await supabase
      .from('admin_notifications' as any)
      .update({ is_read: true })
      .in('id', unreadIds);
    queryClient.setQueryData(['admin-notifications'], (old: AdminNotification[] | undefined) =>
      (old || []).map(n => ({ ...n, is_read: true }))
    );
  }, [notifications, queryClient]);

  const handleClick = (notif: AdminNotification) => {
    if (!notif.is_read) markAsRead(notif.id);
    if (notif.type === 'order' || notif.type === 'order_update') {
      const target = notif.reference_id
        ? `/admin/orders?preview=${notif.reference_id}`
        : '/admin/orders';
      navigate(target);
    } else if (notif.link) {
      navigate(notif.link);
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-[18px] w-[18px]" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 animate-in zoom-in">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0" align="end" sideOffset={8}>
        {/* Per-user push notification toggle */}
        {notifSupported && userId && (
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2">
              {pushEnabled && browserPerm === 'granted' ? (
                <Bell className="h-3.5 w-3.5 text-primary" />
              ) : (
                <BellOff className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <span className="text-xs font-medium">পুশ নোটিফিকেশন</span>
            </div>
            {browserPerm === 'denied' ? (
              <span className="text-[10px] text-destructive">ব্রাউজার সেটিংস থেকে অনুমতি দিন</span>
            ) : prefLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <Switch
                checked={pushEnabled}
                onCheckedChange={handleToggle}
                disabled={toggleMutation.isPending}
                className="scale-90"
              />
            )}
          </div>
        )}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-sm">নোটিফিকেশন</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7 gap-1 text-muted-foreground" onClick={markAllRead}>
              <CheckCheck className="h-3.5 w-3.5" />
              সব পড়া হয়েছে
            </Button>
          )}
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">কোনো নোটিফিকেশন নেই</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map(notif => {
                const config = TYPE_CONFIG[notif.type] || TYPE_CONFIG.info;
                const Icon = config.icon;
                const messageParts = notif.message.split('\n');
                const mainMsg = messageParts[0];
                const noteMsg = messageParts.length > 1 ? messageParts.slice(1).join('\n') : null;
                return (
                  <button
                    key={notif.id}
                    onClick={() => handleClick(notif)}
                    className={cn(
                      'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60',
                      !notif.is_read && 'bg-primary/5'
                    )}
                  >
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5', config.color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className={cn('text-sm truncate', !notif.is_read ? 'font-semibold' : 'font-medium text-muted-foreground')}>
                          {notif.title}
                        </p>
                        {!notif.is_read && (
                          <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{mainMsg}</p>
                      {noteMsg && (
                        <p className="text-xs text-primary/80 mt-0.5 line-clamp-2">{noteMsg}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: bn })}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
