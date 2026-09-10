import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Phone as PhoneIcon, MapPin, User as UserIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { User } from '@supabase/supabase-js';

interface Props {
  user: User;
  defaultName?: string;
  defaultPhone?: string;
  defaultAddress?: string;
  onComplete: (name: string, phone: string, address: string) => Promise<void> | void;
}

export default function ChatProfileCompleteGate({ user, defaultName = '', defaultPhone = '', defaultAddress = '', onComplete }: Props) {
  const [name, setName] = useState(defaultName || user.user_metadata?.full_name || '');
  const [phone, setPhone] = useState(defaultPhone);
  const [address, setAddress] = useState(defaultAddress);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const n = name.trim(), p = phone.trim(), a = address.trim();
    if (!n) { toast.error('নাম দিন'); return; }
    if (!/^01[3-9]\d{8}$/.test(p)) { toast.error('সঠিক ফোন দিন (01XXXXXXXXX)'); return; }
    if (a.length < 3) { toast.error('ঠিকানা দিন (এলাকা/শহর)'); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('customer_profiles').upsert({
        user_id: user.id,
        full_name: n,
        phone: p,
        address: a,
        email: user.email || '',
        avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
      } as any, { onConflict: 'user_id' });
      if (error) throw error;
      await onComplete(n, p, a);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'সংরক্ষণ ব্যর্থ');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4 bg-gradient-to-b from-card to-muted/30 overflow-y-auto">
      <div className="h-14 w-14 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-primary-foreground shadow-lg overflow-hidden">
        {(user.user_metadata?.avatar_url || user.user_metadata?.picture) ? (
          <img src={user.user_metadata?.avatar_url || user.user_metadata?.picture} alt="" className="h-full w-full object-cover" />
        ) : (
          <UserIcon className="h-7 w-7" />
        )}
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-base">আর একটি ছোট ধাপ</h3>
        <p className="text-xs text-muted-foreground mt-1">আপনার ফোন ও ঠিকানা দিন — পরের অর্ডারে কাজে লাগবে</p>
      </div>

      <div className="w-full space-y-2.5">
        <div className="relative">
          <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="আপনার নাম" className="h-11 rounded-xl pl-9" />
        </div>
        <div className="relative">
          <PhoneIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="মোবাইল (01XXXXXXXXX)" inputMode="tel" className="h-11 rounded-xl pl-9" />
        </div>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="ঠিকানা (এলাকা, শহর)" className="h-11 rounded-xl pl-9" />
        </div>
        <Button onClick={submit} disabled={submitting} className="w-full h-11 rounded-xl bg-gradient-to-r from-primary to-secondary text-primary-foreground font-semibold shadow-md hover:shadow-lg transition-all">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'সংরক্ষণ করে চ্যাট শুরু'}
        </Button>
      </div>
    </div>
  );
}
