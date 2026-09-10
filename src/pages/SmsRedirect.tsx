import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getOrCreateVisitorKey } from '@/lib/sms/shortLinks';
import { AlertTriangle, Loader2 } from 'lucide-react';

type State = 'loading' | 'expired' | 'notfound' | 'error';

export default function SmsRedirect() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<State>('loading');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) { setState('notfound'); return; }
      try {
        const clickKey = getOrCreateVisitorKey();
        const { data, error } = await (supabase.rpc as any)('sms_record_click', {
          p_token: token,
          p_click_key: clickKey,
          p_ip: null,
          p_ua: typeof navigator !== 'undefined' ? navigator.userAgent : null,
          p_referer: typeof document !== 'undefined' ? document.referrer || null : null,
        });
        if (cancelled) return;
        if (error || !data) { setState('error'); return; }
        if (data.expired) { setState('expired'); return; }
        if (data.error === 'not_found') { setState('notfound'); return; }
        const target: string | undefined = data.target_url;
        if (!target) { setState('notfound'); return; }
        window.location.replace(target);
      } catch {
        if (!cancelled) setState('error');
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 to-amber-50">
        <div className="flex flex-col items-center gap-3 text-rose-600">
          <Loader2 className="h-10 w-10 animate-spin" />
          <p className="text-sm">রিডাইরেক্ট হচ্ছে...</p>
        </div>
      </div>
    );
  }

  const title = state === 'expired' ? 'লিংকের মেয়াদ শেষ' : 'লিংক পাওয়া যায়নি';
  const desc = state === 'expired'
    ? 'এই অফারটির সময় শেষ হয়ে গেছে। আমাদের সর্বশেষ কালেকশন দেখতে নিচের বাটনে ক্লিক করুন।'
    : 'এই লিংকটি ভুল অথবা মুছে ফেলা হয়েছে। আমাদের সাইট ভিজিট করুন।';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 to-amber-50 px-4">
      <div className="max-w-sm w-full bg-white rounded-2xl shadow-xl p-6 text-center space-y-4">
        <div className="mx-auto h-14 w-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        <p className="text-sm text-gray-600 leading-relaxed">{desc}</p>
        <a
          href="/"
          className="inline-block w-full rounded-lg bg-gradient-to-r from-rose-500 to-red-500 text-white py-2.5 font-medium shadow hover:opacity-90 transition"
        >
          স্বর্ণ সুতায় যান
        </a>
      </div>
    </div>
  );
}
