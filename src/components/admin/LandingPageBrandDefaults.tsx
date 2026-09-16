import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Save, Plus, Trash2, Image as ImageIcon, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { usePublicSettings, useUpdateSetting } from '@/hooks/useStoreSettings';
import ColorPickerWithRecent from '@/components/admin/ColorPickerWithRecent';
import MediaCenter from '@/components/admin/MediaCenter';
import CodeEditor from '@/components/admin/CodeEditor';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { optimizeImage } from '@/lib/imageOptimizer';
import { useShippingCharges } from '@/hooks/useShippingCharges';

const EMPTY_DEFAULTS = {
  marquee: { enabled: true, text: '', custom_html: '' },
  header: { brand_name: '', logo_url: '', helpline: '', cta_text: '', brand_color: '', show_call_button: true, show_whatsapp_button: false, whatsapp_number: '', show_cta_button: true, cta_color: '', cta_text_color: '', bg_color: '', text_color: '', show_shadow: true, custom_html: '' },
  hero: { cta_text: '', cta_color: '', bg_color: '', custom_css: '', custom_html: '' },
  order_form: { heading: '', item_label: '', submit_text: '', submit_color: '', bg_color: '', heading_color: '', heading_size: 'md', label_color: '', input_border_color: '', input_bg_color: '', total_color: '', highlight_color: '', submit_text_color: '', submit_rounded: true, card_border_color: '', show_card_shadow: true, show_email: false, show_order_note: false, custom_css: '', custom_html: '' },
  gift_service: { heading: '', description: '', sample_note: '', sample_sender: '', accent_color: '', cta_text: '', sample_images: [] as string[], image_caption: '' },
  faq: { items: [] as { q: string; a: string }[] },
  testimonial: { source: 'homepage', items: [] as { name: string; text: string; rating: number }[] },
  cta: { text: '', bg_color: '' },
  trust_signals: { enabled: true, heading: '', bg_color: '', items: [], custom_css: '', custom_html: '' },
  footer: { text: '', bg_color: '', text_color: '', custom_css: '', custom_html: '' },
};

