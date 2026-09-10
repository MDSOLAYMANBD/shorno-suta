import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { Loader2, Save, Sparkles, X, RotateCcw, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  useSiteConfig,
  useSaveSiteConfig,
  DEFAULT_WELCOME_ISLAND_CONFIG,
} from '@/hooks/useSiteConfig';
import { useAIGenerate } from '@/hooks/useAIGenerate';
import ColorPickerWithRecent from './ColorPickerWithRecent';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';

const KEY = 'welcome_island_config';

export default function WelcomeIslandEditor() {
  const { data: saved, isLoading } = useSiteConfig(KEY);
  const save = useSaveSiteConfig();
  const [config, setConfig] = useState<any>(null);
  const { generateContent, loading: aiLoading } = useAIGenerate();
  const [showAi, setShowAi] = useState(false);
  const [aiTone, setAiTone] = useState<'friendly' | 'professional' | 'funny' | 'islamic' | 'premium'>('friendly');
  const [aiHint, setAiHint] = useState('');
  const [onlyEmpty, setOnlyEmpty] = useState(false);

  if (config === null && !isLoading) {
    setConfig({ ...DEFAULT_WELCOME_ISLAND_CONFIG, ...(saved || {}),
      messages: (saved?.messages?.length ? saved.messages : DEFAULT_WELCOME_ISLAND_CONFIG.messages).slice(0, 10),
    });
  }

  if (isLoading || !config) {
    return <div className="flex items-center justify-center min-h-[200px]"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const update = (k: string, v: any) => setConfig((p: any) => ({ ...p, [k]: v }));
  const updateMsg = (i: number, v: string) => {
    const arr = [...config.messages];
    arr[i] = v;
    update('messages', arr);
  };

  const handleSave = async () => {
    try {
      await save.mutateAsync({ key: KEY, value: config });
      toast.success('সেভ হয়েছে! ওয়েলকাম আইল্যান্ড আপডেট হয়েছে।');
    } catch {
      toast.error('সেভ করতে সমস্যা হয়েছে');
    }
  };

  const reset = () => {
    setConfig({ ...DEFAULT_WELCOME_ISLAND_CONFIG });
    toast.info('ডিফল্টে রিসেট হয়েছে — সেভ করতে ভুলবেন না');
  };

  const toneLabel: Record<string, string> = {
    friendly: 'ফ্রেন্ডলি ও উষ্ণ',
    professional: 'প্রফেশনাল ও ভদ্র',
    funny: 'মজার ও হালকা মেজাজের',
    islamic: 'ইসলামিক টোন (সালাম, দোয়া)',
    premium: 'প্রিমিয়াম ও লাক্সারি ফিল',
  };

  const handleAIGenerate = async () => {
    const prompt = `তুমি একটা মহিলাদের ফ্যাশন ব্র্যান্ড "স্বর্ণ সুতা"-এর ওয়েবসাইটের জন্য একটা ছোট "ডায়নামিক আইল্যান্ড" নোটিফিকেশনে দেখানোর মতো ১০টি ছোট বাংলা মেসেজ লিখবে।

ব্র্যান্ড: স্বর্ণ সুতা (Shorno Suta) — মহিলাদের ওয়ান পিস, টু পিস, থ্রি পিস, বোরখা।
টোন: ${toneLabel[aiTone]}
${aiHint.trim() ? `বিশেষ নির্দেশনা: ${aiHint.trim()}` : ''}

গুরুত্বপূর্ণ প্রসঙ্গ:
- ওয়েবসাইটে শুরুতে অটো দেখানো হয়: "শুভ সকাল/দুপুর/..." → "আসসালামু আলাইকুম" → "কেমন আছেন?" — তাই এই ৩টি লাইন আবার লিখবে না।
- তোমার ১০টি মেসেজ হবে ওই অটো গ্রিটিং-এর পরের ফলোআপ লাইন।

নিয়ম:
- ঠিক ১০টি লাইন, প্রতিটি লাইন একটি আলাদা মেসেজ
- প্রতিটি মেসেজ সর্বোচ্চ ৬০ অক্ষরের মধ্যে
- প্রতিটি মেসেজে ১টি প্রাসঙ্গিক ইমোজি থাকবে (শুরুতে)
- ১ম মেসেজ: স্বর্ণ সুতা-এ স্বাগতম
- এরপরের মেসেজগুলো: কালেকশন, কোয়ালিটি, ক্যাশ অন ডেলিভারি, ফ্রি ডেলিভারি, রিটার্ন পলিসি, লাইভ চ্যাট, হ্যাপি শপিং ইত্যাদি বিষয়
- সালাম, "শুভ সকাল/দুপুর", "কেমন আছেন?" — এগুলো লিখবে না (অটো হয়)
- শুধু মেসেজ লেখো — কোনো নাম্বারিং, বুলেট, কোট, বা ব্যাখ্যা লিখো না
- প্রতিটি মেসেজ আলাদা লাইনে`;

    const result = await generateContent('general', prompt);
    if (!result) return;

    const lines = result
      .split('\n')
      .map(l => l.replace(/^[\s\-•*\d.)\]]+/, '').replace(/^["'`]|["'`]$/g, '').trim())
      .filter(Boolean)
      .slice(0, 10);

    if (lines.length === 0) {
      toast.error('AI থেকে কোনো মেসেজ পাওয়া যায়নি');
      return;
    }

    const next = [...config.messages];
    for (let i = 0; i < 10; i++) {
      const newLine = lines[i];
      if (!newLine) continue;
      if (onlyEmpty && (next[i] || '').trim()) continue;
      next[i] = newLine;
    }
    update('messages', next);
    toast.success('AI মেসেজ বসানো হয়েছে — সেভ করতে ভুলবেন না');
  };


  const previewMsg = config.use_time_based_greeting
    ? '🌞 শুভ সকাল!'
    : (config.messages[0] || 'প্রিভিউ মেসেজ');

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Live preview */}
      <Card className="p-6 bg-muted/40">
        <Label className="text-xs text-muted-foreground mb-3 block">লাইভ প্রিভিউ</Label>
        <div className="flex justify-center">
          <div
            className="flex items-center gap-2.5 px-4 py-2.5 pr-2 rounded-full shadow-2xl border border-white/20 max-w-full"
            style={{
              background: `linear-gradient(135deg, ${config.gradient_from} 0%, ${config.gradient_via} 50%, ${config.gradient_to} 100%)`,
              color: config.text_color,
              boxShadow: `0 10px 30px -8px ${config.gradient_from}88`,
            }}
          >
            <Sparkles className="h-4 w-4 shrink-0 animate-pulse" style={{ color: config.icon_color }} />
            <span className="text-sm font-medium leading-snug truncate">{previewMsg}</span>
            <span className="ml-1 shrink-0 h-6 w-6 inline-flex items-center justify-center rounded-full hover:bg-white/15">
              <X className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      </Card>

      {/* Behavior */}
      <Card className="p-5 space-y-4">
        <h3 className="font-bold">⚙️ বিহেভিয়ার</h3>
        <div className="flex items-center justify-between">
          <div>
            <Label>চালু রাখুন</Label>
            <p className="text-xs text-muted-foreground">ওয়েলকাম আইল্যান্ড সাইটে দেখাবে কিনা</p>
          </div>
          <Switch checked={config.enabled} onCheckedChange={(v) => update('enabled', v)} />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <Label>প্রতি সেশনে একবার দেখান</Label>
            <p className="text-xs text-muted-foreground">বন্ধ থাকলে প্রতিবার পেজ লোডে আবার দেখাবে</p>
          </div>
          <Switch checked={config.show_once_per_session} onCheckedChange={(v) => update('show_once_per_session', v)} />
        </div>
        <div className="flex items-center justify-between">
          <div className="pr-3">
            <Label>স্মার্ট গ্রিটিং (অটো শুরু)</Label>
            <p className="text-xs text-muted-foreground">চালু থাকলে শুরুতে অটো যোগ হবে: শুভ সকাল/দুপুর/বিকাল/সন্ধ্যা/রাত → 🤲 আসসালামু আলাইকুম → 😊 কেমন আছেন? — তারপর নিচের মেসেজগুলো</p>
          </div>
          <Switch checked={config.use_time_based_greeting} onCheckedChange={(v) => update('use_time_based_greeting', v)} />
        </div>
        <div>
          <Label>প্রতি মেসেজের সময়কাল (মিলিসেকেন্ড)</Label>
          <Input
            type="number"
            min={1500}
            max={15000}
            step={500}
            value={config.message_duration_ms}
            onChange={(e) => update('message_duration_ms', Math.max(1500, Number(e.target.value) || 4500))}
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">প্রস্তাবিত: ৪০০০-৫০০০ ms</p>
        </div>
      </Card>

      {/* Colors */}
      <Card className="p-5 space-y-4">
        <h3 className="font-bold">🎨 রঙ ও গ্রেডিয়েন্ট</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label>গ্রেডিয়েন্ট — শুরু</Label>
            <ColorPickerWithRecent value={config.gradient_from} onChange={(v) => update('gradient_from', v)} />
          </div>
          <div>
            <Label>গ্রেডিয়েন্ট — মাঝ</Label>
            <ColorPickerWithRecent value={config.gradient_via} onChange={(v) => update('gradient_via', v)} />
          </div>
          <div>
            <Label>গ্রেডিয়েন্ট — শেষ</Label>
            <ColorPickerWithRecent value={config.gradient_to} onChange={(v) => update('gradient_to', v)} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>টেক্সট কালার</Label>
            <ColorPickerWithRecent value={config.text_color} onChange={(v) => update('text_color', v)} />
          </div>
          <div>
            <Label>আইকন কালার (✨)</Label>
            <ColorPickerWithRecent value={config.icon_color} onChange={(v) => update('icon_color', v)} />
          </div>
        </div>
      </Card>

      {/* Messages */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="font-bold">💬 অতিরিক্ত মেসেজ (১০টি)</h3>
          <Button
            type="button"
            size="sm"
            variant={showAi ? 'secondary' : 'default'}
            onClick={() => setShowAi(s => !s)}
            className="gap-1.5"
          >
            <Wand2 className="h-3.5 w-3.5" />
            {showAi ? 'AI প্যানেল বন্ধ' : '✨ AI দিয়ে লিখুন'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {config.use_time_based_greeting
            ? 'স্মার্ট গ্রিটিং চালু — শুরুতে অটো দেখাবে: শুভ সকাল/দুপুর... → আসসালামু আলাইকুম → কেমন আছেন? তারপর নিচের মেসেজগুলো ক্রমান্বয়ে।'
            : 'খালি রাখলে ওই মেসেজ স্কিপ হবে। ইমোজি ব্যবহার করতে পারেন।'}
        </p>

        {showAi && (
          <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
            <div>
              <Label className="text-xs">টোন</Label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {(['friendly','professional','funny','islamic','premium'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setAiTone(t)}
                    className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                      aiTone === t ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'
                    }`}
                  >
                    {toneLabel[t]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs">বিশেষ নির্দেশনা (অপশনাল)</Label>
              <Textarea
                value={aiHint}
                onChange={(e) => setAiHint(e.target.value)}
                placeholder='যেমন: "ঈদ অফার হাইলাইট কর", "শীতের কালেকশন", "নতুন কাস্টমারদের ১০% ছাড়"'
                rows={2}
                className="mt-1 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="onlyEmpty"
                checked={onlyEmpty}
                onCheckedChange={(v) => setOnlyEmpty(!!v)}
              />
              <Label htmlFor="onlyEmpty" className="text-xs cursor-pointer">শুধু খালি ফিল্ডগুলো ভরবে (পুরাতন মেসেজ থাকলে রাখবে)</Label>
            </div>
            <Button
              type="button"
              onClick={handleAIGenerate}
              disabled={aiLoading}
              className="w-full gap-2"
              size="sm"
            >
              {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {aiLoading ? 'AI লিখছে...' : '১০টি মেসেজ জেনারেট করুন'}
            </Button>
          </div>
        )}

        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i}>
            <Label className="text-xs">মেসেজ {i + 1}</Label>
            <Input
              value={config.messages[i] || ''}
              onChange={(e) => updateMsg(i, e.target.value)}
              placeholder={DEFAULT_WELCOME_ISLAND_CONFIG.messages[i] || 'খালি রাখলে স্কিপ হবে'}
              className="mt-1"
            />
          </div>
        ))}
      </Card>

      <div className="flex gap-2 sticky bottom-0 bg-background py-3 border-t">
        <Button variant="outline" onClick={reset} className="gap-2">
          <RotateCcw className="h-4 w-4" /> ডিফল্টে রিসেট
        </Button>
        <Button onClick={handleSave} disabled={save.isPending} className="gap-2 flex-1">
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          সেভ করুন
        </Button>
      </div>
    </div>
  );
}
