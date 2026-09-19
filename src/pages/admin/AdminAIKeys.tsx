import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, ExternalLink, KeyRound, Sparkles, ImageIcon, Save, FlaskConical, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useAllSettings } from '@/hooks/useAllSettings';
import { useUpdateSetting } from '@/hooks/useStoreSettings';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const GEMINI_MODELS = [
  { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash Preview ⭐ নতুন (Recommended)' },
  { value: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite (সবচেয়ে সাশ্রয়ী)' },
  { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash (দ্রুত + উন্নত)' },
  { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro Preview (সেরা রিজনিং)' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (উন্নত মান)' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (স্থিতিশীল)' },
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite (সাশ্রয়ী)' },
  { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (লেগ্যাসি)' },
  { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (লেগ্যাসি)' },
];

export default function AdminAIKeys() {
  const { data: settings, isLoading } = useAllSettings();
  const updateSetting = useUpdateSetting();

  const [geminiKey, setGeminiKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [geminiModel, setGeminiModel] = useState('gemini-2.5-flash');
  const [showGemini, setShowGemini] = useState(false);
  const [showOpenAI, setShowOpenAI] = useState(false);
  const [savingGemini, setSavingGemini] = useState(false);
  const [savingOpenAI, setSavingOpenAI] = useState(false);
  const [testingGemini, setTestingGemini] = useState(false);
  const [testingOpenAI, setTestingOpenAI] = useState(false);

  useEffect(() => {
    if (settings) {
      setGeminiKey(settings.gemini_api_key || '');
      setOpenaiKey(settings.openai_api_key || '');
      setGeminiModel(settings.gemini_model || 'gemini-2.5-flash');
    }
  }, [settings]);

  const mask = (v: string) => (v && v.length > 8 ? `${v.slice(0, 4)}••••••••${v.slice(-4)}` : v || '');

  const saveGemini = async () => {
    setSavingGemini(true);
    try {
      await updateSetting.mutateAsync({ key: 'gemini_api_key', value: geminiKey.trim() });
      await updateSetting.mutateAsync({ key: 'gemini_model', value: geminiModel });
      toast.success('Gemini সেটিংস সংরক্ষিত হয়েছে');
    } catch (e: any) {
      toast.error(e.message || 'সংরক্ষণে সমস্যা হয়েছে');
    } finally {
      setSavingGemini(false);
    }
  };

  const saveOpenAI = async () => {
    setSavingOpenAI(true);
    try {
      await updateSetting.mutateAsync({ key: 'openai_api_key', value: openaiKey.trim() });
      toast.success('OpenAI কী সংরক্ষিত হয়েছে');
    } catch (e: any) {
      toast.error(e.message || 'সংরক্ষণে সমস্যা হয়েছে');
    } finally {
      setSavingOpenAI(false);
    }
  };

  const testGemini = async () => {
    setTestingGemini(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-generate', {
        body: { type: 'general', prompt: 'বলো "টেস্ট সফল"' },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      if (data?.content) toast.success(`✅ Gemini কাজ করছে: ${String(data.content).slice(0, 80)}`);
      else throw new Error('কোনো রেসপন্স পাওয়া যায়নি');
    } catch (e: any) {
      toast.error(`❌ ${e.message || 'টেস্ট ব্যর্থ'}`);
    } finally {
      setTestingGemini(false);
    }
  };

  const testOpenAI = async () => {
    setTestingOpenAI(true);
    try {
      // Validate key format quickly without burning credits — call OpenAI's models endpoint
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${openaiKey.trim()}` },
      });
      if (res.status === 401) throw new Error('OpenAI API key অবৈধ');
      if (!res.ok) throw new Error(`OpenAI: ${res.status}`);
      toast.success('✅ OpenAI কী কাজ করছে');
    } catch (e: any) {
      toast.error(`❌ ${e.message || 'টেস্ট ব্যর্থ'}`);
    } finally {
      setTestingOpenAI(false);
    }
  };

  const StatusBadge = ({ ok }: { ok: boolean }) =>
    ok ? (
      <Badge variant="default" className="gap-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
        <CheckCircle2 className="h-3 w-3" /> কনফিগার করা
      </Badge>
    ) : (
      <Badge variant="outline" className="gap-1 border-amber-300 text-amber-700">
        <AlertTriangle className="h-3 w-3" /> সেট করা নেই
      </Badge>
    );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <KeyRound className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">AI API Keys</h1>
            <p className="text-sm text-muted-foreground">
            Gemini ও OpenAI — দুটো API কী এখান থেকে ম্যানেজ করুন। Gemini প্রধান, কোনো কারণে ব্যর্থ হলে (রেট লিমিট, ইনভ্যালিড কী ইত্যাদি) স্বয়ংক্রিয়ভাবে OpenAI ব্যবহার হবে।
          </p>
        </div>
      </div>

      {/* Gemini Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-500" />
                Google Gemini (টেক্সট + ছবি জেনারেশন)
              </CardTitle>
              <CardDescription className="mt-1">
                Caption, SEO, প্রোডাক্ট ডেসক্রিপশন এবং AI ব্যানার ছবির জন্য ব্যবহৃত হয়।
              </CardDescription>
            </div>
            <StatusBadge ok={!!geminiKey} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="gemini_key">Gemini API Key</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="gemini_key"
                  type={showGemini ? 'text' : 'password'}
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="pr-10 font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowGemini((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showGemini ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {geminiKey && !showGemini && (
              <p className="text-xs text-muted-foreground font-mono">বর্তমান: {mask(geminiKey)}</p>
            )}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary inline-flex items-center gap-1 hover:underline"
            >
              Google AI Studio থেকে কী নিন <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="space-y-2">
            <Label htmlFor="gemini_model">Gemini Model</Label>
            <Select value={geminiModel} onValueChange={setGeminiModel}>
              <SelectTrigger id="gemini_model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GEMINI_MODELS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={saveGemini} disabled={savingGemini} className="gap-2">
              {savingGemini ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              সংরক্ষণ করুন
            </Button>
            <Button
              variant="outline"
              onClick={testGemini}
              disabled={testingGemini || !geminiKey}
              className="gap-2"
            >
              {testingGemini ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
              Test Key
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* OpenAI Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-emerald-600" />
                OpenAI (স্বয়ংক্রিয় ফলব্যাক)
              </CardTitle>
              <CardDescription className="mt-1">
                Gemini ব্যর্থ হলে (SEO, ক্যাপশন, ল্যান্ডিং পেজ, AI ব্যানার — সব ফিচারে) স্বয়ংক্রিয়ভাবে এই কী দিয়ে GPT-4o-mini ও DALL-E 3 ব্যবহার হবে।
              </CardDescription>
            </div>
            <StatusBadge ok={!!openaiKey} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="openai_key">OpenAI API Key</Label>
            <div className="relative">
              <Input
                id="openai_key"
                type={showOpenAI ? 'text' : 'password'}
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder="sk-..."
                className="pr-10 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowOpenAI((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showOpenAI ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {openaiKey && !showOpenAI && (
              <p className="text-xs text-muted-foreground font-mono">বর্তমান: {mask(openaiKey)}</p>
            )}
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary inline-flex items-center gap-1 hover:underline"
            >
              OpenAI প্ল্যাটফর্ম থেকে কী নিন <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={saveOpenAI} disabled={savingOpenAI} className="gap-2">
              {savingOpenAI ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              সংরক্ষণ করুন
            </Button>
            <Button
              variant="outline"
              onClick={testOpenAI}
              disabled={testingOpenAI || !openaiKey}
              className="gap-2"
            >
              {testingOpenAI ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
              Test Key
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground p-4 rounded-lg border bg-muted/30">
        💡 <strong>নিরাপত্তা:</strong> এই কীগুলো শুধুমাত্র অ্যাডমিনদের জন্য দৃশ্যমান এবং Edge Function থেকে server-side ব্যবহৃত হয়।
        ফ্রন্টএন্ডে কখনো expose করা হয় না।
      </div>
    </div>
  );
}
