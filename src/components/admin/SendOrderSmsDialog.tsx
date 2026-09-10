import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Send, MessageSquare, Phone, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { normalizeBDPhone } from '@/lib/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: {
    id: string;
    customer_name?: string;
    customer_phone?: string;
    order_number?: string;
  } | null;
}

const BRAND_FOOTER = '— স্বর্ণ সুতা';

function buildFinalMessage(name: string | undefined, body: string) {
  const greet = name?.trim() ? `প্রিয় ${name.trim()},` : 'প্রিয় কাস্টমার,';
  return `${greet}\n\n${body.trim()}\n\n${BRAND_FOOTER}`;
}

// Bengali/non-ASCII detect → 70 chars per part, else 160
function smsPartInfo(text: string) {
  const isUnicode = /[^\x00-\x7F]/.test(text);
  const perPart = isUnicode ? 70 : 160;
  const length = text.length;
  const parts = length === 0 ? 0 : Math.ceil(length / perPart);
  return { length, perPart, parts, isUnicode };
}

export default function SendOrderSmsDialog({ open, onOpenChange, order }: Props) {
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const qc = useQueryClient();

  const phone = order?.customer_phone || '';
  const normalizedPhone = useMemo(() => normalizeBDPhone(phone), [phone]);
  const finalMessage = useMemo(() => buildFinalMessage(order?.customer_name, body), [order?.customer_name, body]);
  const info = smsPartInfo(finalMessage);

  useEffect(() => { if (!open) setBody(''); }, [open]);

  const { data: history = [], refetch } = useQuery({
    queryKey: ['order-sms-history', order?.id],
    queryFn: async () => {
      if (!order?.id) return [];
      const { data } = await supabase
        .from('notification_logs' as any)
        .select('id, recipient, status, message_content, error_message, created_at, notification_type')
        .eq('order_id', order.id)
        .eq('channel', 'sms')
        .order('created_at', { ascending: false })
        .limit(20);
      return (data as any[]) || [];
    },
    enabled: open && !!order?.id,
    staleTime: 10_000,
  });

  const canSend = !sending && body.trim().length >= 3 && /^01[3-9]\d{8}$/.test(normalizedPhone);

  const handleSend = async () => {
    if (!canSend || !order) return;
    setSending(true);
    let success = false;
    let errMsg: string | null = null;
    let providerResp: any = null;
    try {
      const { data, error } = await supabase.functions.invoke('send-sms', {
        body: { phone: normalizedPhone, message: finalMessage },
      });
      if (error) throw error;
      success = !!data?.success;
      errMsg = data?.error || null;
      providerResp = data?.provider_response || null;
      if (!success) throw new Error(errMsg || 'SMS পাঠানো ব্যর্থ');
    } catch (e: any) {
      success = false;
      errMsg = e?.message || 'SMS পাঠানো ব্যর্থ';
    }

    try {
      await supabase.from('notification_logs' as any).insert({
        order_id: order.id,
        notification_type: 'manual_sms',
        channel: 'sms',
        recipient: normalizedPhone,
        status: success ? 'sent' : 'failed',
        message_content: finalMessage,
        error_message: errMsg,
      } as any);
    } catch {}

    setSending(false);
    if (success) {
      toast.success('SMS পাঠানো হয়েছে ✓');
      setBody('');
    } else {
      toast.error(errMsg || 'SMS পাঠানো ব্যর্থ');
    }
    refetch();
    qc.invalidateQueries({ queryKey: ['order-sms-history', order.id] });
  };

  const counterColor =
    info.parts <= 1 ? 'text-emerald-600'
      : info.parts <= 3 ? 'text-amber-600'
      : 'text-rose-600';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[92vh] overflow-hidden flex flex-col p-0 z-[1003]">
        <DialogHeader className="px-5 pt-5 pb-3 border-b bg-gradient-to-br from-primary/5 via-background to-background">
          <DialogTitle className="flex items-center gap-2 text-base">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary grid place-items-center">
              <MessageSquare className="h-4 w-4" />
            </div>
            কাস্টমারকে SMS পাঠান
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="px-5 py-4 space-y-4">
            {/* Recipient */}
            <div className="rounded-xl border bg-muted/30 px-3 py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] text-muted-foreground font-medium">প্রাপক</div>
                <div className="text-sm font-semibold truncate">{order?.customer_name || 'নাম নেই'}</div>
              </div>
              <div className="flex items-center gap-1.5 text-sm font-mono tabular-nums text-foreground/80">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                {normalizedPhone || '—'}
              </div>
            </div>

            {/* Body input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground/80">আপনার বার্তা</label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="যেমন: আপনার অর্ডারটি আজ ডেলিভারির জন্য পাঠানো হয়েছে।"
                rows={4}
                className="resize-none"
                autoFocus
              />
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">গ্রিটিং ও সাইনঅফ স্বয়ংক্রিয়ভাবে যুক্ত হবে</span>
                <span className={`font-mono tabular-nums font-semibold ${counterColor}`}>
                  {info.length} / {info.perPart} · {info.parts} part
                </span>
              </div>
            </div>

            {/* Preview */}
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-foreground/80">প্রিভিউ</div>
              <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.04] via-background to-background p-4 shadow-sm">
                <div className="text-[10px] uppercase tracking-wider text-primary/70 font-bold mb-2 flex items-center gap-1.5">
                  <MessageSquare className="h-3 w-3" /> SMS Preview
                </div>
                <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-foreground/90">
{finalMessage}
                </pre>
              </div>
            </div>

            {/* History */}
            <div className="space-y-1.5 pt-1">
              <div className="text-xs font-semibold text-foreground/80 flex items-center justify-between">
                <span>আগের SMS ({history.length})</span>
              </div>
              {history.length === 0 ? (
                <div className="text-[11px] text-muted-foreground text-center py-4 border border-dashed rounded-lg">
                  এখনো কোনো SMS পাঠানো হয়নি
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {history.map((h: any) => (
                    <div key={h.id} className="rounded-lg border bg-card px-2.5 py-2 text-[11px]">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5">
                          {h.status === 'sent' ? (
                            <Badge variant="outline" className="h-5 px-1.5 text-[10px] border-emerald-300 text-emerald-700 bg-emerald-50">
                              <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> পাঠানো
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="h-5 px-1.5 text-[10px] border-rose-300 text-rose-700 bg-rose-50">
                              <XCircle className="h-2.5 w-2.5 mr-0.5" /> ব্যর্থ
                            </Badge>
                          )}
                          <span className="font-mono text-muted-foreground">{h.recipient}</span>
                        </div>
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {new Date(h.created_at).toLocaleString('bn-BD', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </div>
                      <div className="text-foreground/80 line-clamp-3 whitespace-pre-wrap">{h.message_content}</div>
                      {h.error_message && (
                        <div className="text-rose-600 mt-1">⚠ {h.error_message}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <div className="px-5 py-3 border-t bg-background">
          <Button onClick={handleSend} disabled={!canSend} className="w-full h-10">
            {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            {sending ? 'পাঠানো হচ্ছে...' : 'SMS পাঠান'}
          </Button>
          {!/^01[3-9]\d{8}$/.test(normalizedPhone) && (
            <p className="text-[11px] text-rose-600 mt-1.5 text-center">⚠ কাস্টমারের ফোন নম্বর সঠিক নয়</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
