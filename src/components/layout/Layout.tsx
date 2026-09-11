import { ReactNode, lazy, Suspense, useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import BrandSideBorder from './BrandSideBorder';
import MobileBottomNav from './MobileBottomNav';
import FloatingCart from './FloatingCart';
import FloatingBackButton from './FloatingBackButton';
import CustomerWelcomeIsland from './CustomerWelcomeIsland';
import GlobalFreeShippingBar from '@/components/freeShipping/GlobalFreeShippingBar';
import { useMarketingScripts } from '@/hooks/useMarketingScripts';
import { useVisitorTracking } from '@/hooks/useVisitorTracking';
import { usePageViewTracking } from '@/hooks/usePageViewTracking';
import { useLivePresence } from '@/hooks/useLivePresence';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  PopularCategoriesSkeleton,
  RecentlyViewedSkeleton,
  CustomerShowcaseCompactSkeleton,
  CustomerShowcaseSkeleton,
  GlobalReviewSkeleton,
} from './SectionSkeletons';

const LiveChatWidget = lazy(() =>
  import('@/components/chat/AIChatWidget').catch(() => ({ default: () => null as any }))
);
const GlobalReviewSection = lazy(() => import('@/components/GlobalReviewSection'));
const CustomerShowcaseCompact = lazy(() => import('@/components/CustomerShowcaseCompact'));
const RecentlyViewedSection = lazy(() => import('@/components/product/RecentlyViewedSection'));
const PopularCategoriesSection = lazy(() => import('@/components/product/PopularCategoriesSection'));
const CustomerShowcaseSection = lazy(() => import('@/components/CustomerShowcaseSection'));

/**
 * Renders a skeleton placeholder that mirrors the final layout until the
 * section scrolls into view, then swaps it for the real (lazily imported)
 * component. Because the skeleton reserves the same box the loaded section
 * occupies, this avoids CLS without arbitrary min-heights.
 */
function LazyLoadSection({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { rootMargin: '300px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ contain: 'layout' }}>
      {visible ? <Suspense fallback={fallback}>{children}</Suspense> : fallback}
    </div>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  useMarketingScripts();
  useVisitorTracking();
  usePageViewTracking();
  useLivePresence();
  const location = useLocation();
  const path = location.pathname;
  const isMobile = useIsMobile();
  const showReviews = path === '/' || path.startsWith('/shop') || path.startsWith('/product/') || path.startsWith('/collection/');
  const hideFooter = isMobile && (path === '/cart' || path === '/checkout');
  return (
    <div className="min-h-screen flex flex-col relative">
      <BrandSideBorder />
      <CustomerWelcomeIsland />
      <Navbar />
      <main className="flex-1">
        <FloatingBackButton />
        {children}
      </main>
      {showReviews && path !== '/' && (
        <LazyLoadSection fallback={<PopularCategoriesSkeleton />}>
          <PopularCategoriesSection />
        </LazyLoadSection>
      )}
      {showReviews && (
        <LazyLoadSection fallback={<RecentlyViewedSkeleton />}>
          <RecentlyViewedSection />
        </LazyLoadSection>
      )}
      {path === '/' && (
        <LazyLoadSection fallback={<CustomerShowcaseSkeleton />}>
          <CustomerShowcaseSection />
        </LazyLoadSection>
      )}
      {path.startsWith('/product/') && (
        <Suspense fallback={<CustomerShowcaseCompactSkeleton />}>
          <CustomerShowcaseCompact />
        </Suspense>
      )}
      {showReviews && (
        <LazyLoadSection fallback={<GlobalReviewSkeleton />}>
          <GlobalReviewSection />
        </LazyLoadSection>
      )}
      {!hideFooter && <Footer />}
      <MobileBottomNav />
      <FloatingCart />
      <GlobalFreeShippingBar />
      <Suspense fallback={null}>
        <LiveChatWidget />
      </Suspense>
    </div>
  );
}