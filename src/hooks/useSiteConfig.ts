import { useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAllSettings } from './useAllSettings';

export const DEFAULT_HOMEPAGE_CONFIG = {
  section_order: ['hero', 'categories', 'stock_clearance', 'trending', 'best_selling', 'new_products', 'all_products', 'testimonials'],
  global: { custom_css: '', custom_html: '' },
  hero: {
    enabled: true,
    title: 'সেরা মানের',
    title_highlight: 'পণ্য',
    subtitle: 'বাংলাদেশের সবচেয়ে বিশ্বস্ত অনলাইন শপ থেকে কেনাকাটা করুন। ক্যাশ অন ডেলিভারি সুবিধা সহ ঘরে বসে অর্ডার করুন।',
    button_text: 'শপিং শুরু করুন',
    bg_color: '',
    hero_image: '',
    button_color: '',
    button_text_color: '',
    secondary_button_type: 'helpline' as 'helpline' | 'whatsapp' | 'custom_link' | 'none',
    secondary_button_text: '',
    secondary_button_link: '',
    hero_image_link: '',
    hide_text: false,
    hero_banners: [] as { image: string; link: string; title?: string; title_highlight?: string; subtitle?: string }[],
    primary_button_link: '',
    custom_css: '',
    custom_html_before: '',
    custom_html_after: '',
  },
  categories: {
    enabled: true,
    heading: 'ক্যাটেগরি সমূহ',
    subheading: 'আপনার পছন্দের ক্যাটেগরি বেছে নিন',
    bg_color: '', custom_css: '', custom_html_before: '', custom_html_after: '',
  },
  stock_clearance: {
    enabled: true,
    heading: '🏷️ স্টক ক্লিয়ারেন্স সেল',
    subheading: 'সীমিত সময়ের জন্য বিশেষ ছাড়ে — দ্রুত শেষ হয়ে যাবে!',
    badge_text: 'CLEARANCE',
    limit: 10,
    product_ids: [] as string[],
    view_all_link: '',
    bg_color: '', custom_css: '', custom_html_before: '', custom_html_after: '',
  },
  trending: {
    enabled: true,
    heading: '⚡ Trending এখন',
    subheading: 'সবচেয়ে বেশি বিক্রি ও পছন্দ হচ্ছে যেগুলো',
    badge_text: 'TRENDING',
    limit: 10,
    min_reviews: 20,
    view_all_link: '/trending',
    bg_color: '', custom_css: '', custom_html_before: '', custom_html_after: '',
  },
  best_selling: {
    enabled: true,
    heading: '🔥 বেস্ট সেলিং',
    subheading: 'সবচেয়ে বেশি বিক্রি হওয়া পণ্যসমূহ',
    limit: 8,
    bg_color: '', custom_css: '', custom_html_before: '', custom_html_after: '',
  },
  new_products: {
    enabled: true,
    heading: '🆕 নতুন পণ্য',
    subheading: 'সদ্য যোগ হওয়া পণ্যসমূহ',
    limit: 8,
    bg_color: '', custom_css: '', custom_html_before: '', custom_html_after: '',
  },
  all_products: {
    enabled: true,
    heading: 'সব পণ্য',
    subheading: 'আমাদের সকল পণ্য দেখুন',
    limit: 40,
    sort: 'top_rated' as 'default' | 'top_rated',
    bg_color: '', custom_css: '', custom_html_before: '', custom_html_after: '',
  },
  testimonials: {
    enabled: true,
    heading: 'কাস্টমার রিভিউ',
    subheading: 'আমাদের সন্তুষ্ট কাস্টমারদের মতামত',
    bg_color: '', custom_css: '', custom_html_before: '', custom_html_after: '',
    items: [
      { name: 'ফারহানা আক্তার', location: 'ঢাকা', text: 'পণ্যের কোয়ালিটি অসাধারণ! সময়মতো ডেলিভারি পেয়েছি। অনেক ভালো সার্ভিস।', rating: 5, images: [] as string[] },
      { name: 'রাহেলা বেগম', location: 'চট্টগ্রাম', text: 'দাম অনুযায়ী মান খুবই ভালো। আবারও অর্ডার করবো ইনশাআল্লাহ।', rating: 5, images: [] as string[] },
      { name: 'সাবরিনা ইসলাম', location: 'রাজশাহী', text: 'বোরখার কালেকশন অনেক সুন্দর। প্যাকেজিংও চমৎকার ছিল।', rating: 5, images: [] as string[] },
      { name: 'তাসনিম জাহান', location: 'সিলেট', text: 'থ্রি পিস কিনেছিলাম, কাপড়ের মান অনেক ভালো। ধন্যবাদ স্বর্ণ সুতাকে।', rating: 4, images: [] as string[] },
      { name: 'নুসরাত জাহান', location: 'খুলনা', text: 'ক্যাশ অন ডেলিভারি সুবিধা আছে বলে নিশ্চিন্তে অর্ডার করতে পারি। সবকিছু পারফেক্ট!', rating: 5, images: [] as string[] },
      { name: 'আফরিন সুলতানা', location: 'কুমিল্লা', text: 'বোরখার ডিজাইন অসাধারণ, কাপড়ের কোয়ালিটিও চমৎকার। আবারও অর্ডার করবো।', rating: 5, images: [] as string[] },
      { name: 'জান্নাতুল ফেরদৌস', location: 'গাজীপুর', text: 'প্যাকেজিং খুবই সুন্দর ছিল। পণ্য হাতে পেয়ে অনেক খুশি হয়েছি।', rating: 5, images: [] as string[] },
      { name: 'মারিয়া আক্তার', location: 'নারায়ণগঞ্জ', text: 'ডেলিভারি খুব দ্রুত পেয়েছি। কাপড়ের মান দারুণ!', rating: 5, images: [] as string[] },
      { name: 'শারমিন আক্তার', location: 'রংপুর', text: 'থ্রি পিসের কালেকশন অনেক ভালো। দাম ও যুক্তিসংগত।', rating: 4, images: [] as string[] },
      { name: 'তানজিলা ইসলাম', location: 'বরিশাল', text: 'প্রথমবার অর্ডার করলাম, একদম সন্তুষ্ট! ধন্যবাদ স্বর্ণ সুতা।', rating: 5, images: [] as string[] },
      { name: 'ফাতেমা খানম', location: 'ময়মনসিংহ', text: 'কাপড়ের কোয়ালিটি ছবির চেয়েও ভালো। অসাধারণ সার্ভিস!', rating: 5, images: [] as string[] },
      { name: 'রুমানা পারভীন', location: 'টাঙ্গাইল', text: 'আমার বোন এর জন্য অর্ডার করেছিলাম, সে অনেক খুশি হয়েছে।', rating: 5, images: [] as string[] },
      { name: 'সুমাইয়া আক্তার', location: 'বগুড়া', text: 'ওয়ান পিসটা অসাধারণ! রঙ ও ডিজাইন খুব সুন্দর।', rating: 5, images: [] as string[] },
      { name: 'নাজনীন সুলতানা', location: 'দিনাজপুর', text: 'হোম ডেলিভারি সুবিধা খুবই কাজে আসে। পণ্যও ভালো পেয়েছি।', rating: 4, images: [] as string[] },
      { name: 'আয়েশা সিদ্দিকা', location: 'যশোর', text: 'বান্ধবীকে গিফট দিলাম, সে অনেক পছন্দ করেছে! থ্যাংকস।', rating: 5, images: [] as string[] },
      { name: 'হাসিনা বেগম', location: 'পাবনা', text: 'এত কম দামে এত ভালো কাপড় আর কোথাও পাইনি। মাশাআল্লাহ!', rating: 5, images: [] as string[] },
      { name: 'লুবনা ইয়াসমিন', location: 'সাভার', text: 'টু পিসটা পরে অনেক কমপ্লিমেন্ট পেয়েছি। খুব সুন্দর!', rating: 5, images: [] as string[] },
      { name: 'সাদিয়া রহমান', location: 'ফরিদপুর', text: 'কাস্টমার সার্ভিস অনেক ভালো। ফোনে কথা বলে সব বুঝিয়ে দিয়েছে।', rating: 5, images: [] as string[] },
      { name: 'রিমা আক্তার', location: 'নোয়াখালী', text: 'পণ্য দেখে মুগ্ধ হয়ে গেছি! পরের অর্ডারও দিয়ে দিয়েছি।', rating: 5, images: [] as string[] },
      { name: 'পারভীন আক্তার', location: 'চাঁদপুর', text: 'রিটার্ন পলিসি আছে বলে ভরসা করে অর্ডার করেছিলাম। সব ঠিক আছে!', rating: 4, images: [] as string[] },
      { name: 'মৌসুমী আক্তার', location: 'কিশোরগঞ্জ', text: 'বোরখা কিনেছিলাম ঈদের জন্য, সবাই অনেক প্রশংসা করেছে।', rating: 5, images: [] as string[] },
      { name: 'শিরিন আক্তার', location: 'মানিকগঞ্জ', text: 'সময়মতো ডেলিভারি, ভালো প্যাকেজিং। সন্তুষ্ট!', rating: 5, images: [] as string[] },
      { name: 'নাসিমা বেগম', location: 'লক্ষ্মীপুর', text: 'আমি নিয়মিত অর্ডার করি। প্রতিবারই ভালো পণ্য পাই।', rating: 5, images: [] as string[] },
      { name: 'ফারজানা ইয়াসমিন', location: 'হবিগঞ্জ', text: 'কাপড়ের কোয়ালিটি মাশাআল্লাহ! দারুণ সার্ভিস পেয়েছি।', rating: 5, images: [] as string[] },
      { name: 'তাহমিনা আক্তার', location: 'ব্রাহ্মণবাড়িয়া', text: 'অনলাইনে কেনাকাটায় ভয় পেতাম, কিন্তু স্বর্ণ সুতায় ভরসা পেয়েছি!', rating: 5, images: [] as string[] },
    ],
  },
};

