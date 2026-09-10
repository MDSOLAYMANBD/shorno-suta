import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Save, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import SEOHead from '@/components/SEOHead';

interface Faq {
  id?: string;
  question: string;
  answer: string;
  category: string;
  priority: number;
  is_active: boolean;
}

export default function AdminAIChatSettings() {
  const [enabled, setEnabled] = useState(true);
  const [autoReply, setAutoReply] = useState(true);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [greeting, setGreeting] = useState('');
  const [model, setModel] = useState('google/gemini-2.5-flash');
  const [savingSettings, setSavingSettings] = useState(false);

  // Store info that AI uses to answer customer questions
  const [delivInside, setDelivInside] = useState('70');
  const [delivSuburb, setDelivSuburb] = useState('100');
  const [delivOutside, setDelivOutside] = useState('120');
  const [officeAddress, setOfficeAddress] = useState('');
  const [officeHours, setOfficeHours] = useState('');
  const [pickupEnabled, setPickupEnabled] = useState(true);

  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [newFaq, setNewFaq] = useState<Faq>({ question: '', answer: '', category: 'faq', priority: 0, is_active: true });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [s, f] = await Promise.all([
      supabase.from('store_settings').select('key, value').in('key', [
        'ai_chat_enabled', 'ai_chat_auto_reply', 'ai_chat_system_prompt', 'ai_chat_greeting', 'ai_chat_model',
        'delivery_charge_inside_dhaka', 'delivery_charge_dhaka_suburb', 'delivery_charge_outside_dhaka',
        'shipping_dhaka_inside', 'shipping_dhaka_suburb', 'shipping_dhaka_outside',
        'office_address', 'office_hours', 'showroom_pickup_enabled',
      ]),
      supabase.from('ai_knowledge_base').select('*').order('priority', { ascending: false }),
    ]);
    const map: Record<string, string> = {};
    (s.data || []).forEach((r: any) => { map[r.key] = r.value; });
    setEnabled(map.ai_chat_enabled !== 'false');
    setAutoReply(map.ai_chat_auto_reply !== 'false');
    setSystemPrompt(map.ai_chat_system_prompt || '');
    setGreeting(map.ai_chat_greeting || '');
    setModel(map.ai_chat_model || 'google/gemini-2.5-flash');
    // Prefer authoritative `shipping_*` keys (edited from Shipping Charges Settings)
    setDelivInside(map.shipping_dhaka_inside || map.delivery_charge_inside_dhaka || '70');
    setDelivSuburb(map.shipping_dhaka_suburb || map.delivery_charge_dhaka_suburb || '100');
    setDelivOutside(map.shipping_dhaka_outside || map.delivery_charge_outside_dhaka || '130');
    setOfficeAddress(map.office_address || '');
    setOfficeHours(map.office_hours || '');
    setPickupEnabled(map.showroom_pickup_enabled !== 'false');
    setFaqs((f.data || []) as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const upsertSetting = async (key: string, value: string) => {
    const { data: existing } = await supabase.from('store_settings').select('id').eq('key', key).maybeSingle();
    if (existing) await supabase.from('store_settings').update({ value }).eq('key', key);
    else await supabase.from('store_settings').insert({ key, value });
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      await Promise.all([
        upsertSetting('ai_chat_enabled', String(enabled)),
        upsertSetting('ai_chat_auto_reply', String(autoReply)),
        upsertSetting('ai_chat_system_prompt', systemPrompt),
        upsertSetting('ai_chat_greeting', greeting),
        upsertSetting('ai_chat_model', model),
        upsertSetting('delivery_charge_inside_dhaka', delivInside),
        upsertSetting('delivery_charge_dhaka_suburb', delivSuburb),
        upsertSetting('delivery_charge_outside_dhaka', delivOutside),
        // Mirror to authoritative shipping keys so order forms stay in sync
        upsertSetting('shipping_dhaka_inside', delivInside),
        upsertSetting('shipping_dhaka_suburb', delivSuburb),
        upsertSetting('shipping_dhaka_outside', delivOutside),
        upsertSetting('office_address', officeAddress),
        upsertSetting('office_hours', officeHours),
        upsertSetting('showroom_pickup_enabled', String(pickupEnabled)),
      ]);
      toast.success('সেটিংস সেভ হয়েছে');
    } catch (e: any) {
      toast.error('সেভ ব্যর্থ: ' + e.message);
    } finally { setSavingSettings(false); }
  };

  const addFaq = async () => {
    if (!newFaq.question.trim() || !newFaq.answer.trim()) { toast.error('প্রশ্ন ও উত্তর দিন'); return; }
    const { error } = await supabase.from('ai_knowledge_base').insert(newFaq);
    if (error) { toast.error(error.message); return; }
    toast.success('FAQ যোগ হয়েছে');
    setNewFaq({ question: '', answer: '', category: 'faq', priority: 0, is_active: true });
    load();
  };

  const updateFaq = async (id: string, patch: Partial<Faq>) => {
    const { error } = await supabase.from('ai_knowledge_base').update(patch).eq('id', id);
    if (error) toast.error(error.message);
    else load();
  };

  const deleteFaq = async (id: string) => {
    if (!confirm('ডিলিট করবেন?')) return;
    const { error } = await supabase.from('ai_knowledge_base').delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('ডিলিট হয়েছে'); load(); }
  };

  return (
    <div className="container max-w-5xl py-6 space-y-6">
      <SEOHead title="AI চ্যাট সেটিংস | অ্যাডমিন" description="AI কাস্টমার সাপোর্ট কনফিগারেশন ও নলেজ বেস ম্যানেজমেন্ট" />
      <div className="flex items-center gap-2">
        <Sparkles className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">AI চ্যাট সেটিংস</h1>
      </div>

      <Card>
        <CardHeader><CardTitle>AI কনফিগারেশন</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>AI চ্যাট চালু রাখুন</Label>
              <p className="text-xs text-muted-foreground">বন্ধ করলে শুধু staff manual রিপ্লাই দেবে</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Auto Reply</Label>
              <p className="text-xs text-muted-foreground">প্রতিটা ভিজিটর মেসেজে AI স্বয়ংক্রিয় রিপ্লাই দেবে</p>
            </div>
            <Switch checked={autoReply} onCheckedChange={setAutoReply} />
          </div>
          <div>
            <Label>মডেল</Label>
            <select value={model} onChange={(e) => setModel(e.target.value)} className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="google/gemini-2.5-flash">Gemini 2.5 Flash (দ্রুত, সাশ্রয়ী)</option>
              <option value="google/gemini-2.5-flash-lite">Gemini 2.5 Flash Lite (সবচেয়ে দ্রুত)</option>
              <option value="google/gemini-2.5-pro">Gemini 2.5 Pro (সবচেয়ে স্মার্ট)</option>
              <option value="openai/gpt-5-mini">GPT-5 Mini</option>
            </select>
          </div>
          <div>
            <Label>সিস্টেম প্রম্পট (AI-এর persona)</Label>
            <Textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} rows={6} className="mt-1 font-mono text-xs" />
          </div>
          <div>
            <Label>স্বাগত বার্তা</Label>
            <Textarea value={greeting} onChange={(e) => setGreeting(e.target.value)} rows={3} className="mt-1" />
          </div>
          <Button onClick={saveSettings} disabled={savingSettings}>
            {savingSettings ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            সেভ করুন
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>স্টোর তথ্য (AI জানবে)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>ডেলিভারি — ঢাকার ভেতরে (৳)</Label>
              <Input type="number" value={delivInside} onChange={(e) => setDelivInside(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>ডেলিভারি — ঢাকার আশেপাশে (৳)</Label>
              <Input type="number" value={delivSuburb} onChange={(e) => setDelivSuburb(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>ডেলিভারি — ঢাকার বাইরে (৳)</Label>
              <Input type="number" value={delivOutside} onChange={(e) => setDelivOutside(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div>
            <Label>অফিস ঠিকানা</Label>
            <Textarea value={officeAddress} onChange={(e) => setOfficeAddress(e.target.value)} rows={2} className="mt-1" />
          </div>
          <div>
            <Label>অফিস সময়</Label>
            <Input value={officeHours} onChange={(e) => setOfficeHours(e.target.value)} className="mt-1" placeholder="সকাল ১০টা থেকে রাত ৯টা পর্যন্ত (সপ্তাহে ৭ দিন খোলা)" />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>শোরুম পিকআপ চালু</Label>
              <p className="text-xs text-muted-foreground">কাস্টমার অফিস থেকে সরাসরি প্রোডাক্ট নিতে পারবে</p>
            </div>
            <Switch checked={pickupEnabled} onCheckedChange={setPickupEnabled} />
          </div>
          <p className="text-[11px] text-muted-foreground">এই তথ্য AI চ্যাটবট কাস্টমারের প্রশ্নের উত্তরে ব্যবহার করবে। উপরের "সেভ করুন" বাটনে চাপ দিলে সব সেভ হবে।</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>নলেজ বেস (FAQ)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 p-3 bg-muted rounded-lg">
            <Input placeholder="প্রশ্ন" value={newFaq.question} onChange={(e) => setNewFaq({ ...newFaq, question: e.target.value })} />
            <Textarea placeholder="উত্তর" rows={2} value={newFaq.answer} onChange={(e) => setNewFaq({ ...newFaq, answer: e.target.value })} />
            <div className="grid grid-cols-3 gap-2">
              <select value={newFaq.category} onChange={(e) => setNewFaq({ ...newFaq, category: e.target.value })} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="faq">FAQ</option>
                <option value="delivery">ডেলিভারি</option>
                <option value="return">রিটার্ন</option>
                <option value="product">প্রোডাক্ট</option>
                <option value="policy">পলিসি</option>
              </select>
              <Input type="number" placeholder="Priority" value={newFaq.priority} onChange={(e) => setNewFaq({ ...newFaq, priority: Number(e.target.value) })} />
              <Button onClick={addFaq}><Plus className="h-4 w-4 mr-1" />যোগ</Button>
            </div>
          </div>

          {loading ? <div className="text-center py-6"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div> : (
            <Table>
              <TableHeader><TableRow><TableHead>প্রশ্ন/উত্তর</TableHead><TableHead>ক্যাটেগরি</TableHead><TableHead>Priority</TableHead><TableHead>Active</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {faqs.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="max-w-md">
                      <div className="font-medium text-sm">{f.question}</div>
                      <div className="text-xs text-muted-foreground line-clamp-2">{f.answer}</div>
                    </TableCell>
                    <TableCell><Badge variant="outline">{f.category}</Badge></TableCell>
                    <TableCell>{f.priority}</TableCell>
                    <TableCell><Switch checked={f.is_active} onCheckedChange={(v) => updateFaq(f.id!, { is_active: v })} /></TableCell>
                    <TableCell><Button size="icon" variant="ghost" onClick={() => deleteFaq(f.id!)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                  </TableRow>
                ))}
                {faqs.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">কোনো FAQ নেই</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
