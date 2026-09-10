import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingBag, Menu, X, Search, User, ChevronRight, Home, Phone, Info, FileText, Gift, Store, LogIn } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useProducts } from '@/hooks/useProducts';
import { useSiteConfig, DEFAULT_NAVBAR_CONFIG } from '@/hooks/useSiteConfig';
import { useCategories } from '@/hooks/useCategories';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useCustomerProfile } from '@/hooks/useCustomerProfile';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import WelcomeIslandInline from './WelcomeIslandInline';
import { trackViewSearchResults } from '@/lib/ecommerceTracking';
import LiveVisitorBadge from '@/components/LiveVisitorBadge';

export default function Navbar() {
  const { totalItems } = useCart();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const searchRef = useRef<HTMLDivElement>(null);
  const shouldFetchProducts = searchQuery.length >= 2;
  const { data: products } = useProducts(undefined, shouldFetchProducts);
  const { data: savedNavConfig } = useSiteConfig('navbar_config');
  const { data: categories } = useCategories();
  const parentCategories = (categories || []).filter((c: any) => !c.parent_id);
  const { user } = useCustomerAuth();
  const { avatarUrl, displayName } = useCustomerProfile();
  const navConfig = savedNavConfig ? { ...DEFAULT_NAVBAR_CONFIG, ...savedNavConfig } : DEFAULT_NAVBAR_CONFIG;
  const navLinks = navConfig.links || DEFAULT_NAVBAR_CONFIG.links;

  const filteredProducts = searchQuery.length >= 2
    ? products?.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.name_bn.toLowerCase().includes(searchQuery.toLowerCase())
      )?.slice(0, 5)
    : [];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // GA4 view_search_results — debounced, once per distinct query
  const searchTrackedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const term = searchQuery.trim();
    if (term.length < 2) return;
    const key = term.toLowerCase();
    const timer = setTimeout(() => {
      if (!searchTrackedRef.current.has(key)) {
        searchTrackedRef.current.add(key);
        trackViewSearchResults(term);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const marqueeText = navConfig.marquee_text || DEFAULT_NAVBAR_CONFIG.marquee_text;

  return (
    <div className="sticky top-0 z-[1000]">
      {/* Top Bar — Clean Gradient Marquee */}
      <div className="relative overflow-hidden bg-gradient-to-r from-primary via-accent to-primary text-primary-foreground text-xs">
        <div className="h-8 flex items-center">
          <div className="marquee-track whitespace-nowrap">
            <span className="inline-block px-8">{marqueeText}</span>
            <span className="inline-block px-8">{marqueeText}</span>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <header className="bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            {navConfig.logo_mode === 'wide_logo' && navConfig.wide_logo_url ? (
              <div className={navConfig.wide_logo_align === 'center' ? 'flex justify-center' : ''}>
                <img src={navConfig.wide_logo_url} alt={navConfig.brand_name || 'Logo'} className="h-10 sm:h-11 object-contain" width="160" height="44" />
              </div>
            ) : (
              <>
                {navConfig.logo_url ? (
              <img src={navConfig.logo_url} alt={navConfig.brand_name || 'Logo'} className="w-11 h-11 rounded-full object-cover shrink-0 logo-shine" width="44" height="44" />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg font-bold shrink-0 logo-shine">
                    {(navConfig.brand_name || 'স').charAt(0)}
                  </div>
                )}
                <div className="leading-none">
                  <span className="text-lg sm:text-xl font-extrabold tracking-wide block brand-shine">{navConfig.brand_name || 'স্বর্ণ সুতা'}</span>
                  <span className="text-[10px] tracking-widest text-muted-foreground uppercase block mt-0.5">{navConfig.brand_name_en || 'Shorno Suta'}</span>
                </div>
              </>
            )}
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-7">
            {navLinks.map((l: any) => (
              <Link
                key={l.to}
                to={l.to}
                className={cn(
                  'text-base font-medium transition-colors hover:text-primary',
                  location.pathname === l.to ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <WelcomeIslandInline />

          <div className="flex items-center gap-3 shrink-0">
            <LiveVisitorBadge />

            {/* Search */}
            <div ref={searchRef} className="relative">
              {searchOpen ? (
                <div className="flex items-center">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="পণ্য খুঁজুন..."
                    className="w-40 sm:w-56 h-9 px-3 text-sm bg-muted border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                    autoFocus
                  />
                  <button onClick={() => { setSearchOpen(false); setSearchQuery(''); }} className="ml-1 p-1.5">
                    <X className="h-4 w-4" />
                  </button>
                  {filteredProducts && filteredProducts.length > 0 && (
                    <div className="absolute top-full mt-1 left-0 right-0 bg-background border border-border rounded-md shadow-lg z-50 overflow-hidden">
                      {filteredProducts.map(p => (
                        <button
                          key={p.id}
                          onClick={() => { navigate(`/product/${p.slug}`); setSearchOpen(false); setSearchQuery(''); }}
                          className="flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-muted transition-colors text-sm"
                        >
                          {p.images?.[0] && <img src={p.images[0]} alt="" className="w-8 h-8 rounded object-cover" />}
                          <div>
                            <p className="font-medium line-clamp-1">{p.name_bn || p.name}</p>
                            <p className="text-xs text-primary font-bold">৳{p.price}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <button onClick={() => setSearchOpen(true)} className="border border-border rounded-md p-2 hover:bg-muted transition-colors">
                  <Search className="h-5 w-5" />
                </button>
              )}
            </div>

            <Link to="/account" className="hidden lg:flex border border-border rounded-md p-1.5 hover:bg-muted transition-colors">
              {user && avatarUrl ? (
                <Avatar className="h-6 w-6">
                  <AvatarImage src={avatarUrl} alt="Profile" />
                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                    {(displayName || '?').charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <User className="h-5 w-5" />
              )}
            </Link>

            <button className="lg:hidden" onClick={() => setOpen(!open)}>
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {open && (
          <nav className="lg:hidden border-t border-border bg-background max-h-[calc(100vh-6rem)] overflow-y-auto">
            {/* User greeting card */}
            <div className="px-4 pt-4">
              <Link
                to={user ? '/account' : '/account/login'}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 p-3.5 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-sm"
              >
                <div className="w-11 h-11 rounded-full bg-primary-foreground/20 flex items-center justify-center overflow-hidden ring-2 ring-primary-foreground/30">
                  {user && avatarUrl ? (
                    <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User className="h-6 w-6" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] opacity-90 leading-tight">{user ? 'স্বাগতম' : 'হ্যালো!'}</p>
                  <p className="text-sm font-semibold truncate leading-tight mt-0.5">
                    {user ? (displayName || 'প্রোফাইল') : 'সাইন ইন করুন'}
                  </p>
                </div>
                {!user && <LogIn className="h-4 w-4 opacity-80" />}
              </Link>
            </div>

            {/* Categories */}
            {parentCategories.length > 0 && (
              <div className="px-4 pt-5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">ক্যাটাগরি</p>
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  {parentCategories.map((cat: any, idx: number) => {
                    const hasChildren = (categories || []).some((c: any) => c.parent_id === cat.id);
                    return (
                      <button
                        key={cat.id}
                        onClick={() => { navigate(`/shop/${cat.slug}`); setOpen(false); }}
                        className={cn(
                          'w-full flex items-center justify-between px-4 py-3.5 text-sm font-medium text-foreground hover:bg-muted/60 transition-colors text-left',
                          idx !== parentCategories.length - 1 && 'border-b border-border'
                        )}
                      >
                        <span className="truncate">{cat.name_bn || cat.name}</span>
                        {hasChildren && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quick links */}
            <div className="px-4 pt-5 pb-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">কুইক লিঙ্ক</p>
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                {navLinks.map((l: any, idx: number) => {
                  const iconMap: Record<string, any> = {
                    '/': Home,
                    '/shop': Store,
                    '/contact': Phone,
                    '/about': Info,
                    '/policies': FileText,
                    '/giveaway': Gift,
                  };
                  const Icon = iconMap[l.to] || ShoppingBag;
                  const isActive = location.pathname === l.to;
                  return (
                    <Link
                      key={l.to}
                      to={l.to}
                      onClick={() => setOpen(false)}
                      className={cn(
                        'flex items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-muted/60 transition-colors',
                        idx !== navLinks.length - 1 && 'border-b border-border',
                        isActive ? 'text-primary' : 'text-foreground'
                      )}
                    >
                      <Icon className={cn('h-4 w-4', isActive ? 'text-primary' : 'text-muted-foreground')} />
                      <span className="flex-1">{l.label}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                    </Link>
                  );
                })}
              </div>
            </div>
          </nav>
        )}
      </header>
    </div>
  );
}