export default function LandingPageBrandDefaults() {
  const { data: settings } = usePublicSettings();
  const updateSetting = useUpdateSetting();
  const { charges: globalCharges } = useShippingCharges();
  const [defaults, setDefaults] = useState<any>(EMPTY_DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [logoMediaOpen, setLogoMediaOpen] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (settings?.landing_page_defaults && !loaded) {
      try {
        const parsed = JSON.parse(settings.landing_page_defaults);
        setDefaults({
          marquee: { ...EMPTY_DEFAULTS.marquee, ...parsed.marquee },
          header: { ...EMPTY_DEFAULTS.header, ...parsed.header },
          hero: { ...EMPTY_DEFAULTS.hero, ...parsed.hero },
          order_form: { ...EMPTY_DEFAULTS.order_form, ...parsed.order_form },
          gift_service: { ...EMPTY_DEFAULTS.gift_service, ...parsed.gift_service },
          faq: { ...EMPTY_DEFAULTS.faq, ...parsed.faq },
          testimonial: { ...EMPTY_DEFAULTS.testimonial, ...parsed.testimonial },
          cta: { ...EMPTY_DEFAULTS.cta, ...parsed.cta },
          trust_signals: { ...EMPTY_DEFAULTS.trust_signals, ...parsed.trust_signals },
          footer: { ...EMPTY_DEFAULTS.footer, ...parsed.footer },
        });
        setLoaded(true);
      } catch { setLoaded(true); }
    } else if (settings && !loaded) {
      setLoaded(true);
    }
  }, [settings, loaded]);

  const u = (section: string, key: string, value: any) => {
    setDefaults((prev: any) => ({ ...prev, [section]: { ...prev[section], [key]: value } }));
  };

  const handleSave = () => {
    const cleaned = JSON.parse(JSON.stringify(defaults));
    updateSetting.mutate(
      { key: 'landing_page_defaults', value: JSON.stringify(cleaned) },
      { onSuccess: () => toast.success('ব্র্যান্ড ডিফল্ট সেভ হয়েছে'), onError: (e: any) => toast.error(e.message) }
    );
  };

  const handleLogoUpload = async (file: File) => {
    setLogoUploading(true);
    try {
      const optimizedFile = await optimizeImage(file);
      const ext = optimizedFile.name.split('.').pop();
      const path = `logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('product-images').upload(path, optimizedFile, { cacheControl: '31536000' });
      if (error) throw error;
      const { data } = supabase.storage.from('product-images').getPublicUrl(path);
      u('header', 'logo_url', data.publicUrl);
      toast.success('লোগো আপলোড হয়েছে');
    } catch (e: any) {
      toast.error(e.message || 'আপলোড ব্যর্থ');
    } finally {
      setLogoUploading(false);
    }
  };

  const faqItems: { q: string; a: string }[] = defaults.faq?.items || [];
  const addFaqItem = () => u('faq', 'items', [...faqItems, { q: '', a: '' }]);
  const removeFaqItem = (idx: number) => u('faq', 'items', faqItems.filter((_: any, i: number) => i !== idx));
  const updateFaqItem = (idx: number, key: 'q' | 'a', val: string) => {
    const updated = [...faqItems];
    updated[idx] = { ...updated[idx], [key]: val };
    u('faq', 'items', updated);
  };

  const giftImages: string[] = defaults.gift_service?.sample_images || [];
  const removeGiftImage = (idx: number) => u('gift_service', 'sample_images', giftImages.filter((_: any, i: number) => i !== idx));
  const handleGiftMediaSelect = (urls: string[]) => {
    u('gift_service', 'sample_images', [...giftImages, ...urls]);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
        এখানে সেট করা ডিফল্ট সব ল্যান্ডিং পেজে স্বয়ংক্রিয়ভাবে প্রয়োগ হবে। কোনো পেজে আলাদা কনফিগ দিলে সেটা override হিসেবে কাজ করবে।
      </p>

      {/* Marquee */}
      <Section title="📢 মার্কি বার">
        <div className="flex items-center gap-3 mb-3">
          <Switch checked={defaults.marquee?.enabled !== false} onCheckedChange={v => u('marquee', 'enabled', v)} />
          <Label className="text-sm">{defaults.marquee?.enabled !== false ? 'চালু' : 'বন্ধ'}</Label>
        </div>
        <Label className="text-xs mb-1 block">মার্কি টেক্সট</Label>
        <Textarea value={defaults.marquee?.text || ''} onChange={e => u('marquee', 'text', e.target.value)} rows={2} placeholder="স্বর্ণ সুতায় স্বাগতম • ..." />
        <div className="border-t border-border pt-3 mt-3">
          <Label className="text-xs mb-1 block">🌐 কাস্টম HTML</Label>
          <CodeEditor value={defaults.marquee?.custom_html || ''} onChange={v => u('marquee', 'custom_html', v)} rows={3} language="html" placeholder="<div>...</div>" />
          <p className="text-xs text-muted-foreground mt-1">এই HTML মার্কির পরে দেখাবে</p>
        </div>
      </Section>

      {/* Header */}
      <Section title="🏠 হেডার">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs mb-1 block">ব্র্যান্ড নাম</Label>
            <Input value={defaults.header?.brand_name || ''} onChange={e => u('header', 'brand_name', e.target.value)} placeholder="খালি রাখলে মূল সাইটের নাম" />
          </div>
          <div>
            <Label className="text-xs mb-1 block">হেল্পলাইন নম্বর</Label>
            <Input value={defaults.header?.helpline || ''} onChange={e => u('header', 'helpline', e.target.value)} placeholder="09617-356977" />
          </div>
          <div>
            <Label className="text-xs mb-1 block">CTA বাটন টেক্সট</Label>
            <Input value={defaults.header?.cta_text || ''} onChange={e => u('header', 'cta_text', e.target.value)} placeholder="এখনই অর্ডার করুন" />
          </div>
          <div>
            <Label className="text-xs mb-1 block">ব্র্যান্ড কালার</Label>
            <ColorPickerWithRecent value={defaults.header?.brand_color || '#8C6A1A'} onChange={v => u('header', 'brand_color', v)} />
          </div>
        </div>

        {/* Communication Buttons */}
        <div className="border-t border-border pt-3 mt-3">
          <p className="text-xs font-semibold text-muted-foreground mb-3">📞 কমিউনিকেশন বাটন</p>
          <div className="space-y-3">
            <div className="flex items-center justify-between"><Label className="text-sm">কল বাটন</Label><Switch checked={defaults.header?.show_call_button !== false} onCheckedChange={v => u('header', 'show_call_button', v)} /></div>
            <div className="flex items-center justify-between"><Label className="text-sm">হোয়াটসঅ্যাপ বাটন</Label><Switch checked={defaults.header?.show_whatsapp_button || false} onCheckedChange={v => u('header', 'show_whatsapp_button', v)} /></div>
            {defaults.header?.show_whatsapp_button && (
              <div><Label className="text-xs mb-1 block">হোয়াটসঅ্যাপ নম্বর</Label><Input value={defaults.header?.whatsapp_number || ''} onChange={e => u('header', 'whatsapp_number', e.target.value)} placeholder="01XXXXXXXXX" /></div>
            )}
            <div className="flex items-center justify-between"><Label className="text-sm">CTA বাটন</Label><Switch checked={defaults.header?.show_cta_button !== false} onCheckedChange={v => u('header', 'show_cta_button', v)} /></div>
          </div>
        </div>

        {/* CTA Style */}
        <div className="border-t border-border pt-3 mt-3">
          <p className="text-xs font-semibold text-muted-foreground mb-3">🎨 CTA বাটন স্টাইল</p>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs mb-1 block">বাটন কালার</Label><ColorPickerWithRecent value={defaults.header?.cta_color || defaults.header?.brand_color || '#8C6A1A'} onChange={v => u('header', 'cta_color', v)} /></div>
            <div><Label className="text-xs mb-1 block">টেক্সট কালার</Label><ColorPickerWithRecent value={defaults.header?.cta_text_color || '#ffffff'} onChange={v => u('header', 'cta_text_color', v)} /></div>
          </div>
        </div>

        {/* Header Style */}
        <div className="border-t border-border pt-3 mt-3">
          <p className="text-xs font-semibold text-muted-foreground mb-3">🏗️ হেডার স্টাইল</p>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs mb-1 block">ব্যাকগ্রাউন্ড</Label><ColorPickerWithRecent value={defaults.header?.bg_color || '#ffffff'} onChange={v => u('header', 'bg_color', v)} /></div>
            <div><Label className="text-xs mb-1 block">নাম কালার</Label><ColorPickerWithRecent value={defaults.header?.text_color || defaults.header?.brand_color || '#8C6A1A'} onChange={v => u('header', 'text_color', v)} /></div>
          </div>
          <div className="flex items-center justify-between mt-3"><Label className="text-sm">শ্যাডো</Label><Switch checked={defaults.header?.show_shadow !== false} onCheckedChange={v => u('header', 'show_shadow', v)} /></div>
        </div>

        {/* Logo */}
        <div className="border-t border-border pt-3 mt-3">
          <Label className="text-xs mb-1 block">🖼️ লোগো</Label>
          <div className="flex gap-2 mb-2">
            <Button type="button" variant="outline" size="sm" disabled={logoUploading} onClick={() => logoInputRef.current?.click()}>
              {logoUploading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />} আপলোড
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setLogoMediaOpen(true)}>
              <ImageIcon className="h-3 w-3 mr-1" /> মিডিয়া সেন্টার
            </Button>
          </div>
          <Input value={defaults.header?.logo_url || ''} onChange={e => u('header', 'logo_url', e.target.value)} placeholder="https://..." />
          <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleLogoUpload(e.target.files[0])} />
          {defaults.header?.logo_url && <img src={defaults.header.logo_url} alt="Logo" className="mt-2 h-10 w-10 rounded-full object-cover border border-border" />}
          <MediaCenter open={logoMediaOpen} onOpenChange={setLogoMediaOpen} onSelect={(urls: string[]) => { if (urls[0]) u('header', 'logo_url', urls[0]); }} />
        </div>

        {/* Custom HTML */}
        <div className="border-t border-border pt-3 mt-3">
          <Label className="text-xs mb-1 block">🌐 কাস্টম HTML</Label>
          <CodeEditor value={defaults.header?.custom_html || ''} onChange={v => u('header', 'custom_html', v)} rows={3} language="html" placeholder="<div>...</div>" />
          <p className="text-xs text-muted-foreground mt-1">এই HTML হেডারের পরে দেখাবে</p>
        </div>
      </Section>

      {/* Hero */}
      <Section title="🖼️ হিরো সেকশন">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs mb-1 block">CTA টেক্সট</Label>
            <Input value={defaults.hero?.cta_text || ''} onChange={e => u('hero', 'cta_text', e.target.value)} placeholder="অর্ডার করতে নিচের ফর্মে যান" />
          </div>
          <div>
            <Label className="text-xs mb-1 block">CTA কালার</Label>
            <ColorPickerWithRecent value={defaults.hero?.cta_color || '#6B1E2B'} onChange={v => u('hero', 'cta_color', v)} />
          </div>
        </div>
        <div className="mt-3">
          <Label className="text-xs mb-1 block">ব্যাকগ্রাউন্ড কালার</Label>
          <ColorPickerWithRecent value={defaults.hero?.bg_color || '#ffffff'} onChange={v => u('hero', 'bg_color', v)} />
        </div>
        <div className="border-t border-border pt-3 mt-3">
          <Label className="text-xs mb-1 block">🎨 কাস্টম CSS</Label>
          <CodeEditor value={defaults.hero?.custom_css || ''} onChange={v => u('hero', 'custom_css', v)} rows={3} language="css" placeholder=".hero-section { ... }" />
        </div>
        <div className="border-t border-border pt-3 mt-3">
          <Label className="text-xs mb-1 block">🌐 কাস্টম HTML</Label>
          <CodeEditor value={defaults.hero?.custom_html || ''} onChange={v => u('hero', 'custom_html', v)} rows={3} language="html" placeholder="<div>...</div>" />
          <p className="text-xs text-muted-foreground mt-1">এই HTML সেকশনের পরে দেখাবে</p>
        </div>
      </Section>

      {/* Order Form */}
      <Section title="🛒 অর্ডার ফর্ম">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs mb-1 block">হেডিং টেক্সট</Label>
            <Input value={defaults.order_form?.heading || ''} onChange={e => u('order_form', 'heading', e.target.value)} placeholder="অর্ডার করুন" />
          </div>
          <div>
            <Label className="text-xs mb-1 block">আইটেম লেবেল</Label>
            <Input value={defaults.order_form?.item_label || ''} onChange={e => u('order_form', 'item_label', e.target.value)} placeholder="আইটেম" />
          </div>
          <div>
            <Label className="text-xs mb-1 block">সাবমিট বাটন টেক্সট</Label>
            <Input value={defaults.order_form?.submit_text || ''} onChange={e => u('order_form', 'submit_text', e.target.value)} placeholder="অর্ডার কনফার্ম করুন" />
          </div>
          <div>
            <Label className="text-xs mb-1 block">সাবমিট বাটন কালার</Label>
            <ColorPickerWithRecent value={defaults.order_form?.submit_color || '#8C6A1A'} onChange={v => u('order_form', 'submit_color', v)} />
          </div>
          <div>
            <Label className="text-xs mb-1 block">ব্যাকগ্রাউন্ড কালার</Label>
            <ColorPickerWithRecent value={defaults.order_form?.bg_color || '#ffffff'} onChange={v => u('order_form', 'bg_color', v)} />
          </div>
        </div>

        {/* Heading Style */}
        <div className="border-t border-border pt-3 mt-3">
          <p className="text-xs font-semibold text-muted-foreground mb-3">🎨 হেডিং স্টাইল</p>
          <div className="space-y-3">
            <div><Label className="text-xs mb-1 block">হেডিং কালার</Label><ColorPickerWithRecent value={defaults.order_form?.heading_color || ''} onChange={v => u('order_form', 'heading_color', v)} /></div>
            <div>
              <Label className="text-xs mb-1 block">হেডিং সাইজ</Label>
              <select value={defaults.order_form?.heading_size || 'md'} onChange={e => u('order_form', 'heading_size', e.target.value)} className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background">
                <option value="sm">ছোট</option>
                <option value="md">মাঝারি</option>
                <option value="lg">বড়</option>
              </select>
            </div>
          </div>
        </div>

        {/* Label & Input */}
        <div className="border-t border-border pt-3 mt-3">
          <p className="text-xs font-semibold text-muted-foreground mb-3">🏷️ লেবেল ও ইনপুট</p>
          <div className="space-y-3">
            <div><Label className="text-xs mb-1 block">লেবেল কালার</Label><ColorPickerWithRecent value={defaults.order_form?.label_color || ''} onChange={v => u('order_form', 'label_color', v)} /></div>
            <div><Label className="text-xs mb-1 block">ইনপুট বর্ডার</Label><ColorPickerWithRecent value={defaults.order_form?.input_border_color || ''} onChange={v => u('order_form', 'input_border_color', v)} /></div>
            <div><Label className="text-xs mb-1 block">ইনপুট ব্যাকগ্রাউন্ড</Label><ColorPickerWithRecent value={defaults.order_form?.input_bg_color || ''} onChange={v => u('order_form', 'input_bg_color', v)} /></div>
          </div>
        </div>

        {/* Price & Highlight */}
        <div className="border-t border-border pt-3 mt-3">
          <p className="text-xs font-semibold text-muted-foreground mb-3">💰 প্রাইস ও হাইলাইট</p>
          <div className="space-y-3">
            <div><Label className="text-xs mb-1 block">সর্বমোট কালার</Label><ColorPickerWithRecent value={defaults.order_form?.total_color || '#8C6A1A'} onChange={v => u('order_form', 'total_color', v)} /></div>
            <div><Label className="text-xs mb-1 block">হাইলাইট কালার</Label><ColorPickerWithRecent value={defaults.order_form?.highlight_color || '#8C6A1A'} onChange={v => u('order_form', 'highlight_color', v)} /></div>
          </div>
        </div>

        {/* Button Style */}
        <div className="border-t border-border pt-3 mt-3">
          <p className="text-xs font-semibold text-muted-foreground mb-3">🔘 বাটন স্টাইল</p>
          <div className="space-y-3">
            <div><Label className="text-xs mb-1 block">বাটন টেক্সট কালার</Label><ColorPickerWithRecent value={defaults.order_form?.submit_text_color || '#ffffff'} onChange={v => u('order_form', 'submit_text_color', v)} /></div>
            <div className="flex items-center justify-between"><Label className="text-sm">গোলাকার বাটন</Label><Switch checked={defaults.order_form?.submit_rounded !== false} onCheckedChange={v => u('order_form', 'submit_rounded', v)} /></div>
          </div>
        </div>

        {/* Card Style */}
        <div className="border-t border-border pt-3 mt-3">
          <p className="text-xs font-semibold text-muted-foreground mb-3">🃏 কার্ড স্টাইল</p>
          <div className="space-y-3">
            <div><Label className="text-xs mb-1 block">কার্ড বর্ডার কালার</Label><ColorPickerWithRecent value={defaults.order_form?.card_border_color || ''} onChange={v => u('order_form', 'card_border_color', v)} /></div>
            <div className="flex items-center justify-between"><Label className="text-sm">কার্ড শ্যাডো</Label><Switch checked={defaults.order_form?.show_card_shadow !== false} onCheckedChange={v => u('order_form', 'show_card_shadow', v)} /></div>
          </div>
        </div>

        {/* Toggles */}
        <div className="border-t border-border pt-3 mt-3 space-y-2">
          <div className="flex items-center justify-between"><Label className="text-sm">ইমেইল ফিল্ড</Label><Switch checked={defaults.order_form?.show_email || false} onCheckedChange={v => u('order_form', 'show_email', v)} /></div>
          <div className="flex items-center justify-between"><Label className="text-sm">অর্ডার নোট</Label><Switch checked={defaults.order_form?.show_order_note || false} onCheckedChange={v => u('order_form', 'show_order_note', v)} /></div>
        </div>

        {/* Delivery Charges — no longer editable per-page-default; every landing page now always
            shows the live rate from Admin Settings → Shipping Charges (see ShippingChargesSettings),
            so there is exactly one place to change delivery charges and every page tracks it. */}
        <div className="border-t border-border pt-3 mt-3">
          <p className="text-xs text-muted-foreground">
            🚚 ডেলিভারি চার্জ এখন সব ল্যান্ডিং পেজে সরাসরি <span className="font-medium">অ্যাডমিন সেটিংস → শিপিং চার্জ</span> থেকে আসে (বর্তমানে ঢাকা ৳{globalCharges.dhaka_inside}, উপশহর ৳{globalCharges.dhaka_suburb}, ঢাকার বাইরে ৳{globalCharges.dhaka_outside}) — এখানে আলাদা করে সেট করার দরকার নেই।
          </p>
        </div>

        {/* Custom CSS & HTML */}
        <div className="border-t border-border pt-3 mt-3">
          <Label className="text-xs mb-1 block">🎨 কাস্টম CSS</Label>
          <CodeEditor value={defaults.order_form?.custom_css || ''} onChange={v => u('order_form', 'custom_css', v)} rows={3} language="css" placeholder="#order-form { ... }" />
        </div>
        <div className="border-t border-border pt-3 mt-3">
          <Label className="text-xs mb-1 block">🌐 কাস্টম HTML</Label>
          <CodeEditor value={defaults.order_form?.custom_html || ''} onChange={v => u('order_form', 'custom_html', v)} rows={3} language="html" placeholder="<div>...</div>" />
          <p className="text-xs text-muted-foreground mt-1">এই HTML সেকশনের পরে দেখাবে</p>
        </div>
      </Section>

      {/* Gift Service */}
      <Section title="🎁 গিফট সার্ভিস">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs mb-1 block">হেডিং</Label>
            <Input value={defaults.gift_service?.heading || ''} onChange={e => u('gift_service', 'heading', e.target.value)} placeholder="প্রিয়জনকে সারপ্রাইজ দিন! 🎁" />
          </div>
          <div>
            <Label className="text-xs mb-1 block">অ্যাকসেন্ট কালার</Label>
            <ColorPickerWithRecent value={defaults.gift_service?.accent_color || '#E91E63'} onChange={v => u('gift_service', 'accent_color', v)} />
          </div>
        </div>
        <div className="mt-3">
          <Label className="text-xs mb-1 block">বর্ণনা</Label>
          <Textarea value={defaults.gift_service?.description || ''} onChange={e => u('gift_service', 'description', e.target.value)} rows={2} placeholder="আপনি যদি চান আপনার প্রিয় মানুষকে উপহার দিতে..." />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <div>
            <Label className="text-xs mb-1 block">স্যাম্পল নোট</Label>
            <Textarea value={defaults.gift_service?.sample_note || ''} onChange={e => u('gift_service', 'sample_note', e.target.value)} rows={2} placeholder="তোমার জন্য ছোট্ট একটা সারপ্রাইজ!" />
          </div>
          <div>
            <Label className="text-xs mb-1 block">প্রেরকের নাম</Label>
            <Input value={defaults.gift_service?.sample_sender || ''} onChange={e => u('gift_service', 'sample_sender', e.target.value)} placeholder="তোমার আপনজন" />
          </div>
        </div>
        <div className="mt-3">
          <Label className="text-xs mb-1 block">CTA টেক্সট</Label>
          <Input value={defaults.gift_service?.cta_text || ''} onChange={e => u('gift_service', 'cta_text', e.target.value)} placeholder="গিফট নোট যোগ করুন" />
        </div>
        <div className="mt-3">
          <Label className="text-xs mb-1 block">স্যাম্পল ইমেজ</Label>
          {giftImages.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {giftImages.map((img: string, i: number) => (
                <div key={i} className="relative group w-16 h-16 rounded-md overflow-hidden border border-border">
                  <img src={img} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => removeGiftImage(i)} className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setMediaOpen(true)}>
              <ImageIcon className="h-3.5 w-3.5 mr-1" />মিডিয়া থেকে বাছাই
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => {
              const url = prompt('ইমেজ URL দিন:');
              if (url?.trim()) u('gift_service', 'sample_images', [...giftImages, url.trim()]);
            }}>URL দিয়ে যোগ</Button>
          </div>
          <MediaCenter open={mediaOpen} onOpenChange={setMediaOpen} onSelect={handleGiftMediaSelect} multiple />
        </div>
        <div className="mt-3">
          <Label className="text-xs mb-1 block">ইমেজ ক্যাপশন</Label>
          <Input value={defaults.gift_service?.image_caption || ''} onChange={e => u('gift_service', 'image_caption', e.target.value)} placeholder="মেমোতে গিফট নোট দেখতে এমন হবে ✨" />
        </div>
      </Section>

      {/* FAQ */}
      <Section title="❓ FAQ">
        <div className="space-y-3">
          {faqItems.map((item: any, i: number) => (
            <div key={i} className="border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">প্রশ্ন-উত্তর #{i + 1}</span>
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFaqItem(i)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
              <Input value={item.q} onChange={e => updateFaqItem(i, 'q', e.target.value)} placeholder="প্রশ্ন লিখুন" />
              <Textarea value={item.a} onChange={e => updateFaqItem(i, 'a', e.target.value)} rows={2} placeholder="উত্তর লিখুন" />
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addFaqItem}>
            <Plus className="h-3.5 w-3.5 mr-1" />প্রশ্ন-উত্তর যোগ করুন
          </Button>
        </div>
      </Section>

      {/* Testimonial */}
      <Section title="⭐ টেস্টিমোনিয়াল">
        <div>
          <Label className="text-xs mb-1 block">ডিফল্ট সোর্স</Label>
          <Select value={defaults.testimonial?.source || 'homepage'} onValueChange={v => u('testimonial', 'source', v)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="homepage">হোমপেজ রিভিউ</SelectItem>
              <SelectItem value="manual">ম্যানুয়াল রিভিউ</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Section>

      {/* CTA */}
      <Section title="📣 CTA বাটন">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs mb-1 block">বাটন টেক্সট</Label>
            <Input value={defaults.cta?.text || ''} onChange={e => u('cta', 'text', e.target.value)} placeholder="এখনই অর্ডার করুন" />
          </div>
          <div>
            <Label className="text-xs mb-1 block">ব্যাকগ্রাউন্ড কালার</Label>
            <ColorPickerWithRecent value={defaults.cta?.bg_color || '#8C6A1A'} onChange={v => u('cta', 'bg_color', v)} />
          </div>
        </div>
      </Section>

      {/* Trust Signals */}
      <Section title="🛡️ ট্রাস্ট সিগনাল">
        <div className="flex items-center gap-3 mb-3">
          <Switch checked={defaults.trust_signals?.enabled !== false} onCheckedChange={v => u('trust_signals', 'enabled', v)} />
          <Label className="text-sm">{defaults.trust_signals?.enabled !== false ? 'চালু' : 'বন্ধ'}</Label>
        </div>
        <Label className="text-xs mb-1 block">হেডিং</Label>
        <Input value={defaults.trust_signals?.heading || ''} onChange={e => u('trust_signals', 'heading', e.target.value)} placeholder="ডেলিভারি ও রিটার্ন পলিসি" />
        <div className="mt-3">
          <Label className="text-xs mb-1 block">ব্যাকগ্রাউন্ড কালার</Label>
          <ColorPickerWithRecent value={defaults.trust_signals?.bg_color || '#ffffff'} onChange={v => u('trust_signals', 'bg_color', v)} />
        </div>
        <div className="border-t border-border pt-3 mt-3">
          <Label className="text-xs mb-1 block">🎨 কাস্টম CSS</Label>
          <CodeEditor value={defaults.trust_signals?.custom_css || ''} onChange={v => u('trust_signals', 'custom_css', v)} rows={3} language="css" />
        </div>
        <div className="border-t border-border pt-3 mt-3">
          <Label className="text-xs mb-1 block">🌐 কাস্টম HTML</Label>
          <CodeEditor value={defaults.trust_signals?.custom_html || ''} onChange={v => u('trust_signals', 'custom_html', v)} rows={3} language="html" placeholder="<div>...</div>" />
          <p className="text-xs text-muted-foreground mt-1">এই HTML সেকশনের পরে দেখাবে</p>
        </div>
      </Section>

      {/* Footer */}
      <Section title="📄 ফুটার">
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
            ফুটার এখন মূল ওয়েবসাইটের ফুটারের সাথে sync — লোগো, যোগাযোগ, লিঙ্ক ইত্যাদি পরিবর্তন করতে সাইট এডিটর → ফুটার এ যান।
          </p>
          <div className="border-t border-border pt-3">
            <Label className="text-xs mb-1 block">🌐 কাস্টম HTML (ফুটারের পরে দেখাবে)</Label>
            <CodeEditor value={defaults.footer?.custom_html || ''} onChange={v => u('footer', 'custom_html', v)} rows={3} language="html" placeholder="<div>...</div>" />
          </div>
        </div>
      </Section>

      <Button size="sm" onClick={handleSave} disabled={updateSetting.isPending} className="w-full">
        <Save className="h-3 w-3 mr-1" /> {updateSetting.isPending ? 'সেভ হচ্ছে...' : 'ব্র্যান্ড ডিফল্ট সেভ করুন'}
      </Button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors">
            <span className="text-sm font-semibold">{title}</span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-1 space-y-3 border-t border-border">
            {children}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
