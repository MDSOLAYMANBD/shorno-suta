import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Sliders, Save } from 'lucide-react';
import {
  DEFAULT_THRESHOLDS, getThresholds, saveThresholds, type AudienceThresholds,
} from '@/lib/audience/thresholds';
import { useQueryClient } from '@tanstack/react-query';

export default function ThresholdsCard() {
  const qc = useQueryClient();
  const [t, setT] = useState<AudienceThresholds>(DEFAULT_THRESHOLDS);
  const [saving, setSaving] = useState(false);
  useEffect(() => { getThresholds().then(setT); }, []);

  const save = async () => {
    setSaving(true);
    try {
      await saveThresholds(t);
      qc.invalidateQueries({ queryKey: ['audience'] });
      toast.success('থ্রেশহোল্ড সেভ হয়েছে');
    } catch (e: any) { toast.error(e?.message || 'সেভ হয়নি'); }
    finally { setSaving(false); }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sliders className="h-4 w-4" /> থ্রেশহোল্ড কনফিগ
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {(['highSpend','lowSpend','wholesale','retail'] as const).map((k) => (
          <div key={k} className="grid grid-cols-3 items-center gap-2">
            <Label className="text-xs col-span-1">{k}</Label>
            <Input type="number" value={t[k]} className="h-8 text-xs col-span-2"
              onChange={(e) => setT({ ...t, [k]: Number(e.target.value) })} />
          </div>
        ))}
        <Button onClick={save} disabled={saving} size="sm" className="w-full">
          <Save className="h-3.5 w-3.5 mr-1" /> সেভ
        </Button>
      </CardContent>
    </Card>
  );
}
