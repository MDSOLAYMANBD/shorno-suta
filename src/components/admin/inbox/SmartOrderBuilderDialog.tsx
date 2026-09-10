import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ChevronLeft, ChevronRight, ShoppingBag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conversationId: string | null;
  defaultName?: string;
  defaultPhone?: string;
  defaultPrice?: number | null;
}

const STEPS = ['Product', 'Customer', 'Address', 'Review'] as const;

export default function SmartOrderBuilderDialog({ open, onOpenChange, conversationId, defaultName, defaultPhone, defaultPrice }: Props) {
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [productName, setProductName] = useState('Manual Inbox Order');
  const [price, setPrice] = useState<string>('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(0);
      setName(defaultName || '');
      setPhone(defaultPhone || '');
      setPrice(defaultPrice ? String(defaultPrice) : '');
      setAddress('');
      setProductName('Manual Inbox Order');
    }
  }, [open, defaultName, defaultPhone, defaultPrice]);

  const canNext =
    (step === 0 && productName.trim() && Number(price) > 0) ||
    (step === 1 && name.trim() && phone.trim().length >= 10) ||
    (step === 2 && address.trim().length >= 5) ||
    step === 3;

  const submit = async () => {
    if (!conversationId) return;
    setSubmitting(true);
    try {
      const total = Number(price);
      const { data: order, error } = await supabase
        .from('orders')
        .insert({
          customer_name: name.trim(),
          customer_phone: phone.trim(),
          customer_address: address.trim(),
          subtotal: total,
          total: total,
          status: 'pending',
          source: 'inbox-smart-builder',
        } as any)
        .select('id, order_number')
        .single();
      if (error) throw error;

      // Add a single order item
      await supabase.from('order_items').insert({
        order_id: (order as any).id,
        product_name: productName.trim(),
        price: total,
        quantity: 1,
      } as any);

      // Link via system message
      await supabase.from('inbox_messages' as any).insert({
        conversation_id: conversationId,
        sender_type: 'system',
        sender_name: '🛒 Order Builder',
        message: `অর্ডার তৈরি হয়েছে: ${(order as any).order_number} — ৳${total}`,
        metadata: { type: 'order_created', order_id: (order as any).id },
      } as any);

      toast.success('অর্ডার তৈরি হয়েছে: ' + (order as any).order_number);
      qc.invalidateQueries({ queryKey: ['inbox-messages', conversationId] });
      qc.invalidateQueries({ queryKey: ['inbox-customer-orders'] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error('অর্ডার তৈরি ব্যর্থ: ' + (e?.message || 'unknown'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4" /> Smart Order Builder
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex gap-1">
          {STEPS.map((s, i) => (
            <div key={s} className={`flex-1 h-1 rounded ${i <= step ? 'bg-primary' : 'bg-muted'}`} />
          ))}
        </div>
        <p className="text-xs text-muted-foreground -mt-2">
          Step {step + 1} of {STEPS.length}: <span className="font-medium">{STEPS[step]}</span>
        </p>

        <div className="space-y-3 min-h-[180px]">
          {step === 0 && (
            <>
              <div>
                <Label className="text-xs">প্রোডাক্ট নাম</Label>
                <Input value={productName} onChange={e => setProductName(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">দাম (৳)</Label>
                <Input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="850" />
              </div>
            </>
          )}
          {step === 1 && (
            <>
              <div>
                <Label className="text-xs">কাস্টমারের নাম</Label>
                <Input value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">ফোন</Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="01XXXXXXXXX" />
              </div>
            </>
          )}
          {step === 2 && (
            <div>
              <Label className="text-xs">ঠিকানা</Label>
              <Textarea value={address} onChange={e => setAddress(e.target.value)} className="h-24" placeholder="পূর্ণ ঠিকানা..." />
            </div>
          )}
          {step === 3 && (
            <div className="text-xs space-y-1 border rounded p-3 bg-muted/30">
              <p><b>প্রোডাক্ট:</b> {productName} — ৳{price}</p>
              <p><b>নাম:</b> {name}</p>
              <p><b>ফোন:</b> {phone}</p>
              <p><b>ঠিকানা:</b> {address}</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex !justify-between">
          <Button variant="outline" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}>
            <ChevronLeft className="h-4 w-4" /> Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep(s => s + 1)} disabled={!canNext}>
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={submit} disabled={submitting}>
              অর্ডার তৈরি করুন
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
