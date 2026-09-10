import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Store, Download, CheckCircle2, Share, Plus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const CustomerInstall = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [alreadyInstalled, setAlreadyInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    const original = link?.getAttribute('href') ?? null;
    link?.setAttribute('href', '/manifest-customer.json');

    const meta = document.querySelector('meta[name="apple-mobile-web-app-title"]') as HTMLMetaElement | null;
    const originalTitle = meta?.getAttribute('content') ?? null;
    meta?.setAttribute('content', 'স্বর্ণ সুতা');

    const originalDocTitle = document.title;
    document.title = 'স্বর্ণ সুতা অ্যাপ ইনস্টল করুন';

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setCanInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setAlreadyInstalled(true);
    }

    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream);

    const installedHandler = () => {
      setAlreadyInstalled(true);
      setCanInstall(false);
      toast({ title: 'ইনস্টল সফল!', description: 'হোম স্ক্রিন থেকে স্বর্ণ সুতা অ্যাপ খুলুন।' });
    };
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
      if (original) link?.setAttribute('href', original);
      if (originalTitle) meta?.setAttribute('content', originalTitle);
      document.title = originalDocTitle;
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      toast({ title: 'ইনস্টল সফল!', description: 'হোম স্ক্রিনে "স্বর্ণ সুতা" আইকন দেখুন।' });
      setDeferredPrompt(null);
      setCanInstall(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-primary/5 p-4">
      <Card className="w-full max-w-md p-8 shadow-xl">
        <div className="flex flex-col items-center text-center space-y-6">
          <div className="w-24 h-24 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
            <Store className="w-12 h-12 text-primary-foreground" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold">স্বর্ণ সুতা</h1>
            <p className="text-sm text-muted-foreground">
              আমাদের অ্যাপ ফোনে ইনস্টল করুন। সহজেই অর্ডার করুন, অফার পান, এবং দ্রুত ব্রাউজিং উপভোগ করুন।
            </p>
          </div>

          {alreadyInstalled ? (
            <div className="w-full p-4 rounded-lg bg-primary/10 border border-primary/20 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="text-left text-sm">
                <p className="font-semibold">ইতিমধ্যে ইনস্টল করা আছে</p>
                <p className="text-muted-foreground">হোম স্ক্রিন থেকে "স্বর্ণ সুতা" আইকনে ট্যাপ করুন।</p>
              </div>
            </div>
          ) : isIOS ? (
            <div className="w-full p-4 rounded-lg border bg-muted/30 text-left space-y-3">
              <p className="font-semibold text-sm">📱 iPhone/iPad-এ ইনস্টল করতে:</p>
              <ol className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-primary">১.</span>
                  <span>Safari-এর নিচে <Share className="inline w-4 h-4 mx-1" /> <strong>Share</strong> বাটন চাপুন</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-primary">২.</span>
                  <span>স্ক্রল করে <Plus className="inline w-4 h-4 mx-1" /> <strong>"Add to Home Screen"</strong> নির্বাচন করুন</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-primary">৩.</span>
                  <span>উপরে ডানে <strong>"Add"</strong> চাপুন</span>
                </li>
              </ol>
            </div>
          ) : (
            <>
              <Button
                size="lg"
                className="w-full"
                onClick={handleInstall}
                disabled={!canInstall}
              >
                <Download className="w-5 h-5" />
                {canInstall ? 'অ্যাপ ইনস্টল করুন' : 'ইনস্টল প্রস্তুত হচ্ছে...'}
              </Button>
              {!canInstall && (
                <p className="text-xs text-muted-foreground">
                  যদি বাটন কাজ না করে, ব্রাউজার মেনু থেকে "Install app" বা "Add to Home Screen" বেছে নিন।
                </p>
              )}
            </>
          )}

          <div className="w-full pt-4 border-t text-xs text-muted-foreground">
            ইনস্টলের পর হোম স্ক্রিনের আইকনে ট্যাপ করলে সরাসরি স্বর্ণ সুতা ওয়েবসাইট খুলবে।
          </div>
        </div>
      </Card>
    </div>
  );
};

export default CustomerInstall;
