import { useEffect, useState } from 'react';
import { sanitizeHtml, sanitizeCss } from '@/lib/sanitize';
import IsolatedHtmlSection from '@/components/landing/IsolatedHtmlSection';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { applyClearanceList } from '@/lib/clearancePrice';
import { supabase } from '@/integrations/supabase/client';
import { usePublicSettings } from '@/hooks/useStoreSettings';
import { useSiteConfig } from '@/hooks/useSiteConfig';
import { useLandingTracking } from '@/hooks/useLandingTracking';
import { useLandingEditorBridge } from '@/hooks/useLandingEditorBridge';

import LandingStickyHeader from '@/components/landing/LandingStickyHeader';
import LandingHero from '@/components/landing/LandingHero';
import LandingOrderForm from '@/components/landing/LandingOrderForm';
import LandingTrustSignals from '@/components/landing/LandingTrustSignals';
import Footer from '@/components/layout/Footer';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import LandingTestimonialSection from '@/components/landing/LandingTestimonialSection';
import LandingGiftService from '@/components/landing/LandingGiftService';
import NotFound from '@/pages/NotFound';

const DEFAULT_SECTION_ORDER = ['marquee', 'header', 'hero', 'order_form', 'trust_signals', 'footer'];

// Deep merge: section-level merge where page config overrides brand defaults
function deepMergeConfig(base: any, override: any): any {
  if (!override || Object.keys(override).length === 0) return base;
  const result: any = { ...base };
  for (const key of Object.keys(override)) {
    if (override[key] !== undefined && override[key] !== null && override[key] !== '') {
      if (typeof override[key] === 'object' && !Array.isArray(override[key]) && typeof base[key] === 'object' && !Array.isArray(base[key])) {
        result[key] = deepMergeConfig(base[key] || {}, override[key]);
      } else {
        result[key] = override[key];
      }
    }
  }
  return result;
}