export const DEFAULT_NAVBAR_CONFIG = {
  logo_url: '',
  logo_mode: 'icon_text' as 'icon_text' | 'wide_logo',
  wide_logo_url: '',
  wide_logo_align: 'left' as 'left' | 'center',
  marquee_text: 'স্বর্ণ সুতায় স্বাগতম 🌸 | ❌ অগ্রিম টাকা লাগে না | 📦 পণ্য হাতে পেয়ে দেখে টাকা দিন | 🎯 ১০০% কোয়ালিটি পণ্য | 🔁 ৭ দিনের রিটার্ন/এক্সচেঞ্জ | 🚚 হোম ডেলিভারি সারা বাংলাদেশে | 📞 হটলাইন: 01843711211 | 📲 হোয়াটসঅ্যাপ: 01843711211',
  brand_name: 'স্বর্ণ সুতা',
  brand_name_en: 'Shorno Suta',
  links: [
    { label: 'হোম', to: '/' },
    { label: 'শপ', to: '/shop' },
    { label: 'ওয়ান পিস', to: '/shop/one-piece' },
    { label: 'টু পিস', to: '/shop/two-piece' },
    { label: 'থ্রি পিস', to: '/shop/three-piece' },
    { label: 'বোরখা', to: '/shop/borka' },
    { label: 'যোগাযোগ', to: '/contact' },
    { label: 'আমাদের সম্পর্কে', to: '/about' },
  ],
};

