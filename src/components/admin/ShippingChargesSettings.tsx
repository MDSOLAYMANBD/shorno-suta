import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, Save, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { useStoreSettings, useUpdateSetting } from '@/hooks/useStoreSettings';
import { SHIPPING_DEFAULTS } from '@/hooks/useShippingCharges';
import { useActivityLog } from '@/hooks/useActivityLog';

/**
 * Single source of truth for shipping charges.
 * Edits made here propagate to: Checkout, QuickOrder, LandingOrderForm,
 * ManualOrder, GiveawayOrder, AbandonedCheckoutEditor, OrderPreviewDialog,
 * LandingPageBrandDefaults, AdminLandingPageEditor and the place-order edge function.
 */
export default function ShippingChargesSettings() {
  const { data: settings = {}, isLoading } = useStoreSettings();
  const updateSetting = useUpdateSetting();
  const { logActivity } = useActivityLog();

  const [form, setForm] = useState<{ dhaka_inside: number; dhaka_suburb: number; dhaka_outside: number }>({
    dhaka_inside: SHIPPING_DEFAULTS.dhaka_inside,
    dhaka_suburb: SHIPPING_DEFAULTS.dhaka_suburb,
    dhaka_outside: SHIPPING_DEFAULTS.dhaka_outside,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const ins = Number(settings['shipping_dhaka_inside']);
    const sub = Number(settings['shipping_dhaka_suburb']);
    const out = Number(settings['shipping_dhaka_outside']);
    setForm({
      dhaka_inside: Number.isFinite(ins) && ins >= 0 ? ins : SHIPPING_DEFAULTS.dhaka_inside,
      dhaka_suburb: Number.isFinite(sub) && sub >= 0 ? sub : SHIPPING_DEFAULTS.dhaka_suburb,
      dhaka_outside: Number.isFinite(out) && out >= 0 ? out : SHIPPING_DEFAULTS.dhaka_outside,
    });
  }, [settings]);

  const save = async () => {
    if (form.dhaka_inside < 0 || form.dhaka_suburb < 0 || form.dhaka_outside < 0) {
      toast.error('চার্জ ০ বা তার বেশি হতে হবে');
      return;
    }
    setSaving(true);
    try {
      await Promise.all([
        updateSetting.mutateAsync({ key: 'shipping_dhaka_inside', value: String(form.dhaka_inside) }),
        updateSetting.mutateAsync({ key: 'shipping_dhaka_suburb', value: String(form.dhaka_suburb) }),
        updateSetting.mutateAsync({ key: 'shipping_dhaka_outside', value: String(form.dhaka_outside) }),
        // Mirror into legacy keys used by AI chat so customer-facing answers stay consistent
        updateSetting.mutateAsync({ key: 'delivery_charge_inside_dhaka', value: String(form.dhaka_inside) }),
        updateSetting.mutateAsync({ key: 'delivery_charge_dhaka_suburb', value: String(form.dhaka_suburb) }),
        updateSetting.mutateAsync({ key: 'delivery_charge_outside_dhaka', value: String(form.dhaka_outside) }),
      ]);
      logActivity('settings_update', 'store_settings', null, `শিপিং চার্জ আপডেট: ঢাকা ৳${form.dhaka_inside}, সাব-এরিয়া ৳${form.dhaka_suburb}, সারাদেশে ৳${form.dhaka_outside}`);
      toast.success('শিপিং চার্জ সেভ হয়েছে। সব জায়গায় আপডেট হয়ে গেছে।');
    } catch (e: any) {
      toast.error(e?.message || 'সেভ করতে সমস্যা হয়েছে');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> লোড হচ্ছে...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/40 rounded-md px-3 py-2">
        <Truck className="h-4 w-4 shrink-0" />
        <span>এখানে যে চার্জ সেভ করবেন সেটাই ওয়েবসাইট, ল্যান্ডিং পেজ, কুইক অর্ডার, ম্যানুয়াল অর্ডার, গিফট অর্ডার সহ সব জায়গায় ব্যবহার হবে।</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <Label className="mb-1.5 block">ঢাকা সিটি (৳)</Label>
          <Input
            type="number"
            min={0}
            value={form.dhaka_inside}
            onChange={e => setForm(p => ({ ...p, dhaka_inside: Number(e.target.value) || 0 }))}
          />
        </div>
        <div>
          <Label className="mb-1.5 block">সাব-এরিয়া (৳)</Label>
          <Input
            type="number"
            min={0}
            value={form.dhaka_suburb}
            onChange={e => setForm(p => ({ ...p, dhaka_suburb: Number(e.target.value) || 0 }))}
          />
        </div>
        <div>
          <Label className="mb-1.5 block">সারাদেশে / ঢাকার বাইরে (৳)</Label>
          <Input
            type="number"
            min={0}
            value={form.dhaka_outside}
            onChange={e => setForm(p => ({ ...p, dhaka_outside: Number(e.target.value) || 0 }))}
          />
        </div>
      </div>
      <Button onClick={save} disabled={saving} className="gap-2">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        সেভ করুন
      </Button>
    </div>
  );
}
