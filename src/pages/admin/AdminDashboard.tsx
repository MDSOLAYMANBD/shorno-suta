import { useEffect, useState, Suspense } from 'react';
import { Link, useNavigate, Outlet, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { LayoutDashboard, ShoppingCart, Package, Tag, LogOut, Settings, AlertTriangle, Menu, Store, Users, Ticket, Globe, Image as ImageIcon, Palette, PenTool, UserCog, MessageCircle, Bell, Gauge, Calculator, BellRing, ChevronRight, Shield, RefreshCw, BarChart3, Gift, Truck, UserCircle, Sun, Moon, Send, Inbox, Contact, Sparkles, Megaphone, Plug, MessageSquare, Wallet, Eye, Crown, ChevronDown, ChevronLeft, Languages, PackagePlus, CalendarCheck } from 'lucide-react';
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
import { AUTH_STORAGE_KEY } from '@/integrations/supabase/config';
import { useCoreBilling } from '@/hooks/useCoreBilling';
import CoreLockScreen from '@/components/admin/CoreLockScreen';
import CoreBillingNotice from '@/components/admin/CoreBillingNotice';
import UpdateNotice from '@/components/admin/UpdateNotice';
import AdminLangToggle from '@/components/admin/AdminLangToggle';
import { useAdminLang, setAdminLang } from '@/lib/adminLang';
import { startEnglish, stopEnglish } from '@/lib/pageTranslate';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Portal as TooltipPortal } from '@radix-ui/react-tooltip';
import { tileClass, groupOf, groupLabel, groupRank, rowClass, subRowClass, badgeClass, type NavGroup } from '@/components/admin/sidebarLook';

// Everyone's own attendance (the person's page at its attendance tab), whatever their permissions:
// not a permission section, so it joins the menu after the permission check.
const ATTENDANCE_LINK = { label: 'হাজিরা', to: '/admin/attendance', icon: CalendarCheck, section: 'self' };

