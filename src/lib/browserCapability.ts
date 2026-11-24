import { trNow } from '@/lib/i18n';
// Browser capability + microphone permission helpers
// Used by voice recorder and voice call hooks for premium error messaging.

export interface MicCapability {
  ok: boolean;
  reason?: 'insecure' | 'no-api' | 'in-app' | 'permission-denied';
  message?: string;
}

export function isSecureContextAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.isSecureContext) return true;
  // localhost is also considered secure
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1';
}

export function isLikelyInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  // Common in-app browser identifiers
  return /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Line|MicroMessenger|Twitter|TikTok/i.test(ua);
}

export function getInAppBrowserName(): string | null {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent || '';
  if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(ua)) return 'Facebook';
  if (/Instagram/i.test(ua)) return 'Instagram';
  if (/MicroMessenger/i.test(ua)) return 'WeChat';
  if (/Line\//i.test(ua)) return 'Line';
  if (/TikTok/i.test(ua)) return 'TikTok';
  return null;
}

export async function checkMicCapability(): Promise<MicCapability> {
  if (!isSecureContextAvailable()) {
    return {
      ok: false,
      reason: 'insecure',
      message: trNow('ভয়েস ফিচারের জন্য HTTPS সংযোগ দরকার। সাইটটি secure URL-এ খুলুন।', 'Voice needs a secure (HTTPS) connection. Open the site on its secure address.'),
    };
  }
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    const inApp = getInAppBrowserName();
    if (inApp) {
      return {
        ok: false,
        reason: 'in-app',
        message: trNow(`${inApp} ব্রাউজারে ভয়েস কাজ করে না। মেনু (⋯) থেকে "Open in Chrome/Safari" দিয়ে খুলুন।`, `Voice does not work in the ${inApp} browser. Open it with "Open in Chrome/Safari" from the menu (⋯).`),
      };
    }
    return {
      ok: false,
      reason: 'no-api',
      message: trNow('এই ব্রাউজারে ভয়েস ফিচার সাপোর্ট নেই। Chrome বা Safari ব্যবহার করুন।', 'This browser does not support voice. Please use Chrome or Safari.'),
    };
  }
  // Permission API pre-check (best-effort, not all browsers support)
  try {
    if ((navigator as any).permissions?.query) {
      const status = await (navigator as any).permissions.query({ name: 'microphone' as PermissionName });
      if (status.state === 'denied') {
        return {
          ok: false,
          reason: 'permission-denied',
          message: trNow('মাইক্রোফোন আগে থেকে ব্লক করা আছে। ব্রাউজার সেটিংস (🔒 আইকন) থেকে allow করুন।', 'The microphone is blocked. Allow it in the browser settings (🔒 icon).'),
        };
      }
    }
  } catch { /* permissions API may throw — ignore and try getUserMedia */ }
  return { ok: true };
}

export function micErrorMessage(err: any): string {
  const name = err?.name || '';
  const inApp = getInAppBrowserName();
  const inAppHint = inApp ? trNow(` (${inApp} ব্রাউজারে কাজ নাও করতে পারে — Chrome/Safari-তে খুলুন)`, ` (may not work in the ${inApp} browser — open it in Chrome/Safari)`) : '';

  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return trNow(`মাইক্রোফোন permission দিন: URL bar-এর 🔒 আইকনে ক্লিক → Microphone → Allow → পেজ refresh করুন।${inAppHint}`, `Allow the microphone: tap the 🔒 icon in the address bar → Microphone → Allow → refresh the page.${inAppHint}`);
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return trNow(`মাইক্রোফোন পাওয়া যাচ্ছে না। ১) ব্রাউজার সেটিংসে মাইক allow আছে কিনা দেখুন, ২) অন্য ট্যাব/অ্যাপ মাইক ব্যবহার বন্ধ করুন, ৩) "Open in new tab" দিয়ে সরাসরি সাইটে খুলুন।${inAppHint}`, `No microphone found. 1) Check the microphone is allowed in the browser settings, 2) close other tabs/apps using it, 3) open the site directly with "Open in new tab".${inAppHint}`);
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return trNow('মাইক্রোফোন অন্য অ্যাপ ব্যবহার করছে — সেটি বন্ধ করে আবার চেষ্টা করুন।', 'Another app is using the microphone — close it and try again.');
  }
  if (name === 'OverconstrainedError') {
    return trNow('মাইক্রোফোন কনফিগারেশন সমস্যা — পেজ refresh করুন।', 'Microphone set-up problem — refresh the page.');
  }
  if (name === 'AbortError') {
    return trNow('মাইক্রোফোন অ্যাক্সেস বাতিল হয়েছে।', 'Microphone access was cancelled.');
  }
  return (err?.message ? `${err.message}` : trNow('মাইক্রোফোন চালু করা যায়নি।', 'Could not turn on the microphone.')) + inAppHint;
}
