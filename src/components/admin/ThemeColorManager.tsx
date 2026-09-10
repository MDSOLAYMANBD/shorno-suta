import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Save, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import ColorPickerWithRecent from './ColorPickerWithRecent';
import { DEFAULT_THEME, type ThemeConfig } from '@/hooks/useThemeConfig';

interface ColorField {
  key: keyof ThemeConfig;
  label: string;
}

interface ColorGroup {
  title: string;
  emoji: string;
  fields: ColorField[];
}

const COLOR_GROUPS: ColorGroup[] = [
  {
    title: 'প্রাইমারি',
    emoji: '🟢',
    fields: [
      { key: 'primary', label: 'Primary Color' },
      { key: 'primary_foreground', label: 'Primary Text' },
    ],
  },
  {
    title: 'সেকেন্ডারি',
    emoji: '🔵',
    fields: [
      { key: 'secondary', label: 'Secondary Color' },
      { key: 'secondary_foreground', label: 'Secondary Text' },
    ],
  },
  {
    title: 'অ্যাকসেন্ট',
    emoji: '🟣',
    fields: [
      { key: 'accent', label: 'Accent Color' },
      { key: 'accent_foreground', label: 'Accent Text' },
    ],
  },
  {
    title: 'ব্যাকগ্রাউন্ড',
    emoji: '⬜',
    fields: [
      { key: 'background', label: 'Background' },
      { key: 'foreground', label: 'Text Color' },
    ],
  },
  {
    title: 'কার্ড',
    emoji: '🃏',
    fields: [
      { key: 'card', label: 'Card Background' },
      { key: 'card_foreground', label: 'Card Text' },
    ],
  },
  {
    title: 'মিউটেড',
    emoji: '🩶',
    fields: [
      { key: 'muted', label: 'Muted Background' },
      { key: 'muted_foreground', label: 'Muted Text' },
    ],
  },
  {
    title: 'বর্ডার ও ইনপুট',
    emoji: '🔲',
    fields: [
      { key: 'border', label: 'Border' },
      { key: 'input', label: 'Input Border' },
      { key: 'ring', label: 'Focus Ring' },
    ],
  },
];

export default function ThemeColorManager() {
  const qc = useQueryClient();
  const [config, setConfig] = useState<ThemeConfig>({ ...DEFAULT_THEME });
  const [saving, setSaving] = useState(false);

  const { data: savedConfig } = useQuery({
    queryKey: ['theme-config'],
    queryFn: async () => {
      const { data } = await supabase
        .from('store_settings')
        .select('value')
        .eq('key', 'theme_config')
        .maybeSingle();
      if (data?.value) {
        try { return { ...DEFAULT_THEME, ...JSON.parse(data.value) } as ThemeConfig; }
        catch { return DEFAULT_THEME; }
      }
      return DEFAULT_THEME;
    },
  });

  useEffect(() => {
    if (savedConfig) setConfig(savedConfig);
  }, [savedConfig]);

  const handleChange = (key: keyof ThemeConfig, value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const jsonVal = JSON.stringify(config);
      const { data: existing } = await supabase.from('store_settings').select('id').eq('key', 'theme_config').single();
      if (existing) {
        await supabase.from('store_settings').update({ value: jsonVal }).eq('key', 'theme_config');
      } else {
        await supabase.from('store_settings').insert({ key: 'theme_config', value: jsonVal });
      }
      qc.invalidateQueries({ queryKey: ['theme-config'] });
      toast.success('থিম কালার সেভ হয়েছে! পেজ রিলোড করলে সব জায়গায় প্রয়োগ হবে।');
    } catch {
      toast.error('সেভ করতে সমস্যা হয়েছে');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setConfig({ ...DEFAULT_THEME });
    toast.info('ডিফল্ট কালারে রিসেট হয়েছে। সেভ করতে ভুলবেন না।');
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        এখান থেকে পুরো ওয়েবসাইটের রং পরিবর্তন করুন। সেভ করলে সাইটে তৎক্ষণাৎ প্রয়োগ হবে।
      </p>

      <div className="grid gap-4">
        {COLOR_GROUPS.map((group) => (
          <div key={group.title} className="border rounded-lg p-4 space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <span>{group.emoji}</span>
              {group.title}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {group.fields.map((field) => (
                <div key={field.key} className="space-y-1">
                  <Label className="text-xs">{field.label}</Label>
                  <ColorPickerWithRecent
                    value={config[field.key]}
                    onChange={(c) => handleChange(field.key, c)}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 pt-2">
        <Button onClick={handleSave} disabled={saving} className="flex-1">
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'সেভ হচ্ছে...' : 'থিম সেভ করুন'}
        </Button>
        <Button variant="outline" onClick={handleReset}>
          <RotateCcw className="h-4 w-4 mr-2" />
          রিসেট
        </Button>
      </div>
    </div>
  );
}
