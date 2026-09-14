import { Suspense, lazy, ReactNode } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "@/contexts/CartContext";

// Eager: critical pages
import Index from "./pages/Index";
import Shop from "./pages/Shop";
import ProductDetail from "./pages/ProductDetail";
import LandingPage from "./pages/LandingPage";
import NotFound from "./pages/NotFound";
import TrendingProducts from "./pages/TrendingProducts";
import ClearanceProducts from "./pages/ClearanceProducts";

// Retry wrapper: auto-reload on stale chunk errors (deploy cache mismatch)
const isChunkLoadError = (err: any) => {
  const msg = err?.message || String(err || '');
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('ChunkLoadError') ||
    msg.includes('Loading chunk') ||
    msg.includes('Loading CSS chunk')
  );
};

function lazyRetry<T extends { default: React.ComponentType<any> }>(
  factory: () => Promise<T>
): Promise<T> {
  return factory().catch((err) => {
    if (!isChunkLoadError(err)) throw err;
    // Transient network blip? Try once more after a short delay.
    return new Promise<T>((resolve, reject) => {
      setTimeout(() => {
        factory()
          .then(resolve)
          .catch((err2) => {
            // Stale deploy — chunk hash no longer exists. Force reload (throttled).
            const key = 'chunk_reload';
            const last = sessionStorage.getItem(key);
            const now = Date.now();
            if (!last || now - Number(last) > 10000) {
              sessionStorage.setItem(key, String(now));
              window.location.reload();
              // Return an unresolved promise so React keeps showing the Suspense
              // fallback (spinner) instead of bubbling to an error boundary / blank screen.
              return;
            }
            reject(err2);
          });
      }, 600);
    });
  });
}

// Lazy: less critical pages
const Cart = lazy(() => lazyRetry(() => import("./pages/Cart")));
const Checkout = lazy(() => lazyRetry(() => import("./pages/Checkout")));
const About = lazy(() => lazyRetry(() => import("./pages/About")));
const Contact = lazy(() => lazyRetry(() => import("./pages/Contact")));
const Policies = lazy(() => lazyRetry(() => import("./pages/Policies")));
const ReturnPolicy = lazy(() => lazyRetry(() => import("./pages/ReturnPolicy")));
const CancellationPolicy = lazy(() => lazyRetry(() => import("./pages/CancellationPolicy")));
const ExchangeRefundPolicy = lazy(() => lazyRetry(() => import("./pages/ExchangeRefundPolicy")));
const PrivacyPolicy = lazy(() => lazyRetry(() => import("./pages/PrivacyPolicy")));
const TermsAndConditions = lazy(() => lazyRetry(() => import("./pages/TermsAndConditions")));
const OrderStatus = lazy(() => lazyRetry(() => import("./pages/OrderStatus")));
const DynamicPage = lazy(() => lazyRetry(() => import("./pages/DynamicPage")));
const Install = lazy(() => lazyRetry(() => import("./pages/Install")));
const CustomerInstall = lazy(() => lazyRetry(() => import("./pages/CustomerInstall")));
const PaymentResult = lazy(() => lazyRetry(() => import("./pages/PaymentResult")));
const ThankYou = lazy(() => lazyRetry(() => import("./pages/ThankYou")));
const CollectionPage = lazy(() => lazyRetry(() => import("./pages/CollectionPage")));
const PublicMemo = lazy(() => lazyRetry(() => import("./pages/PublicMemo")));
const PublicHishab = lazy(() => lazyRetry(() => import("./pages/PublicHishab")));
const AuthCallback = lazy(() => lazyRetry(() => import("./pages/AuthCallback")));
const Giveaway = lazy(() => lazyRetry(() => import("./pages/Giveaway")));

const SmsRedirect = lazy(() => lazyRetry(() => import("./pages/SmsRedirect")));


