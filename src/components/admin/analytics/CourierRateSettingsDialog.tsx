import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CourierRateMatrix, ProviderRate } from '@/lib/courierFinance';
import { useCourierRateMatrix } from '@/hooks/useCourierRateMatrix';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';

interface Props { open: boolean; onOpenChange: (v: boolean) => void; }

const FIELDS: { key: keyof ProviderRate; label: string }[] = [
  { key: 'dhaka_inside', label: 'ঢাকা সিটি' },
  { key: 'dhaka_suburb', label: 'ঢাকা সাব এরিয়া' },
  { key: 'dhaka_outside', label: 'ঢাকার বাইরে' },
  { key: 'partial', label: 'পার্শিয়াল চার্জ' },
  { key: 'failed', label: 'ফেইলড চার্জ' },
];

export default function CourierRateSettingsDialog({ open, onOpenChange }: Props) {
  const { matrix, save } = useCourierRateMatrix();
  const [draft, setDraft] = useState<CourierRateMatrix>(matrix);
  const [newProvider, setNewProvider] = useState('');

  useEffect(() => { if (open) setDraft(matrix); }, [open, matrix]);

  const update = (provider: string, field: keyof ProviderRate, val: string) => {
    setDraft(d => ({ ...d, [provider]: { ...d[provider], [field]: Number(val) || 0 } }));
  };
  const addProvider = () => {
    const k = newProvider.trim().toLowerCase();
    if (!k || draft[k]) return;
    setDraft(d => ({ ...d, [k]: { dhaka_inside: 60, dhaka_suburb: 80, dhaka_outside: 110, failed: 30, partial: 60 } }));
    setNewProvider('');
  };
  const removeProvider = (p: string) => {
    setDraft(d => { const n = { ...d }; delete n[p]; return n; });
  };

  const onSave = async () => {
    try {
      await save.mutateAsync(draft);
      toast.success('কুরিয়ার রেট আপডেট হয়েছে');
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'সেভ করতে সমস্যা হয়েছে');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>কুরিয়ার রেট সেটিংস</DialogTitle>
          <p className="text-xs text-muted-foreground">প্রতি কুরিয়ার ও এরিয়া অনুযায়ী আমাদের কাছ থেকে কত চার্জ কাটে</p>
        </DialogHeader>

        <div className="space-y-4">
          {Object.entries(draft).map(([provider, rate]) => (
            <div key={provider} className="border rounded-xl p-4 space-y-3 bg-card">
              <div className="flex items-center justify-between">
                <div className="font-semibold capitalize">{provider}</div>
                <Button variant="ghost" size="icon" onClick={() => removeProvider(provider)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {FIELDS.map(f => (
                  <div key={f.key} className="space-y-1">
                    <Label className="text-xs">{f.label}</Label>
                    <Input
                      type="number"
                      value={(rate as any)[f.key]}
                      onChange={e => update(provider, f.key, e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="flex gap-2 items-end pt-2">
            <div className="flex-1">
              <Label className="text-xs">নতুন কুরিয়ার যোগ করুন</Label>
              <Input
                placeholder="যেমন: paperfly"
                value={newProvider}
                onChange={e => setNewProvider(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <Button onClick={addProvider} variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" /> যোগ করুন
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>বাতিল</Button>
          <Button onClick={onSave} disabled={save.isPending}>সেভ করুন</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
