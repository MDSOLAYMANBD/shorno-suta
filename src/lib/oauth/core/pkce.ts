// PKCE helper. Meta currently uses server-side app-secret exchange and does
// NOT require PKCE, but we keep this module so future providers
// (TikTok, Google, Shopify) can opt-in via OAuthProviderDef.
import type { PkcePair } from './types';

function base64url(bytes: ArrayBuffer): string {
  const b = btoa(String.fromCharCode(...new Uint8Array(bytes)));
  return b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function createPkcePair(): Promise<PkcePair> {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  const verifier = base64url(arr.buffer);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: base64url(digest), method: 'S256' };
}
