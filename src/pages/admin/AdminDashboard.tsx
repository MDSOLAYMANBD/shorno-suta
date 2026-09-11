import { useEffect, useState, Suspense } from 'react';
import { Link, useNavigate, Outlet, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { LayoutDashboard, ShoppingCart, Package, Tag, LogOut, Settings, AlertTriangle, Menu, Store, Users, Ticket, Globe, Image as ImageIcon, Palette, PenTool, UserCog, MessageCircle, Bell, Gauge, Calculator, BellRing, ChevronRight, Shield, RefreshCw, BarChart3, Gift, Truck, UserCircle, Sun, Moon, Send, Inbox, Contact, Sparkles, Megaphone, Plug, MessageSquare, Wallet, Eye } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { usePermissions, type PermissionLevel } from '@/hooks/usePermissions';
import AdminBottomNav from '@/components/admin/AdminBottomNav';
import DynamicIsland from '@/components/admin/DynamicIsland';
import AdminNotificationCenter from '@/components/admin/AdminNotificationCenter';
import { toast } from 'sonner';
import { useNotificationSound } from '@/hooks/useNotificationSound';
import { usePushSubscription } from '@/hooks/usePushSubscription';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import IncomingCallNotification from '@/components/admin/inbox/IncomingCallNotification';
import CallStatusBanner from '@/components/admin/inbox/CallStatusBanner';
import LiveVisitorBadge from '@/components/LiveVisitorBadge';

const ALL_SIDEBAR_LINKS = [
  { label: 'ড্যাশবোর্ড', to: '/admin/dashboard', icon: LayoutDashboard, section: 'dashboard', hasSubLinks: true, iconColor: 'bg-blue-100 text-blue-600',
    subLinks: [
      { label: 'এনালিটিক্স', to: '/admin/analytics', icon: BarChart3, section: 'dashboard' },
      { label: 'ভিজিটর অ্যানালিটিক্স', to: '/admin/visitor-analytics', icon: Eye, section: 'dashboard' },
    ]
  },
  { label: 'হিসাব', to: '/admin/accounting', icon: Calculator, section: 'accounting', hasSubLinks: true, iconColor: 'bg-yellow-100 text-yellow-600',
    subLinks: [
      { label: 'পেমেন্ট', to: '/admin/courier', icon: Truck, section: 'courier' },
      { label: 'সেটিংস', to: '/admin/accounting/settings', icon: Settings, section: 'accounting' },
    ]
  },
  { label: 'লাইভ চ্যাট', to: '/admin/live-chat', icon: MessageCircle, section: 'live_chat', hasBadge: true, hasSubLinks: true, iconColor: 'bg-emerald-100 text-emerald-600',
    subLinks: [
      { label: 'লাইভ চ্যাট সেটিংস', to: '/admin/live-chat/settings', icon: Settings, section: 'live_chat' },
      { label: 'AI চ্যাট সেটিংস', to: '/admin/ai-chat-settings', icon: Sparkles, section: 'live_chat' },
      { label: 'হিউম্যান সাপোর্ট রিকোয়েস্ট', to: '/admin/ai-support-requests', icon: MessageCircle, section: 'live_chat' },
    ]
  },
  { label: 'স্মার্ট ইনবক্স', to: '/admin/smart-inbox', icon: Inbox, section: 'smart_inbox', hasSubLinks: true, iconColor: 'bg-rose-100 text-rose-600',
    subLinks: [
      { label: 'ইন্টিগ্রেশন', to: '/admin/smart-inbox/integrations', icon: Plug, section: 'smart_inbox' },
    ]
  },
  { label: 'অর্ডার', to: '/admin/orders', icon: ShoppingCart, section: 'orders', hasSubLinks: true, iconColor: 'bg-green-100 text-green-600',
    subLinks: [
      { label: 'অসম্পূর্ণ', to: '/admin/abandoned-checkouts', icon: AlertTriangle, section: 'orders' },
      { label: 'ফ্রড ম্যানেজমেন্ট', to: '/admin/fraud-management', icon: Shield, section: 'orders' },
      { label: 'গিভঅ্যাওয়ে', to: '/admin/giveaway', icon: Gift, section: 'orders' },
    ]
  },
  
  { label: 'প্রোডাক্ট', to: '/admin/products', icon: Package, section: 'products', iconColor: 'bg-purple-100 text-purple-600' },
  { label: 'ক্যাটাগরি', to: '/admin/categories', icon: Tag, section: 'categories', hasSubLinks: true, iconColor: 'bg-orange-100 text-orange-600',
    subLinks: [
      { label: 'সাইজ/কালার', to: '/admin/sizes-colors', icon: Palette, section: 'sizes_colors' },
    ]
  },
  { label: 'কাস্টমার', to: '/admin/customers', icon: Users, section: 'customers', hasSubLinks: true, iconColor: 'bg-cyan-100 text-cyan-600',
    subLinks: [
      { label: 'কুপন', to: '/admin/coupons', icon: Ticket, section: 'coupons' },
      { label: 'রিভিউ', to: '/admin/reviews', icon: Store, section: 'customers' },
      { label: 'একাউন্ট', to: '/admin/customer-accounts', icon: UserCircle, section: 'customers' },
      { label: 'ইমেইল ক্যাম্পেইন', to: '/admin/email-campaign', icon: Send, section: 'customers' },
      { label: 'SMS ক্যাম্পেইন', to: '/admin/sms-campaign', icon: MessageSquare, section: 'customers' },
      { label: 'SMS ও ইমেইল হিস্ট্রি', to: '/admin/notifications', icon: BellRing, section: 'customers' },
      { label: 'লয়্যালটি বাজ', to: '/admin/customers/loyalty-badges', icon: Sparkles, section: 'customers' },
      { label: '🚚 ফ্রি ডেলিভারি সিস্টেম', to: '/admin/free-shipping', icon: Truck, section: 'customers' },
    ]
  },
  { label: 'ল্যান্ডিং পেজ', to: '/admin/landing-pages', icon: Globe, section: 'landing_pages', iconColor: 'bg-teal-100 text-teal-600' },
  { label: 'মিডিয়া', to: '/admin/media', icon: ImageIcon, section: 'media', hasSubLinks: true, iconColor: 'bg-indigo-100 text-indigo-600',
    subLinks: [
      { label: 'AI ব্যানার (Gemini)', to: '/admin/banner-generator', icon: Sparkles, section: 'media' },
    ]
  },
  { label: 'সেটিংস', to: '/admin/settings', icon: Settings, section: 'settings', hasSubLinks: true, iconColor: 'bg-slate-100 text-slate-600',
    subLinks: [
      { label: 'সাইট এডিটর', to: '/admin/site-editor', icon: PenTool, section: 'site_editor' },
      { label: 'এমপ্লয়ী', to: '/admin/employees', icon: UserCog, section: 'employees' },
      { label: 'পারফরম্যান্স', to: '/admin/performance', icon: Gauge, section: 'settings' },
      { label: 'ইন্টিগ্রেশন', to: '/admin/settings/integrations', icon: Plug, section: 'settings' },
      { label: 'পেমেন্ট সেটিংস', to: '/admin/settings/payment', icon: Wallet, section: 'settings' },
      { label: 'AI Keys', to: '/admin/ai-keys', icon: Sparkles, section: 'settings' },
    ]
  },
  { label: 'CRM', to: '/admin/crm', icon: Contact, section: 'crm', iconColor: 'bg-violet-100 text-violet-600' },
  { label: 'ব্রডকাস্ট', to: '/admin/broadcast', icon: Megaphone, section: 'marketing', iconColor: 'bg-fuchsia-100 text-fuchsia-600' },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Unified admin auth (replaces brittle local getSession + 10s timeout flow).
  const { ready: authReady, user, isStaff, roleChecked, roleCheckFailed, retryRoleCheck, signOut: authSignOut } = useAdminAuth();
  const userId = user?.id || '';
  const userEmail = user?.email || '';

  // Permissions only loaded once auth is ready and we have a verified staff user.
  // Pass empty string when not ready so usePermissions safely waits.
  const { permissions, loading: permLoading, can } = usePermissions(
    authReady && isStaff && userId ? userId : ''
  );

  const { notify } = useNotificationSound();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('admin-theme');
    if (saved) return saved === 'dark';
    return document.documentElement.classList.contains('dark');
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('admin-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  // Push subscription for background notifications — only after auth confirmed
  usePushSubscription(authReady && isStaff ? userId : '');

  // Fetch logged-in user's profile
  const { data: myProfile } = useQuery({
    queryKey: ['my-profile', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('employee_profiles')
        .select('full_name, avatar_url')
        .eq('user_id', userId)
        .single();
      return data;
    },
    enabled: !!userId,
  });

  const { data: abandonedCount = 0 } = useQuery({
    queryKey: ['abandoned-count'],
    queryFn: async () => {
      const { count } = await supabase.from('abandoned_checkouts').select('*', { count: 'exact', head: true }).eq('status', 'abandoned');
      return count || 0;
    },
  });

  const { data: chatUnreadCount = 0 } = useQuery({
    queryKey: ['chat-unread-count'],
    queryFn: async () => {
      const { data } = await supabase.from('chat_sessions').select('unread_count').eq('status', 'active').gt('unread_count', 0);
      return (data || []).reduce((sum, s) => sum + (s.unread_count || 0), 0);
    },
    staleTime: 5 * 60 * 1000, // 5 min — realtime invalidates on new chat msg
  });

  const { data: notifUnreadCount = 0 } = useQuery({
    queryKey: ['notif-unread-count', userId],
    queryFn: async () => {
      const { count } = await supabase
        .from('staff_notifications' as any)
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', userId)
        .eq('is_read', false);
      return count || 0;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 min — realtime invalidates on new staff notif
  });

  // Redirect when auth bootstrap finished and user is missing or lacks staff role.
  // We only act AFTER the role check has actually completed (roleChecked=true)
  // to avoid kicking the user out during a transient role-RPC failure.
  // Mobile PWA hardening: before redirecting on `!user`, double-check the
  // SDK with a small debounce — token refresh races can briefly drop the
  // session reference even though storage still has a valid one.
  useEffect(() => {
    if (!authReady) return;

    if (!user) {
      // Mobile PWA: before redirecting, give the SDK extra time to recover
      // a refresh-token-rotated session. Also peek localStorage — if a
      // session blob is still there, it's a transient null, NOT a logout.
      let cancelled = false;
      const check = async () => {
        // Wait briefly first so a TOKEN_REFRESHED event can land.
        await new Promise((r) => setTimeout(r, 1200));
        if (cancelled) return;
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (cancelled) return;
          if (session) return; // recovered
          const stored = localStorage.getItem('sb-xxucasikopqtcztbgfbw-auth-token');
          if (stored) {
            // Session token still present — wait once more.
            await new Promise((r) => setTimeout(r, 1500));
            if (cancelled) return;
            const { data: { session: s2 } } = await supabase.auth.getSession();
            if (cancelled || s2) return;
          }
        } catch {
          // transient — don't bounce
          return;
        }
        if (cancelled) return;
        navigate('/admin', { replace: true });
      };
      check();
      return () => { cancelled = true; };
    }

    if (roleChecked && !isStaff) {
      authSignOut().finally(() => {
        navigate('/admin', { replace: true });
      });
    }
  }, [authReady, user, isStaff, roleChecked, navigate, authSignOut]);

  // Realtime: new orders
  useEffect(() => {
    const channel = supabase
      .channel('new-orders-notif')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'orders',
      }, (payload) => {
        const order = payload.new as any;
        const total = Number(order.total || 0).toLocaleString('bn-BD');
        notify('order', `নতুন অর্ডার এসেছে! 🎉`, `৳${total} এর নতুন অর্ডার — ${order.customer_name || 'কাস্টমার'}`, () => {
          navigate('/admin/orders');
        }, `order-${order.order_number || order.id}`);
        toast.success(`নতুন অর্ডার এসেছে! 🎉`, {
          description: `৳${total} — ${order.customer_name || 'কাস্টমার'} (${order.order_number || ''})`,
          duration: 10000,
        });
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
        queryClient.invalidateQueries({ queryKey: ['all-orders-fraud'] });
        queryClient.invalidateQueries({ queryKey: ['admin-dashboard-stats'] });
        queryClient.invalidateQueries({ queryKey: ['admin-hourly-orders'] });
        queryClient.invalidateQueries({ queryKey: ['admin-top-products'] });
        queryClient.invalidateQueries({ queryKey: ['pending-orders-count'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient, notify, navigate]);

  // Realtime: order status updates
  useEffect(() => {
    const channel = supabase
      .channel('order-updates-notif')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
        queryClient.invalidateQueries({ queryKey: ['all-orders-fraud'] });
        queryClient.invalidateQueries({ queryKey: ['admin-dashboard-stats'] });
        queryClient.invalidateQueries({ queryKey: ['pending-orders-count'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // Realtime: new staff notifications (messages)
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel('new-staff-notif')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'staff_notifications',
        filter: `recipient_id=eq.${userId}`,
      }, (payload) => {
        const notifData = payload.new as any;
        notify('message', '📩 নতুন বার্তা!', notifData.message || '', () => {
          navigate(`/admin/employees/${userId}?tab=notifications`);
        });
        toast.info('📩 নতুন বার্তা!', {
          description: notifData.message?.substring(0, 80) || '',
          duration: 6000,
        });
        queryClient.invalidateQueries({ queryKey: ['notif-unread-count'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, queryClient, notify, navigate]);

  // Realtime: new chat messages
  useEffect(() => {
    const channel = supabase
      .channel('new-chat-msg-notif')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: 'sender_type=eq.visitor',
      }, (payload) => {
        const msg = payload.new as any;
        notify('chat', '💬 নতুন চ্যাট মেসেজ!', `${msg.sender_name || 'ভিজিটর'}: ${(msg.message || '').substring(0, 60)}`, () => {
          navigate('/admin/live-chat');
        });
        toast('💬 নতুন চ্যাট মেসেজ!', {
          description: `${msg.sender_name || 'ভিজিটর'}: ${(msg.message || '').substring(0, 60)}`,
          duration: 5000,
        });
        queryClient.invalidateQueries({ queryKey: ['chat-unread-count'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient, notify, navigate]);

  // Show spinner until auth bootstrap finishes. Once ready:
  //  - if no user, the redirect effect above sends them to /admin (still show spinner briefly)
  //  - if user but role not yet confirmed, keep showing spinner rather than
  //    rendering the dashboard with no permissions.
  // Inline retry UI when role check failed after all retries — instead of
  // bouncing the admin back to login on a transient JWT/network race.
  if (authReady && user && roleCheckFailed) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center text-destructive text-xl">!</div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Role যাচাই করা যায়নি</p>
        <p className="text-xs text-muted-foreground">নেটওয়ার্ক সমস্যা হতে পারে। আবার চেষ্টা করুন।</p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => retryRoleCheck()}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
        >
          আবার চেষ্টা করুন
        </button>
        <button
          onClick={() => { authSignOut().finally(() => navigate('/admin', { replace: true })); }}
          className="px-4 py-2 rounded-md border border-border text-sm text-foreground hover:bg-muted"
        >
          লগআউট
        </button>
      </div>
    </div>
  );

  if (!authReady || !user || (roleChecked && !isStaff) || permLoading) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-muted-foreground">
      <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-sm">লোড হচ্ছে...</p>
    </div>
  );

  const sidebarLinks = ALL_SIDEBAR_LINKS.filter(l => can(l.section));
  const isActive = (path: string) => location.pathname === path;

  const displayName = myProfile?.full_name || 'স্বর্ণ সুতা';
  const avatarUrl = myProfile?.avatar_url || '';

  const isDashboardExpanded = location.pathname.startsWith('/admin/dashboard') || location.pathname.startsWith('/admin/analytics');
  const isOrdersExpanded = location.pathname.startsWith('/admin/orders') || location.pathname.startsWith('/admin/abandoned') || location.pathname.startsWith('/admin/fraud') || location.pathname.startsWith('/admin/giveaway');
  const isAccountingExpanded = location.pathname.startsWith('/admin/accounting') || location.pathname.startsWith('/admin/courier');
  const isCategoriesExpanded = location.pathname.startsWith('/admin/categories') || location.pathname.startsWith('/admin/sizes-colors');
  const isCustomersExpanded = location.pathname.startsWith('/admin/customers') || location.pathname.startsWith('/admin/coupons') || location.pathname.startsWith('/admin/reviews') || location.pathname.startsWith('/admin/customer-accounts') || location.pathname.startsWith('/admin/email-campaign') || location.pathname.startsWith('/admin/sms-campaign') || location.pathname.startsWith('/admin/notifications') || location.pathname.startsWith('/admin/free-shipping');
  const isSettingsExpanded = location.pathname.startsWith('/admin/settings') || location.pathname.startsWith('/admin/site-editor') || location.pathname.startsWith('/admin/employees') || location.pathname.startsWith('/admin/performance') || location.pathname.startsWith('/admin/ai-keys');
  const isSmartInboxExpanded = location.pathname.startsWith('/admin/smart-inbox');
  const isLiveChatExpanded = location.pathname.startsWith('/admin/live-chat') || location.pathname.startsWith('/admin/ai-chat-settings') || location.pathname.startsWith('/admin/ai-support-requests');

  const NavItems = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="space-y-2">
      {sidebarLinks.map((l, index) => (
        <div key={l.to} className="animate-fade-in" style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'backwards' }}>
          <Link to={l.to} onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300',
              isActive(l.to) || (l.section === 'orders' && location.pathname.startsWith('/admin/abandoned'))
                ? 'bg-primary/10 border border-primary/30 shadow-sm text-foreground'
                : 'bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted/80 hover:shadow-md hover:scale-[1.02]'
            )}>
            <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', l.iconColor)}>
              <l.icon className="h-[18px] w-[18px]" />
            </div>
            <span className="flex-1">{l.label}</span>
            {l.section === 'orders' && abandonedCount > 0 ? (
              <span className="bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
                {abandonedCount}
              </span>
            ) : l.hasBadge && l.section === 'live_chat' && chatUnreadCount > 0 ? (
              <span className="bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
                {chatUnreadCount}
              </span>
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
            )}
          </Link>
          {/* Generic subLinks for orders, categories, customers, settings */}
          {(l as any).subLinks && (
            (l.section === 'dashboard' && isDashboardExpanded) ||
            (l.section === 'orders' && isOrdersExpanded) ||
            (l.section === 'categories' && isCategoriesExpanded) ||
            (l.section === 'customers' && isCustomersExpanded) ||
            (l.section === 'accounting' && isAccountingExpanded) ||
            (l.section === 'settings' && isSettingsExpanded) ||
            (l.section === 'smart_inbox' && isSmartInboxExpanded) ||
            (l.section === 'live_chat' && isLiveChatExpanded)
          ) && (l as any).subLinks.map((sub: any) => (
            can(sub.section) && (
              <Link key={sub.to} to={sub.to} onClick={onNavigate}
                className={cn(
                  'flex items-center gap-2 pl-14 pr-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 mt-1',
                  isActive(sub.to)
                    ? 'text-primary bg-primary/10'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}>
                <sub.icon className="h-3.5 w-3.5" />
                {sub.label}
                {sub.to === '/admin/abandoned-checkouts' && abandonedCount > 0 && (
                  <span className="ml-auto bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                    {abandonedCount}
                  </span>
                )}
              </Link>
            )
          ))}
        </div>
      ))}
    </nav>
  );

  const SidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      <div className="flex items-center justify-between px-3 mb-8">
        <Link
          to={`/admin/employees/${userId}`}
          onClick={onNavigate}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity min-w-0"
        >
          <Avatar className="h-9 w-9">
            <AvatarImage src={avatarUrl} />
            <AvatarFallback className="text-xs font-bold">
              {displayName[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h2 className="font-bold text-base truncate">স্বর্ণ সুতা</h2>
            <p className="text-[10px] text-muted-foreground truncate">{displayName}</p>
          </div>
        </Link>
        <AdminNotificationCenter userId={userId} />
      </div>

      <LiveVisitorBadge compactBelowSm={false} className="mx-1 mb-3 w-fit" />

      {notifUnreadCount > 0 && (
        <Link to={`/admin/employees/${userId}?tab=notifications`} onClick={onNavigate}
          className="block mx-1 mb-3 p-3 rounded-xl bg-gradient-to-r from-primary to-blue-600 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Bell className="h-5 w-5 animate-bounce" />
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 bg-red-400 rounded-full animate-ping" />
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 bg-red-400 rounded-full" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold">{notifUnreadCount} নতুন বার্তা আছে!</p>
              <p className="text-[11px] text-white/80 mt-0.5">পড়ুন →</p>
            </div>
          </div>
        </Link>
      )}


      <NavItems onNavigate={onNavigate} />

      <div className="mt-auto pt-6 space-y-2">
        <div className="flex items-center justify-between px-4 py-2 rounded-xl bg-muted/40">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            <span>{isDark ? 'ডার্ক মোড' : 'লাইট মোড'}</span>
          </div>
          <Switch checked={isDark} onCheckedChange={setIsDark} />
        </div>
        <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive"
          onClick={async () => { await authSignOut(); navigate('/admin'); }}>
          <LogOut className="h-4 w-4 mr-2" /> লগআউট
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-background overflow-x-clip">
      <aside className="admin-sidebar w-64 bg-background border-r border-border p-4 hidden md:flex flex-col shrink-0 sticky top-0 h-screen overflow-y-auto scrollbar-hide print:!hidden">
        <SidebarContent />
      </aside>

      <div className="admin-mobile-header md:hidden fixed top-0 left-0 right-0 z-50 bg-background border-b border-border h-14 flex items-center px-4 print:!hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-60 p-4 flex flex-col overflow-y-auto">
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
        <Link to="/admin/dashboard" className="flex items-center gap-2 ml-2">
          <Avatar className="h-7 w-7">
            <AvatarImage src={avatarUrl} />
            <AvatarFallback className="text-xs">{displayName[0]?.toUpperCase() || 'U'}</AvatarFallback>
          </Avatar>
          <span className="font-bold text-sm truncate max-w-[150px]">স্বর্ণ সুতা</span>
        </Link>
        <div className="flex items-center gap-1 ml-auto">
          <LiveVisitorBadge />
          <AdminNotificationCenter userId={userId} />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setIsRefreshing(true);
              queryClient.invalidateQueries();
              setTimeout(() => setIsRefreshing(false), 1000);
            }}
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          </Button>
        </div>
      </div>

      <main className="flex-1 min-w-0 md:mt-0 mt-14 pb-16 md:pb-0 print:!p-0 print:!m-0 print:!mt-0">
        {/* Persistent live call status — sticky at top of main content */}
        <CallStatusBanner />
        <div className="p-4 md:p-6">
          <DynamicIsland userId={userId} />
          <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
            <Outlet />
          </Suspense>
        </div>
      </main>

      <AdminBottomNav />
      {/* Global incoming call ringer — works on any admin page */}
      <IncomingCallNotification />
    </div>
  );
}
