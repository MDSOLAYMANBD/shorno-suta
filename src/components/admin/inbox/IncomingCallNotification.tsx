// Admin-side WebRTC call answer UI with queue support.
// Globally mounted in AdminDashboard so admin receives ringers on any page.
// Multiple concurrent calls are queued (no auto-rejection). Clicking the popup
// opens the matching live-chat thread. All call lifecycle events are logged
// into chat_messages so the conversation history shows what happened.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Phone, PhoneOff, Mic, MicOff, MessageCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { micErrorMessage } from '@/lib/browserCapability';
import { getIceServers, logSelectedCandidatePair, logCandidateBreakdown, hasTurnServer } from '@/lib/turnCredentials';
import CallHealthIndicator from '@/components/chat/CallHealthIndicator';

interface IncomingCall {
  id: string;
  session_id: string;
  caller_name: string;
  caller_phone: string;
  caller_signal: any;
  caller_ice: any[];
}

// Continuous browser ring tone for the admin (different cadence per status).
function makeRingTone(): { play: () => void; stop: () => void } {
  let ctx: AudioContext | null = null;
  let osc1: OscillatorNode | null = null;
  let osc2: OscillatorNode | null = null;
  let gain: GainNode | null = null;
  let interval: ReturnType<typeof setInterval> | null = null;

  const start = () => {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(ctx.destination);
      osc1 = ctx.createOscillator();
      osc1.frequency.value = 440;
      osc1.connect(gain);
      osc1.start();
      osc2 = ctx.createOscillator();
      osc2.frequency.value = 480;
      osc2.connect(gain);
      osc2.start();
      const ring = () => {
        if (!gain || !ctx) return;
        const now = ctx.currentTime;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.18, now + 0.05);
        gain.gain.setValueAtTime(0.18, now + 1.2);
        gain.gain.linearRampToValueAtTime(0, now + 1.3);
      };
      ring();
      interval = setInterval(ring, 3000);
    } catch (e) {
      console.warn('[ring] WebAudio failed', e);
    }
  };

  const stop = () => {
    if (interval) { clearInterval(interval); interval = null; }
    try { osc1?.stop(); osc2?.stop(); } catch { /* ignore */ }
    try { ctx?.close(); } catch { /* ignore */ }
    osc1 = null; osc2 = null; gain = null; ctx = null;
  };

  return { play: start, stop };
}

