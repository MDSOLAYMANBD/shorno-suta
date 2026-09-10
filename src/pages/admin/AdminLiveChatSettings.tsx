import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useStoreSettings, useUpdateSetting } from '@/hooks/useStoreSettings';

function normalizeWhatsapp(input: string): string {
  const v = input.trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  const digits = v.replace(/\D/g, '');
  if (!digits) return '';
  return `https://wa.me/${digits}`;
}

export default function AdminLiveChatSettings() {
  const navigate = useNavigate();
  const { data: settings = {}, isLoading } = useStoreSettings();
  const updateSetting = useUpdateSetting();

  const [chatWelcomeMsg, setChatWelcomeMsg] = useState('');
  const [whatsappLink, setWhatsappLink] = useState('');
  const [messengerLink, setMessengerLink] = useState('');

  useEffect(() => {
    if (settings) {
      setChatWelcomeMsg(settings.chat_welcome_message || 'আসসালামু আলাইকুম! স্বর্ণ সুতায় স্বাগতম। আপনাকে কিভাবে সাহায্য করতে পারি?');
      setWhatsappLink(settings.contact_whatsapp_link || '');
      setMessengerLink(settings.contact_messenger_link || '');
    }
  }, [settings]);

  const save = async () => {
    try {
      const normalizedWa = normalizeWhatsapp(whatsappLink);
      await Promise.all([
        updateSetting.mutateAsync({ key: 'chat_welcome_message', value: chatWelcomeMsg }),
        updateSetting.mutateAsync({ key: 'contact_whatsapp_link', value: normalizedWa }),
        updateSetting.mutateAsync({ key: 'contact_messenger_link', value: messengerLink.trim() }),
      ]);
      if (normalizedWa !== whatsappLink) setWhatsappLink(normalizedWa);
      toast.success('লাইভ চ্যাট সেটিংস সেভ হয়েছে');
    } catch {
      toast.error('সেভ করতে সমস্যা হয়েছে');
    }
  };

  if (isLoading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/live-chat')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> ফিরে যান
        </Button>
        <h1 className="text-2xl font-bold">💬 লাইভ চ্যাট সেটিংস</h1>
      </div>
      <Card>
        <CardContent className="space-y-6 pt-6">
          <div>
            <Label>স্বাগত বার্তা (Welcome Message)</Label>
            <Textarea
              value={chatWelcomeMsg}
              onChange={e => setChatWelcomeMsg(e.target.value)}
              rows={4}
              className="mt-1.5"
              placeholder="চ্যাট ওপেন করলে কাস্টমারকে যে বার্তা দেখানো হবে"
            />
          </div>

          <div className="border-t border-border pt-5 space-y-4">
            <div>
              <h2 className="text-base font-semibold mb-1">📞 যোগাযোগ লিংক</h2>
              <p className="text-xs text-muted-foreground">চ্যাট বাটনে ক্লিক করলে কাস্টমার এই লিংকগুলো দেখতে পাবে।</p>
            </div>

            <div>
              <Label>WhatsApp নম্বর বা লিংক</Label>
              <Input
                value={whatsappLink}
                onChange={e => setWhatsappLink(e.target.value)}
                className="mt-1.5"
                placeholder="8801XXXXXXXXX অথবা https://wa.me/8801XXXXXXXXX"
              />
              <p className="text-[11px] text-muted-foreground mt-1">শুধু নম্বর দিলে wa.me/ লিংকে কনভার্ট হয়ে যাবে। খালি রাখলে অপশন দেখাবে না।</p>
            </div>

            <div>
              <Label>Messenger পেজ লিংক</Label>
              <Input
                value={messengerLink}
                onChange={e => setMessengerLink(e.target.value)}
                className="mt-1.5"
                placeholder="https://m.me/yourpagename"
              />
              <p className="text-[11px] text-muted-foreground mt-1">খালি রাখলে অপশন দেখাবে না।</p>
            </div>
          </div>

          <Button onClick={save} disabled={updateSetting.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {updateSetting.isPending ? 'সেভ হচ্ছে...' : 'সেভ করুন'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
