import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, Check, ArrowLeft, ArrowRight, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAiLandingGenerate } from '@/hooks/useAiLandingGenerate';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

type Step = 'products' | 'style' | 'generating' | 'success';

const TONES = [
  { key: 'bn-formal', label: 'বাংলা — ফরমাল' },
  { key: 'bn-casual', label: 'বাংলা — ক্যাজুয়াল' },
  { key: 'bn-en-mix', label: 'বাংলা + ইংরেজি মিক্স' },
];

export default function AiGenerateWizard({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('products');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [presetKey, setPresetKey] = useState<string>('');
  const [tone, setTone] = useState<string>('bn-casual');
  const [title, setTitle] = useState('');
  const generate = useAiLandingGenerate();

  // Reset on close
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep('products');
        setSelectedIds([]);
        setSearch('');
        setPresetKey('');
        setTone('bn-casual');
        setTitle('');
        generate.reset();
      }, 200);
    }
  }, [open]);

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['ai-lp-product-picker', search],
    enabled: open && step === 'products',
    queryFn: async () => {
      let q = supabase
        .from('products')
        .select('id, name, name_bn, price, original_price, images')
        .is('deleted_at', null as any)
        .eq('is_active', true);
      const trimmed = search.trim();
      if (trimmed) {
        q = q.or(`name.ilike.%${trimmed}%,name_bn.ilike.%${trimmed}%,slug.ilike.%${trimmed}%`);
      }
      const { data, error } = await q.order('created_at', { ascending: false }).limit(40);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: presets = [] } = useQuery({
    queryKey: ['ai-landing-presets-active'],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_landing_presets')
        .select('id, key, label, description, default_colors')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data || [];
    },
  });

  const selectedProducts = useMemo(
    () => products.filter((p: any) => selectedIds.includes(p.id)),
    [products, selectedIds]
  );

  const toggleProduct = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length >= 5
          ? (toast.warning('সর্বোচ্চ ৫টি প্রোডাক্ট সিলেক্ট করা যাবে'), prev)
          : [...prev, id]
    );
  };

  const handleGenerate = async () => {
    setStep('generating');
    try {
      const result = await generate.mutateAsync({
        product_ids: selectedIds,
        style_preset: presetKey || undefined,
        tone,
        title: title || undefined,
      });
      setStep('success');
      toast.success(`✨ ${result.layout_meta.section_count}টি AI সেকশন তৈরি হয়েছে`);
    } catch (e: any) {
      toast.error(e?.message || 'AI জেনারেশন ব্যর্থ হয়েছে');
      setStep('style');
    }
  };

  const goToEditor = () => {
    if (generate.data?.landing_page_id) {
      onOpenChange(false);
      navigate(`/admin/landing-pages/${generate.data.landing_page_id}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI দিয়ে ল্যান্ডিং পেজ
          </DialogTitle>
          <DialogDescription className="text-xs">
            প্রোডাক্ট সিলেক্ট করুন, স্টাইল বাছুন, AI আপনার জন্য একটি premium কনভার্শন-ফোকাসড ল্যান্ডিং পেজ বানিয়ে দেবে
          </DialogDescription>
        </DialogHeader>

        {/* Steps indicator */}
        <div className="flex items-center gap-2 text-xs">
          {(['products', 'style', 'generating', 'success'] as Step[]).map((s, i) => (
            <div
              key={s}
              className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded-full',
                step === s ? 'bg-primary text-primary-foreground' :
                  ((['products','style','generating','success'] as Step[]).indexOf(step) > i)
                    ? 'bg-primary/15 text-primary'
                    : 'bg-muted text-muted-foreground'
              )}
            >
              <span className="w-4 h-4 rounded-full bg-background/30 flex items-center justify-center text-[10px]">{i + 1}</span>
              {s === 'products' && 'প্রোডাক্ট'}
              {s === 'style' && 'স্টাইল'}
              {s === 'generating' && 'জেনারেট'}
              {s === 'success' && 'সম্পন্ন'}
            </div>
          ))}
        </div>

        {/* STEP: products */}
        {step === 'products' && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="প্রোডাক্ট খুঁজুন..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedIds.length}/5 সিলেক্টেড
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[40vh] overflow-y-auto">
              {productsLoading && <p className="col-span-full text-sm text-muted-foreground">লোড হচ্ছে...</p>}
              {!productsLoading && products.length === 0 && (
                <p className="col-span-full text-sm text-muted-foreground">কোনো প্রোডাক্ট নেই</p>
              )}
              {products.map((p: any) => {
                const sel = selectedIds.includes(p.id);
                const img = (p.images || [])[0] || '/placeholder.svg';
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleProduct(p.id)}
                    className={cn(
                      'relative text-left rounded-lg border-2 p-1.5 transition-all hover:border-primary/40',
                      sel ? 'border-primary bg-primary/5' : 'border-border'
                    )}
                  >
                    {sel && (
                      <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                    <div className="aspect-square w-full overflow-hidden rounded-md bg-muted mb-1">
                      <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
                    </div>
                    <p className="text-[11px] font-medium line-clamp-1">{p.name_bn || p.name}</p>
                    <p className="text-[10px] text-muted-foreground">৳{Number(p.price).toLocaleString('bn-BD')}</p>
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                বাতিল
              </Button>
              <Button
                size="sm"
                disabled={selectedIds.length === 0}
                onClick={() => setStep('style')}
              >
                পরবর্তী <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP: style */}
        {step === 'style' && (
          <div className="space-y-4">
            <div>
              <Label className="text-xs mb-2 block">পেজের টাইটেল (অপশনাল)</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={selectedProducts[0]?.name_bn || selectedProducts[0]?.name || 'AI ল্যান্ডিং পেজ'}
              />
            </div>

            <div>
              <Label className="text-xs mb-2 block">স্টাইল প্রিসেট</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPresetKey('')}
                  className={cn(
                    'text-left p-2.5 rounded-lg border-2 transition-all hover:border-primary/40',
                    presetKey === '' ? 'border-primary bg-primary/5' : 'border-border'
                  )}
                >
                  <p className="text-xs font-medium">অটো</p>
                  <p className="text-[10px] text-muted-foreground">AI নিজেই স্টাইল বাছবে</p>
                </button>
                {presets.map((p: any) => {
                  const sel = presetKey === p.key;
                  const color = p.default_colors?.primary || '#429B39';
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setPresetKey(p.key)}
                      className={cn(
                        'text-left p-2.5 rounded-lg border-2 transition-all hover:border-primary/40',
                        sel ? 'border-primary bg-primary/5' : 'border-border'
                      )}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="w-3 h-3 rounded-full border" style={{ background: color }} />
                        <p className="text-xs font-medium">{p.label}</p>
                      </div>
                      <p className="text-[10px] text-muted-foreground line-clamp-2">{p.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <Label className="text-xs mb-2 block">টোন</Label>
              <div className="flex flex-wrap gap-2">
                {TONES.map((t) => (
                  <Badge
                    key={t.key}
                    variant={tone === t.key ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => setTone(t.key)}
                  >
                    {t.label}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex justify-between gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setStep('products')}>
                <ArrowLeft className="h-3.5 w-3.5 mr-1" /> পিছনে
              </Button>
              <Button size="sm" onClick={handleGenerate}>
                <Sparkles className="h-3.5 w-3.5 mr-1" /> জেনারেট করুন
              </Button>
            </div>
          </div>
        )}

        {/* STEP: generating */}
        {step === 'generating' && (
          <div className="py-10 flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div className="text-center">
              <p className="text-sm font-medium">AI আপনার ল্যান্ডিং পেজ বানাচ্ছে...</p>
              <p className="text-xs text-muted-foreground mt-1">প্রোডাক্ট বিশ্লেষণ → স্ট্রাকচার → কপি → ডিজাইন</p>
              <p className="text-[10px] text-muted-foreground mt-2">২০-৪৫ সেকেন্ড সময় লাগতে পারে</p>
            </div>
          </div>
        )}

        {/* STEP: success */}
        {step === 'success' && generate.data && (
          <div className="space-y-4">
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                  <Check className="h-4 w-4" />
                </div>
                <p className="font-medium text-sm">তৈরি হয়েছে!</p>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>{generate.data.layout_meta.section_count}টি AI সেকশন তৈরি</p>
                <p>থিম: <span className="font-mono">{generate.data.layout_meta.theme || 'auto'}</span></p>
                <p>স্ল্যাগ: <span className="font-mono">/lp/{generate.data.slug}</span></p>
                <p>সময়: {(generate.data.duration_ms / 1000).toFixed(1)}s</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              পেজটি লাইভ (active) হিসেবে সংরক্ষিত হয়েছে। এডিটরে গিয়ে রিভিউ ও কাস্টমাইজ করুন।
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                বন্ধ করুন
              </Button>
              <Button size="sm" onClick={goToEditor}>
                এডিটরে যান <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
