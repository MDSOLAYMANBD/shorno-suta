import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Download, Loader2, Wand2, Image as ImageIcon, Save, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useAIGenerate, type BannerImageOptions, type BannerImageModel } from '@/hooks/useAIGenerate';
import { toast } from 'sonner';
import SEOHead from '@/components/SEOHead';
import { supabase } from '@/integrations/supabase/client';

const STYLE_HINTS = [
  { label: 'প্রোডাক্ট ব্যানার', text: 'high-quality e-commerce product banner, studio lighting, clean composition' },
  { label: 'ফেস্টিভ সেল', text: 'festive sale banner with vibrant colors, celebration mood, eid/puja festive theme' },
  { label: 'মিনিমাল', text: 'minimalist banner design, soft pastel background, lots of negative space, modern typography' },
  { label: 'লাইফস্টাইল', text: 'lifestyle photography style, natural lighting, candid feel, warm tones' },
  { label: 'লাক্সারি', text: 'luxury aesthetic, gold accents, dark moody background, premium feel' },
];

const SIZE_OPTIONS: Array<{ value: BannerImageOptions['size']; label: string; ratio: string }> = [
  { value: '1792x1024', label: 'Landscape (16:9)', ratio: 'হিরো ব্যানার, ফেসবুক কভার' },
  { value: '1024x1024', label: 'Square (1:1)', ratio: 'ইনস্টাগ্রাম পোস্ট, প্রোডাক্ট কার্ড' },
  { value: '1024x1792', label: 'Portrait (9:16)', ratio: 'স্টোরি, রিল কভার' },
];

