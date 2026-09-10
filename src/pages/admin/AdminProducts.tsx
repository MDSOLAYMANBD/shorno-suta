import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useActivityLog } from '@/hooks/useActivityLog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Plus, Search, MoreHorizontal, Eye, EyeOff, Pencil, Zap, Package, Power, Trash2, X, Check, Sparkles, Loader2, Copy, ShoppingCart, FileSpreadsheet } from 'lucide-react';
import { ProductCsvDialog } from '@/components/admin/products/ProductCsvDialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useCategories, getCategoryTree } from '@/hooks/useCategories';
import HoverImagePreview from '@/components/admin/HoverImagePreview';

async function blobToPng(blob: Blob): Promise<Blob> {
  if (blob.type === 'image/png') return blob;
  const bmp = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bmp.width; canvas.height = bmp.height;
  canvas.getContext('2d')!.drawImage(bmp, 0, 0);
  return await new Promise<Blob>((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error('toBlob failed')), 'image/png'));
}

async function copyImageToClipboard(url: string) {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error('fetch failed');
    const blob = await res.blob();
    const png = await blobToPng(blob);
    // @ts-ignore
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
    toast.success('ছবি কপি হয়েছে');
  } catch {
    try { await navigator.clipboard.writeText(url); toast.success('ছবির লিংক কপি হয়েছে'); }
    catch { toast.error('কপি করা যায়নি'); }
  }
}

function ProductThumb({ src, alt, size = 'md' }: { src?: string; alt: string; size?: 'sm' | 'md' }) {
  const box = size === 'md' ? 'w-14 h-14' : 'w-12 h-12';
  if (!src) return <div className={`${box} bg-muted rounded-md overflow-hidden`} />;
  return (
    <div className={`relative group/thumb ${box}`}>
      <HoverImagePreview src={src} alt={alt} size={360}>
        <div className={`${box} bg-muted rounded-md overflow-hidden cursor-zoom-in`}>
          <img src={src} alt="" className="w-full h-full object-cover" />
        </div>
      </HoverImagePreview>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); copyImageToClipboard(src); }}
        className="absolute -top-1.5 -right-1.5 z-10 p-1 rounded-full bg-background border shadow opacity-0 group-hover/thumb:opacity-100 transition-opacity hover:bg-accent"
        title="ছবি কপি করুন"
      >
        <Copy className="h-3 w-3" />
      </button>
    </div>
  );
}

