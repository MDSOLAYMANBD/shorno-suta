import type { BuiltOAuthUrl, OAuthFlow, OAuthLaunchContext, OAuthProviderDef } from '../core/types';
import { PROVIDER_REGISTRY } from '../core/registry';

export interface MetaProviderConfig {
  appId: string;
  igConfigId?: string;
  igEmbedUrl?: string;
  /** Optional Facebook Login for Business config_id for Messenger flow. */
  messengerConfigId?: string;
}

function buildUrl(base: string, params: Record<string, string>): { url: string; encoded: Record<string, string> } {
  const usp = new URLSearchParams();
  const encoded: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    usp.set(k, v);
    encoded[k] = encodeURIComponent(v);
  }
  return { url: `${base}?${usp.toString()}`, encoded };
}

export function buildMetaProvider(cfg: MetaProviderConfig, kind: 'facebook' | 'instagram'): OAuthProviderDef {
  const registryKey = kind === 'facebook' ? 'messenger' : 'instagram';
  const scope = PROVIDER_REGISTRY[registryKey].scopes.join(',');
  const base = 'https://www.facebook.com/v21.0/dialog/oauth';

  return {
    id: kind,
    exchangeFunction: 'meta-oauth-exchange',
    buildAuthUrl: (ctx: OAuthLaunchContext): BuiltOAuthUrl => {
      // Instagram via FB Login for Business custom embed URL (preferred when set).
      if (kind === 'instagram' && cfg.igEmbedUrl) {
        const sep = cfg.igEmbedUrl.includes('?') ? '&' : '?';
        const url = `${cfg.igEmbedUrl}${sep}state=${encodeURIComponent(ctx.state)}&redirect_uri=${encodeURIComponent(ctx.redirectUri)}`;
        return {
          url,
          base: cfg.igEmbedUrl.split('?')[0],
          flow: 'ig_embed_url',
          params: { state: ctx.state, redirect_uri: ctx.redirectUri },
          encodedParams: { state: encodeURIComponent(ctx.state), redirect_uri: encodeURIComponent(ctx.redirectUri) },
        };
      }

      // FB Login for Business path — driven by config_id, no scope.
      const businessConfigId = kind === 'instagram' ? cfg.igConfigId : cfg.messengerConfigId;
      if (businessConfigId) {
        const params: Record<string, string> = {
          client_id: cfg.appId,
          redirect_uri: ctx.redirectUri,
          state: ctx.state,
          response_type: 'code',
          override_default_response_type: 'true',
          config_id: businessConfigId,
        };
        const { url, encoded } = buildUrl(base, params);
        return { url, base, flow: 'fb_login_for_business', params, encodedParams: encoded };
      }

      // Classic FB Login fallback (scope-based).
      const params: Record<string, string> = {
        client_id: cfg.appId,
        redirect_uri: ctx.redirectUri,
        state: ctx.state,
        scope,
        response_type: 'code',
      };
      const { url, encoded } = buildUrl(base, params);
      const flow: OAuthFlow = 'fb_login_classic';
      return { url, base, flow, params, encodedParams: encoded };
    },
  };
}
