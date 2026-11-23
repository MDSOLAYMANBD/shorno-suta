// "নতুন আপডেট এসেছে": an admin page left open keeps the code it was opened with until it is
// reloaded, so after a deploy the owner may work on an old screen without knowing. This looks
// at the website's index.html now and then (and when the tab comes back into view); when its
// main script is not the one running here, it offers a reload. The same as the CORE Shop
// engine's admin.
import { useEffect } from 'react';
import { toast } from 'sonner';

const EVERY = 3 * 60_000;
const scriptOf = (html: string) => html.match(/<script[^>]+type="module"[^>]+src="([^"]*\/assets\/[^"]+\.js)"/)?.[1] ?? null;

export default function UpdateNotice() {
  useEffect(() => {
    if (import.meta.env.DEV) return;
    const running = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/"]')?.getAttribute('src');
    if (!running) return;
    let told = false;
    let last = 0;
    const check = async () => {
      if (told || document.visibilityState !== 'visible' || Date.now() - last < 60_000) return;
      last = Date.now();
      try {
        const res = await fetch(`/index.html?check=${Date.now()}`, { cache: 'no-store' });
        const now = res.ok ? scriptOf(await res.text()) : null;
        if (now && now !== running) {
          told = true;
          toast('নতুন আপডেট এসেছে', {
            description: 'নতুন সুবিধাগুলো পেতে পেজটা একবার রিফ্রেশ করুন।',
            duration: Infinity,
            action: { label: 'রিফ্রেশ', onClick: () => window.location.reload() },
          });
        }
      } catch { /* offline: next time */ }
    };
    const timer = window.setInterval(check, EVERY);
    document.addEventListener('visibilitychange', check);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', check); };
  }, []);
  return null;
}
