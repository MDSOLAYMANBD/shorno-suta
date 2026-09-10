import { useState, useEffect, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCategories } from '@/hooks/useCategories';
import { toast } from 'sonner';
import { ArrowLeft, Save, Trash2, Upload, ChevronDown, ChevronRight, Image as ImageIcon, Star, X, Play, Loader2, Eye, EyeOff } from 'lucide-react';
import AIGenerateButton from '@/components/admin/AIGenerateButton';
import { useAIGenerate } from '@/hooks/useAIGenerate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import MediaCenter from '@/components/admin/MediaCenter';
import { optimizeMultiple, optimizeImage } from '@/lib/imageOptimizer';
import { sanitizeHtml } from '@/lib/sanitize';
import VisualDescriptionEditor from '@/components/admin/VisualDescriptionEditor';
import { syncLinkedProducts, syncSuggestedProducts } from '@/hooks/useProducts';

// Global sizes fetched from DB instead of hardcoded
// const FIXED_SIZES removed - now dynamic

interface SizeData {
  price: string;
  sale_price: string;
  stock: string;
  enabled: boolean;
}

interface CustomSize {
  name: string;
  price: string;
  sale_price: string;
  stock: string;
  enabled: boolean;
}

interface ProductFormState {
  name: string;
  name_bn: string;
  slug: string;
  description: string;
  description_bn: string;
  price: string;
  original_price: string;
  cost_price: string;
  category_id: string;
  stock: string;
  is_active: boolean;
  is_hidden_from_shop: boolean;
  allow_pre_order: boolean;
  video_url: string;
  show_video_overlay: boolean;
  seo_title: string;
  seo_description: string;
  seo_keywords: string;
  clearance_active: boolean;
  clearance_price: string;
}

const emptyForm: ProductFormState = {
  name: '', name_bn: '', slug: '', description: '', description_bn: '',
  price: '0', original_price: '', cost_price: '', category_id: '', stock: '0',
  is_active: true, is_hidden_from_shop: false, allow_pre_order: false, video_url: '', show_video_overlay: true,
  seo_title: '', seo_description: '', seo_keywords: '',
  clearance_active: false, clearance_price: '',
};

const defaultSizeData = (sizes: string[]): Record<string, SizeData> =>
  Object.fromEntries(sizes.map(s => [s, { price: '', sale_price: '', stock: '0', enabled: false }]));

