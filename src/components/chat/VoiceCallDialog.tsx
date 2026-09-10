import { Phone, PhoneOff, Mic, MicOff, Sparkles, AlertTriangle, RotateCw, MessageSquare, Loader2, Volume2, VolumeX, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CallStatus, CallErrorCode } from '@/hooks/useVoiceCall';
import { useEffect, useRef, useState } from 'react';
import CallHealthIndicator from './CallHealthIndicator';

interface Props {
  open: boolean;
  status: CallStatus;
  durationSec: number;
  muted: boolean;
  error: string | null;
  errorCode?: CallErrorCode;
  agentOnline?: boolean;
  audioUnlocked?: boolean;
  pc?: RTCPeerConnection | null;
  connectedAt?: number | null;
  onToggleMute: () => void;
  onEnableSpeaker?: () => void;
  onEnd: () => void;
  onClose: () => void;
  onMinimize?: () => void;
  onRetry?: () => void;
  onWriteInChat?: () => void;
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

const RING_TIMEOUT_MS = 60_000;

function makeRingbackTone(): { play: () => void; stop: () => void } {
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
      osc1.type = 'sine';
      osc1.frequency.value = 440;
      osc1.connect(gain);
      osc1.start();
      osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.value = 480;
      osc2.connect(gain);
      osc2.start();
      const ring = () => {
        if (!gain || !ctx) return;
        const now = ctx.currentTime;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.12, now + 0.05);
        gain.gain.setValueAtTime(0.12, now + 1.2);
        gain.gain.linearRampToValueAtTime(0, now + 1.4);
      };
      ring();
      interval = setInterval(ring, 3000);
    } catch (e) {
      console.warn('[ringback] WebAudio failed', e);
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

function describeError(code: CallErrorCode | undefined, fallback: string | null) {
  switch (code) {
    case 'mic-denied':
      return { title: 'মাইক্রোফোন অনুমতি দিন', hint: 'ব্রাউজার সেটিংস থেকে মাইক্রোফোন অনুমতি চালু করুন এবং আবার চেষ্টা করুন।' };
    case 'mic-unavailable':
      return { title: 'মাইক্রোফোন পাওয়া যায়নি', hint: fallback || 'আপনার ডিভাইসে মাইক্রোফোন সংযুক্ত আছে কিনা চেক করুন।' };
    case 'ice-failed':
      return { title: 'নেটওয়ার্ক সংযোগে সমস্যা', hint: 'অডিও সংযোগ স্থাপন করা যায়নি। ইন্টারনেট/Wi-Fi চেক করে আবার চেষ্টা করুন।' };
    case 'negotiation-timeout':
      return { title: 'সংযোগ সময় অতিক্রম করেছে', hint: 'অডিও কানেকশন তৈরি হতে সময় লাগছে। দয়া করে আবার চেষ্টা করুন।' };
    case 'sdp-apply-failed':
      return { title: 'এজেন্টের সাথে সংযোগ স্থাপন করা যায়নি', hint: 'সংকেত প্রক্রিয়া ব্যর্থ হয়েছে। কয়েক সেকেন্ড পরে আবার চেষ্টা করুন।' };
    case 'connection-lost':
      return { title: 'কল সংযোগ বিচ্ছিন্ন হয়েছে', hint: 'নেটওয়ার্ক বিচ্ছিন্ন হয়ে গেছে। আবার কল করতে পারেন।' };
    case 'agent-rejected':
      return { title: 'এজেন্ট ব্যস্ত আছেন', hint: 'এই মুহূর্তে এজেন্ট কল ধরতে পারছেন না। চ্যাটে আপনার প্রশ্ন লিখে দিন।' };
    case 'agent-unavailable':
      return { title: 'এজেন্ট কল ধরতে পারেননি', hint: 'অনুগ্রহ করে চ্যাটে প্রশ্ন লিখুন, আমরা দ্রুত সাহায্য করবো।' };
    case 'signaling-failed':
      return { title: 'সিগন্যাল সার্ভারে সমস্যা', hint: fallback || 'সার্ভারের সাথে যোগাযোগ ব্যর্থ। কয়েক মুহূর্ত পর আবার চেষ্টা করুন।' };
    default:
      return { title: 'কল সংযোগ ব্যর্থ', hint: fallback || 'অজানা একটি সমস্যা হয়েছে। আবার চেষ্টা করুন।' };
  }
}

export default function VoiceCallDialog({
  open, status, durationSec, muted, error, errorCode, agentOnline = true, audioUnlocked = false,
  pc = null, connectedAt = null,
  onToggleMute, onEnableSpeaker, onEnd, onClose, onMinimize, onRetry, onWriteInChat,
}: Props) {
  const [ringElapsed, setRingElapsed] = useState(0);
  const [connectingElapsed, setConnectingElapsed] = useState(0);
  const ringStartRef = useRef<number>(0);
  const timedOutRef = useRef(false);
  const ringbackRef = useRef<ReturnType<typeof makeRingbackTone> | null>(null);

  const ringing = status === 'initiating' || status === 'ringing' || status === 'waiting';
  const connecting = status === 'connecting';
  const inCall = status === 'in-call';
  const failed = status === 'failed';
  const ended = status === 'ended';

  useEffect(() => {
    if (!ringbackRef.current) ringbackRef.current = makeRingbackTone();
    return () => { ringbackRef.current?.stop(); ringbackRef.current = null; };
  }, []);

  useEffect(() => {
    if (!open) { ringbackRef.current?.stop(); return; }
    if (ringing) ringbackRef.current?.play();
    else ringbackRef.current?.stop();
  }, [open, ringing]);

  useEffect(() => {
    if (!open) { setRingElapsed(0); timedOutRef.current = false; return; }
    if (!ringing) return;
    ringStartRef.current = Date.now();
    timedOutRef.current = false;
    const tick = setInterval(() => {
      const e = Date.now() - ringStartRef.current;
      setRingElapsed(e);
      if (e >= RING_TIMEOUT_MS && !timedOutRef.current) {
        timedOutRef.current = true;
        clearInterval(tick);
        onEnd();
      }
    }, 500);
    return () => clearInterval(tick);
  }, [open, ringing, onEnd]);

  useEffect(() => {
    if (!connecting) { setConnectingElapsed(0); return; }
    const start = Date.now();
    const t = setInterval(() => setConnectingElapsed(Date.now() - start), 500);
    return () => clearInterval(t);
  }, [connecting]);

  if (!open) return null;

  const ringRemain = Math.max(0, Math.ceil((RING_TIMEOUT_MS - ringElapsed) / 1000));

  let label = '';
  if (status === 'initiating') label = 'মাইক্রোফোন প্রস্তুত হচ্ছে...';
  else if (status === 'ringing') label = `এজেন্টকে কল যাচ্ছে... (${ringRemain}s)`;
  else if (status === 'waiting') label = `অপেক্ষায় আছেন... (${ringRemain}s)`;
  else if (status === 'connecting') label = connectingElapsed > 10_000
    ? 'অডিও সংযোগ একটু সময় নিচ্ছে, অনুগ্রহ করে অপেক্ষা করুন...'
    : 'এজেন্টের সাথে অডিও সংযোগ হচ্ছে...';
  else if (status === 'in-call') label = `কল চলছে · ${fmt(durationSec)}`;
  else if (status === 'ended') label = timedOutRef.current
    ? 'এজেন্ট এই মুহূর্তে কল ধরতে পারছেন না — চ্যাটে প্রশ্ন লিখুন, আমরা দ্রুত সাহায্য করবো।'
    : 'কল শেষ হয়েছে';

  const waitingMessage = `আসসালামু আলাইকুম, স্বর্ণ সুতায় স্বাগতম। এই মুহূর্তে আমাদের সব এজেন্ট ব্যস্ত আছেন। আপনার কলটি আমাদের কাছে অনেক গুরুত্বপূর্ণ। খুব দ্রুতই আমাদের একজন প্রতিনিধি কল রিসিভ করবেন, সাথে থাকবেন। 🙏`;

  const errInfo = failed ? describeError(errorCode, error) : null;
  const showSpeakerWarning = inCall && !audioUnlocked;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-200 p-3">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-[min(380px,94vw)] p-6 flex flex-col items-center gap-4 relative">

        {/* Minimize: lets the customer keep browsing while the call stays alive */}
        {onMinimize && (ringing || connecting || inCall) && (
          <button
            type="button"
            onClick={onMinimize}
            className="absolute top-3 right-3 h-8 w-8 rounded-full bg-muted hover:bg-muted/70 flex items-center justify-center text-muted-foreground"
            aria-label="ছোট করুন"
            title="ছোট করুন · কল চলতে থাকবে"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        )}

        {failed ? (
          <div className="h-24 w-24 rounded-full bg-destructive/10 border border-destructive/30 flex items-center justify-center text-destructive">
            <AlertTriangle className="h-10 w-10" />
          </div>
        ) : (
          <div className={cn(
            'h-24 w-24 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-primary-foreground relative',
            (ringing || connecting) && 'animate-pulse'
          )}>
            <Sparkles className="h-10 w-10" />
            {(ringing || connecting) && <span className="absolute inset-0 rounded-full bg-primary opacity-30 animate-ping" />}
          </div>
        )}

        <div className="text-center w-full">
          {failed && errInfo ? (
            <>
              <h3 className="font-semibold text-base text-destructive">{errInfo.title}</h3>
              <p className="text-xs text-muted-foreground mt-2 px-2 leading-relaxed">{errInfo.hint}</p>
              {error && errorCode !== 'mic-unavailable' && errorCode !== 'signaling-failed' && (
                <p className="text-[11px] text-muted-foreground/70 mt-2 italic break-words">{error}</p>
              )}
            </>
          ) : (
            <>
              <h3 className="font-semibold text-base">স্বর্ণ সুতা এজেন্ট</h3>
              <p className="text-xs text-muted-foreground mt-1 min-h-[1rem] px-2 flex items-center justify-center gap-1.5">
                {connecting && <Loader2 className="h-3 w-3 animate-spin" />}
                <span>{label}</span>
              </p>
            </>
          )}

          {(ringing || connecting) && !failed && (
            <div className="mt-4 mx-auto max-w-[320px] bg-muted/60 border border-border rounded-xl p-3 text-[12px] leading-relaxed text-foreground/80 text-left">
              {waitingMessage}
            </div>
          )}

          {showSpeakerWarning && (
            <div className="mt-3 mx-auto max-w-[320px] bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5 text-[12px] leading-relaxed text-amber-700 dark:text-amber-300 text-left">
              এজেন্টের কথা শুনতে না পেলে নিচের <b>লাউড / স্পিকার</b> বাটনে চাপুন।
            </div>
          )}
        </div>

        {inCall && (
          <div className="flex flex-col items-center gap-3 mt-2 w-full">
            <CallHealthIndicator pc={pc} connectedAt={connectedAt} variant="pill" />
            {/* Big speaker / loud unlock button — must be a user gesture */}
            {onEnableSpeaker && (
              <Button
                onClick={onEnableSpeaker}
                size="lg"
                variant={audioUnlocked ? 'secondary' : 'default'}
                className={cn(
                  'w-full gap-2 rounded-full h-12 font-semibold',
                  !audioUnlocked && 'bg-emerald-600 hover:bg-emerald-700 text-primary-foreground animate-pulse'
                )}
              >
                {audioUnlocked ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
                {audioUnlocked ? 'লাউড / স্পিকার চালু আছে' : 'লাউড / স্পিকার চালু করুন'}
              </Button>
            )}

            <div className="flex items-center gap-3">
              <Button
                size="icon"
                variant={muted ? 'destructive' : 'secondary'}
                className="h-12 w-12 rounded-full"
                onClick={onToggleMute}
                aria-label={muted ? 'Unmute' : 'Mute'}
              >
                {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </Button>
              <Button
                size="icon"
                variant="destructive"
                className="h-14 w-14 rounded-full"
                onClick={onEnd}
                aria-label="End call"
              >
                <PhoneOff className="h-6 w-6" />
              </Button>
            </div>
          </div>
        )}

        {(ringing || connecting) && (
          <Button
            size="icon"
            variant="destructive"
            className="h-14 w-14 rounded-full mt-2"
            onClick={onEnd}
            aria-label="Cancel"
          >
            <PhoneOff className="h-6 w-6" />
          </Button>
        )}

        {failed && (
          <div className="flex flex-col gap-2 w-full mt-1">
            <div className="flex gap-2 w-full">
              {onRetry && (
                <Button onClick={onRetry} className="flex-1 gap-1.5">
                  <RotateCw className="h-4 w-4" /> আবার চেষ্টা করুন
                </Button>
              )}
              <Button
                variant="outline"
                className="flex-1 gap-1.5"
                onClick={() => { onWriteInChat?.(); onClose(); }}
              >
                <MessageSquare className="h-4 w-4" /> চ্যাটে লিখুন
              </Button>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="text-muted-foreground">
              বন্ধ করুন
            </Button>
          </div>
        )}

        {ended && (
          <Button onClick={onClose} variant="outline" className="mt-2">
            বন্ধ করুন
          </Button>
        )}
      </div>
    </div>
  );
}

// Compact persistent bar — shown when the customer minimizes the call dialog
// or navigates inside the chat panel. Tapping it re-opens the full dialog.
interface MiniBarProps {
  status: CallStatus;
  durationSec: number;
  muted: boolean;
  audioUnlocked?: boolean;
  pc?: RTCPeerConnection | null;
  connectedAt?: number | null;
  onExpand: () => void;
  onToggleMute: () => void;
  onEnableSpeaker?: () => void;
  onEnd: () => void;
}
export function VoiceCallMiniBar({
  status, durationSec, muted, audioUnlocked = false, pc = null, connectedAt = null,
  onExpand, onToggleMute, onEnableSpeaker, onEnd,
}: MiniBarProps) {
  const ringing = status === 'initiating' || status === 'ringing' || status === 'waiting';
  const connecting = status === 'connecting';
  const inCall = status === 'in-call';
  if (!ringing && !connecting && !inCall) return null;

  const label =
    inCall ? `কল চলছে · ${fmt(durationSec)}`
    : connecting ? 'সংযোগ হচ্ছে...'
    : status === 'waiting' ? 'অপেক্ষায়...'
    : 'কল যাচ্ছে...';

  return (
    <div className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-4 sm:bottom-4 z-[55] sm:w-[340px] flex flex-col gap-1.5">
      <div className={cn(
        'flex items-center gap-2 rounded-full shadow-2xl border px-3 py-2 backdrop-blur',
        inCall ? 'bg-emerald-600 border-emerald-700 text-primary-foreground' : 'bg-primary border-primary text-primary-foreground'
      )}>
        <button
          type="button"
          onClick={onExpand}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
          title="কল কন্ট্রোল খুলুন"
        >
          <span className="h-9 w-9 rounded-full bg-primary-foreground/20 flex items-center justify-center shrink-0">
            <Phone className="h-4 w-4" />
          </span>
          <span className="flex flex-col min-w-0">
            <span className="text-[11px] opacity-90 truncate">স্বর্ণ সুতা এজেন্ট</span>
            <span className="text-sm font-semibold tabular-nums truncate">{label}</span>
          </span>
        </button>
        {inCall && onEnableSpeaker && (
          <button
            type="button"
            onClick={onEnableSpeaker}
            className={cn(
              'h-9 w-9 rounded-full flex items-center justify-center shrink-0',
              audioUnlocked ? 'bg-primary-foreground/20' : 'bg-amber-400 text-amber-900 animate-pulse'
            )}
            aria-label="লাউড"
            title={audioUnlocked ? 'স্পিকার চালু' : 'লাউড চালু করুন'}
          >
            {audioUnlocked ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
        )}
        {inCall && (
          <button
            type="button"
            onClick={onToggleMute}
            className="h-9 w-9 rounded-full bg-primary-foreground/20 flex items-center justify-center shrink-0"
            aria-label={muted ? 'Unmute' : 'Mute'}
            title={muted ? 'মাইক চালু' : 'মাইক বন্ধ'}
          >
            {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
        )}
        <button
          type="button"
          onClick={onEnd}
          className="h-9 w-9 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shrink-0"
          aria-label="কল শেষ"
          title="কল শেষ"
        >
          <PhoneOff className="h-4 w-4" />
        </button>
      </div>
      {inCall && (
        <div className="bg-card/95 border border-border rounded-xl shadow-lg px-1.5 py-1.5 backdrop-blur">
          <CallHealthIndicator pc={pc} connectedAt={connectedAt} variant="pill" />
        </div>
      )}
    </div>
  );
}
