// Returns a fresh list of ICE servers (STUN + TURN UDP/TCP/TLS) for the
// live-chat voice call feature. Without TURN, mobile-to-mobile calls on
// CGNAT networks (most BD carriers) fail to route audio. This function
// keeps the Metered API key server-side and exposes only short-lived
// per-call credentials to the browser.
//
// Behavior:
//  - If METERED_APP_NAME + METERED_API_KEY are set → fetch from Metered.
//  - Otherwise → return a STUN-only fallback so callers on friendly NATs
//    still work (no hard failure).
//
// Public (verify_jwt = false) so anonymous chat visitors can fetch creds.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const FALLBACK_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  // OpenRelay public TURN — free, rate-limited, but a useful fallback
  // when a project hasn't configured Metered yet. Works for low-volume
  // testing and emergencies.
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const appName = Deno.env.get('METERED_APP_NAME');
    const apiKey = Deno.env.get('METERED_API_KEY');

    if (!appName || !apiKey) {
      // No paid TURN configured — return public OpenRelay + STUN fallback.
      return new Response(
        JSON.stringify({ iceServers: FALLBACK_ICE_SERVERS, source: 'fallback' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const url = `https://${appName}.metered.live/api/v1/turn/credentials?apiKey=${apiKey}`;
    const res = await fetch(url, { method: 'GET' });

    if (!res.ok) {
      console.warn('[get-turn-credentials] Metered API error', res.status);
      return new Response(
        JSON.stringify({ iceServers: FALLBACK_ICE_SERVERS, source: 'fallback-after-error' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const iceServers = await res.json();
    return new Response(
      JSON.stringify({ iceServers, source: 'metered' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[get-turn-credentials] error', err);
    return new Response(
      JSON.stringify({ iceServers: FALLBACK_ICE_SERVERS, source: 'fallback-after-exception' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
