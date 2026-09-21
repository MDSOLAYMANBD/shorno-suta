import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { OTHER_COURIERS } from '@/pages/admin/AdminCourierPanel';

interface ManualCourierEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  onSaved: () => void;
}

export default function ManualCourierEntryDialog({ open, onOpenChange, orderId, onSaved }: ManualCourierEntryDialogProps) {
  const [courierValue, setCourierValue] = useState('');
  const [customCourier, setCustomCourier] = useState('');
  const [parcelId, setParcelId] = useState('');
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setCourierValue('');
    setCustomCourier('');
    setParcelId('');
  };

  const handleSave = async () => {
    const courierName = courierValue === '__custom' ? customCourier.trim() : (OTHER_COURIERS.find(c => c.value === courierValue)?.label || '');
    if (!courierName) {
      toast.error('কুরিয়ারের নাম নির্বাচন করুন');
      return;
    }
    if (!parcelId.trim()) {
      toast.error('পার্সেল আইডি লিখুন');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('orders').update({
        courier_provider: 'manual',
        courier_consignment_id: parcelId.trim(),
        courier_manual_name: courierName,
        courier_status: null,
        courier_entry_date: new Date().toISOString(),
      } as any).eq('id', orderId);
      if (error) throw error;
      toast.success('ম্যানুয়াল কুরিয়ার এন্ট্রি সেভ হয়েছে');
      resetForm();
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast.error(e.message || 'সেভ করতে সমস্যা হয়েছে');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>ম্যানুয়াল কুরিয়ার এন্ট্রি</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">কুরিয়ার সার্ভিস</Label>
            <select
              className="w-full h-9 rounded-md border bg-background px-3 text-sm"
              value={courierValue}
              onChange={e => setCourierValue(e.target.value)}
            >
              <option value="">— নির্বাচন করুন —</option>
              {OTHER_COURIERS.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
              <option value="__custom">✏️ কাস্টম নাম লিখুন</option>
            </select>
          </div>
          {courierValue === '__custom' && (
            <div>
              <Label className="text-xs">কুরিয়ারের নাম</Label>
              <Input placeholder="যেমন: কুরিয়ারের নাম" value={customCourier} onChange={e => setCustomCourier(e.target.value)} />
            </div>
          )}
          <div>
            <Label className="text-xs">পার্সেল / ট্র্যাকিং আইডি</Label>
            <Input placeholder="পার্সেল আইডি লিখুন" value={parcelId} onChange={e => setParcelId(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>বাতিল</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'সেভ হচ্ছে...' : 'সেভ করুন'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
