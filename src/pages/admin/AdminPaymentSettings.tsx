import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useStoreSettings, useUpdateSetting } from '@/hooks/useStoreSettings';
import { useActivityLog } from '@/hooks/useActivityLog';
import { Save, ExternalLink } from 'lucide-react';

export default function AdminPaymentSettings() {
  const { data: settings = {}, isLoading } = useStoreSettings();
  const updateSetting = useUpdateSetting();
  const { logActivity } = useActivityLog();

  const [uddoktapayEnabled, setUddoktapayEnabled] = useState(true);
  const [bkashEnabled, setBkashEnabled] = useState(false);
  const [paymentSmsEnabled, setPaymentSmsEnabled] = useState(false);

  const [bkashKeys, setBkashKeys] = useState({
    bkash_app_key: '',
    bkash_app_secret: '',
    bkash_username: '',
    bkash_password: '',
    bkash_environment: 'sandbox',
  });

  useEffect(() => {
    if (!isLoading) {
      setUddoktapayEnabled(settings.payment_uddoktapay_enabled !== 'false');
      setBkashEnabled(settings.payment_bkash_enabled === 'true');
      setPaymentSmsEnabled(settings.payment_sms_confirmation_enabled === 'true');
      setBkashKeys({
        bkash_app_key: settings.bkash_app_key || '',
        bkash_app_secret: settings.bkash_app_secret || '',
        bkash_username: settings.bkash_username || '',
        bkash_password: settings.bkash_password || '',
        bkash_environment: settings.bkash_environment || 'sandbox',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  const toggleSetting = async (key: string, value: boolean, setLocal: (v: boolean) => void, label: string) => {
    setLocal(value);
    try {
      await updateSetting.mutateAsync({ key, value: value ? 'true' : 'false' });
      logActivity('payment_settings_update', 'store_settings', null, `${label}: ${value ? 'চালু' : 'বন্ধ'}`, { key, value });
      toast.success(`${label} ${value ? 'চালু' : 'বন্ধ'} হয়েছে`);
    } catch {
      setLocal(!value);
      toast.error('আপডেট ব্যর্থ হয়েছে');
    }
  };

  const saveBkashCredentials = async () => {
    try {
      for (const [key, value] of Object.entries(bkashKeys)) {
        await updateSetting.mutateAsync({ key, value });
      }
      logActivity('payment_settings_update', 'store_settings', null, 'bKash ক্রেডেনশিয়াল আপডেট', {});
      toast.success('bKash সেটিংস সেভ হয়েছে');
    } catch {
      toast.error('সেভ করতে সমস্যা হয়েছে');
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">পেমেন্ট সেটিংস</h1>
        <p className="text-sm text-muted-foreground mt-1">
          চেকআউট পেজে কোন পেমেন্ট মেথড দেখানো হবে তা এখান থেকে নিয়ন্ত্রণ করুন। ক্যাশ অন ডেলিভারি সবসময় চালু থাকে।
        </p>
      </div>

      {/* UddoktaPay */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>💳 UddoktaPay</span>
            <Switch
              checked={uddoktapayEnabled}
              onCheckedChange={(v) => toggleSetting('payment_uddoktapay_enabled', v, setUddoktapayEnabled, 'UddoktaPay')}
            />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            API Key ও Base URL কনফিগার করতে{' '}
            <Link to="/admin/settings/integrations" className="text-primary underline inline-flex items-center gap-1">
              Integrations পেজ <ExternalLink className="h-3 w-3" />
            </Link>{' '}
            এ যান।
          </p>
        </CardContent>
      </Card>

      {/* bKash */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>🅱️ bKash</span>
            <Switch
              checked={bkashEnabled}
              onCheckedChange={(v) => toggleSetting('payment_bkash_enabled', v, setBkashEnabled, 'bKash')}
            />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>App Key</Label>
              <Input
                type="password"
                value={bkashKeys.bkash_app_key}
                onChange={(e) => setBkashKeys((p) => ({ ...p, bkash_app_key: e.target.value }))}
                placeholder="••••••••"
              />
            </div>
            <div>
              <Label>App Secret</Label>
              <Input
                type="password"
                value={bkashKeys.bkash_app_secret}
                onChange={(e) => setBkashKeys((p) => ({ ...p, bkash_app_secret: e.target.value }))}
                placeholder="••••••••"
              />
            </div>
            <div>
              <Label>Username</Label>
              <Input
                value={bkashKeys.bkash_username}
                onChange={(e) => setBkashKeys((p) => ({ ...p, bkash_username: e.target.value }))}
              />
            </div>
            <div>
              <Label>Password</Label>
              <Input
                type="password"
                value={bkashKeys.bkash_password}
                onChange={(e) => setBkashKeys((p) => ({ ...p, bkash_password: e.target.value }))}
                placeholder="••••••••"
              />
            </div>
            <div>
              <Label>Environment</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={bkashKeys.bkash_environment}
                onChange={(e) => setBkashKeys((p) => ({ ...p, bkash_environment: e.target.value }))}
              >
                <option value="sandbox">Sandbox</option>
                <option value="live">Live</option>
              </select>
            </div>
          </div>
          <Button size="sm" onClick={saveBkashCredentials}>
            <Save className="h-4 w-4 mr-1" /> সেভ করুন
          </Button>
          <p className="text-xs text-muted-foreground">
            bKash Merchant Portal থেকে Tokenized Checkout ক্রেডেনশিয়াল সংগ্রহ করুন। Sandbox মোডে টেস্ট করে তারপর Live-এ যান।
          </p>
        </CardContent>
      </Card>

      {/* Payment confirmation SMS */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>📩 পেমেন্ট কনফার্মেশন SMS</span>
            <Switch
              checked={paymentSmsEnabled}
              onCheckedChange={(v) => toggleSetting('payment_sms_confirmation_enabled', v, setPaymentSmsEnabled, 'পেমেন্ট SMS')}
            />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            চালু থাকলে, সফল অনলাইন পেমেন্টের পর কাস্টমারকে একটি নিশ্চিতকরণ SMS পাঠানো হবে। ডিফল্টভাবে বন্ধ থাকে — খরচ নিয়ন্ত্রণে রাখতে প্রয়োজন অনুযায়ী চালু করুন। পেমেন্ট কনফার্মেশন ইমেইল সবসময় পাঠানো হবে (এই সুইচ শুধু SMS নিয়ন্ত্রণ করে)।
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
