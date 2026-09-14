import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAllSettings } from '@/hooks/useAllSettings';
import { useUpdateSetting } from '@/hooks/useStoreSettings';
import { useSiteConfig, useSaveSiteConfig, DEFAULT_NAVBAR_CONFIG, DEFAULT_FOOTER_CONFIG, DEFAULT_INVOICE_CONFIG } from '@/hooks/useSiteConfig';
import { useAIGenerate } from '@/hooks/useAIGenerate';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AIGenerateButton from '@/components/admin/AIGenerateButton';
import MediaCenter from '@/components/admin/MediaCenter';
import { ArrowLeft, Image as ImageIcon, RotateCcw, Save, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminBrandingSeo() {
  const navigate = useNavigate();
  const { data: allSettings } = useAllSettings();
  const updateSetting = useUpdateSetting();
  const { generateContent: generateAI, loading: aiLoading } = useAIGenerate();

  const { data: navbarConfig } = useSiteConfig('navbar_config');
  const { data: footerConfig } = useSiteConfig('footer_config');
  const { data: invoiceConfig } = useSiteConfig('invoice_config');
  const saveConfig = useSaveSiteConfig();

  const [masterLogo, setMasterLogo] = useState('');
  const [mediaOpen, setMediaOpen] = useState(false);
  const [applying, setApplying] = useState(false);

  const [seo, setSeo] = useState({ title: '', description: '', keywords: '', og_image: '' });
  const [seoMediaOpen, setSeoMediaOpen] = useState(false);
  const [seoDirty, setSeoDirty] = useState(false);

  useEffect(() => {
    if (allSettings?.master_logo_url !== undefined) setMasterLogo(allSettings.master_logo_url || '');
  }, [allSettings?.master_logo_url]);

  useEffect(() => {
    if (!allSettings) return;
    setSeo({
      title: allSettings.site_seo_title || '',
      description: allSettings.site_seo_description || '',
      keywords: allSettings.site_seo_keywords || '',
      og_image: allSettings.site_seo_og_image || '',
    });
  }, [allSettings]);

  const updateSeo = (patch: Partial<typeof seo>) => { setSeo(p => ({ ...p, ...patch })); setSeoDirty(true); };

  const applyEverywhere = async (url: string) => {
    setApplying(true);
    try {
      await updateSetting.mutateAsync({ key: 'master_logo_url', value: url });
      await saveConfig.mutateAsync({ key: 'navbar_config', value: { ...DEFAULT_NAVBAR_CONFIG, ...navbarConfig, logo_url: url } });
      await saveConfig.mutateAsync({ key: 'footer_config', value: { ...DEFAULT_FOOTER_CONFIG, ...footerConfig, logo_url: url } });
      await saveConfig.mutateAsync({ key: 'invoice_config', value: { ...DEFAULT_INVOICE_CONFIG, ...invoiceConfig, logo_url: url } });
      toast.success('লোগো সব জায়গায় প্রয়োগ হয়েছে');
    } catch (e: any) {
      toast.error(e.message || 'প্রয়োগ করা যায়নি');
    } finally {
      setApplying(false);
    }
  };

  const handlePickMasterLogo = async (urls: string[]) => {
    const url = urls[0];
    if (!url) return;
    setMasterLogo(url);
    await applyEverywhere(url);
  };

  const handleSaveSeo = async () => {
    try {
      await Promise.all([
        updateSetting.mutateAsync({ key: 'site_seo_title', value: seo.title }),
        updateSetting.mutateAsync({ key: 'site_seo_description', value: seo.description }),
        updateSetting.mutateAsync({ key: 'site_seo_keywords', value: seo.keywords }),
        updateSetting.mutateAsync({ key: 'site_seo_og_image', value: seo.og_image }),
      ]);
      toast.success('SEO সেভ হয়েছে');
      setSeoDirty(false);
    } catch (e: any) {
      toast.error(e.message || 'সেভ করা যায়নি');
    }
  };

  const handleGenerateSeo = async () => {
    const result = await generateAI('seo', 'স্বর্ণ সুতা — বাংলাদেশের একটি অনলাইন নারী পোশাকের দোকান, শাড়ি/থ্রি পিস/টু পিস/বোরখা বিক্রি করে, সারাদেশে ক্যাশ অন ডেলিভারি দেয়। এই দোকানের হোমপেজের জন্য SEO টাইটেল, বিবরণ ও কীওয়ার্ড লিখে দাও।');
    if (!result) return;
    let cleaned = result.trim().replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?\s*```$/i, '').trim();
    const apply = (p: any) => {
      updateSeo({
        title: p.seo_title || seo.title,
        description: p.seo_description || seo.description,
        keywords: p.seo_keywords || seo.keywords,
      });
      toast.success('SEO তথ্য জেনারেট হয়েছে');
    };
    try {
      apply(JSON.parse(cleaned));
    } catch {
      const m = cleaned.match(/\{[\s\S]*"seo_title"[\s\S]*\}/);
      if (m) { try { apply(JSON.parse(m[0])); } catch { /* ignore */ } }
    }
  };

  const locations = [
    { label: 'হেডার / নেভবার', url: navbarConfig?.logo_url, editPath: '/admin/site-editor?page=navbar' },
    { label: 'ফুটার', url: footerConfig?.logo_url, editPath: '/admin/site-editor?page=footer' },
    { label: 'ইনভয়েস / ডেলিভারি মেমো', url: invoiceConfig?.logo_url, editPath: '/admin/site-editor/invoice' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/admin/site-editor')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-bold">🖼️ লোগো ও SEO</h1>
      </div>

      {/* ===== Master Logo ===== */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">মাস্টার লোগো</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            এখানে একটা লোগো সেট করলে হেডার, ফুটার আর ইনভয়েসে — সব জায়গায় সাথে সাথে বসে যাবে। প্রতিটা জায়গা আলাদাভাবেও বদলানো যায় (নিচে "এডিট" লিংক থেকে) — পরে ভুল হলে এখান থেকে আবার এক ক্লিকে সব জায়গায় মাস্টার লোগো ফিরিয়ে দিতে পারবে।
          </p>

          <div className="flex items-center gap-4">
            <div className="h-20 w-20 rounded-lg border border-border flex items-center justify-center bg-muted/30 shrink-0 overflow-hidden">
              {masterLogo ? <img src={masterLogo} alt="Master Logo" className="max-h-full max-w-full object-contain" /> : <ImageIcon className="h-6 w-6 text-muted-foreground" />}
            </div>
            <div className="flex-1 space-y-2">
              <Button size="sm" variant="outline" onClick={() => setMediaOpen(true)} disabled={applying}>
                <ImageIcon className="h-4 w-4 mr-1.5" /> {masterLogo ? 'লোগো বদলান' : 'লোগো সিলেক্ট করুন'}
              </Button>
              {masterLogo && (
                <Button size="sm" variant="secondary" className="ml-2" onClick={() => applyEverywhere(masterLogo)} disabled={applying}>
                  <RotateCcw className="h-4 w-4 mr-1.5" /> {applying ? 'প্রয়োগ হচ্ছে...' : 'সব জায়গায় আবার প্রয়োগ করুন'}
                </Button>
              )}
            </div>
          </div>

          <div className="border-t border-border pt-3 space-y-2">
            {locations.map(loc => (
              <div key={loc.label} className="flex items-center justify-between text-xs rounded bg-muted/40 px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  {loc.url ? <img src={loc.url} className="h-6 w-6 object-contain rounded shrink-0" /> : <ImageIcon className="h-4 w-4 text-muted-foreground shrink-0" />}
                  <span className="truncate">{loc.label}</span>
                </div>
                <Button size="sm" variant="ghost" className="h-6 text-[11px] px-2 shrink-0" onClick={() => navigate(loc.editPath)}>এডিট</Button>
              </div>
            ))}
          </div>

          <div className="rounded bg-amber-500/10 border border-amber-500/20 p-2.5 text-[11px] text-muted-foreground">
            ⚠️ ফেভিকন (ব্রাউজার ট্যাবের আইকন) আর PWA অ্যাপ আইকন — এই দুইটা কোড-এর মধ্যে ফিক্সড ফাইল হিসেবে থাকে, এখান থেকে বদলানো যায় না। লোগো বদলানোর পর ওগুলোও আপডেট করতে চাইলে এই চ্যাটে বলো, নতুন লোগো দিয়ে regenerate করে দেব।
          </div>
        </CardContent>
      </Card>

      {/* ===== SEO ===== */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">হোমপেজ SEO</CardTitle>
            <AIGenerateButton loading={aiLoading} size="sm" tooltip="AI দিয়ে SEO লিখুন" onClick={handleGenerateSeo} />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground -mt-1">এটা শুধু হোমপেজের জন্য। প্রতিটা প্রোডাক্ট আর কাস্টম পেজের নিজস্ব SEO আলাদাভাবে সেই পণ্য/পেজ এডিট করার সময় সেট করা যায়, ওগুলো এখানে বদলাবে না।</p>
          <div>
            <Label className="flex items-center justify-between text-xs">মেটা টাইটেল <span className="text-muted-foreground">{seo.title.length}/60</span></Label>
            <Input value={seo.title} onChange={e => updateSeo({ title: e.target.value })} maxLength={60} placeholder="স্বর্ণ সুতা | বাংলাদেশের সেরা অনলাইন শপ" />
          </div>
          <div>
            <Label className="flex items-center justify-between text-xs">মেটা বিবরণ <span className="text-muted-foreground">{seo.description.length}/160</span></Label>
            <textarea value={seo.description} onChange={e => updateSeo({ description: e.target.value })} maxLength={160}
              className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background min-h-[60px] resize-y"
              placeholder="স্বর্ণ সুতা থেকে সেরা মানের পোশাক কিনুন..." />
          </div>
          <div>
            <Label className="text-xs">SEO কীওয়ার্ড (কমা দিয়ে আলাদা)</Label>
            <textarea value={seo.keywords} onChange={e => updateSeo({ keywords: e.target.value })}
              className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background min-h-[50px] resize-y"
              placeholder="শাড়ি, থ্রি পিস, অনলাইন শপিং বাংলাদেশ..." />
          </div>
          <div>
            <Label className="text-xs">শেয়ার করলে যে ছবি দেখাবে (OG Image)</Label>
            <div className="flex items-center gap-3 mt-1">
              {seo.og_image ? <img src={seo.og_image} className="h-14 w-14 object-cover rounded border" /> : <div className="h-14 w-14 rounded border bg-muted/30 flex items-center justify-center"><ImageIcon className="h-5 w-5 text-muted-foreground" /></div>}
              <Button size="sm" variant="outline" onClick={() => setSeoMediaOpen(true)}><ImageIcon className="h-4 w-4 mr-1.5" /> ছবি সিলেক্ট</Button>
              {seo.og_image && <Button size="sm" variant="ghost" onClick={() => updateSeo({ og_image: '' })}>সরান</Button>}
            </div>
          </div>
          {seoDirty && (
            <Button onClick={handleSaveSeo} disabled={updateSetting.isPending} size="sm" className="w-full">
              <Save className="h-4 w-4 mr-1" /> সেভ করুন
            </Button>
          )}
        </CardContent>
      </Card>

      <MediaCenter open={mediaOpen} onOpenChange={setMediaOpen} onSelect={handlePickMasterLogo} />
      <MediaCenter open={seoMediaOpen} onOpenChange={setSeoMediaOpen} onSelect={(urls) => updateSeo({ og_image: urls[0] || '' })} />
    </div>
  );
}
