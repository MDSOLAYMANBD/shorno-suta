import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Phone, PhoneOff, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conversationId: string | null;
  customerName: string;
  customerPhone: string;
}

type Stage = 'idle' | 'calling' | 'confirmed' | 'failed';

export default function CallSimulationModal({ open, onOpenChange, conversationId, customerName, customerPhone }: Props) {
  const [stage, setStage] = useState<Stage>('idle');
  const qc = useQueryClient();

  useEffect(() => {
    if (!open) setStage('idle');
  }, [open]);

  const startCall = async () => {
    if (!conversationId) return;
    setStage('calling');
    await new Promise(r => setTimeout(r, 3000));
    const outcome: 'confirmed' | 'failed' = Math.random() > 0.35 ? 'confirmed' : 'failed';
    setStage(outcome);

    try {
      // Insert call history
      const { data: { user } } = await supabase.auth.getUser();
      let linkedOrderId: string | null = null;

      if (outcome === 'confirmed') {
        // Auto-confirm pending detected order if exists
        const { data: pending } = await supabase
          .from('inbox_detected_orders' as any)
          .select('*')
          .eq('conversation_id', conversationId)
          .eq('status', 'pending')
          .maybeSingle();
        if (pending) {
          await supabase
            .from('inbox_detected_orders' as any)
            .update({ status: 'confirmed' } as any)
            .eq('id', (pending as any).id);
          linkedOrderId = (pending as any).order_id || null;
        }
      }

      await supabase.from('inbox_simulated_calls' as any).insert({
        conversation_id: conversationId,
        customer_phone: customerPhone || '',
        outcome,
        linked_order_id: linkedOrderId,
        created_by: user?.id || null,
      } as any);

      // System message into chat
      const msg = outcome === 'confirmed'
        ? '✅ অর্ডার কলের মাধ্যমে কনফার্ম হয়েছে'
        : '❌ কল সংযোগ ব্যর্থ হয়েছে — আবার চেষ্টা করুন';

      await supabase.from('inbox_messages' as any).insert({
        conversation_id: conversationId,
        sender_type: 'system',
        sender_name: '📞 Call',
        message: msg,
        metadata: { type: 'call_simulation', outcome },
      } as any);

      qc.invalidateQueries({ queryKey: ['inbox-messages', conversationId] });
      qc.invalidateQueries({ queryKey: ['inbox-detected-order', conversationId] });
      qc.invalidateQueries({ queryKey: ['inbox-sim-calls', conversationId] });
    } catch (e: any) {
      toast.error('Call log save failed: ' + (e?.message || 'unknown'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>📞 Call Customer</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center py-4 gap-3">
          <div className={cn(
            'w-20 h-20 rounded-full flex items-center justify-center transition-colors',
            stage === 'idle' && 'bg-muted',
            stage === 'calling' && 'bg-emerald-100 animate-pulse',
            stage === 'confirmed' && 'bg-emerald-500',
            stage === 'failed' && 'bg-destructive/20',
          )}>
            {stage === 'idle' && <Phone className="h-8 w-8 text-muted-foreground" />}
            {stage === 'calling' && <Loader2 className="h-8 w-8 text-emerald-600 animate-spin" />}
            {stage === 'confirmed' && <CheckCircle2 className="h-8 w-8 text-white" />}
            {stage === 'failed' && <XCircle className="h-8 w-8 text-destructive" />}
          </div>
          <div className="text-center">
            <p className="font-semibold">{customerName || 'Customer'}</p>
            <p className="text-xs text-muted-foreground">{customerPhone || 'No phone'}</p>
          </div>
          <div className="text-sm font-medium">
            {stage === 'idle' && <span className="text-muted-foreground">Ready to call</span>}
            {stage === 'calling' && <span className="text-emerald-600">Calling...</span>}
            {stage === 'confirmed' && <span className="text-emerald-600">✅ Order Confirmed</span>}
            {stage === 'failed' && <span className="text-destructive">❌ Call Failed</span>}
          </div>
          <div className="flex gap-2 mt-2">
            {stage === 'idle' && (
              <Button onClick={startCall} disabled={!customerPhone || !conversationId}>
                <Phone className="h-4 w-4 mr-1" /> Start Call
              </Button>
            )}
            {(stage === 'confirmed' || stage === 'failed') && (
              <>
                <Button variant="outline" onClick={() => setStage('idle')}>Call Again</Button>
                <Button onClick={() => onOpenChange(false)}>Close</Button>
              </>
            )}
            {stage === 'calling' && (
              <Button variant="destructive" disabled>
                <PhoneOff className="h-4 w-4 mr-1" /> Connecting...
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