export default function AdminProductEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: categories = [] } = useCategories();
  const isEditing = Boolean(id);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { generateContent: generateAI, loading: aiLoading } = useAIGenerate();

  // Fetch global sizes & colors
  const { data: globalSizes = [] } = useQuery({
    queryKey: ['global-sizes-names'],
    queryFn: async () => {
      const { data, error } = await supabase.from('global_sizes' as any).select('*').eq('is_active', true).order('sort_order');
      if (error) throw error;
      return (data as any[]).map((s: any) => s.name as string);
    },
  });
  const { data: globalColors = [] } = useQuery({
    queryKey: ['global-colors-names'],
    queryFn: async () => {
      const { data, error } = await supabase.from('global_colors' as any).select('*').eq('is_active', true).order('sort_order');
      if (error) throw error;
      return (data as any[]).map((c: any) => c.name as string);
    },
  });

  const FIXED_SIZES = globalSizes;

  const [productType, setProductType] = useState<'simple' | 'variable'>('simple');
  const [form, setForm] = useState<ProductFormState>(emptyForm);
  const [sizeData, setSizeData] = useState<Record<string, SizeData>>({});
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([]);
  const [mediaCenterOpen, setMediaCenterOpen] = useState(false);
  const [customSizes, setCustomSizes] = useState<CustomSize[]>([]);
  const [newCustomSize, setNewCustomSize] = useState('');
  const [colors, setColors] = useState<string[]>([]);
  const [colorImages, setColorImages] = useState<Record<string, string[]>>({});
  const [newColor, setNewColor] = useState('');
  const [colorMediaCenterOpen, setColorMediaCenterOpen] = useState(false);
  const [activeColorForMedia, setActiveColorForMedia] = useState('');
  const [colorSizes, setColorSizes] = useState<Record<string, string[]>>({});
  const [activeSizeColor, setActiveSizeColor] = useState<string>('all');
  const [colorStock, setColorStock] = useState<Record<string, Record<string, string>>>({});
  const [colorOnlyStock, setColorOnlyStock] = useState<Record<string, string>>({});
  const [descPreview, setDescPreview] = useState(false);
  // Optional size-chart inputs for the AI-generated description — থ্রি/টু-পিস প্রোডাক্টে
  // লম্বা সব সাইজে একই থাকে (বুক/কোমর/হিপের মতো বাড়ে না), আর সেলোয়ারের মাপ শরীরের সাইজ
  // নির্বিশেষে একটাই থাকে, তাই এই দুইটা আলাদা ইনপুট হিসেবে নিয়ে AI-কে context এ পাঠানো হয়।
  const [aiLength, setAiLength] = useState('');
  const [aiSalwarMeasure, setAiSalwarMeasure] = useState('');
  const [defaultSize, setDefaultSize] = useState<string>('');

  // Addon & Bump Product states
  const [addonName, setAddonName] = useState('');
  const [addonPrice, setAddonPrice] = useState('');
  const [addonImage, setAddonImage] = useState('');
  const [addonMediaOpen, setAddonMediaOpen] = useState(false);
  const [bumpProductId, setBumpProductId] = useState('');
  const [bumpDiscount, setBumpDiscount] = useState('0');
  const [bumpSearch, setBumpSearch] = useState('');
  const [bumpSearchResults, setBumpSearchResults] = useState<any[]>([]);
  const [bumpProduct, setBumpProduct] = useState<any>(null);

  // Linked color-variant products — separate products that are the same
  // design in another color, cross-linked so each shows the others as swatches.
  const [linkedProductIds, setLinkedProductIds] = useState<string[]>([]);
  const [linkedProducts, setLinkedProducts] = useState<any[]>([]);
  const [linkedSearch, setLinkedSearch] = useState('');
  const [linkedSearchResults, setLinkedSearchResults] = useState<any[]>([]);
  const [linkedBrowseCategory, setLinkedBrowseCategory] = useState('');
  const previousLinkedIdsRef = useRef<string[]>([]);

  // Populates linkedSearchResults with either "recently uploaded" products
  // (no category picked) or the newest products in the chosen category —
  // used whenever the search box is empty, so the admin has something to
  // pick from without having to already know a product's name.
  const fetchLinkedDefaults = async (categoryId: string) => {
    let query = supabase.from('products').select('id, name, name_bn, slug, price, original_price, images, category_id')
      .neq('id', id || '').order('created_at', { ascending: false }).limit(8);
    if (categoryId) query = query.eq('category_id', categoryId);
    const { data } = await query;
    setLinkedSearchResults((data || []).filter(p => !linkedProductIds.includes(p.id)));
  };

  // Suggested (cross-sell) products — mutually linked so "সম্পর্কিত পণ্য" on
  // either product's page shows the others first, ahead of the auto-picked
  // same-category list. Separate from linkedProductIds (color variants).
  const [suggestedProductIds, setSuggestedProductIds] = useState<string[]>([]);
  const [suggestedProducts, setSuggestedProducts] = useState<any[]>([]);
  const [suggestedSearch, setSuggestedSearch] = useState('');
  const [suggestedSearchResults, setSuggestedSearchResults] = useState<any[]>([]);
  const [suggestedBrowseCategory, setSuggestedBrowseCategory] = useState('');
  const previousSuggestedIdsRef = useRef<string[]>([]);

  const fetchSuggestedDefaults = async (categoryId: string) => {
    let query = supabase.from('products').select('id, name, name_bn, slug, price, original_price, images, category_id')
      .neq('id', id || '').order('created_at', { ascending: false }).limit(8);
    if (categoryId) query = query.eq('category_id', categoryId);
    const { data } = await query;
    setSuggestedSearchResults((data || []).filter(p => !suggestedProductIds.includes(p.id)));
  };

  // Fetch product for editing
  const { data: product, isLoading: productLoading } = useQuery({
    queryKey: ['admin-product', id],
    queryFn: async () => {
      if (!id) return null;
      // cost_price is column-revoked from `authenticated`; fetch via staff-only RPC
      const { data, error } = await supabase
        .from('products')
        .select('id, category_id, name, name_bn, slug, description, description_bn, price, original_price, clearance_price, clearance_active, images, sizes, colors, stock, is_featured, is_active, created_at, video_url, video_file_url, seo_title, seo_description, product_type, variant_images, is_hidden_from_shop, seo_keywords, feed_title, feed_description, allow_pre_order, bump_product_id, bump_discount, addon_config, linked_product_ids, suggested_product_ids')
        .eq('id', id)
        .single();
      if (error) throw error;
      const { data: costRows } = await (supabase.rpc as any)('get_product_cost_prices', { p_ids: [id] });
      const cost_price = (costRows && costRows[0]?.cost_price) ?? null;
      return { ...(data as any), cost_price };
    },
    enabled: !!id,
  });

  // Populate form
  useEffect(() => {
    if (!product) return;
    setForm({
      name: product.name, name_bn: product.name_bn, slug: product.slug,
      description: product.description, description_bn: product.description_bn,
      price: String(product.price), original_price: product.original_price ? String(product.original_price) : '',
      cost_price: (product as any).cost_price ? String((product as any).cost_price) : '',
      category_id: product.category_id || '', stock: String(product.stock),
      is_active: product.is_active, is_hidden_from_shop: (product as any).is_hidden_from_shop || false,
      allow_pre_order: Boolean((product as any).allow_pre_order),
      video_url: product.video_url || '',
      show_video_overlay: (product.variant_images as any)?.show_video_overlay || false,
      seo_title: product.seo_title || '', seo_description: product.seo_description || '', seo_keywords: (product as any).seo_keywords || '',
      clearance_active: Boolean((product as any).clearance_active),
      clearance_price: (product as any).clearance_price ? String((product as any).clearance_price) : '',
    });
    setExistingImages(product.images || []);

    // Populate addon config
    const ac = (product as any).addon_config;
    if (ac && typeof ac === 'object') {
      setAddonName(ac.name || '');
      setAddonPrice(ac.price ? String(ac.price) : '');
      setAddonImage(ac.image || '');
    }
    // Populate bump product
    if ((product as any).bump_product_id) {
      setBumpProductId((product as any).bump_product_id);
      setBumpDiscount(String((product as any).bump_discount || 0));
      // Fetch bump product details
      supabase.from('products').select('id, name, name_bn, price, original_price, images').eq('id', (product as any).bump_product_id).maybeSingle().then(({ data }) => {
        if (data) setBumpProduct(data);
      });
    }

    // Populate linked color-variant products
    const linkedIds: string[] = (product as any).linked_product_ids || [];
    setLinkedProductIds(linkedIds);
    previousLinkedIdsRef.current = linkedIds;
    if (linkedIds.length > 0) {
      supabase.from('products').select('id, name, name_bn, slug, price, original_price, images').in('id', linkedIds).then(({ data }) => {
        if (data) setLinkedProducts(data);
      });
    } else {
      setLinkedProducts([]);
    }

    // Populate suggested (cross-sell) products
    const suggestedIds: string[] = (product as any).suggested_product_ids || [];
    setSuggestedProductIds(suggestedIds);
    previousSuggestedIdsRef.current = suggestedIds;
    if (suggestedIds.length > 0) {
      supabase.from('products').select('id, name, name_bn, slug, price, original_price, images').in('id', suggestedIds).then(({ data }) => {
        if (data) setSuggestedProducts(data);
      });
    } else {
      setSuggestedProducts([]);
    }

    // Set product type
    if (product.product_type === 'variable' || (product.sizes && product.sizes.length > 0) || (product.colors && product.colors.length > 0)) {
      setProductType('variable');
    } else {
      setProductType(product.product_type === 'simple' ? 'simple' : 'simple');
    }

    // Parse colors & color_images — older products saved a single URL per color;
    // normalize those into a 1-item array so the rest of the editor only ever
    // deals with arrays.
    setColors(product.colors || []);
    const vi = (product.variant_images as any) || {};
    const rawColorImages = (vi.color_images || {}) as Record<string, string | string[]>;
    setColorImages(
      Object.fromEntries(
        Object.entries(rawColorImages).map(([c, v]) => [c, Array.isArray(v) ? v : [v]])
      )
    );
    setColorSizes(vi.color_sizes || {});
    if (vi.default_size) setDefaultSize(String(vi.default_size));

    // Load color_only_stock
    if (vi.color_only_stock) {
      const cos: Record<string, string> = {};
      for (const [color, stock] of Object.entries(vi.color_only_stock as Record<string, number>)) {
        cos[color] = String(stock);
      }
      setColorOnlyStock(cos);
    }

    // Load color_stock from size_data
    if (vi.size_data) {
      const cs: Record<string, Record<string, string>> = {};
      for (const [sizeName, sizeInfo] of Object.entries(vi.size_data as Record<string, any>)) {
        if (sizeInfo.color_stock) {
          for (const [color, stock] of Object.entries(sizeInfo.color_stock as Record<string, number>)) {
            if (!cs[color]) cs[color] = {};
            cs[color][sizeName] = String(stock);
          }
        }
      }
      setColorStock(cs);
    }

    // Parse size_data from variant_images
    if (vi.size_data) {
      const sd = { ...defaultSizeData(FIXED_SIZES) };
      const enabledSizes = product.sizes || [];
      const custom: CustomSize[] = [];
      for (const size of FIXED_SIZES) {
        const d = vi.size_data[size];
        if (d) {
          sd[size] = { price: String(d.price || ''), sale_price: String(d.sale_price || ''), stock: String(d.stock || '0'), enabled: enabledSizes.includes(size) };
        } else if (enabledSizes.includes(size)) {
          sd[size] = { ...sd[size], enabled: true };
        }
      }
      // Load custom sizes (non-fixed sizes)
      for (const s of enabledSizes) {
        if (!(FIXED_SIZES as readonly string[]).includes(s)) {
          const d = vi.size_data[s];
          custom.push({
            name: s,
            price: d ? String(d.price || '') : '',
            sale_price: d ? String(d.sale_price || '') : '',
            stock: d ? String(d.stock || '0') : '0',
            enabled: true,
          });
        }
      }
      setSizeData(sd);
      setCustomSizes(custom);
    } else if (product.sizes?.length) {
      const sd = { ...defaultSizeData(FIXED_SIZES) };
      const custom: CustomSize[] = [];
      for (const s of product.sizes) {
        if (sd[s]) {
          sd[s].enabled = true;
        } else {
          custom.push({ name: s, price: '', sale_price: '', stock: '0', enabled: true });
        }
      }
      setSizeData(sd);
      setCustomSizes(custom);
    }
  }, [product, FIXED_SIZES]);

  // Initialize sizeData when globalSizes loads (new product)
  useEffect(() => {
    if (!product && FIXED_SIZES.length > 0 && Object.keys(sizeData).length === 0) {
      setSizeData(defaultSizeData(FIXED_SIZES));
    }
  }, [FIXED_SIZES]);

  const u = (key: keyof ProductFormState, val: any) => setForm(prev => ({ ...prev, [key]: val }));

  // Auto-slug + sync name_bn (UI has only one name field, keep both columns in sync)
  const handleNameChange = (val: string) => {
    setForm(prev => ({ ...prev, name: val, name_bn: val }));
    if (!isEditing || !form.slug) {
      u('slug', val.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-'));
    }
  };

  // Discount
  const discountPercent = useMemo(() => {
    const p = Number(form.price);
    const op = Number(form.original_price);
    if (op > 0 && p > 0 && p > op) return Math.round(((p - op) / p) * 100);
    return 0;
  }, [form.price, form.original_price]);

  // Profit % from cost price
  const profitPercent = useMemo(() => {
    const sale = Number(form.original_price) || Number(form.price);
    const cost = Number(form.cost_price);
    if (!sale || !cost || cost <= 0) return 0;
    return Math.round(((sale - cost) / cost) * 100);
  }, [form.price, form.original_price, form.cost_price]);

  // Size data helpers
  const updateSize = (size: string, field: keyof SizeData, val: any) => {
    setSizeData(prev => ({ ...prev, [size]: { ...prev[size], [field]: val } }));
  };

  const enabledFixedSizes = FIXED_SIZES.filter(s => sizeData[s]?.enabled);
  const enabledCustomSizes = customSizes.filter(s => s.enabled);
  const allEnabledSizes = [...enabledFixedSizes, ...enabledCustomSizes.map(s => s.name)];

  // Compute total stock: if colors exist, sum from colorStock; otherwise from sizeData
  const hasColors = colors.length > 0;
  const hasColorsOnly = hasColors && allEnabledSizes.length === 0;
  const colorOnlyStockTotal = hasColorsOnly
    ? colors.reduce((sum, c) => sum + (Number(colorOnlyStock[c]) || 0), 0)
    : 0;
  const totalSizeStock = allEnabledSizes.reduce((sum, size) => {
    if (hasColors) {
      // Sum all color stocks for this size
      return sum + colors.reduce((cSum, color) => {
        const isInColor = colorSizes[color]?.includes(size) ?? true;
        if (!isInColor) return cSum;
        return cSum + (Number(colorStock[color]?.[size]) || 0);
      }, 0);
    }
    // No colors: use size-level stock
    const sd = sizeData[size];
    if (sd) return sum + (Number(sd.stock) || 0);
    const cs = customSizes.find(c => c.name === size);
    return sum + (Number(cs?.stock) || 0);
  }, 0);
  const hasSizesEnabled = allEnabledSizes.length > 0;

  // Custom size helpers
  const addCustomSize = async () => {
    const name = newCustomSize.trim();
    if (!name) return;
    if (allEnabledSizes.includes(name) || (FIXED_SIZES as readonly string[]).includes(name)) {
      toast.error('এই সাইজ আগে থেকেই আছে');
      return;
    }
    setCustomSizes(prev => [...prev, { name, price: '', sale_price: '', stock: '0', enabled: true }]);
    setNewCustomSize('');
    // Persist to global_sizes
    await supabase.from('global_sizes' as any).upsert({ name, is_active: true } as any, { onConflict: 'name' });
    qc.invalidateQueries({ queryKey: ['global-sizes-names'] });
  };
  const removeCustomSize = (idx: number) => setCustomSizes(prev => prev.filter((_, i) => i !== idx));
  const updateCustomSize = (idx: number, field: keyof CustomSize, val: any) => {
    setCustomSizes(prev => prev.map((s, i) => i === idx ? { ...s, [field]: val } : s));
  };

  // Color helpers
  const addColor = async () => {
    const name = newColor.trim();
    if (!name) return;
    if (colors.includes(name)) { toast.error('এই রঙ আগে থেকেই আছে'); return; }
    setColors(prev => [...prev, name]);
    setNewColor('');
    // Auto-on: assign all enabled sizes to new color
    if (allEnabledSizes.length > 0) {
      setColorSizes(prev => ({ ...prev, [name]: [...allEnabledSizes] }));
    }
    // Persist to global_colors
    await supabase.from('global_colors' as any).upsert({ name, is_active: true } as any, { onConflict: 'name' });
    qc.invalidateQueries({ queryKey: ['global-colors-names'] });
  };
  const removeColor = (name: string) => {
    setColors(prev => prev.filter(c => c !== name));
    setColorImages(prev => { const n = { ...prev }; delete n[name]; return n; });
  };
  const openColorMedia = (colorName: string) => {
    setActiveColorForMedia(colorName);
    setColorMediaCenterOpen(true);
  };
  const handleColorMediaSelect = (urls: string[]) => {
    if (urls.length > 0 && activeColorForMedia) {
      // Append to whatever this color already has, rather than replacing —
      // opening the picker again is how the admin adds more photos to a color,
      // not how they start over.
      setColorImages(prev => {
        const existing = prev[activeColorForMedia] || [];
        const merged = [...existing, ...urls.filter(u => !existing.includes(u))];
        return { ...prev, [activeColorForMedia]: merged };
      });
    }
    setColorMediaCenterOpen(false);
  };
  const removeColorImage = (color: string, url: string) => {
    setColorImages(prev => ({ ...prev, [color]: (prev[color] || []).filter(u => u !== url) }));
  };
  const makeColorImagePrimary = (color: string, url: string) => {
    setColorImages(prev => ({ ...prev, [color]: [url, ...(prev[color] || []).filter(u => u !== url)] }));
  };

  // Gallery file preview
  useEffect(() => {
    const previews = galleryFiles.map(f => URL.createObjectURL(f));
    setGalleryPreviews(previews);
    return () => previews.forEach(URL.revokeObjectURL);
  }, [galleryFiles]);

  // Upload files
  const uploadFiles = async (files: File[]) => {
    const optimized = await optimizeMultiple(files);
    const urls: string[] = [];
    for (const file of optimized) {
      const ext = file.name.split('.').pop();
      const path = `${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;
      const { error } = await supabase.storage.from('product-images').upload(path, file, { cacheControl: '31536000' });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(path);
      urls.push(publicUrl);
    }
    return urls;
  };

  // Save
  const saveMutation = useMutation({
    mutationFn: async () => {
      let finalImages = [...existingImages];
      if (galleryFiles.length > 0) {
        const newUrls = await uploadFiles(galleryFiles);
        finalImages = [...finalImages, ...newUrls];
      }

      // Build size_data for variant_images
      const sizeDataPayload: Record<string, { price: number; sale_price: number; stock: number }> = {};
      const enabledSizeNames: string[] = [];
      for (const size of FIXED_SIZES) {
        if (sizeData[size]?.enabled) {
          enabledSizeNames.push(size);
          const colorStockMap: Record<string, number> = {};
          if (colors.length > 0) {
            colors.forEach(c => {
              if (colorSizes[c]?.includes(size) ?? true) {
                colorStockMap[c] = Number(colorStock[c]?.[size]) || 0;
              }
            });
          }
          const sizeStockVal = colors.length > 0
            ? Object.values(colorStockMap).reduce((s, v) => s + v, 0)
            : Number(sizeData[size].stock) || 0;
          sizeDataPayload[size] = {
            price: Number(sizeData[size].price) || Number(form.price),
            sale_price: Number(sizeData[size].sale_price) || 0,
            stock: sizeStockVal,
            ...(colors.length > 0 ? { color_stock: colorStockMap } : {}),
          };
        }
      }
      // Add custom sizes
      for (const cs of customSizes) {
        if (cs.enabled) {
          enabledSizeNames.push(cs.name);
          const colorStockMap: Record<string, number> = {};
          if (colors.length > 0) {
            colors.forEach(c => {
              if (colorSizes[c]?.includes(cs.name) ?? true) {
                colorStockMap[c] = Number(colorStock[c]?.[cs.name]) || 0;
              }
            });
          }
          const sizeStockVal = colors.length > 0
            ? Object.values(colorStockMap).reduce((s, v) => s + v, 0)
            : Number(cs.stock) || 0;
          sizeDataPayload[cs.name] = {
            price: Number(cs.price) || Number(form.price),
            sale_price: Number(cs.sale_price) || 0,
            stock: sizeStockVal,
            ...(colors.length > 0 ? { color_stock: colorStockMap } : {}),
          };
        }
      }

      const variantImages: Record<string, any> = {
        size_data: Object.keys(sizeDataPayload).length > 0 ? sizeDataPayload : {},
        show_video_overlay: form.show_video_overlay,
        color_images: colors.length > 0 ? colorImages : {},
        color_sizes: (() => {
          if (colors.length > 0 && enabledSizeNames.length > 0) {
            if (Object.keys(colorSizes).length > 0) {
              const filtered: Record<string, string[]> = {};
              Object.entries(colorSizes).forEach(([color, sizes]) => {
                filtered[color] = sizes.filter(s => enabledSizeNames.includes(s));
              });
              return filtered;
            }
            // Auto-populate: assign all enabled sizes to all colors
            const auto: Record<string, string[]> = {};
            colors.forEach(c => { auto[c] = [...enabledSizeNames]; });
            return auto;
          }
          return {};
        })(),
        // Color-only stock (when colors exist but no sizes)
        color_only_stock: (colors.length > 0 && enabledSizeNames.length === 0) ? (() => {
          const cos: Record<string, number> = {};
          colors.forEach(c => { cos[c] = Number(colorOnlyStock[c]) || 0; });
          return cos;
        })() : {},
        default_size: defaultSize && enabledSizeNames.includes(defaultSize) ? defaultSize : null,
      };

      const computedStock = hasColorsOnly ? colorOnlyStockTotal : (hasSizesEnabled ? totalSizeStock : Number(form.stock));

      const payload: any = {
        name: form.name,
        // Always sync name_bn with name — admin UI has only one name field
        name_bn: form.name,
        slug: form.slug.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-'),
        description: form.description,
        description_bn: form.description_bn,
        price: Number(form.price),
        original_price: form.original_price ? Number(form.original_price) : null,
        cost_price: form.cost_price ? Number(form.cost_price) : null,
        category_id: form.category_id || null,
        stock: computedStock,
        sizes: enabledSizeNames.length > 0 ? enabledSizeNames : null,
        colors: colors.length > 0 ? colors : null,
        is_featured: false,
        is_active: form.is_active,
        is_hidden_from_shop: form.is_hidden_from_shop,
        allow_pre_order: form.allow_pre_order,
        video_url: form.video_url || null,
        seo_title: form.seo_title || null,
        seo_description: form.seo_description || null,
        seo_keywords: form.seo_keywords || null,
        product_type: productType,
        variant_images: variantImages,
        images: finalImages,
        addon_config: addonName.trim() ? { name: addonName.trim(), name_bn: addonName.trim(), price: Number(addonPrice) || 0, image: addonImage || null } : null,
        bump_product_id: bumpProductId || null,
        bump_discount: Number(bumpDiscount) || 0,
        linked_product_ids: linkedProductIds,
        suggested_product_ids: suggestedProductIds,
        clearance_active: form.clearance_active,
        clearance_price: form.clearance_active && form.clearance_price ? Number(form.clearance_price) : null,
      };

      if (isEditing) {
        const { error } = await supabase.from('products').update(payload).eq('id', id);
        if (error) throw error;
        // Post-save verification: ensure bump_product_id persisted
        if (payload.bump_product_id) {
          const { data: verify } = await supabase.from('products').select('bump_product_id, bump_discount').eq('id', id).maybeSingle();
          if (!verify?.bump_product_id) {
            console.warn('bump_product_id did not persist, retrying...');
            await supabase.from('products').update({ bump_product_id: payload.bump_product_id, bump_discount: payload.bump_discount }).eq('id', id);
          }
        }
        return { isNew: false };
      } else {
        const { data, error } = await supabase.from('products').insert(payload).select('id').single();
        if (error) throw error;
        return { isNew: true, newId: data?.id };
      }
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['admin-products'] });
      qc.invalidateQueries({ queryKey: ['admin-product'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['product'] });
      qc.invalidateQueries({ queryKey: ['featured-products'] });
      qc.invalidateQueries({ queryKey: ['new-products'] });
      qc.invalidateQueries({ queryKey: ['best-selling-products'] });
      qc.invalidateQueries({ queryKey: ['homepage-all-products'] });
      toast.success(isEditing ? 'পণ্য আপডেট হয়েছে' : 'পণ্য যোগ হয়েছে');
      
      // Background: auto-optimize feed title/description via AI
      const productId = isEditing ? id : result?.newId;
      if (productId) {
        supabase.functions.invoke('optimize-product-feed', {
          body: { product_id: productId },
        }).then(({ error }) => {
          if (!error) toast.success('Feed অপ্টিমাইজ হয়েছে', { duration: 2000 });
        }).catch(() => { /* silent fail for background task */ });

        // Keep the linked color-variant group symmetric across all members
        syncLinkedProducts(productId, linkedProductIds, previousLinkedIdsRef.current)
          .then(() => { previousLinkedIdsRef.current = linkedProductIds; })
          .catch((e) => console.error('[linkedProducts] sync failed', e));

        // Keep the suggested cross-sell links symmetric too
        syncSuggestedProducts(productId, suggestedProductIds, previousSuggestedIdsRef.current)
          .then(() => { previousSuggestedIdsRef.current = suggestedProductIds; })
          .catch((e) => console.error('[suggestedProducts] sync failed', e));
      }

      if (result?.isNew && result?.newId) {
        navigate(`/admin/products/edit/${result.newId}`, { replace: true });
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-products'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['product'] });
      qc.invalidateQueries({ queryKey: ['featured-products'] });
      qc.invalidateQueries({ queryKey: ['new-products'] });
      qc.invalidateQueries({ queryKey: ['best-selling-products'] });
      qc.invalidateQueries({ queryKey: ['homepage-all-products'] });
      toast.success('পণ্য ডিলিট হয়েছে');
      navigate(-1);
    },
  });

  const removeExistingImage = (idx: number) => setExistingImages(prev => prev.filter((_, i) => i !== idx));
  const removeNewFile = (idx: number) => setGalleryFiles(prev => prev.filter((_, i) => i !== idx));
  const setPrimaryImage = (idx: number) => {
    setExistingImages(prev => {
      const arr = [...prev];
      const [item] = arr.splice(idx, 1);
      return [item, ...arr];
    });
  };

  // Drag-and-drop reordering for images
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const handleImgDragStart = (idx: number) => setDragIdx(idx);
  const handleImgDragOver = (e: React.DragEvent, idx: number) => { e.preventDefault(); setDragOverIdx(idx); };
  const handleImgDragEnd = () => { setDragIdx(null); setDragOverIdx(null); };
  const handleImgDrop = (targetIdx: number) => {
    if (dragIdx === null || dragIdx === targetIdx) { setDragIdx(null); setDragOverIdx(null); return; }
    setExistingImages(prev => {
      const arr = [...prev];
      const [item] = arr.splice(dragIdx, 1);
      arr.splice(targetIdx, 0, item);
      return arr;
    });
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const handleMediaSelect = (urls: string[]) => {
    setExistingImages(prev => [...prev, ...urls]);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setGalleryFiles(prev => [...prev, ...files]);
    e.target.value = '';
  };

  const allPreviewImages = [...existingImages, ...galleryPreviews];
  const primaryImage = allPreviewImages[0];

  if (isEditing && productLoading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mr-2" /> লোড হচ্ছে...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 sticky top-0 z-30 bg-background py-3 -mt-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">{isEditing ? 'পণ্য এডিট করুন' : 'নতুন পণ্য যোগ করুন'}</h1>
        </div>
        <div className="hidden md:flex items-center gap-2">
          {isEditing && (
            <Button variant="destructive" size="sm" onClick={() => { if (confirm('ডিলিট করতে চান?')) deleteMutation.mutate(); }}>
              <Trash2 className="h-4 w-4 mr-1" /> ডিলিট
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => { u('is_active', false); saveMutation.mutate(); }} disabled={saveMutation.isPending}>
            <Save className="h-4 w-4 mr-1" /> ড্রাফট সেভ
          </Button>
          <Button size="sm" onClick={() => { u('is_active', true); saveMutation.mutate(); }} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
            {saveMutation.isPending ? 'সেভ হচ্ছে...' : isEditing ? '🚀 আপডেট করুন' : '🚀 পাবলিশ করুন'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN */}
        <div className="lg:col-span-2 space-y-6">

          {/* Card 1: বেসিক তথ্য */}
          <Card>
            <CardHeader><CardTitle className="text-base">📋 বেসিক তথ্য</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>পণ্যের নাম (ওয়েবসাইটে দেখাবে) *</Label>
                <Input value={form.name} onChange={e => handleNameChange(e.target.value)} placeholder="পণ্যের নাম লিখুন" />
              </div>
              <div>
                <Label className="text-xs">URL স্লাগ</Label>
                <Input value={form.slug} onChange={e => u('slug', e.target.value)} placeholder="product-slug" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>ক্যাটাগরি</Label>
                  <select value={form.category_id} onChange={e => u('category_id', e.target.value)}
                    className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background">
                    <option value="">কোনোটি নয়</option>
                    {(() => {
                      const mains = categories.filter((c: any) => !c.parent_id);
                      return mains.map((mc: any) => {
                        const subs = categories.filter((c: any) => c.parent_id === mc.id);
                        return (
                          <optgroup key={mc.id} label={mc.name_bn || mc.name}>
                            <option value={mc.id}>{mc.name_bn || mc.name} (সব)</option>
                            {subs.map((sc: any) => <option key={sc.id} value={sc.id}>└ {sc.name_bn || sc.name}</option>)}
                          </optgroup>
                        );
                      });
                    })()}
                  </select>
                </div>
              <div className="flex items-center gap-6 pt-5 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Switch checked={form.is_active} onCheckedChange={v => u('is_active', v)} />
                    <Label className="text-sm">{form.is_active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={form.is_hidden_from_shop} onCheckedChange={v => u('is_hidden_from_shop', v)} />
                    <Label className="text-sm flex items-center gap-1">
                      {form.is_hidden_from_shop ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      {form.is_hidden_from_shop ? 'শপ থেকে হিডেন' : 'শপে দেখাচ্ছে'}
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={form.allow_pre_order} onCheckedChange={v => u('allow_pre_order', v)} />
                    <Label className="text-sm">{form.allow_pre_order ? 'প্রি-অর্ডার চালু' : 'প্রি-অর্ডার বন্ধ'}</Label>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">প্রি-অর্ডার বন্ধ থাকলে স্টক শেষ হলে পণ্য শপ থেকে অটো অফ হবে।</p>
              </div>
              {/* Product Type Selector */}
              <div>
                <Label className="mb-2 block">পণ্যের ধরন</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={productType === 'simple' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setProductType('simple')}
                  >
                    📦 সিম্পল পণ্য
                  </Button>
                  <Button
                    type="button"
                    variant={productType === 'variable' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setProductType('variable')}
                  >
                    🔀 ভেরিয়েবল পণ্য
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {productType === 'simple' ? 'সাধারণ পণ্য — সাইজ/কালার ঐচ্ছিক' : 'সাইজ, কালার ও ভেরিয়েন্ট সহ পণ্য'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: দাম ও স্টক */}
          <Card>
            <CardHeader><CardTitle className="text-base">💰 দাম ও স্টক</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label>নিয়মিত মূল্য (৳) *</Label>
                  <Input type="number" value={form.price} onChange={e => u('price', e.target.value)} />
                </div>
                <div>
                  <Label className="flex items-center gap-2">
                    সেল মূল্য (৳)
                    {discountPercent > 0 && <Badge variant="destructive" className="text-[10px]">-{discountPercent}%</Badge>}
                  </Label>
                  <Input type="number" value={form.original_price} onChange={e => u('original_price', e.target.value)} placeholder="ঐচ্ছিক" />
                </div>
                <div>
                  <Label className="flex items-center gap-2">
                    কেনা মূল্য (৳)
                    {profitPercent !== 0 && (
                      <Badge variant={profitPercent > 0 ? 'default' : 'destructive'} className={cn("text-[10px]", profitPercent > 0 && "bg-green-600 hover:bg-green-700")}>
                        {profitPercent > 0 ? '+' : ''}{profitPercent}%
                      </Badge>
                    )}
                  </Label>
                  <Input type="number" value={form.cost_price} onChange={e => u('cost_price', e.target.value)} placeholder="ঐচ্ছিক" />
                </div>
                <div>
                  <Label>মোট স্টক {hasSizesEnabled && <span className="text-muted-foreground font-normal">(অটো: {totalSizeStock})</span>}</Label>
                  <Input
                    type="number"
                    value={hasSizesEnabled ? totalSizeStock : form.stock}
                    onChange={e => u('stock', e.target.value)}
                    disabled={hasSizesEnabled}
                  />
                </div>
              </div>

              {/* Stock Clearance Offer */}
              <div className="mt-4 p-3 rounded-lg border border-rose-200 bg-gradient-to-br from-rose-50 to-orange-50 dark:from-rose-950/20 dark:to-orange-950/20">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🏷️</span>
                    <Label className="font-semibold">স্টক ক্লিয়ারেন্স অফার</Label>
                    {form.clearance_active && form.clearance_price && Number(form.clearance_price) > 0 && (
                      <Badge variant="destructive" className="text-[10px]">এক্টিভ</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">চালু করুন</span>
                    <Switch checked={form.clearance_active} onCheckedChange={(v) => u('clearance_active', v)} />
                  </div>
                </div>
                {form.clearance_active && (
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                    <div className="md:col-span-1">
                      <Label className="text-xs">ক্লিয়ারেন্স অফার মূল্য (৳) *</Label>
                      <Input
                        type="number"
                        value={form.clearance_price}
                        onChange={e => u('clearance_price', e.target.value)}
                        placeholder="যেমন: 350"
                      />
                    </div>
                    <p className="md:col-span-2 text-xs text-muted-foreground leading-relaxed">
                      এই দাম দিলে প্রোডাক্টটি হোমপেজের <strong>স্টক ক্লিয়ারেন্স</strong> সেকশনে অটো দেখাবে এবং কাস্টমার এই দামেই কিনবে। দাম অবশ্যই বর্তমান সেল প্রাইসের থেকে কম হতে হবে।
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Card 3: সাইজভিত্তিক মূল্য ও স্টক */}
          <Card>
            <CardHeader><CardTitle className="text-base">📏 সাইজভিত্তিক মূল্য ও স্টক</CardTitle></CardHeader>
            <CardContent>
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-20">সাইজ</TableHead>
                      <TableHead>মূল্য (৳)</TableHead>
                      <TableHead>সেল মূল্য (৳)</TableHead>
                      {!hasColors && <TableHead>স্টক</TableHead>}
                      <TableHead className="w-20 text-center">সক্রিয়</TableHead>
                      <TableHead className="w-20 text-center">ডিফল্ট</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {FIXED_SIZES.map(size => (
                      <TableRow key={size} className={sizeData[size]?.enabled ? '' : 'opacity-50'}>
                        <TableCell className="font-medium">{size}</TableCell>
                        <TableCell>
                          <Input type="number" value={sizeData[size]?.price || ''} onChange={e => updateSize(size, 'price', e.target.value)}
                            placeholder={form.price || '0'} className="h-8 w-28" disabled={!sizeData[size]?.enabled} />
                        </TableCell>
                        <TableCell>
                          <Input type="number" value={sizeData[size]?.sale_price || ''} onChange={e => updateSize(size, 'sale_price', e.target.value)}
                            placeholder={form.original_price || 'ঐচ্ছিক'} className="h-8 w-28" disabled={!sizeData[size]?.enabled} />
                        </TableCell>
                        {!hasColors && (
                          <TableCell>
                            <Input type="number" value={sizeData[size]?.stock || ''} onChange={e => updateSize(size, 'stock', e.target.value)}
                              placeholder="0" className="h-8 w-20" disabled={!sizeData[size]?.enabled} />
                          </TableCell>
                        )}
                        <TableCell className="text-center">
                          <Switch checked={sizeData[size]?.enabled || false} onCheckedChange={v => updateSize(size, 'enabled', v)} />
                        </TableCell>
                        <TableCell className="text-center">
                          <input
                            type="radio"
                            name="default-size"
                            checked={defaultSize === size}
                            disabled={!sizeData[size]?.enabled}
                            onChange={() => setDefaultSize(size)}
                            className="h-4 w-4 accent-primary cursor-pointer disabled:cursor-not-allowed"
                            title="ডিফল্ট সাইজ হিসেবে সেট করুন"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {customSizes.map((cs, idx) => (
                <div key={cs.name} className="flex items-center gap-2 px-2 py-1.5 border border-border rounded-md bg-muted/30">
                  <span className="font-medium text-sm w-16 truncate">{cs.name}</span>
                  <Input type="number" value={cs.price} onChange={e => updateCustomSize(idx, 'price', e.target.value)}
                    placeholder={form.price || '0'} className="h-8 w-28" disabled={!cs.enabled} />
                  <Input type="number" value={cs.sale_price} onChange={e => updateCustomSize(idx, 'sale_price', e.target.value)}
                    placeholder={form.original_price || 'ঐচ্ছিক'} className="h-8 w-28" disabled={!cs.enabled} />
                  {!hasColors && (
                    <Input type="number" value={cs.stock} onChange={e => updateCustomSize(idx, 'stock', e.target.value)}
                      placeholder="0" className="h-8 w-20" disabled={!cs.enabled} />
                  )}
                  <Switch checked={cs.enabled} onCheckedChange={v => updateCustomSize(idx, 'enabled', v)} />
                  <input
                    type="radio"
                    name="default-size"
                    checked={defaultSize === cs.name}
                    disabled={!cs.enabled}
                    onChange={() => setDefaultSize(cs.name)}
                    className="h-4 w-4 accent-primary cursor-pointer disabled:cursor-not-allowed"
                    title="ডিফল্ট সাইজ"
                  />
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeCustomSize(idx)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}

              <div className="flex gap-2 mt-3">
                <Input value={newCustomSize} onChange={e => setNewCustomSize(e.target.value)}
                  placeholder="নতুন সাইজ (যেমন: Free Size, 28, 42)" className="h-8"
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomSize())} />
                <Button variant="outline" size="sm" className="h-8 shrink-0" onClick={addCustomSize}>যোগ করুন</Button>
              </div>

              {hasSizesEnabled && (
                <p className="text-xs text-muted-foreground mt-2">
                  ✓ {allEnabledSizes.join(', ')} সক্রিয় | মোট স্টক: {totalSizeStock}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Color Management Card */}
          <Card>
            <CardHeader><CardTitle className="text-base">🎨 রঙ</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {/* Global color suggestions */}
              {globalColors.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {globalColors.filter(c => !colors.includes(c)).map(c => (
                    <Button key={c} variant="outline" size="sm" className="h-7 text-xs"
                      onClick={() => {
                        setColors(prev => [...prev, c]);
                        if (allEnabledSizes.length > 0) {
                          setColorSizes(prev => ({ ...prev, [c]: [...allEnabledSizes] }));
                        }
                      }}>
                      + {c}
                    </Button>
                  ))}
                </div>
              )}
              {/* Add color input */}
              <div className="flex gap-2">
                <Input value={newColor} onChange={e => setNewColor(e.target.value)}
                  placeholder="কাস্টম রঙ যোগ করুন..." className="h-9"
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addColor())} />
                <Button variant="outline" size="sm" className="h-9 shrink-0" onClick={addColor}>যোগ করুন</Button>
              </div>

              {/* Color list with inline size/stock tables */}
              {colors.length > 0 && (
                <div className="space-y-2">
                  {colors.map(color => (
                    <div key={color} className="border border-border rounded-md bg-muted/30 overflow-hidden">
                      <div className="flex items-center gap-3 p-2">
                        {/* Thumbnail — always this color's primary (first) photo */}
                        <button type="button" onClick={() => openColorMedia(color)}
                          className="relative w-10 h-10 rounded-md border border-dashed border-border bg-background flex items-center justify-center overflow-hidden shrink-0 hover:border-primary transition-colors">
                          {colorImages[color]?.[0] ? (
                            <img src={colorImages[color][0]} alt={color} className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon className="h-4 w-4 text-muted-foreground" />
                          )}
                          {(colorImages[color]?.length || 0) > 1 && (
                            <span className="absolute bottom-0 right-0 bg-primary text-primary-foreground text-[9px] font-bold px-1 rounded-tl-md leading-tight">
                              {colorImages[color].length}
                            </span>
                          )}
                        </button>
                        <span className="text-sm font-medium flex-1">{color}</span>
                        {/* Color-only stock input when no sizes are enabled */}
                        {hasColorsOnly && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">স্টক:</span>
                            <Input
                              type="number"
                              value={colorOnlyStock[color] || ''}
                              onChange={e => setColorOnlyStock(prev => ({ ...prev, [color]: e.target.value }))}
                              placeholder="0"
                              className="h-7 w-20 text-xs"
                            />
                          </div>
                        )}
                        {allEnabledSizes.length > 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setActiveSizeColor(prev => prev === color ? 'all' : color)}
                          >
                            {activeSizeColor === color ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openColorMedia(color)}>
                          ছবি{(colorImages[color]?.length || 0) > 0 ? ` (${colorImages[color].length})` : ''}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeColor(color)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      {/* This color's own photo set — first is primary (product card + swatch icon).
                          Click a photo to make it primary; ✕ removes it. */}
                      {(colorImages[color]?.length || 0) > 0 && (
                        <div className="border-t border-border px-2 py-2 flex flex-wrap gap-2">
                          {colorImages[color].map((url, idx) => (
                            <div key={url} className="relative group">
                              <button type="button" onClick={() => makeColorImagePrimary(color, url)}
                                className={cn(
                                  'w-12 h-12 rounded-md overflow-hidden border-2 transition-colors',
                                  idx === 0 ? 'border-primary' : 'border-border hover:border-primary/50'
                                )}
                                title={idx === 0 ? 'প্রাইমারি ছবি' : 'প্রাইমারি করতে ক্লিক করুন'}>
                                <img src={url} alt="" className="w-full h-full object-cover" />
                              </button>
                              {idx === 0 && (
                                <span className="absolute -top-1 -left-1 bg-primary text-primary-foreground text-[8px] font-bold rounded-full h-4 w-4 flex items-center justify-center">★</span>
                              )}
                              <button type="button" onClick={() => removeColorImage(color, url)}
                                className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full h-4 w-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <X className="h-2.5 w-2.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Inline size/stock table for this color */}
                      {activeSizeColor === color && (
                        <div className="border-t border-border px-2 pb-2 pt-1">
                          {allEnabledSizes.length === 0 ? (
                            <p className="text-xs text-muted-foreground py-2">প্রথমে সাইজ সক্রিয় করুন</p>
                          ) : (
                            <div className="rounded-md border border-border overflow-hidden">
                              <Table>
                                <TableHeader>
                                  <TableRow className="bg-muted/50">
                                    <TableHead className="h-8 text-xs w-20">সাইজ</TableHead>
                                    <TableHead className="h-8 text-xs">স্টক</TableHead>
                                    <TableHead className="h-8 text-xs w-16 text-center">সক্রিয়</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {allEnabledSizes.map(size => {
                                    const isInColor = colorSizes[color]?.includes(size) ?? true;
                                    return (
                                      <TableRow key={size} className={isInColor ? '' : 'opacity-50'}>
                                        <TableCell className="font-medium py-1 text-xs">{size}</TableCell>
                                        <TableCell className="py-1">
                                          <Input
                                            type="number"
                                            value={colorStock[color]?.[size] || ''}
                                            onChange={e => {
                                              const val = e.target.value;
                                              setColorStock(prev => ({
                                                ...prev,
                                                [color]: {
                                                  ...(prev[color] || {}),
                                                  [size]: val,
                                                },
                                              }));
                                            }}
                                            placeholder="0"
                                            className="h-7 w-20 text-xs"
                                            disabled={!isInColor}
                                          />
                                        </TableCell>
                                        <TableCell className="text-center py-1">
                                          <Switch
                                            checked={isInColor}
                                            onCheckedChange={v => {
                                              setColorSizes(prev => {
                                                const current = prev[color] || [];
                                                if (v) {
                                                  return { ...prev, [color]: [...current, size] };
                                                } else {
                                                  return { ...prev, [color]: current.filter(s => s !== size) };
                                                }
                                              });
                                            }}
                                          />
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {hasColorsOnly && colors.length > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  ✓ মোট স্টক (কালার): {colorOnlyStockTotal}
                </p>
              )}

              {colors.length === 0 && (
                <p className="text-xs text-muted-foreground">কোনো রঙ যোগ করা হয়নি</p>
              )}
            </CardContent>
          </Card>

          {/* Linked Color-Variant Products Card */}
          <Card>
            <CardHeader><CardTitle className="text-base">🔗 কালার ভ্যারিয়েন্ট লিংক (অন্য প্রোডাক্ট)</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                একই ডিজাইনের অন্য রঙের প্রোডাক্ট আলাদাভাবে আপলোড করা থাকলে এখানে লিংক করুন — কাস্টমার যেকোনো একটায় গেলে বাকি রঙগুলো "কালার অপশন" হিসেবে দেখতে পাবে ও ক্লিক করে সেই প্রোডাক্টে চলে যেতে পারবে।
              </p>

              {linkedProducts.length > 0 && (
                <div className="space-y-1.5">
                  {linkedProducts.map(p => (
                    <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 border border-border">
                      {p.images?.[0] && <img src={p.images[0]} alt="" className="w-12 h-12 rounded-md object-cover" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.name_bn || p.name}</p>
                        <p className="text-xs text-muted-foreground">৳{p.original_price || p.price}</p>
                      </div>
                      <Button
                        type="button" variant="ghost" size="sm"
                        onClick={() => {
                          setLinkedProductIds(prev => prev.filter(pid => pid !== p.id));
                          setLinkedProducts(prev => prev.filter(lp => lp.id !== p.id));
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select
                  value={linkedBrowseCategory}
                  onChange={async (e) => {
                    const catId = e.target.value;
                    setLinkedBrowseCategory(catId);
                    setLinkedSearch('');
                    await fetchLinkedDefaults(catId);
                  }}
                  className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                >
                  <option value="">ক্যাটাগরি দেখে ব্রাউজ করুন...</option>
                  {(() => {
                    const mains = categories.filter((c: any) => !c.parent_id);
                    return mains.map((mc: any) => {
                      const subs = categories.filter((c: any) => c.parent_id === mc.id);
                      return (
                        <optgroup key={mc.id} label={mc.name_bn || mc.name}>
                          <option value={mc.id}>{mc.name_bn || mc.name} (সব)</option>
                          {subs.map((sc: any) => <option key={sc.id} value={sc.id}>└ {sc.name_bn || sc.name}</option>)}
                        </optgroup>
                      );
                    });
                  })()}
                </select>
                <div className="relative">
                  <Input
                    value={linkedSearch}
                    onFocus={() => {
                      if (linkedSearch.length < 2) fetchLinkedDefaults(linkedBrowseCategory);
                    }}
                    onChange={async (e) => {
                      setLinkedSearch(e.target.value);
                      if (e.target.value.length < 2) { await fetchLinkedDefaults(linkedBrowseCategory); return; }
                      const q = e.target.value.toLowerCase();
                      const { data } = await supabase.from('products').select('id, name, name_bn, slug, price, original_price, images')
                        .neq('id', id || '').or(`name.ilike.%${q}%,name_bn.ilike.%${q}%,slug.ilike.%${q}%`).limit(8);
                      setLinkedSearchResults((data || []).filter(p => !linkedProductIds.includes(p.id)));
                    }}
                    placeholder="নাম লিখে সার্চ করুন, বা খালি রেখে সাম্প্রতিক আপলোড দেখুন..."
                  />
                {linkedSearchResults.length > 0 && (
                  <div className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {linkedSearchResults.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        className="flex items-center gap-3 w-full px-3 py-2 hover:bg-muted text-left"
                        onClick={() => {
                          setLinkedProductIds(prev => [...prev, p.id]);
                          setLinkedProducts(prev => [...prev, p]);
                          setLinkedSearch('');
                          setLinkedSearchResults([]);
                        }}
                      >
                        {p.images?.[0] && <img src={p.images[0]} alt="" className="w-10 h-10 rounded object-cover" />}
                        <div>
                          <p className="text-sm font-medium">{p.name_bn || p.name}</p>
                          <p className="text-xs text-muted-foreground">৳{p.original_price || p.price}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                </div>
              </div>

              {linkedProducts.length === 0 && (
                <p className="text-xs text-muted-foreground">কোনো কালার ভ্যারিয়েন্ট লিংক করা নেই</p>
              )}
            </CardContent>
          </Card>

          {/* Suggested (cross-sell) Products Card */}
          <Card>
            <CardHeader><CardTitle className="text-base">🛍️ সাজেশন প্রোডাক্ট (সম্পর্কিত পণ্যে প্রথমে দেখাবে)</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                এখানে যেসব প্রোডাক্ট লিংক করবেন, সেগুলো একে অপরের "সম্পর্কিত পণ্য" সেকশনে সবার আগে দেখাবে — কাস্টমার এই গ্রুপের যেকোনো একটায় ঢুকলেই বাকিগুলো আগে দেখতে পাবে।
              </p>

              {suggestedProducts.length > 0 && (
                <div className="space-y-1.5">
                  {suggestedProducts.map(p => (
                    <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 border border-border">
                      {p.images?.[0] && <img src={p.images[0]} alt="" className="w-12 h-12 rounded-md object-cover" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.name_bn || p.name}</p>
                        <p className="text-xs text-muted-foreground">৳{p.original_price || p.price}</p>
                      </div>
                      <Button
                        type="button" variant="ghost" size="sm"
                        onClick={() => {
                          setSuggestedProductIds(prev => prev.filter(pid => pid !== p.id));
                          setSuggestedProducts(prev => prev.filter(sp => sp.id !== p.id));
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select
                  value={suggestedBrowseCategory}
                  onChange={async (e) => {
                    const catId = e.target.value;
                    setSuggestedBrowseCategory(catId);
                    setSuggestedSearch('');
                    await fetchSuggestedDefaults(catId);
                  }}
                  className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                >
                  <option value="">ক্যাটাগরি দেখে ব্রাউজ করুন...</option>
                  {(() => {
                    const mains = categories.filter((c: any) => !c.parent_id);
                    return mains.map((mc: any) => {
                      const subs = categories.filter((c: any) => c.parent_id === mc.id);
                      return (
                        <optgroup key={mc.id} label={mc.name_bn || mc.name}>
                          <option value={mc.id}>{mc.name_bn || mc.name} (সব)</option>
                          {subs.map((sc: any) => <option key={sc.id} value={sc.id}>└ {sc.name_bn || sc.name}</option>)}
                        </optgroup>
                      );
                    });
                  })()}
                </select>
                <div className="relative">
                  <Input
                    value={suggestedSearch}
                    onFocus={() => {
                      if (suggestedSearch.length < 2) fetchSuggestedDefaults(suggestedBrowseCategory);
                    }}
                    onChange={async (e) => {
                      setSuggestedSearch(e.target.value);
                      if (e.target.value.length < 2) { await fetchSuggestedDefaults(suggestedBrowseCategory); return; }
                      const q = e.target.value.toLowerCase();
                      const { data } = await supabase.from('products').select('id, name, name_bn, slug, price, original_price, images')
                        .neq('id', id || '').or(`name.ilike.%${q}%,name_bn.ilike.%${q}%,slug.ilike.%${q}%`).limit(8);
                      setSuggestedSearchResults((data || []).filter(p => !suggestedProductIds.includes(p.id)));
                    }}
                    placeholder="নাম লিখে সার্চ করুন, বা খালি রেখে সাম্প্রতিক আপলোড দেখুন..."
                  />
                {suggestedSearchResults.length > 0 && (
                  <div className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {suggestedSearchResults.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        className="flex items-center gap-3 w-full px-3 py-2 hover:bg-muted text-left"
                        onClick={() => {
                          setSuggestedProductIds(prev => [...prev, p.id]);
                          setSuggestedProducts(prev => [...prev, p]);
                          setSuggestedSearch('');
                          setSuggestedSearchResults([]);
                        }}
                      >
                        {p.images?.[0] && <img src={p.images[0]} alt="" className="w-10 h-10 rounded object-cover" />}
                        <div>
                          <p className="text-sm font-medium">{p.name_bn || p.name}</p>
                          <p className="text-xs text-muted-foreground">৳{p.original_price || p.price}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                </div>
              </div>

              {suggestedProducts.length === 0 && (
                <p className="text-xs text-muted-foreground">কোনো সাজেশন প্রোডাক্ট লিংক করা নেই</p>
              )}
            </CardContent>
          </Card>

          {/* Card 4: বিবরণ */}
          <Card>
            <CardHeader><CardTitle className="text-base">📝 বিবরণ</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>সংক্ষিপ্ত বিবরণ / ক্যাপশন</Label>
                  <AIGenerateButton
                    loading={aiLoading}
                    size="sm"
                    tooltip="AI দিয়ে ছোট ক্যাপশন তৈরি করুন"
                    onClick={async () => {
                      if (!form.name.trim()) {
                        toast.error('আগে পণ্যের নাম দিন');
                        return;
                      }
                      const catName = categories.find(c => c.id === form.category_id)?.name || '';
                      const context = `ক্যাটেগরি: ${catName}\nমূল্য: ৳${form.price}`;
                      const result = await generateAI('caption',
                        `প্রোডাক্ট: ${form.name}${form.name_bn ? ' (' + form.name_bn + ')' : ''}`, context);
                      if (result) {
                        u('description', result.trim());
                        toast.success('ক্যাপশন তৈরি হয়েছে');
                      }
                    }}
                  />
                </div>
                <textarea value={form.description} onChange={e => u('description', e.target.value)}
                  className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background min-h-[80px] resize-y"
                  placeholder="সংক্ষেপে পণ্যের বিবরণ..." />
              </div>
              <div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">লম্বা/লং (ইঞ্চি) — সব সাইজে একই থাকবে</Label>
                    <Input value={aiLength} onChange={e => setAiLength(e.target.value)} placeholder="যেমন: ৪২" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">সেলোয়ার মাপ (কোমর/লম্বা)</Label>
                    <Input value={aiSalwarMeasure} onChange={e => setAiSalwarMeasure(e.target.value)} placeholder="যেমন: ৩৯/৩৯" className="h-8 text-sm" />
                  </div>
                </div>
                <div className="flex items-center justify-between mb-1">
                  <Label>বিস্তারিত বিবরণ (বাংলা)</Label>
                  <div className="flex items-center gap-1">
                    {form.description_bn && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setDescPreview(p => !p)}
                        className="h-7 w-7"
                        title={descPreview ? '✏️ HTML এডিট করুন' : '👁 প্রিভিউ দেখান'}
                      >
                        {descPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                    )}
                    <AIGenerateButton
                      loading={aiLoading}
                      tooltip="AI দিয়ে ব্র্যান্ডেড বিবরণ তৈরি করুন"
                      onClick={async () => {
                        const catName = categories.find(c => c.id === form.category_id)?.name || '';
                        const enabledSizes = Object.entries(sizeData).filter(([,v]) => v.enabled).map(([s]) => s);
                        const sizeList = enabledSizes.join(', ');
                        const activeColors = colors.join(', ');
                        let context = `ক্যাটেগরি: ${catName}\nসাইজ তালিকা: ${sizeList}\n(মোট ${enabledSizes.length}টি সাইজ — প্রতিটির জন্য আলাদা রো তৈরি করো)\nরঙ: ${activeColors}\nমূল্য: ৳${form.price}`;
                        if (aiLength.trim()) context += `\nলম্বা/লং (ইঞ্চি) — সব সাইজে অভিন্ন: ${aiLength.trim()}`;
                        if (aiSalwarMeasure.trim()) context += `\nসেলোয়ার মাপ (কোমর/লম্বা): ${aiSalwarMeasure.trim()}`;
                        let result = await generateAI('product_description',
                          `প্রোডাক্টের নাম: ${form.name}\nসংক্ষেপ: ${form.description}`, context);
                        if (result) {
                          // Strip markdown code fences if AI wrapped them
                          result = result.trim().replace(/^```(?:html)?\s*\n?/i, '').replace(/\n?\s*```$/i, '').trim();
                          u('description_bn', result);
                          setDescPreview(true);
                          toast.success('বিবরণ জেনারেট হয়েছে');
                        }
                      }}
                    />
                  </div>
                </div>
                {descPreview && form.description_bn ? (
                  <div className="relative group">
                    <div
                      className="sd-product-desc w-full border border-input rounded-md px-3 py-2 text-sm bg-background min-h-[120px] overflow-auto max-h-[400px]"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(form.description_bn) }}
                    />
                    <Button
                      type="button" variant="secondary" size="sm"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                      onClick={() => setDescPreview(false)}
                    >✏️ এডিট</Button>
                  </div>
                ) : (
                  <VisualDescriptionEditor
                    value={form.description_bn}
                    onChange={(html) => u('description_bn', html)}
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Card 5: ভিডিও */}
          <Collapsible>
            <Card>
              <CollapsibleTrigger className="w-full">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">🎬 ভিডিও</CardTitle>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4 pt-0">
                  <div>
                    <Label>ভিডিও URL (YouTube, Shorts বা MP4)</Label>
                    <Input value={form.video_url} onChange={e => u('video_url', e.target.value)} placeholder="https://youtube.com/watch?v=... বা youtube.com/shorts/..." />
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={form.show_video_overlay} onCheckedChange={v => u('show_video_overlay', v)} />
                    <Label className="text-sm">পণ্যের ছবিতে ভিডিও দেখান</Label>
                  </div>
                  {form.video_url && form.show_video_overlay && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
                      <Play className="h-4 w-4 text-primary" />
                      ফ্রন্টেন্ডে পণ্যের ছবির উপর প্লে আইকন দেখাবে
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Card 6: অপশনাল অ্যাড-অন ও বাম্প প্রোডাক্ট */}
          <Collapsible>
            <Card>
              <CollapsibleTrigger className="w-full">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">🎁 অ্যাড-অন ও বাম্প প্রোডাক্ট</CardTitle>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-6 pt-0">
                  {/* Addon Section */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-foreground">📦 বিল্ট-ইন অ্যাড-অন (যেমন ব্লাউজ পিস)</h4>
                    <p className="text-xs text-muted-foreground">এই প্রোডাক্টের সাথে অপশনাল আইটেম যোগ করুন — কাস্টমার চাইলে নিবে</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">অ্যাড-অন নাম</Label>
                        <Input value={addonName} onChange={e => setAddonName(e.target.value)} placeholder="যেমন: ব্লাউজ পিস" />
                      </div>
                      <div>
                        <Label className="text-xs">দাম (৳)</Label>
                        <Input type="number" value={addonPrice} onChange={e => setAddonPrice(e.target.value)} placeholder="250" />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {addonImage ? (
                        <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-border">
                          <img src={addonImage} alt="Addon" className="w-full h-full object-cover" />
                          <button type="button" onClick={() => setAddonImage('')} className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full p-0.5">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : null}
                      <Button type="button" variant="outline" size="sm" onClick={() => setAddonMediaOpen(true)}>
                        <ImageIcon className="h-3 w-3 mr-1" /> ছবি নির্বাচন
                      </Button>
                      {addonName && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => { setAddonName(''); setAddonPrice(''); setAddonImage(''); }}>
                          <X className="h-3 w-3 mr-1" /> সরান
                        </Button>
                      )}
                    </div>
                    {addonName && (
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                        {addonImage && <img src={addonImage} alt="" className="w-10 h-10 rounded object-cover" />}
                        <div>
                          <p className="text-sm font-medium">{addonName}</p>
                          <p className="text-xs text-muted-foreground">৳{addonPrice || 0}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-border" />

                  {/* Bump Product Section */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-foreground">🔗 বাম্প প্রোডাক্ট (অন্য প্রোডাক্ট লিংক)</h4>
                    <p className="text-xs text-muted-foreground">আপলোড করা অন্য একটি প্রোডাক্ট সার্চ করে এই প্রোডাক্টের সাথে লিংক করুন</p>
                    
                    {bumpProduct ? (
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                        {bumpProduct.images?.[0] && <img src={bumpProduct.images[0]} alt="" className="w-14 h-14 rounded-lg object-cover" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{bumpProduct.name_bn || bumpProduct.name}</p>
                          <p className="text-xs text-muted-foreground">
                            ৳{bumpProduct.original_price || bumpProduct.price}
                            {Number(bumpDiscount) > 0 && <span className="text-primary ml-1">(-৳{bumpDiscount} ছাড়)</span>}
                          </p>
                        </div>
                        <Button type="button" variant="ghost" size="sm" onClick={() => { setBumpProductId(''); setBumpProduct(null); setBumpDiscount('0'); }}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="relative">
                        <Input
                          value={bumpSearch}
                          onChange={async (e) => {
                            setBumpSearch(e.target.value);
                            if (e.target.value.length < 2) { setBumpSearchResults([]); return; }
                            const q = e.target.value.toLowerCase();
                            const { data } = await supabase.from('products').select('id, name, name_bn, slug, price, original_price, images')
                              .eq('is_active', true).neq('id', id || '').or(`name.ilike.%${q}%,name_bn.ilike.%${q}%,slug.ilike.%${q}%`).limit(6);
                            setBumpSearchResults(data || []);
                          }}
                          placeholder="প্রোডাক্ট সার্চ করুন..."
                        />
                        {bumpSearchResults.length > 0 && (
                          <div className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                            {bumpSearchResults.map(p => (
                              <button
                                key={p.id}
                                type="button"
                                className="flex items-center gap-3 w-full px-3 py-2 hover:bg-muted text-left"
                                onClick={() => {
                                  setBumpProductId(p.id);
                                  setBumpProduct(p);
                                  setBumpSearch('');
                                  setBumpSearchResults([]);
                                }}
                              >
                                {p.images?.[0] && <img src={p.images[0]} alt="" className="w-10 h-10 rounded object-cover" />}
                                <div>
                                  <p className="text-sm font-medium">{p.name_bn || p.name}</p>
                                  <p className="text-xs text-muted-foreground">৳{p.original_price || p.price}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {bumpProductId && (
                      <div>
                        <Label className="text-xs">বাম্প ডিসকাউন্ট (৳)</Label>
                        <Input type="number" value={bumpDiscount} onChange={e => setBumpDiscount(e.target.value)} placeholder="0" className="w-32" />
                      </div>
                    )}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Card 7: SEO & Meta */}
          <Collapsible>
            <Card>
              <CollapsibleTrigger className="w-full">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">🔍 SEO ও মেটা</CardTitle>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4 pt-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">পণ্যের নাম থেকে SEO অটো-জেনারেট</span>
                    <AIGenerateButton
                      loading={aiLoading}
                      size="sm"
                      tooltip="AI দিয়ে SEO টাইটেল ও বিবরণ জেনারেট করুন"
                      onClick={async () => {
                        const catName = categories.find(c => c.id === form.category_id)?.name || '';
                        const result = await generateAI('seo', `প্রোডাক্টের নাম: ${form.name}\nমূল্য: ৳${form.price}\nক্যাটেগরি: ${catName}\nবিবরণ: ${form.description || form.description_bn}`);
                        if (result) {
                          let cleaned = result.trim();
                          cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?\s*```$/i, '').trim();
                          const applySeo = (p: any) => {
                            if (p.seo_title) u('seo_title', p.seo_title);
                            if (p.seo_description) u('seo_description', p.seo_description);
                            if (p.seo_keywords) u('seo_keywords', p.seo_keywords);
                            toast.success('SEO তথ্য জেনারেট হয়েছে');
                          };
                          try {
                            applySeo(JSON.parse(cleaned));
                          } catch {
                            const m = cleaned.match(/\{[\s\S]*"seo_title"[\s\S]*\}/);
                            if (m) { try { applySeo(JSON.parse(m[0])); } catch { u('seo_description', result); } }
                            else { u('seo_description', result); }
                          }
                        }
                      }}
                    />
                  </div>
                  <div>
                    <Label className="flex items-center justify-between text-xs">
                      মেটা টাইটেল <span className="text-muted-foreground">{form.seo_title.length}/60</span>
                    </Label>
                    <Input value={form.seo_title} onChange={e => u('seo_title', e.target.value)} maxLength={60} placeholder="SEO টাইটেল" />
                  </div>
                  <div>
                    <Label className="flex items-center justify-between text-xs">
                      মেটা বিবরণ <span className="text-muted-foreground">{form.seo_description.length}/160</span>
                    </Label>
                    <textarea value={form.seo_description} onChange={e => u('seo_description', e.target.value)} maxLength={160}
                      className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background min-h-[60px] resize-y"
                      placeholder="SEO বিবরণ..." />
                  </div>
                  <div>
                    <Label className="text-xs">SEO কীওয়ার্ড (কমা দিয়ে আলাদা)</Label>
                    <textarea value={form.seo_keywords} onChange={e => u('seo_keywords', e.target.value)}
                      className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background min-h-[50px] resize-y"
                      placeholder="থ্রি পিস, three piece, অনলাইন শপিং..." />
                  </div>
                  {/* Google preview */}
                  <div className="border border-border rounded-lg p-3 bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">Google প্রিভিউ</p>
                    <p className="text-sm text-primary font-medium truncate">{form.seo_title || form.name || 'পেজ টাইটেল'}</p>
                    <p className="text-xs text-muted-foreground truncate">shorno-suta.vercel.app/product/{form.slug || 'slug'}</p>
                    <p className="text-xs text-muted-foreground/80 line-clamp-2">{form.seo_description || form.description || 'কোনো বিবরণ নেই'}</p>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6 lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto scrollbar-hide">

          {/* Card 7: পণ্যের ছবি */}
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><ImageIcon className="h-4 w-4" /> পণ্যের ছবি</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {/* Primary image preview */}
              <div className="aspect-square rounded-lg border-2 border-dashed border-border bg-muted/50 flex items-center justify-center overflow-hidden relative">
                {primaryImage ? (
                  <>
                    <img src={primaryImage} alt="Primary" className="w-full h-full object-cover" />
                    <Badge className="absolute top-2 left-2 text-[10px] bg-primary"><Star className="h-3 w-3 mr-0.5" /> প্রাইমারি</Badge>
                  </>
                ) : (
                  <div className="text-center text-muted-foreground">
                    <Upload className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">প্রাইমারি ছবি</p>
                  </div>
                )}
              </div>

              {/* Existing images gallery */}
              {existingImages.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {existingImages.map((url, idx) => (
                    <div key={idx}
                      draggable
                      onDragStart={() => handleImgDragStart(idx)}
                      onDragOver={(e) => handleImgDragOver(e, idx)}
                      onDragEnd={handleImgDragEnd}
                      onDrop={() => handleImgDrop(idx)}
                      className={cn(
                        "relative group aspect-square rounded-lg overflow-hidden bg-muted border-2 cursor-grab active:cursor-grabbing transition-all",
                        dragOverIdx === idx && dragIdx !== idx ? "border-primary scale-105" : idx === 0 ? "border-primary/50" : "border-border",
                        dragIdx === idx && "opacity-40"
                      )}
                      onClick={() => setPrimaryImage(idx)}>
                      <img src={url} alt="" className="w-full h-full object-cover pointer-events-none" />
                      {idx === 0 && <Badge className="absolute bottom-1 left-1 text-[8px] bg-primary">1st</Badge>}
                      <button type="button" onClick={e => { e.stopPropagation(); removeExistingImage(idx); }}
                        className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* New file previews */}
              {galleryPreviews.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {galleryPreviews.map((url, idx) => (
                    <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden bg-muted border border-primary/30">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <Badge className="absolute bottom-1 left-1 text-[8px] bg-primary/80">নতুন</Badge>
                      <button type="button" onClick={() => removeNewFile(idx)}
                        className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload buttons */}
              <div className="space-y-2">
                <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-2" /> ছবি আপলোড করুন
                </Button>
                <Button variant="outline" className="w-full" onClick={() => setMediaCenterOpen(true)}>
                  <ImageIcon className="h-4 w-4 mr-2" /> মিডিয়া সেন্টার থেকে নিন
                </Button>
                <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={handleFileUpload} />
              </div>
            </CardContent>
          </Card>

          {/* Card 8: অ্যাকশন (mobile) */}
          <Card className="lg:hidden">
            <CardContent className="pt-4 space-y-2">
              <Button className="w-full" onClick={() => { u('is_active', true); saveMutation.mutate(); }} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'সেভ হচ্ছে...' : isEditing ? '🚀 আপডেট করুন' : '🚀 পাবলিশ করুন'}
              </Button>
              <Button variant="outline" className="w-full" onClick={() => { u('is_active', false); saveMutation.mutate(); }} disabled={saveMutation.isPending}>
                ড্রাফট সেভ
              </Button>
              {isEditing && (
                <Button variant="destructive" className="w-full" onClick={() => { if (confirm('ডিলিট করতে চান?')) deleteMutation.mutate(); }}>
                  <Trash2 className="h-4 w-4 mr-1" /> ডিলিট
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <MediaCenter
        open={mediaCenterOpen}
        onOpenChange={setMediaCenterOpen}
        onSelect={handleMediaSelect}
        multiple
      />

      <MediaCenter
        open={colorMediaCenterOpen}
        onOpenChange={setColorMediaCenterOpen}
        onSelect={handleColorMediaSelect}
        multiple
      />

      <MediaCenter
        open={addonMediaOpen}
        onOpenChange={setAddonMediaOpen}
        onSelect={(urls: string[]) => { if (urls[0]) setAddonImage(urls[0]); setAddonMediaOpen(false); }}
      />
    </div>
  );
}
