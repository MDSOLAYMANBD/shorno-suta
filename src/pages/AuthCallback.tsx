import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const code = params.get('code');
    const errParam = params.get('error') || hashParams.get('error');
    const errDesc = params.get('error_description') || hashParams.get('error_description') || '';

    if (errParam) {
      const lower = errDesc.toLowerCase();
      const isScope = lower.includes('scope') || lower.includes('permission');
      toast({
        title: 'লগইন ব্যর্থ',
        description: isScope
          ? 'Facebook লগইন সাময়িকভাবে অনুপলব্ধ। Google দিয়ে চেষ্টা করুন।'
          : 'লগইন সম্পূর্ণ হয়নি। আবার চেষ্টা করুন।',
        variant: 'destructive',
      });
      navigate(`/account/login?auth_error=${isScope ? 'fb_scope' : 'oauth'}`, { replace: true });
      return;
    }

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          console.error('Auth callback error:', error);
          toast({ title: 'লগইন ব্যর্থ', description: 'সেশন তৈরি করা যায়নি। আবার চেষ্টা করুন।', variant: 'destructive' });
          navigate('/account/login?auth_error=exchange', { replace: true });
        } else {
          navigate('/account', { replace: true });
        }
      });
    } else {
      navigate('/account/login', { replace: true });
    }
  }, [navigate, toast]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