// Lazy: admin pages (heavy)
const AdminLogin = lazy(() => lazyRetry(() => import("./pages/admin/AdminLogin")));
const AdminDashboard = lazy(() => lazyRetry(() => import("./pages/admin/AdminDashboard")));
const AdminOverview = lazy(() => lazyRetry(() => import("./pages/admin/AdminOverview")));
const AdminOrders = lazy(() => lazyRetry(() => import("./pages/admin/AdminOrders")));
const AdminProducts = lazy(() => lazyRetry(() => import("./pages/admin/AdminProducts")));
const AdminProductEditor = lazy(() => lazyRetry(() => import("./pages/admin/AdminProductEditor")));
const AdminCategories = lazy(() => lazyRetry(() => import("./pages/admin/AdminCategories")));
const AdminSettings = lazy(() => lazyRetry(() => import("./pages/admin/AdminSettings")));
const AdminIntegrations = lazy(() => lazyRetry(() => import("./pages/admin/AdminIntegrations")));
const AdminPaymentSettings = lazy(() => lazyRetry(() => import("./pages/admin/AdminPaymentSettings")));
const AdminAbandonedCheckouts = lazy(() => lazyRetry(() => import("./pages/admin/AdminAbandonedCheckouts")));
const AdminCustomers = lazy(() => lazyRetry(() => import("./pages/admin/AdminCustomers")));
const AdminCustomerImport = lazy(() => lazyRetry(() => import("./pages/admin/AdminCustomerImport")));
const AdminCoupons = lazy(() => lazyRetry(() => import("./pages/admin/AdminCoupons")));
const AdminLandingPages = lazy(() => lazyRetry(() => import("./pages/admin/AdminLandingPages")));
const AdminLandingPageBrandDefaults = lazy(() => lazyRetry(() => import("./pages/admin/AdminLandingPageBrandDefaults")));
const AdminLandingPageEditor = lazy(() => lazyRetry(() => import("./pages/admin/AdminLandingPageEditor")));
const AdminMediaCenter = lazy(() => lazyRetry(() => import("./pages/admin/AdminMediaCenter")));
const AdminSizesColors = lazy(() => lazyRetry(() => import("./pages/admin/AdminSizesColors")));
const AdminSiteEditor = lazy(() => lazyRetry(() => import("./pages/admin/AdminSiteEditor")));
const AdminThemeSettings = lazy(() => lazyRetry(() => import("./pages/admin/AdminThemeSettings")));
const AdminCheckoutSettings = lazy(() => lazyRetry(() => import("./pages/admin/AdminCheckoutSettings")));
const AdminInvoiceSettings = lazy(() => lazyRetry(() => import("./pages/admin/AdminInvoiceSettings")));
const AdminBrandingSeo = lazy(() => lazyRetry(() => import("./pages/admin/AdminBrandingSeo")));
const AdminStoreInfoSettings = lazy(() => lazyRetry(() => import("./pages/admin/AdminStoreInfoSettings")));
const AdminLiveChatSettings = lazy(() => lazyRetry(() => import("./pages/admin/AdminLiveChatSettings")));
const AdminLoyaltyBadges = lazy(() => lazyRetry(() => import("./pages/admin/AdminLoyaltyBadges")));
const AdminFreeShipping = lazy(() => lazyRetry(() => import("./pages/admin/AdminFreeShipping")));
const AdminEmployees = lazy(() => lazyRetry(() => import("./pages/admin/AdminEmployees")));
const AdminEmployeeProfile = lazy(() => lazyRetry(() => import("./pages/admin/AdminEmployeeProfile")));
const AdminLiveChat = lazy(() => lazyRetry(() => import("./pages/admin/AdminLiveChat")));
const AdminPerformance = lazy(() => lazyRetry(() => import("./pages/admin/AdminPerformance")));
const AdminAccounting = lazy(() => lazyRetry(() => import("./pages/admin/AdminAccounting")));

