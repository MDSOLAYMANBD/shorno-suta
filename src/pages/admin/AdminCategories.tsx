import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActivityLog } from '@/hooks/useActivityLog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Package, ChevronRight, Sparkles, Loader2, Image as ImageIcon, Save, RefreshCw, Zap, GalleryHorizontalEnd, X, Eye, ExternalLink, Pin, PinOff, GripVertical } from 'lucide-react';
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAllSettings } from '@/hooks/useAllSettings';
import { useUpdateSetting } from '@/hooks/useStoreSettings';
import { optimizeImage } from '@/lib/imageOptimizer';
import { Link } from 'react-router-dom';

function OverlaySettings() {
  const { data: allSettings } = useAllSettings();
  const updateSetting = useUpdateSetting();

  const config = useMemo(() => {
    try {
      return allSettings?.banner_overlay_config ? JSON.parse(allSettings.banner_overlay_config) : { show_on_desktop: false, show_on_mobile: false };
    } catch { return { show_on_desktop: false, show_on_mobile: false }; }
  }, [allSettings?.banner_overlay_config]);

  const toggle = (key: 'show_on_desktop' | 'show_on_mobile', val: boolean) => {
    const updated = { ...config, [key]: val };
    updateSetting.mutate({ key: 'banner_overlay_config', value: JSON.stringify(updated) }, {
      onSuccess: () => toast.success('সেটিং সেভ হয়েছে'),
    });
  };

  return (
    <div className="border-t border-border pt-4 mt-4 space-y-3">
      <h4 className="text-sm font-semibold">ওভারলে টেক্সট সেটিংস</h4>
      <p className="text-xs text-muted-foreground">ব্যানারের উপর ক্যাটেগরি নাম ও ট্যাগলাইন দেখানো/লুকানো</p>
      <div className="flex items-center justify-between">
        <Label className="text-sm">ডেস্কটপে ওভারলে দেখান</Label>
        <Switch checked={config.show_on_desktop !== false} onCheckedChange={v => toggle('show_on_desktop', v)} />
      </div>
      <div className="flex items-center justify-between">
        <Label className="text-sm">মোবাইলে ওভারলে দেখান</Label>
        <Switch checked={config.show_on_mobile !== false} onCheckedChange={v => toggle('show_on_mobile', v)} />
      </div>
    </div>
  );
}

