import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, Plus, Trash2, GripVertical, Truck, FormInput, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useCheckoutConfig, useSaveCheckoutConfig, BuiltInFieldKey, CheckoutConfig, CustomFieldConfig, ShippingZoneConfig, RESERVED_ZONE_IDS } from '@/hooks/useCheckoutConfig';
import { useActivityLog } from '@/hooks/useActivityLog';
import { cn } from '@/lib/utils';

const FIELD_META: Record<BuiltInFieldKey, { icon: string; name: string; canHide: boolean; canBeOptional: boolean }> = {
  name:    { icon: '👤', name: 'নাম',    canHide: false, canBeOptional: false },
  phone:   { icon: '📞', name: 'ফোন',    canHide: false, canBeOptional: false },
  address: { icon: '📍', name: 'ঠিকানা', canHide: true,  canBeOptional: true  },
  email:   { icon: '📧', name: 'ইমেইল',  canHide: true,  canBeOptional: true  },
  note:    { icon: '📝', name: 'নোট',    canHide: true,  canBeOptional: true  },
};

const FIELD_ORDER: BuiltInFieldKey[] = ['name', 'phone', 'address', 'email', 'note'];

function genId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function CheckoutFieldsSettings() {
  const { config, isLoading } = useCheckoutConfig();
  const save = useSaveCheckoutConfig();
  const { logActivity } = useActivityLog();

  const [draft, setDraft] = useState<CheckoutConfig>(config);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!isLoading && !hydrated) {
      setDraft(config);
      setHydrated(true);
    }
  }, [isLoading, hydrated, config]);

  const updateField = (key: BuiltInFieldKey, patch: Partial<CheckoutConfig['fields'][BuiltInFieldKey]>) => {
    setDraft(d => ({ ...d, fields: { ...d.fields, [key]: { ...d.fields[key], ...patch } } }));
  };

  const addCustomField = () => {
    const id = genId('cf');
    setDraft(d => ({
      ...d,
      custom_fields: [...d.custom_fields, { id, label: 'নতুন ফিল্ড', placeholder: '', type: 'text', required: false, show: true, order: d.custom_fields.length + 1 }],
    }));
  };
  const updateCustomField = (id: string, patch: Partial<CustomFieldConfig>) => {
    setDraft(d => ({ ...d, custom_fields: d.custom_fields.map(f => f.id === id ? { ...f, ...patch } : f) }));
  };
  const removeCustomField = (id: string) => {
    setDraft(d => ({ ...d, custom_fields: d.custom_fields.filter(f => f.id !== id) }));
  };
  const moveCustomField = (id: string, dir: -1 | 1) => {
    setDraft(d => {
      const list = [...d.custom_fields].sort((a, b) => a.order - b.order);
      const i = list.findIndex(f => f.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return d;
      [list[i], list[j]] = [list[j], list[i]];
      return { ...d, custom_fields: list.map((f, idx) => ({ ...f, order: idx + 1 })) };
    });
  };

  const addZone = () => {
    const id = genId('zone');
    setDraft(d => ({
      ...d,
      shipping_zones: [...d.shipping_zones, { id, label: 'নতুন এরিয়া', price: 0, default: false, show: true, order: d.shipping_zones.length + 1 }],
    }));
  };
  const updateZone = (id: string, patch: Partial<ShippingZoneConfig>) => {
    setDraft(d => {
      let zones = d.shipping_zones.map(z => z.id === id ? { ...z, ...patch } : z);
      // Only one default
      if (patch.default === true) {
        zones = zones.map(z => ({ ...z, default: z.id === id }));
      }
      return { ...d, shipping_zones: zones };
    });
  };
  const removeZone = (id: string) => {
    if (RESERVED_ZONE_IDS.includes(id as any)) {
      toast.error('এই ডিফল্ট এরিয়াটি মুছে ফেলা যাবে না — শুধু hide করতে পারেন');
      return;
    }
    setDraft(d => ({ ...d, shipping_zones: d.shipping_zones.filter(z => z.id !== id) }));
  };
  const moveZone = (id: string, dir: -1 | 1) => {
    setDraft(d => {
      const list = [...d.shipping_zones].sort((a, b) => a.order - b.order);
      const i = list.findIndex(z => z.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return d;
      [list[i], list[j]] = [list[j], list[i]];
      return { ...d, shipping_zones: list.map((z, idx) => ({ ...z, order: idx + 1 })) };
    });
  };

  const handleSave = async () => {
    // Validation
    const visibleZones = draft.shipping_zones.filter(z => z.show);
    if (visibleZones.length === 0) {
      toast.error('কমপক্ষে ১টি শিপিং এরিয়া show করতে হবে');
      return;
    }
    if (visibleZones.filter(z => z.default).length !== 1) {
      // Auto-fix: pick first visible
      draft.shipping_zones = draft.shipping_zones.map(z => ({ ...z, default: z.id === visibleZones[0].id }));
    }
    for (const z of draft.shipping_zones) {
      if (!z.label.trim()) { toast.error('সব এরিয়ার নাম দিন'); return; }
      if (z.price < 0) { toast.error('চার্জ ০ বা তার বেশি হতে হবে'); return; }
    }
    for (const f of draft.custom_fields) {
      if (!f.label.trim()) { toast.error('সব custom field-এর label দিন'); return; }
    }
    try {
      await save.mutateAsync(draft);
      logActivity('settings_update', 'store_settings', null, 'চেকআউট ফিল্ড / শিপিং কনফিগ আপডেট');
      toast.success('সেভ হয়েছে — সব checkout পেইজে আপডেট হবে');
    } catch (e: any) {
      toast.error(e?.message || 'সেভ করতে সমস্যা হয়েছে');
    }
  };

  if (isLoading || !hydrated) {
    return (
      <div className="flex items-center justify-center py-6 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> লোড হচ্ছে...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/40 rounded-md px-3 py-2">
        <Sparkles className="h-4 w-4 shrink-0 text-primary" />
        <span>এখানে যা সেভ করবেন, সেটাই Checkout, Landing Page, Quick Order, Manual Order — সব জায়গায় ব্যবহার হবে।</span>
      </div>

      {/* Built-in Fields */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <FormInput className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">বিল্ট-ইন ফিল্ড</h3>
        </div>
        <div className="space-y-2">
          {FIELD_ORDER.map(key => {
            const meta = FIELD_META[key];
            const f = draft.fields[key];
            return (
              <div key={key} className={cn('grid grid-cols-12 gap-2 items-center border rounded-lg p-2.5 bg-card', !f.show && 'opacity-60')}>
                <div className="col-span-12 sm:col-span-2 flex items-center gap-2">
                  <span className="text-lg">{meta.icon}</span>
                  <span className="text-sm font-medium">{meta.name}</span>
                </div>
                <div className="col-span-6 sm:col-span-4">
                  <Input value={f.label} onChange={e => updateField(key, { label: e.target.value })} placeholder="Label" className="h-9 text-sm" />
                </div>
                <div className="col-span-6 sm:col-span-3">
                  <Input value={f.placeholder || ''} onChange={e => updateField(key, { placeholder: e.target.value })} placeholder="Placeholder" className="h-9 text-sm" />
                </div>
                <div className="col-span-6 sm:col-span-1.5 flex items-center gap-1.5">
                  <Switch checked={f.show} disabled={!meta.canHide} onCheckedChange={v => updateField(key, { show: v })} />
                  <span className="text-xs text-muted-foreground">Show</span>
                </div>
                <div className="col-span-6 sm:col-span-1.5 flex items-center gap-1.5">
                  <Switch checked={f.required} disabled={!meta.canBeOptional} onCheckedChange={v => updateField(key, { required: v })} />
                  <span className="text-xs text-muted-foreground">Req.</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Custom Fields */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">কাস্টম ফিল্ড</h3>
            <span className="text-xs text-muted-foreground">({draft.custom_fields.length})</span>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addCustomField} className="h-8 gap-1.5">
            <Plus className="h-3.5 w-3.5" /> ফিল্ড যোগ
          </Button>
        </div>
        {draft.custom_fields.length === 0 ? (
          <p className="text-sm text-muted-foreground bg-muted/30 rounded-md px-3 py-4 text-center">
            কোনো কাস্টম ফিল্ড নেই — উপরের বাটনে ক্লিক করে যোগ করুন (যেমন "বিকল্প ফোন", "ল্যান্ডমার্ক")
          </p>
        ) : (
          <div className="space-y-2">
            {draft.custom_fields.sort((a, b) => a.order - b.order).map((f, idx, arr) => (
              <div key={f.id} className="grid grid-cols-12 gap-2 items-center border rounded-lg p-2.5 bg-card">
                <div className="col-span-12 sm:col-span-1 flex flex-col items-center">
                  <button type="button" onClick={() => moveCustomField(f.id, -1)} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs">▲</button>
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <button type="button" onClick={() => moveCustomField(f.id, 1)} disabled={idx === arr.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs">▼</button>
                </div>
                <div className="col-span-6 sm:col-span-3">
                  <Input value={f.label} onChange={e => updateCustomField(f.id, { label: e.target.value })} placeholder="Label *" className="h-9 text-sm" />
                </div>
                <div className="col-span-6 sm:col-span-3">
                  <Input value={f.placeholder || ''} onChange={e => updateCustomField(f.id, { placeholder: e.target.value })} placeholder="Placeholder" className="h-9 text-sm" />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <Select value={f.type} onValueChange={(v: any) => updateCustomField(f.id, { type: v })}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="textarea">Textarea</SelectItem>
                      <SelectItem value="number">Number</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-3 sm:col-span-1 flex flex-col items-center gap-0.5">
                  <Switch checked={f.show} onCheckedChange={v => updateCustomField(f.id, { show: v })} />
                  <span className="text-[10px] text-muted-foreground">Show</span>
                </div>
                <div className="col-span-3 sm:col-span-1 flex flex-col items-center gap-0.5">
                  <Switch checked={f.required} onCheckedChange={v => updateCustomField(f.id, { required: v })} />
                  <span className="text-[10px] text-muted-foreground">Req.</span>
                </div>
                <div className="col-span-2 sm:col-span-1 flex justify-end">
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeCustomField(f.id)} className="h-8 w-8 text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Shipping Zones */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">শিপিং / ডেলিভারি এরিয়া</h3>
            <span className="text-xs text-muted-foreground">({draft.shipping_zones.length})</span>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addZone} className="h-8 gap-1.5">
            <Plus className="h-3.5 w-3.5" /> এরিয়া যোগ
          </Button>
        </div>
        <div className="space-y-2">
          {draft.shipping_zones.sort((a, b) => a.order - b.order).map((z, idx, arr) => {
            const isReserved = RESERVED_ZONE_IDS.includes(z.id as any);
            return (
              <div key={z.id} className={cn('grid grid-cols-12 gap-2 items-center border rounded-lg p-2.5 bg-card', !z.show && 'opacity-60')}>
                <div className="col-span-12 sm:col-span-1 flex flex-col items-center">
                  <button type="button" onClick={() => moveZone(z.id, -1)} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs">▲</button>
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <button type="button" onClick={() => moveZone(z.id, 1)} disabled={idx === arr.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs">▼</button>
                </div>
                <div className="col-span-7 sm:col-span-4">
                  <Input value={z.label} onChange={e => updateZone(z.id, { label: e.target.value })} placeholder="এরিয়া নাম *" className="h-9 text-sm" />
                </div>
                <div className="col-span-5 sm:col-span-3">
                  <Input type="number" min={0} value={z.price} onChange={e => updateZone(z.id, { price: Number(e.target.value) || 0 })} placeholder="চার্জ (৳)" className="h-9 text-sm" />
                </div>
                <div className="col-span-4 sm:col-span-1.5 flex flex-col items-center gap-0.5">
                  <Switch checked={z.default} onCheckedChange={v => v && updateZone(z.id, { default: true })} />
                  <span className="text-[10px] text-muted-foreground">Default</span>
                </div>
                <div className="col-span-4 sm:col-span-1.5 flex flex-col items-center gap-0.5">
                  <Switch checked={z.show} onCheckedChange={v => updateZone(z.id, { show: v })} />
                  <span className="text-[10px] text-muted-foreground">Show</span>
                </div>
                <div className="col-span-4 sm:col-span-1 flex justify-end">
                  <Button
                    type="button" variant="ghost" size="icon"
                    onClick={() => removeZone(z.id)}
                    disabled={isReserved}
                    title={isReserved ? 'ডিফল্ট এরিয়া — শুধু hide করা যাবে' : 'মুছুন'}
                    className="h-8 w-8 text-destructive hover:text-destructive disabled:opacity-30"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex justify-end pt-2 border-t">
        <Button onClick={handleSave} disabled={save.isPending} className="gap-2">
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          সব সেভ করুন
        </Button>
      </div>
    </div>
  );
}
