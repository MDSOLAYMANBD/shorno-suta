import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { OAuthErrorCard, parseMetaError, type ParsedError } from '@/components/admin/integrations/OAuthErrorCard';
import { OAUTH_RESULT_STORAGE_KEY } from '@/lib/oauth/launchOAuth';
import { META_CANONICAL_ORIGIN, META_REDIRECT_URI, isCanonicalOrigin } from '@/lib/oauth/canonical';
import { verifyState, decodeState } from '@/lib/oauth/core/state';
import { updateAttempt, findLatestForPlatform } from '@/lib/oauth/core/diagnostics';

type Platform = 'facebook' | 'instagram' | 'whatsapp';
type PageOpt = { id: string; name: string; picture?: string };

function parseState(s: string | null): { platform: Platform; ts: number; popup?: boolean } | null {
  if (!s) return null;
  // Try legacy base64-JSON format first.
  try {
    const obj = JSON.parse(atob(s));
    if (obj && obj.platform) return obj;
  } catch {}
  const d = decodeState(s);
  return d ? { platform: d.platform, ts: d.ts } : null;
}

function isPopupContext(): boolean {
  try { return !!window.opener && window.opener !== window; } catch { return false; }
}

function notifyOpener(payload: { ok: boolean; platform: Platform; error?: string }) {
  // Storage event (cross-tab) — works even when opener reference is lost.
  try {
    localStorage.setItem(OAUTH_RESULT_STORAGE_KEY, JSON.stringify(payload));
  } catch {}
  // Direct postMessage to opener if available.
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({ type: 'oauth:done', ...payload }, '*');
    }
  } catch {}
}

