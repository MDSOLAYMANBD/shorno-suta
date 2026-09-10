// Single source of truth for the Meta OAuth canonical origin.
// Meta App Console must whitelist EXACTLY these values:
//   App Domains:               shorno-suta.vercel.app
//   Valid OAuth Redirect URI:  https://shorno-suta.vercel.app/admin/oauth/callback
// TODO: update to the real domain once one is set (currently the Vercel placeholder).
export const META_CANONICAL_ORIGIN = 'https://shorno-suta.vercel.app';
export const META_REDIRECT_URI = `${META_CANONICAL_ORIGIN}/admin/oauth/callback`;
export const META_INTEGRATIONS_PATH = '/admin/smart-inbox/integrations';

export function isCanonicalOrigin(): boolean {
  try { return window.location.origin === META_CANONICAL_ORIGIN; } catch { return false; }
}

export function canonicalIntegrationsUrl(autoOpen?: string): string {
  const base = `${META_CANONICAL_ORIGIN}${META_INTEGRATIONS_PATH}`;
  return autoOpen ? `${base}?autoOpen=${encodeURIComponent(autoOpen)}` : base;
}