export const DEFAULT_INVOICE_CONFIG = {
  brand_color: '#8C6A1A',
  business_name: 'SHORNO SUTA',
  logo_url: '',
  phone: '+8801843-711211',
  whatsapp: '+8801843-711211',
  address: 'Kamrangirchar, Khola Mora Ghat, Dhaka-1211, Bangladesh',
  footer_message: 'প্রিয় গ্রাহক, আলহামদুলিল্লাহ, আপনার অর্ডার পেয়ে আমরা সত্যিই আনন্দিত।\n✅ ভুল বা ক্ষতিগ্রস্ত পণ্য পেলে | 📲 ডেলিভারির ২৪ ঘন্টার মধ্যে ভিডিওসহ WhatsApp করুন: 01843-711211 | 🔄 ৩ দিনের মধ্যে বিনামূল্যে পরিবর্তন করে দেওয়া হবে',
  signature_url: '',
  enable_signature: true,
  enable_qr: true,
  qr_target: 'website' as 'website' | 'whatsapp' | 'custom',
  qr_custom_url: '',
  logo_size: 60,
  header_note: '✨ প্রিয় গ্রাহক, আলহামদুলিল্লাহ, আপনার অর্ডার পেয়ে আমরা সত্যিই আনন্দিত।',
};

export const DEFAULT_BUTTONS_CONFIG = {
  product_detail: {
    order_button: { text: '🛒 এখনই অর্ডার করুন', bg_color: '', text_color: '', enabled: true, size: 'lg' as 'sm' | 'md' | 'lg' },
    cart_button: { text: 'কার্টে যোগ করুন', bg_color: '', text_color: '', border_color: '', enabled: true, size: 'lg' as 'sm' | 'md' | 'lg' },
    whatsapp_button: { text: 'WhatsApp', bg_color: '', text_color: '', enabled: true, size: 'lg' as 'sm' | 'md' | 'lg' },
    call_button: { text: 'কল করুন', bg_color: '', text_color: '', border_color: '', enabled: true, size: 'lg' as 'sm' | 'md' | 'lg' },
    custom_buttons: [] as { text: string; link: string; bg_color: string; text_color: string; enabled: boolean }[],
  },
  product_card: {
    order_button: { text: 'অর্ডার করুন', bg_color: '', text_color: '', enabled: true },
    cart_button: { bg_color: '', text_color: '', border_color: '', enabled: true },
  },
  bottom_nav: {
    items: [
      { label: 'ক্যাটাগরি', icon_type: 'category', to: '/shop', type: 'link' as 'link' | 'external', enabled: true },
      { label: 'ট্রেন্ডিং', icon_type: 'trending', to: '/trending', type: 'link' as 'link' | 'external', enabled: true },
      { label: 'হোম', icon_type: 'home', to: '/', type: 'link' as 'link' | 'external', enabled: true },
      { label: 'কার্ট', icon_type: 'cart', to: '/cart', type: 'link' as 'link' | 'external', enabled: true, badge_key: 'cart' },
      { label: 'একাউন্ট', icon_type: 'account', to: '/account', type: 'link' as 'link' | 'external', enabled: true },
    ],
  },
};