export default function AdminOAuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'working' | 'success' | 'error' | 'pick_page'>('working');
  const [message, setMessage] = useState('Connecting…');
  const [errorObj, setErrorObj] = useState<ParsedError | null>(null);
  const [pages, setPages] = useState<PageOpt[]>([]);
  const [platform, setPlatform] = useState<Platform>('facebook');
  const codeRef = useRef<string>('');
  const redirectUriRef = useRef<string>('');
  const ranRef = useRef(false);

  const popupMode = useRef<boolean>(false);

  const goBack = () => navigate('/admin/smart-inbox/integrations', { replace: true });

  const closeOrBack = () => {
    if (popupMode.current) {
      try { window.close(); } catch {}
    } else {
      goBack();
    }
  };

  const finishOk = (msg: string, p: Platform) => {
    setStatus('success'); setMessage(msg); toast.success(msg);
    if (popupMode.current) {
      notifyOpener({ ok: true, platform: p });
      setTimeout(() => { try { window.close(); } catch {} }, 600);
    } else {
      setTimeout(goBack, 1200);
    }
  };
  const finishErr = (msg: string, parsed?: ParsedError, p?: Platform) => {
    setStatus('error'); setMessage(msg); setErrorObj(parsed || null); toast.error(msg);
    if (popupMode.current && p) {
      notifyOpener({ ok: false, platform: p, error: msg });
      // Keep popup open so user can read the error and retry. Provide explicit close button.
    }
  };

  const exchange = async (p: Platform, code: string, redirect_uri: string, selected_page_id?: string) => {
    const fnName = p === 'whatsapp' ? 'whatsapp-oauth-exchange' : 'meta-oauth-exchange';
    const { data, error } = await supabase.functions.invoke(fnName, {
      body: { code, redirect_uri, platform: p, selected_page_id },
    });
    if (error) throw new Error(error.message || 'Exchange failed');
    if ((data as any)?.error) throw new Error((data as any).error);
    if ((data as any)?.needs_page_selection) {
      setPages((data as any).pages || []);
      setStatus('pick_page');
      setMessage('একটি Page বেছে নিন');
      return;
    }
    finishOk(`${p === 'whatsapp' ? 'WhatsApp' : p === 'instagram' ? 'Instagram' : 'Facebook'} connected!`, p);
  };

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    // Safety: never run inside an iframe — escape to top-level.
    try {
      if (window.top && window.top !== window.self) {
        window.top.location.href = window.location.href;
        return;
      }
    } catch {
      try { window.open(window.location.href, '_top'); } catch {}
    }

    // Hard-enforce canonical origin. If the callback ever lands on a non-canonical
    // host (preview, lovable.app, localhost), redirect to the canonical host
    // preserving query params so token exchange works.
    if (!isCanonicalOrigin()) {
      const target = META_CANONICAL_ORIGIN + window.location.pathname + window.location.search;
      window.location.replace(target);
      return;
    }

    (async () => {
      const url = new URL(window.location.href);
      const params = url.searchParams;
      const code = params.get('code');
      const stateRaw = params.get('state');
      const st = parseState(stateRaw);

      popupMode.current = isPopupContext() || !!st?.popup;

      // Broadcast diagnostics back to opener so the integrations diagnostics card
      // can show popup origin + callback origin.
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({
            type: 'oauth:diag',
            popup_origin: window.location.origin,
            callback_origin: window.location.origin,
            href: window.location.href,
          }, '*');
        }
      } catch {}

      // Meta returned an explicit OAuth error
      if (params.get('error') || params.get('error_code') || params.get('error_message') || params.get('error_description')) {
        const parsed = parseMetaError(params);
        finishErr(parsed.title, parsed, st?.platform);
        return;
      }
      if (!code || !st) return finishErr('OAuth callback এ code/state নেই — আবার চেষ্টা করুন');
      if (Date.now() - st.ts > 10 * 60 * 1000) return finishErr('OAuth state expired — try again', undefined, st.platform);

      // CSRF state verification (new format only — legacy base64 state passes through).
      const verify = verifyState(stateRaw);
      if (!verify.ok && verify.reason && verify.reason !== 'state_malformed') {
        // state_malformed means it's the legacy format we already validated above.
        const reasonMsg: Record<string, string> = {
          state_missing: 'Security check failed — no matching state found in this browser session',
          state_mismatch: 'Security check failed — state mismatch (possible CSRF or popup confusion)',
          state_expired: 'Security check failed — state expired, please retry',
        };
        return finishErr(reasonMsg[verify.reason] || 'Security check failed', undefined, st.platform);
      }

      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) return finishErr('Login required — please sign in as admin first', undefined, st.platform);

      // ALWAYS use canonical redirect_uri — must match what Meta received exactly.
      const redirectUri = META_REDIRECT_URI;
      codeRef.current = code;
      redirectUriRef.current = redirectUri;
      setPlatform(st.platform);
      setMessage(`Connecting ${st.platform}…`);
      try {
        await exchange(st.platform, code, redirectUri);
        // Mark diagnostics history success (best-effort).
        try {
          const last = findLatestForPlatform(st.platform);
          if (last) updateAttempt(last.id, { callback_status: 'success', exchange_status: 'success' });
        } catch {}
        // Trigger asset auto-discovery (best-effort — non-blocking).
        try { await supabase.functions.invoke('meta-asset-discovery', { body: { platform: st.platform } }); } catch {}
        // WhatsApp: enrich with WABA + phone metadata + webhook subscription.
        if (st.platform === 'whatsapp') {
          try {
            const wabaHint = params.get('waba_id') || undefined;
            const phoneHint = params.get('phone_number_id') || undefined;
            await supabase.functions.invoke('whatsapp-embedded-signup-complete', {
              body: { waba_id: wabaHint, phone_number_id: phoneHint },
            });
          } catch {}
        }
      } catch (e: any) {
        const msg = e?.message || 'Connection failed';
        try {
          const last = findLatestForPlatform(st.platform);
          if (last) updateAttempt(last.id, { callback_status: 'success', exchange_status: 'error', error_message: msg });
        } catch {}
        finishErr(msg, { title: msg, steps: ['আবার Connect চাপুন বা Diagnostics দেখুন'], raw: msg }, st.platform);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickPage = async (pageId: string) => {
    setStatus('working'); setMessage('Subscribing page…');
    try {
      await exchange(platform, codeRef.current, redirectUriRef.current, pageId);
    } catch (e: any) {
      const msg = e?.message || 'Page selection failed';
      finishErr(msg, { title: msg, steps: ['আবার চেষ্টা করুন'], raw: msg }, platform);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 pb-6 space-y-4">
          {status === 'working' && (
            <div className="text-center space-y-3">
              <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
              <div className="font-medium">{message}</div>
              <p className="text-xs text-muted-foreground">দয়া করে অপেক্ষা করুন…</p>
            </div>
          )}
          {status === 'success' && (
            <div className="text-center space-y-3">
              <CheckCircle2 className="h-10 w-10 mx-auto text-green-600" />
              <div className="font-medium">{message}</div>
              {popupMode.current && (
                <p className="text-xs text-muted-foreground">এই উইন্ডো বন্ধ হয়ে যাবে…</p>
              )}
            </div>
          )}
          {status === 'error' && errorObj && (
            <OAuthErrorCard err={errorObj} onBack={closeOrBack} onRetry={closeOrBack} />
          )}
          {status === 'error' && !errorObj && (
            <div className="text-center space-y-3">
              <div className="font-medium text-destructive whitespace-pre-line text-sm">{message}</div>
              <Button onClick={closeOrBack}>{popupMode.current ? 'Close window' : 'Back to Integrations'}</Button>
            </div>
          )}
          {status === 'pick_page' && (
            <>
              <div className="font-semibold text-center">{message}</div>
              <div className="space-y-2 max-h-[360px] overflow-y-auto">
                {pages.map(p => (
                  <button
                    key={p.id}
                    onClick={() => pickPage(p.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-accent text-left"
                  >
                    {p.picture && <img src={p.picture} alt="" className="w-10 h-10 rounded-full" />}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{p.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{p.id}</div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
