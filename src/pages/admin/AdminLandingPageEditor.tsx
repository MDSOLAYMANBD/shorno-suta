import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { toast } from 'sonner';
import { Plus, Trash2, ArrowUp, ArrowDown, Save, ArrowLeft, Eye, ChevronDown, GripVertical, Monitor, Smartphone, Upload, Image as ImageIcon, Loader2, ShoppingCart, DollarSign, Target, Users } from 'lucide-react';
import AIGenerateButton from '@/components/admin/AIGenerateButton';
import { useAIGenerate } from '@/hooks/useAIGenerate';
import MediaCenter from '@/components/admin/MediaCenter';
import ColorPickerWithRecent from '@/components/admin/ColorPickerWithRecent';
import { usePublicSettings } from '@/hooks/useStoreSettings';
import CodeEditor from '@/components/admin/CodeEditor';
import CodeEditorWithPreview from '@/components/admin/CodeEditorWithPreview';
import { optimizeImage } from '@/lib/imageOptimizer';

const SECTION_TYPES = [
  { value: 'hero', label: 'হিরো ব্যানার' },
  { value: 'product', label: 'প্রোডাক্ট কার্ড' },
  { value: 'html_blog', label: 'HTML Blog' },
  { value: 'faq', label: 'FAQ' },
  { value: 'testimonial', label: 'টেস্টিমোনিয়াল' },
  { value: 'cta', label: 'CTA বাটন' },
  { value: 'gift_service', label: 'গিফট সার্ভিস' },
];

const VISUAL_SECTIONS = [
  { key: 'marquee', label: 'মার্কি বার', emoji: '📢' },
  { key: 'header', label: 'হেডার', emoji: '🏠' },
  { key: 'hero', label: 'হিরো সেকশন', emoji: '🖼️' },
  { key: 'order_form', label: 'অর্ডার ফর্ম', emoji: '🛒' },
  { key: 'trust_signals', label: 'ট্রাস্ট সিগনাল', emoji: '🛡️' },
  { key: 'footer', label: 'ফুটার', emoji: '📄' },
];

const DEFAULT_SECTION_ORDER = ['marquee', 'header', 'hero', 'order_form', 'trust_signals', 'footer'];

const DEFAULT_CONFIG = {
  marquee: {
    enabled: true,
    text: 'স্বর্ণ সুতায় স্বাগতম • অগ্রিম টাকা লাগে না • পণ্য হাতে পেয়ে দেখে টাকা দিন • ১০০% কোয়ালিটি পণ্য • ৭ দিনের রিটার্ন/এক্সচেঞ্জ • হোম ডেলিভারি সারা বাংলাদেশে • হটলাইন: 09617356977 • হোয়াটসঅ্যাপ: 09617356977',
  },
  header: { brand_name: 'স্বর্ণ সুতা', helpline: '09617-356977', cta_text: 'এখনই অর্ডার করুন', brand_color: '#8C6A1A', logo_url: '' },
  hero: { cta_text: 'অর্ডার করতে নিচের ফর্মে যান', cta_color: '#6B1E2B' },
  order_form: { heading: 'অর্ডার করুন', submit_text: 'অর্ডার কনফার্ম করুন', submit_color: '#8C6A1A', show_email: false, show_order_note: false, name_placeholder: 'সম্পূর্ণ নাম', phone_placeholder: '01XXXXXXXXX', address_placeholder: 'বাড়ি নম্বর, রোড, এলাকা, থানা, জেলা' },
  trust_signals: {
    enabled: true,
    heading: 'ডেলিভারি ও রিটার্ন পলিসি',
    items: [
      { icon: 'truck', title: 'ক্যাশ অন ডেলিভারি', desc: 'সারা বাংলাদেশে অগ্রিম পেমেন্ট ছাড়াই ডেলিভারি।' },
      { icon: 'clock', title: 'দ্রুত ডেলিভারি', desc: 'ঢাকায় ২৪-৪৮ ঘণ্টা, ঢাকার বাইরে ২-৫ কর্মদিবস।' },
      { icon: 'package', title: 'সিলড প্যাকেজিং', desc: 'সিলড ব্র্যান্ডেড প্যাকেটে নিরাপদ ডেলিভারি।' },
      { icon: 'refresh', title: '৭ দিনের এক্সচেঞ্জ', desc: 'ভুল সাইজ বা ক্ষতিগ্রস্ত পণ্যে ৭ দিনের মধ্যে পরিবর্তন। (আনবক্সিং ভিডিও বাধ্যতামূলক)' },
    ],
  },
  footer: { text: 'Trade License No: TRAD/DSCC/046208/2020 | © 2020-2025 SHORNO SUTA. All Rights Reserved.', bg_color: '#333333', text_color: '#999999' },
  section_order: DEFAULT_SECTION_ORDER,
};

