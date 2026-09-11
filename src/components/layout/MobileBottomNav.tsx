import { Link, useLocation } from 'react-router-dom';
import { Home, ShoppingBag, User, Phone, ShoppingCart, LayoutGrid, Flame } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { usePublicSettings } from '@/hooks/useStoreSettings';
import { useSiteConfig, DEFAULT_BUTTONS_CONFIG } from '@/hooks/useSiteConfig';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useCustomerProfile } from '@/hooks/useCustomerProfile';
import { trackVisitorActivity } from '@/hooks/useVisitorTracking';
import { cn } from '@/lib/utils';

const CONTACT_CLICK_TYPE: Record<string, 'call_click' | 'whatsapp_click' | 'messenger_click'> = {
  phone: 'call_click',
  whatsapp: 'whatsapp_click',
  messenger: 'messenger_click',
};

const WhatsAppIcon = () => (
  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

const MessengerIcon = () => (
  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2C6.36 2 2 6.13 2 11.7c0 2.91 1.2 5.42 3.15 7.2V22l2.97-1.63c.84.23 1.72.36 2.65.36h.23C16.64 20.73 22 16.6 22 11.7 22 6.13 17.64 2 12 2zm1.17 12.45l-2.54-2.71-4.97 2.71 5.47-5.81 2.61 2.71 4.89-2.71-5.46 5.81z"/>
  </svg>
);

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  home: Home,
  cart: ShoppingBag,
  account: User,
  phone: Phone,
  shop: ShoppingCart,
  category: LayoutGrid,
  trending: Flame,
  whatsapp: WhatsAppIcon as any,
  messenger: MessengerIcon as any,
};

export default function MobileBottomNav({ matchFooterBg = false }: { matchFooterBg?: boolean }) {
  const { totalItems } = useCart();
  const location = useLocation();
  const { data: settings } = usePublicSettings();
  const { data: savedBtnConfig } = useSiteConfig('buttons_config');
  const { user } = useCustomerAuth();
  const { avatarUrl } = useCustomerProfile();

  const whatsappNumber = settings?.whatsapp_number || '8801843711211';
  const messengerLink = settings?.messenger_link || 'https://m.me/shornosuta';

  const navConfig = savedBtnConfig?.bottom_nav?.items || DEFAULT_BUTTONS_CONFIG.bottom_nav.items;
  const enabledItems = navConfig.filter((item: any) => item.enabled !== false);

  return (
    <>
      {/* Spacer so page content doesn't hide behind floating nav — coloured
          to match the footer when it directly precedes this, so the fixed
          nav's reserved space doesn't show as a bare white gap under it */}
      <div className={cn('lg:hidden h-20', matchFooterBg && 'bg-accent')} aria-hidden />
      <nav className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 lg:hidden animate-fade-in">
        <div className="relative flex items-center gap-1.5 px-2.5 py-2 rounded-full bg-background/90 backdrop-blur-xl border border-border shadow-[0_8px_32px_rgba(0,0,0,0.18)] ring-1 ring-black/5">
          {enabledItems.map((item: any, index: number) => {
            const isLink = item.type === 'link';
            const isActive = isLink && location.pathname === item.to;
            const IconComponent = ICON_MAP[item.icon_type] || Home;
            const isAccountItem = item.icon_type === 'account';

            let href = item.href || '';
            if (item.icon_type === 'whatsapp' && !href) href = `https://wa.me/${whatsappNumber}`;
            if (item.icon_type === 'messenger' && !href) href = messengerLink;

            const badge = item.badge_key === 'cart' && totalItems > 0 ? totalItems : 0;
            const showAvatar = isAccountItem && user && avatarUrl;

            const isTrending = item.icon_type === 'trending';
            const baseWrap = cn(
              'nav-btn group relative flex items-center justify-center rounded-full overflow-hidden',
              isActive
                ? 'px-3.5 py-2.5 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-md shadow-primary/40'
                : 'w-12 h-12 text-foreground/70 hover:bg-primary/10 hover:text-primary',
              !isActive && isTrending && 'text-orange-500 ring-1 ring-orange-400/40 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10'
            );

            const iconEl = showAvatar ? (
              <img src={avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover" />
            ) : (
              <IconComponent
                className={cn(
                  'h-[22px] w-[22px] transition-transform duration-300 relative z-10',
                  isActive ? 'scale-110' : 'group-hover:scale-110',
                  isTrending && !isActive && 'animate-flame-soft fill-orange-500 drop-shadow-[0_0_4px_rgba(251,146,60,0.5)]'
                )}
              />
            );

            const content = (
              <>
                {isTrending && !isActive && (
                  <span className="absolute inset-0 trending-premium pointer-events-none" aria-hidden />
                )}
                <span className="relative flex items-center justify-center">
                  {iconEl}
                  {isTrending && !isActive && (
                    <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.9)] animate-pulse" />
                  )}
                  {badge > 0 && (
                    <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-[9px] font-bold rounded-full h-[16px] min-w-[16px] px-1 flex items-center justify-center animate-scale-in shadow-sm ring-2 ring-background">
                      {badge}
                    </span>
                  )}
                </span>
                {isActive && (
                  <span className="ml-2 text-[12px] font-semibold whitespace-nowrap animate-fade-in">
                    {item.label}
                  </span>
                )}
              </>
            );

            if (!isLink) {
              const clickType = CONTACT_CLICK_TYPE[item.icon_type];
              return (
                <a
                  key={index}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={baseWrap}
                  aria-label={item.label}
                  onClick={clickType ? () => trackVisitorActivity(clickType) : undefined}
                >
                  {content}
                </a>
              );
            }

            return (
              <Link key={index} to={item.to || '/'} className={baseWrap} aria-label={item.label}>
                {content}
              </Link>
            );
          })}
        </div>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>
    </>
  );
}
