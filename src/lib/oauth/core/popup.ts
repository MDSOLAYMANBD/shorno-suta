// Popup helper with full-page-redirect fallback when the browser blocks popups.
import { toast } from 'sonner';

export interface PopupResult {
  window: Window | null;
  blocked: boolean;
  fellBackToFullPage: boolean;
}

function isInIframe(): boolean {
  try { return window.top !== window.self; } catch { return true; }
}

export function openOAuthPopup(url: string): PopupResult {
  const inIframe = isInIframe();
  const target = inIframe ? '_blank' : 'sd_oauth_popup';
  const features = inIframe
    ? 'noopener'
    : 'popup=yes,width=620,height=740,menubar=no,toolbar=no,location=yes,status=no';

  let win: Window | null = null;
  try { win = window.open(url, target, features); } catch { win = null; }

  const blocked = !win || win.closed;
  if (blocked) {
    toast.message('Popup blocked by browser — continuing in full page');
    try { window.location.assign(url); } catch {}
    return { window: null, blocked: true, fellBackToFullPage: true };
  }
  return { window: win, blocked: false, fellBackToFullPage: false };
}