export default function AdminCategories() {
  const qc = useQueryClient();
  const { logActivity } = useActivityLog();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', name_bn: '', slug: '', icon: '', image_url: '', parent_id: '' });
  const [bannerDialog, setBannerDialog] = useState<any>(null);
  const [bannerPrompt, setBannerPrompt] = useState('');
  const [generatingBanner, setGeneratingBanner] = useState<string | null>(null);
  const [bannerTab, setBannerTab] = useState<'home' | 'shop'>('home');
  // Preview state — not yet saved
  const [previewBanner, setPreviewBanner] = useState<{ url: string; tagline: string } | null>(null);
  const [galleryPreview, setGalleryPreview] = useState<string | null>(null);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  // Product counts per category_id
  const { data: productCounts = {} } = useQuery<Record<string, number>>({
    queryKey: ['admin-categories-product-counts'],
    queryFn: async () => {
      const map: Record<string, number> = {};
      let from = 0;
      const step = 1000;
      while (true) {
        const { data, error } = await supabase
          .from('products')
          .select('category_id')
          .range(from, from + step - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        for (const row of data) {
          const k = (row as any).category_id;
          if (!k) continue;
          map[k] = (map[k] || 0) + 1;
        }
        if (data.length < step) break;
        from += step;
      }
      return map;
    },
    staleTime: 60_000,
  });

  const mainCategories = categories.filter((c: any) => !c.parent_id);
  const subCategories = (parentId: string) => categories.filter((c: any) => c.parent_id === parentId);

  // Total count incl. subcategories
  const totalCount = (catId: string): number => {
    let n = productCounts[catId] || 0;
    for (const sub of subCategories(catId)) n += productCounts[sub.id] || 0;
    return n;
  };

  const [productsDialog, setProductsDialog] = useState<any>(null);

  const { data: dialogProducts = [], isLoading: loadingDialogProducts } = useQuery({
    queryKey: ['admin-category-products', productsDialog?.id],
    enabled: !!productsDialog?.id,
    queryFn: async () => {
      const cat = productsDialog;
      const subIds = subCategories(cat.id).map((s: any) => s.id);
      const ids = [cat.id, ...subIds];
      // Resilient: try with pin column; if PostgREST schema cache hasn't picked it up, fall back
      let rows: any[] = [];
      const tryWithPin = await supabase
        .from('products')
        .select('id, name, name_bn, slug, price, original_price, stock, images, is_active, category_id, category_pinned_at')
        .in('category_id', ids)
        .order('created_at', { ascending: false });
      if (tryWithPin.error) {
        const fallback = await supabase
          .from('products')
          .select('id, name, name_bn, slug, price, original_price, stock, images, is_active, category_id')
          .in('category_id', ids)
          .order('created_at', { ascending: false });
        if (fallback.error) throw fallback.error;
        rows = fallback.data || [];
      } else {
        rows = tryWithPin.data || [];
      }
      // Client-side: pinned first (by pin time desc), then created order preserved
      rows.sort((a: any, b: any) => {
        const ap = a.category_pinned_at ? new Date(a.category_pinned_at).getTime() : 0;
        const bp = b.category_pinned_at ? new Date(b.category_pinned_at).getTime() : 0;
        return bp - ap;
      });
      return rows;
    },
  });

  const togglePinMutation = useMutation({
    mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) => {
      const { error } = await supabase
        .from('products')
        .update({ category_pinned_at: pinned ? new Date().toISOString() : null } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-category-products'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      toast.success(vars.pinned ? '📌 পিন হয়েছে' : 'পিন সরানো হয়েছে');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const reorderPinnedMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      // Assign descending timestamps so first item sorts to top
      const baseMs = Date.now();
      const updates = orderedIds.map((id, idx) =>
        supabase
          .from('products')
          .update({ category_pinned_at: new Date(baseMs - idx).toISOString() } as any)
          .eq('id', id)
      );
      const results = await Promise.all(updates);
      const firstErr = results.find((r) => r.error)?.error;
      if (firstErr) throw firstErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-category-products'] });
      qc.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('categories').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-categories'] });
      qc.invalidateQueries({ queryKey: ['categories'] });
      logActivity('category_edit', 'category', vars.id, vars.is_active ? 'ক্যাটেগরি চালু' : 'ক্যাটেগরি বন্ধ');
      toast.success(vars.is_active ? 'চালু হয়েছে' : 'বন্ধ হয়েছে');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetForm = () => setForm({ name: '', name_bn: '', slug: '', icon: '', image_url: '', parent_id: '' });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        name_bn: form.name_bn,
        slug: form.slug,
        icon: form.icon || null,
        image_url: form.image_url || null,
        parent_id: form.parent_id || null,
      };
      if (editing) {
        const { error } = await supabase.from('categories').update(payload).eq('id', editing);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('categories').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-categories'] });
      qc.invalidateQueries({ queryKey: ['categories'] });
      logActivity(editing ? 'category_edit' : 'category_create', 'category', editing, editing ? 'ক্যাটেগরি এডিট করা হয়েছে' : 'ক্যাটেগরি তৈরি করা হয়েছে');
      toast.success(editing ? 'Updated' : 'Added');
      setOpen(false); setEditing(null); resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, id) => { qc.invalidateQueries({ queryKey: ['admin-categories'] }); qc.invalidateQueries({ queryKey: ['categories'] }); logActivity('category_delete', 'category', id, 'ক্যাটেগরি ডিলিট করা হয়েছে'); toast.success('Deleted'); },
  });

  const generateBanner = async (categoryId: string, type: 'home' | 'shop', customPrompt?: string) => {
    setGeneratingBanner(`${categoryId}-${type}`);
    setPreviewBanner(null);
    try {
      const { data, error } = await supabase.functions.invoke('generate-category-banner', {
        body: { category_id: categoryId, custom_prompt: customPrompt || undefined, banner_type: type, save_banner: false },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPreviewBanner({ url: data.banner_url, tagline: data.banner_tagline });
      toast.success('ব্যানার প্রিভিউ তৈরি হয়েছে! পছন্দ হলে সেভ করুন।');
    } catch (e: any) {
      toast.error(e.message || 'ব্যানার তৈরিতে সমস্যা');
    } finally {
      setGeneratingBanner(null);
    }
  };

  const saveBannerToDb = async (categoryId: string, type: 'home' | 'shop', url: string, tagline: string) => {
    try {
      const updatePayload = type === 'shop'
        ? { shop_banner_url: url, shop_banner_tagline: tagline }
        : { banner_image_url: url, banner_tagline: tagline };

      const { error } = await supabase.from('categories').update(updatePayload).eq('id', categoryId);
      if (error) throw error;
      toast.success('ব্যানার সেভ হয়েছে!');
      setPreviewBanner(null);
      setBannerDialog((prev: any) => prev ? { ...prev, ...updatePayload } : prev);
      qc.invalidateQueries({ queryKey: ['admin-categories'] });
      qc.invalidateQueries({ queryKey: ['categories'] });
    } catch (e: any) {
      toast.error(e.message || 'সেভ করতে সমস্যা');
    }
  };

  const CategoryPreview = ({ icon, image_url }: { icon?: string; image_url?: string }) => {
    if (image_url) return <img src={image_url} alt="" className="w-10 h-10 object-contain rounded" />;
    if (icon) return <span className="text-2xl">{icon}</span>;
    return <Package className="w-5 h-5 text-muted-foreground" />;
  };

  const openAddSub = (parentId: string) => {
    resetForm();
    setForm(p => ({ ...p, parent_id: parentId }));
    setEditing(null);
    setOpen(true);
  };

  const openEdit = (c: any) => {
    setEditing(c.id);
    setForm({ name: c.name, name_bn: c.name_bn || '', slug: c.slug, icon: c.icon || '', image_url: c.image_url || '', parent_id: c.parent_id || '' });
    setOpen(true);
  };

  const openBannerDialog = (c: any) => {
    setBannerDialog(c);
    setBannerPrompt('');
    setPreviewBanner(null);
    setBannerTab('home');
  };

  const CategoryRow = ({ c, indent = false }: { c: any; indent?: boolean }) => {
    const isActive = c.is_active !== false;
    const count = totalCount(c.id);
    return (
      <div className={`flex items-center justify-between p-3 border border-border rounded-lg transition-opacity ${indent ? 'ml-8 bg-muted/20' : ''} ${isActive ? '' : 'opacity-60'}`}>
        <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer hover:opacity-80" onClick={() => setProductsDialog(c)}>
          <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center shrink-0">
            <CategoryPreview icon={c.icon} image_url={c.image_url} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm">
              {c.name}
              <span className="ml-1.5 text-[11px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold">{count} প্রোডাক্ট</span>
            </p>
            <p className="text-xs text-muted-foreground">{c.name_bn} · /{c.slug}</p>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {c.banner_image_url ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">✓ হোম</span>
              ) : (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">হোম নেই</span>
              )}
              {(c as any).shop_banner_url ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">✓ শপ</span>
              ) : (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">শপ নেই</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <div className="flex items-center gap-1.5 mr-1" title={isActive ? 'চালু আছে — বন্ধ করতে ক্লিক করুন' : 'বন্ধ আছে — চালু করতে ক্লিক করুন'}>
            <Switch
              checked={isActive}
              onCheckedChange={(v) => toggleActiveMutation.mutate({ id: c.id, is_active: v })}
            />
          </div>
          <Button variant="ghost" size="icon" onClick={() => openBannerDialog(c)} title="AI ব্যানার তৈরি/এডিট">
            <Sparkles className="h-4 w-4 text-primary" />
          </Button>
          {!indent && (
            <Button variant="ghost" size="icon" onClick={() => openAddSub(c.id)} title="সাবক্যাটেগরি যোগ করুন">
              <Plus className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => { if (confirm('Delete?')) deleteMutation.mutate(c.id); }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  // Optimize banner image
  const [optimizing, setOptimizing] = useState<string | null>(null);
  const [optimizeResult, setOptimizeResult] = useState<{ saved: number; percent: number } | null>(null);
  const { data: allSettings } = useAllSettings();
  const updateSetting = useUpdateSetting();

  const optimizeBannerImage = async (url: string, categoryId: string, type: 'home' | 'shop') => {
    if (!url) return;
    setOptimizing(`${categoryId}-${type}`);
    setOptimizeResult(null);
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const originalSize = blob.size;
      const file = new File([blob], 'banner.jpg', { type: blob.type });
      const optimized = await optimizeImage(file, { maxWidth: 1200, quality: 0.82 });
      if (optimized === file) {
        toast.info('ছবিটি ইতিমধ্যে অপ্টিমাইজড');
        return;
      }
      const path = `${categoryId}/${type}-${Date.now()}.webp`;
      const { error: upErr } = await supabase.storage.from('category-banners').upload(path, optimized, { contentType: 'image/webp', cacheControl: '31536000', upsert: true });
      if (upErr) throw upErr;
      const { data: publicUrl } = supabase.storage.from('category-banners').getPublicUrl(path);
      const newUrl = publicUrl.publicUrl;
      const updatePayload = type === 'shop' ? { shop_banner_url: newUrl } : { banner_image_url: newUrl };
      const { error: dbErr } = await supabase.from('categories').update(updatePayload).eq('id', categoryId);
      if (dbErr) throw dbErr;
      const saved = originalSize - optimized.size;
      const percent = Math.round((saved / originalSize) * 100);
      setOptimizeResult({ saved, percent });
      toast.success(`${percent}% সাইজ কমেছে! (${(saved / 1024).toFixed(0)}KB সেভ)`);
      qc.invalidateQueries({ queryKey: ['admin-categories'] });
      qc.invalidateQueries({ queryKey: ['categories'] });
      setBannerDialog((prev: any) => prev ? { ...prev, ...updatePayload } : prev);
    } catch (e: any) {
      toast.error(e.message || 'অপ্টিমাইজ করতে সমস্যা');
    } finally {
      setOptimizing(null);
    }
  };

  // Gallery helpers
  const getGalleryKey = (categoryId: string, type: 'home' | 'shop') => `cat_banners_${type}_${categoryId}`;
  const getGallery = (categoryId: string, type: 'home' | 'shop'): { url: string; tagline: string }[] => {
    const key = getGalleryKey(categoryId, type);
    try { return allSettings?.[key] ? JSON.parse(allSettings[key]) : []; } catch { return []; }
  };

  const addToGallery = (categoryId: string, type: 'home' | 'shop', url: string, tagline: string) => {
    const gallery = getGallery(categoryId, type);
    if (gallery.some(g => g.url === url)) { toast.info('এই ব্যানার ইতিমধ্যে গ্যালারিতে আছে'); return; }
    const updated = [...gallery, { url, tagline }];
    updateSetting.mutate({ key: getGalleryKey(categoryId, type), value: JSON.stringify(updated) }, {
      onSuccess: () => toast.success('গ্যালারিতে যোগ হয়েছে'),
    });
  };

  const removeFromGallery = (categoryId: string, type: 'home' | 'shop', index: number) => {
    const gallery = getGallery(categoryId, type);
    gallery.splice(index, 1);
    updateSetting.mutate({ key: getGalleryKey(categoryId, type), value: JSON.stringify(gallery) }, {
      onSuccess: () => toast.success('গ্যালারি থেকে সরানো হয়েছে'),
    });
  };

  // Inline banner tab content renderer helper
  const renderBannerTab = (type: 'home' | 'shop') => {
    if (!bannerDialog) return null;
    const currentUrl = type === 'shop' ? (bannerDialog as any).shop_banner_url : bannerDialog.banner_image_url;
    const currentTagline = type === 'shop' ? (bannerDialog as any).shop_banner_tagline : bannerDialog.banner_tagline;
    const isGenerating = generatingBanner === `${bannerDialog.id}-${type}`;
    const isOptimizing = optimizing === `${bannerDialog.id}-${type}`;
    const showPreview = previewBanner && bannerTab === type;
    const displayUrl = showPreview ? previewBanner.url : currentUrl;
    const displayTagline = showPreview ? previewBanner.tagline : currentTagline;
    const aspectClass = type === 'shop' ? 'aspect-[21/9]' : 'aspect-video';
    const gallery = getGallery(bannerDialog.id, type);

    return (
      <div className="space-y-4">
        {displayUrl ? (
          <div className={`rounded-lg overflow-hidden border border-border ${aspectClass}`}>
            <img src={displayUrl} alt="Banner" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className={`rounded-lg border border-dashed border-border bg-muted/30 ${aspectClass} flex items-center justify-center`}>
            <div className="text-center text-muted-foreground">
              <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-xs">এখনো ব্যানার তৈরি হয়নি</p>
            </div>
          </div>
        )}

        {displayTagline && (
          <p className="text-xs italic text-muted-foreground text-center line-clamp-2 max-h-10 overflow-hidden">"{displayTagline}"</p>
        )}

        {showPreview && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
            <span className="text-xs text-primary font-medium">⚡ প্রিভিউ — এখনো সেভ হয়নি</span>
          </div>
        )}

        {optimizeResult && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800">
            <span className="text-xs text-green-700 dark:text-green-400 font-medium">✅ {optimizeResult.percent}% কমেছে ({(optimizeResult.saved / 1024).toFixed(0)}KB সেভ)</span>
          </div>
        )}

        <div>
          <Label className="text-xs">কাস্টম প্রম্পট (ঐচ্ছিক)</Label>
          <Textarea
            value={bannerPrompt}
            onChange={e => setBannerPrompt(e.target.value)}
            placeholder="যেমন: লাল রঙের ব্যাকগ্রাউন্ডে ফ্যাশনেবল ডিজাইন..."
            rows={3}
            className="text-sm"
          />
          <p className="text-[10px] text-muted-foreground mt-1">খালি রাখলে AI ব্র্যান্ড কালার ব্যবহার করে সবচেয়ে ভালো ব্যানার তৈরি করবে</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={() => generateBanner(bannerDialog.id, type, bannerPrompt)}
            disabled={isGenerating}
            variant={showPreview ? 'outline' : 'default'}
            className="flex-1 min-w-[120px]"
          >
            {isGenerating ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> তৈরি হচ্ছে...</>
            ) : showPreview ? (
              <><RefreshCw className="h-4 w-4 mr-2" /> আবার তৈরি করুন</>
            ) : currentUrl ? (
              <><Sparkles className="h-4 w-4 mr-2" /> পুনরায় তৈরি করুন</>
            ) : (
              <><Sparkles className="h-4 w-4 mr-2" /> AI ব্যানার তৈরি করুন</>
            )}
          </Button>

          {showPreview && (
            <Button
              onClick={() => saveBannerToDb(bannerDialog.id, type, previewBanner.url, previewBanner.tagline)}
              className="flex-1 min-w-[100px]"
            >
              <Save className="h-4 w-4 mr-2" /> সেভ করুন
            </Button>
          )}
        </div>

        {currentUrl && !showPreview && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => optimizeBannerImage(currentUrl, bannerDialog.id, type)}
              disabled={isOptimizing}
              className="flex-1"
            >
              {isOptimizing ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> অপ্টিমাইজ হচ্ছে...</>
              ) : (
                <><Zap className="h-3.5 w-3.5 mr-1.5" /> অপ্টিমাইজ করুন</>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => addToGallery(bannerDialog.id, type, currentUrl, currentTagline || '')}
              className="flex-1"
            >
              <GalleryHorizontalEnd className="h-3.5 w-3.5 mr-1.5" /> গ্যালারিতে যোগ করুন
            </Button>
          </div>
        )}

        {gallery.length > 0 && (
          <div className="border-t border-border pt-3 mt-2">
            <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
              <GalleryHorizontalEnd className="h-3.5 w-3.5" /> ব্যানার গ্যালারি ({gallery.length})
            </h4>
            <div className="grid grid-cols-3 gap-2">
              {gallery.map((item, idx) => (
                <div key={idx} className="relative group rounded-md overflow-hidden border border-border cursor-pointer" onClick={() => setGalleryPreview(item.url)}>
                  <img src={item.url} alt="" className={`w-full object-cover ${type === 'shop' ? 'aspect-[21/9]' : 'aspect-video'}`} />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <Eye className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeFromGallery(bannerDialog.id, type, idx); }}
                    className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Categories</h1>
        <Dialog open={open} onOpenChange={v => { if (!v) { setEditing(null); resetForm(); } setOpen(v); }}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? 'Edit' : 'Add'} Category</DialogTitle></DialogHeader>
            <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-3">
              <div>
                <Label>মূল ক্যাটেগরি (Parent)</Label>
                <Select value={form.parent_id || 'none'} onValueChange={v => setForm(p => ({ ...p, parent_id: v === 'none' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="মূল ক্যাটেগরি নয়" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— মূল ক্যাটেগরি (Parent নেই) —</SelectItem>
                    {mainCategories.filter(mc => mc.id !== editing).map((mc: any) => (
                      <SelectItem key={mc.id} value={mc.id}>{mc.icon ? `${mc.icon} ` : ''}{mc.name_bn || mc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required /></div>
              <div><Label>Name (BN)</Label><Input value={form.name_bn} onChange={e => setForm(p => ({ ...p, name_bn: e.target.value }))} /></div>
              <div><Label>Slug</Label><Input value={form.slug} onChange={e => setForm(p => ({ ...p, slug: e.target.value }))} required placeholder="category-slug" /></div>
              <div>
                <Label>🎨 Emoji / Icon</Label>
                <Input value={form.icon} onChange={e => setForm(p => ({ ...p, icon: e.target.value }))} placeholder="👗 👜 🧕 👑" />
                <p className="text-xs text-muted-foreground mt-1">একটি ইমোজি পেস্ট করুন</p>
              </div>
              <div>
                <Label>🖼️ Image URL</Label>
                <Input value={form.image_url} onChange={e => setForm(p => ({ ...p, image_url: e.target.value }))} placeholder="https://..." />
                <p className="text-xs text-muted-foreground mt-1">মিডিয়া সেন্টার থেকে ইমেজ URL পেস্ট করুন</p>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <CategoryPreview icon={form.icon} image_url={form.image_url} />
                </div>
                <div>
                  <p className="font-medium text-sm">{form.name_bn || form.name || 'প্রিভিউ'}</p>
                  <p className="text-xs text-muted-foreground">{form.parent_id ? 'সাবক্যাটেগরি' : 'মূল ক্যাটেগরি'}</p>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={saveMutation.isPending}>Save</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? <p className="text-muted-foreground">Loading...</p> : (
        <div className="space-y-2">
          {mainCategories.map((c: any) => {
            const subs = subCategories(c.id);
            if (subs.length === 0) {
              return <CategoryRow key={c.id} c={c} />;
            }
            const isActive = c.is_active !== false;
            const count = totalCount(c.id);
            return (
              <Collapsible key={c.id} defaultOpen>
                <div className={`flex items-center justify-between p-3 border border-border rounded-lg transition-opacity ${isActive ? '' : 'opacity-60'}`}>
                  <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 flex-1 min-w-0" onClick={() => setProductsDialog(c)}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={e => e.stopPropagation()}>
                        <ChevronRight className="h-4 w-4 transition-transform duration-200 [[data-state=open]>&]:rotate-90" />
                      </Button>
                    </CollapsibleTrigger>
                    <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center shrink-0">
                      <CategoryPreview icon={c.icon} image_url={c.image_url} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm">
                        {c.name}
                        <span className="ml-1.5 text-[11px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold">{count} প্রোডাক্ট</span>
                        <span className="ml-1 text-xs text-muted-foreground">({subs.length} sub)</span>
                      </p>
                      <p className="text-xs text-muted-foreground">{c.name_bn} · /{c.slug}</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {c.banner_image_url ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">✓ হোম</span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">হোম নেই</span>
                        )}
                        {(c as any).shop_banner_url ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">✓ শপ</span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">শপ নেই</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Switch
                      checked={isActive}
                      onCheckedChange={(v) => toggleActiveMutation.mutate({ id: c.id, is_active: v })}
                      title={isActive ? 'চালু আছে' : 'বন্ধ আছে'}
                    />
                    <Button variant="ghost" size="icon" onClick={() => openBannerDialog(c)} title="AI ব্যানার তৈরি/এডিট">
                      <Sparkles className="h-4 w-4 text-primary" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openAddSub(c.id)} title="সাবক্যাটেগরি যোগ করুন">
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm('Delete? সব সাবক্যাটেগরিও মুছে যাবে।')) deleteMutation.mutate(c.id); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <CollapsibleContent>
                  <div className="space-y-1 mt-1">
                    {subs.map((sub: any) => <CategoryRow key={sub.id} c={sub} indent />)}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      )}

      {/* AI Banner Dialog — Tabbed */}
      <Dialog open={!!bannerDialog} onOpenChange={v => { if (!v) { setBannerDialog(null); setBannerPrompt(''); setPreviewBanner(null); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI ব্যানার — {bannerDialog?.name_bn || bannerDialog?.name}
            </DialogTitle>
          </DialogHeader>
          <Tabs value={bannerTab} onValueChange={v => { setBannerTab(v as any); setPreviewBanner(null); setBannerPrompt(''); }}>
            <TabsList className="w-full sticky top-0 z-10 bg-muted">
              <TabsTrigger value="home" className="flex-1">🏠 হোমপেজ ব্যানার</TabsTrigger>
              <TabsTrigger value="shop" className="flex-1">🛍️ শপ পেজ ব্যানার</TabsTrigger>
            </TabsList>
            <TabsContent value="home">
              {renderBannerTab('home')}
            </TabsContent>
            <TabsContent value="shop">
              {renderBannerTab('shop')}
            </TabsContent>
          </Tabs>

          {/* Overlay Settings */}
          <OverlaySettings />
        </DialogContent>
      </Dialog>

      {/* Products in category dialog */}
      <Dialog open={!!productsDialog} onOpenChange={v => { if (!v) setProductsDialog(null); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              {productsDialog?.name_bn || productsDialog?.name} —{' '}
              <span className="text-primary">{dialogProducts.length} প্রোডাক্ট</span>
            </DialogTitle>
          </DialogHeader>
          {loadingDialogProducts ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 mr-2 animate-spin" /> লোড হচ্ছে...
            </div>
          ) : dialogProducts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">এই ক্যাটেগরিতে কোনো প্রোডাক্ট নেই</p>
          ) : (
            <ProductsList
              products={dialogProducts}
              onTogglePin={(id, pinned) => togglePinMutation.mutate({ id, pinned })}
              togglePinPending={togglePinMutation.isPending}
              onReorderPinned={(ids) => reorderPinnedMutation.mutate(ids)}
              reorderPending={reorderPinnedMutation.isPending}
            />

          )}
        </DialogContent>
      </Dialog>

      {/* Gallery image preview lightbox */}
      <Dialog open={!!galleryPreview} onOpenChange={v => { if (!v) setGalleryPreview(null); }}>
        <DialogContent className="max-w-3xl p-2">
          <DialogHeader><DialogTitle className="sr-only">ব্যানার প্রিভিউ</DialogTitle></DialogHeader>
          {galleryPreview && (
            <img src={galleryPreview} alt="Banner preview" className="w-full rounded-lg object-contain max-h-[75vh]" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Product list with drag-to-reorder for pinned items ───
interface ProductsListProps {
  products: any[];
  onTogglePin: (id: string, pinned: boolean) => void;
  togglePinPending: boolean;
  onReorderPinned: (orderedIds: string[]) => void;
  reorderPending: boolean;
}

function ProductsList({ products, onTogglePin, togglePinPending, onReorderPinned, reorderPending }: ProductsListProps) {
  const pinned = products.filter((p) => p.category_pinned_at);
  const unpinned = products.filter((p) => !p.category_pinned_at);

  // Local optimistic order for pinned items
  const [pinnedOrder, setPinnedOrder] = useState<string[] | null>(null);
  const orderedIds = pinnedOrder ?? pinned.map((p) => p.id);
  // Reset local order when underlying pinned set changes (after invalidation)
  const pinnedKey = pinned.map((p) => p.id).join(',');
  useEffect(() => { setPinnedOrder(null); }, [pinnedKey]);

  const pinnedById = new Map(pinned.map((p) => [p.id, p]));
  const orderedPinned = orderedIds.map((id) => pinnedById.get(id)).filter(Boolean);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = orderedIds.indexOf(String(active.id));
    const newIdx = orderedIds.indexOf(String(over.id));
    if (oldIdx === -1 || newIdx === -1) return;
    const next = arrayMove(orderedIds, oldIdx, newIdx);
    setPinnedOrder(next);
    onReorderPinned(next);
  };

  return (
    <div className="space-y-2">
      {orderedPinned.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {orderedPinned.map((p: any) => (
                <SortableProductRow
                  key={p.id}
                  product={p}
                  isPinned
                  onTogglePin={onTogglePin}
                  togglePinPending={togglePinPending || reorderPending}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
      {orderedPinned.length > 0 && unpinned.length > 0 && (
        <div className="border-t border-border pt-2 mt-2 text-xs text-muted-foreground">অন্যান্য প্রোডাক্ট</div>
      )}
      {unpinned.map((p: any) => (
        <ProductRow key={p.id} product={p} isPinned={false} onTogglePin={onTogglePin} togglePinPending={togglePinPending} />
      ))}
    </div>
  );
}

interface RowProps {
  product: any;
  isPinned: boolean;
  onTogglePin: (id: string, pinned: boolean) => void;
  togglePinPending: boolean;
  dragHandle?: React.ReactNode;
  rowRef?: (el: HTMLElement | null) => void;
  rowStyle?: React.CSSProperties;
}

function ProductRow({ product: p, isPinned, onTogglePin, togglePinPending, dragHandle, rowRef, rowStyle }: RowProps) {
  const img = Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : null;
  const isSale = p.original_price && p.original_price > 0 && p.original_price < p.price;
  const displayPrice = isSale ? p.original_price : p.price;
  const strikePrice = isSale ? p.price : null;
  const discount = isSale ? Math.round(((p.price - p.original_price) / p.price) * 100) : 0;
  return (
    <div
      ref={rowRef as any}
      style={rowStyle}
      className={`flex items-center gap-3 p-2 border rounded-lg ${isPinned ? 'border-yellow-500/60 bg-yellow-500/5' : 'border-border'}`}
    >
      {dragHandle}
      <div className="w-14 h-14 rounded bg-muted shrink-0 overflow-hidden">
        {img ? <img src={img} alt={p.name} className="w-full h-full object-cover" /> : <Package className="w-6 h-6 m-auto mt-4 text-muted-foreground" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {isPinned && <span className="mr-1.5 text-[10px] px-1.5 py-0.5 rounded bg-yellow-500 text-white">📌 পিনড</span>}
          {p.name_bn || p.name}
        </p>
        <p className="text-xs text-muted-foreground truncate">/{p.slug} · স্টক: {p.stock ?? 0}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-sm font-semibold text-primary">৳{displayPrice}</span>
          {strikePrice && <span className="text-xs line-through text-muted-foreground">৳{strikePrice}</span>}
          {discount > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive font-semibold">-{discount}%</span>}
          {!p.is_active && <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">বন্ধ</span>}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        title={isPinned ? 'পিন সরান' : 'টপে পিন করুন'}
        onClick={() => onTogglePin(p.id, !isPinned)}
        disabled={togglePinPending}
      >
        {isPinned ? <PinOff className="h-4 w-4 text-yellow-600" /> : <Pin className="h-4 w-4" />}
      </Button>
      <Link to={`/admin/products?edit=${p.id}`}>
        <Button variant="ghost" size="icon" title="এডিট"><Pencil className="h-4 w-4" /></Button>
      </Link>
      <Link to={`/product/${p.slug}`} target="_blank">
        <Button variant="ghost" size="icon" title="ভিউ"><ExternalLink className="h-4 w-4" /></Button>
      </Link>
    </div>
  );
}

function SortableProductRow(props: Omit<RowProps, 'dragHandle' | 'rowRef' | 'rowStyle'>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.product.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const handle = (
    <button
      type="button"
      className="touch-none cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1 -ml-1"
      title="ড্র্যাগ করে রিঅর্ডার করুন"
      {...attributes}
      {...listeners}
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );
  return <ProductRow {...props} dragHandle={handle} rowRef={setNodeRef} rowStyle={style} />;
}

