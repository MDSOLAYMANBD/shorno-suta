// WebRTC voice-call hook for visitor side
// Uses Supabase realtime + DB polling fallback as signaling channel.
//
// Resilience design (do NOT regress):
// - `disconnected` is treated as a TRANSIENT state with a 15s grace timer.
//   WebRTC routinely flickers through `disconnected` for several seconds
//   during ICE rechecks (especially on mobile/CGNAT). Tearing down on the
//   first `disconnected` event was the root cause of "call drops the
//   moment admin accepts".
// - `closed` is ignored unless WE didn't initiate the close (selfClosingRef).
// - `connecting` has a 30s watchdog so a stuck negotiation surfaces a
//   clear, typed error instead of hanging forever.
// - All failure paths set a typed `errorCode` so the dialog can render
//   actionable Bengali copy + a Retry button.
//
// One-way audio fix (customer cannot hear admin):
// - We now create an explicit AUDIO transceiver with direction='sendrecv'
//   and bind the visitor mic to it via `replaceTrack` BEFORE createOffer.
//   Relying on `addTrack()` was non-deterministic — Chrome sometimes left
//   the recv side unhooked from the playing audio element on mobile.
// - Remote audio playback is robustly unlocked via an exposed
//   `enableSpeaker()` action that the UI calls from a real user gesture
//   (mobile autoplay policies routinely keep `<audio>` muted otherwise).
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { checkMicCapability, micErrorMessage } from '@/lib/browserCapability';
import { getIceServers, logSelectedCandidatePair, logCandidateBreakdown, hasTurnServer } from '@/lib/turnCredentials';

export type CallStatus =
  | 'idle'
  | 'initiating'
  | 'ringing'
  | 'waiting'
  | 'connecting'
  | 'in-call'
  | 'ended'
  | 'failed';

export type CallErrorCode =
  | null
  | 'mic-denied'
  | 'mic-unavailable'
  | 'ice-failed'
  | 'negotiation-timeout'
  | 'sdp-apply-failed'
  | 'agent-rejected'
  | 'agent-unavailable'
  | 'connection-lost'
  | 'signaling-failed';

interface UseVoiceCallOpts {
  sessionId: string | null;
  sessionToken: string | null;
  callerName: string;
  callerPhone: string;
}

const CONNECTING_WATCHDOG_MS = 30_000;
const DISCONNECT_GRACE_MS = 15_000;

