import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, MessageSquare, Loader2, Phone, CheckCheck, Check, AlertCircle, Clock, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Message {
  id: string;
  sender_type: string;
  sender_name: string;
  message: string;
  image_url?: string;
  created_at: string;
  metadata?: any;
}

interface ChatWindowProps {
  messages: Message[];
  conversationName: string;
  customerPhone?: string;
  platform?: string;
  platformConversationId?: string;
  onSendMessage: (text: string, options?: { sendSms?: boolean; sendWhatsApp?: boolean; sendMessenger?: boolean }) => void;
  isLoading: boolean;
  isSending?: boolean;
  onAddTestMessage?: () => void;
}

function DeliveryBadge({ metadata }: { metadata: any }) {
  if (!metadata) return null;

  const badges: React.ReactNode[] = [];

  // WhatsApp delivery status
  if (metadata.sent_via_whatsapp) {
    const waStatus = metadata.wa_delivery_status;
    if (waStatus === 'read') {
      badges.push(<span key="wa" className="inline-flex items-center gap-0.5"><CheckCheck className="h-2.5 w-2.5 text-blue-400" /> WA</span>);
    } else if (waStatus === 'delivered') {
      badges.push(<span key="wa" className="inline-flex items-center gap-0.5"><CheckCheck className="h-2.5 w-2.5" /> WA</span>);
    } else if (waStatus === 'sent') {
      badges.push(<span key="wa" className="inline-flex items-center gap-0.5"><Check className="h-2.5 w-2.5" /> WA</span>);
    } else if (waStatus === 'failed') {
      const is24h = metadata.wa_policy_blocked === '24h_window' || metadata.wa_error_code === 131047;
      badges.push(
        <TooltipProvider key="wa-tip">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-0.5 text-red-400 cursor-help">
                <AlertCircle className="h-2.5 w-2.5" /> {is24h ? 'WA 🚫 24h' : 'WA ❌'}
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">
              <p className="font-semibold">{is24h ? '২৪ ঘণ্টার উইন্ডো শেষ' : 'WhatsApp পাঠাতে ব্যর্থ'}</p>
              {metadata.wa_error && <p className="text-muted-foreground mt-0.5">{metadata.wa_error}</p>}
              {metadata.wa_error_details && <p className="text-muted-foreground mt-0.5">{metadata.wa_error_details}</p>}
              {metadata.wa_error_code != null && <p className="text-muted-foreground mt-0.5">Code: {metadata.wa_error_code}</p>}
              <p className="text-muted-foreground mt-0.5">{is24h ? 'Approved টেমপ্লেট পাঠাতে হবে' : 'সম্ভাব্য কারণ: ২৪ ঘণ্টার উইন্ডো শেষ, নম্বর WhatsApp-এ নেই, বা টেমপ্লেট দরকার'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    } else {
      badges.push(<span key="wa" className="inline-flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" /> WA</span>);
    }
  }
  if (metadata.wa_failed && !metadata.sent_via_whatsapp) {
    const is24h = metadata.wa_policy_blocked === '24h_window' || metadata.wa_error_code === 131047;
    badges.push(
      <TooltipProvider key="wa-fail-tip">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-red-400 cursor-help">{is24h ? 'WA 🚫 24h' : 'WA ❌'}</span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs">
            <p className="font-semibold">{is24h ? '২৪ ঘণ্টার উইন্ডো শেষ — টেমপ্লেট পাঠান' : (metadata.wa_error || 'WhatsApp পাঠাতে ব্যর্থ')}</p>
            {is24h && metadata.wa_error && <p className="text-muted-foreground mt-0.5">{metadata.wa_error}</p>}
            {metadata.wa_error_code != null && <p className="text-muted-foreground mt-0.5">Code: {metadata.wa_error_code}</p>}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Messenger/Instagram delivery status
  if (metadata.sent_via_messenger) {
    badges.push(<span key="msg" className="inline-flex items-center gap-0.5"><Check className="h-2.5 w-2.5" /> {metadata.messenger_platform === 'instagram' ? 'IG' : 'FB'}</span>);
  }
  if (metadata.messenger_failed) {
    const is24h = metadata.messenger_policy_blocked === '24h_window' || metadata.messenger_error_subcode === 2018278;
    const label = metadata.messenger_platform === 'instagram' ? 'IG' : 'FB';
    badges.push(
      <TooltipProvider key="msg-fail-tip">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-red-400 cursor-help">{label} {is24h ? '🚫 24h' : '❌'}</span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs">
            <p className="font-semibold">{is24h ? '২৪ ঘণ্টার উইন্ডো শেষ' : (metadata.messenger_error || 'পাঠাতে ব্যর্থ')}</p>
            {is24h && metadata.messenger_error && <p className="text-muted-foreground mt-0.5">{metadata.messenger_error}</p>}
            {metadata.messenger_error_code != null && <p className="text-muted-foreground mt-0.5">Code: {metadata.messenger_error_code}</p>}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // SMS status
  if (metadata.sent_via_sms) {
    badges.push(<span key="sms" className="inline-flex items-center gap-0.5"><Check className="h-2.5 w-2.5" /> SMS</span>);
  }
  if (metadata.sms_failed) {
    badges.push(<span key="sms-fail" className="text-red-400">SMS ❌</span>);
  }

  if (badges.length === 0) return null;

  return <span className="text-[10px] ml-1">• {badges}</span>;
}

export default function ChatWindow({ messages, conversationName, customerPhone, platform, platformConversationId, onSendMessage, isLoading, isSending, onAddTestMessage }: ChatWindowProps) {
  const [text, setText] = useState('');
  const [sendViaSms, setSendViaSms] = useState(false);
  const [sendViaWhatsApp, setSendViaWhatsApp] = useState(false);
  const [sendViaMessenger, setSendViaMessenger] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const isWhatsApp = platform === 'whatsapp';
  const isMessenger = platform === 'messenger';
  const isInstagram = platform === 'instagram';
  const canSms = !!customerPhone && customerPhone.length >= 10;
  const canMessenger = (isMessenger || isInstagram) && !!platformConversationId;
  const canWhatsApp = isWhatsApp && !!customerPhone;

  // Auto-enable primary channel based on platform
  useEffect(() => {
    setSendViaWhatsApp(isWhatsApp);
    setSendViaMessenger(isMessenger || isInstagram);
    setSendViaSms(false);
  }, [platform, isWhatsApp, isMessenger, isInstagram]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!text.trim() || isSending) return;
    onSendMessage(text.trim(), { sendSms: sendViaSms, sendWhatsApp: sendViaWhatsApp, sendMessenger: sendViaMessenger });
    setText('');
  };

  // Check if any outbound channel is available
  const hasOutbound = canWhatsApp || canMessenger || canSms;

  if (!conversationName) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        বাম থেকে একটি কথোপকথন নির্বাচন করুন
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b flex items-center gap-2">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-xs">{conversationName.charAt(0)}</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-semibold">{conversationName}</p>
          <p className="text-[11px] text-muted-foreground">
            {customerPhone && <>{customerPhone} • </>}
            {platform === 'whatsapp' && '💬 WhatsApp'}
            {platform === 'messenger' && '📘 Messenger'}
            {platform === 'instagram' && '📷 Instagram'}
            {platform === 'website' && '🌐 Website'}
            {!['whatsapp', 'messenger', 'instagram', 'website'].includes(platform || '') && platform}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {isLoading ? (
          <div className="text-center text-xs text-muted-foreground py-8">লোড হচ্ছে...</div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-10 gap-3">
            <div className="rounded-full bg-muted h-12 w-12 flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground max-w-[260px]">
              কোনো মেসেজ পাওয়া যায়নি। Test message add করুন
            </p>
            {onAddTestMessage && (
              <Button size="sm" variant="outline" onClick={onAddTestMessage} className="h-8">
                + Add Test Message
              </Button>
            )}
          </div>
        ) : (
          messages.map(m => (
            <div key={m.id} className={cn('flex gap-2', m.sender_type === 'staff' ? 'justify-end' : 'justify-start')}>
              {m.sender_type !== 'staff' && (
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback className="text-[10px]">{m.sender_name?.charAt(0) || '?'}</AvatarFallback>
                </Avatar>
              )}
              <div className={cn(
                'max-w-[70%] rounded-2xl px-3.5 py-2 text-sm',
                m.sender_type === 'staff'
                  ? 'bg-primary text-primary-foreground rounded-br-md'
                  : 'bg-muted rounded-bl-md'
              )}>
                {m.image_url && (
                  <img src={m.image_url} alt="" className="max-w-full rounded-lg mb-1 max-h-48 object-cover" />
                )}
                {m.message && <p className="whitespace-pre-wrap break-words">{m.message}</p>}
                <div className={cn(
                  'flex items-center gap-1 mt-1',
                  m.sender_type === 'staff' ? 'text-primary-foreground/60' : 'text-muted-foreground'
                )}>
                  <span className="text-[10px]">
                    {new Date(m.created_at).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <DeliveryBadge metadata={m.metadata} />
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* No outbound warning */}
      {!hasOutbound && conversationName && (
        <div className="px-3 py-2 bg-amber-500/10 border-t border-amber-500/20">
          <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5 shrink-0" />
            এই কথোপকথনে রিপ্লাই পাঠানোর কোনো চ্যানেল পাওয়া যায়নি। কাস্টমারের ফোন নম্বর বা প্ল্যাটফর্ম ID দরকার।
          </p>
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t space-y-2">
        <div className="flex items-center gap-4 flex-wrap">
          {canWhatsApp && (
            <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
              <input
                type="checkbox"
                checked={sendViaWhatsApp}
                onChange={e => setSendViaWhatsApp(e.target.checked)}
                className="rounded border-input"
              />
              <Phone className="h-3 w-3 text-green-600" />
              <span className="text-green-700 dark:text-green-400 font-medium">WhatsApp</span>
            </label>
          )}
          {canMessenger && (
            <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
              <input
                type="checkbox"
                checked={sendViaMessenger}
                onChange={e => setSendViaMessenger(e.target.checked)}
                className="rounded border-input"
              />
              <MessageSquare className="h-3 w-3 text-blue-600" />
              <span className="text-blue-700 dark:text-blue-400 font-medium">
                {isInstagram ? 'Instagram DM' : 'Messenger'}
              </span>
            </label>
          )}
          {canSms && (
            <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
              <input
                type="checkbox"
                checked={sendViaSms}
                onChange={e => setSendViaSms(e.target.checked)}
                className="rounded border-input"
              />
              <MessageSquare className="h-3 w-3" />
              SMS ({customerPhone})
            </label>
          )}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="মেসেজ লিখুন..."
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            className="text-sm"
            disabled={isSending}
          />
          <Button size="icon" onClick={handleSend} disabled={!text.trim() || isSending || !hasOutbound}>
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
