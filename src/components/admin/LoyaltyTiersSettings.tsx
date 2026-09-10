import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Plus, Trash2, RotateCcw, Save, Crown } from 'lucide-react';
import { toast } from 'sonner';
import { useStoreSettings, useUpdateSetting } from '@/hooks/useStoreSettings';
import {
  DEFAULT_LOYALTY_TIERS,
  parseLoyaltyTiers,
  getLoyaltyTier,
  COLOR_PRESETS,
  type LoyaltyTierConfig,
} from '@/lib/customerLoyalty';

const COLOR_OPTIONS = Object.keys(COLOR_PRESETS);

export default function LoyaltyTiersSettings() {
  const { data: settings } = useStoreSettings();
  const updateSetting = useUpdateSetting();
  const [tiers, setTiers] = useState<LoyaltyTierConfig[]>(DEFAULT_LOYALTY_TIERS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTiers(parseLoyaltyTiers(settings?.loyalty_tiers));
  }, [settings?.loyalty_tiers]);

  const update = (idx: number, patch: Partial<LoyaltyTierConfig>) => {
    setTiers(prev => prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  };

  const addTier = () => {
    if (tiers.length >= 5) return;
    setTiers(prev => [
      ...prev,
      { key: `tier_${Date.now()}`, label: 'নতুন টিয়ার', shortLabel: 'নতুন', emoji: '🎖️', minDelivered: 20, color: 'green' },
    ]);
  };

  const removeTier = (idx: number) => {
    setTiers(prev => prev.filter((_, i) => i !== idx));
  };

  const reset = () => setTiers(DEFAULT_LOYALTY_TIERS);

  const save = async () => {
    setSaving(true);
    try {
      const sorted = tiers
        .map(t => ({ ...t, minDelivered: Math.max(1, Number(t.minDelivered) || 1) }))
        .sort((a, b) => a.minDelivered - b.minDelivered);
      await updateSetting.mutateAsync({ key: 'loyalty_tiers', value: JSON.stringify(sorted) });
      toast.success('লয়্যালটি টিয়ার সেভ হয়েছে');
    } catch {
      toast.error('সেভ করতে সমস্যা হয়েছে');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Collapsible>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center justify-between border rounded-xl px-4 py-3 hover:bg-accent/50 transition cursor-pointer">
          <div className="flex items-center gap-3">
            <Crown className="h-5 w-5 text-purple-600" />
            <span className="font-medium">কাস্টমার লয়্যালটি ব্যাজ</span>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Card className="mt-2 border-0 shadow-none">
          <CardContent className="space-y-4 pt-4">
            <p className="text-xs text-muted-foreground">
              কতোগুলো ডেলিভারড অর্ডারে কাস্টমার কোন ব্যাজ পাবে তা এখানে কনফিগার করুন। কম থেকে বেশি ক্রমে সাজানো হবে।
            </p>

            <div className="space-y-3">
              {tiers.map((tier, idx) => {
                const preview = getLoyaltyTier(tier.minDelivered, tiers);
                return (
                  <div key={idx} className="border rounded-lg p-3 grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-card">
                    <div className="md:col-span-2">
                      <Label className="text-xs">ইমোজি</Label>
                      <Input
                        value={tier.emoji}
                        onChange={e => update(idx, { emoji: e.target.value })}
                        maxLength={4}
                        className="text-center text-lg"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <Label className="text-xs">লেবেল</Label>
                      <Input value={tier.label} onChange={e => update(idx, { label: e.target.value })} />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-xs">ছোট লেবেল</Label>
                      <Input value={tier.shortLabel} onChange={e => update(idx, { shortLabel: e.target.value })} />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-xs">মিন. ডেলিভারি</Label>
                      <Input
                        type="number"
                        min={1}
                        value={tier.minDelivered}
                        onChange={e => update(idx, { minDelivered: Number(e.target.value) })}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-xs">রঙ</Label>
                      <select
                        value={tier.color}
                        onChange={e => update(idx, { color: e.target.value })}
                        className="w-full h-9 px-2 rounded-md border bg-background text-sm capitalize"
                      >
                        {COLOR_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="md:col-span-1 flex items-end justify-between gap-1">
                      <Badge variant="outline" className={`${preview.className} text-xs whitespace-nowrap`}>
                        {preview.emoji} {preview.shortLabel}
                      </Badge>
                      <Button size="icon" variant="ghost" onClick={() => removeTier(idx)} title="মুছুন">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={addTier} disabled={tiers.length >= 5}>
                <Plus className="h-4 w-4 mr-1" /> নতুন টিয়ার ({tiers.length}/5)
              </Button>
              <Button variant="ghost" size="sm" onClick={reset}>
                <RotateCcw className="h-4 w-4 mr-1" /> ডিফল্টে রিসেট
              </Button>
              <div className="flex-1" />
              <Button size="sm" onClick={save} disabled={saving}>
                <Save className="h-4 w-4 mr-1" /> সেভ করুন
              </Button>
            </div>

            {/* Live preview */}
            <div className="border rounded-lg p-3 bg-muted/30">
              <p className="text-xs font-medium mb-2 text-muted-foreground">প্রিভিউ — বিভিন্ন ডেলিভারি কাউন্টে</p>
              <div className="flex flex-wrap gap-3">
                {[0, 1, 2, 3, 5, 7, 10, 15, 25].map(n => {
                  const t = getLoyaltyTier(n, tiers);
                  return (
                    <div key={n} className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">{n}x:</span>
                      <Badge variant="outline" className={`${t.className} text-xs`}>
                        {t.emoji} {t.shortLabel}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
}