export default function IncomingCallNotification() {
  const [pending, setPending] = useState<IncomingCall[]>([]); // queue
  const [active, setActive] = useState<{ id: string; sessionId: string; callerName: string; startedAt: number } | null>(null);
  const [muted, setMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [pcInstance, setPcInstance] = useState<RTCPeerConnection | null>(null);
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  const navigate = useNavigate();

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringRef = useRef<ReturnType<typeof makeRingTone> | null>(null);
  const activeRef = useRef<typeof active>(null);
  const pendingRef = useRef<IncomingCall[]>([]);
  const appliedIceRef = useRef<Set<string>>(new Set());

  useEffect(() => { activeRef.current = active; }, [active]);
  useEffect(() => { pendingRef.current = pending; }, [pending]);

  // Init ring tone (lazy)
  useEffect(() => {
    ringRef.current = makeRingTone();
    // Pre-arm AudioContext on the first user gesture so the ring is audible
    // immediately when an incoming call arrives. Without this, the AudioContext
    // stays "suspended" until the admin clicks something — meaning the very
    // first incoming call after a fresh tab load would ring silently.
    const armAudio = () => {
      try { ringRef.current?.play(); ringRef.current?.stop(); } catch { /* ignore */ }
      window.removeEventListener('click', armAudio);
      window.removeEventListener('keydown', armAudio);
      window.removeEventListener('touchstart', armAudio);
    };
    window.addEventListener('click', armAudio, { once: true });
    window.addEventListener('keydown', armAudio, { once: true });
    window.addEventListener('touchstart', armAudio, { once: true });
    return () => {
      ringRef.current?.stop();
      window.removeEventListener('click', armAudio);
      window.removeEventListener('keydown', armAudio);
      window.removeEventListener('touchstart', armAudio);
    };
  }, []);

  // Stop ring when no pending calls; play when at least one is pending and no active call.
  // Also flash the document title so a silent admin tab still gets noticed.
  useEffect(() => {
    if (pending.length > 0 && !active) {
      ringRef.current?.play();
      const original = document.title;
      let flash = false;
      const interval = setInterval(() => {
        flash = !flash;
        document.title = flash
          ? `📞 ইনকামিং কল — ${pending[0].caller_name || 'ভিজিটর'}`
          : original.replace(/^📞.*?— /, '');
      }, 1000);
      return () => {
        clearInterval(interval);
        document.title = original.replace(/^📞.*?— /, '');
      };
    }
    ringRef.current?.stop();
  }, [pending.length, active, pending]);

  const cleanup = useCallback(() => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    try { pcRef.current?.getSenders().forEach((s) => s.track?.stop()); } catch { /* ignore */ }
    try { pcRef.current?.getTransceivers().forEach((t) => { try { t.stop(); } catch { /* ignore */ } }); } catch { /* ignore */ }
    try { pcRef.current?.close(); } catch { /* ignore */ }
    pcRef.current = null;
    try { localStreamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
    localStreamRef.current = null;
    if (channelRef.current) { try { supabase.removeChannel(channelRef.current); } catch { /* ignore */ } channelRef.current = null; }
    if (remoteAudioRef.current) {
      try { remoteAudioRef.current.srcObject = null; } catch { /* ignore */ }
      try { remoteAudioRef.current.remove(); } catch { /* ignore */ }
      remoteAudioRef.current = null;
    }
    appliedIceRef.current = new Set();
    setMuted(false);
    setDuration(0);
    setPcInstance(null);
    setConnectedAt(null);
  }, []);

  useEffect(() => () => { cleanup(); ringRef.current?.stop(); }, [cleanup]);

  // Subscribe globally to chat_calls inserts/updates.
  useEffect(() => {
    console.log('[IncomingCall] Subscribing to chat_calls realtime…');
    const ch = supabase
      .channel('admin-incoming-calls')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_calls' }, (payload) => {
        const row: any = payload.new;
        console.log('[IncomingCall] INSERT received:', row.id, 'status:', row.status);
        if (row.status !== 'ringing') return;
        // Queue it; don't auto-reject if busy.
        setPending((q) => q.some((c) => c.id === row.id) ? q : [...q, row]);
        // NOTE: Intentionally NO sonner toast here — the popup card itself
        // (rendered bottom-right) is the notification. Showing both caused
        // the toast to overlap the Accept button and block click events,
        // making incoming calls impossible to receive.
        // If admin is busy, mark this queued call as 'waiting' so visitor sees a clear status.
        if (activeRef.current) {
          supabase.rpc('mark_call_waiting', { p_call_id: row.id }).then(() => {}, () => {});
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_calls' }, (payload) => {
        const row: any = payload.new;
        // Remove from queue if it became finalized/accepted by someone else.
        if (['accepted', 'ended', 'rejected', 'missed'].includes(row.status)) {
          setPending((q) => q.filter((c) => c.id !== row.id));
        }
      })
      .subscribe((status) => {
        console.log('[IncomingCall] Subscription status:', status);
      });
    return () => { supabase.removeChannel(ch); };
  }, [navigate]);

  const ensureRemoteAudio = useCallback(() => {
    if (remoteAudioRef.current) return remoteAudioRef.current;
    const el = document.createElement('audio');
    el.autoplay = true;
    el.setAttribute('playsinline', '');
    (el as any).muted = false;
    el.volume = 1.0;
    document.body.appendChild(el);
    remoteAudioRef.current = el;
    return el;
  }, []);

  const tryPlayRemote = useCallback((audio: HTMLAudioElement) => {
    audio.play().catch((err) => {
      console.warn('[call admin] remote audio play blocked, will retry on user gesture', err);
      const onGesture = () => {
        audio.play().catch(() => {});
        document.removeEventListener('click', onGesture);
        document.removeEventListener('touchstart', onGesture);
      };
      document.addEventListener('click', onGesture, { once: true });
      document.addEventListener('touchstart', onGesture, { once: true });
    });
  }, []);

  const applyCallerIce = useCallback(async (list: any[]) => {
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

  const accept = useCallback(async (call: IncomingCall) => {
    if (activeRef.current) {
      toast.info('আগে বর্তমান কল শেষ করুন');
      return;
    }
    // CRITICAL: nuke any stale RTCPeerConnection from a previous failed attempt.
    // If we don't, its onconnectionstatechange keeps firing and calls endCall()
    // on the new active call seconds after admin presses Accept — that was the
    // "call drops the moment I receive" regression.
    cleanup();
    try {
      // CRITICAL: refresh the call row from DB so we get the LATEST caller offer +
      // ICE candidates (the realtime INSERT payload usually has empty caller_ice
      // because visitor sends ICE asynchronously after initiate_voice_call).
      let freshOffer = call.caller_signal;
      let freshIce = call.caller_ice || [];
      try {
        const { data: fresh } = await supabase
          .from('chat_calls')
          .select('caller_signal, caller_ice, status')
          .eq('id', call.id)
          .maybeSingle();
        if (fresh?.status && !['ringing', 'waiting'].includes(fresh.status)) {
          toast.info('এই কলটি ইতোমধ্যে শেষ হয়ে গেছে');
          setPending((q) => q.filter((c) => c.id !== call.id));
          return;
        }
        if (fresh?.caller_signal) freshOffer = fresh.caller_signal;
        if (Array.isArray(fresh?.caller_ice)) freshIce = fresh.caller_ice;
        console.log('[call admin] fresh caller ICE count:', freshIce.length);
      } catch (e) {
        console.warn('[call admin] fetch fresh call state failed, using stale payload', e);
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
        });
      } catch (err: any) {
        console.error('[call accept] mic error', err);
        toast.error(micErrorMessage(err));
        await supabase.rpc('reject_voice_call', { p_call_id: call.id });
        setPending((q) => q.filter((c) => c.id !== call.id));
        return;
      }
      localStreamRef.current = stream;

      const iceServers = await getIceServers();
      const useTurn = hasTurnServer(iceServers);
      console.log('[call admin] iceServers:', iceServers.length, 'TURN available:', useTurn);
      const pc = new RTCPeerConnection({
        iceServers,
        bundlePolicy: 'max-bundle',
        iceTransportPolicy: 'all',
      });
      pcRef.current = pc;
      setPcInstance(pc);

      // Buffer ICE candidates locally and only send them AFTER accept_voice_call
      // succeeds. Sending them earlier (when the row is still status=ringing)
      // means the visitor's polling discards them as "not yet accepted" → first
      // batch of admin candidates is effectively lost → ICE checking never
      // succeeds.
      const iceBuffer: RTCIceCandidateInit[] = [];
      let acceptClaimed = false;
      const flushIce = async () => {
        if (iceBuffer.length === 0) return;
        const batch = iceBuffer.splice(0);
        // Send candidates in parallel (each is one RPC). Small N so this is fine.
        await Promise.all(batch.map((cand) =>
          supabase.rpc('update_call_signal', {
            p_call_id: call.id,
            p_session_token: '',
            p_role: 'callee',
            p_signal: null as any,
            p_ice: cand as any,
          }).then(({ error: e }) => { if (e) console.warn('[call admin] send ice failed', e); })
        ));
      };

      pc.onicecandidate = (ev) => {
        if (pcRef.current !== pc) return; // stale
        if (!ev.candidate) {
          console.log('[call admin] ICE gathering complete');
          logCandidateBreakdown(pc, 'call admin');
          return;
        }
        if (acceptClaimed) {
          // Send immediately
          supabase.rpc('update_call_signal', {
            p_call_id: call.id,
            p_session_token: '',
            p_role: 'callee',
            p_signal: null as any,
            p_ice: ev.candidate.toJSON() as any,
          }).then(({ error: e }) => { if (e) console.warn('[call admin] send ice failed', e); });
        } else {
          iceBuffer.push(ev.candidate.toJSON());
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pcRef.current !== pc) return;
        console.log('[call admin] ICE state:', pc.iceConnectionState);
      };

      pc.ontrack = (e) => {
        if (pcRef.current !== pc) return;
        console.log('[call admin] remote track received');
        const audio = ensureRemoteAudio();
        const remoteStream = e.streams[0] || new MediaStream([e.track]);
        if (audio.srcObject !== remoteStream) audio.srcObject = remoteStream;
        tryPlayRemote(audio);
      };

      // Treat `disconnected` as a transient ICE flicker (15s grace) instead of
      // tearing down the call. Same resilience as visitor side — prevents the
      // admin from killing the audio path during normal mid-call rechecks.
      let disconnectGrace: ReturnType<typeof setTimeout> | null = null;
      let everConnectedAdmin = false;
      pc.onconnectionstatechange = () => {
        if (pcRef.current !== pc) {
          // Stale handler from a previous accept attempt — ignore. This is the
          // critical guard that prevents an old PC's "failed" event from killing
          // a freshly accepted call.
          console.log('[call admin] ignoring stale connection state event:', pc.connectionState);
          return;
        }
        const s = pc.connectionState;
        console.log('[call admin] connection state:', s);
        if (s === 'connected') {
          everConnectedAdmin = true;
          setConnectedAt((prev) => prev ?? Date.now());
          if (disconnectGrace) { clearTimeout(disconnectGrace); disconnectGrace = null; }
          logSelectedCandidatePair(pc, 'call admin');
          try {
            pc.getTransceivers().forEach((t, i) => {
              console.log(`[call admin] transceiver[${i}] mid=${t.mid} dir=${t.direction} curDir=${t.currentDirection} senderTrack=${!!t.sender.track}`);
            });
          } catch { /* ignore */ }
          return;
        }
        if (s === 'disconnected') {
          if (disconnectGrace) return;
          console.log('[call admin] disconnected — 15s grace before ending');
          disconnectGrace = setTimeout(() => {
            disconnectGrace = null;
            if (pcRef.current === pc && pc.connectionState !== 'connected' && activeRef.current?.id === call.id) {
              endCall(true);
            }
          }, 15_000);
          return;
        }
        if (s === 'failed') {
          // If we never connected, give a short window for ICE restart before ending.
          if (!everConnectedAdmin) {
            console.warn('[call admin] failed before connecting — waiting 4s for restart');
            setTimeout(() => {
              if (pcRef.current === pc && pc.connectionState !== 'connected' && activeRef.current?.id === call.id) {
                endCall(true);
              }
            }, 4000);
            return;
          }
          if (activeRef.current?.id === call.id) endCall(true);
          return;
        }
        if (s === 'closed') return;
      };

      // Apply visitor offer FIRST so we can find its audio transceiver,
      // then bind our mic to it explicitly (one-way audio fix kept from before).
      await pc.setRemoteDescription(new RTCSessionDescription(freshOffer));
      await applyCallerIce(freshIce);
      console.log('[call admin] remote desc set, applied initial caller ICE:', freshIce.length);

      const micTrack = stream.getAudioTracks()[0];
      const audioTransceiver = pc.getTransceivers().find((t) => {
        const recvKind = t.receiver?.track?.kind;
        const sendKind = (t as any).sender?.track?.kind;
        return recvKind === 'audio' || sendKind === 'audio';
      });

      if (audioTransceiver && micTrack) {
        try {
          await audioTransceiver.sender.replaceTrack(micTrack);
          try { audioTransceiver.direction = 'sendrecv'; } catch { /* ignore */ }
          console.log('[call admin] bound mic to audio transceiver, direction=', audioTransceiver.direction, 'curDir=', audioTransceiver.currentDirection);
        } catch (bindErr) {
          console.warn('[call admin] replaceTrack failed, falling back to addTrack', bindErr);
          stream.getTracks().forEach((t) => pc.addTrack(t, stream));
        }
      } else {
        console.warn('[call admin] no audio transceiver from offer — falling back to addTrack');
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Set up the realtime UPDATE channel BEFORE accept_voice_call so we never
      // miss a trickled visitor ICE between the moment we accept and the
      // moment our subscription joins.
      const ch = supabase
        .channel(`admin-call-${call.id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_calls', filter: `id=eq.${call.id}` }, async (payload) => {
          const row: any = payload.new;
          await applyCallerIce(row.caller_ice || []);
          if (row.status === 'ended' || row.status === 'rejected') {
            // Visitor hung up — end immediately (no waiting for the 1.5s poll).
            if (activeRef.current?.id === call.id) endCall(false);
          }
        })
        .subscribe();
      channelRef.current = ch;

      // Atomically claim the call.
      const { data: claimed, error: claimErr } = await supabase.rpc('accept_voice_call', {
        p_call_id: call.id,
        p_callee_signal: answer as any,
      });
      if (claimErr || !claimed) {
        toast.info('এই কলটি অন্য কেউ ইতোমধ্যে রিসিভ করেছেন');
        cleanup();
        setPending((q) => q.filter((c) => c.id !== call.id));
        return;
      }
      acceptClaimed = true;
      // Flush any ICE candidates that were gathered before accept succeeded.
      flushIce().catch(() => { /* ignore */ });

      // Log "accepted" event into chat thread (best-effort).
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: prof } = await supabase
          .from('employee_profiles')
          .select('full_name')
          .eq('user_id', user?.id || '')
          .maybeSingle();
        const staffName = prof?.full_name || user?.email || 'এজেন্ট';
        await supabase.rpc('log_call_event', {
          p_session_id: call.session_id,
          p_call_id: call.id,
          p_event: 'accepted',
          p_message: `📞 কল রিসিভ করেছেন: ${staffName}`,
          p_metadata: { accepted_by_name: staffName, caller_name: call.caller_name } as any,
        });
      } catch (e) { console.warn('log accepted event failed', e); }

      // Polling fallback for caller ICE / status changes.
      let pollHandle: ReturnType<typeof setInterval> | null = null;
      pollHandle = setInterval(async () => {
        if (pcRef.current !== pc || pc.connectionState === 'connected' || pc.connectionState === 'closed') {
          if (pollHandle) { clearInterval(pollHandle); pollHandle = null; }
          return;
        }
        try {
          const { data: row } = await supabase
            .from('chat_calls')
            .select('caller_ice, status')
            .eq('id', call.id)
            .maybeSingle();
          if (row?.caller_ice) await applyCallerIce(row.caller_ice as any[]);
          if (row?.status === 'ended' || row?.status === 'rejected') {
            if (pollHandle) { clearInterval(pollHandle); pollHandle = null; }
            if (activeRef.current?.id === call.id) endCall(false);
          }
        } catch { /* ignore */ }
      }, 1500);

      const startedAt = Date.now();
      setActive({ id: call.id, sessionId: call.session_id, callerName: call.caller_name, startedAt });
      setPending((q) => q.filter((c) => c.id !== call.id));
      tickRef.current = setInterval(() => setDuration(Math.floor((Date.now() - startedAt) / 1000)), 500);
    } catch (e: any) {
      console.error('accept call failed', e);
      toast.error(e?.message || 'কল accept ব্যর্থ');
      cleanup();
      setPending((q) => q.filter((c) => c.id !== call.id));
    }
  }, [ensureRemoteAudio, tryPlayRemote, cleanup, applyCallerIce]);

  const reject = useCallback(async (callId: string, sessionId: string, callerName: string) => {
    setPending((q) => q.filter((c) => c.id !== callId));
    try { await supabase.rpc('reject_voice_call', { p_call_id: callId }); } catch { /* ignore */ }
    try {
      await supabase.rpc('log_call_event', {
        p_session_id: sessionId,
        p_call_id: callId,
        p_event: 'rejected',
        p_message: `📵 কল reject করা হয়েছে`,
        p_metadata: { caller_name: callerName } as any,
      });
    } catch { /* ignore */ }
  }, []);

  const endCall = useCallback(async (notify = true) => {
    const a = activeRef.current;
    if (!a) { cleanup(); return; }
    const dur = Math.floor((Date.now() - a.startedAt) / 1000);
    if (notify) {
      try { await supabase.rpc('end_call_admin', { p_call_id: a.id }); } catch { /* ignore */ }
    }
    try {
      const m = Math.floor(dur / 60);
      const s = String(dur % 60).padStart(2, '0');
      await supabase.rpc('log_call_event', {
        p_session_id: a.sessionId,
        p_call_id: a.id,
        p_event: 'ended',
        p_message: `✅ কল শেষ · ${m}:${s} মিনিট কথা হয়েছে`,
        p_metadata: { duration_seconds: dur, caller_name: a.callerName } as any,
      });
    } catch { /* ignore */ }
    cleanup();
    setActive(null);
  }, [cleanup]);

  const toggleMute = useCallback(() => {
    const tracks = localStreamRef.current?.getAudioTracks() || [];
    const next = !muted;
    tracks.forEach((t) => { t.enabled = !next; });
    setMuted(next);
  }, [muted]);

  const openChat = (sessionId: string) => {
    navigate(`/admin/live-chat?session=${sessionId}`);
  };

  if (pending.length === 0 && !active) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[70] flex flex-col gap-2 items-end">
      {/* Pending / queued ringing calls */}
      {pending.map((call, idx) => (
        <div
          key={call.id}
          className="bg-card border border-border rounded-2xl shadow-2xl p-4 w-[320px] flex flex-col gap-3 animate-in slide-in-from-bottom-4"
        >
          <button
            type="button"
            onClick={() => openChat(call.session_id)}
            className="flex items-center gap-3 text-left rounded-lg hover:bg-muted/50 -m-1 p-1 transition-colors"
            title="চ্যাট খুলুন"
          >
            <div className={cn(
              'h-12 w-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-primary-foreground shrink-0',
              !active && idx === 0 && 'animate-pulse'
            )}>
              <Phone className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                {active ? <><Clock className="h-3 w-3" /> অপেক্ষায়</> : '📞 ইনকামিং ভয়েস কল'}
              </p>
              <p className="font-semibold text-sm truncate">{call.caller_name || 'ভিজিটর'}</p>
              <p className="text-xs text-muted-foreground truncate">{call.caller_phone}</p>
            </div>
            <MessageCircle className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>
          <div className="flex gap-2">
            <Button variant="destructive" className="flex-1 gap-1.5" onClick={() => reject(call.id, call.session_id, call.caller_name)}>
              <PhoneOff className="h-4 w-4" /> Reject
            </Button>
            <Button
              className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-primary-foreground"
              onClick={() => accept(call)}
              disabled={!!active}
              title={active ? 'আগে বর্তমান কল শেষ করুন' : 'কল রিসিভ করুন'}
            >
              <Phone className="h-4 w-4" /> {active ? 'অপেক্ষা' : 'Accept'}
            </Button>
          </div>
        </div>
      ))}

      {/* Currently active in-call card */}
      {active && (
        <div className="bg-card border border-border rounded-2xl shadow-2xl p-4 w-[320px] flex flex-col gap-3 animate-in slide-in-from-bottom-4">
          <button
            type="button"
            onClick={() => openChat(active.sessionId)}
            className="flex items-center gap-3 text-left rounded-lg hover:bg-muted/50 -m-1 p-1 transition-colors"
            title="চ্যাট খুলুন"
          >
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-primary-foreground shrink-0">
              <Phone className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-muted-foreground">কল চলছে · {active.callerName || 'ভিজিটর'}</p>
              <p className="font-semibold text-sm tabular-nums">
                {Math.floor(duration / 60)}:{String(duration % 60).padStart(2, '0')}
              </p>
            </div>
            <MessageCircle className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>
          <CallHealthIndicator pc={pcInstance} connectedAt={connectedAt} variant="inline" />
          <div className="flex gap-2">
            <Button variant={muted ? 'destructive' : 'secondary'} size="icon" className="h-11 w-11 rounded-full" onClick={toggleMute}>
              {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
            <Button variant="destructive" className="flex-1 gap-1.5" onClick={() => endCall(true)}>
              <PhoneOff className="h-4 w-4" /> কল শেষ
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
