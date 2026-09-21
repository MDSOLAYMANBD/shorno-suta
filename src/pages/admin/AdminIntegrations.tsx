import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useStoreSettings, useUpdateSetting } from '@/hooks/useStoreSettings';
import { useActivityLog } from '@/hooks/useActivityLog';
import { Copy, Save, ChevronDown, ShieldCheck } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import SmsProvidersSection from '@/components/admin/SmsProvidersSection';


const SUPABASE_URL = 'https://xxucasikopqtcztbgfbw.supabase.co';
const defaultGoogleFeed = `${SUPABASE_URL}/functions/v1/product-feed?format=google`;
const defaultFacebookFeed = `${SUPABASE_URL}/functions/v1/product-feed?format=facebook`;

export default function AdminIntegrations() {
  const { data: settings = {}, isLoading } = useStoreSettings();
  const updateSetting = useUpdateSetting();
  const { logActivity } = useActivityLog();
  const [captchaEnabled, setCaptchaEnabled] = useState(false);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState('99e0b4e6-2978-40d0-8ce8-327edcfa19d2');


  const [verification, setVerification] = useState({
    pinterest_verification: '',
    google_verification: '',
    facebook_domain_verification: '',
  });

  const [form, setForm] = useState({
    gtm_id: '',
    facebook_pixel_id: '',
    meta_capi_access_token: '',
    meta_test_event_code: '',
    meta_pixel_enabled: 'true',
    meta_capi_enabled: 'false',
    google_ads_accounts: '',
    google_ads_webhook_url: '',
  });

  const [apiKeys, setApiKeys] = useState({
    courier_webhook_secret: '',
    bd_courier_api_key: '',
    steadfast_api_key: '',
    steadfast_secret_key: '',
    steadfast_merchant_id: '',
    courier_default_note: '',
    courier_exchange_default_note: '',
    pathao_api_key: '',
    pathao_secret_key: '',
    pathao_merchant_id: '',
    pathao_username: '',
    pathao_password: '',
    pathao_store_id: '',
    redx_api_key: '',
    redx_token: '',
    redx_pickup_store_id: '',
    redx_merchant_id: '',
    uddoktapay_api_key: '',
    uddoktapay_base_url: '',
  });

  const [smsKeys, setSmsKeys] = useState({
    mimsms_username: '',
    mimsms_api_key: '',
    mimsms_sender_id: '',
  });

  const [metaInbox, setMetaInbox] = useState({
    meta_app_id: '',
    meta_app_secret: '',
    meta_verify_token: '',
    meta_page_access_token: '',
    meta_page_id: '',
    whatsapp_access_token: '',
    whatsapp_phone_number_id: '',
    whatsapp_business_account_id: '',
    instagram_access_token: '',
    instagram_app_id: '',
    instagram_app_secret: '',
  });

  useEffect(() => {
    if (settings) {
      setForm({
        gtm_id: settings.gtm_id || '',
        facebook_pixel_id: settings.facebook_pixel_id || '',
        meta_capi_access_token: settings.meta_capi_access_token || '',
        meta_test_event_code: settings.meta_test_event_code || '',
        meta_pixel_enabled: settings.meta_pixel_enabled ?? 'true',
        meta_capi_enabled: settings.meta_capi_enabled ?? 'false',
        google_ads_accounts: settings.google_ads_accounts || '',
        google_ads_webhook_url: settings.google_ads_webhook_url || '',
      });
      setApiKeys({
        courier_webhook_secret: settings.courier_webhook_secret || '',
        bd_courier_api_key: settings.bd_courier_api_key || '',
        steadfast_api_key: settings.steadfast_api_key || '',
        steadfast_secret_key: settings.steadfast_secret_key || '',
        steadfast_merchant_id: settings.steadfast_merchant_id || '',
        courier_default_note: settings.courier_default_note || '',
        courier_exchange_default_note: settings.courier_exchange_default_note || '',
        pathao_api_key: settings.pathao_api_key || '',
        pathao_secret_key: settings.pathao_secret_key || '',
        pathao_merchant_id: settings.pathao_merchant_id || '',
        pathao_username: settings.pathao_username || '',
        pathao_password: settings.pathao_password || '',
        pathao_store_id: settings.pathao_store_id || '',
        redx_api_key: settings.redx_api_key || '',
        redx_token: settings.redx_token || '',
        redx_pickup_store_id: settings.redx_pickup_store_id || '',
        redx_merchant_id: settings.redx_merchant_id || '',
        uddoktapay_api_key: settings.uddoktapay_api_key || '',
        uddoktapay_base_url: settings.uddoktapay_base_url || '',
      });
      setSmsKeys({
        mimsms_username: settings.mimsms_username || '',
        mimsms_api_key: settings.mimsms_api_key || '',
        mimsms_sender_id: settings.mimsms_sender_id || '',
      });
      setMetaInbox({
        meta_app_id: settings.meta_app_id || '',
        meta_app_secret: settings.meta_app_secret || '',
        meta_verify_token: settings.meta_verify_token || '',
        meta_page_access_token: settings.meta_page_access_token || '',
        meta_page_id: settings.meta_page_id || '',
        whatsapp_access_token: settings.whatsapp_access_token || '',
        whatsapp_phone_number_id: settings.whatsapp_phone_number_id || '',
        whatsapp_business_account_id: settings.whatsapp_business_account_id || '',
        instagram_access_token: settings.instagram_access_token || '',
        instagram_app_id: settings.instagram_app_id || '',
        instagram_app_secret: settings.instagram_app_secret || '',
      });
      setVerification({
        pinterest_verification: settings.pinterest_verification || '',
        google_verification: settings.google_verification || '',
        facebook_domain_verification: settings.facebook_domain_verification || '',
      });
      setCaptchaEnabled(settings.captcha_enabled === 'true');
      setTurnstileSiteKey(settings.turnstile_site_key || '99e0b4e6-2978-40d0-8ce8-327edcfa19d2');
    }
  }, [settings]);

  const validateSetting = (key: string, value: string): boolean => {
    if (key === 'gtm_id' && value && !/^GTM-[A-Z0-9]{7,8}$/.test(value)) {
      toast.error('Invalid GTM ID format. Expected: GTM-XXXXXXX');
      return false;
    }
    if (key === 'facebook_pixel_id' && value && !/^[0-9]{15,16}$/.test(value)) {
      toast.error('Invalid Facebook Pixel ID format. Expected: 15-16 digit number');
      return false;
    }
    if (key === 'google_ads_accounts' && value) {
      const lines = value.split(/[\n,]/).map((s: string) => s.trim()).filter(Boolean);
      const bad = lines.find((line: string) => !/^[0-9]{6,12}:[A-Za-z0-9_-]+$/.test(line));
      if (bad) {
        toast.error(`ভুল ফরম্যাট: "${bad}" — প্রতি লাইনে হতে হবে ConversionID:ConversionLabel`);
        return false;
      }
    }
    return true;
  };

  const saveSetting = async (key: string) => {
    const value = (form as any)[key];
    if (!validateSetting(key, value)) return;
    try {
      await updateSetting.mutateAsync({ key, value });
      logActivity('settings_change', 'settings', key, `সেটিং পরিবর্তন: ${key}`);
      toast.success(`${key} সেভ হয়েছে`);
    } catch {
      toast.error('সেভ করতে সমস্যা হয়েছে');
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('URL copied!');
  };

  if (isLoading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <span>🔌</span> ইন্টিগ্রেশন
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Marketing, Courier, Payment, SMS, Messenger, WhatsApp ইত্যাদি সব integration এক জায়গায়।</p>
      </div>
      <div className="grid gap-3">
        {/* 📊 Marketing */}
        <Collapsible>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between border rounded-xl px-4 py-3 hover:bg-accent/50 transition cursor-pointer">
              <div className="flex items-center gap-3">
                <span className="text-xl">📊</span>
                <span className="font-medium">Marketing</span>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="mt-2 border-0 shadow-none">
              <CardContent className="space-y-4 pt-4">
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label>GTM Container ID</Label>
                    <Input value={form.gtm_id} onChange={e => setForm(p => ({ ...p, gtm_id: e.target.value }))} placeholder="GTM-XXXXXXX" />
                  </div>
                  <Button size="sm" onClick={() => saveSetting('gtm_id')}><Save className="h-4 w-4" /></Button>
                </div>

                <div className="border-t border-border pt-4">
                  <h3 className="text-sm font-semibold mb-3">Meta (Facebook) Pixel & CAPI</h3>
                </div>

                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label>Meta Pixel ID</Label>
                    <Input value={form.facebook_pixel_id} onChange={e => setForm(p => ({ ...p, facebook_pixel_id: e.target.value }))} placeholder="1234567890123456" />
                  </div>
                  <Button size="sm" onClick={() => saveSetting('facebook_pixel_id')}><Save className="h-4 w-4" /></Button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Pixel চালু/বন্ধ</Label>
                    <p className="text-xs text-muted-foreground">Browser-side Meta Pixel tracking</p>
                  </div>
                  <Switch
                    checked={form.meta_pixel_enabled === 'true'}
                    onCheckedChange={async (v) => {
                      const val = v ? 'true' : 'false';
                      setForm(p => ({ ...p, meta_pixel_enabled: val }));
                      await updateSetting.mutateAsync({ key: 'meta_pixel_enabled', value: val });
                      toast.success('Pixel সেটিং সেভ হয়েছে');
                    }}
                  />
                </div>

                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label>CAPI Access Token</Label>
                    <Input type="password" value={form.meta_capi_access_token} onChange={e => setForm(p => ({ ...p, meta_capi_access_token: e.target.value }))} placeholder="••••••••" />
                  </div>
                  <Button size="sm" onClick={async () => {
                    try {
                      await updateSetting.mutateAsync({ key: 'meta_capi_access_token', value: form.meta_capi_access_token });
                      toast.success('CAPI Access Token সেভ হয়েছে');
                    } catch { toast.error('সেভ করতে সমস্যা হয়েছে'); }
                  }}><Save className="h-4 w-4" /></Button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>CAPI চালু/বন্ধ</Label>
                    <p className="text-xs text-muted-foreground">Server-side Conversion API</p>
                  </div>
                  <Switch
                    checked={form.meta_capi_enabled === 'true'}
                    onCheckedChange={async (v) => {
                      const val = v ? 'true' : 'false';
                      setForm(p => ({ ...p, meta_capi_enabled: val }));
                      await updateSetting.mutateAsync({ key: 'meta_capi_enabled', value: val });
                      toast.success('CAPI সেটিং সেভ হয়েছে');
                    }}
                  />
                </div>

                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label>Test Event Code (ঐচ্ছিক)</Label>
                    <Input value={form.meta_test_event_code} onChange={e => setForm(p => ({ ...p, meta_test_event_code: e.target.value }))} placeholder="TEST12345" />
                  </div>
                  <Button size="sm" onClick={async () => {
                    try {
                      await updateSetting.mutateAsync({ key: 'meta_test_event_code', value: form.meta_test_event_code });
                      toast.success('Test Event Code সেভ হয়েছে');
                    } catch { toast.error('সেভ করতে সমস্যা হয়েছে'); }
                  }}><Save className="h-4 w-4" /></Button>
                </div>
                <p className="text-xs text-muted-foreground">Meta Events Manager → Test Events থেকে Test Event Code পান।</p>

                <div className="border-t border-border pt-4">
                  <h3 className="text-sm font-semibold mb-3">Google Ads Conversion Tracking</h3>
                  <p className="text-xs text-muted-foreground mb-3">এটা না দিলে Google Ads-এ কোনো Purchase কনভার্সন যায় না — Smart Bidding অন্ধভাবে চলে। একাধিক Google Ads অ্যাকাউন্ট থেকে একই সাথে অ্যাড চললে সবগুলো এখানে যোগ করুন।</p>
                </div>

                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label>Conversion Accounts (প্রতি লাইনে একটা)</Label>
                    <Textarea
                      value={form.google_ads_accounts}
                      onChange={e => setForm(p => ({ ...p, google_ads_accounts: e.target.value }))}
                      placeholder={'17796542216:w0izCMfKkPgbEljehqZC\n123456789:AbCdEfGhIjKlMnOp'}
                      rows={3}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground mt-1">ফরম্যাট: ConversionID:ConversionLabel (AW- ছাড়া) — একাধিক অ্যাকাউন্ট থাকলে আলাদা লাইনে দিন।</p>
                  </div>
                  <Button size="sm" onClick={() => saveSetting('google_ads_accounts')}><Save className="h-4 w-4" /></Button>
                </div>

                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label>Webhook URL (ঐচ্ছিক — server-side offline conversion upload)</Label>
                    <Input value={form.google_ads_webhook_url} onChange={e => setForm(p => ({ ...p, google_ads_webhook_url: e.target.value }))} placeholder="https://..." />
                  </div>
                  <Button size="sm" onClick={() => saveSetting('google_ads_webhook_url')}><Save className="h-4 w-4" /></Button>
                </div>
                <p className="text-xs text-muted-foreground">Google Ads → Tools → Conversions → নতুন Conversion Action বানিয়ে "Use Google Tag" থেকে ID/Label পান। প্রতিটা অ্যাকাউন্টের জন্য আলাদা করে করুন।</p>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>

        {/* 🔍 ফ্রড চেকার (BD Courier) */}
        <Collapsible>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between border rounded-xl px-4 py-3 hover:bg-accent/50 transition cursor-pointer">
              <div className="flex items-center gap-3">
                <span className="text-xl">🔍</span>
                <span className="font-medium">ফ্রড চেকার (BD Courier)</span>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="mt-2 border-0 shadow-none">
              <CardContent className="space-y-4 pt-4">
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label>BD Courier API Key</Label>
                    <Input type="password" value={apiKeys.bd_courier_api_key} onChange={e => setApiKeys(p => ({ ...p, bd_courier_api_key: e.target.value }))} placeholder="••••••••" />
                  </div>
                  <Button size="sm" onClick={async () => { try { await updateSetting.mutateAsync({ key: 'bd_courier_api_key', value: apiKeys.bd_courier_api_key }); toast.success('BD Courier API Key সেভ হয়েছে'); } catch { toast.error('সেভ করতে সমস্যা হয়েছে'); } }}><Save className="h-4 w-4" /></Button>
                </div>
                <p className="text-xs text-muted-foreground">bdcourier.com থেকে API Key সংগ্রহ করুন</p>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>

        {/* 🚚 Steadfast Courier */}
        <Collapsible>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between border rounded-xl px-4 py-3 hover:bg-accent/50 transition cursor-pointer">
              <div className="flex items-center gap-3">
                <span className="text-xl">🚚</span>
                <span className="font-medium">Steadfast Courier</span>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="mt-2 border-0 shadow-none">
              <CardContent className="space-y-4 pt-4">
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label>API Key</Label>
                    <Input type="password" value={apiKeys.steadfast_api_key} onChange={e => setApiKeys(p => ({ ...p, steadfast_api_key: e.target.value }))} placeholder="••••••••" />
                  </div>
                  <Button size="sm" onClick={async () => { try { await updateSetting.mutateAsync({ key: 'steadfast_api_key', value: apiKeys.steadfast_api_key }); toast.success('Steadfast API Key সেভ হয়েছে'); } catch { toast.error('সেভ করতে সমস্যা হয়েছে'); } }}><Save className="h-4 w-4" /></Button>
                </div>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label>Secret Key</Label>
                    <Input type="password" value={apiKeys.steadfast_secret_key} onChange={e => setApiKeys(p => ({ ...p, steadfast_secret_key: e.target.value }))} placeholder="••••••••" />
                  </div>
                  <Button size="sm" onClick={async () => { try { await updateSetting.mutateAsync({ key: 'steadfast_secret_key', value: apiKeys.steadfast_secret_key }); toast.success('Steadfast Secret Key সেভ হয়েছে'); } catch { toast.error('সেভ করতে সমস্যা হয়েছে'); } }}><Save className="h-4 w-4" /></Button>
                </div>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label>Merchant ID</Label>
                    <Input type="text" value={apiKeys.steadfast_merchant_id} onChange={e => setApiKeys(p => ({ ...p, steadfast_merchant_id: e.target.value }))} placeholder="যেমন: 51719" />
                  </div>
                  <Button size="sm" onClick={async () => { try { await updateSetting.mutateAsync({ key: 'steadfast_merchant_id', value: apiKeys.steadfast_merchant_id }); toast.success('Steadfast Merchant ID সেভ হয়েছে'); } catch { toast.error('সেভ করতে সমস্যা হয়েছে'); } }}><Save className="h-4 w-4" /></Button>
                </div>
                <p className="text-xs text-muted-foreground">প্রিন্ট মেমোতে দেখানো হবে — portal.steadfast.com.bd → Profile থেকে সংগ্রহ করুন</p>
                <div className="space-y-1.5 pt-2 border-t">
                  <Label>ডিফল্ট কুরিয়ার নোট (নরমাল অর্ডার)</Label>
                  <div className="flex gap-2 items-start">
                    <Textarea
                      value={apiKeys.courier_default_note}
                      onChange={e => setApiKeys(p => ({ ...p, courier_default_note: e.target.value }))}
                      placeholder="যেমনঃ ফোন রিসিভ না হলে অলটারনেটিভ নম্বরে ট্রাই করুন"
                      rows={2}
                      className="flex-1 text-sm"
                    />
                    <Button size="sm" onClick={async () => { try { await updateSetting.mutateAsync({ key: 'courier_default_note', value: apiKeys.courier_default_note }); toast.success('ডিফল্ট নোট সেভ হয়েছে'); } catch { toast.error('সেভ করতে সমস্যা হয়েছে'); } }}><Save className="h-4 w-4" /></Button>
                  </div>
                  <p className="text-xs text-muted-foreground">নরমাল অর্ডারে অটো-প্রিফিল হবে।</p>
                </div>
                <div className="space-y-1.5">
                  <Label>ডিফল্ট কুরিয়ার নোট (এক্সচেঞ্জ অর্ডার)</Label>
                  <div className="flex gap-2 items-start">
                    <Textarea
                      value={apiKeys.courier_exchange_default_note}
                      onChange={e => setApiKeys(p => ({ ...p, courier_exchange_default_note: e.target.value }))}
                      placeholder="যেমনঃ এটি এক্সচেঞ্জ পার্সেল — পুরাতন প্রোডাক্ট ফেরত নিতে হবে"
                      rows={2}
                      className="flex-1 text-sm"
                    />
                    <Button size="sm" onClick={async () => { try { await updateSetting.mutateAsync({ key: 'courier_exchange_default_note', value: apiKeys.courier_exchange_default_note }); toast.success('এক্সচেঞ্জ নোট সেভ হয়েছে'); } catch { toast.error('সেভ করতে সমস্যা হয়েছে'); } }}><Save className="h-4 w-4" /></Button>
                  </div>
                  <p className="text-xs text-muted-foreground">এক্সচেঞ্জ অর্ডারে অটো-প্রিফিল হবে এবং Steadfast এ অটো এক্সচেঞ্জ মার্ক হবে।</p>
                </div>
                <p className="text-xs text-muted-foreground">portal.steadfast.com.bd থেকে API credentials সংগ্রহ করুন</p>
                {apiKeys.courier_webhook_secret ? (
                  <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3 space-y-2">
                    <p className="text-xs font-medium text-foreground">🔗 Webhook URL:</p>
                    <code className="block text-xs bg-muted p-2 rounded break-all select-all">{SUPABASE_URL}/functions/v1/steadfast-webhook?secret={apiKeys.courier_webhook_secret}</code>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { navigator.clipboard.writeText(`${SUPABASE_URL}/functions/v1/steadfast-webhook?secret=${apiKeys.courier_webhook_secret}`); toast.success('কপি হয়েছে!'); }}><Copy className="h-3 w-3 mr-1" /> কপি</Button>
                      <span className="text-xs text-muted-foreground">→ Steadfast Portal → Settings → Webhook URL-এ পেস্ট করুন</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-destructive">⚠️ আগে নিচে Webhook Secret সেট করুন</p>
                )}
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>

        {/* 🏍️ Pathao Courier */}
        <Collapsible>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between border rounded-xl px-4 py-3 hover:bg-accent/50 transition cursor-pointer">
              <div className="flex items-center gap-3">
                <span className="text-xl">🏍️</span>
                <span className="font-medium">Pathao Courier</span>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="mt-2 border-0 shadow-none">
              <CardContent className="space-y-4 pt-4">
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label>API Key / Client ID</Label>
                    <Input type="password" value={apiKeys.pathao_api_key} onChange={e => setApiKeys(p => ({ ...p, pathao_api_key: e.target.value }))} placeholder="••••••••" />
                  </div>
                  <Button size="sm" onClick={async () => { try { await updateSetting.mutateAsync({ key: 'pathao_api_key', value: apiKeys.pathao_api_key }); toast.success('Pathao API Key সেভ হয়েছে'); } catch { toast.error('সেভ করতে সমস্যা হয়েছে'); } }}><Save className="h-4 w-4" /></Button>
                </div>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label>Secret Key</Label>
                    <Input type="password" value={apiKeys.pathao_secret_key} onChange={e => setApiKeys(p => ({ ...p, pathao_secret_key: e.target.value }))} placeholder="••••••••" />
                  </div>
                  <Button size="sm" onClick={async () => { try { await updateSetting.mutateAsync({ key: 'pathao_secret_key', value: apiKeys.pathao_secret_key }); toast.success('Pathao Secret Key সেভ হয়েছে'); } catch { toast.error('সেভ করতে সমস্যা হয়েছে'); } }}><Save className="h-4 w-4" /></Button>
                </div>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label>Merchant ID</Label>
                    <Input type="password" value={apiKeys.pathao_merchant_id} onChange={e => setApiKeys(p => ({ ...p, pathao_merchant_id: e.target.value }))} placeholder="••••••••" />
                  </div>
                  <Button size="sm" onClick={async () => { try { await updateSetting.mutateAsync({ key: 'pathao_merchant_id', value: apiKeys.pathao_merchant_id }); toast.success('Pathao Merchant ID সেভ হয়েছে'); } catch { toast.error('সেভ করতে সমস্যা হয়েছে'); } }}><Save className="h-4 w-4" /></Button>
                </div>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label>Username (Email)</Label>
                    <Input type="text" value={apiKeys.pathao_username} onChange={e => setApiKeys(p => ({ ...p, pathao_username: e.target.value }))} placeholder="your@email.com" />
                  </div>
                  <Button size="sm" onClick={async () => { try { await updateSetting.mutateAsync({ key: 'pathao_username', value: apiKeys.pathao_username }); toast.success('Pathao Username সেভ হয়েছে'); } catch { toast.error('সেভ করতে সমস্যা হয়েছে'); } }}><Save className="h-4 w-4" /></Button>
                </div>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label>Password</Label>
                    <Input type="password" value={apiKeys.pathao_password} onChange={e => setApiKeys(p => ({ ...p, pathao_password: e.target.value }))} placeholder="••••••••" />
                  </div>
                  <Button size="sm" onClick={async () => { try { await updateSetting.mutateAsync({ key: 'pathao_password', value: apiKeys.pathao_password }); toast.success('Pathao Password সেভ হয়েছে'); } catch { toast.error('সেভ করতে সমস্যা হয়েছে'); } }}><Save className="h-4 w-4" /></Button>
                </div>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label>Store ID</Label>
                    <Input type="text" value={apiKeys.pathao_store_id} onChange={e => setApiKeys(p => ({ ...p, pathao_store_id: e.target.value }))} placeholder="12345" />
                  </div>
                  <Button size="sm" onClick={async () => { try { await updateSetting.mutateAsync({ key: 'pathao_store_id', value: apiKeys.pathao_store_id }); toast.success('Pathao Store ID সেভ হয়েছে'); } catch { toast.error('সেভ করতে সমস্যা হয়েছে'); } }}><Save className="h-4 w-4" /></Button>
                </div>
                <div className="space-y-1.5 pt-2 border-t">
                  <Label>ডিফল্ট কুরিয়ার নোট (নরমাল অর্ডার)</Label>
                  <div className="flex gap-2 items-start">
                    <Textarea
                      value={apiKeys.courier_default_note}
                      onChange={e => setApiKeys(p => ({ ...p, courier_default_note: e.target.value }))}
                      placeholder="যেমনঃ ফোন রিসিভ না হলে অলটারনেটিভ নম্বরে ট্রাই করুন"
                      rows={2}
                      className="flex-1 text-sm"
                    />
                    <Button size="sm" onClick={async () => { try { await updateSetting.mutateAsync({ key: 'courier_default_note', value: apiKeys.courier_default_note }); toast.success('ডিফল্ট নোট সেভ হয়েছে'); } catch { toast.error('সেভ করতে সমস্যা হয়েছে'); } }}><Save className="h-4 w-4" /></Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>ডিফল্ট কুরিয়ার নোট (এক্সচেঞ্জ অর্ডার)</Label>
                  <div className="flex gap-2 items-start">
                    <Textarea
                      value={apiKeys.courier_exchange_default_note}
                      onChange={e => setApiKeys(p => ({ ...p, courier_exchange_default_note: e.target.value }))}
                      placeholder="যেমনঃ এটি এক্সচেঞ্জ পার্সেল — পুরাতন প্রোডাক্ট ফেরত নিতে হবে"
                      rows={2}
                      className="flex-1 text-sm"
                    />
                    <Button size="sm" onClick={async () => { try { await updateSetting.mutateAsync({ key: 'courier_exchange_default_note', value: apiKeys.courier_exchange_default_note }); toast.success('এক্সচেঞ্জ নোট সেভ হয়েছে'); } catch { toast.error('সেভ করতে সমস্যা হয়েছে'); } }}><Save className="h-4 w-4" /></Button>
                  </div>
                  <p className="text-xs text-muted-foreground">ℹ️ এই নোট সব courier (Steadfast / Pathao / RedX) এ shared — এক জায়গায় edit করলে সব জায়গায় sync হবে।</p>
                </div>
                <p className="text-xs text-muted-foreground">merchant.pathao.com থেকে API credentials সংগ্রহ করুন। Store ID পেতে Pathao Merchant Dashboard → Stores দেখুন।</p>
                {apiKeys.courier_webhook_secret ? (
                  <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3 space-y-2">
                    <p className="text-xs font-medium text-foreground">🔗 Webhook URL:</p>
                    <code className="block text-xs bg-muted p-2 rounded break-all select-all">{SUPABASE_URL}/functions/v1/pathao-webhook?secret={apiKeys.courier_webhook_secret}</code>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { navigator.clipboard.writeText(`${SUPABASE_URL}/functions/v1/pathao-webhook?secret=${apiKeys.courier_webhook_secret}`); toast.success('কপি হয়েছে!'); }}><Copy className="h-3 w-3 mr-1" /> কপি</Button>
                      <span className="text-xs text-muted-foreground">→ Pathao Merchant Dashboard → Webhook Settings-এ পেস্ট করুন</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-destructive">⚠️ আগে নিচে Webhook Secret সেট করুন</p>
                )}
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>

        {/* 🔴 RedX Courier */}
        <Collapsible>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between border rounded-xl px-4 py-3 hover:bg-accent/50 transition cursor-pointer">
              <div className="flex items-center gap-3">
                <span className="text-xl">🔴</span>
                <span className="font-medium">RedX Courier</span>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="mt-2 border-0 shadow-none">
              <CardContent className="space-y-4 pt-4">
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label>API Access Token</Label>
                    <Input type="password" value={apiKeys.redx_api_key} onChange={e => setApiKeys(p => ({ ...p, redx_api_key: e.target.value }))} placeholder="••••••••" />
                  </div>
                  <Button size="sm" onClick={async () => { try { await updateSetting.mutateAsync({ key: 'redx_api_key', value: apiKeys.redx_api_key }); toast.success('RedX API Key সেভ হয়েছে'); } catch { toast.error('সেভ করতে সমস্যা হয়েছে'); } }}><Save className="h-4 w-4" /></Button>
                </div>
                <p className="text-xs text-muted-foreground">redx.com.bd থেকে API Access Token সংগ্রহ করুন</p>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label>Pickup Store ID</Label>
                    <Input value={apiKeys.redx_pickup_store_id || ''} onChange={e => setApiKeys(p => ({ ...p, redx_pickup_store_id: e.target.value }))} placeholder="যেমন: 12345" />
                  </div>
                  <Button size="sm" onClick={async () => { try { await updateSetting.mutateAsync({ key: 'redx_pickup_store_id', value: apiKeys.redx_pickup_store_id || '' }); toast.success('Pickup Store ID সেভ হয়েছে'); } catch { toast.error('সেভ করতে সমস্যা হয়েছে'); } }}><Save className="h-4 w-4" /></Button>
                </div>
                <p className="text-xs text-muted-foreground">RedX ড্যাশবোর্ড থেকে Pickup Store ID দিন (ঐচ্ছিক)</p>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label>Merchant ID</Label>
                    <Input type="text" value={apiKeys.redx_merchant_id || ''} onChange={e => setApiKeys(p => ({ ...p, redx_merchant_id: e.target.value }))} placeholder="যেমন: 811919" />
                  </div>
                  <Button size="sm" onClick={async () => { try { await updateSetting.mutateAsync({ key: 'redx_merchant_id', value: apiKeys.redx_merchant_id || '' }); toast.success('RedX Merchant ID সেভ হয়েছে'); } catch { toast.error('সেভ করতে সমস্যা হয়েছে'); } }}><Save className="h-4 w-4" /></Button>
                </div>
                <p className="text-xs text-muted-foreground">প্রিন্ট মেমোতে দেখানো হবে — RedX ড্যাশবোর্ড → Profile থেকে সংগ্রহ করুন</p>
                <div className="space-y-1.5 pt-2 border-t">
                  <Label>ডিফল্ট কুরিয়ার নোট (নরমাল অর্ডার)</Label>
                  <div className="flex gap-2 items-start">
                    <Textarea
                      value={apiKeys.courier_default_note}
                      onChange={e => setApiKeys(p => ({ ...p, courier_default_note: e.target.value }))}
                      placeholder="যেমনঃ ফোন রিসিভ না হলে অলটারনেটিভ নম্বরে ট্রাই করুন"
                      rows={2}
                      className="flex-1 text-sm"
                    />
                    <Button size="sm" onClick={async () => { try { await updateSetting.mutateAsync({ key: 'courier_default_note', value: apiKeys.courier_default_note }); toast.success('ডিফল্ট নোট সেভ হয়েছে'); } catch { toast.error('সেভ করতে সমস্যা হয়েছে'); } }}><Save className="h-4 w-4" /></Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>ডিফল্ট কুরিয়ার নোট (এক্সচেঞ্জ অর্ডার)</Label>
                  <div className="flex gap-2 items-start">
                    <Textarea
                      value={apiKeys.courier_exchange_default_note}
                      onChange={e => setApiKeys(p => ({ ...p, courier_exchange_default_note: e.target.value }))}
                      placeholder="যেমনঃ এটি এক্সচেঞ্জ পার্সেল — পুরাতন প্রোডাক্ট ফেরত নিতে হবে"
                      rows={2}
                      className="flex-1 text-sm"
                    />
                    <Button size="sm" onClick={async () => { try { await updateSetting.mutateAsync({ key: 'courier_exchange_default_note', value: apiKeys.courier_exchange_default_note }); toast.success('এক্সচেঞ্জ নোট সেভ হয়েছে'); } catch { toast.error('সেভ করতে সমস্যা হয়েছে'); } }}><Save className="h-4 w-4" /></Button>
                  </div>
                  <p className="text-xs text-muted-foreground">ℹ️ এই নোট সব courier (Steadfast / Pathao / RedX) এ shared — এক জায়গায় edit করলে সব জায়গায় sync হবে।</p>
                </div>
                {apiKeys.courier_webhook_secret ? (
                  <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3 space-y-2">
                    <p className="text-xs font-medium text-foreground">🔗 Webhook URL:</p>
                    <code className="block text-xs bg-muted p-2 rounded break-all select-all">{SUPABASE_URL}/functions/v1/redx-webhook?secret={apiKeys.courier_webhook_secret}</code>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { navigator.clipboard.writeText(`${SUPABASE_URL}/functions/v1/redx-webhook?secret=${apiKeys.courier_webhook_secret}`); toast.success('কপি হয়েছে!'); }}><Copy className="h-3 w-3 mr-1" /> কপি</Button>
                      <span className="text-xs text-muted-foreground">→ RedX Dashboard → Webhook URL-এ পেস্ট করুন</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-destructive">⚠️ আগে নিচে Webhook Secret সেট করুন</p>
                )}
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>

        {/* 🔐 Courier Webhook Secret */}
        <Collapsible>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between border rounded-xl px-4 py-3 hover:bg-accent/50 transition cursor-pointer">
              <div className="flex items-center gap-3">
                <span className="text-xl">🔐</span>
                <span className="font-medium">Courier Webhook Secret</span>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="mt-2 border-0 shadow-none">
              <CardContent className="space-y-4 pt-4">
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label>Webhook Secret</Label>
                    <Input type="password" value={apiKeys.courier_webhook_secret} onChange={e => setApiKeys(p => ({ ...p, courier_webhook_secret: e.target.value }))} placeholder="••••••••" />
                  </div>
                  <Button size="sm" onClick={async () => { try { await updateSetting.mutateAsync({ key: 'courier_webhook_secret', value: apiKeys.courier_webhook_secret }); toast.success('Webhook Secret সেভ হয়েছে'); } catch { toast.error('সেভ করতে সমস্যা হয়েছে'); } }}><Save className="h-4 w-4" /></Button>
                </div>
                <p className="text-xs text-muted-foreground">এই সিক্রেটটি উপরের তিনটি কুরিয়ারের Webhook URL-এ ব্যবহৃত হয়। Supabase Edge Function secrets-এও একই ভ্যালু সেট করা আছে।</p>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>

        {/* 💳 UddoktaPay Payment */}
        <Collapsible>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between border rounded-xl px-4 py-3 hover:bg-accent/50 transition cursor-pointer">
              <div className="flex items-center gap-3">
                <span className="text-xl">💳</span>
                <span className="font-medium">UddoktaPay পেমেন্ট</span>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="mt-2 border-0 shadow-none">
              <CardContent className="space-y-4 pt-4">
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label>API Key</Label>
                    <Input type="password" value={apiKeys.uddoktapay_api_key} onChange={e => setApiKeys(p => ({ ...p, uddoktapay_api_key: e.target.value }))} placeholder="••••••••" />
                  </div>
                  <Button size="sm" onClick={async () => { try { await updateSetting.mutateAsync({ key: 'uddoktapay_api_key', value: apiKeys.uddoktapay_api_key }); toast.success('UddoktaPay API Key সেভ হয়েছে'); } catch { toast.error('সেভ করতে সমস্যা হয়েছে'); } }}><Save className="h-4 w-4" /></Button>
                </div>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label>Base URL</Label>
                    <Input value={apiKeys.uddoktapay_base_url} onChange={e => setApiKeys(p => ({ ...p, uddoktapay_base_url: e.target.value }))} placeholder="https://pay.your-domain.com" />
                  </div>
                  <Button size="sm" onClick={async () => { try { await updateSetting.mutateAsync({ key: 'uddoktapay_base_url', value: apiKeys.uddoktapay_base_url }); toast.success('UddoktaPay Base URL সেভ হয়েছে'); } catch { toast.error('সেভ করতে সমস্যা হয়েছে'); } }}><Save className="h-4 w-4" /></Button>
                </div>
                <p className="text-xs text-muted-foreground">UddoktaPay ড্যাশবোর্ড থেকে API Key সংগ্রহ করুন। Sandbox: https://sandbox.uddoktapay.com</p>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>

        {/* 📱 SMS (MimSMS) Settings */}
        <Collapsible>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between border rounded-xl px-4 py-3 hover:bg-accent/50 transition cursor-pointer">
              <div className="flex items-center gap-3">
                <span className="text-xl">📱</span>
                <span className="font-medium">SMS সেটিংস (MimSMS)</span>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="mt-2 border-0 shadow-none">
              <CardContent className="space-y-4 pt-4">
                <p className="text-xs text-muted-foreground">Smart Inbox থেকে SMS পাঠাতে MimSMS credentials দিন। এখানে দিলে env variable-র চেয়ে priority পাবে।</p>
                {([
                  { key: 'mimsms_username', label: 'MimSMS Username', password: false },
                  { key: 'mimsms_api_key', label: 'MimSMS API Key', password: true },
                  { key: 'mimsms_sender_id', label: 'Sender ID', password: false },
                ] as { key: keyof typeof smsKeys; label: string; password: boolean }[]).map(({ key, label, password }) => (
                  <div key={key} className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Label>{label}</Label>
                      <Input
                        type={password ? 'password' : 'text'}
                        value={smsKeys[key]}
                        onChange={e => setSmsKeys(p => ({ ...p, [key]: e.target.value }))}
                        placeholder={password ? '••••••••' : label}
                      />
                    </div>
                    <Button size="sm" onClick={async () => {
                      try {
                        await updateSetting.mutateAsync({ key, value: smsKeys[key] });
                        toast.success(`${label} সেভ হয়েছে`);
                      } catch { toast.error('সেভ করতে সমস্যা হয়েছে'); }
                    }}><Save className="h-4 w-4" /></Button>
                  </div>
                ))}
                <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                  api.mimsms.com থেকে credentials সংগ্রহ করুন। Sender ID আপনার approved sender name।
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>

        {/* 📨 Multi-Provider SMS Gateway (MimSMS + Automas) */}
        <SmsProvidersSection />





        {/* ====== Messenger + Instagram ====== */}
        <Collapsible>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between border rounded-xl px-4 py-3 hover:bg-accent/50 transition cursor-pointer">
              <div className="flex items-center gap-3">
                <span className="text-xl">📘</span>
                <span className="font-medium">Messenger + Instagram Webhook</span>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="mt-2 border-0 shadow-none">
              <CardContent className="space-y-5 pt-4">
                {/* Step-by-step setup guide */}
                <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 space-y-2">
                  <p className="font-semibold text-sm">📋 সেটআপ গাইড (Messenger + Instagram)</p>
                  <ol className="text-xs space-y-1.5 list-decimal list-inside text-muted-foreground">
                    <li><strong>Meta App তৈরি:</strong> <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener" className="text-primary underline">developers.facebook.com</a> → Create App → Business type</li>
                    <li><strong>Products যোগ:</strong> App Dashboard → Add Products → <strong>Messenger</strong> ও <strong>Webhooks</strong> যোগ করুন</li>
                    <li><strong>Webhook কনফিগার:</strong> Webhooks product → Edit Subscription → <code className="bg-muted px-1 rounded">Page</code> object সিলেক্ট করুন</li>
                    <li><strong>Callback URL:</strong> <code className="bg-muted px-1 rounded text-[10px] break-all">https://xxucasikopqtcztbgfbw.supabase.co/functions/v1/meta-webhook</code></li>
                    <li><strong>Verify Token:</strong> নিচে যে token দিয়েছেন সেটাই Meta-তে পেস্ট করুন</li>
                    <li><strong>Page Token:</strong> Graph API Explorer → Page → Generate Access Token → নিচে সেভ করুন</li>
                    <li><strong>Page Subscribe:</strong> Smart Inbox → ⚙️ → "Page Subscribe" বাটন চাপুন</li>
                    <li><strong>Instagram:</strong> Facebook Page Settings → Linked Accounts → Instagram Business Account connect করুন</li>
                  </ol>
                </div>

                <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-xs text-destructive space-y-1.5">
                  <p className="font-bold">🚨 Verify ব্যর্থ হচ্ছে? এই ৩টা চেক করুন:</p>
                  <ol className="list-decimal list-inside space-y-0.5">
                    <li><strong>App Live/Published:</strong> Meta Developer App → App Review → আপনার app কি <strong>Live</strong> মোডে আছে? Development মোডে থাকলে Messenger/Instagram webhook verify হবে না।</li>
                    <li><strong>সঠিক Object:</strong> Webhooks product → Edit Subscription → অবশ্যই <strong>"Page"</strong> object সিলেক্ট করুন (User বা Application না)।</li>
                    <li><strong>WhatsApp verify = Messenger verify না:</strong> WhatsApp আলাদা product। WhatsApp verify হওয়া মানে Messenger/Instagram ready না।</li>
                  </ol>
                </div>

                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-700 dark:text-amber-400">
                  ⚠️ <strong>গুরুত্বপূর্ণ:</strong> WhatsApp আলাদা সেকশনে কনফিগার করুন। এখানে শুধু Messenger + Instagram-এর credentials দিন।
                  Instagram মেসেজ পেতে আপনার Facebook Page-এর সাথে Instagram Business Account linked থাকতে হবে।
                </div>

                {/* 🔐 App Settings */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 border-b pb-2">
                    <span className="text-lg">🔐</span>
                    <div>
                      <p className="font-semibold text-sm">অ্যাপ সেটিংস</p>
                      <p className="text-xs text-muted-foreground">Meta Developer App → Settings → Basic থেকে পাবেন</p>
                    </div>
                  </div>
                  {([
                    { key: 'meta_app_id', label: 'Meta App ID', hint: 'developers.facebook.com → App Dashboard → App ID', password: false },
                    { key: 'meta_app_secret', label: 'App Secret', hint: 'App Dashboard → Settings → Basic → App Secret', password: true },
                    { key: 'meta_verify_token', label: 'Verify Token', hint: 'Webhook সেটআপে ব্যবহার করবেন এই token — Meta Console-এও একই token দিন', password: false },
                  ] as { key: keyof typeof metaInbox; label: string; hint: string; password: boolean }[]).map(({ key, label, hint, password }) => (
                    <div key={key} className="flex gap-2 items-end">
                      <div className="flex-1">
                        <Label>{label}</Label>
                        <Input type={password ? 'password' : 'text'} value={metaInbox[key]} onChange={e => setMetaInbox(p => ({ ...p, [key]: e.target.value }))} placeholder={password ? '••••••••' : label} />
                        <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
                      </div>
                      <Button size="sm" onClick={async () => { try { await updateSetting.mutateAsync({ key, value: metaInbox[key] }); toast.success(`${label} সেভ হয়েছে`); } catch { toast.error('সেভ করতে সমস্যা হয়েছে'); } }}><Save className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>

                {/* 📘 Facebook Page */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 border-b pb-2">
                    <span className="text-lg">📘</span>
                    <div>
                      <p className="font-semibold text-sm">Facebook Page</p>
                      <p className="text-xs text-muted-foreground">Graph API Explorer → Page Token generate করুন</p>
                    </div>
                  </div>
                  {([
                    { key: 'meta_page_access_token', label: 'Page Access Token', hint: 'Graph API Explorer → Page Token generate করুন (never-expiring preferred)', password: true },
                    { key: 'meta_page_id', label: 'Page ID', hint: 'Facebook Page → About → Page ID (নম্বর)', password: false },
                  ] as { key: keyof typeof metaInbox; label: string; hint: string; password: boolean }[]).map(({ key, label, hint, password }) => (
                    <div key={key} className="flex gap-2 items-end">
                      <div className="flex-1">
                        <Label>{label}</Label>
                        <Input type={password ? 'password' : 'text'} value={metaInbox[key]} onChange={e => setMetaInbox(p => ({ ...p, [key]: e.target.value }))} placeholder={password ? '••••••••' : label} />
                        <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
                      </div>
                      <Button size="sm" onClick={async () => { try { await updateSetting.mutateAsync({ key, value: metaInbox[key] }); toast.success(`${label} সেভ হয়েছে`); } catch { toast.error('সেভ করতে সমস্যা হয়েছে'); } }}><Save className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>

                {/* 📸 Instagram */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 border-b pb-2">
                    <span className="text-lg">📸</span>
                    <div>
                      <p className="font-semibold text-sm">Instagram (ঐচ্ছিক)</p>
                      <p className="text-xs text-muted-foreground">Facebook Page-এর সাথে linked Instagram Business Account হলে আলাদা token না দিলেও চলবে</p>
                    </div>
                  </div>
                  {([
                    { key: 'instagram_app_id', label: 'Instagram App ID', hint: 'Meta Developer App-এর App ID', password: false },
                    { key: 'instagram_app_secret', label: 'Instagram App Secret', hint: 'Meta Developer App-এর App Secret', password: true },
                    { key: 'instagram_access_token', label: 'Instagram Access Token', hint: 'আলাদা token থাকলে দিন, না থাকলে Page Access Token দিয়েই Instagram কাজ করবে', password: true },
                  ] as { key: keyof typeof metaInbox; label: string; hint: string; password: boolean }[]).map(({ key, label, hint, password }) => (
                    <div key={key} className="flex gap-2 items-end">
                      <div className="flex-1">
                        <Label>{label}</Label>
                        <Input type={password ? 'password' : 'text'} value={metaInbox[key]} onChange={e => setMetaInbox(p => ({ ...p, [key]: e.target.value }))} placeholder={password ? '••••••••' : label} />
                        <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
                      </div>
                      <Button size="sm" onClick={async () => { try { await updateSetting.mutateAsync({ key, value: metaInbox[key] }); toast.success(`${label} সেভ হয়েছে`); } catch { toast.error('সেভ করতে সমস্যা হয়েছে'); } }}><Save className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 text-xs text-blue-700 dark:text-blue-400 space-y-1">
                  <p><strong>🔗 Webhook Callback URL:</strong></p>
                  <code className="block bg-muted p-1.5 rounded text-[10px] break-all">https://xxucasikopqtcztbgfbw.supabase.co/functions/v1/meta-webhook</code>
                  <p className="mt-1">Meta Developer App → Webhooks → Edit Subscription → <strong>"Page"</strong> object → Callback URL-এ উপরের URL পেস্ট করুন।</p>
                  <p>Verify Token ফিল্ডে উপরে যে token সেভ করেছেন সেটা দিন → "Verify and save" চাপুন।</p>
                  <p className="mt-1">✅ সেভ করার পর <strong>Smart Inbox → ⚙️ → "চেক করুন"</strong> বাটন চেপে confirm করুন।</p>
                </div>

                {/* Troubleshooting */}
                <div className="rounded-lg border border-border p-4 space-y-2">
                  <p className="font-semibold text-sm">🔧 Troubleshooting — Verify ব্যর্থ হলে</p>
                  <div className="text-xs space-y-2 text-muted-foreground">
                    <div className="flex gap-2">
                      <span className="text-primary font-bold shrink-0">Q:</span>
                      <div><strong>Direct URL কাজ করে কিন্তু Meta verify করতে পারে না?</strong>
                        <p>→ আপনার Meta App <strong>Development মোডে</strong> থাকতে পারে। App Review → Make Public করুন।</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-primary font-bold shrink-0">Q:</span>
                      <div><strong>WhatsApp verify হয়েছে কিন্তু Messenger/Instagram হচ্ছে না?</strong>
                        <p>→ WhatsApp আলাদা product। Messenger-এর জন্য Webhooks product → <strong>"Page" object</strong>-এ verify করতে হবে।</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-primary font-bold shrink-0">Q:</span>
                      <div><strong>Instagram মেসেজ আসছে না?</strong>
                        <p>→ Facebook Page Settings → <strong>Linked Accounts → Instagram</strong> — Business account linked আছে কি?</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-primary font-bold shrink-0">Q:</span>
                      <div><strong>"The callback URL or verify token could not be validated"?</strong>
                        <p>→ ১) App Live মোডে আছে কি? ২) Token হুবহু মিলছে কি? ৩) URL-এ trailing slash নেই তো?</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>

        {/* ====== WhatsApp Business ====== */}
        <Collapsible>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between border rounded-xl px-4 py-3 hover:bg-accent/50 transition cursor-pointer">
              <div className="flex items-center gap-3">
                <span className="text-xl">💬</span>
                <span className="font-medium">WhatsApp Business Webhook</span>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="mt-2 border-0 shadow-none">
              <CardContent className="space-y-5 pt-4">
                <p className="text-xs text-muted-foreground">WhatsApp Business API-র মাধ্যমে মেসেজ পাঠানো ও গ্রহণ করতে নিচের তথ্যগুলো দিন।</p>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 border-b pb-2">
                    <span className="text-lg">💬</span>
                    <div>
                      <p className="font-semibold text-sm">WhatsApp Business API</p>
                      <p className="text-xs text-muted-foreground">Meta Developer App → WhatsApp → API Setup থেকে পাবেন</p>
                    </div>
                  </div>
                  {([
                    { key: 'whatsapp_access_token', label: 'WhatsApp Access Token', hint: 'WhatsApp → API Setup → Permanent Token', password: true },
                    { key: 'whatsapp_phone_number_id', label: 'Phone Number ID', hint: 'WhatsApp → API Setup → Phone number ID', password: false },
                    { key: 'whatsapp_business_account_id', label: 'WABA ID', hint: 'WhatsApp → API Setup → WhatsApp Business Account ID', password: false },
                  ] as { key: keyof typeof metaInbox; label: string; hint: string; password: boolean }[]).map(({ key, label, hint, password }) => (
                    <div key={key} className="flex gap-2 items-end">
                      <div className="flex-1">
                        <Label>{label}</Label>
                        <Input type={password ? 'password' : 'text'} value={metaInbox[key]} onChange={e => setMetaInbox(p => ({ ...p, [key]: e.target.value }))} placeholder={password ? '••••••••' : label} />
                        <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
                      </div>
                      <Button size="sm" onClick={async () => { try { await updateSetting.mutateAsync({ key, value: metaInbox[key] }); toast.success(`${label} সেভ হয়েছে`); } catch { toast.error('সেভ করতে সমস্যা হয়েছে'); } }}><Save className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 text-xs text-blue-700 dark:text-blue-400 space-y-1">
                  <p><strong>🔗 WhatsApp Webhook URL:</strong></p>
                  <code className="block bg-muted p-1.5 rounded text-[10px] break-all">https://xxucasikopqtcztbgfbw.supabase.co/functions/v1/meta-webhook</code>
                  <p>WhatsApp → Configuration → Callback URL-এ উপরের URL দিন। Verify Token-ও একই ব্যবহার করুন।</p>
                  <p>✅ WhatsApp already verify হয়ে গেলে "WABA Subscribe" করুন Smart Inbox → ⚙️ থেকে।</p>
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>

        <Collapsible>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between border rounded-xl px-4 py-3 hover:bg-accent/50 transition cursor-pointer">
              <div className="flex items-center gap-3">
                <span className="text-xl">🌐</span>
                <span className="font-medium">সাইট ভেরিফিকেশন</span>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="mt-2 border-0 shadow-none">
              <CardContent className="space-y-4 pt-4">
                <p className="text-xs text-muted-foreground">Pinterest, Google, Facebook-এর ভেরিফিকেশন কোড পেস্ট করুন। সাইটের &lt;head&gt;-এ অটোমেটিক meta tag যোগ হবে।</p>
                
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label>Pinterest Verification</Label>
                    <Input value={verification.pinterest_verification} onChange={e => setVerification(p => ({ ...p, pinterest_verification: e.target.value }))} placeholder="content value অথবা পুরো meta tag পেস্ট করুন" />
                     <p className="text-xs text-muted-foreground mt-1">Pinterest → Settings → Claim → শুধু content value অথবা পুরো &lt;meta&gt; tag পেস্ট করুন, দুটোই কাজ করবে</p>
                  </div>
                  <Button size="sm" onClick={async () => { try { await updateSetting.mutateAsync({ key: 'pinterest_verification', value: verification.pinterest_verification }); toast.success('Pinterest verification সেভ হয়েছে'); } catch { toast.error('সেভ করতে সমস্যা হয়েছে'); } }}><Save className="h-4 w-4" /></Button>
                </div>

                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label>Google Search Console</Label>
                    <Input value={verification.google_verification} onChange={e => setVerification(p => ({ ...p, google_verification: e.target.value }))} placeholder="google-site-verification content value" />
                    <p className="text-xs text-muted-foreground mt-1">Google Search Console → HTML tag → content value</p>
                  </div>
                  <Button size="sm" onClick={async () => { try { await updateSetting.mutateAsync({ key: 'google_verification', value: verification.google_verification }); toast.success('Google verification সেভ হয়েছে'); } catch { toast.error('সেভ করতে সমস্যা হয়েছে'); } }}><Save className="h-4 w-4" /></Button>
                </div>

                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label>Facebook Domain Verification</Label>
                    <Input value={verification.facebook_domain_verification} onChange={e => setVerification(p => ({ ...p, facebook_domain_verification: e.target.value }))} placeholder="facebook-domain-verification content value" />
                    <p className="text-xs text-muted-foreground mt-1">Facebook Business Settings → Brand Safety → Domains</p>
                  </div>
                  <Button size="sm" onClick={async () => { try { await updateSetting.mutateAsync({ key: 'facebook_domain_verification', value: verification.facebook_domain_verification }); toast.success('Facebook verification সেভ হয়েছে'); } catch { toast.error('সেভ করতে সমস্যা হয়েছে'); } }}><Save className="h-4 w-4" /></Button>
                </div>

                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-700 dark:text-amber-400">
                  ⚠️ এই সাইটটি SPA (JavaScript-rendered)। Pinterest bot সাধারণত JS রেন্ডার করে, কিন্তু সমস্যা হলে index.html-এ ম্যানুয়ালি tag যোগ করতে হতে পারে।
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>

        <Collapsible>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between border rounded-xl px-4 py-3 hover:bg-accent/50 transition cursor-pointer">
              <div className="flex items-center gap-3">
                <span className="text-xl">📦</span>
                <span className="font-medium">Product Feeds</span>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="mt-2 border-0 shadow-none">
              <CardContent className="space-y-4 pt-4">
                <div>
                  <Label>Google Merchant Feed URL</Label>
                  <div className="flex gap-2">
                    <Input value={defaultGoogleFeed} readOnly className="text-xs" />
                    <Button size="sm" variant="outline" onClick={() => copyUrl(defaultGoogleFeed)}><Copy className="h-4 w-4" /></Button>
                  </div>
                </div>
                <div>
                  <Label>Facebook Catalog Feed URL</Label>
                  <div className="flex gap-2">
                    <Input value={defaultFacebookFeed} readOnly className="text-xs" />
                    <Button size="sm" variant="outline" onClick={() => copyUrl(defaultFacebookFeed)}><Copy className="h-4 w-4" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>

        {/* 🛡️ CAPTCHA */}
        <Collapsible>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between border rounded-xl px-4 py-3 hover:bg-accent/50 transition cursor-pointer">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <span className="font-medium">CAPTCHA সেটিংস</span>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="mt-2 border-0 shadow-none">
              <CardContent className="space-y-4 pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>CAPTCHA চালু/বন্ধ</Label>
                    <p className="text-xs text-muted-foreground">Admin Login এ Cloudflare Turnstile CAPTCHA যোগ করুন</p>
                  </div>
                  <Switch checked={captchaEnabled} onCheckedChange={setCaptchaEnabled} />
                </div>
                {captchaEnabled && (
                  <div>
                    <Label>Turnstile Site Key</Label>
                    <Input value={turnstileSiteKey} onChange={e => setTurnstileSiteKey(e.target.value)} placeholder="Site Key" className="mt-1.5" />
                  </div>
                )}
                <Button
                  onClick={async () => {
                    try {
                      await updateSetting.mutateAsync({ key: 'captcha_enabled', value: captchaEnabled ? 'true' : 'false' });
                      await updateSetting.mutateAsync({ key: 'turnstile_site_key', value: turnstileSiteKey });
                      toast.success('CAPTCHA সেটিংস সেভ হয়েছে');
                    } catch { toast.error('সেভ করতে সমস্যা হয়েছে'); }
                  }}
                  disabled={updateSetting.isPending}
                >
                  <Save className="h-4 w-4 mr-2" />
                  সেভ করুন
                </Button>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}