const AdminPersonProfile = lazy(() => lazyRetry(() => import("./pages/admin/AdminPersonProfile")));
const AdminAttendance = lazy(() => lazyRetry(() => import("./pages/admin/AdminAttendance")));
const AdminSalary = lazy(() => lazyRetry(() => import("./pages/admin/AdminSalary")));
const AdminAccountingSettings = lazy(() => lazyRetry(() => import("./pages/admin/AdminAccountingSettings")));
const AdminBusinessAccount = lazy(() => lazyRetry(() => import("./pages/admin/AdminBusinessAccount")));
const AdminUnitProfile = lazy(() => lazyRetry(() => import("./pages/admin/AdminUnitProfile")));
const AdminSalesHistory = lazy(() => lazyRetry(() => import("./pages/admin/AdminSalesHistory")));
const AdminWorkOrders = lazy(() => lazyRetry(() => import("./pages/admin/AdminWorkOrders")));
const AdminUnitModuleProfile = lazy(() => lazyRetry(() => import("./pages/admin/AdminUnitModuleProfile")));
const AdminUnitLoansModule = lazy(() => lazyRetry(() => import("./pages/admin/AdminUnitLoansModule")));
const AdminUnitRentModule = lazy(() => lazyRetry(() => import("./pages/admin/AdminUnitRentModule")));
const AdminFraudManagement = lazy(() => lazyRetry(() => import("./pages/admin/AdminFraudManagement")));
const AdminReviews = lazy(() => lazyRetry(() => import("./pages/admin/AdminReviews")));
const AdminAnalytics = lazy(() => lazyRetry(() => import("./pages/admin/AdminAnalytics")));
const AdminVisitorAnalytics = lazy(() => lazyRetry(() => import("./pages/admin/AdminVisitorAnalytics")));
const AdminCourierPanel = lazy(() => lazyRetry(() => import("./pages/admin/AdminCourierPanel")));
const AdminCustomerAccounts = lazy(() => lazyRetry(() => import("./pages/admin/AdminCustomerAccounts")));
const AdminNotificationManagement = lazy(() => lazyRetry(() => import("./pages/admin/AdminNotificationManagement")));
const AdminEmailCampaign = lazy(() => lazyRetry(() => import("./pages/admin/AdminEmailCampaign")));
const AdminSmsCampaign = lazy(() => lazyRetry(() => import("./pages/admin/AdminSmsCampaign")));
const AdminSmartInbox = lazy(() => lazyRetry(() => import("./pages/admin/AdminSmartInbox")));
const AdminInboxIntegrations = lazy(() => lazyRetry(() => import("./pages/admin/AdminInboxIntegrations")));
const AdminOAuthCallback = lazy(() => lazyRetry(() => import("./pages/admin/AdminOAuthCallback")));
const AdminCRM = lazy(() => lazyRetry(() => import("./pages/admin/AdminCRM")));
const AdminAccActivityLog = lazy(() => lazyRetry(() => import("./pages/admin/AdminAccActivityLog")));
const AdminBannerGenerator = lazy(() => lazyRetry(() => import("./pages/admin/AdminBannerGenerator")));
const AdminAIKeys = lazy(() => lazyRetry(() => import("./pages/admin/AdminAIKeys")));
const AdminAIChatSettings = lazy(() => lazyRetry(() => import("./pages/admin/AdminAIChatSettings")));
const AdminAISupportRequests = lazy(() => lazyRetry(() => import("./pages/admin/AdminAISupportRequests")));
const AdminBroadcast = lazy(() => lazyRetry(() => import("./pages/admin/AdminBroadcast")));

// Customer account pages
const CustomerLogin = lazy(() => lazyRetry(() => import("./pages/account/CustomerLogin")));
const CustomerSignup = lazy(() => lazyRetry(() => import("./pages/account/CustomerSignup")));
const CustomerDashboard = lazy(() => lazyRetry(() => import("./pages/account/CustomerDashboard")));
const StaffAttendance = lazy(() => lazyRetry(() => import("./pages/staff/StaffAttendance")));

import { useThemeConfig } from '@/hooks/useThemeConfig';
import { useUtmCapture } from '@/hooks/useUtmCapture';
import { supabase } from '@/integrations/supabase/client';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 60 * 1000,        // 10 min — serve cache aggressively
      gcTime: 60 * 60 * 1000,           // 1 hour garbage collection
      refetchOnWindowFocus: false,      // major egress saver — no refetch on tab switch
      refetchOnReconnect: false,        // don't refetch on every reconnect blip
      refetchOnMount: false,            // use cached data if still fresh
      retry: 1,                         // limit retry storms
    },
  },
});

