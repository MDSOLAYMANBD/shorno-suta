import type { BuiltOAuthUrl, OAuthLaunchContext, OAuthProviderDef } from '../core/types';
import { PROVIDER_REGISTRY } from '../core/registry';

export interface WhatsAppProviderConfig {
  appId: string;
  configId: string; // WhatsApp Embedded Signup configuration ID
}

export function buildWhatsAppProvider(cfg: WhatsAppProviderConfig): OAuthProviderDef {
  const scope = PROVIDER_REGISTRY.whatsapp.scopes.join(',');
  const base = 'https://www.facebook.com/v21.0/dialog/oauth';
  return {
    id: 'whatsapp',
    exchangeFunction: 'whatsapp-oauth-exchange',
    buildAuthUrl: (ctx: OAuthLaunchContext): BuiltOAuthUrl => {
      const params: Record<string, string> = {
        client_id: cfg.appId,
        redirect_uri: ctx.redirectUri,
        state: ctx.state,
        scope,
        response_type: 'code',
        config_id: cfg.configId,
        override_default_response_type: 'true',
      };
      const usp = new URLSearchParams();
      const encodedParams: Record<string, string> = {};
      for (const [k, v] of Object.entries(params)) {
        if (!v) continue;
        usp.set(k, v);
        encodedParams[k] = encodeURIComponent(v);
      }
      return {
        url: `${base}?${usp.toString()}`,
        base,
        flow: 'wa_embedded_signup',
        params,
        encodedParams,
      };
    },
  };
}