export default function LandingPage() {
  const { slug } = useParams();
  const { data: settings } = usePublicSettings();
  useLandingTracking();
  useLandingEditorBridge();
  const { data: navbarConfig } = useSiteConfig('navbar_config');

  // Parse brand defaults from store_settings
  const brandDefaults = (() => {
    try {
      return settings?.landing_page_defaults ? JSON.parse(settings.landing_page_defaults) : {};
    } catch { return {}; }
  })();

  const normalizedSlug = slug ? decodeURIComponent(slug).trim() : '';

  const { data: page, isFetched: pageChecked } = useQuery({
    queryKey: ['lp', normalizedSlug],
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('landing_pages')
        .select('*')
        .ilike('slug', normalizedSlug)
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!normalizedSlug,
    retry: 2,
  });

  const { data: sections = [] } = useQuery({
    queryKey: ['lp-sections', page?.id],
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('landing_page_sections').select('*').eq('landing_page_id', page!.id).eq('is_active', true).order('sort_order');
      if (error) throw error;
      return data;
    },
    enabled: !!page?.id,
  });

  const { data: pageProducts = [] } = useQuery({
    queryKey: ['lp-products', page?.id],
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('landing_page_products')
        .select('*, products!landing_page_products_product_id_fkey(id, name, name_bn, slug, price, original_price, images, colors, sizes, variant_images, is_active, stock, clearance_price, clearance_active)')
        .eq('landing_page_id', page!.id)
        .order('sort_order');
      if (error) {
        console.error('[LandingPage] pageProducts query failed:', error);
        throw error;
      }
      return data;
    },
    enabled: !!page?.id,
  });

  // Safety net: unregister stale SWs but preserve push notification worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => {
          // Keep the push notification service worker alive
          if (r.active?.scriptURL?.includes('custom-sw.js')) return;
          r.unregister();
        });
      });
    }
  }, []);

  // SEO
  useEffect(() => {
    if (page) {
      document.title = page.meta_title || page.title;
      const desc = document.querySelector('meta[name="description"]');
      if (desc) desc.setAttribute('content', page.meta_description || '');
    }
  }, [page]);

  // File extensions (robots.txt, ads.txt etc.) should not be treated as landing page slugs
  if (slug && slug.includes('.')) {
    return <NotFound />;
  }

  // Show NotFound if query finished but no page found
  if (pageChecked && !page) return <NotFound />;

  if (!page) {
    // Skeleton mirrors the real layout (marquee + header + hero + order form)
    // so the CLS impact of the swap is near zero on mobile.
    return (
      <div className="min-h-screen bg-white" aria-busy="true">
        <div className="fixed top-0 left-0 right-0 z-[100]">
          <div className="h-8 sm:h-9 bg-muted/60 animate-pulse" />
          <div className="h-[52px] sm:h-[62px] bg-background border-b border-border/40 flex items-center px-4">
            <div className="h-6 w-32 bg-muted rounded animate-pulse" />
          </div>
        </div>
        <div className="h-[92px] sm:h-[102px]" />
        <section className="px-4 py-10 sm:py-16 text-center" style={{ background: 'linear-gradient(180deg,#F1F8F4 0%,#FFFFFF 100%)' }}>
          <div className="max-w-3xl mx-auto space-y-3">
            <div className="h-8 sm:h-12 w-3/4 mx-auto bg-muted rounded animate-pulse" />
            <div className="h-4 sm:h-5 w-1/2 mx-auto bg-muted/70 rounded animate-pulse" />
            <div className="mx-auto rounded-xl bg-muted animate-pulse mt-6" style={{ aspectRatio: '16 / 9', maxWidth: '640px' }} />
          </div>
        </section>
        <section className="px-4 py-8">
          <div className="max-w-3xl mx-auto space-y-3">
            <div className="h-10 bg-muted rounded animate-pulse" />
            <div className="h-10 bg-muted rounded animate-pulse" />
            <div className="h-24 bg-muted rounded animate-pulse" />
            <div className="h-12 bg-muted rounded animate-pulse" />
          </div>
        </section>
      </div>
    );
  }

  const products = applyClearanceList(pageProducts.map((pp: any) => pp.products).filter(Boolean));

  // Merge: brand defaults < page config (section-level deep merge)
  const pageRawConfig = (page as any).page_config || {};
  const config = deepMergeConfig(brandDefaults, pageRawConfig);
  const marqueeConfig = config.marquee || {};
  const headerConfig = config.header || {};
  const heroConfig = config.hero || {};
  const trustConfig = config.trust_signals || {};
  const footerConfig = config.footer || {};
  const orderFormConfig = config.order_form || {};

  // Extract hero section data
  const heroSection = sections.find((s: any) => s.section_type === 'hero');
  const heroContent = heroSection?.content as any;

  const marqueeText = marqueeConfig.text || 'স্বর্ণ সুতায় স্বাগতম • অগ্রিম টাকা লাগে না • পণ্য হাতে পেয়ে দেখে টাকা দিন • ১০০% কোয়ালিটি পণ্য • ৭ দিনের রিটার্ন/এক্সচেঞ্জ • হোম ডেলিভারি সারা বাংলাদেশে • হটলাইন: 09617356977 • হোয়াটসঅ্যাপ: 01843711211';

  const sectionOrder: string[] = config.section_order || DEFAULT_SECTION_ORDER;
  const globalCss = config.global_css || '';

  // Collect all custom CSS from config sections
  let allCustomCss = Object.entries(config).reduce((acc: string, [key, val]: [string, any]) => {
    if (val?.custom_css) acc += `\n/* ${key} */\n${val.custom_css}`;
    return acc;
  }, '');
  // Collect custom CSS from custom database sections
  sections.forEach((s: any) => {
    const content = s.content as any;
    if (content?.custom_css) allCustomCss += `\n/* section-${s.section_type}-${s.id.slice(0, 8)} */\n${content.custom_css}`;
  });

  // Render marquee element
  const renderMarquee = () => {
    if (marqueeConfig.enabled === false) return null;
    return (
      <>
        <div className="bg-primary text-primary-foreground text-xs overflow-hidden">
          <div className="h-8 flex items-center relative">
            <div className="marquee-track whitespace-nowrap">
              <span className="inline-block px-8">{marqueeText}</span>
              <span className="inline-block px-8">{marqueeText}</span>
            </div>
          </div>
        </div>
        {marqueeConfig.custom_html && <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(marqueeConfig.custom_html) }} />}
      </>
    );
  };

  // Render header element
  const renderHeader = () => {
    if (headerConfig.enabled === false) return null;
    // Fallback: landing page config → main site navbar config → store settings
    const navCfg = navbarConfig as any || {};
    const resolvedBrandName = headerConfig.brand_name || navCfg.brand_name || settings?.store_name_bn;
    const resolvedLogoUrl = headerConfig.logo_url || navCfg.logo_url;
    const resolvedLogoMode = headerConfig.logo_mode || navCfg.logo_mode;
    const resolvedWideLogoUrl = headerConfig.wide_logo_url || navCfg.wide_logo_url;
    const resolvedWideLogoAlign = headerConfig.wide_logo_align || navCfg.wide_logo_align;
    return (
      <>
        <LandingStickyHeader
          helpline={headerConfig.helpline || settings?.helpline_number || '09617-356977'}
          brandName={resolvedBrandName}
          ctaText={headerConfig.cta_text}
          brandColor={headerConfig.brand_color}
          logoUrl={resolvedLogoUrl}
          logoMode={resolvedLogoMode}
          wideLogoUrl={resolvedWideLogoUrl}
          wideLogoAlign={resolvedWideLogoAlign}
          showCallButton={headerConfig.show_call_button !== false}
          showWhatsappButton={headerConfig.show_whatsapp_button || false}
          whatsappNumber={headerConfig.whatsapp_number}
          showCtaButton={headerConfig.show_cta_button !== false}
          ctaColor={headerConfig.cta_color}
          ctaTextColor={headerConfig.cta_text_color}
          bgColor={headerConfig.bg_color}
          textColor={headerConfig.text_color}
          showShadow={headerConfig.show_shadow !== false}
          pageTitle={page.title}
          products={products.map((p: any) => ({ name: p.name_bn || p.name, price: (p.original_price > 0 && p.original_price < p.price) ? p.original_price : p.price, original_price: (p.original_price > 0 && p.original_price < p.price) ? p.price : undefined }))}
        />
        {headerConfig.custom_html && <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(headerConfig.custom_html) }} />}
      </>
    );
  };

  // Custom section renderer
  const renderCustomSection = (s: any) => {
    const content = s.content as any;
    const sectionStyle: React.CSSProperties = content?.bg_color ? { backgroundColor: content.bg_color } : {};
    switch (s.section_type) {
      case 'html':
        return (
          <div key={s.id} style={sectionStyle}>
            <IsolatedHtmlSection
              html={content?.html || ''}
              css={content?.css}
              bgColor={content?.bg_color}
            />
          </div>
        );
      case 'html_blog': {
        const content = s.content as any;
        return (
          <div key={s.id} style={sectionStyle}>
            <IsolatedHtmlSection
              html={content?.html || ''}
              css={content?.css}
              bgColor={content?.bg_color}
            />
          </div>
        );
      }
      case 'faq':
        return (
          <div key={s.id} style={sectionStyle} className="max-w-3xl mx-auto px-4 py-8">
            <h2 className="text-xl font-bold text-center mb-6">সচরাচর জিজ্ঞাসা</h2>
            <div className="space-y-3">
              {(content?.items || []).map((item: any, i: number) => (
                <details key={i} className="border border-border rounded-lg p-4">
                  <summary className="font-medium cursor-pointer">{item.q}</summary>
                  <p className="mt-2 text-muted-foreground text-sm">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        );
      case 'testimonial':
        return (
          <div key={s.id} style={sectionStyle}>
            <LandingTestimonialSection
              source={(content?.source as 'homepage' | 'manual') || 'manual'}
              manualItems={content?.items}
              bgColor={content?.bg_color}
            />
          </div>
        );
      case 'gift_service':
        return (
          <div key={s.id} style={sectionStyle}>
            <LandingGiftService
              heading={content?.heading}
              description={content?.description}
              sampleNote={content?.sample_note}
              sampleSender={content?.sample_sender}
              bgColor={content?.bg_color}
              accentColor={content?.accent_color}
              ctaText={content?.cta_text}
              sampleImages={content?.sample_images}
              imageCaption={content?.image_caption}
            />
          </div>
        );
      case 'cta':
        return (
          <div key={s.id} className="text-center py-8 px-4" style={sectionStyle}>
            <button
              onClick={() => document.getElementById('order-form')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-8 py-3 rounded-full text-white font-bold text-lg"
              style={{ backgroundColor: '#8C6A1A' }}
            >
              {content?.text || 'এখনই অর্ডার করুন'}
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  // Section rendering map
  const renderSection = (key: string) => {
    // Check if it's a custom section (by id)
    const customSection = sections.find((s: any) => s.id === key);
    if (customSection) return renderCustomSection(customSection);

    switch (key) {
      case 'marquee':
      case 'header':
        return null; // rendered in sticky wrapper
      case 'hero':
        if (heroConfig.enabled === false) return null;
        return (
          <div key="hero" style={{ backgroundColor: heroConfig.bg_color || undefined }}>
            <LandingHero
              title={heroContent?.title}
              subtitle={heroContent?.subtitle}
              imageUrl={heroContent?.image_url}
            />
            {heroConfig.custom_html && <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(heroConfig.custom_html) }} />}
          </div>
        );
      case 'order_form':
        if (products.length === 0 || orderFormConfig.enabled === false) return null;
        return (
          <div key="order_form" style={{ backgroundColor: orderFormConfig.bg_color || undefined }}>
            <LandingOrderForm
              products={products}
              landingPageId={page.id}
              heading={orderFormConfig.heading}
              submitText={orderFormConfig.submit_text}
              submitColor={orderFormConfig.submit_color}
              showEmail={orderFormConfig.show_email}
              showOrderNote={orderFormConfig.show_order_note}
              namePlaceholder={orderFormConfig.name_placeholder}
              phonePlaceholder={orderFormConfig.phone_placeholder}
              addressPlaceholder={orderFormConfig.address_placeholder}
              headingColor={orderFormConfig.heading_color}
              headingSize={orderFormConfig.heading_size}
              labelColor={orderFormConfig.label_color}
              inputBorderColor={orderFormConfig.input_border_color}
              inputBgColor={orderFormConfig.input_bg_color}
              totalColor={orderFormConfig.total_color}
              highlightColor={orderFormConfig.highlight_color}
              submitTextColor={orderFormConfig.submit_text_color}
              submitRounded={orderFormConfig.submit_rounded !== false}
              cardBorderColor={orderFormConfig.card_border_color}
              showCardShadow={orderFormConfig.show_card_shadow !== false}
              itemLabel={orderFormConfig.item_label}
              deliveryAreaOrder={orderFormConfig.delivery_area_order}
              defaultDeliveryArea={orderFormConfig.default_delivery_area}
              productOverrides={orderFormConfig.product_overrides}
            />
            {orderFormConfig.custom_html && <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(orderFormConfig.custom_html) }} />}
          </div>
        );
      case 'trust_signals':
        if (trustConfig.enabled === false) return null;
        return (
          <div key="trust_signals" style={{ backgroundColor: trustConfig.bg_color || undefined }}>
            <LandingTrustSignals
              enabled={trustConfig.enabled}
              heading={trustConfig.heading}
              items={trustConfig.items}
            />
            {trustConfig.custom_html && <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(trustConfig.custom_html) }} />}
          </div>
        );
      case 'footer':
        if (footerConfig.enabled === false) return null;
        return (
          <>
            <Footer key="footer" />
            {footerConfig.custom_html && <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(footerConfig.custom_html) }} />}
          </>
        );
      default:
        return null;
    }
  };

  // Build section order: custom DB sections (AI html_blog, etc.) inserted BEFORE
  // trust_signals (and footer), so they render in the main content body — never
  // pushed below trust_signals/footer.
  // Build section order: custom DB sections (AI html_blog, etc.) inserted BEFORE
  // order_form / trust_signals / footer — these 3 always stay at the bottom.
  const customSectionKeys = sections
    .filter((s: any) => !DEFAULT_SECTION_ORDER.includes(s.section_type))
    .map((s: any) => s.id)
    .filter((k: string) => !sectionOrder.includes(k));
  const _anchor = ['order_form', 'trust_signals', 'footer']
    .map(k => sectionOrder.indexOf(k))
    .find(i => i !== -1);
  const insertIdx = _anchor !== undefined && _anchor >= 0 ? _anchor : sectionOrder.length;
  const fullSectionOrder = [
    ...sectionOrder.slice(0, insertIdx),
    ...customSectionKeys,
    ...sectionOrder.slice(insertIdx),
  ];

  const labelFor = (key: string): string => {
    const custom = sections.find((s: any) => s.id === key);
    if (custom) {
      const ai = (custom.ai_meta as any)?.label;
      const user = (custom.content as any)?.section_label;
      return ai || user || custom.section_type;
    }
    const map: Record<string, string> = {
      marquee: 'মার্কি বার', header: 'হেডার', hero: 'হিরো সেকশন',
      order_form: 'অর্ডার ফর্ম', trust_signals: 'ট্রাস্ট সিগনাল', footer: 'ফুটার',
    };
    return map[key] || key;
  };

  const editWrap = (key: string, node: React.ReactNode) => {
    if (!node) return null;
    const editKey = sections.some((s: any) => s.id === key) ? `custom_${key}` : key;
    return (
      <div data-edit-key={editKey} data-edit-label={labelFor(key)} key={key}>
        {node}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white">
      {(globalCss || allCustomCss) && <style dangerouslySetInnerHTML={{ __html: sanitizeCss(globalCss + allCustomCss) }} />}
      {/* Fixed marquee + header wrapper */}
      <div className="fixed top-0 left-0 right-0 z-[100]">
        {editWrap('marquee', renderMarquee())}
        {editWrap('header', renderHeader())}
      </div>
      {/* Dynamic spacer for fixed header */}
      {headerConfig.enabled !== false && (
        <div className={marqueeConfig.enabled !== false ? "h-[92px] sm:h-[102px]" : "h-[60px] sm:h-[70px]"} />
      )}
      {fullSectionOrder.map(k => editWrap(k, renderSection(k)))}
      <MobileBottomNav matchFooterBg={footerConfig.enabled !== false} />
    </div>
  );
}
