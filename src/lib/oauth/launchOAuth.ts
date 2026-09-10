// Back-compat shim. Existing call sites import { launchOAuth } from here;
// internally it now delegates to the provider-abstracted core launcher.
import { launch, OAUTH_RESULT_STORAGE_KEY } from './core/launch';
import { buildMetaProvider } from './providers/meta';
import { buildWhatsAppProvider } from './providers/whatsapp';
import type { OAuthPlatform, OAuthResult } from './core/types';
import { META_CANONICAL_ORIGIN } from './canonical';

export type { OAuthPlatform, OAuthResult };

export interface LaunchOptions {
  platform: OAuthPlatform;
  appId: string;
  igConfigId?: string;
  igEmbedUrl?: string;
  waConfigId?: string;
  mode?: 'connect' | 'reconnect';
  assetId?: string;
}

export function launchOAuth(opts: LaunchOptions): Promise<OAuthResult> {
  if (opts.platform === 'whatsapp') {
    return launch({
      provider: buildWhatsAppProvider({ appId: opts.appId, configId: opts.waConfigId || '' }),
      mode: opts.mode,
      assetId: opts.assetId,
    });
  }
  return launch({
    provider: buildMetaProvider(
      { appId: opts.appId, igConfigId: opts.igConfigId, igEmbedUrl: opts.igEmbedUrl },
      opts.platform,
    ),
    mode: opts.mode,
    assetId: opts.assetId,
  });
}

export { OAUTH_RESULT_STORAGE_KEY };
export const OAUTH_LAST_URL_KEY = 'sd_last_oauth_url';
export const OAUTH_LAST_REDIRECT_KEY = 'sd_last_oauth_redirect_uri';
export const OAUTH_CANONICAL_ORIGIN = META_CANONICAL_ORIGIN;