// Top-level component to avoid focus loss on re-render
function InlineEditPrice({
  price,
  salePrice,
  costPrice,
  onSave,
  onCancel,
}: {
  price: number;
  salePrice: number | null;
  costPrice: number | null;
  onSave: (price: number, salePrice: number | null, costPrice: number | null) => void;
  onCancel: () => void;
}) {
  const [p, setP] = useState(String(price));
  const [sp, setSp] = useState(salePrice ? String(salePrice) : '');
  const [cp, setCp] = useState(costPrice ? String(costPrice) : '');
  const priceRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    priceRef.current?.focus();
    priceRef.current?.select();
  }, []);

  const handleSave = () => {
    const newPrice = parseFloat(p) || 0;
    const newSale = sp ? parseFloat(sp) : null;
    const newCost = cp ? parseFloat(cp) : null;
    onSave(newPrice, newSale, newCost);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
    if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
  };

  return (
    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
      <Input
        ref={priceRef}
        type="number"
        value={p}
        onChange={e => setP(e.target.value)}
        onKeyDown={handleKeyDown}
        className="h-7 w-20 text-xs px-1.5"
        placeholder="দাম"
      />
      <Input
        type="number"
        value={sp}
        onChange={e => setSp(e.target.value)}
        onKeyDown={handleKeyDown}
        className="h-7 w-20 text-xs px-1.5"
        placeholder="সেল"
      />
      <Input
        type="number"
        value={cp}
        onChange={e => setCp(e.target.value)}
        onKeyDown={handleKeyDown}
        className="h-7 w-16 text-xs px-1.5"
        placeholder="কেনা"
      />
      <button
        onClick={handleSave}
        className="h-7 w-7 flex items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
      >
        <Check className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';

// Inline stock editor popover – allows editing color×size stock from product list
function InlineStockEditor({ product, onSaved }: { product: any; onSaved: () => void }) {
  const qc = useQueryClient();
  const colors: string[] = product.colors || [];
  const sizes: string[] = product.sizes || [];
  const vi: any = typeof product.variant_images === 'object' && product.variant_images ? { ...product.variant_images } : {};
  const sizeData: Record<string, any> = vi.size_data || {};
  const colorSizes: Record<string, string[]> = vi.color_sizes || {};

  const hasVariants = colors.length > 0 && sizes.length > 0;
  const hasSizesOnly = sizes.length > 0 && colors.length === 0;
  const hasColorsOnly = colors.length > 0 && sizes.length === 0;

  // Build initial stock map: color→size→stock
  const buildInitial = () => {
    if (hasVariants) {
      const map: Record<string, Record<string, number>> = {};
      for (const color of colors) {
        map[color] = {};
        const availSizes = colorSizes[color] || sizes;
        for (const size of availSizes) {
          const sd = sizeData[size] || {};
          const colorStock: Record<string, number> = sd.color_stock || {};
          map[color][size] = colorStock[color] ?? 0;
        }
      }
      return map;
    }
    return {};
  };

  const buildInitialSizeOnly = () => {
    if (hasSizesOnly) {
      const map: Record<string, number> = {};
      for (const size of sizes) {
        map[size] = sizeData[size]?.stock ?? 0;
      }
      return map;
    }
    return {};
  };

  const buildInitialColorOnly = () => {
    if (hasColorsOnly) {
      const cos: Record<string, number> = vi.color_only_stock || {};
      const map: Record<string, number> = {};
      for (const color of colors) {
        map[color] = cos[color] ?? 0;
      }
      return map;
    }
    return {};
  };

  const [stockMap, setStockMap] = useState(buildInitial);
  const [sizeStockMap, setSizeStockMap] = useState(buildInitialSizeOnly);
  const [colorOnlyStockMap, setColorOnlyStockMap] = useState(buildInitialColorOnly);
  const [totalStock, setTotalStock] = useState(String(product.stock || 0));
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const newVi = { ...vi };
      let newTotal = 0;

      if (hasVariants) {
        const newSizeData: Record<string, any> = { ...sizeData };
        for (const size of sizes) {
          const existing = newSizeData[size] || {};
          const colorStock: Record<string, number> = {};
          for (const color of colors) {
            const availSizes = colorSizes[color] || sizes;
            if (availSizes.includes(size)) {
              colorStock[color] = stockMap[color]?.[size] ?? 0;
            }
          }
          const sizeTotal = Object.values(colorStock).reduce((a, b) => a + b, 0);
          newSizeData[size] = { ...existing, stock: sizeTotal, color_stock: colorStock };
          newTotal += sizeTotal;
        }
        newVi.size_data = newSizeData;
      } else if (hasColorsOnly) {
        // Color-only stock
        const cos: Record<string, number> = {};
        for (const color of colors) {
          cos[color] = colorOnlyStockMap[color] ?? 0;
          newTotal += cos[color];
        }
        newVi.color_only_stock = cos;
      } else if (hasSizesOnly) {
        const newSizeData: Record<string, any> = { ...sizeData };
        for (const size of sizes) {
          const existing = newSizeData[size] || {};
          const s = sizeStockMap[size] ?? 0;
          newSizeData[size] = { ...existing, stock: s };
          newTotal += s;
        }
        newVi.size_data = newSizeData;
      } else {
        newTotal = parseInt(totalStock) || 0;
      }

      const { error } = await supabase.from('products').update({
        stock: newTotal,
        variant_images: newVi,
      }).eq('id', product.id);
      if (error) throw error;

      qc.invalidateQueries({ queryKey: ['admin-products'] });
      toast.success('স্টক আপডেট হয়েছে');
      setOpen(false);
      onSaved();
    } catch (err: any) {
      toast.error(err.message || 'স্টক আপডেটে সমস্যা');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="cursor-pointer hover:bg-accent/50 rounded px-1.5 py-0.5 transition-colors text-left"
          onClick={e => e.stopPropagation()}
        >
          {product.stock > 0 ? (
            <span className="text-sm">{product.stock}</span>
          ) : (
            <Badge variant="destructive" className="text-[10px]">স্টক নেই</Badge>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start" onClick={e => e.stopPropagation()}>
        <p className="text-xs font-semibold mb-2 truncate">{product.name} — স্টক</p>

        {hasVariants ? (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {colors.map(color => {
              const availSizes = colorSizes[color] || sizes;
              return (
                <div key={color} className="border rounded p-2">
                  <p className="text-xs font-medium mb-1">{color}</p>
                  <div className="grid grid-cols-2 gap-1">
                    {availSizes.map(size => (
                      <div key={size} className="flex items-center gap-1">
                        <span className="text-[11px] text-muted-foreground w-10 shrink-0">{size}</span>
                        <Input
                          type="number"
                          min={0}
                          value={stockMap[color]?.[size] ?? 0}
                          onChange={e => setStockMap(prev => ({
                            ...prev,
                            [color]: { ...prev[color], [size]: parseInt(e.target.value) || 0 }
                          }))}
                          className="h-7 text-xs px-1.5"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : hasColorsOnly ? (
          <div className="space-y-1.5">
            {colors.map(color => (
              <div key={color} className="flex items-center gap-1">
                <span className="text-[11px] text-muted-foreground w-16 shrink-0 truncate">{color}</span>
                <Input
                  type="number"
                  min={0}
                  value={colorOnlyStockMap[color] ?? 0}
                  onChange={e => setColorOnlyStockMap(prev => ({ ...prev, [color]: parseInt(e.target.value) || 0 }))}
                  className="h-7 text-xs px-1.5"
                />
              </div>
            ))}
          </div>
        ) : hasSizesOnly ? (
          <div className="grid grid-cols-2 gap-1.5">
            {sizes.map(size => (
              <div key={size} className="flex items-center gap-1">
                <span className="text-[11px] text-muted-foreground w-10 shrink-0">{size}</span>
                <Input
                  type="number"
                  min={0}
                  value={sizeStockMap[size] ?? 0}
                  onChange={e => setSizeStockMap(prev => ({ ...prev, [size]: parseInt(e.target.value) || 0 }))}
                  className="h-7 text-xs px-1.5"
                />
              </div>
            ))}
          </div>
        ) : (
          <Input
            type="number"
            min={0}
            value={totalStock}
            onChange={e => setTotalStock(e.target.value)}
            className="h-8 text-sm"
            placeholder="মোট স্টক"
          />
        )}

        <Button size="sm" className="w-full mt-2 h-7 text-xs" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
          সেভ করুন
        </Button>
      </PopoverContent>
    </Popover>
  );
}

type Filter = 'all' | 'active' | 'inactive' | 'hidden' | 'preorder' | 'stockout' | 'bump' | 'trash';

interface SizeData {
  price?: number;
  stock?: number;
  enabled?: boolean;
}

export default function AdminProducts() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { logActivity } = useActivityLog();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryFilter = searchParams.get('category') || 'all';
  const setCategoryFilter = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'all') next.delete('category');
    else next.set('category', value);
    setSearchParams(next, { replace: true });
  };
  const [quickEditProduct, setQuickEditProduct] = useState<any | null>(null);
  const [qePrice, setQePrice] = useState('');
  const [qeOriginalPrice, setQeOriginalPrice] = useState('');
  const [qeStock, setQeStock] = useState('');
  const [qeActive, setQeActive] = useState(true);
  const [qeAllowPreOrder, setQeAllowPreOrder] = useState(true);
  const [qeSizeStocks, setQeSizeStocks] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [csvOpen, setCsvOpen] = useState(false);

  const { data: categories = [] } = useCategories();
  const categoryTree = useMemo(() => getCategoryTree(categories), [categories]);

  // Reset selection when filter, search or category changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [filter, search, categoryFilter]);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['admin-products'],
    queryFn: async () => {
      // cost_price is column-revoked from `authenticated`; load it separately via staff-only RPC
      const { data, error } = await supabase
        .from('products')
        .select('id, category_id, name, name_bn, slug, description, description_bn, price, original_price, images, sizes, colors, stock, is_featured, is_active, created_at, video_url, video_file_url, seo_title, seo_description, product_type, variant_images, is_hidden_from_shop, seo_keywords, feed_title, feed_description, allow_pre_order, bump_product_id, bump_discount, addon_config, deleted_at, categories(name)' as any)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const list = data || [];
      const ids = list.map((p: any) => p.id);
      if (ids.length > 0) {
        const { data: costRows } = await (supabase.rpc as any)('get_product_cost_prices', { p_ids: ids });
        const costMap = new Map<string, number | null>();
        (costRows || []).forEach((r: any) => costMap.set(r.id, r.cost_price));
        return list.map((p: any) => ({ ...p, cost_price: costMap.get(p.id) ?? null }));
      }
      return list;
    },
  });

  // Lookup map for bump products (name + price)
  const bumpProductMap = useMemo(() => {
    const map = new Map<string, { name: string; price: number }>();
    (products as any[]).forEach((p: any) => map.set(p.id, { name: p.name, price: p.price }));
    return map;
  }, [products]);

  const { data: preorderCounts = new Map<string, number>() } = useQuery({
    queryKey: ['product-preorder-counts'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_product_preorder_counts');
      if (error) throw error;
      const map = new Map<string, number>();
      (data || []).forEach((item: any) => map.set(item.product_id, Number(item.total_preordered) || 0));
      return map;
    },
  });

  const { data: salesCounts = new Map<string, number>() } = useQuery({
    queryKey: ['product-sales-counts'],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('get_all_product_sales_counts');
      if (error) throw error;
      const map = new Map<string, number>();
      (data || []).forEach((item: any) => map.set(item.product_id, Number(item.total_sold) || 0));
      return map;
    },
    staleTime: 5 * 60 * 1000,
  });

  const counts = useMemo(() => {
    const live = (products as any[]).filter((p: any) => !p.deleted_at);
    return {
      all: live.length,
      active: live.filter((p: any) => p.is_active).length,
      inactive: live.filter((p: any) => !p.is_active).length,
      hidden: live.filter((p: any) => p.is_hidden_from_shop).length,
      preorder: live.filter((p: any) => p.allow_pre_order && p.is_active).length,
      stockout: live.filter((p: any) => p.stock <= 0 && !p.allow_pre_order).length,
      bump: live.filter((p: any) => p.bump_product_id || (p.addon_config as any)?.name).length,
      trash: (products as any[]).filter((p: any) => p.deleted_at).length,
    };
  }, [products]);

  const filtered = useMemo(() => {
    let list: any[] = products as any[];
    if (filter === 'trash') {
      list = list.filter((p: any) => p.deleted_at);
    } else {
      list = list.filter((p: any) => !p.deleted_at);
      if (filter === 'active') list = list.filter((p: any) => p.is_active);
      if (filter === 'inactive') list = list.filter((p: any) => !p.is_active);
      if (filter === 'hidden') list = list.filter((p: any) => p.is_hidden_from_shop);
      if (filter === 'preorder') list = list.filter((p: any) => p.allow_pre_order && p.is_active);
      if (filter === 'stockout') list = list.filter((p: any) => p.stock <= 0 && !p.allow_pre_order);
      if (filter === 'bump') list = list.filter((p: any) => p.bump_product_id || (p.addon_config as any)?.name);
    }
    if (categoryFilter !== 'all') {
      list = list.filter((p: any) => p.category_id === categoryFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p: any) =>
        p.name?.toLowerCase().includes(q) ||
        p.name_bn?.toLowerCase().includes(q) ||
        p.slug?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [products, filter, search, categoryFilter]);

  // Selection helpers
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allSelected = filtered.length > 0 && filtered.every((p: any) => selectedIds.has(p.id));
  const someSelected = filtered.some((p: any) => selectedIds.has(p.id));

  const [inlineEditId, setInlineEditId] = useState<string | null>(null);

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((p: any) => p.id)));
    }
  };

  const selectedCount = selectedIds.size;
  const selectedArray = Array.from(selectedIds);

  // Bulk mutations
  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ ids, updates }: { ids: string[]; updates: Record<string, any> }) => {
      const { error } = await supabase.from('products').update(updates as any).in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-products'] });
      setSelectedIds(new Set());
      toast.success('বাল্ক আপডেট সফল হয়েছে');
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('products').update({ deleted_at: new Date().toISOString(), is_active: false } as any).in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-products'] });
      setSelectedIds(new Set());
      toast.success('পণ্যগুলো ট্র্যাশে পাঠানো হয়েছে');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('products').update({ deleted_at: new Date().toISOString(), is_active: false } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['admin-products'] });
      toast.success('পণ্য ট্র্যাশে পাঠানো হয়েছে', {
        action: {
          label: 'ফিরিয়ে আনুন',
          onClick: () => restoreMutation.mutate(id),
        },
      });
      logActivity('product_delete', 'product', id, 'প্রোডাক্ট ট্র্যাশে পাঠানো হয়েছে');
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (idOrIds: string | string[]) => {
      const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
      const { error } = await supabase.from('products').update({ deleted_at: null } as any).in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-products'] });
      setSelectedIds(new Set());
      toast.success('পণ্য পুনরুদ্ধার হয়েছে');
    },
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: async (idOrIds: string | string[]) => {
      const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
      const { error } = await supabase.from('products').delete().in('id', ids);
      if (error) throw error;
    },
    onSuccess: (_, idOrIds) => {
      qc.invalidateQueries({ queryKey: ['admin-products'] });
      setSelectedIds(new Set());
      toast.success('পণ্য স্থায়ীভাবে মুছে ফেলা হয়েছে');
      const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
      ids.forEach(id => logActivity('product_permanent_delete', 'product', id, 'প্রোডাক্ট স্থায়ীভাবে ডিলিট করা হয়েছে'));
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (productId: string) => {
      const { data: original, error: fetchErr } = await supabase
        .from('products')
        .select('id, category_id, name, name_bn, slug, description, description_bn, price, original_price, images, sizes, colors, stock, is_featured, is_active, created_at, video_url, video_file_url, seo_title, seo_description, product_type, variant_images, is_hidden_from_shop, seo_keywords, feed_title, feed_description, allow_pre_order, bump_product_id, bump_discount, addon_config')
        .eq('id', productId)
        .single();
      if (fetchErr || !original) throw fetchErr || new Error('পণ্য পাওয়া যায়নি');
      // Pull cost_price via staff-only RPC (column-revoked from authenticated)
      const { data: costRows } = await (supabase.rpc as any)('get_product_cost_prices', { p_ids: [productId] });
      const cost_price = (costRows && costRows[0]?.cost_price) ?? null;
      const { id, created_at, feed_title, feed_description, ...rest } = original as any;
      // Keep name and name_bn in sync to avoid stale Bengali title issue on storefront
      const copiedName = `${original.name} (কপি)`;
      const newProduct = {
        ...rest,
        cost_price,
        name: copiedName,
        name_bn: copiedName,
        slug: `${original.slug}-copy-${Date.now()}`,
      };
      const { data, error } = await supabase.from('products').insert(newProduct).select('id').single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['admin-products'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['featured-products'] });
      qc.invalidateQueries({ queryKey: ['new-products'] });
      qc.invalidateQueries({ queryKey: ['best-selling-products'] });
      qc.invalidateQueries({ queryKey: ['homepage-all-products'] });
      toast.success('পণ্য ডুপ্লিকেট হয়েছে');
      if (data?.id) navigate(`/admin/products/edit/${data.id}`);
    },
    onError: () => toast.error('ডুপ্লিকেট করতে সমস্যা হয়েছে'),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('products').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, is_active }) => {
      await qc.cancelQueries({ queryKey: ['admin-products'] });
      const prev = qc.getQueryData<any[]>(['admin-products']);
      qc.setQueryData<any[]>(['admin-products'], (old) =>
        (old || []).map((p) => (p.id === id ? { ...p, is_active } : p))
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['admin-products'], ctx.prev);
      toast.error('আপডেট ব্যর্থ');
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['admin-products'] }),
  });

  const quickEditMutation = useMutation({
    mutationFn: async () => {
      if (!quickEditProduct) return;
      const p = quickEditProduct;
      const variantImages: any = typeof p.variant_images === 'object' && p.variant_images ? { ...p.variant_images } : {};
      const sizeData: Record<string, SizeData> = variantImages.size_data || {};
      let totalStock = parseInt(qeStock) || 0;

      if (p.sizes && p.sizes.length > 0) {
        const newSizeData: Record<string, SizeData> = {};
        for (const size of p.sizes) {
          const existing = sizeData[size] || {};
          newSizeData[size] = {
            ...existing,
            stock: parseInt(qeSizeStocks[size] || '0') || 0,
          };
        }
        variantImages.size_data = newSizeData;
        totalStock = Object.values(newSizeData).reduce((sum, s) => sum + (s.stock || 0), 0);
      }

      const updateData: any = {
        price: parseFloat(qePrice) || 0,
        original_price: qeOriginalPrice ? parseFloat(qeOriginalPrice) : null,
        stock: totalStock,
        is_active: qeActive,
        allow_pre_order: qeAllowPreOrder,
        variant_images: variantImages,
      };

      const { error } = await supabase.from('products').update(updateData).eq('id', p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-products'] });
      toast.success('পণ্য আপডেট হয়েছে');
      setQuickEditProduct(null);
    },
  });

  const openQuickEdit = (p: any) => {
    setQuickEditProduct(p);
    setQePrice(String(p.price || ''));
    setQeOriginalPrice(p.original_price ? String(p.original_price) : '');
    setQeStock(String(p.stock || 0));
    setQeActive(p.is_active);
    setQeAllowPreOrder(Boolean(p.allow_pre_order));
    const vi: any = typeof p.variant_images === 'object' && p.variant_images ? p.variant_images : {};
    const sd: Record<string, SizeData> = vi.size_data || {};
    const stocks: Record<string, string> = {};
    if (p.sizes) {
      for (const size of p.sizes) {
        stocks[size] = String(sd[size]?.stock ?? 0);
      }
    }
    setQeSizeStocks(stocks);
  };

  const hasSizes = quickEditProduct?.sizes && quickEditProduct.sizes.length > 0;

  const inlinePriceMutation = useMutation({
    mutationFn: async ({ id, price, original_price, cost_price }: { id: string; price: number; original_price: number | null; cost_price: number | null }) => {
      const { error } = await supabase.from('products').update({ price, original_price, cost_price } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-products'] });
      setInlineEditId(null);
      toast.success('দাম আপডেট হয়েছে');
    },
  });

  const toggleHiddenMutation = useMutation({
    mutationFn: async ({ id, is_hidden_from_shop }: { id: string; is_hidden_from_shop: boolean }) => {
      const { error } = await supabase.from('products').update({ is_hidden_from_shop } as any).eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, is_hidden_from_shop }) => {
      await qc.cancelQueries({ queryKey: ['admin-products'] });
      const prev = qc.getQueryData<any[]>(['admin-products']);
      qc.setQueryData<any[]>(['admin-products'], (old) =>
        (old || []).map((p) => (p.id === id ? { ...p, is_hidden_from_shop } : p))
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['admin-products'], ctx.prev);
      toast.error('আপডেট ব্যর্থ');
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['admin-products'] }),
  });

  const toggleAllowPreOrderMutation = useMutation({
    mutationFn: async ({ id, allow_pre_order }: { id: string; allow_pre_order: boolean }) => {
      const { error } = await supabase.from('products').update({ allow_pre_order } as any).eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, allow_pre_order }) => {
      await qc.cancelQueries({ queryKey: ['admin-products'] });
      const prev = qc.getQueryData<any[]>(['admin-products']);
      qc.setQueryData<any[]>(['admin-products'], (old) =>
        (old || []).map((p) => (p.id === id ? { ...p, allow_pre_order } : p))
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['admin-products'], ctx.prev);
      toast.error('আপডেট ব্যর্থ');
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['admin-products'] });
      qc.invalidateQueries({ queryKey: ['product-preorder-counts'] });
    },
  });

  const renderActiveToggle = (product: any, compact = false) => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        toggleActiveMutation.mutate({ id: product.id, is_active: !product.is_active });
      }}
      className={compact
        ? 'inline-flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium text-foreground transition-all duration-200 ease-out hover:bg-accent active:scale-[0.97] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
        : 'inline-flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition-all duration-200 ease-out hover:bg-accent active:scale-[0.97] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'}
      aria-pressed={product.is_active}
    >
      <Switch checked={Boolean(product.is_active)} className="pointer-events-none" />
      <span>{product.is_active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}</span>
    </button>
  );

  const renderPreOrderToggle = (product: any, compact = false) => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        toggleAllowPreOrderMutation.mutate({ id: product.id, allow_pre_order: !product.allow_pre_order });
      }}
      className={compact
        ? 'inline-flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium text-foreground transition-all duration-200 ease-out hover:bg-accent active:scale-[0.97] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
        : 'inline-flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition-all duration-200 ease-out hover:bg-accent active:scale-[0.97] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'}
      aria-pressed={product.allow_pre_order}
    >
      <Switch checked={Boolean(product.allow_pre_order)} className="pointer-events-none" />
      <span>{product.allow_pre_order ? 'প্রি-অর্ডার চালু' : 'প্রি-অর্ডার বন্ধ'}</span>
    </button>
  );

  const tabs: { key: Filter; label: string; count: number }[] = [
    { key: 'all', label: '📦 সব পণ্য', count: counts.all },
    { key: 'active', label: '✅ সক্রিয়', count: counts.active },
    { key: 'inactive', label: '⛔ নিষ্ক্রিয়', count: counts.inactive },
    { key: 'hidden', label: '👁 হিডেন', count: counts.hidden },
    { key: 'preorder', label: '📦 প্রি-অর্ডার', count: counts.preorder },
    { key: 'stockout', label: '🚫 স্টক আউট', count: counts.stockout },
    { key: 'bump', label: '🔗 বাম্প/অ্যাড-অন', count: counts.bump },
    { key: 'trash', label: '🗑️ ট্র্যাশ', count: (counts as any).trash },
  ];

  const isBulkPending = bulkUpdateMutation.isPending || bulkDeleteMutation.isPending;

  // Bulk AI Feed optimization state
  const [aiFeedRunning, setAiFeedRunning] = useState(false);
  const [aiFeedProgress, setAiFeedProgress] = useState({ total: 0, done: 0, success: 0, failed: 0 });
  const aiFeedCancelRef = useRef(false);

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const getFunctionErrorDetails = useCallback(async (error: any) => {
    let message = error?.message || 'AI Feed জেনারেশনে সমস্যা হয়েছে';
    let status = error?.context?.status || error?.status || null;
    let code: string | null = null;

    try {
      const payload = await error?.context?.json?.();
      if (payload?.error) message = payload.error;
      if (payload?.code) code = payload.code;
      if (!status && payload?.code === 'RATE_LIMITED') status = 429;
      if (!status && payload?.code === 'PAYMENT_REQUIRED') status = 402;
    } catch {
      // ignore JSON parsing issues and fall back to the SDK error message
    }

    const isRateLimited = status === 429 || code === 'RATE_LIMITED' || /rate.?limit|rate_limited/i.test(message);
    const isPaymentRequired = status === 402 || code === 'PAYMENT_REQUIRED';

    return { message, status, code, isRateLimited, isPaymentRequired };
  }, []);

  const runBulkAiFeed = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;

    aiFeedCancelRef.current = false;
    setAiFeedRunning(true);
    setAiFeedProgress({ total: ids.length, done: 0, success: 0, failed: 0 });

    let success = 0;
    let failed = 0;
    let stoppedReason: 'rate_limited' | 'payment_required' | null = null;
    let stoppedMessage = '';

    for (let i = 0; i < ids.length; i++) {
      if (aiFeedCancelRef.current) break;

      try {
        const { error } = await supabase.functions.invoke('optimize-product-feed', {
          body: { product_id: ids[i] },
        });

        if (error) {
          const details = await getFunctionErrorDetails(error);
          failed++;

          if (details.isRateLimited) {
            stoppedReason = 'rate_limited';
            stoppedMessage = details.message;
            setAiFeedProgress({ total: ids.length, done: i + 1, success, failed });
            break;
          }

          if (details.isPaymentRequired) {
            stoppedReason = 'payment_required';
            stoppedMessage = details.message;
            setAiFeedProgress({ total: ids.length, done: i + 1, success, failed });
            break;
          }
        } else {
          success++;
        }
      } catch (error) {
        const details = await getFunctionErrorDetails(error);
        failed++;

        if (details.isRateLimited) {
          stoppedReason = 'rate_limited';
          stoppedMessage = details.message;
          setAiFeedProgress({ total: ids.length, done: i + 1, success, failed });
          break;
        }

        if (details.isPaymentRequired) {
          stoppedReason = 'payment_required';
          stoppedMessage = details.message;
          setAiFeedProgress({ total: ids.length, done: i + 1, success, failed });
          break;
        }
      }

      setAiFeedProgress({ total: ids.length, done: i + 1, success, failed });

      if (i < ids.length - 1 && !aiFeedCancelRef.current) {
        await sleep(3500);
      }
    }

    setAiFeedRunning(false);

    if (aiFeedCancelRef.current) {
      toast.info(`AI Feed বাতিল করা হয়েছে (${success} সফল, ${failed} ব্যর্থ)`);
    } else if (stoppedReason === 'rate_limited') {
      toast.error(stoppedMessage || `AI rate limit হয়েছে — ${success} টি সম্পন্ন, বাকিগুলো পরে আবার চালান`);
    } else if (stoppedReason === 'payment_required') {
      toast.error(stoppedMessage || 'AI credit শেষ। Workspace-এ credit যোগ করুন।');
    } else {
      toast.success(`AI Feed সম্পন্ন — ${success} সফল, ${failed} ব্যর্থ`);
    }

    qc.invalidateQueries({ queryKey: ['admin-products'] });
  }, [getFunctionErrorDetails, qc]);

  const handleBulkAiFeed = () => runBulkAiFeed(selectedArray);

  const handleAllProductsAiFeed = async () => {
    const activeIds = products.filter((p: any) => p.is_active).map((p: any) => p.id);
    if (activeIds.length === 0) { toast.error('কোনো সক্রিয় পণ্য নেই'); return; }
    if (!confirm(`সব সক্রিয় পণ্যের (${activeIds.length} টি) জন্য AI Feed জেনারেট করতে চান?`)) return;
    runBulkAiFeed(activeIds);
  };

  return (
    <div>
      <div className="sticky top-0 z-30 bg-background pb-2">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl md:text-2xl font-bold">📦 পণ্য ম্যানেজমেন্ট</h1>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setCsvOpen(true)}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> CSV
          </Button>
          <Button size="sm" onClick={() => navigate('/admin/products/new')}>
            <Plus className="h-4 w-4 mr-1" /> নতুন পণ্য
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4 flex-nowrap overflow-x-auto pb-1 items-center">
        <div className="min-w-[180px]">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="📁 ক্যাটেগরি" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              <SelectItem value="all">📁 সব ক্যাটেগরি</SelectItem>
              {categoryTree.map(({ category: c, depth }) => (
                <SelectItem key={c.id} value={c.id}>
                  {depth > 0 ? `↳ ${c.name_bn || c.name}` : (c.name_bn || c.name)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="h-4 w-px bg-border mx-1" />
        {tabs.map(t => (
          <Button
            key={t.key}
            variant={filter === t.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(t.key)}
          >
            {t.label}
            <Badge variant="secondary" className="ml-2 text-[10px] px-1.5">{t.count}</Badge>
          </Button>
        ))}
        <div className="h-4 w-px bg-border mx-1" />
        <Button
          size="sm"
          variant="outline"
          onClick={handleAllProductsAiFeed}
          disabled={aiFeedRunning}
          className="border-primary/30 hover:border-primary hover:bg-primary/5"
        >
          <Sparkles className="h-3.5 w-3.5 mr-1 text-primary" /> সব AI Feed
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="পণ্যের নাম বা কোড দিয়ে খুঁজুন..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Bulk Action Bar */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-2 mb-4 p-3 bg-muted/60 border rounded-lg flex-wrap sticky top-0 z-10">
          <span className="text-sm font-medium">✓ {selectedCount} টি সিলেক্টেড</span>
          <div className="h-4 w-px bg-border" />
          <Button
            size="sm" variant="outline"
            disabled={isBulkPending}
            onClick={() => bulkUpdateMutation.mutate({ ids: selectedArray, updates: { is_active: true } })}
          >
            <Power className="h-3.5 w-3.5 mr-1" /> সক্রিয়
          </Button>
          <Button
            size="sm" variant="outline"
            disabled={isBulkPending}
            onClick={() => bulkUpdateMutation.mutate({ ids: selectedArray, updates: { is_active: false } })}
          >
            <Power className="h-3.5 w-3.5 mr-1" /> নিষ্ক্রিয়
          </Button>
          <Button
            size="sm" variant="outline"
            disabled={isBulkPending}
            onClick={() => bulkUpdateMutation.mutate({ ids: selectedArray, updates: { is_hidden_from_shop: true } })}
          >
            <EyeOff className="h-3.5 w-3.5 mr-1" /> হাইড
          </Button>
          <Button
            size="sm" variant="outline"
            disabled={isBulkPending}
            onClick={() => bulkUpdateMutation.mutate({ ids: selectedArray, updates: { is_hidden_from_shop: false } })}
          >
            <Eye className="h-3.5 w-3.5 mr-1" /> আনহাইড
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={isBulkPending || aiFeedRunning}
            onClick={handleBulkAiFeed}
            className="border-primary/30 hover:border-primary hover:bg-primary/5"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1 text-primary" /> AI Feed
          </Button>
          {filter === 'trash' ? (
            <>
              <Button
                size="sm" variant="outline"
                disabled={restoreMutation.isPending}
                onClick={() => restoreMutation.mutate(selectedArray)}
              >
                <Power className="h-3.5 w-3.5 mr-1" /> পুনরুদ্ধার
              </Button>
              <Button
                size="sm" variant="destructive"
                disabled={permanentDeleteMutation.isPending}
                onClick={() => { if (confirm(`${selectedCount} টি পণ্য স্থায়ীভাবে মুছে ফেলতে চান? এই কাজটি ফিরিয়ে আনা যাবে না।`)) permanentDeleteMutation.mutate(selectedArray); }}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" /> স্থায়ীভাবে মুছুন
              </Button>
            </>
          ) : (
            <Button
              size="sm" variant="destructive"
              disabled={isBulkPending}
              onClick={() => { if (confirm(`${selectedCount} টি পণ্য ট্র্যাশে পাঠাতে চান?`)) bulkDeleteMutation.mutate(selectedArray); }}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" /> ট্র্যাশে পাঠান
            </Button>
          )}
          <Button
            size="sm" variant="ghost"
            onClick={() => setSelectedIds(new Set())}
          >
            <X className="h-3.5 w-3.5 mr-1" /> বাতিল
          </Button>
        </div>
      )}

      {/* AI Feed Progress Bar */}
      {aiFeedRunning && (
        <div className="mb-4 p-4 bg-muted/60 border rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm font-medium">🤖 AI Feed অপ্টিমাইজেশন চলছে...</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { aiFeedCancelRef.current = true; }}
            >
              <X className="h-3.5 w-3.5 mr-1" /> বাতিল
            </Button>
          </div>
          <Progress value={(aiFeedProgress.done / aiFeedProgress.total) * 100} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {aiFeedProgress.done}/{aiFeedProgress.total} সম্পন্ন
            {aiFeedProgress.failed > 0 && <span className="text-destructive ml-1">({aiFeedProgress.failed} ব্যর্থ)</span>}
          </p>
        </div>
      )}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-center py-8">লোড হচ্ছে...</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">কোনো পণ্য পাওয়া যায়নি</p>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="md:hidden space-y-2">
            {filtered.map((p: any) => (
              <div key={p.id} className={`border rounded-lg p-3 flex gap-3 items-start ${selectedIds.has(p.id) ? 'bg-accent/40 border-primary/30' : ''}`}>
                <div className="flex flex-col items-center gap-2 flex-shrink-0">
                  <Checkbox
                    checked={selectedIds.has(p.id)}
                    onCheckedChange={() => toggleSelect(p.id)}
                  />
                  <ProductThumb src={p.images?.[0]} alt={p.name} size="md" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{p.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">/{p.slug}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {p.categories?.name && (
                      <Badge variant="outline" className="text-[10px]">{p.categories.name}</Badge>
                    )}
                    {p.bump_product_id && (() => {
                      const bp = bumpProductMap.get(p.bump_product_id);
                      return bp ? (
                        <span className="text-[10px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200 truncate max-w-[180px] inline-block">
                          🔗 বাম্প: {bp.name} — <b>৳{bp.price}</b>
                        </span>
                      ) : (
                        <Badge variant="outline" className="text-[10px] border-purple-300 text-purple-600">🔗 বাম্প (অজানা)</Badge>
                      );
                    })()}
                    {(() => {
                      const addon = p.addon_config as { name?: string; price?: number } | null;
                      return addon?.name ? (
                        <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 truncate max-w-[180px] inline-block">
                          🎁 অ্যাড-অন: {addon.name} — <b>৳{addon.price ?? 0}</b>
                        </span>
                      ) : null;
                    })()}
                    {/* active status shown via toggle below */}
                    {p.is_hidden_from_shop && (
                      <Badge variant="outline" className="text-[10px] gap-0.5"><EyeOff className="h-3 w-3" /> হিডেন</Badge>
                    )}
                    {p.stock <= 0 && (
                      <Badge variant={p.allow_pre_order ? 'secondary' : 'destructive'} className="text-[10px]">{p.allow_pre_order ? 'প্রি-অর্ডার চালু' : 'স্টক আউট'}</Badge>
                    )}
                    {p.stock <= 0 && (preorderCounts.get(p.id) || 0) > 0 && (
                      <Badge variant="outline" className="text-[10px]">-{preorderCounts.get(p.id)} pre-order</Badge>
                    )}
                    {(salesCounts.get(p.id) || 0) > 0 && (
                      <Badge variant="outline" className="text-[10px] gap-0.5 border-emerald-300 text-emerald-700 bg-emerald-50">
                        <ShoppingCart className="h-3 w-3" /> বিক্রি: {salesCounts.get(p.id)}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-2">
                    {renderActiveToggle(p, true)}
                    {renderPreOrderToggle(p, true)}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div onClick={() => setInlineEditId(p.id)} className="cursor-pointer">
                      {inlineEditId === p.id ? (
                        <InlineEditPrice
                          price={p.price}
                          salePrice={p.original_price}
                          costPrice={p.cost_price}
                          onSave={(newPrice, newSale, newCost) => inlinePriceMutation.mutate({ id: p.id, price: newPrice, original_price: newSale, cost_price: newCost })}
                          onCancel={() => setInlineEditId(null)}
                        />
                      ) : (
                        <>
                          {p.original_price && p.original_price > 0 && p.original_price < p.price ? (
                            <>
                              <span className="font-semibold text-sm text-green-600">৳{p.original_price}</span>
                              <span className="text-xs text-muted-foreground line-through ml-1">৳{p.price}</span>
                            </>
                          ) : (
                            <span className="font-medium text-sm">৳{p.price}</span>
                          )}
                        </>
                      )}
                      {inlineEditId !== p.id && (
                        <span className="ml-2"><InlineStockEditor product={p} onSaved={() => {}} /></span>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/admin/products/edit/${p.id}`)}>
                          <Pencil className="h-4 w-4 mr-2" /> এডিট করুন
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openQuickEdit(p)}>
                          <Zap className="h-4 w-4 mr-2" /> দ্রুত এডিট
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openQuickEdit(p)}>
                          <Package className="h-4 w-4 mr-2" /> স্টক আপডেট
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => duplicateMutation.mutate(p.id)}>
                          <Copy className="h-4 w-4 mr-2" /> ডুপ্লিকেট করুন
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => toggleActiveMutation.mutate({ id: p.id, is_active: !p.is_active })}>
                          <Power className="h-4 w-4 mr-2" />
                          {p.is_active ? 'নিষ্ক্রিয় করুন' : 'সক্রিয় করুন'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleHiddenMutation.mutate({ id: p.id, is_hidden_from_shop: !p.is_hidden_from_shop })}>
                          {p.is_hidden_from_shop ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
                          {p.is_hidden_from_shop ? 'শপে দেখান' : 'শপ থেকে হাইড'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleAllowPreOrderMutation.mutate({ id: p.id, allow_pre_order: !p.allow_pre_order })}>
                          <Package className="h-4 w-4 mr-2" />
                          {p.allow_pre_order ? 'প্রি-অর্ডার বন্ধ করুন' : 'প্রি-অর্ডার চালু করুন'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {p.deleted_at ? (
                          <>
                            <DropdownMenuItem onClick={() => restoreMutation.mutate(p.id)}>
                              <Power className="h-4 w-4 mr-2" /> পুনরুদ্ধার করুন
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => { if (confirm('স্থায়ীভাবে মুছে ফেলতে চান? এই কাজটি ফিরিয়ে আনা যাবে না।')) permanentDeleteMutation.mutate(p.id); }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> স্থায়ীভাবে মুছুন
                            </DropdownMenuItem>
                          </>
                        ) : (
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => { if (confirm('পণ্যটি ট্র্যাশে পাঠাতে চান?')) deleteMutation.mutate(p.id); }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> ট্র্যাশে পাঠান
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="সব সিলেক্ট"
                      {...(someSelected && !allSelected ? { 'data-state': 'indeterminate' } : {})}
                    />
                  </TableHead>
                  <TableHead className="w-14">ছবি</TableHead>
                  <TableHead>নাম</TableHead>
                  <TableHead>দাম</TableHead>
                  <TableHead>স্টক</TableHead>
                  <TableHead>স্ট্যাটাস</TableHead>
                  <TableHead className="w-10">এডিট</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p: any) => (
                  <TableRow key={p.id} className={`group ${selectedIds.has(p.id) ? 'bg-accent/40' : ''}`}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(p.id)}
                        onCheckedChange={() => toggleSelect(p.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <ProductThumb src={p.images?.[0]} alt={p.name} size="sm" />
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-sm truncate max-w-[200px]">{p.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate max-w-[200px]">/{p.slug}</p>
                      {p.categories?.name && (
                        <Badge variant="outline" className="text-[10px] mt-0.5">{p.categories.name}</Badge>
                      )}
                      {p.bump_product_id && (() => {
                        const bp = bumpProductMap.get(p.bump_product_id);
                        return bp ? (
                          <div className="text-[10px] mt-0.5 text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200 truncate max-w-[200px]">
                            🔗 বাম্প: {bp.name} — <b>৳{bp.price}</b>
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-[10px] mt-0.5 border-purple-300 text-purple-600">🔗 বাম্প (অজানা)</Badge>
                        );
                      })()}
                      {(() => {
                        const addon = p.addon_config as { name?: string; price?: number } | null;
                        return addon?.name ? (
                          <div className="text-[10px] mt-0.5 text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 truncate max-w-[200px]">
                            🎁 অ্যাড-অন: {addon.name} — <b>৳{addon.price ?? 0}</b>
                          </div>
                        ) : null;
                      })()}
                    </TableCell>
                    <TableCell onClick={() => setInlineEditId(p.id)} className="cursor-pointer hover:bg-accent/50 rounded transition-colors">
                      {inlineEditId === p.id ? (
                        <InlineEditPrice
                          price={p.price}
                          salePrice={p.original_price}
                          costPrice={p.cost_price}
                          onSave={(newPrice, newSale, newCost) => inlinePriceMutation.mutate({ id: p.id, price: newPrice, original_price: newSale, cost_price: newCost })}
                          onCancel={() => setInlineEditId(null)}
                        />
                      ) : (
                        <div>
                          {p.original_price && p.original_price > 0 && p.original_price < p.price ? (
                            <>
                              <span className="font-semibold text-sm text-green-600">৳{p.original_price}</span>
                              <span className="text-xs text-muted-foreground line-through ml-1">৳{p.price}</span>
                            </>
                          ) : (
                            <span className="font-medium text-sm">৳{p.price}</span>
                          )}
                          {p.cost_price > 0 && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">কেনা: ৳{p.cost_price}</p>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <InlineStockEditor product={p} onSaved={() => {}} />
                        {p.stock <= 0 && (preorderCounts.get(p.id) || 0) > 0 && (
                          <p className="text-xs text-destructive">-{preorderCounts.get(p.id)} pre-order</p>
                        )}
                        {(salesCounts.get(p.id) || 0) > 0 && (
                          <div className="flex items-center gap-1 text-[10px] text-emerald-700">
                            <ShoppingCart className="h-3 w-3" />
                            <span>বিক্রি: <b>{salesCounts.get(p.id)}</b></span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {p.stock <= 0 && p.is_active && (
                            <Badge variant={p.allow_pre_order ? 'secondary' : 'destructive'} className="text-[10px] mt-0.5">{p.allow_pre_order ? '📦 প্রি-অর্ডার চালু' : '🚫 স্টক আউট'}</Badge>
                          )}
                          {p.is_hidden_from_shop && (
                            <Badge variant="outline" className="text-[10px] gap-0.5"><EyeOff className="h-3 w-3" /> হিডেন</Badge>
                          )}
                        </div>
                        {renderActiveToggle(p)}
                        {renderPreOrderToggle(p)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                        <Link to={`/admin/products/edit/${p.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/admin/products/edit/${p.id}`)}>
                            <Pencil className="h-4 w-4 mr-2" /> এডিট করুন
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openQuickEdit(p)}>
                            <Zap className="h-4 w-4 mr-2" /> দ্রুত এডিট
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openQuickEdit(p)}>
                            <Package className="h-4 w-4 mr-2" /> স্টক আপডেট
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => duplicateMutation.mutate(p.id)}>
                            <Copy className="h-4 w-4 mr-2" /> ডুপ্লিকেট করুন
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => toggleActiveMutation.mutate({ id: p.id, is_active: !p.is_active })}>
                            <Power className="h-4 w-4 mr-2" />
                            {p.is_active ? 'নিষ্ক্রিয় করুন' : 'সক্রিয় করুন'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleHiddenMutation.mutate({ id: p.id, is_hidden_from_shop: !p.is_hidden_from_shop })}>
                            {p.is_hidden_from_shop ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
                            {p.is_hidden_from_shop ? 'শপে দেখান' : 'শপ থেকে হাইড'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleAllowPreOrderMutation.mutate({ id: p.id, allow_pre_order: !p.allow_pre_order })}>
                            <Package className="h-4 w-4 mr-2" />
                            {p.allow_pre_order ? 'প্রি-অর্ডার বন্ধ করুন' : 'প্রি-অর্ডার চালু করুন'}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {p.deleted_at ? (
                            <>
                              <DropdownMenuItem onClick={() => restoreMutation.mutate(p.id)}>
                                <Power className="h-4 w-4 mr-2" /> পুনরুদ্ধার করুন
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => { if (confirm('স্থায়ীভাবে মুছে ফেলতে চান? এই কাজটি ফিরিয়ে আনা যাবে না।')) permanentDeleteMutation.mutate(p.id); }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" /> স্থায়ীভাবে মুছুন
                              </DropdownMenuItem>
                            </>
                          ) : (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => { if (confirm('পণ্যটি ট্র্যাশে পাঠাতে চান?')) deleteMutation.mutate(p.id); }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> ট্র্যাশে পাঠান
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                    <TableCell className="border-0 bg-transparent p-0 w-10">
                      <button
                        onClick={() => window.open(`/product/${p.slug}`, '_blank')}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-primary"
                        title="পণ্য দেখুন"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Quick Edit Modal */}
      <Dialog open={!!quickEditProduct} onOpenChange={open => { if (!open) setQuickEditProduct(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>⚡ দ্রুত এডিট — {quickEditProduct?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>দাম (৳)</Label>
              <Input type="number" value={qePrice} onChange={e => setQePrice(e.target.value)} />
            </div>
            <div>
              <Label>সেল মূল্য (৳)</Label>
              <Input type="number" value={qeOriginalPrice} onChange={e => setQeOriginalPrice(e.target.value)} placeholder="খালি রাখলে সেল নেই" />
            </div>

            {hasSizes ? (
              <div>
                <Label className="mb-2 block">সাইজভিত্তিক স্টক</Label>
                <div className="space-y-2">
                  {quickEditProduct.sizes.map((size: string) => (
                    <div key={size} className="flex items-center gap-2">
                      <span className="text-sm w-16 font-medium">{size}</span>
                      <Input
                        type="number"
                        className="h-8"
                        value={qeSizeStocks[size] || '0'}
                        onChange={e => setQeSizeStocks(prev => ({ ...prev, [size]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <Label>মোট স্টক</Label>
                <Input type="number" value={qeStock} onChange={e => setQeStock(e.target.value)} />
              </div>
            )}

            <div className="flex items-center gap-3">
              <Switch checked={qeActive} onCheckedChange={setQeActive} />
              <Label>{qeActive ? 'সক্রিয়' : 'নিষ্ক্রিয়'}</Label>
            </div>

            <div className="flex items-center gap-3">
              <Switch checked={qeAllowPreOrder} onCheckedChange={setQeAllowPreOrder} />
              <Label>{qeAllowPreOrder ? 'প্রি-অর্ডার চালু' : 'প্রি-অর্ডার বন্ধ'}</Label>
            </div>

            <Button
              className="w-full"
              onClick={() => quickEditMutation.mutate()}
              disabled={quickEditMutation.isPending}
            >
              {quickEditMutation.isPending ? 'সেভ হচ্ছে...' : 'সেভ করুন'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <ProductCsvDialog
        open={csvOpen}
        onOpenChange={setCsvOpen}
        exportIds={selectedArray.length > 0 ? selectedArray : filtered.map((p: any) => p.id)}
        isAdmin={true}
      />
    </div>
  );
}
