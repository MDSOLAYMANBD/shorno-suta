import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BarChart3, ShoppingCart, Package, LayoutGrid, Tag, Users, Ticket, Globe, ImageIcon, Palette, PenTool, Settings, UserCog, MessageCircle, AlertTriangle, Bell, Calculator, Star } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/hooks/usePermissions';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

const MORE_LINKS = [
  { label: 'ক্যাটাগরি', to: '/admin/categories', icon: Tag, section: 'categories' },
  { label: 'কাস্টমার', to: '/admin/customers', icon: Users, section: 'customers' },
  { label: 'কুপন', to: '/admin/coupons', icon: Ticket, section: 'coupons' },
  { label: 'অসম্পূর্ণ চেকআউট', to: '/admin/abandoned-checkouts', icon: AlertTriangle, section: 'orders' },
  { label: 'ল্যান্ডিং পেজ', to: '/admin/landing-pages', icon: Globe, section: 'landing_pages' },
  { label: 'মিডিয়া', to: '/admin/media', icon: ImageIcon, section: 'media' },
  { label: 'সাইজ/কালার', to: '/admin/sizes-colors', icon: Palette, section: 'sizes_colors' },
  { label: 'সাইট এডিটর', to: '/admin/site-editor', icon: PenTool, section: 'site_editor' },
  { label: 'সেটিংস', to: '/admin/settings', icon: Settings, section: 'settings' },
  { label: 'এমপ্লয়ী', to: '/admin/employees', icon: UserCog, section: 'employees' },
  { label: 'লাইভ চ্যাট', to: '/admin/live-chat', icon: MessageCircle, section: 'live_chat' },
  { label: 'হিসাব', to: '/admin/accounting', icon: Calculator, section: 'accounting' },
  { label: 'রিভিউ', to: '/admin/reviews', icon: Star, section: 'settings' },
];

export default function AdminBottomNav() {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const { can, permissions } = usePermissions();
  const isOwnerOrAdmin = permissions?.role === 'admin' || permissions?.role === 'malik';

  const { data: pendingCount = 0 } = useQuery({
    queryKey: ['pending-orders-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      return count || 0;
    },
    staleTime: 3 * 60 * 1000, // 3 min — realtime invalidates this on order events
  });

  const isActive = (path: string) => location.pathname === path;
  const isMoreActive = MORE_LINKS.some(l => isActive(l.to));

  const tabs = [
    { label: 'এনালিটিক্স', to: '/admin/dashboard', icon: BarChart3, badge: 0 },
    { label: 'অর্ডার', to: '/admin/orders', icon: ShoppingCart, badge: pendingCount },
    { label: 'প্রোডাক্ট', to: '/admin/products', icon: Package, badge: 0 },
    ...(isOwnerOrAdmin ? [{ label: 'হিসাব', to: '/admin/accounting', icon: Calculator, badge: 0 }] : []),
  ];

  const filteredMoreLinks = MORE_LINKS.filter(l => can(l.section) && !(isOwnerOrAdmin && l.section === 'accounting'));

  return (
    <>
      <div className="admin-bottom-nav fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background border-t border-border print:!hidden">
        <nav className="flex items-center justify-around h-14">
          {tabs.map(tab => {
            const active = isActive(tab.to);
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 flex-1 h-full relative transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <div className="relative">
                  <tab.icon className="h-5 w-5" />
                  {tab.badge > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                      {tab.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium">{tab.label}</span>
              </Link>
            );
          })}

          <button
            onClick={() => setMoreOpen(true)}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors',
              isMoreActive ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <LayoutGrid className="h-5 w-5" />
            <span className="text-[10px] font-medium">আরো</span>
          </button>
        </nav>
      </div>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="max-h-[70vh] rounded-t-2xl px-4 pb-8">
          <SheetHeader className="pb-3">
            <SheetTitle className="text-base">সব সেকশন</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-3 gap-3">
            {filteredMoreLinks.map(link => {
              const active = isActive(link.to);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 p-3 rounded-xl transition-colors',
                    active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent'
                  )}
                >
                  <link.icon className="h-5 w-5" />
                  <span className="text-[11px] font-medium text-center leading-tight">{link.label}</span>
                </Link>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
