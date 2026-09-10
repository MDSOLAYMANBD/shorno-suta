import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import ConversationList from '@/components/admin/inbox/ConversationList';
import ChatWindow from '@/components/admin/inbox/ChatWindow';
import CustomerProfilePanel from '@/components/admin/inbox/CustomerProfilePanel';
import WebhookStatusChecker from '@/components/admin/inbox/WebhookStatusChecker';
import CallTestChecklist from '@/components/admin/inbox/CallTestChecklist';
import AutomationStrip from '@/components/admin/inbox/automation/AutomationStrip';
import { useAutomationTrigger } from '@/components/admin/inbox/automation/useAutomationTrigger';
import CallCustomerButton from '@/components/admin/inbox/CallCustomerButton';
import SmartOrderBuilderDialog from '@/components/admin/inbox/SmartOrderBuilderDialog';
import CallHistorySection from '@/components/admin/inbox/CallHistorySection';
import CustomerNotesSection from '@/components/admin/inbox/CustomerNotesSection';
import CustomerOrderHistory from '@/components/admin/inbox/CustomerOrderHistory';
import { Button } from '@/components/ui/button';
import { Plus, Inbox, Settings2, ShoppingBag, FlaskConical } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import WebhookDebugPanel from '@/components/admin/inbox/WebhookDebugPanel';
import { ensureDemoConversations } from '@/components/admin/inbox/mock/seedDemoInbox';
import { pickRandomTestMessage } from '@/components/admin/inbox/mock/testMessages';

