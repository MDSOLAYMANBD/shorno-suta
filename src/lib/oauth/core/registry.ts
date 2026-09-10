// Provider capability + lifecycle registry. Drives UI decisions (which features
// to surface), reconnect strategy, token-refresh expectations, and health checks.
//
// Adding a new provider here is the first step to onboarding it — actual
// `buildAuthUrl` lives in `providers/<name>.ts`.

export interface ProviderCapabilities {
  dm: boolean;
  comments: boolean;
  realtime: boolean;
  multiAsset: boolean;
  embeddedSignup: boolean;
}

export type ReconnectStrategy = 'oauth' | 'embedded_signup' | 'manual';
export type TokenType = 'long_lived' | 'refresh_token' | 'system_user' | 'none';

export interface ProviderDescriptor {
  id: string;
  displayName: string;
  scopes: string[];
  capabilities: ProviderCapabilities;
  reconnect: { strategy: ReconnectStrategy; cooldownMs: number; maxRetries: number };
  tokenRefresh: { supported: boolean; type: TokenType; preExpiryHours: number };
  health: { intervalMs: number; degradedAfterFails: number };
  /** If false: appears in registry for capability lookup but no Connect button. */
  launchable: boolean;
}

const FB_SCOPES = ['pages_show_list', 'pages_manage_metadata', 'pages_messaging', 'pages_read_engagement', 'pages_messaging_subscriptions'];
const IG_SCOPES = ['pages_show_list', 'pages_manage_metadata', 'pages_messaging', 'instagram_basic', 'instagram_manage_messages', 'instagram_manage_comments'];
const WA_SCOPES = ['whatsapp_business_management', 'whatsapp_business_messaging', 'business_management'];

export const PROVIDER_REGISTRY: Record<string, ProviderDescriptor> = {
  messenger: {
    id: 'messenger',
    displayName: 'Facebook Messenger',
    scopes: FB_SCOPES,
    capabilities: { dm: true, comments: true, realtime: true, multiAsset: true, embeddedSignup: false },
    reconnect: { strategy: 'oauth', cooldownMs: 60_000, maxRetries: 3 },
    tokenRefresh: { supported: true, type: 'long_lived', preExpiryHours: 168 },
    health: { intervalMs: 5 * 60_000, degradedAfterFails: 2 },
    launchable: true,
  },
  instagram: {
    id: 'instagram',
    displayName: 'Instagram',
    scopes: IG_SCOPES,
    capabilities: { dm: true, comments: true, realtime: true, multiAsset: true, embeddedSignup: false },
    reconnect: { strategy: 'oauth', cooldownMs: 60_000, maxRetries: 3 },
    tokenRefresh: { supported: true, type: 'long_lived', preExpiryHours: 168 },
    health: { intervalMs: 5 * 60_000, degradedAfterFails: 2 },
    launchable: true,
  },
  whatsapp: {
    id: 'whatsapp',
    displayName: 'WhatsApp Business',
    scopes: WA_SCOPES,
    capabilities: { dm: true, comments: false, realtime: true, multiAsset: true, embeddedSignup: true },
    reconnect: { strategy: 'embedded_signup', cooldownMs: 60_000, maxRetries: 3 },
    tokenRefresh: { supported: true, type: 'system_user', preExpiryHours: 168 },
    health: { intervalMs: 5 * 60_000, degradedAfterFails: 2 },
    launchable: true,
  },
  // ─── Future providers (capability-only stubs) ─────────────────────────
  telegram: {
    id: 'telegram',
    displayName: 'Telegram',
    scopes: [],
    capabilities: { dm: true, comments: false, realtime: true, multiAsset: true, embeddedSignup: false },
    reconnect: { strategy: 'manual', cooldownMs: 0, maxRetries: 0 },
    tokenRefresh: { supported: false, type: 'none', preExpiryHours: 0 },
    health: { intervalMs: 10 * 60_000, degradedAfterFails: 2 },
    launchable: false,
  },
  tiktok: {
    id: 'tiktok',
    displayName: 'TikTok',
    scopes: [],
    capabilities: { dm: true, comments: true, realtime: false, multiAsset: true, embeddedSignup: false },
    reconnect: { strategy: 'oauth', cooldownMs: 60_000, maxRetries: 3 },
    tokenRefresh: { supported: true, type: 'refresh_token', preExpiryHours: 168 },
    health: { intervalMs: 30 * 60_000, degradedAfterFails: 2 },
    launchable: false,
  },
  google_business_messages: {
    id: 'google_business_messages',
    displayName: 'Google Business Messages',
    scopes: [],
    capabilities: { dm: true, comments: false, realtime: true, multiAsset: true, embeddedSignup: false },
    reconnect: { strategy: 'oauth', cooldownMs: 60_000, maxRetries: 3 },
    tokenRefresh: { supported: true, type: 'refresh_token', preExpiryHours: 168 },
    health: { intervalMs: 30 * 60_000, degradedAfterFails: 2 },
    launchable: false,
  },
  viber: {
    id: 'viber',
    displayName: 'Viber',
    scopes: [],
    capabilities: { dm: true, comments: false, realtime: true, multiAsset: false, embeddedSignup: false },
    reconnect: { strategy: 'manual', cooldownMs: 0, maxRetries: 0 },
    tokenRefresh: { supported: false, type: 'none', preExpiryHours: 0 },
    health: { intervalMs: 30 * 60_000, degradedAfterFails: 2 },
    launchable: false,
  },
  line: {
    id: 'line',
    displayName: 'LINE',
    scopes: [],
    capabilities: { dm: true, comments: false, realtime: true, multiAsset: true, embeddedSignup: false },
    reconnect: { strategy: 'oauth', cooldownMs: 60_000, maxRetries: 3 },
    tokenRefresh: { supported: true, type: 'long_lived', preExpiryHours: 168 },
    health: { intervalMs: 30 * 60_000, degradedAfterFails: 2 },
    launchable: false,
  },
};

// Back-compat: existing UI imports PROVIDER_CAPABILITIES.
export const PROVIDER_CAPABILITIES: Record<string, ProviderCapabilities> = Object.fromEntries(
  Object.entries(PROVIDER_REGISTRY).map(([k, v]) => [k, v.capabilities]),
);

export function getProvider(id: string): ProviderDescriptor | null {
  return PROVIDER_REGISTRY[id] || null;
}