export function useVoiceCall({ sessionId, sessionToken, callerName, callerPhone }: UseVoiceCallOpts) {
  const [status, setStatus] = useState<CallStatus>('idle');
  const [callId, setCallId] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<CallErrorCode>(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [remoteHasAudio, setRemoteHasAudio] = useState(false);
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  const [pcInstance, setPcInstance] = useState<RTCPeerConnection | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const sigChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callIdRef = useRef<string | null>(null);
  const remoteDescSetRef = useRef(false);
  const appliedIceRef = useRef<Set<string>>(new Set());
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const sessionTokenRef = useRef<string | null>(sessionToken);
  const statusRef = useRef<CallStatus>('idle');
  const selfClosingRef = useRef(false);
  const connectingWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disconnectGraceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const everConnectedRef = useRef(false);
  const audioTransceiverRef = useRef<RTCRtpTransceiver | null>(null);

  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { sessionTokenRef.current = sessionToken; }, [sessionToken]);

  const clearTimers = useCallback(() => {
    if (connectingWatchdogRef.current) { clearTimeout(connectingWatchdogRef.current); connectingWatchdogRef.current = null; }
    if (disconnectGraceRef.current) { clearTimeout(disconnectGraceRef.current); disconnectGraceRef.current = null; }
  }, []);

  const cleanupCall = useCallback(() => {
    selfClosingRef.current = true;
    clearTimers();
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    try { pcRef.current?.getSenders().forEach((s) => s.track?.stop()); } catch { /* ignore */ }
    // Stop transceivers BEFORE close so the ICE agent shuts down cleanly and
    // does not fire a final spurious 'failed' event.
    try { pcRef.current?.getTransceivers().forEach((t) => { try { t.stop(); } catch { /* ignore */ } }); } catch { /* ignore */ }
    try { pcRef.current?.close(); } catch { /* ignore */ }
    pcRef.current = null;
    audioTransceiverRef.current = null;
    try { localStreamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
    localStreamRef.current = null;
    if (sigChannelRef.current) { try { supabase.removeChannel(sigChannelRef.current); } catch { /* ignore */ } sigChannelRef.current = null; }
    if (remoteAudioRef.current) {
      try { remoteAudioRef.current.srcObject = null; } catch { /* ignore */ }
      try { remoteAudioRef.current.remove(); } catch { /* ignore */ }
      remoteAudioRef.current = null;
    }
    remoteDescSetRef.current = false;
    appliedIceRef.current = new Set();
    pendingIceRef.current = [];
    everConnectedRef.current = false;
    setMuted(false);
    setAudioUnlocked(false);
    setRemoteHasAudio(false);
    setConnectedAt(null);
    setPcInstance(null);
  }, [clearTimers]);

  useEffect(() => () => cleanupCall(), [cleanupCall]);

  const failWith = useCallback((code: Exclude<CallErrorCode, null>, message: string) => {
    if (statusRef.current === 'ended' || statusRef.current === 'failed') return;
    console.warn('[call visitor] failing with', code, '-', message);
    setErrorCode(code);
    setError(message);
    setStatus('failed');
    cleanupCall();
  }, [cleanupCall]);

  const ensureRemoteAudio = useCallback(() => {
    if (remoteAudioRef.current) return remoteAudioRef.current;
    const el = document.createElement('audio');
    el.autoplay = true;
    el.setAttribute('playsinline', '');
    (el as any).muted = false;
    el.volume = 1.0;
    // Important on iOS/Android: must be in DOM and allowed to play.
    document.body.appendChild(el);
    remoteAudioRef.current = el;
    return el;
  }, []);

  const tryPlayRemote = useCallback((audio: HTMLAudioElement) => {
    const attempt = () => audio.play().then(() => {
      setAudioUnlocked(true);
    }).catch((err) => {
      console.warn('[call visitor] remote audio play blocked, will retry on user gesture', err);
      setAudioUnlocked(false);
      const onGesture = () => {
        audio.play().then(() => setAudioUnlocked(true)).catch(() => {});
        document.removeEventListener('click', onGesture);
        document.removeEventListener('touchstart', onGesture);
      };
      document.addEventListener('click', onGesture, { once: true });
      document.addEventListener('touchstart', onGesture, { once: true });
    });
    attempt();
  }, []);

  // Public: customer taps "লাউড / স্পিকার চালু" — must be inside a user gesture.
  const enableSpeaker = useCallback(async () => {
    const audio = remoteAudioRef.current;
    if (!audio) return;
    try { (audio as any).muted = false; } catch { /* ignore */ }
    audio.volume = 1.0;
    try { audio.load(); } catch { /* ignore */ }
    try {
      await audio.play();
      setAudioUnlocked(true);
      console.log('[call visitor] speaker enabled by user gesture');
    } catch (e) {
      console.warn('[call visitor] enableSpeaker play() failed', e);
    }
    // Best-effort route to the default output (speakerphone on most Android Chrome).
    try {
      const anyAudio = audio as any;
      if (typeof anyAudio.setSinkId === 'function') {
        await anyAudio.setSinkId('default');
      }
    } catch { /* not supported on this browser — silently ignore */ }
  }, []);

  const applyCalleeIce = useCallback(async (list: any[]) => {
    if (!Array.isArray(list) || !pcRef.current) return;
    for (const cand of list) {
      const key = JSON.stringify(cand);
      if (appliedIceRef.current.has(key)) continue;
      try {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(cand));
        appliedIceRef.current.add(key);
      } catch { /* ignore dupes */ }
    }
  }, []);

  const sendCallerIce = useCallback((cand: RTCIceCandidateInit) => {
    const cid = callIdRef.current;
    const tok = sessionTokenRef.current;
    if (!cid || !tok) {
      pendingIceRef.current.push(cand);
      return;
    }
    supabase.rpc('update_call_signal', {
      p_call_id: cid,
      p_session_token: tok,
      p_role: 'caller',
      p_signal: null as any,
      p_ice: cand as any,
    }).then(({ error: e }) => {
      if (e) console.warn('[call visitor] send ice failed', e);
    });
  }, []);

  const flushPendingIce = useCallback(() => {
    const cid = callIdRef.current;
    const tok = sessionTokenRef.current;
    if (!cid || !tok) return;
    const queued = pendingIceRef.current.splice(0);
    if (queued.length === 0) return;
    console.log('[call visitor] flushing queued ICE candidates:', queued.length);
    for (const cand of queued) {
      supabase.rpc('update_call_signal', {
        p_call_id: cid,
        p_session_token: tok,
        p_role: 'caller',
        p_signal: null as any,
        p_ice: cand as any,
      }).then(({ error: e }) => {
        if (e) console.warn('[call visitor] flush ice failed', e);
      });
    }
  }, []);

  const handleCallSnapshot = useCallback(async (row: any) => {
    if (!row || !pcRef.current) return;
    if (row.status === 'rejected') {
      failWith('agent-rejected', 'এজেন্ট কলটি গ্রহণ করেননি');
      return;
    }
    if (row.status === 'ended' || row.status === 'missed') {
      if (statusRef.current === 'in-call' || everConnectedRef.current) {
        if (statusRef.current !== 'ended') {
          setStatus('ended');
          cleanupCall();
        }
      } else {
        failWith('agent-unavailable', 'এজেন্ট কলটি শেষ করে দিয়েছেন');
      }
      return;
    }
    if (row.status === 'waiting' && statusRef.current === 'ringing') {
      setStatus('waiting');
    }
    if (row.status === 'accepted') {
      if (!remoteDescSetRef.current && row.callee_signal && row.callee_signal.type === 'answer') {
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(row.callee_signal));
          remoteDescSetRef.current = true;
          setStatus('connecting');
          console.log('[call visitor] answer accepted, applying callee ICE');
          // Diagnostic: dump transceiver directions immediately after answer applied.
          try {
            pcRef.current.getTransceivers().forEach((t, i) => {
              console.log(`[call visitor] transceiver[${i}] mid=${t.mid} dir=${t.direction} curDir=${t.currentDirection} senderTrack=${!!t.sender.track}`);
            });
          } catch { /* ignore */ }

          if (connectingWatchdogRef.current) clearTimeout(connectingWatchdogRef.current);
          connectingWatchdogRef.current = setTimeout(() => {
            if (statusRef.current === 'connecting') {
              failWith('negotiation-timeout', 'অডিও সংযোগ স্থাপনে সময় লেগেছে। নেটওয়ার্ক চেক করে আবার চেষ্টা করুন।');
            }
          }, CONNECTING_WATCHDOG_MS);
        } catch (e) {
          console.error('[call visitor] setRemoteDescription failed', e);
          failWith('sdp-apply-failed', 'এজেন্টের সাথে অডিও সংযোগ স্থাপন করা যায়নি। আবার চেষ্টা করুন।');
          return;
        }
      }
      if (remoteDescSetRef.current) {
        await applyCalleeIce(row.callee_ice || []);
      }
    }
  }, [applyCalleeIce, cleanupCall, failWith]);

  const startCall = useCallback(async () => {
    if (!sessionId || !sessionToken) { setError('Session required'); setErrorCode('signaling-failed'); return; }
    setError(null);
    setErrorCode(null);
    selfClosingRef.current = false;
    everConnectedRef.current = false;
    setStatus('initiating');
    try {
      const cap = await checkMicCapability();
      if (!cap.ok) {
        setErrorCode('mic-unavailable');
        setError(cap.message || 'মাইক্রোফোন উপলব্ধ নেই');
        setStatus('failed');
        return;
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
            sampleRate: 48000,
          } as MediaTrackConstraints,
          video: false,
        });
      } catch (err: any) {
        console.error('[call] getUserMedia failed:', err?.name, err?.message, err);
        const code: CallErrorCode = (err?.name === 'NotAllowedError' || err?.name === 'SecurityError')
          ? 'mic-denied' : 'mic-unavailable';
        setErrorCode(code);
        setError(micErrorMessage(err));
        setStatus('failed');
        return;
      }
      localStreamRef.current = stream;

      // Pre-create the remote audio sink so the user gesture that triggered
      // startCall (the "Call" tap) also primes autoplay for it on mobile.
      const sink = ensureRemoteAudio();
      try { await sink.play().catch(() => {}); } catch { /* ignore */ }

      const iceServers = await getIceServers();
      const useTurn = hasTurnServer(iceServers);
      console.log('[call visitor] iceServers:', iceServers.length, 'TURN available:', useTurn);
      const pc = new RTCPeerConnection({
        iceServers,
        bundlePolicy: 'max-bundle',
        // Keep 'all' so direct LAN/host calls (rare on this product) still work.
        // Resilience comes from the relay candidate also being available.
        iceTransportPolicy: 'all',
      });
      pcRef.current = pc;
      setPcInstance(pc);

      pc.onicecandidate = (ev) => {
        if (!ev.candidate) {
          console.log('[call visitor] ICE gathering complete');
          logCandidateBreakdown(pc, 'call visitor');
          return;
        }
        sendCallerIce(ev.candidate.toJSON());
      };

      // CRITICAL: build the offer with an explicit sendrecv audio transceiver
      // bound to our mic via replaceTrack. This guarantees the m-line we're
      // sending on is the same one the admin's reply binds to — preventing
      // the "admin can hear customer but customer cannot hear admin" bug.
      const micTrack = stream.getAudioTracks()[0];
      const audioTransceiver = pc.addTransceiver('audio', { direction: 'sendrecv' });
      audioTransceiverRef.current = audioTransceiver;
      try {
        await audioTransceiver.sender.replaceTrack(micTrack);
        console.log('[call visitor] mic bound to sendrecv audio transceiver');
      } catch (e) {
        console.warn('[call visitor] replaceTrack failed, falling back to addTrack', e);
        try { pc.addTrack(micTrack, stream); } catch { /* ignore */ }
      }

      pc.ontrack = (e) => {
        console.log('[call visitor] remote track received, kind=', e.track.kind, 'muted=', e.track.muted);
        const audio = ensureRemoteAudio();
        const remoteStream = e.streams[0] || new MediaStream([e.track]);
        if (audio.srcObject !== remoteStream) {
          audio.srcObject = remoteStream;
        }
        setRemoteHasAudio(true);
        const replay = () => {
          console.log('[call visitor] remote track unmute event — replaying');
          tryPlayRemote(audio);
        };
        e.track.addEventListener('unmute', replay);
        tryPlayRemote(audio);
      };

      pc.oniceconnectionstatechange = () => {
        console.log('[call visitor] ICE state:', pc.iceConnectionState);
      };

      pc.onconnectionstatechange = () => {
        if (pcRef.current !== pc) {
          // Stale handler from a previous attempt — ignore.
          return;
        }
        const s = pc.connectionState;
        const phase = statusRef.current;
        console.log('[call visitor] connection state:', s, '· phase:', phase);

        if (s === 'connected') {
          everConnectedRef.current = true;
          if (connectingWatchdogRef.current) { clearTimeout(connectingWatchdogRef.current); connectingWatchdogRef.current = null; }
          if (disconnectGraceRef.current) { clearTimeout(disconnectGraceRef.current); disconnectGraceRef.current = null; }
          setStatus('in-call');
          if (!startedAtRef.current) startedAtRef.current = Date.now();
          setConnectedAt((prev) => prev ?? Date.now());
          if (tickRef.current) clearInterval(tickRef.current);
          tickRef.current = setInterval(() => setDurationSec(Math.floor((Date.now() - startedAtRef.current) / 1000)), 500);
          logSelectedCandidatePair(pc, 'call visitor');
          if (remoteAudioRef.current) tryPlayRemote(remoteAudioRef.current);
          return;
        }

        // CRITICAL: while we're still ringing/waiting (admin hasn't answered),
        // ICE will naturally go disconnected/failed because there is no remote
        // peer yet. Surfacing those as "connection failed" is the regression
        // the user just hit ("call kete jai" the moment admin accepts).
        // Treat them as harmless until we are at least 'connecting' (post-answer).
        const preAnswer = phase === 'ringing' || phase === 'waiting' || phase === 'initiating';

        if (s === 'disconnected') {
          if (preAnswer) {
            console.log('[call visitor] disconnected during pre-answer phase — ignoring');
            return;
          }
          if (disconnectGraceRef.current) return;
          console.log('[call visitor] disconnected — starting 15s grace');
          disconnectGraceRef.current = setTimeout(() => {
            disconnectGraceRef.current = null;
            const now = pcRef.current?.connectionState;
            if (now === 'connected') return;
            if (everConnectedRef.current) {
              failWith('connection-lost', 'নেটওয়ার্ক সংযোগ বিচ্ছিন্ন হয়েছে। আবার চেষ্টা করুন।');
            } else {
              failWith('ice-failed', 'অডিও সংযোগ স্থাপন করা যায়নি। ইন্টারনেট চেক করে আবার চেষ্টা করুন।');
            }
          }, DISCONNECT_GRACE_MS);
          return;
        }

        if (s === 'failed') {
          if (preAnswer) {
            console.log('[call visitor] failed during pre-answer phase — ignoring (waiting for agent)');
            return;
          }
          failWith('ice-failed', 'নেটওয়ার্ক সংযোগে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
          return;
        }

        if (s === 'closed') {
          if (selfClosingRef.current) return;
          if (statusRef.current === 'in-call') {
            setStatus('ended');
            cleanupCall();
          } else if (!preAnswer) {
            failWith('connection-lost', 'কল সংযোগ বন্ধ হয়েছে');
          }
        }
      };


      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);
      console.log('[call visitor] offer created');

      const { data: newCallId, error: rpcErr } = await supabase.rpc('initiate_voice_call', {
        p_session_id: sessionId,
        p_session_token: sessionToken,
        p_caller_name: callerName || 'ভিজিটর',
        p_caller_phone: callerPhone || '',
        p_offer: offer as any,
      });
      if (rpcErr) throw rpcErr;
      const cid = newCallId as string;
      setCallId(cid);
      callIdRef.current = cid;
      setStatus('ringing');
      console.log('[call visitor] call id assigned:', cid);

      flushPendingIce();

      const ch = supabase
        .channel(`call-${cid}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_calls', filter: `id=eq.${cid}` }, (payload) => {
          handleCallSnapshot(payload.new);
        })
        .subscribe((subStatus) => {
          console.log('[call visitor] realtime subscribe status:', subStatus);
        });
      sigChannelRef.current = ch;

      const pollOnce = async () => {
        if (!callIdRef.current || !sessionTokenRef.current) return;
        try {
          const { data, error: pErr } = await supabase.rpc('get_call_state', {
            p_call_id: callIdRef.current,
            p_session_token: sessionTokenRef.current,
          });
          if (pErr) return;
          const row = Array.isArray(data) ? data[0] : data;
          if (row) await handleCallSnapshot(row);
        } catch { /* ignore transient */ }
      };
      pollOnce();
      pollRef.current = setInterval(() => {
        if (statusRef.current === 'ended' || statusRef.current === 'failed' || statusRef.current === 'in-call') {
          if (statusRef.current === 'in-call' && pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          return;
        }
        pollOnce();
      }, 600);
    } catch (e: any) {
      console.error('startCall failed', e);
      setErrorCode('signaling-failed');
      setError(e?.message || 'কল শুরু করা যায়নি');
      setStatus('failed');
      cleanupCall();
    }
  }, [sessionId, sessionToken, callerName, callerPhone, ensureRemoteAudio, tryPlayRemote, cleanupCall, sendCallerIce, flushPendingIce, handleCallSnapshot]);

  const toggleMute = useCallback(() => {
    const tracks = localStreamRef.current?.getAudioTracks() || [];
    const next = !muted;
    tracks.forEach((t) => { t.enabled = !next; });
    setMuted(next);
  }, [muted]);

  const endCall = useCallback(async () => {
    const cid = callIdRef.current;
    if (cid && sessionToken) {
      try { await supabase.rpc('end_call_visitor', { p_call_id: cid, p_session_token: sessionToken }); } catch { /* ignore */ }
    }
    setStatus('ended');
    cleanupCall();
  }, [sessionToken, cleanupCall]);

  const reset = useCallback(() => {
    cleanupCall();
    setStatus('idle');
    setCallId(null);
    setDurationSec(0);
    setError(null);
    setErrorCode(null);
    callIdRef.current = null;
    pendingIceRef.current = [];
    everConnectedRef.current = false;
    selfClosingRef.current = false;
  }, [cleanupCall]);

  const retry = useCallback(async () => {
    reset();
    await new Promise((r) => setTimeout(r, 50));
    await startCall();
  }, [reset, startCall]);

  // Active call lifecycle helpers — used by UI for tab title, beforeunload
  // warning, Media Session metadata. Keeping it here so the hook owns the
  // state and any UI surface (chat widget OR floating bar) shares it.
  const isActive = status === 'ringing' || status === 'waiting' || status === 'connecting' || status === 'in-call';
  useEffect(() => {
    if (!isActive) return;
    const original = document.title;
    document.title = `📞 কল চলছে · ${original.replace(/^📞\s*কল চলছে\s*·\s*/, '')}`;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'কল চলছে — পেজ ছাড়লে কল কেটে যাবে।';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    // Media Session metadata so Android shows the "ongoing call" surface
    // when supported (best-effort; silently no-op on unsupported browsers).
    try {
      if ('mediaSession' in navigator) {
        (navigator as any).mediaSession.metadata = new (window as any).MediaMetadata({
          title: 'স্বর্ণ সুতা এজেন্টের সাথে কল',
          artist: 'Shorno Suta',
        });
        (navigator as any).mediaSession.setActionHandler?.('stop', () => endCall());
      }
    } catch { /* ignore */ }
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.title = original.replace(/^📞\s*কল চলছে\s*·\s*/, '');
      try {
        if ('mediaSession' in navigator) {
          (navigator as any).mediaSession.metadata = null;
          (navigator as any).mediaSession.setActionHandler?.('stop', null);
        }
      } catch { /* ignore */ }
    };
  }, [isActive, endCall]);

  return {
    status,
    callId,
    muted,
    durationSec,
    error,
    errorCode,
    audioUnlocked,
    remoteHasAudio,
    isActive,
    pc: pcInstance,
    connectedAt,
    startCall,
    toggleMute,
    enableSpeaker,
    endCall,
    reset,
    retry,
  };
}
