import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, Plus, Trash2, ArrowUp, ArrowDown, MessageCircle, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { useSiteConfig, useSaveSiteConfig, DEFAULT_BUTTONS_CONFIG } from '@/hooks/useSiteConfig';
import ColorPickerWithRecent from '@/components/admin/ColorPickerWithRecent';
import { useStoreSettings, useUpdateSetting } from '@/hooks/useStoreSettings';

export default function ButtonManagement() {
  const { data: savedConfig } = useSiteConfig('buttons_config');
  const saveConfig = useSaveSiteConfig();
  const { data: storeSettings } = useStoreSettings();
  const updateSetting = useUpdateSetting();
  const [form, setForm] = useState(structuredClone(DEFAULT_BUTTONS_CONFIG));
  const [whatsapp, setWhatsapp] = useState('');
  const [messenger, setMessenger] = useState('');
  const [helpline, setHelpline] = useState('');

  useEffect(() => {
    if (storeSettings) {
      setWhatsapp(storeSettings.whatsapp_number || '');
      setMessenger(storeSettings.messenger_link || '');
      setHelpline(storeSettings.helpline_number || '');
    }
  }, [storeSettings]);

  useEffect(() => {
    if (savedConfig) {
      setForm(prev => ({
        product_detail: { ...prev.product_detail, ...savedConfig.product_detail },
        product_card: { ...prev.product_card, ...savedConfig.product_card },
        bottom_nav: { ...prev.bottom_nav, ...savedConfig.bottom_nav },
      }));
    }
  }, [savedConfig]);

  const save = async () => {
    try {
      await saveConfig.mutateAsync({ key: 'buttons_config', value: form });
      toast.success('বাটন সেটিংস সেভ হয়েছে');
    } catch {
      toast.error('সেভ করতে সমস্যা হয়েছে');
    }
  };

  const updatePD = (key: string, field: string, value: any) => {
    setForm(prev => ({
      ...prev,
      product_detail: {
        ...prev.product_detail,
        [key]: { ...(prev.product_detail as any)[key], [field]: value },
      },
    }));
  };

  const updatePC = (key: string, field: string, value: any) => {
    setForm(prev => ({
      ...prev,
      product_card: {
        ...prev.product_card,
        [key]: { ...(prev.product_card as any)[key], [field]: value },
      },
    }));
  };

  const addCustomButton = () => {
    setForm(prev => ({
      ...prev,
      product_detail: {
        ...prev.product_detail,
        custom_buttons: [...prev.product_detail.custom_buttons, { text: 'নতুন বাটন', link: '', bg_color: '', text_color: '', enabled: true }],
      },
    }));
  };

  const removeCustomButton = (index: number) => {
    setForm(prev => ({
      ...prev,
      product_detail: {
        ...prev.product_detail,
        custom_buttons: prev.product_detail.custom_buttons.filter((_, i) => i !== index),
      },
    }));
  };

  const updateCustomButton = (index: number, field: string, value: any) => {
    setForm(prev => ({
      ...prev,
      product_detail: {
        ...prev.product_detail,
        custom_buttons: prev.product_detail.custom_buttons.map((btn, i) => i === index ? { ...btn, [field]: value } : btn),
      },
    }));
  };

  const updateNavItem = (index: number, field: string, value: any) => {
    setForm(prev => ({
      ...prev,
      bottom_nav: {
        ...prev.bottom_nav,
        items: prev.bottom_nav.items.map((item, i) => i === index ? { ...item, [field]: value } : item),
      },
    }));
  };

  const moveNavItem = (index: number, dir: -1 | 1) => {
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= form.bottom_nav.items.length) return;
    setForm(prev => {
      const items = [...prev.bottom_nav.items];
      [items[index], items[newIndex]] = [items[newIndex], items[index]];
      return { ...prev, bottom_nav: { ...prev.bottom_nav, items } };
    });
  };

  const addNavItem = () => {
    setForm(prev => ({
      ...prev,
      bottom_nav: {
        ...prev.bottom_nav,
        items: [...prev.bottom_nav.items, { label: 'নতুন', icon_type: 'home', to: '/', type: 'link' as const, enabled: true }],
      },
    }));
  };

  const removeNavItem = (index: number) => {
    setForm(prev => ({
      ...prev,
      bottom_nav: {
        ...prev.bottom_nav,
        items: prev.bottom_nav.items.filter((_, i) => i !== index),
      },
    }));
  };

  const ButtonEditor = ({ label, configKey, parent }: { label: string; configKey: string; parent: 'product_detail' | 'product_card' }) => {
    const cfg = (form[parent] as any)[configKey];
    const update = parent === 'product_detail' ? updatePD : updatePC;
    const showSize = parent === 'product_detail';
    const showText = 'text' in cfg;

    return (
      <div className="border rounded-lg p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-medium text-sm">{label}</span>
          <Switch checked={cfg.enabled} onCheckedChange={v => update(configKey, 'enabled', v)} />
        </div>
        {showText && (
          <div>
            <Label className="text-xs">বাটন টেক্সট</Label>
            <Input value={cfg.text} onChange={e => update(configKey, 'text', e.target.value)} className="mt-1" />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">ব্যাকগ্রাউন্ড কালার</Label>
            <ColorPickerWithRecent value={cfg.bg_color || ''} onChange={v => update(configKey, 'bg_color', v)} />
          </div>
          <div>
            <Label className="text-xs">টেক্সট কালার</Label>
            <ColorPickerWithRecent value={cfg.text_color || ''} onChange={v => update(configKey, 'text_color', v)} />
          </div>
        </div>
        {cfg.border_color !== undefined && (
          <div>
            <Label className="text-xs">বর্ডার কালার</Label>
            <ColorPickerWithRecent value={cfg.border_color || ''} onChange={v => update(configKey, 'border_color', v)} />
          </div>
        )}
        {showSize && (
          <div>
            <Label className="text-xs">সাইজ</Label>
            <Select value={cfg.size || 'lg'} onValueChange={v => update(configKey, 'size', v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sm">Small</SelectItem>
                <SelectItem value="md">Medium</SelectItem>
                <SelectItem value="lg">Large</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    );
  };

  const iconTypeOptions = [
    { value: 'home', label: '🏠 হোম' },
    { value: 'whatsapp', label: '💬 WhatsApp' },
    { value: 'messenger', label: '💬 Messenger' },
    { value: 'cart', label: '🛒 কার্ট' },
    { value: 'account', label: '👤 একাউন্ট' },
    { value: 'phone', label: '📞 ফোন' },
    { value: 'shop', label: '🛍️ শপ' },
  ];

  return (
    <Card className="border-0 shadow-none">
      <CardContent className="pt-4 space-y-4">
        <Tabs defaultValue="product_detail">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="product_detail" className="text-xs">প্রোডাক্ট ডিটেইল</TabsTrigger>
            <TabsTrigger value="product_card" className="text-xs">প্রোডাক্ট কার্ড</TabsTrigger>
            <TabsTrigger value="bottom_nav" className="text-xs">বটম নেভ</TabsTrigger>
          </TabsList>

          <TabsContent value="product_detail" className="space-y-3 mt-3">
            <ButtonEditor label="অর্ডার বাটন" configKey="order_button" parent="product_detail" />
            <ButtonEditor label="কার্ট বাটন" configKey="cart_button" parent="product_detail" />
            <ButtonEditor label="WhatsApp বাটন" configKey="whatsapp_button" parent="product_detail" />
            <ButtonEditor label="কল বাটন" configKey="call_button" parent="product_detail" />

            {/* Custom buttons */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">কাস্টম বাটন</h4>
              {form.product_detail.custom_buttons.map((btn, i) => (
                <div key={i} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">কাস্টম বাটন #{i + 1}</span>
                    <div className="flex gap-1">
                      <Switch checked={btn.enabled} onCheckedChange={v => updateCustomButton(i, 'enabled', v)} />
                      <Button size="sm" variant="ghost" onClick={() => removeCustomButton(i)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                    </div>
                  </div>
                  <Input value={btn.text} onChange={e => updateCustomButton(i, 'text', e.target.value)} placeholder="বাটন টেক্সট" />
                  <Input value={btn.link} onChange={e => updateCustomButton(i, 'link', e.target.value)} placeholder="লিংক (https://...)" />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">ব্যাকগ্রাউন্ড</Label>
                      <ColorPickerWithRecent value={btn.bg_color} onChange={v => updateCustomButton(i, 'bg_color', v)} />
                    </div>
                    <div>
                      <Label className="text-xs">টেক্সট কালার</Label>
                      <ColorPickerWithRecent value={btn.text_color} onChange={v => updateCustomButton(i, 'text_color', v)} />
                    </div>
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addCustomButton} className="w-full">
                <Plus className="h-3 w-3 mr-1" /> নতুন বাটন যোগ করুন
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="product_card" className="space-y-3 mt-3">
            <ButtonEditor label="অর্ডার বাটন" configKey="order_button" parent="product_card" />
            <ButtonEditor label="কার্ট বাটন" configKey="cart_button" parent="product_card" />
          </TabsContent>

          <TabsContent value="bottom_nav" className="space-y-3 mt-3">
            {/* Contact Numbers Section */}
            <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
              <h4 className="text-sm font-medium flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" /> যোগাযোগ নম্বর
              </h4>
              <p className="text-xs text-muted-foreground">নিচের নেভ আইটেমগুলোতে এই নম্বরগুলো অটো ব্যবহার হবে</p>
              {[
                { label: 'WhatsApp নম্বর', value: whatsapp, setValue: setWhatsapp, key: 'whatsapp_number', placeholder: '8801XXXXXXXXX' },
                { label: 'Messenger লিংক', value: messenger, setValue: setMessenger, key: 'messenger_link', placeholder: 'https://m.me/yourpage' },
                { label: 'হেল্পলাইন নম্বর', value: helpline, setValue: setHelpline, key: 'helpline_number', placeholder: '01XXXXXXXXX' },
              ].map(({ label, value, setValue, key, placeholder }) => (
                <div key={key} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label className="text-xs">{label}</Label>
                    <Input value={value} onChange={e => setValue(e.target.value)} placeholder={placeholder} className="mt-1" />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={updateSetting.isPending}
                    onClick={async () => {
                      try {
                        await updateSetting.mutateAsync({ key, value });
                        toast.success(`${label} সেভ হয়েছে`);
                      } catch { toast.error('সেভ করতে সমস্যা হয়েছে'); }
                    }}
                  >
                    <Save className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>

            {form.bottom_nav.items.map((item, i) => {
              const isContactIcon = ['whatsapp', 'messenger', 'phone'].includes(item.icon_type);
              const contactHint = item.icon_type === 'whatsapp' ? `WhatsApp: ${whatsapp || 'সেট করা হয়নি'}` :
                item.icon_type === 'messenger' ? `Messenger: ${messenger || 'সেট করা হয়নি'}` :
                item.icon_type === 'phone' ? `হেল্পলাইন: ${helpline || 'সেট করা হয়নি'}` : '';

              return (
              <div key={i} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">{item.label}</span>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => moveNavItem(i, -1)} disabled={i === 0}><ArrowUp className="h-3 w-3" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => moveNavItem(i, 1)} disabled={i === form.bottom_nav.items.length - 1}><ArrowDown className="h-3 w-3" /></Button>
                    <Switch checked={item.enabled} onCheckedChange={v => updateNavItem(i, 'enabled', v)} />
                    <Button size="sm" variant="ghost" onClick={() => removeNavItem(i)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">লেবেল</Label>
                    <Input value={item.label} onChange={e => updateNavItem(i, 'label', e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">আইকন</Label>
                    <Select value={item.icon_type} onValueChange={v => updateNavItem(i, 'icon_type', v)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {iconTypeOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">টাইপ</Label>
                    <Select value={item.type} onValueChange={v => updateNavItem(i, 'type', v)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="link">Internal Link</SelectItem>
                        <SelectItem value="external">External Link</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">{item.type === 'external' ? 'URL' : 'পাথ'}</Label>
                    {isContactIcon ? (
                      <p className="mt-1 text-xs text-muted-foreground border rounded-md px-3 py-2.5 bg-muted/50">{contactHint}</p>
                    ) : (
                      <Input
                        value={(item as any).to || (item as any).href || ''}
                        onChange={e => updateNavItem(i, item.type === 'external' ? 'href' : 'to', e.target.value)}
                        className="mt-1"
                        placeholder={item.type === 'external' ? 'https://...' : '/shop'}
                      />
                    )}
                  </div>
                </div>
              </div>
              );
            })}
            <Button variant="outline" size="sm" onClick={addNavItem} className="w-full">
              <Plus className="h-3 w-3 mr-1" /> নতুন আইটেম যোগ করুন
            </Button>
          </TabsContent>
        </Tabs>

        <Button onClick={save} disabled={saveConfig.isPending} className="w-full">
          <Save className="h-4 w-4 mr-2" />
          {saveConfig.isPending ? 'সেভ হচ্ছে...' : 'বাটন সেটিংস সেভ করুন'}
        </Button>
      </CardContent>
    </Card>
  );
}