function LandingPageAnalytics({ pageId, slug }: { pageId: string; slug: string }) {
  const { data: stats } = useQuery({
    queryKey: ['lp-analytics', pageId, slug],
    queryFn: async () => {
      const [ordersRes, visitRes] = await Promise.all([
        (supabase.from('orders').select('total') as any).eq('source_landing_page_id', pageId),
        supabase.from('site_visits').select('*', { count: 'exact', head: true }).or(`page_path.eq./lp/${slug},page_path.eq./${slug}`),
      ]);
      if (ordersRes.error) throw ordersRes.error;
      const orders = ordersRes.data || [];
      const totalOrders = orders.length;
      const totalRevenue = orders.reduce((sum: number, o: any) => sum + Number(o.total || 0), 0);
      const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
      const visitors = visitRes.count || 0;
      return { totalOrders, totalRevenue, avgOrderValue, visitors };
    },
    enabled: !!pageId && !!slug,
  });

  const cards = [
    { label: 'মোট অর্ডার', value: stats?.totalOrders ?? 0, icon: ShoppingCart, iconBg: 'bg-blue-50', iconColor: 'text-blue-500' },
    { label: 'মোট সেল', value: `৳${(stats?.totalRevenue ?? 0).toLocaleString('bn-BD')}`, icon: DollarSign, iconBg: 'bg-green-50', iconColor: 'text-green-500' },
    { label: 'গড় অর্ডার ভ্যালু', value: `৳${(stats?.avgOrderValue ?? 0).toLocaleString('bn-BD')}`, icon: Target, iconBg: 'bg-orange-50', iconColor: 'text-orange-500' },
    { label: 'ভিজিটর', value: stats?.visitors ?? 0, icon: Users, iconBg: 'bg-purple-50', iconColor: 'text-purple-500' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
      {cards.map((c) => (
        <div key={c.label} className="border border-border rounded-xl p-4 flex items-center justify-between bg-card">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{c.label}</p>
            <p className="text-2xl font-bold">{c.value}</p>
          </div>
          <div className={`h-10 w-10 rounded-lg ${c.iconBg} flex items-center justify-center`}>
            <c.icon className={`h-5 w-5 ${c.iconColor}`} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AdminLandingPageEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: page, refetch: refetchPage } = useQuery({
    queryKey: ['landing-page', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('landing_pages').select('*').eq('id', id!).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: sections = [], refetch: refetchSections } = useQuery({
    queryKey: ['landing-page-sections', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('landing_page_sections').select('*').eq('landing_page_id', id!).order('sort_order');
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: pageProducts = [] } = useQuery({
    queryKey: ['landing-page-products', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('landing_page_products')
        .select('id, landing_page_id, product_id, sort_order, products!landing_page_products_product_id_fkey(id, name, name_bn, price, original_price, images, colors, sizes, variant_images, is_active)')
        .eq('landing_page_id', id!)
        .order('sort_order');
      if (error) { toast.error('প্রোডাক্ট লোড করা যায়নি: ' + error.message); throw error; }
      return data;
    },
    enabled: !!id,
  });

  const { data: allProducts = [] } = useQuery({
    queryKey: ['all-products-for-lp'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('id, name, name_bn, price, original_price, images, colors, sizes, variant_images').eq('is_active', true);
      if (error) { toast.error('প্রোডাক্ট লিস্ট লোড করা যায়নি: ' + error.message); throw error; }
      return data;
    },
  });

  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [newSectionType, setNewSectionType] = useState('html');
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [mediaCenterOpen, setMediaCenterOpen] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const { generateContent: generateAI, loading: aiLoading } = useAIGenerate();

  // Page settings state
  const [pageSettings, setPageSettings] = useState({
    title: '', slug: '', meta_title: '', meta_description: '', is_active: true,
  });

  // Page config state
  const [pageConfig, setPageConfig] = useState<any>(DEFAULT_CONFIG);

  // Visual editor state
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [clickToEdit, setClickToEdit] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const pendingImageReq = useRef<{ imgId: string; sectionId?: string } | null>(null);
  const saveDebounce = useRef<Record<string, any>>({});
  const sectionsRef = useRef<any[]>([]);
  useEffect(() => { sectionsRef.current = sections; }, [sections]);

  // Listen for messages from the live preview iframe
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const d = e.data;
      if (!d || typeof d !== 'object') return;

      if (d.type === 'lp-edit-select' && typeof d.key === 'string') {
        // For inline-editable custom HTML/blog sections, don't auto-open the side panel
        const k: string = d.key;
        if (k.startsWith('custom_')) {
          const sid = k.replace('custom_', '');
          const sec = sectionsRef.current.find((s: any) => s.id === sid);
          if (sec && (sec.section_type === 'html' || sec.section_type === 'html_blog')) return;
        }
        setEditingSection(d.key);
        return;
      }

      if (d.type === 'lp-edit-content-update' && d.sectionId && typeof d.html === 'string') {
        const sid = d.sectionId;
        const sec = sectionsRef.current.find((s: any) => s.id === sid);
        if (!sec) return;
        const newContent = { ...(sec.content || {}), html: d.html };
        if (saveDebounce.current[sid]) clearTimeout(saveDebounce.current[sid]);
        saveDebounce.current[sid] = setTimeout(async () => {
          const { error } = await supabase.from('landing_page_sections').update({ content: newContent }).eq('id', sid);
          if (error) toast.error('সেভ ব্যর্থ: ' + error.message);
          else toast.success('সেভ হয়েছে', { duration: 1200 });
        }, 700);
        return;
      }

      if (d.type === 'lp-edit-image-request' && d.imgId) {
        pendingImageReq.current = { imgId: d.imgId, sectionId: d.sectionId };
        setImagePickerOpen(true);
        return;
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);


  const { data: storeSettings } = usePublicSettings();

  useEffect(() => {
    if (page) {
      setPageSettings({
        title: page.title || '',
        slug: page.slug || '',
        meta_title: page.meta_title || '',
        meta_description: page.meta_description || '',
        is_active: page.is_active ?? true,
      });

      // Parse brand defaults from store settings
      let brandDefaults: any = {};
      try {
        if (storeSettings?.landing_page_defaults) {
          brandDefaults = JSON.parse(storeSettings.landing_page_defaults);
        }
      } catch { /* ignore parse errors */ }

      // Merge: hardcoded DEFAULT < brand defaults < page config
      const base = {
        marquee: { ...DEFAULT_CONFIG.marquee, ...brandDefaults.marquee },
        header: { ...DEFAULT_CONFIG.header, ...brandDefaults.header },
        hero: { ...DEFAULT_CONFIG.hero, ...brandDefaults.hero },
        order_form: { ...DEFAULT_CONFIG.order_form, ...brandDefaults.order_form },
        trust_signals: { ...DEFAULT_CONFIG.trust_signals, ...brandDefaults.trust_signals, items: brandDefaults.trust_signals?.items || DEFAULT_CONFIG.trust_signals.items },
        footer: { ...DEFAULT_CONFIG.footer, ...brandDefaults.footer },
        section_order: DEFAULT_SECTION_ORDER,
      };

      const existing = (page as any).page_config;
      if (existing && Object.keys(existing).length > 0) {
        setPageConfig({
          marquee: { ...base.marquee, ...existing.marquee },
          header: { ...base.header, ...existing.header },
          hero: { ...base.hero, ...existing.hero },
          order_form: { ...base.order_form, ...existing.order_form },
          trust_signals: { ...base.trust_signals, ...existing.trust_signals, items: existing.trust_signals?.items || base.trust_signals.items },
          footer: { ...base.footer, ...existing.footer },
          section_order: existing.section_order || DEFAULT_SECTION_ORDER,
        });
      } else {
        setPageConfig(base);
      }
    }
  }, [page, storeSettings]);

  const updatePageSettings = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('landing_pages').update(pageSettings).eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => { refetchPage(); toast.success('পেজ সেটিংস সেভ হয়েছে'); },
  });

  const updatePageConfig = useMutation({
    mutationFn: async (configOverride: any) => {
      const { error } = await supabase.from('landing_pages').update({ page_config: configOverride } as any).eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => { refetchPage(); toast.success('ডিজাইন ও কনটেন্ট সেভ হয়েছে'); qc.invalidateQueries({ queryKey: ['landing-page', id] }); },
  });

  const addSection = useMutation({
    mutationFn: async () => {
      // Hardcoded fallback defaults
      const hardcodedDefaults: Record<string, any> = {
        hero: { title: 'Welcome', subtitle: '', image_url: '', bg_color: '' },
        product: { heading: 'আমাদের পণ্য' },
        html: { html: '<div>Your HTML here</div>' },
        html_blog: { html: '', css: '' },
        faq: { items: [{ q: 'প্রশ্ন?', a: 'উত্তর' }] },
        testimonial: { items: [{ name: 'Customer', text: 'Great product!', rating: 5 }] },
        cta: { text: 'এখনই অর্ডার করুন', link: '#order', bg_color: '' },
        gift_service: { heading: 'প্রিয়জনকে সারপ্রাইজ দিন! 🎁', description: 'আপনি যদি চান আপনার প্রিয় মানুষকে উপহার দিতে একটি সুন্দর নোটের মাধ্যমে, আমরা সেটা প্যাক করে দিচ্ছি একদম ফ্রি-তে!', sample_note: 'তোমার জন্য ছোট্ট একটা সারপ্রাইজ! তোমাকে অনেক ভালোবাসি ❤️', sample_sender: 'তোমার আপনজন', sample_images: [], image_caption: 'মেমোতে গিফট নোট দেখতে এমন হবে ✨' },
      };
      // Merge brand defaults from store settings
      let brandDefaults: Record<string, any> = {};
      try {
        brandDefaults = JSON.parse(storeSettings?.landing_page_defaults || '{}');
      } catch {}
      const sectionType = newSectionType;
      const fallback = hardcodedDefaults[sectionType] || {};
      const brandOverride = brandDefaults[sectionType] || {};
      // For faq/testimonial with items array, use brand defaults if they have items
      const mergedContent = (sectionType === 'faq' || sectionType === 'testimonial')
        ? { ...fallback, ...brandOverride, items: (brandOverride.items?.length > 0 ? brandOverride.items : fallback.items) }
        : { ...fallback, ...brandOverride };
      const { data, error } = await supabase.from('landing_page_sections').insert({
        landing_page_id: id,
        section_type: newSectionType,
        sort_order: sections.length,
        content: mergedContent,
      }).select().single();
      if (error) throw error;
      // Add to section_order — insert BEFORE order_form (fallback trust_signals → footer)
      if (data) {
        const current = [...(pageConfig.section_order || DEFAULT_SECTION_ORDER)];
        const anchor = ['order_form', 'trust_signals', 'footer'].map(k => current.indexOf(k)).find(i => i !== -1);
        const insertAt = anchor !== undefined && anchor >= 0 ? anchor : current.length;
        current.splice(insertAt, 0, data.id);
        setPageConfig((prev: any) => ({ ...prev, section_order: current }));
      }
    },
    onSuccess: () => { refetchSections(); setAddSectionOpen(false); toast.success('সেকশন যোগ হয়েছে'); },
  });

  const updateSection = useMutation({
    mutationFn: async ({ sectionId, content }: { sectionId: string; content: any }) => {
      const { error } = await supabase.from('landing_page_sections').update({ content }).eq('id', sectionId);
      if (error) throw error;
    },
    onSuccess: () => { refetchSections(); toast.success('সেভ হয়েছে'); },
  });

  const deleteSection = useMutation({
    mutationFn: async (sectionId: string) => {
      const { error } = await supabase.from('landing_page_sections').delete().eq('id', sectionId);
      if (error) throw error;
    },
    onSuccess: () => { refetchSections(); toast.success('ডিলিট হয়েছে'); },
  });

  const moveSection = useMutation({
    mutationFn: async ({ sectionId, direction }: { sectionId: string; direction: 'up' | 'down' }) => {
      const idx = sections.findIndex((s: any) => s.id === sectionId);
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= sections.length) return;
      const a = sections[idx], b = sections[swapIdx];
      await supabase.from('landing_page_sections').update({ sort_order: b.sort_order }).eq('id', a.id);
      await supabase.from('landing_page_sections').update({ sort_order: a.sort_order }).eq('id', b.id);
    },
    onSuccess: () => refetchSections(),
  });

  const addProduct = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('landing_page_products').insert({
        landing_page_id: id,
        product_id: selectedProductId,
        sort_order: pageProducts.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['landing-page-products', id] });
      setAddProductOpen(false); setSelectedProductId('');
      toast.success('প্রোডাক্ট যোগ হয়েছে');
    },
  });

  const removeProduct = useMutation({
    mutationFn: async (lpProductId: string) => {
      const { error } = await supabase.from('landing_page_products').delete().eq('id', lpProductId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['landing-page-products', id] }); toast.success('রিমুভ হয়েছে'); },
  });

  const refreshPreview = useCallback(() => {
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
  }, []);

  const handleLogoUpload = async (file: File) => {
    setLogoUploading(true);
    try {
      const optimizedFile = await optimizeImage(file);
      const ext = optimizedFile.name.split('.').pop();
      const path = `logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('product-images').upload(path, optimizedFile, { cacheControl: '31536000' });
      if (error) throw error;
      const { data } = supabase.storage.from('product-images').getPublicUrl(path);
      updateConfig('header', 'logo_url', data.publicUrl);
      toast.success('লোগো অপটিমাইজ ও আপলোড হয়েছে');
    } catch (e: any) {
      toast.error(e.message || 'আপলোড ব্যর্থ');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleVisualSave = async () => {
    await updatePageConfig.mutateAsync(pageConfig);
    setTimeout(refreshPreview, 500);
  };

  if (!page) return <p className="text-muted-foreground p-4">Loading...</p>;

  const updateConfig = (section: string, key: string, value: any) => {
    setPageConfig((prev: any) => ({ ...prev, [section]: { ...prev[section], [key]: value } }));
  };

  const baseSectionOrder: string[] = pageConfig.section_order || DEFAULT_SECTION_ORDER;
  const unsortedCustomIds = sections
    .filter((s: any) => !baseSectionOrder.includes(s.id))
    .map((s: any) => s.id);
  // Insert unsorted custom sections BEFORE order_form / trust_signals / footer
  const _anchorIdx = ['order_form', 'trust_signals', 'footer']
    .map(k => baseSectionOrder.indexOf(k))
    .find(i => i !== -1);
  const _insertAt = _anchorIdx !== undefined && _anchorIdx >= 0 ? _anchorIdx : baseSectionOrder.length;
  const sectionOrder: string[] = [
    ...baseSectionOrder.slice(0, _insertAt),
    ...unsortedCustomIds,
    ...baseSectionOrder.slice(_insertAt),
  ];

  const handleDragStart = (idx: number) => setDraggedIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === idx) return;
    const newOrder = [...sectionOrder];
    const [removed] = newOrder.splice(draggedIdx, 1);
    newOrder.splice(idx, 0, removed);
    setPageConfig((prev: any) => ({ ...prev, section_order: newOrder }));
    setDraggedIdx(idx);
  };
  const handleDragEnd = () => setDraggedIdx(null);

  const toggleSectionEnabled = (sectionKey: string) => {
    if (sectionKey === 'marquee') {
      updateConfig('marquee', 'enabled', !(pageConfig.marquee?.enabled !== false));
    } else if (sectionKey === 'trust_signals') {
      updateConfig('trust_signals', 'enabled', !(pageConfig.trust_signals?.enabled !== false));
    } else {
      // For header, hero, order_form, footer - add enabled toggle
      const current = pageConfig[sectionKey]?.enabled !== false;
      updateConfig(sectionKey, 'enabled', !current);
    }
  };

  const isSectionEnabled = (key: string) => {
    return pageConfig[key]?.enabled !== false;
  };

  const previewUrl = `/lp/${page.slug}${clickToEdit ? '?editor=1' : ''}`;

  return (
    <div>
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/landing-pages')}><ArrowLeft className="h-4 w-4" /></Button>
          <h1 className="text-2xl font-bold">{page.title}</h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.open(`/lp/${page.slug}`, '_blank')}>
          <Eye className="h-4 w-4 mr-1" /> প্রিভিউ
        </Button>
      </div>

      {/* Analytics Cards */}
      <LandingPageAnalytics pageId={id!} slug={pageSettings.slug} />

      <Tabs defaultValue="settings" className="space-y-4">
        <TabsList className="w-full justify-start flex-wrap h-auto gap-1">
          <TabsTrigger value="settings">⚙️ পেজ সেটিংস</TabsTrigger>
          
          <TabsTrigger value="visual">🖥️ ভিজ্যুয়াল এডিটর</TabsTrigger>
          <TabsTrigger value="products">📦 প্রোডাক্ট</TabsTrigger>
        </TabsList>

        {/* Tab 1: Page Settings */}
        <TabsContent value="settings">
          <Card>
            <CardHeader><CardTitle className="text-base">পেজ সেটিংস</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm mb-1 block">পেজ টাইটেল</Label>
                  <Input value={pageSettings.title} onChange={e => setPageSettings(p => ({ ...p, title: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-sm mb-1 block">Slug</Label>
                  <Input value={pageSettings.slug} onChange={e => setPageSettings(p => ({ ...p, slug: e.target.value }))} />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-sm">Meta Title</Label>
                    <AIGenerateButton
                      loading={aiLoading}
                      size="sm"
                      tooltip="AI দিয়ে SEO জেনারেট"
                      onClick={async () => {
                        const result = await generateAI('seo', `ল্যান্ডিং পেজ: ${pageSettings.title}`);
                        if (result) {
                          try {
                            const parsed = JSON.parse(result);
                            if (parsed.seo_title) setPageSettings(p => ({ ...p, meta_title: parsed.seo_title }));
                            if (parsed.seo_description) setPageSettings(p => ({ ...p, meta_description: parsed.seo_description }));
                          } catch { setPageSettings(p => ({ ...p, meta_description: result })); }
                        }
                      }}
                    />
                  </div>
                  <Input value={pageSettings.meta_title} onChange={e => setPageSettings(p => ({ ...p, meta_title: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label className="text-sm mb-1 block">Meta Description</Label>
                <Textarea value={pageSettings.meta_description} onChange={e => setPageSettings(p => ({ ...p, meta_description: e.target.value }))} rows={2} />
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={pageSettings.is_active} onCheckedChange={v => setPageSettings(p => ({ ...p, is_active: v }))} />
                <Label className="text-sm">{pageSettings.is_active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}</Label>
              </div>
              <div className="border-t border-border pt-4 mt-4">
                <Label className="text-xs mb-1 block font-semibold">🎨 গ্লোবাল কাস্টম CSS</Label>
                <CodeEditor value={pageConfig.global_css || ''} onChange={v => setPageConfig((prev: any) => ({ ...prev, global_css: v }))} rows={4} language="css" placeholder="body { ... }" />
                <p className="text-xs text-muted-foreground mt-1">এই CSS পুরো ল্যান্ডিং পেজে প্রয়োগ হবে</p>
              </div>
              <div className="flex gap-2 mt-4">
                <Button size="sm" onClick={() => updatePageSettings.mutate()} disabled={updatePageSettings.isPending}>
                  <Save className="h-3 w-3 mr-1" /> সেটিংস সেভ করুন
                </Button>
                <Button size="sm" variant="outline" onClick={() => updatePageConfig.mutate(pageConfig)} disabled={updatePageConfig.isPending}>
                  <Save className="h-3 w-3 mr-1" /> CSS সেভ করুন
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>


        {/* Tab 3: Visual Editor */}
        <TabsContent value="visual">
          <div className="border border-border rounded-xl overflow-hidden" style={{ height: 'calc(100vh - 200px)', minHeight: '500px' }}>
            <ResizablePanelGroup direction="horizontal">
              <ResizablePanel defaultSize={35} minSize={25} maxSize={50}>
                <div className="h-full flex flex-col bg-muted/30">
                  {/* Section list header */}
                  <div className="p-3 border-b border-border bg-background">
                    <h3 className="text-sm font-bold flex items-center gap-2">📐 সেকশন ম্যানেজার</h3>
                    <p className="text-xs text-muted-foreground mt-1">ড্র্যাগ করে ক্রম পরিবর্তন করুন • ক্লিক করে এডিট করুন</p>
                  </div>
                  
                  {/* Draggable section list */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {sectionOrder.map((key, idx) => {
                      const sec = VISUAL_SECTIONS.find(s => s.key === key);
                      // Check if it's a custom section
                      const customSec = !sec ? sections.find((s: any) => s.id === key) : null;
                      if (!sec && !customSec) return null;
                      
                      if (sec) {
                        const enabled = isSectionEnabled(key);
                        return (
                          <div
                            key={key}
                            draggable
                            onDragStart={() => handleDragStart(idx)}
                            onDragOver={(e) => handleDragOver(e, idx)}
                            onDragEnd={handleDragEnd}
                            className={`group flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition-all
                              ${enabled ? 'bg-background border-border hover:border-primary/40 hover:shadow-md' : 'bg-muted/50 border-dashed border-border/50 opacity-60'}
                              ${draggedIdx === idx ? 'scale-95 opacity-50' : ''}
                            `}
                            onClick={() => setEditingSection(key)}
                          >
                            <GripVertical className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground cursor-grab" />
                            <span className="text-lg">{sec.emoji}</span>
                            <span className="flex-1 text-sm font-medium">{sec.label}</span>
                            <Switch
                              checked={enabled}
                              onCheckedChange={() => { toggleSectionEnabled(key); }}
                              onClick={(e) => e.stopPropagation()}
                              className="scale-75"
                            />
                          </div>
                        );
                      }
                      
                      // Custom section
                      const baseTypeLabel = SECTION_TYPES.find(t => t.value === customSec.section_type)?.label || customSec.section_type;
                      const aiLabel = (customSec.ai_meta as any)?.label;
                      const userLabel = (customSec.content as any)?.section_label;
                      const displayLabel = aiLabel || userLabel || baseTypeLabel;
                      const isAi = !!aiLabel;
                      const typeEmoji = customSec.section_type === 'html' ? '🌐' : customSec.section_type === 'html_blog' ? (isAi ? '✨' : '📝') : customSec.section_type === 'faq' ? '❓' : customSec.section_type === 'testimonial' ? '⭐' : customSec.section_type === 'cta' ? '🔘' : customSec.section_type === 'gift_service' ? '🎁' : '📦';
                      return (
                        <div
                          key={customSec.id}
                          draggable
                          onDragStart={() => handleDragStart(idx)}
                          onDragOver={(e) => handleDragOver(e, idx)}
                          onDragEnd={handleDragEnd}
                          className={`group flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition-all
                            ${customSec.is_active ? 'bg-background border-border hover:border-primary/40 hover:shadow-md' : 'bg-muted/50 border-dashed border-border/50 opacity-60'}
                            ${draggedIdx === idx ? 'scale-95 opacity-50' : ''}
                          `}
                          onClick={() => setEditingSection(`custom_${customSec.id}`)}
                        >
                          <GripVertical className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground cursor-grab" />
                          <span className="text-lg">{typeEmoji}</span>
                          <span className="flex-1 min-w-0 text-sm font-medium truncate" title={displayLabel}>{displayLabel}</span>
                          <Switch
                            checked={customSec.is_active}
                            onCheckedChange={async (v) => {
                              await supabase.from('landing_page_sections').update({ is_active: v }).eq('id', customSec.id);
                              refetchSections();
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="scale-75"
                          />
                          <button onClick={(e) => { e.stopPropagation(); if (confirm('ডিলিট করবেন?')) deleteSection.mutate(customSec.id); }} className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                    
                    
                    {/* Add section button */}
                    <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => setAddSectionOpen(true)}>
                      <Plus className="h-3 w-3 mr-1" /> সেকশন যোগ করুন
                    </Button>
                  </div>
                  
                  {/* Save button */}
                  <div className="p-3 border-t border-border bg-background">
                    <Button onClick={handleVisualSave} disabled={updatePageConfig.isPending} className="w-full" size="sm">
                      <Save className="h-3.5 w-3.5 mr-1.5" /> সেভ ও রিফ্রেশ
                    </Button>
                  </div>
                </div>
              </ResizablePanel>
              
              <ResizableHandle withHandle />
              
              <ResizablePanel defaultSize={65}>
                <div className="h-full flex flex-col bg-muted/20">
                  {/* Preview toolbar */}
                  <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-background gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">লাইভ প্রিভিউ</span>
                      <label className="flex items-center gap-1.5 ml-2 cursor-pointer">
                        <Switch checked={clickToEdit} onCheckedChange={setClickToEdit} className="scale-75" />
                        <span className="text-xs font-medium">{clickToEdit ? '✏️ ক্লিক-টু-এডিট অন' : 'এডিট অফ'}</span>
                      </label>
                    </div>
                    <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
                      <button
                        onClick={() => setViewMode('desktop')}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${viewMode === 'desktop' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
                      >
                        <Monitor className="h-3.5 w-3.5" /> ডেস্কটপ
                      </button>
                      <button
                        onClick={() => setViewMode('mobile')}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${viewMode === 'mobile' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
                      >
                        <Smartphone className="h-3.5 w-3.5" /> মোবাইল
                      </button>
                    </div>
                  </div>
                  
                  {/* Preview iframe */}
                  <div className="flex-1 flex items-start justify-center p-4 overflow-auto">
                    <div
                      className="bg-white rounded-lg shadow-lg overflow-hidden transition-all duration-300 h-full"
                      style={{ width: viewMode === 'mobile' ? '390px' : '100%', maxWidth: '100%' }}
                    >
                      <iframe
                        ref={iframeRef}
                        src={previewUrl}
                        className="w-full h-full border-0"
                        title="Landing Page Preview"
                      />
                    </div>
                  </div>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
          
          {/* Section Edit Panel (right-side overlay) */}
          {editingSection && (
            <div className="fixed inset-y-0 right-0 z-50 w-full sm:max-w-md bg-background border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="text-base font-semibold flex items-center gap-2">
                  {editingSection?.startsWith('custom_') ? (() => {
                    const sectionId = editingSection.replace('custom_', '');
                    const sec = sections.find((s: any) => s.id === sectionId);
                    const aiLabel = (sec?.ai_meta as any)?.label;
                    const userLabel = (sec?.content as any)?.section_label;
                    const isAi = !!aiLabel;
                    const typeEmoji = sec?.section_type === 'html' ? '🌐' : sec?.section_type === 'html_blog' ? (isAi ? '✨' : '📝') : sec?.section_type === 'faq' ? '❓' : sec?.section_type === 'testimonial' ? '⭐' : sec?.section_type === 'cta' ? '🔘' : sec?.section_type === 'gift_service' ? '🎁' : '📦';
                    const baseLabel = SECTION_TYPES.find(t => t.value === sec?.section_type)?.label || sec?.section_type;
                    const displayLabel = aiLabel || userLabel || baseLabel;
                    return <><span className="text-lg">{typeEmoji}</span> {displayLabel} এডিট করুন</>;
                  })() : (
                    <><span className="text-lg">{VISUAL_SECTIONS.find(s => s.key === editingSection)?.emoji}</span> {VISUAL_SECTIONS.find(s => s.key === editingSection)?.label} এডিট করুন</>
                  )}
                </div>
                <button onClick={() => setEditingSection(null)} className="rounded-md h-8 w-8 inline-flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground" aria-label="বন্ধ করুন">
                  ✕
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {editingSection === 'marquee' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Switch checked={pageConfig.marquee?.enabled !== false} onCheckedChange={v => updateConfig('marquee', 'enabled', v)} />
                      <Label className="text-sm">{pageConfig.marquee?.enabled !== false ? 'চালু' : 'বন্ধ'}</Label>
                    </div>
                    <div>
                      <Label className="text-xs mb-1 block">মার্কি টেক্সট</Label>
                      <Textarea value={pageConfig.marquee?.text || ''} onChange={e => updateConfig('marquee', 'text', e.target.value)} rows={3} />
                    </div>
                    <div className="border-t pt-3">
                      <Label className="text-xs mb-1 block">🌐 কাস্টম HTML</Label>
                      <CodeEditor value={pageConfig.marquee?.custom_html || ''} onChange={v => updateConfig('marquee', 'custom_html', v)} rows={3} language="html" placeholder="<div>...</div>" />
                      <p className="text-xs text-muted-foreground mt-1">এই HTML মার্কির পরে দেখাবে</p>
                    </div>
                  </div>
                )}
                {editingSection === 'header' && (
                  <div className="space-y-3">
                    <div><Label className="text-xs mb-1 block">ব্র্যান্ড নাম</Label><Input value={pageConfig.header?.brand_name || ''} onChange={e => updateConfig('header', 'brand_name', e.target.value)} placeholder="খালি রাখলে মূল সাইটের নাম" /></div>
                    <div><Label className="text-xs mb-1 block">হেল্পলাইন</Label><Input value={pageConfig.header?.helpline || ''} onChange={e => updateConfig('header', 'helpline', e.target.value)} /></div>
                    <div><Label className="text-xs mb-1 block">CTA টেক্সট</Label><Input value={pageConfig.header?.cta_text || ''} onChange={e => updateConfig('header', 'cta_text', e.target.value)} /></div>
                    <div>
                     <Label className="text-xs mb-1 block">ব্র্যান্ড কালার</Label>
                      <ColorPickerWithRecent value={pageConfig.header?.brand_color || '#8C6A1A'} onChange={v => updateConfig('header', 'brand_color', v)} />
                    </div>

                    {/* Call / WhatsApp */}
                    <div className="border-t pt-3">
                      <p className="text-xs font-semibold text-muted-foreground mb-3">📞 কমিউনিকেশন বাটন</p>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between"><Label className="text-sm">কল বাটন</Label><Switch checked={pageConfig.header?.show_call_button !== false} onCheckedChange={v => updateConfig('header', 'show_call_button', v)} /></div>
                        <div className="flex items-center justify-between"><Label className="text-sm">হোয়াটসঅ্যাপ বাটন</Label><Switch checked={pageConfig.header?.show_whatsapp_button || false} onCheckedChange={v => updateConfig('header', 'show_whatsapp_button', v)} /></div>
                        {pageConfig.header?.show_whatsapp_button && (
                          <div><Label className="text-xs mb-1 block">হোয়াটসঅ্যাপ নম্বর</Label><Input value={pageConfig.header?.whatsapp_number || ''} onChange={e => updateConfig('header', 'whatsapp_number', e.target.value)} placeholder="01XXXXXXXXX" /></div>
                        )}
                        <div className="flex items-center justify-between"><Label className="text-sm">CTA বাটন</Label><Switch checked={pageConfig.header?.show_cta_button !== false} onCheckedChange={v => updateConfig('header', 'show_cta_button', v)} /></div>
                      </div>
                    </div>

                    {/* CTA Style */}
                    <div className="border-t pt-3">
                      <p className="text-xs font-semibold text-muted-foreground mb-3">🎨 CTA বাটন স্টাইল</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label className="text-xs mb-1 block">বাটন কালার</Label><ColorPickerWithRecent value={pageConfig.header?.cta_color || pageConfig.header?.brand_color || '#8C6A1A'} onChange={v => updateConfig('header', 'cta_color', v)} /></div>
                        <div><Label className="text-xs mb-1 block">টেক্সট কালার</Label><ColorPickerWithRecent value={pageConfig.header?.cta_text_color || '#ffffff'} onChange={v => updateConfig('header', 'cta_text_color', v)} /></div>
                      </div>
                    </div>

                    {/* Header Style */}
                    <div className="border-t pt-3">
                      <p className="text-xs font-semibold text-muted-foreground mb-3">🏗️ হেডার স্টাইল</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label className="text-xs mb-1 block">ব্যাকগ্রাউন্ড</Label><ColorPickerWithRecent value={pageConfig.header?.bg_color || '#ffffff'} onChange={v => updateConfig('header', 'bg_color', v)} /></div>
                        <div><Label className="text-xs mb-1 block">নাম কালার</Label><ColorPickerWithRecent value={pageConfig.header?.text_color || pageConfig.header?.brand_color || '#8C6A1A'} onChange={v => updateConfig('header', 'text_color', v)} /></div>
                      </div>
                      <div className="flex items-center justify-between mt-3"><Label className="text-sm">শ্যাডো</Label><Switch checked={pageConfig.header?.show_shadow !== false} onCheckedChange={v => updateConfig('header', 'show_shadow', v)} /></div>
                    </div>

                    <div className="border-t pt-3">
                      <Label className="text-xs mb-1 block">🖼️ লোগো</Label>
                      <div className="flex gap-2 mb-2">
                        <Button type="button" variant="outline" size="sm" disabled={logoUploading} onClick={() => logoInputRef.current?.click()}>
                          {logoUploading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />} আপলোড
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => setMediaCenterOpen(true)}>
                          <ImageIcon className="h-3 w-3 mr-1" /> মিডিয়া সেন্টার
                        </Button>
                      </div>
                      <Input value={pageConfig.header?.logo_url || ''} onChange={e => updateConfig('header', 'logo_url', e.target.value)} placeholder="https://..." />
                      <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleLogoUpload(e.target.files[0])} />
                      {pageConfig.header?.logo_url && <img src={pageConfig.header.logo_url} alt="Logo" className="mt-2 h-10 w-10 rounded-full object-cover border" />}
                    </div>
                    <div className="border-t pt-3">
                      <Label className="text-xs mb-1 block">🌐 কাস্টম HTML</Label>
                      <CodeEditor value={pageConfig.header?.custom_html || ''} onChange={v => updateConfig('header', 'custom_html', v)} rows={3} language="html" placeholder="<div>...</div>" />
                      <p className="text-xs text-muted-foreground mt-1">এই HTML হেডারের পরে দেখাবে</p>
                    </div>
                  </div>
                )}
                {editingSection === 'hero' && (
                  <div className="space-y-3">
                    <div><Label className="text-xs mb-1 block">CTA বাটন টেক্সট</Label><Input value={pageConfig.hero?.cta_text || ''} onChange={e => updateConfig('hero', 'cta_text', e.target.value)} /></div>
                    <div>
                     <Label className="text-xs mb-1 block">CTA বাটন কালার</Label>
                      <ColorPickerWithRecent value={pageConfig.hero?.cta_color || '#6B1E2B'} onChange={v => updateConfig('hero', 'cta_color', v)} />
                    </div>
                    <div>
                     <Label className="text-xs mb-1 block">ব্যাকগ্রাউন্ড কালার</Label>
                      <ColorPickerWithRecent value={pageConfig.hero?.bg_color || '#ffffff'} onChange={v => updateConfig('hero', 'bg_color', v)} />
                    </div>
                    <div className="border-t pt-3">
                      <Label className="text-xs mb-1 block">🎨 কাস্টম CSS</Label>
                      <CodeEditor value={pageConfig.hero?.custom_css || ''} onChange={v => updateConfig('hero', 'custom_css', v)} rows={3} language="css" placeholder=".hero-section { ... }" />
                    </div>
                    <div className="border-t pt-3">
                      <Label className="text-xs mb-1 block">🌐 কাস্টম HTML</Label>
                      <CodeEditor value={pageConfig.hero?.custom_html || ''} onChange={v => updateConfig('hero', 'custom_html', v)} rows={3} language="html" placeholder="<div>...</div>" />
                      <p className="text-xs text-muted-foreground mt-1">এই HTML সেকশনের পরে দেখাবে</p>
                    </div>
                  </div>
                )}
                {editingSection === 'order_form' && (
                  <div className="space-y-3">
                    <div><Label className="text-xs mb-1 block">হেডিং</Label><Input value={pageConfig.order_form?.heading || ''} onChange={e => updateConfig('order_form', 'heading', e.target.value)} /></div>
                    <div><Label className="text-xs mb-1 block">আইটেম লেবেল</Label><Input value={pageConfig.order_form?.item_label || ''} onChange={e => updateConfig('order_form', 'item_label', e.target.value)} placeholder="আইটেম" /></div>
                    <div><Label className="text-xs mb-1 block">সাবমিট বাটন টেক্সট</Label><Input value={pageConfig.order_form?.submit_text || ''} onChange={e => updateConfig('order_form', 'submit_text', e.target.value)} /></div>
                    <div>
                     <Label className="text-xs mb-1 block">সাবমিট বাটন কালার</Label>
                      <ColorPickerWithRecent value={pageConfig.order_form?.submit_color || '#8C6A1A'} onChange={v => updateConfig('order_form', 'submit_color', v)} />
                    </div>
                    <div>
                     <Label className="text-xs mb-1 block">ব্যাকগ্রাউন্ড কালার</Label>
                      <ColorPickerWithRecent value={pageConfig.order_form?.bg_color || '#ffffff'} onChange={v => updateConfig('order_form', 'bg_color', v)} />
                    </div>

                    {/* Advanced Styling */}
                    <div className="border-t pt-3">
                      <p className="text-xs font-semibold text-muted-foreground mb-3">🎨 হেডিং স্টাইল</p>
                      <div className="space-y-3">
                        <div><Label className="text-xs mb-1 block">হেডিং কালার</Label><ColorPickerWithRecent value={pageConfig.order_form?.heading_color || ''} onChange={v => updateConfig('order_form', 'heading_color', v)} /></div>
                        <div>
                          <Label className="text-xs mb-1 block">হেডিং সাইজ</Label>
                          <select value={pageConfig.order_form?.heading_size || 'md'} onChange={e => updateConfig('order_form', 'heading_size', e.target.value)} className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background">
                            <option value="sm">ছোট</option>
                            <option value="md">মাঝারি</option>
                            <option value="lg">বড়</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-3">
                      <p className="text-xs font-semibold text-muted-foreground mb-3">🏷️ লেবেল ও ইনপুট</p>
                      <div className="space-y-3">
                        <div><Label className="text-xs mb-1 block">লেবেল কালার</Label><ColorPickerWithRecent value={pageConfig.order_form?.label_color || ''} onChange={v => updateConfig('order_form', 'label_color', v)} /></div>
                        <div><Label className="text-xs mb-1 block">ইনপুট বর্ডার</Label><ColorPickerWithRecent value={pageConfig.order_form?.input_border_color || ''} onChange={v => updateConfig('order_form', 'input_border_color', v)} /></div>
                        <div><Label className="text-xs mb-1 block">ইনপুট ব্যাকগ্রাউন্ড</Label><ColorPickerWithRecent value={pageConfig.order_form?.input_bg_color || ''} onChange={v => updateConfig('order_form', 'input_bg_color', v)} /></div>
                      </div>
                    </div>

                    <div className="border-t pt-3">
                      <p className="text-xs font-semibold text-muted-foreground mb-3">💰 প্রাইস ও হাইলাইট</p>
                      <div className="space-y-3">
                        <div><Label className="text-xs mb-1 block">সর্বমোট কালার</Label><ColorPickerWithRecent value={pageConfig.order_form?.total_color || '#8C6A1A'} onChange={v => updateConfig('order_form', 'total_color', v)} /></div>
                        <div><Label className="text-xs mb-1 block">হাইলাইট কালার</Label><ColorPickerWithRecent value={pageConfig.order_form?.highlight_color || '#8C6A1A'} onChange={v => updateConfig('order_form', 'highlight_color', v)} /></div>
                      </div>
                    </div>

                    <div className="border-t pt-3">
                      <p className="text-xs font-semibold text-muted-foreground mb-3">🔘 বাটন স্টাইল</p>
                      <div className="space-y-3">
                        <div><Label className="text-xs mb-1 block">বাটন টেক্সট কালার</Label><ColorPickerWithRecent value={pageConfig.order_form?.submit_text_color || '#ffffff'} onChange={v => updateConfig('order_form', 'submit_text_color', v)} /></div>
                        <div className="flex items-center justify-between"><Label className="text-sm">গোলাকার বাটন</Label><Switch checked={pageConfig.order_form?.submit_rounded !== false} onCheckedChange={v => updateConfig('order_form', 'submit_rounded', v)} /></div>
                      </div>
                    </div>

                    <div className="border-t pt-3">
                      <p className="text-xs font-semibold text-muted-foreground mb-3">🃏 কার্ড স্টাইল</p>
                      <div className="space-y-3">
                        <div><Label className="text-xs mb-1 block">কার্ড বর্ডার কালার</Label><ColorPickerWithRecent value={pageConfig.order_form?.card_border_color || ''} onChange={v => updateConfig('order_form', 'card_border_color', v)} /></div>
                        <div className="flex items-center justify-between"><Label className="text-sm">কার্ড শ্যাডো</Label><Switch checked={pageConfig.order_form?.show_card_shadow !== false} onCheckedChange={v => updateConfig('order_form', 'show_card_shadow', v)} /></div>
                      </div>
                    </div>

                    <div className="border-t pt-3 space-y-2">
                      <div className="flex items-center justify-between"><Label className="text-sm">ইমেইল ফিল্ড</Label><Switch checked={pageConfig.order_form?.show_email || false} onCheckedChange={v => updateConfig('order_form', 'show_email', v)} /></div>
                      <div className="flex items-center justify-between"><Label className="text-sm">অর্ডার নোট</Label><Switch checked={pageConfig.order_form?.show_order_note || false} onCheckedChange={v => updateConfig('order_form', 'show_order_note', v)} /></div>
                      
                    </div>
                    <div className="border-t pt-3">
                      <Label className="text-xs mb-1 block">🎨 কাস্টম CSS</Label>
                      <CodeEditor value={pageConfig.order_form?.custom_css || ''} onChange={v => updateConfig('order_form', 'custom_css', v)} rows={3} language="css" placeholder="#order-form { ... }" />
                    </div>
                    <div className="border-t pt-3">
                      <Label className="text-xs mb-1 block">🌐 কাস্টম HTML</Label>
                      <CodeEditor value={pageConfig.order_form?.custom_html || ''} onChange={v => updateConfig('order_form', 'custom_html', v)} rows={3} language="html" placeholder="<div>...</div>" />
                      <p className="text-xs text-muted-foreground mt-1">এই HTML সেকশনের পরে দেখাবে</p>
                    </div>
                  </div>
                )}
                {editingSection === 'trust_signals' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Switch checked={pageConfig.trust_signals?.enabled !== false} onCheckedChange={v => updateConfig('trust_signals', 'enabled', v)} />
                      <Label className="text-sm">{pageConfig.trust_signals?.enabled !== false ? 'চালু' : 'বন্ধ'}</Label>
                    </div>
                    <div><Label className="text-xs mb-1 block">হেডিং</Label><Input value={pageConfig.trust_signals?.heading || ''} onChange={e => updateConfig('trust_signals', 'heading', e.target.value)} /></div>
                    <div>
                     <Label className="text-xs mb-1 block">ব্যাকগ্রাউন্ড কালার</Label>
                      <ColorPickerWithRecent value={pageConfig.trust_signals?.bg_color || '#ffffff'} onChange={v => updateConfig('trust_signals', 'bg_color', v)} />
                    </div>
                    <div className="border-t pt-3">
                      <Label className="text-xs mb-1 block">🎨 কাস্টম CSS</Label>
                      <CodeEditor value={pageConfig.trust_signals?.custom_css || ''} onChange={v => updateConfig('trust_signals', 'custom_css', v)} rows={3} language="css" />
                    </div>
                    <div className="border-t pt-3">
                      <Label className="text-xs mb-1 block">🌐 কাস্টম HTML</Label>
                      <CodeEditor value={pageConfig.trust_signals?.custom_html || ''} onChange={v => updateConfig('trust_signals', 'custom_html', v)} rows={3} language="html" placeholder="<div>...</div>" />
                      <p className="text-xs text-muted-foreground mt-1">এই HTML সেকশনের পরে দেখাবে</p>
                    </div>
                  </div>
                )}
                {editingSection === 'footer' && (
                  <div className="space-y-3">
                    <div><Label className="text-xs mb-1 block">ফুটার টেক্সট</Label><Textarea value={pageConfig.footer?.text || ''} onChange={e => updateConfig('footer', 'text', e.target.value)} rows={3} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                       <Label className="text-xs mb-1 block">ব্যাকগ্রাউন্ড</Label>
                        <ColorPickerWithRecent value={pageConfig.footer?.bg_color || '#333333'} onChange={v => updateConfig('footer', 'bg_color', v)} />
                      </div>
                      <div>
                        <Label className="text-xs mb-1 block">টেক্সট কালার</Label>
                        <ColorPickerWithRecent value={pageConfig.footer?.text_color || '#999999'} onChange={v => updateConfig('footer', 'text_color', v)} />
                      </div>
                    </div>
                    <div className="border-t pt-3">
                      <Label className="text-xs mb-1 block">🎨 কাস্টম CSS</Label>
                      <CodeEditor value={pageConfig.footer?.custom_css || ''} onChange={v => updateConfig('footer', 'custom_css', v)} rows={3} language="css" />
                    </div>
                    <div className="border-t pt-3">
                      <Label className="text-xs mb-1 block">🌐 কাস্টম HTML</Label>
                      <CodeEditor value={pageConfig.footer?.custom_html || ''} onChange={v => updateConfig('footer', 'custom_html', v)} rows={3} language="html" placeholder="<div>...</div>" />
                      <p className="text-xs text-muted-foreground mt-1">এই HTML ফুটারের পরে দেখাবে</p>
                    </div>
                  </div>
                )}
                {/* Custom section editing */}
                {editingSection && editingSection.startsWith('custom_') && (() => {
                  const sectionId = editingSection.replace('custom_', '');
                  const sec = sections.find((s: any) => s.id === sectionId);
                  if (!sec) return null;
                  return (
                    <div className="space-y-3">
                      <CustomSectionEditForm section={sec} onSave={async (content) => {
                        await updateSection.mutateAsync({ sectionId: sec.id, content });
                        setEditingSection(null);
                        setTimeout(refreshPreview, 500);
                      }} />
                    </div>
                  );
                })()}
                
                {/* Show general save button only for default sections */}
                {editingSection && !editingSection.startsWith('custom_') && (
                  <Button onClick={handleVisualSave} disabled={updatePageConfig.isPending} className="w-full">
                    <Save className="h-4 w-4 mr-1" /> সেভ ও প্রিভিউ রিফ্রেশ
                  </Button>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Tab 4: Products */}
        <TabsContent value="products">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">প্রোডাক্ট</h2>
              <Dialog open={addProductOpen} onOpenChange={(open) => { setAddProductOpen(open); if (!open) setProductSearch(''); }}>
                <Button size="sm" onClick={() => setAddProductOpen(true)}><Plus className="h-4 w-4 mr-1" /> প্রোডাক্ট যোগ</Button>
                <DialogContent className="max-w-sm">
                  <DialogHeader><DialogTitle>প্রোডাক্ট যোগ করুন</DialogTitle></DialogHeader>
                  <Input placeholder="প্রোডাক্ট খুঁজুন..." value={productSearch} onChange={e => setProductSearch(e.target.value)} className="mb-2" />
                  <div className="max-h-[300px] overflow-y-auto border border-input rounded-md divide-y divide-border">
                    {allProducts.length === 0 && <p className="text-sm text-muted-foreground p-3">কোনো প্রোডাক্ট নেই</p>}
                    {allProducts.filter((p: any) => {
                      if (!productSearch.trim()) return true;
                      const q = productSearch.toLowerCase();
                      return p.name?.toLowerCase().includes(q) || p.name_bn?.toLowerCase().includes(q);
                    }).map((p: any) => {
                      const hasSale = p.original_price && p.original_price < p.price;
                      const isSelected = selectedProductId === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setSelectedProductId(p.id)}
                          className={`w-full flex items-center gap-3 p-2 text-left hover:bg-muted/50 transition-colors ${isSelected ? 'bg-primary/10 ring-1 ring-primary' : ''}`}
                        >
                          <div className="w-10 h-10 rounded overflow-hidden bg-muted flex-shrink-0">
                            {p.images?.[0] ? <img src={p.images[0]} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-muted-foreground"><ImageIcon className="h-4 w-4" /></div>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{p.name_bn || p.name}</p>
                            <div className="flex items-center gap-1.5">
                              {hasSale ? (
                                <>
                                  <span className="text-xs font-bold text-green-600">৳{p.original_price}</span>
                                  <span className="text-xs text-muted-foreground line-through">৳{p.price}</span>
                                </>
                              ) : (
                                <span className="text-xs font-bold">৳{p.price}</span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <Button onClick={() => addProduct.mutate()} disabled={!selectedProductId || addProduct.isPending}>যোগ করুন</Button>
                </DialogContent>
              </Dialog>
            </div>
            <div className="space-y-3">
              {pageProducts.map((pp: any) => {
                const prod = pp.products;
                if (!prod) return null;
                const prodOverrides = pageConfig.order_form?.product_overrides || {};
                const override = prodOverrides[prod.id] || {};
                const allSizes: string[] = prod.sizes || [];
                const hiddenSizes: string[] = override.hidden_sizes || [];
                const cardStyle = override.card_style || 'compact';
                const colorSizes = (prod.variant_images as any)?.color_sizes as Record<string, string[]> | undefined;
                const hasColorSizes = colorSizes && Object.keys(colorSizes).length > 0;

                return (
                  <div key={pp.id} className="border border-border rounded-xl p-3 space-y-3">
                    {/* Product header */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-muted rounded overflow-hidden shrink-0">
                        {prod.images?.[0] && <img src={prod.images[0]} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{prod.name_bn || prod.name}</p>
                        {prod.original_price && prod.original_price < prod.price ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-green-600">৳{prod.original_price}</span>
                            <span className="text-xs text-muted-foreground line-through">৳{prod.price}</span>
                          </div>
                        ) : (
                          <span className="text-xs font-bold text-primary">৳{prod.price}</span>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeProduct.mutate(pp.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>

                    {/* Card style selector */}
                    <div>
                      <Label className="text-xs font-semibold mb-1.5 block">🃏 কার্ড স্টাইল</Label>
                      <div className="flex gap-2">
                        {(['compact', 'detailed'] as const).map(style => (
                          <button
                            key={style}
                            type="button"
                            onClick={() => {
                              const newOverrides = { ...prodOverrides, [prod.id]: { ...override, card_style: style } };
                              setPageConfig((prev: any) => ({ ...prev, order_form: { ...prev.order_form, product_overrides: newOverrides } }));
                            }}
                            className={cn(
                              'flex-1 text-xs font-medium py-2 px-3 rounded-lg border-2 transition-all',
                              cardStyle === style ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'
                            )}
                          >
                            {style === 'compact' ? '📋 কমপ্যাক্ট' : '📐 বিস্তারিত'}
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {cardStyle === 'compact' ? 'প্রতিটি কালার আলাদা কার্ড' : 'একটি কার্ডে সব কালার ও সাইজ'}
                      </p>
                    </div>

                    {/* Size hide options - color-grouped */}
                    {(hasColorSizes || allSizes.length > 0) && (
                      <div>
                        <Label className="text-xs font-semibold mb-1.5 block">👁️ সাইজ দৃশ্যমানতা</Label>
                        {hasColorSizes ? (
                          <div className="space-y-2">
                            {Object.entries(colorSizes!).map(([color, sizes]) => (
                              <div key={color}>
                                <p className="text-[10px] font-bold text-muted-foreground mb-1">{color}</p>
                                <div className="flex flex-wrap gap-1.5">
                                {(sizes as string[]).map(size => {
                                    const colorSizeKey = `${color}:${size}`;
                                    const isHidden = hiddenSizes.includes(colorSizeKey);
                                    return (
                                      <button
                                        key={`${color}-${size}`}
                                        type="button"
                                        onClick={() => {
                                          const newHidden = isHidden ? hiddenSizes.filter((s: string) => s !== colorSizeKey) : [...hiddenSizes, colorSizeKey];
                                          const newOverrides = { ...prodOverrides, [prod.id]: { ...override, hidden_sizes: newHidden } };
                                          setPageConfig((prev: any) => ({ ...prev, order_form: { ...prev.order_form, product_overrides: newOverrides } }));
                                        }}
                                        className={cn(
                                          'min-w-[36px] h-7 px-2 rounded-md border text-xs font-medium transition-all',
                                          isHidden ? 'border-destructive/40 bg-destructive/10 text-destructive line-through' : 'border-border bg-background text-foreground'
                                        )}
                                      >
                                        {size}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {allSizes.map(size => {
                              const isHidden = hiddenSizes.includes(size);
                              return (
                                <button
                                  key={size}
                                  type="button"
                                  onClick={() => {
                                    const newHidden = isHidden ? hiddenSizes.filter((s: string) => s !== size) : [...hiddenSizes, size];
                                    const newOverrides = { ...prodOverrides, [prod.id]: { ...override, hidden_sizes: newHidden } };
                                    setPageConfig((prev: any) => ({ ...prev, order_form: { ...prev.order_form, product_overrides: newOverrides } }));
                                  }}
                                  className={cn(
                                    'min-w-[36px] h-7 px-2 rounded-md border text-xs font-medium transition-all',
                                    isHidden ? 'border-destructive/40 bg-destructive/10 text-destructive line-through' : 'border-border bg-background text-foreground'
                                  )}
                                >
                                  {size}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1">ক্লিক করে সাইজ হাইড/দেখান করুন</p>
                      </div>
                    )}
                  </div>
                );
              })}
              {pageProducts.length === 0 && <p className="text-muted-foreground text-sm">কোনো প্রোডাক্ট নেই।</p>}

              {/* Save product overrides */}
              {pageProducts.length > 0 && (
                <Button size="sm" variant="outline" onClick={() => updatePageConfig.mutate(pageConfig)} disabled={updatePageConfig.isPending} className="w-full mt-2">
                  <Save className="h-3 w-3 mr-1" /> প্রোডাক্ট সেটিংস সেভ করুন
                </Button>
              )}
            </div>
          </div>
        </TabsContent>


      </Tabs>

      {/* MediaCenter for logo selection */}
      <MediaCenter
        open={mediaCenterOpen}
        onOpenChange={setMediaCenterOpen}
        onSelect={(urls) => { if (urls[0]) updateConfig('header', 'logo_url', urls[0]); }}
      />

      {/* MediaCenter for inline image replacement from preview iframe */}
      <MediaCenter
        open={imagePickerOpen}
        onOpenChange={(o) => { setImagePickerOpen(o); if (!o) pendingImageReq.current = null; }}
        onSelect={(urls) => {
          const url = urls[0];
          const req = pendingImageReq.current;
          if (url && req && iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage(
              { type: 'lp-edit-image-response', imgId: req.imgId, url },
              '*'
            );
          }
          setImagePickerOpen(false);
          pendingImageReq.current = null;
        }}
      />

      {/* Add Section Dialog */}
      <Dialog open={addSectionOpen} onOpenChange={setAddSectionOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>সেকশন টাইপ</DialogTitle></DialogHeader>
          <select value={newSectionType} onChange={e => setNewSectionType(e.target.value)} className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background">
            {SECTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <Button onClick={() => addSection.mutate()} disabled={addSection.isPending}>যোগ করুন</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ========== Config Section (Collapsible Card with Emoji) ========== */
function ConfigSection({ title, emoji, children, defaultOpen = false }: { title: string; emoji: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <Card className="border-border/60 hover:border-primary/30 transition-colors shadow-sm hover:shadow-md">
        <CollapsibleTrigger className="w-full">
          <CardHeader className="py-3 px-4 flex flex-row items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2.5">
              <span className="text-lg w-8 h-8 flex items-center justify-center rounded-lg bg-primary/10">{emoji}</span>
              <CardTitle className="text-sm font-semibold">{title}</CardTitle>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform" />
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-4">
            {children}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

/* ========== Section Editor with structured forms ========== */

function SectionEditor({ section, isFirst, isLast, onSave, onDelete, onMove }: {
  section: any; isFirst: boolean; isLast: boolean;
  onSave: (content: any) => void; onDelete: () => void; onMove: (dir: 'up' | 'down') => void;
}) {
  const [content, setContent] = useState<any>(section.content || {});
  const typeLabel = SECTION_TYPES.find(t => t.value === section.section_type)?.label || section.section_type;

  useEffect(() => { setContent(section.content || {}); }, [section.content]);

  const update = (key: string, value: any) => setContent((prev: any) => ({ ...prev, [key]: value }));

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded">{typeLabel}</span>
          </div>
          <div className="flex gap-1">
            {!isFirst && <Button variant="ghost" size="icon" onClick={() => onMove('up')}><ArrowUp className="h-3 w-3" /></Button>}
            {!isLast && <Button variant="ghost" size="icon" onClick={() => onMove('down')}><ArrowDown className="h-3 w-3" /></Button>}
            <Button variant="ghost" size="icon" className="text-destructive" onClick={onDelete}><Trash2 className="h-3 w-3" /></Button>
          </div>
        </div>

        {section.section_type === 'hero' && <HeroForm content={content} onChange={update} />}
        {section.section_type === 'faq' && <FaqForm content={content} setContent={setContent} />}
        {section.section_type === 'testimonial' && <TestimonialForm content={content} setContent={setContent} />}
        {section.section_type === 'cta' && <CtaForm content={content} onChange={update} />}
        {section.section_type === 'html' && <HtmlForm content={content} onChange={update} />}
        {section.section_type === 'html_blog' && <HtmlBlogForm content={content} onChange={update} onSave={() => onSave(content)} />}
        {section.section_type === 'product' && <ProductSectionForm content={content} onChange={update} />}
        {section.section_type === 'gift_service' && <GiftServiceForm content={content} onChange={update} />}

        <Button size="sm" className="mt-3" onClick={() => onSave(content)}>
          <Save className="h-3 w-3 mr-1" /> সেভ
        </Button>
      </CardContent>
    </Card>
  );
}

/* --- Hero Form --- */
function HeroForm({ content, onChange }: { content: any; onChange: (k: string, v: any) => void }) {
  return (
    <div className="space-y-3">
      <div><Label className="text-xs mb-1 block">টাইটেল</Label><Input value={content.title || ''} onChange={e => onChange('title', e.target.value)} placeholder="হিরো টাইটেল" /></div>
      <div><Label className="text-xs mb-1 block">সাবটাইটেল</Label><Input value={content.subtitle || ''} onChange={e => onChange('subtitle', e.target.value)} placeholder="সাবটাইটেল" /></div>
      <div><Label className="text-xs mb-1 block">ইমেজ URL</Label><Input value={content.image_url || ''} onChange={e => onChange('image_url', e.target.value)} placeholder="https://..." /></div>
      <div><Label className="text-xs mb-1 block">ব্যাকগ্রাউন্ড কালার</Label><Input value={content.bg_color || ''} onChange={e => onChange('bg_color', e.target.value)} placeholder="#f0f0f0" /></div>
    </div>
  );
}

/* --- FAQ Form --- */
function FaqForm({ content, setContent }: { content: any; setContent: (c: any) => void }) {
  const items: { q: string; a: string }[] = content.items || [];
  const updateItem = (idx: number, field: 'q' | 'a', value: string) => {
    const updated = items.map((item, i) => i === idx ? { ...item, [field]: value } : item);
    setContent({ ...content, items: updated });
  };
  const addItem = () => setContent({ ...content, items: [...items, { q: '', a: '' }] });
  const removeItem = (idx: number) => setContent({ ...content, items: items.filter((_, i) => i !== idx) });
  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <div key={idx} className="border border-border rounded-lg p-3 space-y-2 relative">
          <button type="button" onClick={() => removeItem(idx)} className="absolute top-2 right-2 text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
          <div><Label className="text-xs mb-1 block">প্রশ্ন {idx + 1}</Label><Input value={item.q} onChange={e => updateItem(idx, 'q', e.target.value)} placeholder="প্রশ্ন লিখুন" /></div>
          <div><Label className="text-xs mb-1 block">উত্তর</Label><Textarea value={item.a} onChange={e => updateItem(idx, 'a', e.target.value)} placeholder="উত্তর লিখুন" rows={2} /></div>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addItem}><Plus className="h-3 w-3 mr-1" /> প্রশ্ন যোগ করুন</Button>
    </div>
  );
}

/* --- Testimonial Form --- */
function TestimonialForm({ content, setContent }: { content: any; setContent: (c: any) => void }) {
  const source = content.source || 'manual';
  const items: { name: string; text: string; rating?: number }[] = content.items || [];
  const updateItem = (idx: number, field: string, value: any) => {
    const updated = items.map((item, i) => i === idx ? { ...item, [field]: value } : item);
    setContent({ ...content, items: updated });
  };
  const addItem = () => setContent({ ...content, items: [...items, { name: '', text: '', rating: 5 }] });
  const removeItem = (idx: number) => setContent({ ...content, items: items.filter((_, i) => i !== idx) });
  return (
    <div className="space-y-4">
      {/* Source selector */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">রিভিউ সোর্স</Label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setContent({ ...content, source: 'homepage' })}
            className={cn(
              'flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors',
              source === 'homepage' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/50'
            )}
          >
            🏠 হোমপেজ রিভিউ
          </button>
          <button
            type="button"
            onClick={() => setContent({ ...content, source: 'manual' })}
            className={cn(
              'flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors',
              source === 'manual' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/50'
            )}
          >
            ✏️ ম্যানুয়াল রিভিউ
          </button>
        </div>
        {source === 'homepage' && (
          <p className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
            হোমপেজের সব রিভিউ (ম্যানুয়াল + অ্যাপ্রুভড কাস্টমার রিভিউ) অটোমেটিক্যালি দেখাবে। ছবি, স্টার রেটিং ও Verified ব্যাজ সহ।
          </p>
        )}
      </div>

      {/* Manual items form - only show if source is manual */}
      {source === 'manual' && (
        <div className="space-y-3">
          {items.map((item, idx) => (
            <div key={idx} className="border border-border rounded-lg p-3 space-y-2 relative">
              <button type="button" onClick={() => removeItem(idx)} className="absolute top-2 right-2 text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
              <div><Label className="text-xs mb-1 block">কাস্টমারের নাম</Label><Input value={item.name} onChange={e => updateItem(idx, 'name', e.target.value)} placeholder="নাম" /></div>
              <div><Label className="text-xs mb-1 block">রিভিউ</Label><Textarea value={item.text} onChange={e => updateItem(idx, 'text', e.target.value)} placeholder="রিভিউ লিখুন" rows={2} /></div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addItem}><Plus className="h-3 w-3 mr-1" /> রিভিউ যোগ করুন</Button>
        </div>
      )}
    </div>
  );
}

/* --- CTA Form --- */
function CtaForm({ content, onChange }: { content: any; onChange: (k: string, v: any) => void }) {
  return (
    <div className="space-y-3">
      <div><Label className="text-xs mb-1 block">বাটন টেক্সট</Label><Input value={content.text || ''} onChange={e => onChange('text', e.target.value)} placeholder="এখনই অর্ডার করুন" /></div>
      <div><Label className="text-xs mb-1 block">ব্যাকগ্রাউন্ড কালার</Label><Input value={content.bg_color || ''} onChange={e => onChange('bg_color', e.target.value)} placeholder="#8C6A1A" /></div>
    </div>
  );
}

/* --- HTML Form --- */
function HtmlForm({ content, onChange }: { content: any; onChange: (k: string, v: any) => void }) {
  return (
    <div>
      <Label className="text-xs mb-1 block">HTML কোড + লাইভ প্রিভিউ</Label>
      <CodeEditorWithPreview
        htmlValue={content.html || ''}
        onHtmlChange={v => onChange('html', v)}
        height={350}
        htmlPlaceholder="<div>...</div>"
      />
    </div>
  );
}

/* --- HTML Blog Form (Full-Screen Editor) --- */
function HtmlBlogForm({ content, onChange, onSave }: { content: any; onChange: (k: string, v: any) => void; onSave?: () => void }) {
  const [editorOpen, setEditorOpen] = useState(true);
  const navigate = useNavigate();
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">📝</span>
        <div className="flex-1">
          <p className="text-sm font-medium">HTML Blog এডিটর</p>
          <p className="text-xs text-muted-foreground">HTML + CSS সহ ফুল-স্ক্রিন কোড এডিটর ও লাইভ প্রিভিউ</p>
        </div>
      </div>
      <div>
        <Label className="text-xs mb-1 block">সেকশনের নাম (অপশনাল)</Label>
        <Input
          value={content.section_label || ''}
          onChange={e => onChange('section_label', e.target.value)}
          placeholder="যেমন: হিরো ব্যানার, কেন কিনবেন, রিভিউ..."
        />
        <p className="text-[10px] text-muted-foreground mt-1">সেকশন ম্যানেজার লিস্টে এই নাম দেখাবে</p>
      </div>
      {(content.html || content.css) && (
        <div className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
          HTML: {(content.html || '').length} অক্ষর • CSS: {(content.css || '').length} অক্ষর
        </div>
      )}
      <Button variant="outline" className="w-full" onClick={() => setEditorOpen(true)}>
        ফুল এডিটরে খুলুন
      </Button>
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="w-screen h-screen max-w-none max-h-none rounded-none p-0 gap-0 border-0 [&>button.absolute]:hidden">
          <DialogTitle className="sr-only">HTML Blog এডিটর</DialogTitle>
          <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0">
                <CodeEditorWithPreview
                htmlValue={content.html || ''}
                onHtmlChange={v => onChange('html', v)}
                cssValue={content.css || ''}
                onCssChange={v => onChange('css', v)}
                height="fill"
                htmlRows={30}
                cssRows={10}
                htmlPlaceholder="<article>\n  <h1>ব্লগ টাইটেল</h1>\n  <p>আপনার কনটেন্ট এখানে...</p>\n</article>"
                cssPlaceholder=".my-blog { padding: 20px; }\n.my-blog h1 { color: #333; }"
                onSave={() => { onSave?.(); setEditorOpen(false); }}
                onBack={() => setEditorOpen(false)}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* --- Product Section Form --- */
function ProductSectionForm({ content, onChange }: { content: any; onChange: (k: string, v: any) => void }) {
  return (
    <div><Label className="text-xs mb-1 block">হেডিং</Label><Input value={content.heading || ''} onChange={e => onChange('heading', e.target.value)} placeholder="আমাদের পণ্য" /></div>
  );
}

/* --- Gift Service Form --- */
function GiftServiceForm({ content, onChange }: { content: any; onChange: (k: string, v: any) => void }) {
  const [mediaOpen, setMediaOpen] = useState(false);
  const images: string[] = content.sample_images || [];
  const addImageByUrl = () => {
    const url = prompt('ইমেজ URL দিন:');
    if (url?.trim()) onChange('sample_images', [...images, url.trim()]);
  };
  const removeImage = (idx: number) => onChange('sample_images', images.filter((_: string, i: number) => i !== idx));
  const handleMediaSelect = (urls: string[]) => {
    onChange('sample_images', [...images, ...urls]);
  };

  return (
    <div className="space-y-3">
      <div><Label className="text-xs mb-1 block">হেডিং</Label><Input value={content.heading || ''} onChange={e => onChange('heading', e.target.value)} placeholder="প্রিয়জনকে সারপ্রাইজ দিন! 🎁" /></div>
      <div><Label className="text-xs mb-1 block">বর্ণনা</Label><Textarea value={content.description || ''} onChange={e => onChange('description', e.target.value)} placeholder="আপনি যদি চান আপনার প্রিয় মানুষকে উপহার দিতে..." rows={3} /></div>
      <div><Label className="text-xs mb-1 block">স্যাম্পল নোট</Label><Textarea value={content.sample_note || ''} onChange={e => onChange('sample_note', e.target.value)} placeholder="তোমার জন্য ছোট্ট একটা সারপ্রাইজ!" rows={2} /></div>
      <div><Label className="text-xs mb-1 block">প্রেরকের নাম</Label><Input value={content.sample_sender || ''} onChange={e => onChange('sample_sender', e.target.value)} placeholder="তোমার আপনজন" /></div>
      <div><Label className="text-xs mb-1 block">CTA বাটন টেক্সট</Label><Input value={content.cta_text || ''} onChange={e => onChange('cta_text', e.target.value)} placeholder="এখনই অর্ডার করুন" /></div>
      <div><Label className="text-xs mb-1 block">অ্যাকসেন্ট কালার</Label><ColorPickerWithRecent value={content.accent_color || '#e91e63'} onChange={v => onChange('accent_color', v)} /></div>

      {/* Sample Images */}
      <div className="border-t border-border pt-3">
        <Label className="text-xs mb-2 block font-semibold">স্যাম্পল ইমেজ (মেমো ছবি)</Label>
        {images.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-2">
            {images.map((url: string, i: number) => (
              <div key={i} className="relative group rounded-lg overflow-hidden border">
                <img src={url} alt="" className="w-full aspect-square object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                >×</button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setMediaOpen(true)}>
            <ImageIcon className="h-3.5 w-3.5 mr-1" />মিডিয়া থেকে বাছাই
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={addImageByUrl}>URL দিয়ে যোগ</Button>
        </div>
        <MediaCenter open={mediaOpen} onOpenChange={setMediaOpen} onSelect={handleMediaSelect} multiple />
      </div>

      <div><Label className="text-xs mb-1 block">ইমেজ ক্যাপশন</Label><Input value={content.image_caption || ''} onChange={e => onChange('image_caption', e.target.value)} placeholder="মেমোতে গিফট নোট দেখতে এমন হবে ✨" /></div>
    </div>
  );
}

/* ========== Custom Section Edit Form for Visual Editor ========== */
function CustomSectionEditForm({ section, onSave }: { section: any; onSave: (content: any) => void }) {
  const [content, setContent] = useState<any>(section.content || {});
  const update = (key: string, value: any) => setContent((prev: any) => ({ ...prev, [key]: value }));

  useEffect(() => { setContent(section.content || {}); }, [section.content]);

  return (
    <>
      {section.section_type === 'html' && <HtmlForm content={content} onChange={update} />}
      {section.section_type === 'html_blog' && <HtmlBlogForm content={content} onChange={update} onSave={() => onSave(content)} />}
      {section.section_type === 'faq' && <FaqForm content={content} setContent={setContent} />}
      {section.section_type === 'testimonial' && <TestimonialForm content={content} setContent={setContent} />}
      {section.section_type === 'cta' && <CtaForm content={content} onChange={update} />}
      {section.section_type === 'hero' && <HeroForm content={content} onChange={update} />}
      {section.section_type === 'product' && <ProductSectionForm content={content} onChange={update} />}
      {section.section_type === 'gift_service' && <GiftServiceForm content={content} onChange={update} />}

      {/* Background Color & Custom CSS */}
      <div className="border-t border-border pt-3 mt-3 space-y-3">
        <div>
          <Label className="text-xs mb-1 block">🎨 ব্যাকগ্রাউন্ড কালার</Label>
          <ColorPickerWithRecent value={content.bg_color || '#ffffff'} onChange={v => update('bg_color', v)} />
        </div>
        <div>
          <Label className="text-xs mb-1 block">🎨 কাস্টম CSS</Label>
          <CodeEditor value={content.custom_css || ''} onChange={v => update('custom_css', v)} rows={3} language="css" placeholder=".my-section { ... }" />
          <p className="text-xs text-muted-foreground mt-1">এই CSS শুধু এই সেকশনে প্রয়োগ হবে</p>
        </div>
        <div>
          <Label className="text-xs mb-1 block">🌐 কাস্টম HTML</Label>
          <CodeEditor value={content.custom_html || ''} onChange={v => update('custom_html', v)} rows={3} language="html" placeholder="<div>...</div>" />
          <p className="text-xs text-muted-foreground mt-1">এই HTML সেকশনের পরে দেখাবে</p>
        </div>
      </div>

      <Button onClick={() => onSave(content)} className="w-full mt-3">
        <Save className="h-4 w-4 mr-1" /> সেভ ও রিফ্রেশ
      </Button>
    </>
  );
}
