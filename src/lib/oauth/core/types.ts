export type OAuthPlatform = 'facebook' | 'instagram' | 'whatsapp';

export interface PkcePair {
  verifier: string;
  challenge: string;
  method: 'S256';
}

export interface OAuthLaunchContext {
  platform: OAuthPlatform;
  redirectUri: string;
  state: string;
  pkce?: PkcePair;
  extra?: Record<string, string | undefined>;
}

export type OAuthFlow =
  | 'fb_login_classic'
  | 'fb_login_for_business'
  | 'wa_embedded_signup'
  | 'ig_embed_url';

export interface BuiltOAuthUrl {
  url: string;
  base: string;
  flow: OAuthFlow;
  /** Raw, pre-encoding param values. */
  params: Record<string, string>;
  /** URL-encoded values as they actually appear in the final URL. */
  encodedParams: Record<string, string>;
}

export interface OAuthValidationIssue {
  id: string;
  level: 'ok' | 'warn' | 'fail';
  label: string;
  detail?: string;
}

export interface OAuthValidationReport {
  flow: OAuthFlow;
  issues: OAuthValidationIssue[];
  summary: { ok: number; warn: number; fail: number };
  hardFail: boolean;
}

export interface OAuthProviderDef {
  id: OAuthPlatform;
  buildAuthUrl: (ctx: OAuthLaunchContext) => BuiltOAuthUrl;
  /** Edge function name responsible for server-side code → token exchange. */
  exchangeFunction: string;
}

export interface OAuthResultOk { ok: true; platform: OAuthPlatform }
export interface OAuthResultErr { ok: false; platform: OAuthPlatform; error: string }
export type OAuthResult = OAuthResultOk | OAuthResultErr;

export type HealthStatus =
  | 'unknown'
  | 'connected'
  | 'token_expired'
  | 'permission_missing'
  | 'reconnect_required';

export interface OAuthAttempt {
  id: string;
  ts: number;
  platform: OAuthPlatform;
  origin: string;
  redirect_uri: string;
  generated_url: string;
  popup_blocked?: boolean;
  callback_status?: 'success' | 'error' | 'pending';
  exchange_status?: 'success' | 'error' | 'pending';
  error_code?: string;
  error_message?: string;
  scopes_granted?: string[];
  webhook_subscribed?: boolean;
  flow?: OAuthFlow;
  params?: Record<string, string>;
  validation?: OAuthValidationReport;
}

export interface AssetDiscoveryItem {
  asset_type: 'fb_page' | 'ig_business' | 'waba_phone';
  asset_id: string;
  parent_id?: string;
  display_name: string;
}
