import { useState, useRef, useCallback, lazy, Suspense, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { toast } from 'sonner';
import { ArrowLeft, Save, Monitor, Smartphone, ChevronDown, ChevronUp, GripVertical, Plus, Trash2, Star, Loader2, X, ImageIcon, Settings2, Code, Link as LinkIcon, Package, Search, Camera, Sparkles, Zap } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSiteConfig, useSaveSiteConfig, DEFAULT_HOMEPAGE_CONFIG, DEFAULT_NAVBAR_CONFIG, DEFAULT_FOOTER_CONFIG } from '@/hooks/useSiteConfig';
import MediaCenter from '@/components/admin/MediaCenter';
import ColorPickerWithRecent from '@/components/admin/ColorPickerWithRecent';
import CodeEditor from '@/components/admin/CodeEditor';
import CodeEditorWithPreview from '@/components/admin/CodeEditorWithPreview';
import { useCategories } from '@/hooks/useCategories';
import { useProducts } from '@/hooks/useProducts';
import { supabase } from '@/integrations/supabase/client';

import ButtonManagement from '@/components/admin/ButtonManagement';

type PageType = 'homepage' | 'navbar' | 'footer' | 'pages' | 'buttons' | 'welcome_island';

const PAGE_LIST = [
  { key: 'homepage' as PageType, label: 'হোমপেজ', icon: '🏠', configKey: 'homepage_config' },
  { key: 'navbar' as PageType, label: 'নেভবার', icon: '📌', configKey: 'navbar_config' },
  { key: 'footer' as PageType, label: 'ফুটার', icon: '📄', configKey: 'footer_config' },
  { key: 'pages' as PageType, label: 'পেজ ম্যানেজার', icon: '📑', configKey: 'pages_config' },
  { key: 'buttons' as PageType, label: 'বাটন ম্যানেজমেন্ট', icon: '🔘', configKey: 'buttons_config' },
  { key: 'welcome_island' as PageType, label: 'ওয়েলকাম আইল্যান্ড', icon: '✨', configKey: 'welcome_island_config' },
];

const HOMEPAGE_SECTIONS = [
  { key: 'hero', label: 'হিরো সেকশন', emoji: '🖼️' },
  { key: 'categories', label: 'ক্যাটেগরি', emoji: '📂' },
  { key: 'stock_clearance', label: 'স্টক ক্লিয়ারেন্স সেল', emoji: '🏷️' },
  { key: 'trending', label: 'Trending এখন', emoji: '⚡' },
  { key: 'best_selling', label: 'বেস্ট সেলিং', emoji: '🔥' },
  { key: 'new_products', label: 'নতুন পণ্য', emoji: '🆕' },
  { key: 'all_products', label: 'সব পণ্য', emoji: '🛍️' },
  
];

export default function AdminSiteEditor() {
  const navigate = useNavigate();
  const [selectedPage, setSelectedPage] = useState<PageType | null>(null);

  if (!selectedPage) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-2xl font-bold">সাইট এডিটর</h1>
        </div>
        <p className="text-muted-foreground mb-6">আপনার ওয়েবসাইটের যেকোনো পেজ এডিট করুন</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PAGE_LIST.map(p => (
            <button
              key={p.key}
              onClick={() => setSelectedPage(p.key)}
              className="border border-border rounded-xl p-6 text-left hover:border-primary hover:shadow-md transition-all bg-card"
            >
              <span className="text-3xl mb-3 block">{p.icon}</span>
              <h3 className="font-bold text-lg">{p.label}</h3>
              <p className="text-sm text-muted-foreground mt-1">এডিট করুন →</p>
            </button>
          ))}
          {[
            { to: '/admin/site-editor/branding', icon: '🖼️', label: 'লোগো ও SEO' },
            { to: '/admin/site-editor/theme', icon: '🎨', label: 'থিম কালার' },
            { to: '/admin/site-editor/checkout', icon: '🛒', label: 'চেকআউট ফিল্ড ও শিপিং' },
            { to: '/admin/site-editor/invoice', icon: '🧾', label: 'ইনভয়েস / ডেলিভারি মেমো' },
            { to: '/admin/site-editor/store-info', icon: '🏪', label: 'স্টোর তথ্য' },
          ].map(item => (
            <button
              key={item.to}
              onClick={() => navigate(item.to)}
              className="border border-border rounded-xl p-6 text-left hover:border-primary hover:shadow-md transition-all bg-card"
            >
              <span className="text-3xl mb-3 block">{item.icon}</span>
              <h3 className="font-bold text-lg">{item.label}</h3>
              <p className="text-sm text-muted-foreground mt-1">এডিট করুন →</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (selectedPage === 'pages') {
    const PagesManager = lazy(() => import('@/components/admin/PagesManager'));
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => setSelectedPage(null)}><ArrowLeft className="h-4 w-4" /></Button>
          <h1 className="text-2xl font-bold">📑 পেজ ম্যানেজার</h1>
        </div>
        <Suspense fallback={<div className="flex items-center justify-center min-h-[200px]"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
          <PagesManager />
        </Suspense>
      </div>
    );
  }

  if (selectedPage === 'buttons') {
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => setSelectedPage(null)}><ArrowLeft className="h-4 w-4" /></Button>
          <h1 className="text-2xl font-bold">🔘 বাটন ম্যানেজমেন্ট</h1>
        </div>
        <ButtonManagement />
      </div>
    );
  }

  if (selectedPage === 'welcome_island') {
    const WelcomeIslandEditor = lazy(() => import('@/components/admin/WelcomeIslandEditor'));
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => setSelectedPage(null)}><ArrowLeft className="h-4 w-4" /></Button>
          <h1 className="text-2xl font-bold">✨ ওয়েলকাম আইল্যান্ড</h1>
        </div>
        <Suspense fallback={<div className="flex items-center justify-center min-h-[200px]"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
          <WelcomeIslandEditor />
        </Suspense>
      </div>
    );
  }


  return <SitePageEditor pageType={selectedPage} onBack={() => setSelectedPage(null)} />;
}

