// Single source of truth for the Meta OAuth canonical origin.
// Meta App Console must whitelist EXACTLY these values:
//   App Domains:               shornosuta.com
//   Valid OAuth Redirect URI:  https://www.shornosuta.com/admin/oauth/callback
export const META_CANONICAL_ORIGIN = 'https://www.shornosuta.com';
export const META_REDIRECT_URI = `${META_CANONICAL_ORIGIN}/admin/oauth/callback`;
export const META_INTEGRATIONS_PATH = '/admin/smart-inbox/integrations';

export function isCanonicalOrigin(): boolean {
  try { return window.location.origin === META_CANONICAL_ORIGIN; } catch { return false; }
}

export function canonicalIntegrationsUrl(autoOpen?: string): string {
  const base = `${META_CANONICAL_ORIGIN}${META_INTEGRATIONS_PATH}`;
  return autoOpen ? `${base}?autoOpen=${encodeURIComponent(autoOpen)}` : base;
}
