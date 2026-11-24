import { cn } from '@/lib/utils';

/**
 * The admin sidebar's look: a floating glass panel (.glass-sidebar in index.css) where
 * every page has its own coloured icon tile, grouped under small headings, and the panel
 * folds to a rail of icons (names on hover). Used by pages/admin/AdminDashboard.tsx.
 * The same design as the CORE Shop engine's admin.
 */

// Each page's tile colour (top → bottom of the tile). Written out in full so Tailwind keeps them.
const TILE_COLOR: Record<string, string> = {
  '/admin/dashboard': 'from-orange-400 to-orange-600',
  '/admin/accounting': 'from-emerald-400 to-emerald-600',
  '/admin/live-chat': 'from-green-400 to-green-600',
  '/admin/smart-inbox': 'from-sky-400 to-blue-600',
  '/admin/orders': 'from-blue-400 to-indigo-600',
  '/admin/crm': 'from-violet-400 to-violet-600',
  '/admin/broadcast': 'from-pink-400 to-pink-600',
  '/admin/products': 'from-amber-400 to-orange-500',
  '/admin/shadamon': 'from-rose-400 to-rose-600',
  '/admin/categories': 'from-teal-400 to-teal-600',
  '/admin/customers': 'from-indigo-400 to-indigo-600',
  '/admin/landing-pages': 'from-cyan-400 to-cyan-600',
  '/admin/media': 'from-yellow-400 to-amber-500',
  '/admin/settings': 'from-slate-400 to-slate-600',
  // CORE Automation's own section
  '/admin/billing': 'from-yellow-400 to-amber-500',
  // the corner at the bottom
  lang: 'from-sky-400 to-sky-600',
  theme: 'from-indigo-400 to-indigo-600',
  logout: 'from-zinc-400 to-zinc-600',
};

/** A page's coloured icon tile: small in the open panel, larger on the rail. */
export function tileClass(key: string, size: 'sm' | 'lg' = 'sm') {
  return cn(
    'flex shrink-0 items-center justify-center bg-gradient-to-b text-white',
    'shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_1px_3px_rgb(0_0_0/0.18)]',
    TILE_COLOR[key] ?? 'from-slate-400 to-slate-600',
    size === 'lg' ? 'h-11 w-11 rounded-[14px]' : 'h-8 w-8 rounded-[10px]',
  );
}

export type NavGroup = 'main' | 'shop' | 'site';

const GROUP_OF: Record<string, NavGroup> = {
  '/admin/products': 'shop',
  '/admin/shadamon': 'shop',
  '/admin/categories': 'shop',
  '/admin/customers': 'shop',
  '/admin/crm': 'shop',
  '/admin/broadcast': 'shop',
  '/admin/landing-pages': 'site',
  '/admin/media': 'site',
  '/admin/settings': 'site',
};

/** The heading a page sits under (main work, the shop, the website and settings). */
export const groupOf = (to: string): NavGroup => GROUP_OF[to] ?? 'main';

/** Headings in menu order, so each heading's pages stay together under it. */
export const groupRank = (g: NavGroup) => (g === 'main' ? 0 : g === 'shop' ? 1 : 2);

export const groupLabel = (g: NavGroup) =>
  g === 'shop' ? 'দোকান' : g === 'site' ? 'ওয়েবসাইট ও সেটিংস' : 'মূল';

/** A row in the open panel; the open page is a raised glass pill. */
export const rowClass = (active: boolean) =>
  cn(
    'group flex items-center gap-3 rounded-[14px] px-2 py-1.5 text-sm transition-all duration-200',
    active
      ? 'bg-white text-foreground font-semibold shadow-[0_4px_14px_rgb(0_0_0/0.08)] ring-1 ring-black/5 dark:bg-white/15 dark:ring-white/10'
      : 'text-foreground/80 hover:bg-white/70 hover:text-foreground hover:shadow-sm dark:hover:bg-white/10',
  );

export const subRowClass = (active: boolean) =>
  cn(
    'flex items-center gap-2 rounded-xl py-1.5 pl-12 pr-2 text-xs transition-colors duration-200',
    active
      ? 'bg-white/80 text-foreground font-semibold shadow-sm dark:bg-white/10'
      : 'text-muted-foreground hover:bg-white/50 hover:text-foreground dark:hover:bg-white/5',
  );

/** A red count bubble. */
export const badgeClass = 'flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white';