const MODEL_OPTIONS: Array<{ value: BannerImageModel; label: string; hint: string }> = [
  { value: 'auto', label: 'অটো (সবচেয়ে ভালো উপলব্ধ)', hint: 'সিস্টেম স্বয়ংক্রিয়ভাবে বেছে নেবে' },
  { value: 'gemini-3.1-flash-image-preview', label: 'Gemini 3.1 Flash Image (Nano Banana 2) ⭐ নতুন', hint: 'দ্রুত + প্রো-লেভেল কোয়ালিটি' },
  { value: 'gemini-3-pro-image-preview', label: 'Gemini 3 Pro Image 🏆 সেরা কোয়ালিটি', hint: 'সর্বোচ্চ ডিটেইল, ধীর' },
  { value: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image (Nano Banana)', hint: 'স্থিতিশীল, ব্যালান্সড' },
  { value: 'gemini-2.5-flash-image-preview', label: 'Gemini 2.5 Flash Image (Preview)', hint: 'পুরাতন প্রিভিউ ভার্সন' },
  { value: 'imagen-4.0-generate-001', label: 'Imagen 4.0 (Photorealistic)', hint: 'ফটোরিয়ালিস্টিক ছবির জন্য সেরা' },
  { value: 'imagen-3.0-generate-002', label: 'Imagen 3.0', hint: 'স্থিতিশীল ফটো জেনারেশন' },
];

export default function AdminBannerGenerator() {
  const navigate = useNavigate();
  const { generateBannerImage, loading } = useAIGenerate();

  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState<BannerImageOptions['size']>('1792x1024');
  const [quality, setQuality] = useState<BannerImageOptions['quality']>('standard');
  const [model, setModel] = useState<BannerImageModel>('gemini-3.1-flash-image-preview');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);

  const appendHint = (text: string) => {
    setPrompt((p) => (p.trim() ? `${p}, ${text}` : text));
  };

  const saveToMedia = async (url: string): Promise<string | null> => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const ext = (blob.type.split('/')[1] || 'png').split(';')[0];
      const path = `banners/ai-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from('product-images')
        .upload(path, blob, { cacheControl: '31536000', contentType: blob.type || 'image/png' });
      if (error) throw error;
      const { data } = supabase.storage.from('product-images').getPublicUrl(path);
      return data.publicUrl;
    } catch (e: any) {
      console.error('[banner] save to media failed', e);
      toast.error('মিডিয়ায় সেভ করা যায়নি: ' + (e?.message || ''));
      return null;
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('প্রম্পট লিখুন');
      return;
    }
    const url = await generateBannerImage(prompt, { size, quality, model });
    if (url) {
      const savedUrl = (await saveToMedia(url)) || url;
      setImageUrl(savedUrl);
      setHistory((h) => [savedUrl, ...h].slice(0, 10));
      toast.success('ব্যানার তৈরি ও মিডিয়ায় সেভ হয়েছে! 🎨');
    }
  };

  const handleDownload = async () => {
    if (!imageUrl) return;
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `banner-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('ডাউনলোড শুরু হয়েছে');
    } catch {
      toast.error('ডাউনলোড ব্যর্থ হয়েছে');
    }
  };

  const handleCopyUrl = async () => {
    if (!imageUrl) return;
    await navigator.clipboard.writeText(imageUrl);
    toast.success('URL কপি হয়েছে');
  };

  const handleOpenInMedia = () => {
    toast.info('ছবিটি ইতিমধ্যে মিডিয়া সেন্টারে সেভ হয়েছে (hero-banners বাকেটে)');
    navigate('/admin/media');
  };

  return (
    <div className="container max-w-6xl mx-auto p-4 md:p-6 space-y-4 pb-24">
      <SEOHead title="AI ব্যানার জেনারেটর — Gemini" description="Google Gemini দিয়ে মার্কেটিং ব্যানার তৈরি করুন।" />

      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-primary" />
              AI ব্যানার জেনারেটর
            </h1>
            <p className="text-xs text-muted-foreground">Google Gemini দিয়ে মার্কেটিং ব্যানার তৈরি করুন</p>
          </div>
        </div>
        <Badge variant="outline" className="hidden md:inline-flex">Google Gemini</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* LEFT: Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              প্রম্পট ও সেটিংস
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm">প্রম্পট (বাংলা/ইংরেজি)</Label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="উদাহরণ: A vibrant Eid sale banner showing elegant Bangladeshi three-piece dresses on mannequins, festive lights, golden accents..."
                className="min-h-[140px] mt-1.5 resize-y"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {prompt.length} / 4000 অক্ষর — ইংরেজি প্রম্পট সাধারণত ভালো ফল দেয়
              </p>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">স্টাইল হিন্ট যোগ করুন</Label>
              <div className="flex flex-wrap gap-1.5">
                {STYLE_HINTS.map((h) => (
                  <Button
                    key={h.label}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => appendHint(h.text)}
                  >
                    + {h.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">সাইজ / অ্যাসপেক্ট</Label>
                <Select value={size} onValueChange={(v) => setSize(v as BannerImageOptions['size'])}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SIZE_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value!}>
                        <div className="flex flex-col">
                          <span>{s.label}</span>
                          <span className="text-xs text-muted-foreground">{s.ratio}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">কোয়ালিটি</Label>
                <Select value={quality} onValueChange={(v) => setQuality(v as BannerImageOptions['quality'])}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard (~$0.04–$0.08)</SelectItem>
                    <SelectItem value="hd">HD (~$0.08–$0.12)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-sm">AI মডেল</Label>
              <Select value={model} onValueChange={(v) => setModel(v as BannerImageModel)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODEL_OPTIONS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      <div className="flex flex-col">
                        <span>{m.label}</span>
                        <span className="text-xs text-muted-foreground">{m.hint}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">
                নতুন Gemini 3.x মডেলগুলো অনেক বেশি ডিটেইল ও টেক্সট রেন্ডারিং দেয়। অনুপলব্ধ হলে স্বয়ংক্রিয়ভাবে fallback হবে।
              </p>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={loading || !prompt.trim()}
              className="w-full"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  জেনারেট হচ্ছে... (১০-২০ সেকেন্ড)
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  ব্যানার তৈরি করুন
                </>
              )}
            </Button>

              <p className="text-[11px] text-muted-foreground leading-relaxed bg-muted/50 rounded-md p-2">
              💡 খরচ আপনার Gemini/Google AI Studio অ্যাকাউন্টে চার্জ হবে। ব্র্যান্ড লোগো, সেলিব্রিটি, বা সংবেদনশীল কনটেন্ট রিজেক্ট হতে পারে।
            </p>
          </CardContent>
        </Card>

        {/* RIGHT: Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-primary" />
              প্রিভিউ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="aspect-video bg-muted/30 border-2 border-dashed border-border rounded-lg flex items-center justify-center overflow-hidden">
              {loading ? (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm">Gemini ছবি আঁকছে...</p>
                </div>
              ) : imageUrl ? (
                <img src={imageUrl} alt="Generated banner" className="w-full h-full object-contain" />
              ) : (
                <div className="text-center text-muted-foreground p-6">
                  <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">এখনো কোনো ব্যানার তৈরি হয়নি</p>
                  <p className="text-xs mt-1">প্রম্পট লিখে "ব্যানার তৈরি করুন" বাটনে ক্লিক করুন</p>
                </div>
              )}
            </div>

            {imageUrl && (
              <div className="flex flex-wrap gap-2 mt-3">
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  ডাউনলোড
                </Button>
                <Button variant="outline" size="sm" onClick={handleCopyUrl}>
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                  URL কপি
                </Button>
                <Button variant="outline" size="sm" onClick={handleOpenInMedia}>
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  মিডিয়া সেন্টারে দেখুন
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* History */}
      {history.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">এই সেশনের জেনারেশন</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {history.map((url, idx) => (
                <button
                  key={url + idx}
                  type="button"
                  onClick={() => setImageUrl(url)}
                  className="aspect-video bg-muted/30 rounded-md overflow-hidden border border-border hover:border-primary transition-colors"
                >
                  <img src={url} alt={`Banner ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
