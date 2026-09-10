// Generic OAuth launcher with canonical-domain lockdown, CSRF state, popup
// fallback to full-page, and diagnostics history persistence.

import {
  META_CANONICAL_ORIGIN,
  META_REDIRECT_URI,
  isCanonicalOrigin,
  canonicalIntegrationsUrl,
} from '../canonical';
import { generateState } from './state';
import { openOAuthPopup } from './popup';
import { recordLaunch, updateAttempt } from './diagnostics';
import { validateOAuthUrl } from './validate';
import type { OAuthPlatform, OAuthProviderDef, OAuthResult } from './types';
import {
  beginSession,
  updatePhase,
  endSession,
  isProviderBusy,
  getCooldownRemainingMs,
} from '../sessionManager';

const RESULT_KEY = 'oauth:result';

export interface LaunchArgs {
  provider: OAuthProviderDef;
  mode?: 'connect' | 'reconnect';
  assetId?: string;
}

export function launch({ provider, mode = 'connect', assetId }: LaunchArgs): Promise<OAuthResult> {
  const platform: OAuthPlatform = provider.id;

  // Duplicate-click guard.
  if (isProviderBusy(platform)) {
    return Promise.resolve({ ok: false, platform, error: 'Connection already in progress — please wait.' });
  }
  // Reconnect cooldown after a recent failure.
  const cooldown = getCooldownRemainingMs(platform);
  if (cooldown > 0 && mode === 'reconnect') {
    return Promise.resolve({ ok: false, platform, error: `Please wait ${Math.ceil(cooldown / 1000)}s before retrying.` });
  }

  const session = beginSession(platform, { mode, assetId });

  // STRICT PRODUCTION MODE — never launch Meta from a non-canonical origin.
  if (!isCanonicalOrigin()) {
    const handoff = canonicalIntegrationsUrl(platform);
    recordLaunch({
      platform,
      origin: window.location.origin,
      redirect_uri: META_REDIRECT_URI,
      generated_url: '(handoff) ' + handoff,
    });
    try { window.open(handoff, '_blank', 'noopener'); } catch {}
    return Promise.resolve({
      ok: false,
      platform,
      error: `Opened ${META_CANONICAL_ORIGIN} in a new tab — complete sign-in there.`,
    });
  }

  const state = generateState(platform, META_REDIRECT_URI);
  const built = provider.buildAuthUrl({ platform, redirectUri: META_REDIRECT_URI, state });

  // Validate before launching.
  const report = validateOAuthUrl(built, platform);

  // Verbose console log for debugging.
  try {
    // eslint-disable-next-line no-console
    console.groupCollapsed(`%c[OAuth Launch] ${platform} · ${built.flow}`, 'color:#6366f1;font-weight:bold');
    console.log('Base:', built.base);
    console.table(Object.entries(built.params).map(([k, v]) => ({ key: k, raw: v, encoded: built.encodedParams[k] || '' })));
    console.log('Final URL:', built.url);
    console.log('Validation:', report);
    console.groupEnd();
  } catch {}

  const attemptId = recordLaunch({
    platform,
    origin: window.location.origin,
    redirect_uri: META_REDIRECT_URI,
    generated_url: built.url,
  });
  updateAttempt(attemptId, { flow: built.flow, params: built.params, validation: report });

  if (report.hardFail) {
    const firstFail = report.issues.find(i => i.level === 'fail');
    const msg = `OAuth URL validation failed: ${firstFail?.label || 'unknown'}${firstFail?.detail ? ' — ' + firstFail.detail : ''}`;
    updateAttempt(attemptId, { callback_status: 'error', exchange_status: 'error', error_message: msg });
    endSession(session.id, 'error', msg);
    return Promise.resolve({ ok: false, platform, error: msg });
  }

  try { localStorage.removeItem(RESULT_KEY); } catch {}

  // Mirror generated URL into sessionStorage for diagnostics "last URL" panel.
  try {
    sessionStorage.setItem('sd_last_oauth_url', built.url);
    sessionStorage.setItem('sd_last_oauth_redirect_uri', META_REDIRECT_URI);
  } catch {}

  updatePhase(session.id, 'popup_open');
  const popup = openOAuthPopup(built.url);
  if (popup.blocked) {
    updateAttempt(attemptId, { popup_blocked: true });
    // Full-page fallback navigation in progress — never-resolving promise.
    return new Promise(() => {});
  }

  return new Promise<OAuthResult>((resolve) => {
    let settled = false;
    const finish = (r: OAuthResult) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('message', onMsg);
      window.removeEventListener('storage', onStorage);
      clearInterval(closeTimer);
      try { localStorage.removeItem(RESULT_KEY); } catch {}
      updateAttempt(attemptId, {
        callback_status: r.ok ? 'success' : 'error',
        exchange_status: r.ok ? 'success' : 'error',
        error_message: r.ok ? undefined : (r as { error: string }).error,
      });
      endSession(session.id, r.ok ? 'done' : 'error', r.ok ? undefined : (r as { error: string }).error);
      resolve(r);
    };

    const onMsg = (e: MessageEvent) => {
      if (!e.data || typeof e.data !== 'object') return;
      if ((e.data as any).type !== 'oauth:done') return;
      if (e.origin !== window.location.origin && e.origin !== META_CANONICAL_ORIGIN) return;
      const d = e.data as any;
      finish(d.ok ? { ok: true, platform: d.platform } : { ok: false, platform: d.platform, error: d.error || 'Connection failed' });
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key !== RESULT_KEY || !e.newValue) return;
      try {
        const d = JSON.parse(e.newValue);
        finish(d.ok ? { ok: true, platform: d.platform } : { ok: false, platform: d.platform, error: d.error || 'Connection failed' });
      } catch {}
    };

    window.addEventListener('message', onMsg);
    window.addEventListener('storage', onStorage);

    const closeTimer = window.setInterval(() => {
      if (settled) return;
      try {
        if (popup.window && popup.window.closed) {
          setTimeout(() => finish({ ok: false, platform, error: 'Window closed before completing.' }), 800);
        }
      } catch {}
    }, 1000);
  });
}

export const OAUTH_RESULT_STORAGE_KEY = RESULT_KEY;