function SitePageEditor({ pageType, onBack }: { pageType: PageType; onBack: () => void }) {
  const pageInfo = PAGE_LIST.find(p => p.key === pageType)!;
  const { data: savedConfig, isLoading } = useSiteConfig(pageInfo.configKey);
  const saveMutation = useSaveSiteConfig();
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const getDefault = () => {
    if (pageType === 'homepage') return DEFAULT_HOMEPAGE_CONFIG;
    if (pageType === 'navbar') return DEFAULT_NAVBAR_CONFIG;
    return DEFAULT_FOOTER_CONFIG;
  };

  const [config, setConfig] = useState<any>(null);

  // Initialize config when data loads
  if (config === null && !isLoading) {
    const def = getDefault();
    if (savedConfig) {
      // Deep merge saved with defaults
      if (pageType === 'homepage') {
        const merged: any = {};
        for (const key of Object.keys(def)) {
          if (typeof (def as any)[key] === 'object' && !Array.isArray((def as any)[key])) {
            merged[key] = { ...(def as any)[key], ...savedConfig[key] };
          } else {
            merged[key] = savedConfig[key] ?? (def as any)[key];
          }
        }
        // Preserve items arrays
        if (savedConfig.testimonials?.items) merged.testimonials.items = savedConfig.testimonials.items;
        if (savedConfig.section_order) {
          const order = [...savedConfig.section_order];
          if (!order.includes('stock_clearance')) {
            const idx = order.indexOf('best_selling');
            if (idx >= 0) order.splice(idx, 0, 'stock_clearance');
            else order.push('stock_clearance');
          }
          if (!order.includes('trending')) {
            const idx = order.indexOf('stock_clearance');
            if (idx >= 0) order.splice(idx + 1, 0, 'trending');
            else {
              const bs = order.indexOf('best_selling');
              if (bs >= 0) order.splice(bs, 0, 'trending');
              else order.push('trending');
            }
          }
          merged.section_order = order;
        }
        // Preserve html_block_*, page_block_*, and product_block_* keys from saved config
        for (const key of Object.keys(savedConfig)) {
          if (key.startsWith('html_block_') || key.startsWith('page_block_') || key.startsWith('product_block_')) {
            merged[key] = savedConfig[key];
          }
        }
        setConfig(merged);
      } else {
        setConfig({ ...def, ...savedConfig });
      }
    } else {
      setConfig(def);
    }
  }

  const updateField = (section: string, key: string, value: any) => {
    setConfig((prev: any) => ({ ...prev, [section]: { ...prev[section], [key]: value } }));
  };

  const updateTopLevel = (key: string, value: any) => {
    setConfig((prev: any) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    try {
      await saveMutation.mutateAsync({ key: pageInfo.configKey, value: config });
      toast.success('সেভ হয়েছে!');
      setTimeout(() => {
        if (iframeRef.current) iframeRef.current.src = iframeRef.current.src;
      }, 500);
    } catch {
      toast.error('সেভ করতে সমস্যা হয়েছে');
    }
  };

  if (isLoading || config === null) {
    return <div className="flex items-center justify-center min-h-[400px] text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mr-2" /> লোড হচ্ছে...</div>;
  }

  const previewUrl = pageType === 'homepage' ? '/' : '/';

  return (
    <div className="h-[calc(100vh-6rem)]">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
          <h1 className="text-xl font-bold">{pageInfo.icon} {pageInfo.label} এডিটর</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border border-border rounded-lg overflow-hidden">
            <button onClick={() => setViewMode('desktop')} className={`p-2 ${viewMode === 'desktop' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
              <Monitor className="h-4 w-4" />
            </button>
            <button onClick={() => setViewMode('mobile')} className={`p-2 ${viewMode === 'mobile' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
              <Smartphone className="h-4 w-4" />
            </button>
          </div>
          <Button onClick={handleSave} disabled={saveMutation.isPending} className="gap-2">
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            সেভ করুন
          </Button>
        </div>
      </div>

      <ResizablePanelGroup direction="horizontal" className="rounded-lg border border-border h-full">
        {/* Left: Section Manager */}
        <ResizablePanel defaultSize={35} minSize={25} maxSize={50}>
          <ScrollArea className="h-full p-4">
            {pageType === 'homepage' && (
              <HomepageEditor config={config} updateField={updateField} updateTopLevel={updateTopLevel} editingSection={editingSection} setEditingSection={setEditingSection} />
            )}
            {pageType === 'navbar' && (
              <NavbarEditor config={config} updateTopLevel={updateTopLevel} />
            )}
            {pageType === 'footer' && (
              <FooterEditor config={config} updateTopLevel={updateTopLevel} />
            )}
          </ScrollArea>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right: Live Preview */}
        <ResizablePanel defaultSize={65}>
          <div className="h-full bg-muted/30 flex items-center justify-center p-4">
            <div className={`bg-background border border-border rounded-lg overflow-hidden shadow-lg h-full ${viewMode === 'mobile' ? 'w-[390px]' : 'w-full'}`}>
              <iframe
                ref={iframeRef}
                src={previewUrl}
                className="w-full h-full border-0"
                title="Preview"
              />
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

/* ========== HOMEPAGE EDITOR ========== */
function HomepageEditor({ config, updateField, updateTopLevel, editingSection, setEditingSection }: any) {
  const sectionOrder: string[] = config.section_order || DEFAULT_HOMEPAGE_CONFIG.section_order;

  const toggleSection = (key: string) => {
    updateField(key, 'enabled', !(config[key]?.enabled !== false));
  };

  const moveSection = (idx: number, direction: 'up' | 'down') => {
    const newOrder = [...sectionOrder];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= newOrder.length) return;
    [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
    updateTopLevel('section_order', newOrder);
  };

  const addHtmlBlock = () => {
    const blockKey = `html_block_${Date.now()}`;
    const newOrder = [...sectionOrder, blockKey];
    // Use a function updater to set both at once
    updateTopLevel('section_order', newOrder);
    updateField(blockKey, 'enabled', true);
    updateField(blockKey, 'label', 'কাস্টম ব্লক');
    updateField(blockKey, 'html', '');
    updateField(blockKey, 'custom_css', '');
    updateField(blockKey, 'bg_color', '');
    setEditingSection(blockKey);
  };

  const deleteHtmlBlock = (key: string) => {
    const newOrder = sectionOrder.filter((s: string) => s !== key);
    updateTopLevel('section_order', newOrder);
    updateTopLevel(key, undefined);
    if (editingSection === key) setEditingSection(null);
  };

  const addPageBlock = () => {
    const blockKey = `page_block_${Date.now()}`;
    const newOrder = [...sectionOrder, blockKey];
    updateTopLevel('section_order', newOrder);
    updateField(blockKey, 'enabled', true);
    updateField(blockKey, 'label', 'পেজ ব্লক');
    updateField(blockKey, 'page_id', '');
    setEditingSection(blockKey);
  };

  const getSectionInfo = (sKey: string) => {
    const builtin = HOMEPAGE_SECTIONS.find(s => s.key === sKey);
    if (builtin) return { label: builtin.label, emoji: builtin.emoji, isHtmlBlock: false, isPageBlock: false, isProductBlock: false };
    if (sKey.startsWith('html_block_')) {
      return { label: config[sKey]?.label || 'কাস্টম HTML ব্লক', emoji: '🧩', isHtmlBlock: true, isPageBlock: false, isProductBlock: false };
    }
    if (sKey.startsWith('page_block_')) {
      return { label: config[sKey]?.label || 'পেজ ব্লক', emoji: '📑', isHtmlBlock: false, isPageBlock: true, isProductBlock: false };
    }
    if (sKey.startsWith('product_block_')) {
      return { label: config[sKey]?.label || 'প্রোডাক্ট ব্লক', emoji: '📦', isHtmlBlock: false, isPageBlock: false, isProductBlock: true };
    }
    return null;
  };

  const addProductBlock = () => {
    const blockKey = `product_block_${Date.now()}`;
    const newOrder = [...sectionOrder, blockKey];
    updateTopLevel('section_order', newOrder);
    updateField(blockKey, 'enabled', true);
    updateField(blockKey, 'label', 'প্রোডাক্ট ব্লক');
    updateField(blockKey, 'heading', 'বিশেষ কালেকশন');
    updateField(blockKey, 'subheading', '');
    updateField(blockKey, 'limit', 8);
    updateField(blockKey, 'source_type', 'category');
    updateField(blockKey, 'category_id', '');
    updateField(blockKey, 'product_ids', []);
    updateField(blockKey, 'bg_color', '');
    updateField(blockKey, 'custom_css', '');
    updateField(blockKey, 'custom_html_before', '');
    updateField(blockKey, 'custom_html_after', '');
    setEditingSection(blockKey);
  };

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground mb-4">সেকশনগুলো চালু/বন্ধ করুন, সরান ও এডিট করুন</p>
      {sectionOrder.map((sKey: string, idx: number) => {
        const sInfo = getSectionInfo(sKey);
        if (!sInfo) return null;
        const isEnabled = config[sKey]?.enabled !== false;
        const isOpen = editingSection === sKey;

        return (
          <Collapsible key={sKey} open={isOpen} onOpenChange={() => setEditingSection(isOpen ? null : sKey)}>
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
                <CollapsibleTrigger className="flex items-center gap-3 flex-1 min-w-0">
                  <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-lg shrink-0">{sInfo.emoji}</span>
                  <span className="font-medium text-sm truncate">{sInfo.label}</span>
                </CollapsibleTrigger>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); moveSection(idx, 'up'); }}
                    disabled={idx === 0}
                    className="w-6 h-6 rounded flex items-center justify-center hover:bg-muted disabled:opacity-30 transition-colors"
                    title="উপরে সরান"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); moveSection(idx, 'down'); }}
                    disabled={idx === sectionOrder.length - 1}
                    className="w-6 h-6 rounded flex items-center justify-center hover:bg-muted disabled:opacity-30 transition-colors"
                    title="নিচে সরান"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  <Switch checked={isEnabled} onCheckedChange={() => toggleSection(sKey)} onClick={(e) => e.stopPropagation()} />
                   {(sInfo.isHtmlBlock || sInfo.isPageBlock || sInfo.isProductBlock) && (
                     <button
                       onClick={(e) => { e.stopPropagation(); deleteHtmlBlock(sKey); }}
                       className="w-6 h-6 rounded flex items-center justify-center hover:bg-destructive/10 text-destructive transition-colors"
                       title="ডিলিট"
                     >
                       <Trash2 className="h-3.5 w-3.5" />
                     </button>
                   )}
                  <CollapsibleTrigger asChild>
                    <button className="w-6 h-6 rounded flex items-center justify-center hover:bg-muted transition-colors">
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                  </CollapsibleTrigger>
                </div>
              </div>
              <CollapsibleContent>
                <div className="p-4 border-t border-border space-y-3 bg-muted/20">
                  {sKey === 'hero' && <HeroFields config={config.hero} update={(k: string, v: any) => updateField('hero', k, v)} />}
                  {sKey === 'categories' && <SectionHeadingFields config={config.categories} update={(k: string, v: any) => updateField('categories', k, v)} />}
                  {sKey === 'best_selling' && <ProductSectionFields config={config.best_selling} update={(k: string, v: any) => updateField('best_selling', k, v)} />}
                  {sKey === 'stock_clearance' && <StockClearanceFields config={config.stock_clearance || {}} update={(k: string, v: any) => updateField('stock_clearance', k, v)} />}
                  {sKey === 'trending' && <TrendingFields config={config.trending || {}} update={(k: string, v: any) => updateField('trending', k, v)} />}
                  {sKey === 'new_products' && <ProductSectionFields config={config.new_products} update={(k: string, v: any) => updateField('new_products', k, v)} />}
                  {sKey === 'all_products' && <ProductSectionFields config={config.all_products} update={(k: string, v: any) => updateField('all_products', k, v)} showSort />}
                  
                   {sInfo.isHtmlBlock && <HtmlBlockFields config={config[sKey] || {}} update={(k: string, v: any) => updateField(sKey, k, v)} />}
                   {sInfo.isPageBlock && <PageBlockFields config={config[sKey] || {}} update={(k: string, v: any) => updateField(sKey, k, v)} />}
                   {sInfo.isProductBlock && <ProductBlockFields config={config[sKey] || {}} update={(k: string, v: any) => updateField(sKey, k, v)} />}
                   {!sInfo.isHtmlBlock && !sInfo.isPageBlock && !sInfo.isProductBlock && <AdvancedSectionFields config={config[sKey]} update={(k: string, v: any) => updateField(sKey, k, v)} sectionKey={sKey} />}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}

      {/* Add HTML Block Button */}
      <Button variant="outline" className="w-full gap-2 border-dashed" onClick={addHtmlBlock}>
        <Code className="h-4 w-4" />
        কাস্টম HTML ব্লক যোগ করুন
      </Button>

      {/* Add Page Block Button */}
      <Button variant="outline" className="w-full gap-2 border-dashed" onClick={addPageBlock}>
        <span>📑</span>
        পেজ ব্লক যোগ করুন
      </Button>

      {/* Add Product Block Button */}
      <Button variant="outline" className="w-full gap-2 border-dashed" onClick={addProductBlock}>
        <Package className="h-4 w-4" />
        প্রোডাক্ট ব্লক যোগ করুন
      </Button>

      {/* Global Advanced Settings */}
      <Collapsible>
        <div className="border border-border rounded-lg overflow-hidden mt-4">
          <CollapsibleTrigger className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <Settings2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-lg">⚙️</span>
              <span className="font-medium text-sm">গ্লোবাল অ্যাডভান্সড সেটিংস</span>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="p-4 border-t border-border space-y-3 bg-muted/20">
              <div>
                <Label className="text-xs">গ্লোবাল কাস্টম CSS</Label>
                <CodeEditor
                  value={config.global?.custom_css || ''}
                  onChange={v => updateField('global', 'custom_css', v)}
                  rows={4}
                  language="css"
                  placeholder=".my-class { color: red; }"
                />
              </div>
              <div>
                <Label className="text-xs">গ্লোবাল কাস্টম HTML</Label>
                <CodeEditor
                  value={config.global?.custom_html || ''}
                  onChange={v => updateField('global', 'custom_html', v)}
                  rows={4}
                  language="html"
                  placeholder="<div>...</div>"
                />
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
}

/* ========== HTML BLOCK FIELDS ========== */
function HtmlBlockFields({ config, update }: { config: any; update: (k: string, v: any) => void }) {
  return (
    <>
      <div>
        <Label className="text-xs">ব্লকের নাম/লেবেল</Label>
        <Input value={config.label || ''} onChange={e => update('label', e.target.value)} placeholder="যেমন: প্রোমো ব্যানার" className="text-xs" />
      </div>
      <div>
        <Label className="text-xs mb-1">HTML কোড + লাইভ প্রিভিউ</Label>
        <CodeEditorWithPreview
          htmlValue={config.html || ''}
          onHtmlChange={v => update('html', v)}
          cssValue={config.custom_css || ''}
          onCssChange={v => update('custom_css', v)}
          height={400}
          htmlPlaceholder='<div class="my-banner">...'
          cssPlaceholder=".my-banner { text-align: center; padding: 2rem; }"
        />
      </div>
      <div>
        <Label className="text-xs">ব্যাকগ্রাউন্ড কালার</Label>
        <ColorPickerWithRecent value={config.bg_color || ''} onChange={(c) => update('bg_color', c)} />
      </div>
    </>
  );
}

/* ========== PRODUCT BLOCK FIELDS ========== */
function ProductBlockFields({ config, update }: { config: any; update: (k: string, v: any) => void }) {
  const { data: categories } = useCategories();
  const { data: allProducts } = useProducts();
  const [productSearch, setProductSearch] = useState('');
  const sourceType = config.source_type || 'category';
  const selectedIds: string[] = config.product_ids || [];

  const filteredProducts = useMemo(() => {
    if (!allProducts) return [];
    const q = productSearch.toLowerCase();
    return allProducts.filter((p: any) =>
      p.name.toLowerCase().includes(q) || p.name_bn.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [allProducts, productSearch]);

  const toggleProduct = (id: string) => {
    if (selectedIds.includes(id)) {
      update('product_ids', selectedIds.filter(i => i !== id));
    } else {
      update('product_ids', [...selectedIds, id]);
    }
  };

  const selectedProducts = useMemo(() => {
    if (!allProducts || selectedIds.length === 0) return [];
    return selectedIds.map(id => allProducts.find((p: any) => p.id === id)).filter(Boolean);
  }, [allProducts, selectedIds]);

  return (
    <>
      <div>
        <Label className="text-xs">ব্লকের নাম/লেবেল</Label>
        <Input value={config.label || ''} onChange={e => update('label', e.target.value)} placeholder="যেমন: বিশেষ কালেকশন" className="text-xs" />
      </div>
      <div>
        <Label className="text-xs">হেডিং</Label>
        <Input value={config.heading || ''} onChange={e => update('heading', e.target.value)} placeholder="বিশেষ কালেকশন" className="text-xs" />
      </div>
      <div>
        <Label className="text-xs">সাবহেডিং</Label>
        <Input value={config.subheading || ''} onChange={e => update('subheading', e.target.value)} placeholder="সেরা মানের পণ্যসমূহ" className="text-xs" />
      </div>
      <div>
        <Label className="text-xs">প্রোডাক্ট সংখ্যা (limit)</Label>
        <Input type="number" value={config.limit || 8} onChange={e => update('limit', parseInt(e.target.value) || 8)} min={1} max={50} className="text-xs" />
      </div>

      {/* Source Type */}
      <div>
        <Label className="text-xs">সোর্স টাইপ</Label>
        <Select value={sourceType} onValueChange={(v) => update('source_type', v)}>
          <SelectTrigger className="text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="category">📂 ক্যাটেগরি থেকে</SelectItem>
            <SelectItem value="manual">✋ ম্যানুয়াল সিলেক্ট</SelectItem>
            <SelectItem value="trending">⚡ Trending (অটো)</SelectItem>
            <SelectItem value="clearance">🏷️ Clearance (অটো)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {sourceType === 'trending' && (
        <div>
          <Label className="text-xs">মিনিমাম রিভিউ (Trending threshold)</Label>
          <Input type="number" value={config.min_reviews ?? 20} onChange={e => update('min_reviews', parseInt(e.target.value) || 20)} min={1} max={500} className="text-xs" />
        </div>
      )}

      {sourceType === 'category' && (
        <div>
          <Label className="text-xs">ক্যাটেগরি বাছাই করুন</Label>
          <Select value={config.category_id || 'none'} onValueChange={(v) => update('category_id', v === 'none' ? '' : v)}>
            <SelectTrigger className="text-xs">
              <SelectValue placeholder="ক্যাটেগরি সিলেক্ট করুন" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— সব প্রোডাক্ট —</SelectItem>
              {categories?.map((cat: any) => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name_bn || cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {sourceType === 'manual' && (
        <div className="space-y-2">
          <Label className="text-xs">প্রোডাক্ট সিলেক্ট করুন</Label>
          {/* Selected products */}
          {selectedProducts.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {selectedProducts.map((p: any) => (
                <div key={p.id} className="flex items-center gap-1.5 bg-muted rounded-md px-2 py-1 text-xs">
                  {p.images?.[0] && <img src={p.images[0]} alt="" className="w-5 h-5 rounded object-cover" />}
                  <span className="truncate max-w-[120px]">{p.name_bn || p.name}</span>
                  <button onClick={() => toggleProduct(p.id)} className="text-destructive hover:text-destructive/80">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={productSearch}
              onChange={e => setProductSearch(e.target.value)}
              placeholder="প্রোডাক্ট খুঁজুন..."
              className="text-xs pl-7"
            />
          </div>
          {/* Product list */}
          <div className="max-h-[200px] overflow-y-auto border border-border rounded-md">
            {filteredProducts.map((p: any) => {
              const isSelected = selectedIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => toggleProduct(p.id)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-muted/50 transition-colors ${isSelected ? 'bg-primary/10' : ''}`}
                >
                  {p.images?.[0] ? (
                    <img src={p.images[0]} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                      <Package className="h-3 w-3 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.name_bn || p.name}</p>
                    <p className="text-muted-foreground">৳{p.price}</p>
                  </div>
                  {isSelected && <span className="text-primary text-xs shrink-0">✓</span>}
                </button>
              );
            })}
            {filteredProducts.length === 0 && (
              <p className="text-center py-3 text-xs text-muted-foreground">কোনো প্রোডাক্ট পাওয়া যায়নি</p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{selectedIds.length}টি প্রোডাক্ট সিলেক্ট করা হয়েছে</p>
        </div>
      )}

      <div>
        <Label className="text-xs">ব্যাকগ্রাউন্ড কালার</Label>
        <ColorPickerWithRecent value={config.bg_color || ''} onChange={(c) => update('bg_color', c)} />
      </div>
    </>
  );
}

function HeroFields({ config, update }: { config: any; update: (k: string, v: any) => void }) {
  const [heroMediaOpen, setHeroMediaOpen] = useState(false);
  const [replacingBannerIdx, setReplacingBannerIdx] = useState<number | null>(null);
  const btnType = config.secondary_button_type || 'helpline';
  return (
    <>
      {/* Hide Text Toggle */}
      <div className="flex items-center justify-between py-1">
        <Label className="text-xs">টেক্সট লুকান (শুধু বাটন + ব্যানার)</Label>
        <Switch checked={config.hide_text || false} onCheckedChange={(v) => update('hide_text', v)} />
      </div>

      {!config.hide_text && (
        <>
          <div>
            <Label className="text-xs">টাইটেল</Label>
            <Input value={config.title || ''} onChange={e => update('title', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">হাইলাইট টেক্সট</Label>
            <Input value={config.title_highlight || ''} onChange={e => update('title_highlight', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">সাবটাইটেল</Label>
            <Textarea value={config.subtitle || ''} onChange={e => update('subtitle', e.target.value)} rows={3} />
          </div>
        </>
      )}

      {/* Primary Button Toggle — independent of hide_text */}
      <div className="flex items-center justify-between">
        <Label className="text-xs">প্রাইমারি বাটন দেখান</Label>
        <Switch checked={!config.hide_primary_button} onCheckedChange={(v) => update('hide_primary_button', !v)} />
      </div>
      {!config.hide_primary_button && (
        <>
          <div>
            <Label className="text-xs">প্রাইমারি বাটন টেক্সট</Label>
            <Input value={config.button_text || ''} onChange={e => update('button_text', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">প্রাইমারি বাটন লিঙ্ক (খালি রাখলে /shop)</Label>
            <Input value={config.primary_button_link || ''} onChange={e => update('primary_button_link', e.target.value)} placeholder="/shop বা https://example.com" />
          </div>
        </>
      )}

      {/* Secondary Button */}
      <div className="border-t border-border pt-3 mt-2">
        <Label className="text-xs font-semibold">সেকেন্ডারি বাটন</Label>
        <Select value={btnType} onValueChange={(v) => update('secondary_button_type', v)}>
          <SelectTrigger className="mt-1 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="helpline">📞 হেল্পলাইন (ফোন কল)</SelectItem>
            <SelectItem value="whatsapp">💬 হোয়াটসঅ্যাপ</SelectItem>
            <SelectItem value="custom_link">🔗 কাস্টম লিঙ্ক</SelectItem>
            <SelectItem value="none">🚫 বন্ধ</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {btnType !== 'none' && (
        <div>
          <Label className="text-xs">সেকেন্ডারি বাটন টেক্সট</Label>
          <Input
            value={config.secondary_button_text || ''}
            onChange={e => update('secondary_button_text', e.target.value)}
            placeholder={btnType === 'helpline' ? 'হেল্পলাইন' : btnType === 'whatsapp' ? 'হোয়াটসঅ্যাপে মেসেজ করুন' : 'ভিজিট করুন'}
          />
        </div>
      )}

      {btnType === 'custom_link' && (
        <div>
          <Label className="text-xs">কাস্টম লিঙ্ক URL</Label>
          <Input
            value={config.secondary_button_link || ''}
            onChange={e => update('secondary_button_link', e.target.value)}
            placeholder="https://example.com"
          />
        </div>
      )}

      {/* Hero Banners */}
      <div className="border-t border-border pt-3 mt-2">
        <Label className="text-xs font-semibold">হিরো ব্যানার ইমেজ</Label>
        <p className="text-xs text-muted-foreground mb-2">একাধিক ব্যানার যোগ করলে অটো স্লাইড হবে</p>
        <BannerListEditor config={config} update={update} onOpenMedia={() => { setReplacingBannerIdx(null); setHeroMediaOpen(true); }} onReplaceImage={(idx) => { setReplacingBannerIdx(idx); setHeroMediaOpen(true); }} />
        <MediaCenter open={heroMediaOpen} onOpenChange={(o) => { setHeroMediaOpen(o); if (!o) setReplacingBannerIdx(null); }} onSelect={(urls) => {
          if (replacingBannerIdx !== null) {
            const existing = config.hero_banners || [];
            const updated = [...existing];
            if (updated[replacingBannerIdx]) {
              updated[replacingBannerIdx] = { ...updated[replacingBannerIdx], image: urls[0] };
              update('hero_banners', updated);
            }
            setReplacingBannerIdx(null);
          } else {
            const existing = config.hero_banners || [];
            const newBanners = [...existing, ...urls.map((u: string) => ({ image: u, link: '' }))];
            update('hero_banners', newBanners);
          }
        }} />
      </div>

      {/* Button Colors */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">বাটন কালার</Label>
          <ColorPickerWithRecent value={config.button_color || ''} onChange={(c) => update('button_color', c)} />
        </div>
        <div>
          <Label className="text-xs">বাটন টেক্সট কালার</Label>
          <ColorPickerWithRecent value={config.button_text_color || ''} onChange={(c) => update('button_text_color', c)} />
        </div>
      </div>
    </>
  );
}

/* ========== BANNER LIST EDITOR ========== */
function BannerListEditor({ config, update, onOpenMedia, onReplaceImage }: { config: any; update: (k: string, v: any) => void; onOpenMedia: () => void; onReplaceImage: (idx: number) => void }) {
  const [expandedBanner, setExpandedBanner] = useState<number | null>(null);
  const [optimizingIdx, setOptimizingIdx] = useState<number | null>(null);
  const banners: { image: string; link: string; title?: string; title_highlight?: string; subtitle?: string }[] = config.hero_banners?.length > 0
    ? config.hero_banners
    : config.hero_image
      ? [{ image: config.hero_image, link: config.hero_image_link || '' }]
      : [];

  const updateBanners = (newBanners: typeof banners) => {
    update('hero_banners', newBanners);
  };

  const removeBanner = (idx: number) => {
    updateBanners(banners.filter((_, i) => i !== idx));
    if (expandedBanner === idx) setExpandedBanner(null);
  };

  const moveBannerUp = (idx: number) => {
    if (idx <= 0) return;
    const updated = [...banners];
    [updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]];
    updateBanners(updated);
    if (expandedBanner === idx) setExpandedBanner(idx - 1);
    else if (expandedBanner === idx - 1) setExpandedBanner(idx);
  };

  const moveBannerDown = (idx: number) => {
    if (idx >= banners.length - 1) return;
    const updated = [...banners];
    [updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]];
    updateBanners(updated);
    if (expandedBanner === idx) setExpandedBanner(idx + 1);
    else if (expandedBanner === idx + 1) setExpandedBanner(idx);
  };

  const updateBannerField = (idx: number, field: string, value: string) => {
    const updated = [...banners];
    updated[idx] = { ...updated[idx], [field]: value };
    updateBanners(updated);
  };

  const optimizeBanner = async (idx: number) => {
    const banner = banners[idx];
    if (!banner?.image) return;
    setOptimizingIdx(idx);
    try {
      const response = await fetch(banner.image);
      const blob = await response.blob();
      const file = new File([blob], `banner-${idx}.jpg`, { type: blob.type });
      const { optimizeImage } = await import('@/lib/imageOptimizer');
      const optimized = await optimizeImage(file, { maxWidth: 1600, quality: 0.85, skipIfSmaller: 0 });
      if (optimized === file) {
        toast.info('ইমেজ ইতিমধ্যে অপ্টিমাইজড');
      } else {
        const savedKB = Math.round((file.size - optimized.size) / 1024);
        // Upload optimized image to same bucket
        const { supabase } = await import('@/integrations/supabase/client');
        const fileName = `optimized-${Date.now()}.${optimized.name.split('.').pop()}`;
        const { data: uploadData, error } = await supabase.storage.from('hero-banners').upload(fileName, optimized, { cacheControl: '31536000' });
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from('hero-banners').getPublicUrl(uploadData.path);
        const updated = [...banners];
        updated[idx] = { ...updated[idx], image: publicUrl };
        updateBanners(updated);
        toast.success(`অপ্টিমাইজড! ${savedKB}KB সেভ হয়েছে`);
      }
    } catch (err: any) {
      toast.error('অপ্টিমাইজ ব্যর্থ: ' + (err?.message || 'Unknown error'));
    } finally {
      setOptimizingIdx(null);
    }
  };

  return (
    <div className="space-y-2">
      {banners.map((b, i) => (
        <div key={i} className="border border-border rounded-lg bg-background overflow-hidden">
          <div className="flex items-center gap-2 p-2">
            <div className="flex flex-col gap-0.5 shrink-0">
              <button
                onClick={() => moveBannerUp(i)}
                disabled={i === 0}
                className="w-6 h-6 rounded flex items-center justify-center hover:bg-muted text-muted-foreground disabled:opacity-30"
                title="উপরে সরান"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => moveBannerDown(i)}
                disabled={i === banners.length - 1}
                className="w-6 h-6 rounded flex items-center justify-center hover:bg-muted text-muted-foreground disabled:opacity-30"
                title="নিচে সরান"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="relative group/thumb shrink-0 cursor-pointer" onClick={() => onReplaceImage(i)}>
              <img src={b.image} alt={`Banner ${i + 1}`} className="w-16 h-11 rounded object-cover border border-border" />
              <div className="absolute inset-0 bg-black/50 rounded flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity">
                <Camera className="h-4 w-4 text-white" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <Input
                value={b.link || ''}
                onChange={e => updateBannerField(i, 'link', e.target.value)}
                placeholder="লিঙ্ক (ঐচ্ছিক)"
                className="text-xs h-8"
              />
            </div>
            <button
              onClick={() => optimizeBanner(i)}
              disabled={optimizingIdx === i}
              className="shrink-0 w-7 h-7 rounded flex items-center justify-center hover:bg-primary/10 text-primary disabled:opacity-50"
              title="ইমেজ অপ্টিমাইজ করুন"
            >
              {optimizingIdx === i ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={() => setExpandedBanner(expandedBanner === i ? null : i)}
              className="shrink-0 w-7 h-7 rounded flex items-center justify-center hover:bg-muted text-muted-foreground"
              title="টেক্সট সেটিংস"
            >
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expandedBanner === i ? 'rotate-180' : ''}`} />
            </button>
            <button onClick={() => removeBanner(i)} className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-destructive/10 hover:bg-destructive/20 text-destructive">
              <X className="h-4 w-4" />
            </button>
          </div>
          {expandedBanner === i && (
            <div className="px-3 pb-3 space-y-2 border-t border-border pt-2 bg-muted/20">
              <p className="text-[10px] text-muted-foreground">খালি রাখলে গ্লোবাল টেক্সট দেখাবে</p>
              <div>
                <Label className="text-[10px]">টাইটেল</Label>
                <Input value={b.title || ''} onChange={e => updateBannerField(i, 'title', e.target.value)} placeholder="এই ব্যানারের টাইটেল" className="text-xs h-7" />
              </div>
              <div>
                <Label className="text-[10px]">হাইলাইট টেক্সট</Label>
                <Input value={b.title_highlight || ''} onChange={e => updateBannerField(i, 'title_highlight', e.target.value)} placeholder="হাইলাইট অংশ" className="text-xs h-7" />
              </div>
              <div>
                <Label className="text-[10px]">সাবটাইটেল</Label>
                <Input value={b.subtitle || ''} onChange={e => updateBannerField(i, 'subtitle', e.target.value)} placeholder="এই ব্যানারের সাবটাইটেল" className="text-xs h-7" />
              </div>
            </div>
          )}
        </div>
      ))}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 gap-2 border-dashed" onClick={onOpenMedia}>
          <Plus className="h-3.5 w-3.5" />
          ব্যানার যোগ করুন
        </Button>
        <AIHeroBannerButton onGenerated={(url) => {
          const existing = config.hero_banners || [];
          update('hero_banners', [...existing, { image: url, link: '' }]);
        }} />
      </div>
    </div>
  );
}

/* ========== ADVANCED SECTION FIELDS (shared) ========== */
function AdvancedSectionFields({ config, update, sectionKey }: { config: any; update: (k: string, v: any) => void; sectionKey: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
        <Settings2 className="h-3 w-3" />
        <span>অ্যাডভান্সড সেটিংস</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pt-2">
        <div>
          <Label className="text-xs">ব্যাকগ্রাউন্ড কালার</Label>
          <ColorPickerWithRecent value={config.bg_color || ''} onChange={(c) => update('bg_color', c)} />
        </div>
        <div>
          <Label className="text-xs">কাস্টম CSS</Label>
          <CodeEditor
            value={config.custom_css || ''}
            onChange={v => update('custom_css', v)}
            rows={3}
            language="css"
            placeholder={`.homepage-${sectionKey} { ... }`}
          />
        </div>
        <div>
          <Label className="text-xs">কাস্টম HTML (সেকশনের আগে)</Label>
          <CodeEditor
            value={config.custom_html_before || ''}
            onChange={v => update('custom_html_before', v)}
            rows={2}
            language="html"
            placeholder="<div>...</div>"
          />
        </div>
        <div>
          <Label className="text-xs">কাস্টম HTML (সেকশনের পরে)</Label>
          <CodeEditor
            value={config.custom_html_after || ''}
            onChange={v => update('custom_html_after', v)}
            rows={2}
            language="html"
            placeholder="<div>...</div>"
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function SectionHeadingFields({ config, update }: { config: any; update: (k: string, v: any) => void }) {
  return (
    <>
      <div>
        <Label className="text-xs">হেডিং</Label>
        <Input value={config.heading || ''} onChange={e => update('heading', e.target.value)} />
      </div>
      <div>
        <Label className="text-xs">সাবহেডিং</Label>
        <Input value={config.subheading || ''} onChange={e => update('subheading', e.target.value)} />
      </div>
    </>
  );
}

function ProductSectionFields({ config, update, showSort }: { config: any; update: (k: string, v: any) => void; showSort?: boolean }) {
  return (
    <>
      <SectionHeadingFields config={config} update={update} />
      <div>
        <Label className="text-xs">কতগুলো প্রোডাক্ট দেখাবে</Label>
        <Input type="number" min={1} max={100} value={config.limit || 4} onChange={e => update('limit', parseInt(e.target.value) || 4)} />
      </div>
      {showSort && (
        <div>
          <Label className="text-xs">সর্টিং</Label>
          <Select value={config.sort || 'default'} onValueChange={v => update('sort', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="default">ডিফল্ট (আপলোড ক্রম)</SelectItem>
              <SelectItem value="top_rated">টপ রেটেড আগে</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </>
  );
}

/* ========== STOCK CLEARANCE FIELDS ========== */
function StockClearanceFields({ config, update }: { config: any; update: (k: string, v: any) => void }) {
  const { data: allProducts } = useProducts();
  const [productSearch, setProductSearch] = useState('');
  const selectedIds: string[] = config.product_ids || [];

  const filteredProducts = useMemo(() => {
    if (!allProducts) return [];
    const q = productSearch.toLowerCase();
    return allProducts.filter((p: any) =>
      p.name.toLowerCase().includes(q) || p.name_bn.toLowerCase().includes(q)
    ).slice(0, 30);
  }, [allProducts, productSearch]);

  const toggleProduct = (id: string) => {
    if (selectedIds.includes(id)) {
      update('product_ids', selectedIds.filter(i => i !== id));
    } else {
      update('product_ids', [...selectedIds, id]);
    }
  };

  const selectedProducts = useMemo(() => {
    if (!allProducts || selectedIds.length === 0) return [];
    return selectedIds.map(id => allProducts.find((p: any) => p.id === id)).filter(Boolean);
  }, [allProducts, selectedIds]);

  return (
    <>
      <div className="rounded-md bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 p-2 text-[11px] text-rose-700 dark:text-rose-300">
        🏷️ এই সেকশনে যে প্রোডাক্টগুলো ক্লিয়ারেন্স সেলে দিতে চান সেগুলো নিচ থেকে সিলেক্ট করুন। হোমপেজে Best Selling এর উপরে দেখাবে।
      </div>

      <div>
        <Label className="text-xs">হেডিং</Label>
        <Input value={config.heading || ''} onChange={e => update('heading', e.target.value)} placeholder="🏷️ স্টক ক্লিয়ারেন্স সেল" className="text-xs" />
      </div>
      <div>
        <Label className="text-xs">সাবহেডিং</Label>
        <Input value={config.subheading || ''} onChange={e => update('subheading', e.target.value)} placeholder="সীমিত সময়ের জন্য বিশেষ ছাড়ে" className="text-xs" />
      </div>
      <div>
        <Label className="text-xs">ব্যাজ টেক্সট (কার্ডের কোণায়)</Label>
        <Input value={config.badge_text || ''} onChange={e => update('badge_text', e.target.value)} placeholder="CLEARANCE" className="text-xs" maxLength={20} />
      </div>
      <div>
        <Label className="text-xs">প্রোডাক্ট সংখ্যা (limit)</Label>
        <Input type="number" value={config.limit || 10} onChange={e => update('limit', parseInt(e.target.value) || 10)} min={1} max={20} className="text-xs" />
      </div>
      <div>
        <Label className="text-xs">"সব দেখুন" লিঙ্ক (খালি রাখলে অটো)</Label>
        <Input value={config.view_all_link || ''} onChange={e => update('view_all_link', e.target.value)} placeholder="/shop?sort=clearance" className="text-xs" />
      </div>

      {/* Product picker */}
      <div className="space-y-2">
        <Label className="text-xs">প্রোডাক্ট সিলেক্ট করুন</Label>
        {selectedProducts.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {selectedProducts.map((p: any) => (
              <div key={p.id} className="flex items-center gap-1.5 bg-muted rounded-md px-2 py-1 text-xs">
                {p.images?.[0] && <img src={p.images[0]} alt="" className="w-5 h-5 rounded object-cover" />}
                <span className="truncate max-w-[120px]">{p.name_bn || p.name}</span>
                <button onClick={() => toggleProduct(p.id)} className="text-destructive hover:text-destructive/80">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={productSearch}
            onChange={e => setProductSearch(e.target.value)}
            placeholder="প্রোডাক্ট খুঁজুন..."
            className="text-xs pl-7"
          />
        </div>
        <div className="max-h-[240px] overflow-y-auto border border-border rounded-md">
          {filteredProducts.map((p: any) => {
            const isSelected = selectedIds.includes(p.id);
            return (
              <button
                key={p.id}
                onClick={() => toggleProduct(p.id)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-muted/50 transition-colors ${isSelected ? 'bg-primary/10' : ''}`}
              >
                {p.images?.[0] ? (
                  <img src={p.images[0]} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                    <Package className="h-3 w-3 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.name_bn || p.name}</p>
                  <p className="text-muted-foreground">৳{p.price}</p>
                </div>
                {isSelected && <span className="text-primary text-xs shrink-0">✓</span>}
              </button>
            );
          })}
          {filteredProducts.length === 0 && (
            <p className="text-center py-3 text-xs text-muted-foreground">কোনো প্রোডাক্ট পাওয়া যায়নি</p>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{selectedIds.length}টি প্রোডাক্ট সিলেক্ট করা হয়েছে</p>
      </div>

      <div>
        <Label className="text-xs">ব্যাকগ্রাউন্ড কালার (খালি রাখলে ডিফল্ট warm gradient)</Label>
        <ColorPickerWithRecent value={config.bg_color || ''} onChange={(c) => update('bg_color', c)} />
      </div>
    </>
  );
}

/* ========== TRENDING FIELDS ========== */
function TrendingFields({ config, update }: { config: any; update: (k: string, v: any) => void }) {
  return (
    <>
      <div className="rounded-md bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900 p-2 text-[11px] text-orange-700 dark:text-orange-300">
        ⚡ Trending সেকশন অটো — সবচেয়ে বেশি বিক্রি ও যথেষ্ট রিভিউ পাওয়া প্রোডাক্ট অটো শো হবে।
      </div>
      <div>
        <Label className="text-xs">হেডিং</Label>
        <Input value={config.heading || ''} onChange={e => update('heading', e.target.value)} placeholder="⚡ Trending এখন" className="text-xs" />
      </div>
      <div>
        <Label className="text-xs">সাবহেডিং</Label>
        <Input value={config.subheading || ''} onChange={e => update('subheading', e.target.value)} placeholder="সবচেয়ে বেশি বিক্রি ও পছন্দ হচ্ছে" className="text-xs" />
      </div>
      <div>
        <Label className="text-xs">ব্যাজ টেক্সট (কার্ডের কোণায়)</Label>
        <Input value={config.badge_text || ''} onChange={e => update('badge_text', e.target.value)} placeholder="TRENDING" className="text-xs" maxLength={20} />
      </div>
      <div>
        <Label className="text-xs">প্রোডাক্ট সংখ্যা (limit)</Label>
        <Input type="number" value={config.limit || 10} onChange={e => update('limit', parseInt(e.target.value) || 10)} min={1} max={30} className="text-xs" />
      </div>
      <div>
        <Label className="text-xs">মিনিমাম রিভিউ থ্রেশহোল্ড</Label>
        <Input type="number" value={config.min_reviews ?? 20} onChange={e => update('min_reviews', parseInt(e.target.value) || 20)} min={1} max={500} className="text-xs" />
        <p className="text-[10px] text-muted-foreground mt-1">কম দিলে বেশি প্রোডাক্ট আসবে, বেশি দিলে শুধু টপ ট্রেন্ডিং।</p>
      </div>
      <div>
        <Label className="text-xs">"সব দেখুন" লিঙ্ক</Label>
        <Input value={config.view_all_link || ''} onChange={e => update('view_all_link', e.target.value)} placeholder="/trending" className="text-xs" />
      </div>
      <div>
        <Label className="text-xs">ব্যাকগ্রাউন্ড কালার (খালি রাখলে ডিফল্ট warm gradient)</Label>
        <ColorPickerWithRecent value={config.bg_color || ''} onChange={(c) => update('bg_color', c)} />
      </div>
    </>
  );
}


/* ========== NAVBAR EDITOR ========== */
function NavbarEditor({ config, updateTopLevel }: { config: any; updateTopLevel: (k: string, v: any) => void }) {
  const [mediaOpen, setMediaOpen] = useState(false);
  const [wideMediaOpen, setWideMediaOpen] = useState(false);
  const links = config.links || [];
  const logoMode = config.logo_mode || 'icon_text';

  const updateLink = (idx: number, field: string, value: string) => {
    const newLinks = [...links];
    newLinks[idx] = { ...newLinks[idx], [field]: value };
    updateTopLevel('links', newLinks);
  };

  const addLink = () => {
    updateTopLevel('links', [...links, { label: '', to: '/' }]);
  };

  const removeLink = (idx: number) => {
    updateTopLevel('links', links.filter((_: any, i: number) => i !== idx));
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">নেভবারের কনটেন্ট এডিট করুন</p>

      {/* Logo Mode */}
      <div className="border border-border rounded-lg p-3 space-y-3 bg-muted/20">
        <Label className="text-xs font-semibold">লোগো সেটিংস</Label>
        <div>
          <Label className="text-xs">লোগো মোড</Label>
          <Select value={logoMode} onValueChange={(v) => updateTopLevel('logo_mode', v)}>
            <SelectTrigger className="text-xs mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="icon_text">🔵 গোল লোগো + টেক্সট</SelectItem>
              <SelectItem value="wide_logo">🟩 ওয়াইড লোগো (টেক্সট ছাড়া)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {logoMode === 'icon_text' ? (
          <div>
            <Label className="text-xs">গোল লোগো</Label>
            <div className="flex items-center gap-3 mt-1">
              {config.logo_url ? (
                <div className="relative">
                  <img src={config.logo_url} alt="Logo" className="w-11 h-11 rounded-full object-cover border border-border" />
                  <button onClick={() => updateTopLevel('logo_url', '')} className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="w-11 h-11 rounded-full border-2 border-dashed border-border flex items-center justify-center text-muted-foreground">
                  <ImageIcon className="h-5 w-5" />
                </div>
              )}
              <Button variant="outline" size="sm" onClick={() => setMediaOpen(true)}>মিডিয়া থেকে বাছাই করুন</Button>
            </div>
            <MediaCenter open={mediaOpen} onOpenChange={setMediaOpen} onSelect={(urls) => { if (urls[0]) updateTopLevel('logo_url', urls[0]); }} />
          </div>
        ) : (
          <>
            <div>
              <Label className="text-xs">ওয়াইড লোগো</Label>
              <div className="flex items-center gap-3 mt-1">
                {config.wide_logo_url ? (
                  <div className="relative">
                    <img src={config.wide_logo_url} alt="Wide Logo" className="h-10 max-w-[160px] object-contain border border-border rounded" />
                    <button onClick={() => updateTopLevel('wide_logo_url', '')} className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="w-24 h-10 border-2 border-dashed border-border rounded flex items-center justify-center text-muted-foreground">
                    <ImageIcon className="h-5 w-5" />
                  </div>
                )}
                <Button variant="outline" size="sm" onClick={() => setWideMediaOpen(true)}>মিডিয়া থেকে বাছাই করুন</Button>
              </div>
              <MediaCenter open={wideMediaOpen} onOpenChange={setWideMediaOpen} onSelect={(urls) => { if (urls[0]) updateTopLevel('wide_logo_url', urls[0]); }} />
            </div>
            <div>
              <Label className="text-xs">অ্যালাইনমেন্ট</Label>
              <div className="flex gap-2 mt-1">
                <Button variant={config.wide_logo_align !== 'center' ? 'default' : 'outline'} size="sm" onClick={() => updateTopLevel('wide_logo_align', 'left')}>বামে</Button>
                <Button variant={config.wide_logo_align === 'center' ? 'default' : 'outline'} size="sm" onClick={() => updateTopLevel('wide_logo_align', 'center')}>মাঝে</Button>
              </div>
            </div>
          </>
        )}
      </div>

      <div>
        <Label className="text-xs">মার্কি টেক্সট</Label>
        <Textarea value={config.marquee_text || ''} onChange={e => updateTopLevel('marquee_text', e.target.value)} rows={3} />
      </div>

      <div>
        <Label className="text-xs">ব্র্যান্ড নাম (বাংলা)</Label>
        <Input value={config.brand_name || ''} onChange={e => updateTopLevel('brand_name', e.target.value)} />
      </div>

      <div>
        <Label className="text-xs">ব্র্যান্ড নাম (ইংরেজি)</Label>
        <Input value={config.brand_name_en || ''} onChange={e => updateTopLevel('brand_name_en', e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold">নেভ লিঙ্ক</Label>
        {links.map((link: any, idx: number) => (
          <div key={idx} className="flex items-center gap-2">
            <Input placeholder="লেবেল" value={link.label} onChange={e => updateLink(idx, 'label', e.target.value)} className="text-xs h-8" />
            <Input placeholder="/path" value={link.to} onChange={e => updateLink(idx, 'to', e.target.value)} className="text-xs h-8" />
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeLink(idx)}>
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" className="w-full gap-1" onClick={addLink}>
          <Plus className="h-3 w-3" /> লিঙ্ক যোগ করুন
        </Button>
      </div>
    </div>
  );
}

/* ========== PAGE BLOCK FIELDS ========== */
function PageBlockFields({ config, update }: { config: any; update: (k: string, v: any) => void }) {
  const { data: pagesData } = useSiteConfig('pages_config');
  const pages = (pagesData?.pages || []).filter((p: any) => p.enabled);

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">ব্লকের নাম</Label>
        <Input value={config.label || ''} onChange={e => update('label', e.target.value)} placeholder="পেজ ব্লক" />
      </div>
      <div>
        <Label className="text-xs">কোন পেজ দেখাবে?</Label>
        <Select value={config.page_id || ''} onValueChange={v => update('page_id', v)}>
          <SelectTrigger className="text-xs">
            <SelectValue placeholder="পেজ সিলেক্ট করুন" />
          </SelectTrigger>
          <SelectContent>
            {pages.map((p: any) => (
              <SelectItem key={p.id} value={p.id}>
                {p.icon} {p.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

/* ========== FOOTER EDITOR ========== */
function FooterEditor({ config, updateTopLevel }: { config: any; updateTopLevel: (k: string, v: any) => void }) {
  const [logoMediaOpen, setLogoMediaOpen] = useState(false);
  const [wideLogoMediaOpen, setWideLogoMediaOpen] = useState(false);
  const quickLinks = config.quick_links || [];
  const policyLinks = config.policy_links || [];
  const logoMode = config.logo_mode || 'icon_text';

  const updateQuickLink = (idx: number, field: string, value: string) => {
    const newLinks = [...quickLinks];
    newLinks[idx] = { ...newLinks[idx], [field]: value };
    updateTopLevel('quick_links', newLinks);
  };
  const addQuickLink = () => updateTopLevel('quick_links', [...quickLinks, { label: '', to: '/' }]);
  const removeQuickLink = (idx: number) => updateTopLevel('quick_links', quickLinks.filter((_: any, i: number) => i !== idx));

  const updatePolicyLink = (idx: number, field: string, value: string) => {
    const newLinks = [...policyLinks];
    newLinks[idx] = { ...newLinks[idx], [field]: value };
    updateTopLevel('policy_links', newLinks);
  };
  const addPolicyLink = () => updateTopLevel('policy_links', [...policyLinks, { label: '', to: '/' }]);
  const removePolicyLink = (idx: number) => updateTopLevel('policy_links', policyLinks.filter((_: any, i: number) => i !== idx));

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">ফুটারের কনটেন্ট এডিট করুন</p>

      {/* Logo Settings */}
      <div className="border border-border rounded-lg p-3 space-y-3 bg-muted/20">
        <Label className="text-xs font-semibold">লোগো সেটিংস</Label>
        <div>
          <Label className="text-xs">লোগো মোড</Label>
          <Select value={logoMode} onValueChange={(v) => updateTopLevel('logo_mode', v)}>
            <SelectTrigger className="text-xs mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="icon_text">🔵 গোল লোগো + টেক্সট</SelectItem>
              <SelectItem value="wide_logo">🟩 ওয়াইড লোগো (টেক্সট ছাড়া)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {logoMode === 'icon_text' ? (
          <div>
            <Label className="text-xs">গোল লোগো</Label>
            <div className="flex items-center gap-3 mt-1">
              {config.logo_url ? (
                <div className="relative">
                  <img src={config.logo_url} alt="Logo" className="w-10 h-10 rounded-full object-cover border border-border" />
                  <button onClick={() => updateTopLevel('logo_url', '')} className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full border-2 border-dashed border-border flex items-center justify-center text-muted-foreground">
                  <ImageIcon className="h-5 w-5" />
                </div>
              )}
              <Button variant="outline" size="sm" onClick={() => setLogoMediaOpen(true)}>মিডিয়া থেকে বাছাই করুন</Button>
            </div>
            <MediaCenter open={logoMediaOpen} onOpenChange={setLogoMediaOpen} onSelect={(urls) => { if (urls[0]) updateTopLevel('logo_url', urls[0]); }} />
          </div>
        ) : (
          <>
            <div>
              <Label className="text-xs">ওয়াইড লোগো</Label>
              <div className="flex items-center gap-3 mt-1">
                {config.wide_logo_url ? (
                  <div className="relative">
                    <img src={config.wide_logo_url} alt="Wide Logo" className="h-10 max-w-[160px] object-contain border border-border rounded" />
                    <button onClick={() => updateTopLevel('wide_logo_url', '')} className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="w-24 h-10 border-2 border-dashed border-border rounded flex items-center justify-center text-muted-foreground">
                    <ImageIcon className="h-5 w-5" />
                  </div>
                )}
                <Button variant="outline" size="sm" onClick={() => setWideLogoMediaOpen(true)}>মিডিয়া থেকে বাছাই করুন</Button>
              </div>
              <MediaCenter open={wideLogoMediaOpen} onOpenChange={setWideLogoMediaOpen} onSelect={(urls) => { if (urls[0]) updateTopLevel('wide_logo_url', urls[0]); }} />
            </div>
            <div>
              <Label className="text-xs">অ্যালাইনমেন্ট</Label>
              <div className="flex gap-2 mt-1">
                <Button variant={config.wide_logo_align !== 'center' ? 'default' : 'outline'} size="sm" onClick={() => updateTopLevel('wide_logo_align', 'left')}>বামে</Button>
                <Button variant={config.wide_logo_align === 'center' ? 'default' : 'outline'} size="sm" onClick={() => updateTopLevel('wide_logo_align', 'center')}>মাঝে</Button>
              </div>
            </div>
          </>
        )}
      </div>

      <div>
        <Label className="text-xs">ব্র্যান্ড নাম</Label>
        <Input value={config.brand_name || ''} onChange={e => updateTopLevel('brand_name', e.target.value)} />
      </div>
      <div>
        <Label className="text-xs">বর্ণনা</Label>
        <Textarea value={config.brand_description || ''} onChange={e => updateTopLevel('brand_description', e.target.value)} rows={2} />
      </div>
      <div>
        <Label className="text-xs">ঠিকানা</Label>
        <Input value={config.address || ''} onChange={e => updateTopLevel('address', e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">ফোন</Label>
          <Input value={config.phone || ''} onChange={e => updateTopLevel('phone', e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">WhatsApp</Label>
          <Input value={config.whatsapp || ''} onChange={e => updateTopLevel('whatsapp', e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Facebook</Label>
          <Input value={config.facebook || ''} onChange={e => updateTopLevel('facebook', e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Instagram</Label>
          <Input value={config.instagram || ''} onChange={e => updateTopLevel('instagram', e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">YouTube</Label>
          <Input value={config.youtube || ''} onChange={e => updateTopLevel('youtube', e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">TikTok</Label>
          <Input value={config.tiktok || ''} onChange={e => updateTopLevel('tiktok', e.target.value)} />
        </div>
      </div>
      <div>
        <Label className="text-xs">কপিরাইট টেক্সট</Label>
        <Input value={config.copyright || ''} onChange={e => updateTopLevel('copyright', e.target.value)} placeholder="© {year} ব্র্যান্ড নাম" />
      </div>

      {/* Quick Links */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold">কুইক লিঙ্কস</Label>
        {quickLinks.map((link: any, idx: number) => (
          <div key={idx} className="flex items-center gap-2">
            <Input placeholder="লেবেল" value={link.label} onChange={e => updateQuickLink(idx, 'label', e.target.value)} className="text-xs h-8" />
            <Input placeholder="/path" value={link.to} onChange={e => updateQuickLink(idx, 'to', e.target.value)} className="text-xs h-8" />
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeQuickLink(idx)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
          </div>
        ))}
        <Button variant="outline" size="sm" className="w-full gap-1" onClick={addQuickLink}><Plus className="h-3 w-3" /> লিঙ্ক যোগ করুন</Button>
      </div>

      {/* Policy Links */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold">পলিসি লিঙ্কস</Label>
        {policyLinks.map((link: any, idx: number) => (
          <div key={idx} className="flex items-center gap-2">
            <Input placeholder="লেবেল" value={link.label} onChange={e => updatePolicyLink(idx, 'label', e.target.value)} className="text-xs h-8" />
            <Input placeholder="/path" value={link.to} onChange={e => updatePolicyLink(idx, 'to', e.target.value)} className="text-xs h-8" />
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removePolicyLink(idx)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
          </div>
        ))}
        <Button variant="outline" size="sm" className="w-full gap-1" onClick={addPolicyLink}><Plus className="h-3 w-3" /> লিঙ্ক যোগ করুন</Button>
      </div>
    </div>
  );
}

/* ========== AI HERO BANNER GENERATOR ========== */
function AIHeroBannerButton({ onGenerated }: { onGenerated: (url: string) => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [resolution, setResolution] = useState('standard');
  const [quality, setQuality] = useState('85');
  const [result, setResult] = useState<{ banner_url: string; tagline: string } | null>(null);
  const { data: categories } = useCategories();

  const generate = async () => {
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('generate-hero-banner', {
        body: {
          custom_prompt: prompt || undefined,
          category_id: categoryId || undefined,
          resolution,
          quality: parseInt(quality),
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      if (!data?.banner_url) throw new Error('ব্যানার তৈরি হয়নি');
      setResult(data);
      toast.success('ব্যানার তৈরি হয়েছে!');
    } catch (e: any) {
      toast.error(e.message || 'ব্যানার তৈরিতে সমস্যা');
    } finally {
      setLoading(false);
    }
  };

  const addBanner = () => {
    if (result?.banner_url) {
      onGenerated(result.banner_url);
      toast.success('ব্যানার যোগ হয়েছে!');
      setOpen(false);
      setResult(null);
      setPrompt('');
      setCategoryId('');
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" className="flex-1 gap-2 border-primary/30 hover:border-primary hover:bg-primary/5 border-dashed" onClick={() => setOpen(true)}>
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        AI ব্যানার তৈরি করুন
      </Button>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setResult(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI হিরো ব্যানার তৈরি করুন
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {result && (
              <div className="space-y-2">
                <AspectRatio ratio={16 / 9} className="border border-border rounded-lg overflow-hidden bg-muted">
                  <img src={result.banner_url} alt="Generated banner" className="w-full h-full object-cover" />
                </AspectRatio>
                {result.tagline && (
                  <p className="text-xs text-muted-foreground text-center italic">"{result.tagline}"</p>
                )}
              </div>
            )}
            <div>
              <Label className="text-xs">ক্যাটেগরি সিলেক্ট করুন (ঐচ্ছিক)</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="mt-1 text-xs h-9">
                  <SelectValue placeholder="সব ক্যাটেগরি (ডিফল্ট)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">সব ক্যাটেগরি (ডিফল্ট)</SelectItem>
                  {(categories || []).filter((c: any) => !c.parent_id).map((cat: any) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name_bn || cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">কাস্টম প্রম্পট (ঐচ্ছিক)</Label>
              <Textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="যেমন: ঈদ কালেকশন থিমে ব্যানার তৈরি করো, লাল ও সোনালি রঙে..."
                rows={3}
                className="text-xs mt-1"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium flex items-center gap-1.5"><Settings2 className="h-3 w-3" /> ইমেজ সেটিংস</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] text-muted-foreground">রেজোলিউশন</Label>
                  <Select value={resolution} onValueChange={setResolution}>
                    <SelectTrigger className="mt-0.5 text-xs h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">স্ট্যান্ডার্ড (1200×675)</SelectItem>
                      <SelectItem value="hd">HD (1600×900)</SelectItem>
                      <SelectItem value="4k">4K (2400×1350)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">কোয়ালিটি</Label>
                  <Select value={quality} onValueChange={setQuality}>
                    <SelectTrigger className="mt-0.5 text-xs h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="75">ভালো (75%)</SelectItem>
                      <SelectItem value="85">উত্তম (85%)</SelectItem>
                      <SelectItem value="95">সর্বোচ্চ (95%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={generate} disabled={loading} className="flex-1 gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {result ? 'আবার তৈরি করুন' : 'তৈরি করুন'}
              </Button>
              {result && (
                <Button onClick={addBanner} variant="default" className="flex-1 gap-2 bg-green-600 hover:bg-green-700">
                  <Plus className="h-4 w-4" />
                  ব্যানারে যোগ করুন
                </Button>
              )}
            </div>
            {loading && (
              <p className="text-xs text-muted-foreground text-center">AI ব্যানার তৈরি হচ্ছে... এটি ১-২ মিনিট সময় নিতে পারে</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
