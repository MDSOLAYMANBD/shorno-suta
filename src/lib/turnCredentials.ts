// Fetches an ICE server list (STUN + TURN) for WebRTC voice calls.
// Cached in-memory for 1 hour because Metered credentials are short-lived
// but easily outlive any single call.
//
// Falls back to public Google STUN + OpenRelay TURN so calls still
// have a chance to connect even if the edge function or network is down.
import { supabase } from '@/integrations/supabase/client';

const FALLBACK_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
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

const CACHE_TTL_MS = 60 * 60 * 1000;
let cache: { servers: RTCIceServer[]; expiresAt: number } | null = null;
let inflight: Promise<RTCIceServer[]> | null = null;

export async function getIceServers(): Promise<RTCIceServer[]> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.servers;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-turn-credentials');
      if (error || !data?.iceServers || !Array.isArray(data.iceServers) || data.iceServers.length === 0) {
        console.warn('[turn] using fallback ICE servers', error);
        cache = { servers: FALLBACK_ICE_SERVERS, expiresAt: now + 60_000 };
        return FALLBACK_ICE_SERVERS;
      }
      const servers = data.iceServers as RTCIceServer[];
      cache = { servers, expiresAt: now + CACHE_TTL_MS };
      console.log('[turn] loaded ICE servers from', data.source, '— count:', servers.length);
      return servers;
    } catch (e) {
      console.warn('[turn] fetch failed, using fallback', e);
      cache = { servers: FALLBACK_ICE_SERVERS, expiresAt: now + 60_000 };
      return FALLBACK_ICE_SERVERS;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

// True if the ICE server list contains at least one TURN entry.
// Used to flip `iceTransportPolicy` to 'relay' so calls survive symmetric NAT
// (typical of mobile carrier networks). When only STUN is available we keep
// 'all' so host candidates can still connect direct LAN peers.
export function hasTurnServer(servers: RTCIceServer[]): boolean {
  return servers.some((s) => {
    const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
    return urls.some((u) => typeof u === 'string' && (u.startsWith('turn:') || u.startsWith('turns:')));
  });
}

// Logs a count of host/srflx/relay candidates after gathering completes.
// Helps diagnose why a call is failing — if we see 0 relay candidates on a
// mobile network it almost always means TURN is unreachable.
export function logCandidateBreakdown(pc: RTCPeerConnection, label: string) {
  let host = 0, srflx = 0, relay = 0, prflx = 0;
  pc.getTransceivers().forEach(() => { /* keep noop to satisfy TS */ });
  // Use stats API after gathering complete.
  pc.getStats().then((stats) => {
    stats.forEach((s: any) => {
      if (s.type === 'local-candidate') {
        if (s.candidateType === 'host') host++;
        else if (s.candidateType === 'srflx') srflx++;
        else if (s.candidateType === 'relay') relay++;
        else if (s.candidateType === 'prflx') prflx++;
      }
    });
    console.log(`[${label}] local candidates — host:${host} srflx:${srflx} relay:${relay} prflx:${prflx}`);
    if (relay === 0) console.warn(`[${label}] NO RELAY CANDIDATES — TURN server unreachable. Mobile-to-mobile calls will likely fail.`);
  }).catch(() => { /* ignore */ });
}

// Optional: log the selected candidate pair after connection so we can
// confirm whether TURN relay was actually used (helps future debugging).
export async function logSelectedCandidatePair(pc: RTCPeerConnection, label: string) {
  try {
    const stats = await pc.getStats();
    stats.forEach((s: any) => {
      if (s.type === 'candidate-pair' && s.state === 'succeeded' && s.nominated) {
        const local = stats.get(s.localCandidateId);
        const remote = stats.get(s.remoteCandidateId);
        console.log(`[${label}] selected pair — local:`, local?.candidateType, local?.protocol,
          '· remote:', remote?.candidateType, remote?.protocol);
      }
    });
  } catch { /* ignore */ }
}