const ALL_SIDEBAR_LINKS = [
  { label: 'ড্যাশবোর্ড', to: '/admin/dashboard', icon: LayoutDashboard, section: 'dashboard', hasSubLinks: true,
    subLinks: [
      { label: 'এনালিটিক্স', to: '/admin/analytics', icon: BarChart3, section: 'dashboard' },
      { label: 'ভিজিটর অ্যানালিটিক্স', to: '/admin/visitor-analytics', icon: Eye, section: 'dashboard' },
    ]
  },
  { label: 'হিসাব', to: '/admin/accounting', icon: Calculator, section: 'accounting', hasSubLinks: true,
    subLinks: [
      { label: 'পেমেন্ট', to: '/admin/courier', icon: Truck, section: 'courier' },
      { label: 'সেটিংস', to: '/admin/accounting/settings', icon: Settings, section: 'accounting' },
    ]
  },
  { label: 'লাইভ চ্যাট', to: '/admin/live-chat', icon: MessageCircle, section: 'live_chat', hasBadge: true, hasSubLinks: true,
    subLinks: [
      { label: 'লাইভ চ্যাট সেটিংস', to: '/admin/live-chat/settings', icon: Settings, section: 'live_chat' },
      { label: 'AI চ্যাট সেটিংস', to: '/admin/ai-chat-settings', icon: Sparkles, section: 'live_chat' },
      { label: 'হিউম্যান সাপোর্ট রিকোয়েস্ট', to: '/admin/ai-support-requests', icon: MessageCircle, section: 'live_chat' },
    ]
  },
  { label: 'স্মার্ট ইনবক্স', to: '/admin/smart-inbox', icon: Inbox, section: 'smart_inbox', hasSubLinks: true,
    subLinks: [
      { label: 'ইন্টিগ্রেশন', to: '/admin/smart-inbox/integrations', icon: Plug, section: 'smart_inbox' },
    ]
  },
  { label: 'অর্ডার', to: '/admin/orders', icon: ShoppingCart, section: 'orders', hasSubLinks: true,
    subLinks: [
      { label: 'অসম্পূর্ণ', to: '/admin/abandoned-checkouts', icon: AlertTriangle, section: 'orders' },
      { label: 'ফ্রড ম্যানেজমেন্ট', to: '/admin/fraud-management', icon: Shield, section: 'orders' },
      { label: 'গিভঅ্যাওয়ে', to: '/admin/giveaway', icon: Gift, section: 'orders' },
    ]
  },
  
  { label: 'প্রোডাক্ট', to: '/admin/products', icon: Package, section: 'products' },
  // Dropshipping: Shadamon Shop's products, sold in the shop and shipped by Shadamon (supplier edge function)
  { label: 'ড্রপশিপিং', to: '/admin/shadamon', icon: PackagePlus, section: 'products' },
  { label: 'ক্যাটাগরি', to: '/admin/categories', icon: Tag, section: 'categories', hasSubLinks: true,
    subLinks: [
      { label: 'সাইজ/কালার', to: '/admin/sizes-colors', icon: Palette, section: 'sizes_colors' },
    ]
  },
  { label: 'কাস্টমার', to: '/admin/customers', icon: Users, section: 'customers', hasSubLinks: true,
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
  { label: 'ল্যান্ডিং পেজ', to: '/admin/landing-pages', icon: Globe, section: 'landing_pages' },
  { label: 'মিডিয়া', to: '/admin/media', icon: ImageIcon, section: 'media', hasSubLinks: true,
    subLinks: [
      { label: 'AI ব্যানার (Gemini)', to: '/admin/banner-generator', icon: Sparkles, section: 'media' },
    ]
  },
  { label: 'সেটিংস', to: '/admin/settings', icon: Settings, section: 'settings', hasSubLinks: true,
    subLinks: [
      { label: 'সাইট এডিটর', to: '/admin/site-editor', icon: PenTool, section: 'site_editor' },
      { label: 'এমপ্লয়ী', to: '/admin/employees', icon: UserCog, section: 'employees' },
      { label: 'পারফরম্যান্স', to: '/admin/performance', icon: Gauge, section: 'settings' },
      { label: 'ইন্টিগ্রেশন', to: '/admin/settings/integrations', icon: Plug, section: 'settings' },
      { label: 'পেমেন্ট সেটিংস', to: '/admin/settings/payment', icon: Wallet, section: 'settings' },
      { label: 'AI Keys', to: '/admin/ai-keys', icon: Sparkles, section: 'settings' },
    ]
  },
  { label: 'CRM', to: '/admin/crm', icon: Contact, section: 'crm' },
  { label: 'ব্রডকাস্ট', to: '/admin/broadcast', icon: Megaphone, section: 'marketing' },
  { label: 'বিল ও প্যাকেজ', to: '/admin/billing', icon: Crown, section: 'billing' },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  // the desktop sidebar folded to a rail of icons, remembered on this device
  const [railOnly, setRailOnly] = useState(() => localStorage.getItem('admin-sidebar-rail') === '1');
  useEffect(() => { localStorage.setItem('admin-sidebar-rail', railOnly ? '1' : '0'); }, [railOnly]);

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
  // Dark mode is the admin's: going from it to the shop's website, the website is light.
  useEffect(() => () => document.documentElement.classList.remove('dark'), []);
  // A page printed from the admin (memos, reports) prints light even in dark mode.
  useEffect(() => {
    const before = () => document.documentElement.classList.remove('dark');
    const after = () => document.documentElement.classList.toggle('dark', isDark);
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => { window.removeEventListener('beforeprint', before); window.removeEventListener('afterprint', after); };
  }, [isDark]);

  // The admin in English (বাং | EN in the menu): its texts are swapped on the page
  // (lib/pageTranslate.ts); the website stays Bangla.
  const adminLang = useAdminLang();
  useEffect(() => {
    if (adminLang !== 'en') return;
    startEnglish('admin');
    return () => stopEnglish('admin');
  }, [adminLang]);

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
          const stored = localStorage.getItem(AUTH_STORAGE_KEY);
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

  // CORE Connect: this site's bills come from CORE Automation. While CORE has locked
  // the panel for an unpaid bill, every page but Billing shows the lock screen; a
  // system owner is never locked out. The store's admins see and pay the bills.
  // MUST be called before any early returns to preserve hook order.
  const { data: core } = useCoreBilling(Boolean(user));
  const isSystemOwner = permissions?.role === 'system_owner';
  const canBilling = isSystemOwner || permissions?.role === 'admin' || permissions?.role === 'malik';
  const coreLocked = Boolean(core?.billing?.locked) && !isSystemOwner;

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

  const sidebarLinks = ALL_SIDEBAR_LINKS.filter(l => (l.section === 'billing' ? canBilling : can(l.section)));
  const isActive = (path: string) => location.pathname === path;

  const displayName = myProfile?.full_name || 'স্বর্ণ সুতা';
  const avatarUrl = myProfile?.avatar_url || '';

  const isDashboardExpanded = location.pathname.startsWith('/admin/dashboard') || location.pathname.startsWith('/admin/analytics') || location.pathname.startsWith('/admin/visitor-analytics');
  const isOrdersExpanded = location.pathname.startsWith('/admin/orders') || location.pathname.startsWith('/admin/abandoned') || location.pathname.startsWith('/admin/fraud') || location.pathname.startsWith('/admin/giveaway');
  const isAccountingExpanded = location.pathname.startsWith('/admin/accounting') || location.pathname.startsWith('/admin/courier');
  const isCategoriesExpanded = location.pathname.startsWith('/admin/categories') || location.pathname.startsWith('/admin/sizes-colors');
  const isCustomersExpanded = location.pathname.startsWith('/admin/customers') || location.pathname.startsWith('/admin/coupons') || location.pathname.startsWith('/admin/reviews') || location.pathname.startsWith('/admin/customer-accounts') || location.pathname.startsWith('/admin/email-campaign') || location.pathname.startsWith('/admin/sms-campaign') || location.pathname.startsWith('/admin/notifications') || location.pathname.startsWith('/admin/free-shipping');
  const isSettingsExpanded = location.pathname.startsWith('/admin/settings') || location.pathname.startsWith('/admin/site-editor') || location.pathname.startsWith('/admin/employees') || location.pathname.startsWith('/admin/performance') || location.pathname.startsWith('/admin/ai-keys');
  const isSmartInboxExpanded = location.pathname.startsWith('/admin/smart-inbox');
  const isLiveChatExpanded = location.pathname.startsWith('/admin/live-chat') || location.pathname.startsWith('/admin/ai-chat-settings') || location.pathname.startsWith('/admin/ai-support-requests');
  const isMediaExpanded = location.pathname.startsWith('/admin/media') || location.pathname.startsWith('/admin/banner-generator');

  type NavLink = { label: string; to: string; icon: typeof LayoutDashboard; section: string; hasBadge?: boolean; subLinks?: { label: string; to: string; icon: typeof LayoutDashboard; section: string }[] };
  const linkActive = (l: NavLink) => isActive(l.to) || (l.section === 'orders' && location.pathname.startsWith('/admin/abandoned'));
  const navBadge = (l: NavLink) =>
    l.section === 'orders' && abandonedCount > 0 ? abandonedCount
      : l.hasBadge && l.section === 'live_chat' && chatUnreadCount > 0 ? chatUnreadCount : 0;
  const subOpen = (l: NavLink) =>
    (l.section === 'dashboard' && isDashboardExpanded) ||
    (l.section === 'orders' && isOrdersExpanded) ||
    (l.section === 'categories' && isCategoriesExpanded) ||
    (l.section === 'customers' && isCustomersExpanded) ||
    (l.section === 'accounting' && isAccountingExpanded) ||
    (l.section === 'settings' && isSettingsExpanded) ||
    (l.section === 'smart_inbox' && isSmartInboxExpanded) ||
    (l.section === 'live_chat' && isLiveChatExpanded) ||
    (l.section === 'media' && isMediaExpanded);
  // the shop's pages grouped under their headings (a stable sort keeps each heading's own order);
  // the bill sits apart, under CORE Automation
  const navLinks = ([...sidebarLinks, ATTENDANCE_LINK] as NavLink[])
    .filter((l) => l.section !== 'billing')
    .sort((a, b) => groupRank(groupOf(a.to)) - groupRank(groupOf(b.to)));
  const coreLinks = (sidebarLinks as NavLink[]).filter((l) => l.section === 'billing');
  const showGroups = new Set(navLinks.map((l) => groupOf(l.to))).size > 1;

  /** A page on the folded rail: its tile grows under the pointer; the name shows beside it. */
  const railItem = (key: string, icon: typeof LayoutDashboard, label: string, opts: { to?: string; onClick?: () => void; active?: boolean; badge?: number }) => {
    const Icon = icon;
    const inner = (
      <>
        {opts.active && <span className="absolute left-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-foreground/60" />}
        <span className={cn(tileClass(key, 'lg'), 'transition-transform duration-200 ease-out group-hover:scale-110 group-focus-visible:scale-110', opts.active && 'scale-105')}>
          <Icon className="h-5 w-5" />
        </span>
        {!!opts.badge && <span className={cn(badgeClass, 'absolute -top-1 right-0.5 ring-2 ring-white dark:ring-neutral-900')}>{opts.badge}</span>}
      </>
    );
    const cls = 'group relative flex w-full justify-center py-1 outline-none';
    return (
      <Tooltip key={key + label}>
        <TooltipTrigger asChild>
          {opts.to
            ? <Link to={opts.to} aria-label={label} className={cls}>{inner}</Link>
            : <button type="button" aria-label={label} onClick={opts.onClick} className={cls}>{inner}</button>}
        </TooltipTrigger>
        {/* drawn outside the panel, which scrolls and would cut it off */}
        <TooltipPortal>
          <TooltipContent side="right" sideOffset={10} className="flex items-center gap-2 rounded-full border-white/60 bg-white/90 px-3 py-1.5 text-xs font-medium text-foreground shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-neutral-900/90">
            {label}
            {!!opts.badge && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{opts.badge} নতুন</span>}
          </TooltipContent>
        </TooltipPortal>
      </Tooltip>
    );
  };

  const navItems = (onNavigate?: () => void, rail = false) => {
    let lastGroup: NavGroup | null = null;
    const shown = new Set<NavGroup>();
    return (
      <nav className={rail ? 'flex flex-col items-stretch gap-0.5' : 'space-y-0.5'}>
        {navLinks.map((l) => {
          const g = groupOf(l.to);
          const heading = showGroups && g !== lastGroup && !shown.has(g);
          lastGroup = g;
          if (heading) shown.add(g);
          const active = linkActive(l);
          const badge = navBadge(l);
          const open = !!l.subLinks && subOpen(l);
          return (
            <div key={l.to}>
              {heading && (rail
                ? <div className="mx-auto my-1.5 h-px w-6 bg-foreground/10" />
                : <p className="px-2 pb-1 pt-3 text-[11px] font-medium text-muted-foreground/80">{groupLabel(g)}</p>)}
              {rail ? railItem(l.to, l.icon, l.label, { to: l.to, active, badge }) : (
                <Link to={l.to} onClick={onNavigate} className={rowClass(active)}>
                  <span className={tileClass(l.to)}><l.icon className="h-[17px] w-[17px]" /></span>
                  <span className="flex-1 truncate">{l.label}</span>
                  {badge > 0 ? (
                    <span className={badgeClass}>{badge}</span>
                  ) : l.subLinks ? (
                    <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform duration-200', open && 'rotate-180')} />
                  ) : null}
                </Link>
              )}
              {!rail && open && l.subLinks!.map((sub) => can(sub.section) && (
                <Link key={sub.to} to={sub.to} onClick={onNavigate} className={cn(subRowClass(isActive(sub.to)), 'mt-0.5')}>
                  <sub.icon className="h-3.5 w-3.5" />
                  <span className="truncate">{sub.label}</span>
                  {sub.to === '/admin/abandoned-checkouts' && abandonedCount > 0 && (
                    <span className={cn(badgeClass, 'ml-auto h-4 min-w-[16px] text-[9px]')}>{abandonedCount}</span>
                  )}
                </Link>
              ))}
            </div>
          );
        })}
        {coreLinks.length > 0 && (rail ? (
          <>
            <div className="mx-auto my-1.5 h-px w-6 bg-foreground/10" />
            {coreLinks.map((l) => railItem(l.to, l.icon, l.label, { to: l.to, active: isActive(l.to) }))}
          </>
        ) : (
          <div className="space-y-0.5 pt-1">
            <p className="px-2 pb-1 pt-3 text-[11px] font-medium text-muted-foreground/80">CORE Automation</p>
            {coreLinks.map((l) => (
              <Link key={l.to} to={l.to} onClick={onNavigate} className={rowClass(isActive(l.to))}>
                <span className={tileClass(l.to)}><l.icon className="h-[17px] w-[17px]" /></span>
                <span className="flex-1 truncate">{l.label}</span>
              </Link>
            ))}
          </div>
        ))}
      </nav>
    );
  };

  const profilePath = `/admin/employees/${userId}`;
  const logout = async () => { await authSignOut(); navigate('/admin'); };
  const shopName = 'স্বর্ণ সুতা';

  /** The shop's mark: the person's photo, or the shop's first letter on its colour. */
  const shopAvatar = (className: string) => (
    <Avatar className={cn('ring-2 ring-primary/25 ring-offset-1 ring-offset-background', className)}>
      <AvatarImage src={avatarUrl} className="object-cover" />
      <AvatarFallback className="rounded-[inherit] bg-primary text-primary-foreground text-sm font-bold">
        {displayName[0]?.toUpperCase() || 'স'}
      </AvatarFallback>
    </Avatar>
  );

  /** The folded panel: the shop's mark, a column of tiles, the person's corner at the foot. */
  const railContent = () => (
    <>
      <div className="mb-2 flex flex-col items-center gap-1.5">
        <Link to="/admin/dashboard" aria-label={shopName}>{shopAvatar('h-11 w-11 rounded-[14px]')}</Link>
        <AdminNotificationCenter userId={userId} />
      </div>
      <div className="mx-auto mb-1.5 h-px w-6 bg-foreground/10" />
      {navItems(undefined, true)}
      <div className="mt-auto flex flex-col items-stretch gap-0.5 pt-3">
        <div className="mx-auto mb-1.5 h-px w-6 bg-foreground/10" />
        {railItem('lang', Languages, adminLang === 'en' ? 'বাংলায় দেখুন' : 'English', { onClick: () => setAdminLang(adminLang === 'en' ? 'bn' : 'en') })}
        {railItem('theme', isDark ? Moon : Sun, isDark ? 'ডার্ক মোড' : 'লাইট মোড', { onClick: () => setIsDark(!isDark) })}
        <Tooltip>
          <TooltipTrigger asChild>
            <Link to={profilePath} aria-label="আমার প্রোফাইল" className="flex justify-center py-1.5">
              <Avatar className="h-10 w-10 ring-2 ring-white shadow-sm dark:ring-white/10">
                <AvatarImage src={avatarUrl} className="object-cover" />
                <AvatarFallback className="bg-primary/15 text-primary text-sm font-bold">{(displayName || '?').slice(0, 1)}</AvatarFallback>
              </Avatar>
            </Link>
          </TooltipTrigger>
          <TooltipPortal><TooltipContent side="right" sideOffset={10}>{displayName}</TooltipContent></TooltipPortal>
        </Tooltip>
        {railItem('logout', LogOut, 'লগআউট', { onClick: logout })}
      </div>
    </>
  );

  /** The open panel (desktop, and the phone's drawer). */
  const panelContent = (onNavigate?: () => void) => (
    <>
      <div className="mb-3 flex items-center gap-2 px-1 pt-1">
        <Link to="/admin/dashboard" onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-2.5 transition-opacity hover:opacity-80">
          {shopAvatar('h-10 w-10 rounded-[12px]')}
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-bold leading-tight text-foreground">{shopName}</span>
            <span className="block truncate text-[11px] text-muted-foreground">{displayName}</span>
          </span>
        </Link>
        <div className="flex shrink-0 items-center">
          <AdminNotificationCenter userId={userId} />
        </div>
      </div>

      <LiveVisitorBadge compactBelowSm={false} className="mx-1 mb-2 w-fit" />

      {notifUnreadCount > 0 && (
        <Link to={`${profilePath}?tab=notifications`} onClick={onNavigate}
          className="mx-1 mb-2 flex items-center gap-3 rounded-2xl bg-white/80 p-2.5 shadow-sm ring-1 ring-black/5 transition-all hover:shadow-md dark:bg-white/10 dark:ring-white/10">
          <span className="relative">
            <span className={tileClass('/admin/live-chat')}><Bell className="h-4 w-4" /></span>
            <span className={cn(badgeClass, 'absolute -right-2 -top-2 h-4 min-w-[16px] text-[9px] ring-2 ring-white dark:ring-neutral-900')}>{notifUnreadCount}</span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-foreground">{notifUnreadCount} নতুন বার্তা আছে!</span>
            <span className="block text-[11px] text-muted-foreground">পড়ুন →</span>
          </span>
        </Link>
      )}

      <CoreBillingNotice core={core} onNavigate={onNavigate} />

      {navItems(onNavigate)}

      <div className="mt-auto space-y-0.5 pt-4">
        <div className="flex items-center gap-3 rounded-[14px] px-2 py-1.5">
          <span className={tileClass('lang')}><Languages className="h-4 w-4" /></span>
          <span className="flex-1 text-sm text-foreground/80">ভাষা</span>
          <AdminLangToggle />
        </div>
        <div className="flex items-center gap-3 rounded-[14px] px-2 py-1.5">
          <span className={tileClass('theme')}>{isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}</span>
          <span className="flex-1 text-sm text-foreground/80">{isDark ? 'ডার্ক মোড' : 'লাইট মোড'}</span>
          <Switch checked={isDark} onCheckedChange={setIsDark} />
        </div>
        {/* the person's own corner: their profile, attendance, work and notifications */}
        <div className="mt-1 flex items-center gap-2 rounded-2xl bg-white/60 p-1.5 ring-1 ring-black/5 dark:bg-white/5 dark:ring-white/10">
          <Link to={profilePath} onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl p-1 transition-colors hover:bg-white/70 dark:hover:bg-white/10">
            <Avatar className="h-9 w-9 shrink-0 ring-2 ring-white dark:ring-white/10">
              <AvatarImage src={avatarUrl} className="object-cover" />
              <AvatarFallback className="bg-primary/15 text-primary text-sm font-bold">{(displayName || '?').slice(0, 1)}</AvatarFallback>
            </Avatar>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-foreground">{displayName}</span>
              <span className="block truncate text-[11px] text-muted-foreground">আমার কাজ, হাজিরা ও তথ্য</span>
            </span>
          </Link>
          <button type="button" onClick={logout} aria-label="লগআউট" title="লগআউট"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-red-50 hover:text-destructive dark:hover:bg-red-500/10">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="admin-shell min-h-screen flex bg-muted/40 overflow-x-clip">
      {/* The sidebar: a floating glass panel that folds to a rail of icons (remembered). */}
      <div className="admin-sidebar relative hidden md:block shrink-0 sticky top-0 h-screen py-3 pl-3 print:!hidden">
        <aside className={cn('glass-sidebar flex h-full flex-col overflow-y-auto scrollbar-hide transition-[width] duration-300 ease-out', railOnly ? 'w-[76px] px-2 py-3' : 'w-64 p-3')}>
          {railOnly ? railContent() : panelContent()}
        </aside>
        <button
          type="button"
          onClick={() => setRailOnly((v) => !v)}
          aria-label={railOnly ? 'মেনু খুলুন' : 'মেনু ছোট করুন'}
          title={railOnly ? 'মেনু খুলুন' : 'মেনু ছোট করুন'}
          className="absolute -right-3.5 top-9 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-white text-foreground/70 shadow-md ring-1 ring-black/5 transition-colors hover:text-foreground dark:bg-neutral-800 dark:ring-white/10"
        >
          {railOnly ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <div className="admin-mobile-header md:hidden fixed top-0 left-0 right-0 z-50 bg-background border-b border-border h-14 flex items-center px-4 print:!hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" overlayClassName="bg-black/20 backdrop-blur-0" className="glass-sidebar inset-y-2 left-2 h-auto w-[300px] max-w-[85vw] flex flex-col overflow-y-auto p-3 [&>button:last-child]:hidden">
            {panelContent(() => setMobileOpen(false))}
          </SheetContent>
        </Sheet>
        <Link to="/admin/dashboard" className="flex items-center gap-2 ml-2">
          {shopAvatar('h-8 w-8')}
          <span className="font-bold text-sm truncate max-w-[150px]">{shopName}</span>
        </Link>
        <div className="flex items-center gap-1 ml-auto">
          <LiveVisitorBadge />
          <AdminLangToggle compact />
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
            {coreLocked && core && !location.pathname.startsWith('/admin/billing') ? <CoreLockScreen core={core} /> : <Outlet />}
          </Suspense>
        </div>
      </main>

      <AdminBottomNav />
      {/* Global incoming call ringer — works on any admin page */}
      <IncomingCallNotification />
      {/* a deploy since this page was opened: offer a reload */}
      <UpdateNotice />
    </div>
  );
}
