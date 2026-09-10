import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useStoreSettings, useUpdateSetting } from '@/hooks/useStoreSettings';
import { useActivityLog } from '@/hooks/useActivityLog';

export default function AdminStoreInfoSettings() {
  const navigate = useNavigate();
  const { data: settings = {}, isLoading } = useStoreSettings();
  const updateSetting = useUpdateSetting();
  const { logActivity } = useActivityLog();

  const [form, setForm] = useState({
    store_name_bn: '',
    helpline_number: '',
    whatsapp_number: '',
    messenger_link: '',
  });

  useEffect(() => {
    if (settings) {
      setForm({
        store_name_bn: settings.store_name_bn || '',
        helpline_number: settings.helpline_number || '',
        whatsapp_number: settings.whatsapp_number || '',
        messenger_link: settings.messenger_link || '',
      });
    }
  }, [settings]);

  const saveSetting = async (key: keyof typeof form) => {
    try {
      await updateSetting.mutateAsync({ key, value: form[key] });
      logActivity('settings_change', 'settings', key, `সেটিং পরিবর্তন: ${key}`);
      toast.success(`${key} সেভ হয়েছে`);
    } catch {
      toast.error('সেভ করতে সমস্যা হয়েছে');
    }
  };

  if (isLoading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/site-editor')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> ফিরে যান
        </Button>
        <h1 className="text-2xl font-bold">🏪 স্টোর তথ্য</h1>
      </div>
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label>স্টোরের নাম (বাংলা)</Label>
              <Input value={form.store_name_bn} onChange={e => setForm(p => ({ ...p, store_name_bn: e.target.value }))} placeholder="স্বর্ণ সুতা" />
            </div>
            <Button size="sm" onClick={() => saveSetting('store_name_bn')}><Save className="h-4 w-4" /></Button>
          </div>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label>হেল্পলাইন নাম্বার</Label>
              <Input value={form.helpline_number} onChange={e => setForm(p => ({ ...p, helpline_number: e.target.value }))} placeholder="+8801XXXXXXXXX" />
            </div>
            <Button size="sm" onClick={() => saveSetting('helpline_number')}><Save className="h-4 w-4" /></Button>
          </div>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label>WhatsApp নাম্বার</Label>
              <Input value={form.whatsapp_number} onChange={e => setForm(p => ({ ...p, whatsapp_number: e.target.value }))} placeholder="+8801XXXXXXXXX" />
            </div>
            <Button size="sm" onClick={() => saveSetting('whatsapp_number')}><Save className="h-4 w-4" /></Button>
          </div>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label>Messenger লিংক</Label>
              <Input value={form.messenger_link} onChange={e => setForm(p => ({ ...p, messenger_link: e.target.value }))} placeholder="https://m.me/yourpage" />
            </div>
            <Button size="sm" onClick={() => saveSetting('messenger_link')}><Save className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
