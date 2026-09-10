// Reference OAuth URLs from industry inbox/automation tools, captured for
// side-by-side protocol comparison. App IDs / config IDs are placeholders.

export interface ReferenceOAuthSample {
  vendor: string;
  flow: 'fb_login_for_business' | 'fb_login_classic' | 'wa_embedded_signup';
  url: string;
  notes: string[];
}

export const REFERENCE_OAUTH_SAMPLES: ReferenceOAuthSample[] = [
  {
    vendor: 'REVE Chat',
    flow: 'fb_login_for_business',
    url:
      'https://www.facebook.com/v19.0/dialog/oauth' +
      '?client_id=REVE_APP_ID' +
      '&redirect_uri=' + encodeURIComponent('https://app.revechat.com/oauth/meta/callback') +
      '&state=REVE_STATE' +
      '&response_type=code' +
      '&override_default_response_type=true' +
      '&config_id=REVE_FB_CONFIG_ID',
    notes: [
      'Uses Facebook Login for Business (config_id, no scope).',
      'Always includes override_default_response_type=true.',
    ],
  },
  {
    vendor: 'Respond.io',
    flow: 'fb_login_for_business',
    url:
      'https://www.facebook.com/v18.0/dialog/oauth' +
      '?client_id=RESPOND_APP_ID' +
      '&redirect_uri=' + encodeURIComponent('https://app.respond.io/oauth/facebook/callback') +
      '&state=RESPOND_STATE' +
      '&response_type=code' +
      '&override_default_response_type=true' +
      '&config_id=RESPOND_FB_CONFIG_ID',
    notes: [
      'Same FB Login for Business pattern.',
      'No scope param — entirely driven by the configuration.',
    ],
  },
  {
    vendor: 'ManyChat',
    flow: 'fb_login_classic',
    url:
      'https://www.facebook.com/v18.0/dialog/oauth' +
      '?client_id=MANYCHAT_APP_ID' +
      '&redirect_uri=' + encodeURIComponent('https://manychat.com/fb/callback') +
      '&state=MANYCHAT_STATE' +
      '&response_type=code' +
      '&scope=' + encodeURIComponent('pages_show_list,pages_messaging,pages_manage_metadata,pages_read_engagement,pages_messaging_subscriptions'),
    notes: [
      'Classic FB Login — uses scope param, no config_id.',
      'Older pattern; new Meta apps cannot use this anymore.',
    ],
  },
];
