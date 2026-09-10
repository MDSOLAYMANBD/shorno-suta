// Validates a built OAuth URL against Meta protocol expectations.
// Pure / no side effects — returns a structured report.

import { META_REDIRECT_URI, META_CANONICAL_ORIGIN } from '../canonical';
import { decodeState } from './state';
import type { BuiltOAuthUrl, OAuthValidationReport } from './types';

const FORBIDDEN_HOST_FRAGMENTS = ['lovable.app', 'lovableproject.com', 'localhost', '127.0.0.1', 'id-preview'];

export function validateOAuthUrl(built: BuiltOAuthUrl, expectedPlatform: string): OAuthValidationReport {
  const issues: OAuthValidationReport['issues'] = [];
  const ok = (id: string, label: string) => issues.push({ id, level: 'ok', label });
  const warn = (id: string, label: string, detail?: string) => issues.push({ id, level: 'warn', label, detail });
  const fail = (id: string, label: string, detail?: string) => issues.push({ id, level: 'fail', label, detail });

  const params = built.params;

  // 1. client_id present
  if (params.client_id) ok('client_id', `client_id present (${params.client_id.slice(0, 6)}…)`);
  else fail('client_id', 'client_id missing', 'Meta App ID is empty — set it in Developer Settings.');

  // 2. redirect_uri exact match
  if (params.redirect_uri === META_REDIRECT_URI) {
    ok('redirect_uri_exact', `redirect_uri matches canonical (${META_REDIRECT_URI})`);
  } else {
    fail('redirect_uri_exact', 'redirect_uri mismatch',
      `Sent: ${params.redirect_uri || '(empty)'} · Expected: ${META_REDIRECT_URI}`);
  }

  // 3. redirect_uri host
  try {
    const host = new URL(params.redirect_uri || '').host;
    const bad = FORBIDDEN_HOST_FRAGMENTS.find(f => host.includes(f));
    if (bad) fail('redirect_uri_host', `redirect_uri host leaks "${bad}"`, host);
    else if (host === new URL(META_CANONICAL_ORIGIN).host) ok('redirect_uri_host', `redirect_uri host = ${host}`);
    else warn('redirect_uri_host', `redirect_uri host = ${host}`, 'Not the canonical host.');
  } catch {
    fail('redirect_uri_host', 'redirect_uri is not a valid URL');
  }

  // 4. trailing slash
  if (params.redirect_uri && params.redirect_uri.endsWith('/') && !META_REDIRECT_URI.endsWith('/')) {
    fail('redirect_uri_slash', 'redirect_uri has unexpected trailing slash');
  } else {
    ok('redirect_uri_slash', 'no trailing-slash mismatch');
  }

  // 5. duplicate param keys / double encoding — re-parse the final URL
  try {
    const u = new URL(built.url);
    const seenDup: string[] = [];
    const seen = new Set<string>();
    u.searchParams.forEach((_, k) => {
      if (seen.has(k)) seenDup.push(k); else seen.add(k);
    });
    if (seenDup.length) fail('duplicate_params', `Duplicate query keys: ${seenDup.join(', ')}`);
    else ok('duplicate_params', 'no duplicate query keys');

    // Double-encoding check on redirect_uri specifically
    const ru = u.searchParams.get('redirect_uri') || '';
    if (ru.includes('%25')) fail('double_encoding', 'redirect_uri appears double-encoded', ru);
    else ok('double_encoding', 'no double-encoding detected');
  } catch (e: any) {
    fail('parse_url', 'Final URL failed to parse', String(e?.message || e));
  }

  // 6. response_type
  if (built.flow === 'wa_embedded_signup' || built.flow === 'fb_login_for_business') {
    if (params.response_type === 'code' && params.override_default_response_type === 'true') {
      ok('response_type', 'response_type=code + override_default_response_type=true');
    } else {
      warn('response_type', 'FB Login for Business expects override_default_response_type=true');
    }
  } else if (built.flow === 'ig_embed_url') {
    ok('response_type', '(controlled by IG embed configuration)');
  } else {
    if (params.response_type === 'code') ok('response_type', 'response_type=code');
    else fail('response_type', `response_type=${params.response_type || '(missing)'}`);
  }

  // 7. state decode
  const decoded = decodeState(params.state || null);
  if (!decoded) fail('state_decode', 'state failed to decode');
  else if (decoded.platform !== expectedPlatform) fail('state_platform', `state.platform=${decoded.platform} ≠ ${expectedPlatform}`);
  else ok('state_decode', `state decodes (platform=${decoded.platform})`);

  // 8. config_id sanity for FB Login for Business
  if (built.flow === 'fb_login_for_business' && !params.config_id) {
    fail('config_id', 'FB Login for Business flow requires config_id');
  } else if (params.config_id) {
    ok('config_id', `config_id=${params.config_id.slice(0, 6)}…`);
  }

  // 9. classic FB Login warning
  if (built.flow === 'fb_login_classic') {
    warn('flow_deprecation', 'Using classic FB Login (scope-based)',
      'New Meta apps require Facebook Login for Business — set a config_id to upgrade.');
  }

  const fails = issues.filter(i => i.level === 'fail').length;
  const warns = issues.filter(i => i.level === 'warn').length;
  return {
    flow: built.flow,
    issues,
    summary: { ok: issues.length - fails - warns, warn: warns, fail: fails },
    hardFail: fails > 0,
  };
}