// Defer prefetch — only run after idle to avoid competing with auth on mobile PWA cold start
const doPrefetch = () => {
  queryClient.prefetchQuery({
    queryKey: ['all-settings'],
    queryFn: async () => {
      const { data } = await supabase.from('store_settings').select('key, value');
      const map: Record<string, string> = {};
      data?.forEach((s: any) => { map[s.key] = s.value; });
      return map;
    },
    staleTime: 10 * 60 * 1000,
  });

  queryClient.prefetchQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await supabase.from('categories').select('*').or('is_active.is.null,is_active.eq.true').order('name');
      return data || [];
    },
    staleTime: 30 * 60 * 1000,
  });

  queryClient.prefetchQuery({
    queryKey: ['products', 'product-card-sale-price-v2', undefined],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('id, slug, name, name_bn, price, original_price, images, is_featured, is_active, category_id, stock, colors, sizes, product_type, created_at, variant_images, categories(name, name_bn, slug)').eq('is_active', true).eq('is_hidden_from_shop', false).order('created_at', { ascending: false });
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  queryClient.prefetchQuery({
    queryKey: ['featured-products', 'product-card-sale-price-v2'],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('id, slug, name, name_bn, price, original_price, images, is_featured, is_active, category_id, stock, colors, sizes, product_type, created_at, variant_images, categories(name, name_bn, slug)').eq('is_active', true).eq('is_hidden_from_shop', false).eq('is_featured', true).order('created_at', { ascending: false }).limit(8);
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  queryClient.prefetchQuery({
    queryKey: ['product-sales-counts'],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_all_product_sales_counts');
      const map = new Map<string, number>();
      (data || []).forEach((item: any) => { map.set(item.product_id, item.total_sold); });
      return map;
    },
    staleTime: 5 * 60 * 1000,
  });
};

// Use requestIdleCallback (or 1s fallback) so prefetches don't block auth bootstrap
if (typeof requestIdleCallback === 'function') {
  requestIdleCallback(doPrefetch, { timeout: 2000 });
} else {
  setTimeout(doPrefetch, 1000);
}

import AdminSkeleton from "./components/admin/AdminSkeleton";

const SimpleLoading = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const AdminLoading = () => <AdminSkeleton />;

function ThemeLoader() {
  useThemeConfig();
  useUtmCapture();
  return null;
}

function SitemapRedirect() {
  window.location.replace('https://xxucasikopqtcztbgfbw.supabase.co/functions/v1/sitemap');
  return null;
}

function MerchantFeedRedirect() {
  window.location.replace('https://xxucasikopqtcztbgfbw.supabase.co/functions/v1/google-merchant-feed');
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <CartProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ThemeLoader />
          <Suspense fallback={<SimpleLoading />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/order-status" element={<OrderStatus />} />
              <Route path="/shop" element={<Shop />} />
              <Route path="/trending" element={<TrendingProducts />} />
              <Route path="/clearance" element={<ClearanceProducts />} />
              <Route path="/shop/:category" element={<Shop />} />
              <Route path="/product/:slug" element={<ProductDetail />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/policies" element={<Policies />} />
              <Route path="/return-policy" element={<ReturnPolicy />} />
              <Route path="/refund-policy" element={<CancellationPolicy />} />
              <Route path="/Return-ExchangePolicy" element={<ExchangeRefundPolicy />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
              <Route path="/page/:slug" element={<DynamicPage />} />
              <Route path="/lp/:slug" element={<LandingPage />} />
              <Route path="/install" element={<Install />} />
              <Route path="/app" element={<CustomerInstall />} />
              <Route path="/payment-result" element={<PaymentResult />} />
              <Route path="/thank-you" element={<ThankYou />} />
              <Route path="/c/:slug" element={<CollectionPage />} />
              <Route path="/memo/:orderId" element={<PublicMemo />} />
              <Route path="/s/:token" element={<SmsRedirect />} />

              <Route path="/hishab/person/:personId" element={<PublicHishab kind="person" />} />
              <Route path="/hishab/unit/:unitId" element={<PublicHishab kind="unit" />} />
              <Route path="/hishab/unit-module/:unitId/:moduleType" element={<PublicHishab kind="unit-module" />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/giveaway" element={<Giveaway />} />
              <Route path="/account" element={<CustomerDashboard />} />
              <Route path="/account/login" element={<CustomerLogin />} />
              <Route path="/account/signup" element={<CustomerSignup />} />
              <Route path="/staff/attendance" element={<Suspense fallback={<SimpleLoading />}><StaffAttendance /></Suspense>} />
              <Route path="/admin/oauth/callback" element={<Suspense fallback={<AdminLoading />}><AdminOAuthCallback /></Suspense>} />
              <Route path="/admin" element={<Suspense fallback={<AdminLoading />}><AdminLogin /></Suspense>} />
              <Route path="/admin" element={<Suspense fallback={<AdminLoading />}><AdminDashboard /></Suspense>}>
                <Route path="dashboard" element={<AdminOverview />} />
                <Route path="analytics" element={<AdminAnalytics />} />
                <Route path="visitor-analytics" element={<AdminVisitorAnalytics />} />
                <Route path="orders" element={<AdminOrders />} />
                <Route path="products" element={<AdminProducts />} />
                <Route path="products/new" element={<AdminProductEditor />} />
                <Route path="products/edit/:id" element={<AdminProductEditor />} />
                <Route path="categories" element={<AdminCategories />} />
                <Route path="customers" element={<AdminCustomers />} />
                <Route path="customers/import" element={<AdminCustomerImport />} />
                <Route path="coupons" element={<AdminCoupons />} />
                <Route path="settings" element={<AdminSettings />} />
                <Route path="settings/integrations" element={<AdminIntegrations />} />
                <Route path="settings/payment" element={<AdminPaymentSettings />} />
                <Route path="abandoned-checkouts" element={<AdminAbandonedCheckouts />} />
                <Route path="fraud-management" element={<AdminFraudManagement />} />
                <Route path="landing-pages" element={<AdminLandingPages />} />
                <Route path="landing-pages/brand-defaults" element={<AdminLandingPageBrandDefaults />} />
                <Route path="landing-pages/:id" element={<AdminLandingPageEditor />} />
                <Route path="media" element={<AdminMediaCenter />} />
                <Route path="sizes-colors" element={<AdminSizesColors />} />
                <Route path="site-editor" element={<AdminSiteEditor />} />
                <Route path="site-editor/theme" element={<AdminThemeSettings />} />
                <Route path="site-editor/checkout" element={<AdminCheckoutSettings />} />
                <Route path="site-editor/invoice" element={<AdminInvoiceSettings />} />
                <Route path="site-editor/branding" element={<AdminBrandingSeo />} />
                <Route path="site-editor/store-info" element={<AdminStoreInfoSettings />} />
                <Route path="live-chat/settings" element={<AdminLiveChatSettings />} />
                <Route path="customers/loyalty-badges" element={<AdminLoyaltyBadges />} />
                <Route path="free-shipping" element={<AdminFreeShipping />} />
                <Route path="free-shipping/:id" element={<AdminFreeShipping />} />

                <Route path="employees" element={<AdminEmployees />} />
                <Route path="employees/:id" element={<AdminEmployeeProfile />} />
                <Route path="live-chat" element={<AdminLiveChat />} />
                <Route path="performance" element={<AdminPerformance />} />
                <Route path="accounting" element={<AdminAccounting />} />
                <Route path="accounting/persons" element={<AdminAccountingSettings />} />
                <Route path="accounting/persons/:id" element={<AdminPersonProfile />} />
                <Route path="accounting/attendance" element={<AdminAttendance />} />
                <Route path="accounting/salary" element={<AdminSalary />} />
                <Route path="accounting/settings" element={<AdminAccountingSettings />} />
                <Route path="accounting/business" element={<AdminBusinessAccount />} />
                <Route path="accounting/units/:id" element={<AdminUnitProfile />} />
                <Route path="accounting/sales" element={<AdminSalesHistory />} />
                <Route path="accounting/units/:unitId/work-orders" element={<AdminWorkOrders />} />
                <Route path="accounting/units/:unitId/modules/loans" element={<AdminUnitLoansModule />} />
                <Route path="accounting/units/:unitId/modules/rent" element={<AdminUnitRentModule />} />
                <Route path="accounting/units/:unitId/modules/:moduleType" element={<AdminUnitModuleProfile />} />

                <Route path="reviews" element={<AdminReviews />} />
                <Route path="courier" element={<AdminCourierPanel />} />
                <Route path="customer-accounts" element={<AdminCustomerAccounts />} />
                <Route path="giveaway" element={<Giveaway />} />
                <Route path="notifications" element={<AdminNotificationManagement />} />
                <Route path="email-campaign" element={<AdminEmailCampaign />} />
                <Route path="sms-campaign" element={<AdminSmsCampaign />} />
                <Route path="smart-inbox" element={<AdminSmartInbox />} />
                <Route path="smart-inbox/integrations" element={<AdminInboxIntegrations />} />
                <Route path="crm" element={<AdminCRM />} />
                <Route path="accounting/activity-log" element={<AdminAccActivityLog />} />
                <Route path="banner-generator" element={<AdminBannerGenerator />} />
                <Route path="ai-keys" element={<AdminAIKeys />} />
                <Route path="ai-chat-settings" element={<AdminAIChatSettings />} />
                <Route path="ai-support-requests" element={<AdminAISupportRequests />} />
                <Route path="broadcast" element={<AdminBroadcast />} />
              </Route>
              <Route path="/sitemap.xml" element={<SitemapRedirect />} />
              <Route path="/feeds/google-merchant-optimized.xml" element={<MerchantFeedRedirect />} />
              <Route path="/:slug" element={<LandingPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </CartProvider>
  </QueryClientProvider>
);

export default App;