export default function AdminSmartInbox() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [showOrderBuilder, setShowOrderBuilder] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPlatform, setNewPlatform] = useState('website');

  // Fetch conversations
  const { data: conversations = [], isLoading: convsLoading } = useQuery({
    queryKey: ['inbox-conversations'],
    queryFn: async () => {
      const { data } = await supabase
        .from('inbox_conversations' as any)
        .select('*')
        .order('last_message_at', { ascending: false });
      return (data || []) as any[];
    },
    staleTime: 5 * 60 * 1000, // 5 min — realtime channel pushes inbox updates
  });

  // Fetch messages for selected conversation
  const { data: messages = [], isLoading: msgsLoading } = useQuery({
    queryKey: ['inbox-messages', selectedId],
    queryFn: async () => {
      if (!selectedId) return [];
      const { data } = await supabase
        .from('inbox_messages' as any)
        .select('*')
        .eq('conversation_id', selectedId)
        .order('created_at', { ascending: true });
      return (data || []) as any[];
    },
    enabled: !!selectedId,
  });

  const selectedConv = conversations.find((c: any) => c.id === selectedId);

  // Fire automation engine on every new message in the open conversation
  useAutomationTrigger(selectedId, messages);

  // Seed demo conversations on first mount when inbox is empty (fallback layer).
  useEffect(() => {
    let cancelled = false;
    ensureDemoConversations().then(() => {
      if (!cancelled) queryClient.invalidateQueries({ queryKey: ['inbox-conversations'] });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime for new messages
  useEffect(() => {
    const channel = supabase
      .channel('inbox-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inbox_messages' }, () => {
        queryClient.invalidateQueries({ queryKey: ['inbox-messages', selectedId] });
        queryClient.invalidateQueries({ queryKey: ['inbox-conversations'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inbox_conversations' }, () => {
        queryClient.invalidateQueries({ queryKey: ['inbox-conversations'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedId, queryClient]);

  // Manual test-message insert (fallback / debugging helper).
  const addTestMessage = async () => {
    if (!selectedId) {
      toast.error('আগে একটি কথোপকথন নির্বাচন করুন');
      return;
    }
    const text = pickRandomTestMessage();
    const { error } = await supabase.from('inbox_messages' as any).insert({
      conversation_id: selectedId,
      sender_type: 'customer',
      sender_name: selectedConv?.customer_name || 'Test Customer',
      message: text,
      metadata: { test: true },
    } as any);
    if (error) {
      toast.error('Test message যোগ করতে সমস্যা: ' + error.message);
      return;
    }
    await supabase.from('inbox_conversations' as any).update({
      last_message: text,
      last_message_at: new Date().toISOString(),
    } as any).eq('id', selectedId);
    queryClient.invalidateQueries({ queryKey: ['inbox-messages', selectedId] });
    queryClient.invalidateQueries({ queryKey: ['inbox-conversations'] });
    toast.success('Test message যোগ হয়েছে');
  };

  // Send message with multi-channel delivery
  const sendMutation = useMutation({
    mutationFn: async ({ text, sendSms, sendWhatsApp, sendMessenger }: { text: string; sendSms?: boolean; sendWhatsApp?: boolean; sendMessenger?: boolean }) => {
      if (!selectedId || !selectedConv) return;
      const { data: { session } } = await supabase.auth.getSession();

      const metadata: any = {};
      let anyChannelRequested = sendWhatsApp || sendSms || sendMessenger;
      let anyChannelSucceeded = false;

      // Send WhatsApp if requested
      if (sendWhatsApp && selectedConv.customer_phone) {
        try {
          const { data: waResult, error: waError } = await supabase.functions.invoke('send-whatsapp', {
            body: { phone: selectedConv.customer_phone, message: text },
          });
          if (waError) {
            toast.error('WhatsApp পাঠাতে সমস্যা: ' + waError.message);
            metadata.wa_failed = true;
            metadata.wa_error = waError.message;
          } else if (waResult?.success) {
            toast.success('WhatsApp পাঠানো হয়েছে ✓');
            metadata.sent_via_whatsapp = true;
            metadata.wa_message_id = waResult.message_id;
            metadata.wa_delivery_status = 'sent';
            anyChannelSucceeded = true;
          } else {
            const code = waResult?.error_code;
            const policyBlock = waResult?.policy_blocked || code === 131047;
            toast.error(policyBlock
              ? '🚫 ২৪ ঘণ্টার উইন্ডো শেষ — টেমপ্লেট পাঠাতে হবে'
              : 'WhatsApp ব্যর্থ: ' + (waResult?.error || 'Unknown'));
            metadata.wa_failed = true;
            metadata.wa_error = waResult?.error;
            if (code != null) metadata.wa_error_code = code;
            if (waResult?.error_subcode != null) metadata.wa_error_subcode = waResult.error_subcode;
            if (policyBlock) metadata.wa_policy_blocked = code === 131047 ? '24h_window' : 'policy';
          }
        } catch (e: any) {
          toast.error('WhatsApp error: ' + e.message);
          metadata.wa_failed = true;
          metadata.wa_error = e.message;
        }
      }

      // Send Messenger/Instagram if requested
      if (sendMessenger && selectedConv.platform_conversation_id) {
        const messengerPlatform = selectedConv.platform; // 'messenger' or 'instagram'
        try {
          const { data: msgResult, error: msgError } = await supabase.functions.invoke('send-messenger', {
            body: {
              recipient_id: selectedConv.platform_conversation_id,
              message: text,
              platform: messengerPlatform,
            },
          });
          if (msgError) {
            toast.error(`${messengerPlatform === 'instagram' ? 'Instagram' : 'Messenger'} পাঠাতে সমস্যা: ` + msgError.message);
            metadata.messenger_failed = true;
            metadata.messenger_error = msgError.message;
            metadata.messenger_platform = messengerPlatform;
          } else if (msgResult?.success) {
            toast.success(`${messengerPlatform === 'instagram' ? 'Instagram' : 'Messenger'} পাঠানো হয়েছে ✓`);
            metadata.sent_via_messenger = true;
            metadata.messenger_message_id = msgResult.message_id;
            metadata.messenger_platform = messengerPlatform;
            anyChannelSucceeded = true;
          } else {
            const code = msgResult?.error_code;
            const subcode = msgResult?.error_subcode;
            const policyBlock = msgResult?.policy_blocked || subcode === 2018278;
            const label = messengerPlatform === 'instagram' ? 'Instagram' : 'Messenger';
            toast.error(policyBlock
              ? `🚫 ${label}: ২৪ ঘণ্টার উইন্ডো শেষ`
              : `${label} ব্যর্থ: ` + (msgResult?.error || 'Unknown'));
            metadata.messenger_failed = true;
            metadata.messenger_error = msgResult?.error;
            metadata.messenger_platform = messengerPlatform;
            if (code != null) metadata.messenger_error_code = code;
            if (subcode != null) metadata.messenger_error_subcode = subcode;
            if (policyBlock) metadata.messenger_policy_blocked = '24h_window';
          }
        } catch (e: any) {
          toast.error(`Messenger/IG error: ` + e.message);
          metadata.messenger_failed = true;
          metadata.messenger_error = e.message;
          metadata.messenger_platform = messengerPlatform;
        }
      }

      // Send SMS if requested
      if (sendSms && selectedConv.customer_phone) {
        try {
          const { data: smsResult, error: smsError } = await supabase.functions.invoke('send-sms', {
            body: { phone: selectedConv.customer_phone, message: text },
          });
          if (smsError) {
            toast.error('SMS পাঠাতে সমস্যা: ' + smsError.message);
            metadata.sms_failed = true;
            metadata.sms_error = smsError.message;
          } else if (smsResult?.success) {
            toast.success('SMS পাঠানো হয়েছে ✓');
            metadata.sent_via_sms = true;
            metadata.sms_provider_response = smsResult.provider_response;
            anyChannelSucceeded = true;
          } else {
            toast.error('SMS ব্যর্থ: ' + (smsResult?.error || 'Unknown'));
            metadata.sms_failed = true;
            metadata.sms_error = smsResult?.error;
          }
        } catch (e: any) {
          toast.error('SMS error: ' + e.message);
          metadata.sms_failed = true;
          metadata.sms_error = e.message;
        }
      }

      if (anyChannelRequested && !anyChannelSucceeded) {
        metadata.all_channels_failed = true;
      }

      await supabase.from('inbox_messages' as any).insert({
        conversation_id: selectedId,
        sender_type: 'staff',
        sender_name: session?.user?.email || 'Staff',
        message: text,
        metadata,
      } as any);
      await supabase.from('inbox_conversations' as any).update({
        last_message: text,
        last_message_at: new Date().toISOString(),
      } as any).eq('id', selectedId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox-messages', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['inbox-conversations'] });
    },
  });

  // Create conversation
  const createMutation = useMutation({
    mutationFn: async () => {
      const phone = newPhone.trim();
      // Auto-generate platform_conversation_id for WhatsApp
      let platformConvId: string | undefined;
      if (newPlatform === 'whatsapp' && phone) {
        let formatted = phone.replace(/[\s-]/g, '');
        if (formatted.startsWith('+')) formatted = formatted.slice(1);
        if (formatted.startsWith('0')) formatted = '880' + formatted.slice(1);
        if (!formatted.startsWith('880')) formatted = '880' + formatted;
        platformConvId = formatted;
      }

      const insertData: any = {
        customer_name: newName.trim(),
        customer_phone: phone,
        platform: newPlatform,
      };
      if (platformConvId) insertData.platform_conversation_id = platformConvId;

      const { error } = await supabase.from('inbox_conversations' as any).insert(insertData as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('নতুন কথোপকথন তৈরি হয়েছে');
      setShowNewDialog(false);
      setNewName('');
      setNewPhone('');
      queryClient.invalidateQueries({ queryKey: ['inbox-conversations'] });
    },
    onError: () => toast.error('তৈরি করতে সমস্যা হয়েছে'),
  });

  // Customer info for profile panel
  const customerInfo = selectedConv ? {
    customer_name: selectedConv.customer_name,
    customer_phone: selectedConv.customer_phone,
    platform: selectedConv.platform,
    tags: selectedConv.tags || [],
    total_orders: 0,
    total_spent: 0,
  } : null;

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Inbox className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">স্মার্ট ইনবক্স</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowDiagnostic(!showDiagnostic)}>
            <Settings2 className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={() => setShowNewDialog(true)}>
            <Plus className="h-4 w-4 mr-1" /> নতুন
          </Button>
        </div>
      </div>

      {/* Diagnostic Panel */}
      {showDiagnostic && (
        <div className="border-b p-4 max-h-[70vh] overflow-y-auto bg-muted/30">
          <WebhookDebugPanel />
          <WebhookStatusChecker />
          <CallTestChecklist />
        </div>
      )}

      {/* Three-column layout */}
      <div className="flex-1 flex overflow-hidden">
        <div className="w-72 shrink-0">
          <ConversationList
            conversations={conversations}
            selectedId={selectedId}
            onSelect={setSelectedId}
            isLoading={convsLoading}
          />
        </div>

        <div className="flex-1 min-w-0 flex flex-col">
          <AutomationStrip
            conversationId={selectedId}
            conversation={selectedConv}
            onPickSuggestion={(text) => sendMutation.mutate({ text })}
          />
          {selectedId && (
            <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-muted/20">
              <CallCustomerButton
                conversationId={selectedId}
                customerName={selectedConv?.customer_name || ''}
                customerPhone={selectedConv?.customer_phone || ''}
              />
              <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => setShowOrderBuilder(true)}>
                <ShoppingBag className="h-3.5 w-3.5 text-fuchsia-600" />
                <span className="text-xs">Build Order</span>
              </Button>
              <Button size="sm" variant="outline" className="h-8 gap-1" onClick={addTestMessage}>
                <FlaskConical className="h-3.5 w-3.5 text-amber-600" />
                <span className="text-xs">+ Test Message</span>
              </Button>
            </div>
          )}
          <div className="flex-1 min-h-0">
            <ChatWindow
              messages={messages}
              conversationName={selectedConv?.customer_name || ''}
              customerPhone={selectedConv?.customer_phone || ''}
              platform={selectedConv?.platform || ''}
              platformConversationId={selectedConv?.platform_conversation_id || ''}
              onSendMessage={(text, options) => sendMutation.mutate({
                text,
                sendSms: options?.sendSms,
                sendWhatsApp: options?.sendWhatsApp,
                sendMessenger: options?.sendMessenger,
              })}
              isLoading={msgsLoading}
              isSending={sendMutation.isPending}
              onAddTestMessage={addTestMessage}
            />
          </div>
        </div>

        <div className="w-72 shrink-0 hidden lg:block overflow-y-auto border-l">
          <CustomerProfilePanel customer={customerInfo} />
          {selectedConv && (
            <div className="p-4 space-y-4 border-t">
              <CustomerOrderHistory customerPhone={selectedConv.customer_phone} />
              <CustomerNotesSection customerPhone={selectedConv.customer_phone} />
              <CallHistorySection conversationId={selectedId} />
            </div>
          )}
        </div>
      </div>

      {/* New Conversation Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>নতুন কথোপকথন</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">কাস্টমারের নাম</Label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="নাম" />
            </div>
            <div>
              <Label className="text-xs">ফোন</Label>
              <Input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="01XXXXXXXXX" />
            </div>
            <div>
              <Label className="text-xs">প্ল্যাটফর্ম</Label>
              <Select value={newPlatform} onValueChange={setNewPlatform}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="website">ওয়েবসাইট</SelectItem>
                  <SelectItem value="messenger">Messenger</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => createMutation.mutate()} disabled={!newName.trim() || createMutation.isPending}>
              তৈরি করুন
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SmartOrderBuilderDialog
        open={showOrderBuilder}
        onOpenChange={setShowOrderBuilder}
        conversationId={selectedId}
        defaultName={selectedConv?.customer_name || ''}
        defaultPhone={selectedConv?.customer_phone || ''}
        defaultPrice={null}
      />
    </div>
  );
}