export const DEFAULT_FOOTER_CONFIG = {
  logo_url: '',
  logo_mode: 'icon_text' as 'icon_text' | 'wide_logo',
  wide_logo_url: '',
  wide_logo_align: 'left' as 'left' | 'center',
  brand_name: 'স্বর্ণ সুতা',
  brand_description: 'সেরা মানের পণ্য সাশ্রয়ী মূল্যে আপনার দোরগোড়ায়। মধ্যস্বত্বভোগী ছাড়াই সরাসরি বিশ্বস্ততার সাথে আপনার কাছে পৌঁছে দিই। ক্যাশ অন ডেলিভারিতে সারা বাংলাদেশে দ্রুত হোম ডেলিভারি।',
  address: 'কামরাঙ্গীরচর, খোলা মোড়া ঘাট, ঢাকা – ১২১১',
  phone: '01843711211',
  whatsapp: '01843711211',
  facebook: 'https://www.facebook.com/shornosuta',
  instagram: '',
  youtube: '',
  tiktok: '',
  copyright: '© {year} স্বর্ণ সুতা। সর্বস্বত্ব সংরক্ষিত।',
  quick_links: [
    { label: 'আমাদের সম্পর্কে', to: '/about' },
    { label: 'যোগাযোগ করুন', to: '/contact' },
    { label: 'অর্ডার ট্র্যাক করুন', to: '/order-status' },
  ],
  policy_links: [
    { label: 'রিটার্ন পলিসি', to: '/policies' },
    { label: 'ক্যানসেলেশন পলিসি', to: '/policies' },
    { label: 'এক্সচেঞ্জ ও রিফান্ড', to: '/policies' },
    { label: 'শর্তাবলী ও অর্ডার', to: '/terms-and-conditions' },
  ],
  payment_methods: ['COD', 'বিকাশ', 'নগদ', 'Steadfast', 'RedX'],
};

export const DEFAULT_WELCOME_ISLAND_CONFIG = {
  enabled: true,
  show_once_per_session: true,
  message_duration_ms: 4500,
  use_time_based_greeting: true,
  gradient_from: '#c2185b',
  gradient_via: '#e63176',
  gradient_to: '#a01753',
  text_color: '#ffffff',
  icon_color: '#fcd34d',
  messages: [
    '✨ স্বর্ণ সুতা-এ আপনাকে স্বাগতম!',
    '👗 আমাদের সুন্দর কালেকশন দেখার জন্য ধন্যবাদ',
    '💝 আশা করছি আমাদের প্রোডাক্টগুলো আপনার ভালো লাগবে',
    '🚚 সারা বাংলাদেশে দ্রুত হোম ডেলিভারি',
    '💵 ক্যাশ অন ডেলিভারি — হাতে পেয়ে টাকা দিন',
    '🎁 অর্ডার ১০০০৳+ হলে ফ্রি ডেলিভারি',
    '🔄 ৭ দিনের ইজি রিটার্ন/এক্সচেঞ্জ পলিসি',
    '💬 যেকোনো প্রশ্নে লাইভ চ্যাটে মেসেজ করুন',
    '🛍️ হ্যাপি শপিং! 💖',
    '',
  ] as string[],
};

/**
 * Derives a parsed JSON config for a specific key from the master settings cache.
 * No extra network call — reads from useAllSettings().
 */
export function useSiteConfig(configKey: string) {
  const { data: allSettings, isLoading, error } = useAllSettings();

  const data = useMemo(() => {
    if (!allSettings) return null;
    const raw = allSettings[configKey];
    if (raw) {
      try { return JSON.parse(raw); } catch { return null; }
    }
    return null;
  }, [allSettings, configKey]);

  return { data, isLoading, error };
}

export function useSaveSiteConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      const jsonStr = JSON.stringify(value);
      const { error } = await supabase.from('store_settings').upsert(
        { key, value: jsonStr },
        { onConflict: 'key' }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all-settings'] });
    },
  });
}
