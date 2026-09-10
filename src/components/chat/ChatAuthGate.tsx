import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles } from 'lucide-react';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { toast } from 'sonner';

interface Props {
  onClose?: () => void;
}

export default function ChatAuthGate({ onClose }: Props) {
  const [busy, setBusy] = useState(false);
  const { signInWithProvider } = useCustomerAuth();

  const oauth = async () => {
    setBusy(true);
    try { await signInWithProvider('google'); }
    catch (e: any) { toast.error(e?.message || 'লগইন ব্যর্থ'); setBusy(false); }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 gap-5 bg-gradient-to-b from-card to-muted/30 overflow-y-auto">
      <div className="h-14 w-14 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-primary-foreground shadow-lg">
        <Sparkles className="h-7 w-7" />
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-base">চ্যাট শুরু করুন</h3>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          Google দিয়ে এক ক্লিকে লগইন — নাম ও ছবি Google থেকে নেওয়া হবে।<br />
          ফোন ও ঠিকানা পরের ধাপে চাইব।
        </p>
      </div>

      <Button
        onClick={oauth}
        disabled={busy}
        variant="outline"
        className="w-full h-12 rounded-xl hover:scale-[1.02] hover:border-primary/40 hover:shadow-md hover:shadow-primary/10 transition-all font-semibold"
      >
        {busy ? (
          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
        ) : (
          <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
        )}
        Google দিয়ে চালিয়ে যান
      </Button>

      <p className="text-[10px] text-center text-muted-foreground leading-relaxed max-w-[280px]">
        লগইন করলে আপনি আমাদের শর্তাবলী ও প্রাইভেসি পলিসি মেনে নিচ্ছেন। আপনার তথ্য নিরাপদ থাকবে।
      </p>

      {onClose && (
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          পরে দেখব
        </button>
      )}
    </div>
  );
}
