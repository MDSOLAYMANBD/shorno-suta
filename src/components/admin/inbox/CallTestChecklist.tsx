// Voice Call Test Checklist
// One-screen QA tool for admins to verify two-way audio works after the
// TURN server fix. Runs entirely client-side. Reuses getIceServers() so
// the checks exercise the exact same code path as a real call.
import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import { Separator } from '@/components/ui/separator';
import { CheckCircle2, XCircle, Loader2, Mic, MicOff, PhoneCall, RefreshCw, Volume2, VolumeX } from 'lucide-react';
import { getIceServers } from '@/lib/turnCredentials';
import GuidedCallTestWizard from './GuidedCallTestWizard';

type Status = 'pending' | 'pass' | 'fail' | 'running';

function StatusIcon({ status }: { status: Status }) {
  if (status === 'pass') return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  if (status === 'fail') return <XCircle className="h-4 w-4 text-destructive" />;
  if (status === 'running') return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  return <span className="h-2 w-2 rounded-full bg-muted-foreground/40 inline-block" />;
}

function Row({ label, hint, status, detail }: { label: string; hint?: string; status: Status; detail?: string }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="pt-1"><StatusIcon status={status} /></div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
        {detail && <div className="text-xs mt-1 font-mono text-muted-foreground break-all">{detail}</div>}
      </div>
    </div>
  );
}

export default function CallTestChecklist() {
  // Environment checks
  const [secureCtx, setSecureCtx] = useState<Status>('pending');
  const [mediaApi, setMediaApi] = useState<Status>('pending');
  const [micPerm, setMicPerm] = useState<Status>('pending');
  const [micPermDetail, setMicPermDetail] = useState<string>('');
  const [online, setOnline] = useState<Status>('pending');

  // TURN test
  const [turnStatus, setTurnStatus] = useState<Status>('pending');
  const [turnDetail, setTurnDetail] = useState<string>('');
  const [turnRanAt, setTurnRanAt] = useState<string>('');

  // Mic loopback
  const [micStatus, setMicStatus] = useState<Status>('pending');
  const [micRanAt, setMicRanAt] = useState<string>('');
  const [micLevel, setMicLevel] = useState(0);
  const [listening, setListening] = useState(false);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);


  // Auto-run env checks
  useEffect(() => {
    setSecureCtx(window.isSecureContext ? 'pass' : 'fail');
    setMediaApi(typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia ? 'pass' : 'fail');
    setOnline(navigator.onLine ? 'pass' : 'fail');

    (async () => {
      try {
        const res = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        setMicPermDetail(res.state);
        setMicPerm(res.state === 'granted' ? 'pass' : res.state === 'denied' ? 'fail' : 'pending');
        res.onchange = () => {
          setMicPermDetail(res.state);
          setMicPerm(res.state === 'granted' ? 'pass' : res.state === 'denied' ? 'fail' : 'pending');
        };
      } catch {
        setMicPermDetail('unknown — browser does not expose permission state');
        setMicPerm('pending');
      }
    })();

    const onOnline = () => setOnline(navigator.onLine ? 'pass' : 'fail');
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOnline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOnline);
      stopMic();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runTurnTest() {
    setTurnStatus('running');
    setTurnDetail('');
    let pc: RTCPeerConnection | null = null;
    try {
      const servers = await getIceServers();
      pc = new RTCPeerConnection({ iceServers: servers, bundlePolicy: 'max-bundle' });
      pc.createDataChannel('probe');

      const counts = { host: 0, srflx: 0, relay: 0, prflx: 0 };
      const relayUrls = new Set<string>();

      pc.onicecandidate = (e) => {
        if (!e.candidate || !e.candidate.candidate) return;
        const parts = e.candidate.candidate.split(' ');
        const typIdx = parts.indexOf('typ');
        const type = typIdx >= 0 ? parts[typIdx + 1] : '';
        if (type in counts) (counts as any)[type]++;
        if (type === 'relay') {
          const proto = parts[2];
          relayUrls.add(`${proto} via ${(e.candidate as any).url || 'unknown'}`);
        }
      };

      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);

      // Wait up to 6s for gathering to complete
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, 6000);
        pc!.onicegatheringstatechange = () => {
          if (pc!.iceGatheringState === 'complete') {
            clearTimeout(t);
            resolve();
          }
        };
      });

      const lines = [
        `host: ${counts.host}  ·  srflx (STUN): ${counts.srflx}  ·  relay (TURN): ${counts.relay}`,
        relayUrls.size ? `TURN servers: ${Array.from(relayUrls).join(', ')}` : 'No TURN relay candidates gathered',
      ];
      setTurnDetail(lines.join('\n'));
      setTurnStatus(counts.relay > 0 ? 'pass' : 'fail');
      setTurnRanAt(new Date().toLocaleTimeString());
    } catch (e: any) {
      setTurnStatus('fail');
      setTurnDetail(`Error: ${e?.message || String(e)}`);
      setTurnRanAt(new Date().toLocaleTimeString());
    } finally {
      try { pc?.close(); } catch { /* ignore */ }
    }
  }

  async function runMicTest() {
    stopMic();
    setMicStatus('running');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
      const ctx = new Ctx();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length);
        setMicLevel(Math.min(1, rms * 3));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();

      if (audioElRef.current) {
        audioElRef.current.srcObject = stream;
        audioElRef.current.muted = !listening;
      }

      setMicStatus('pass');
      setMicRanAt(new Date().toLocaleTimeString());
    } catch (e: any) {
      setMicStatus('fail');
      setMicRanAt(new Date().toLocaleTimeString());
      setTurnDetail((d) => d); // no-op to keep linter quiet
      console.warn('[mic-test]', e);
    }
  }

  function stopMic() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    if (audioElRef.current) {
      audioElRef.current.srcObject = null;
      audioElRef.current.muted = true;
    }
    setListening(false);
    setMicLevel(0);
  }

  function toggleListen() {
    const next = !listening;
    setListening(next);
    if (audioElRef.current) audioElRef.current.muted = !next;
  }

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <PhoneCall className="h-4 w-4 text-primary" />
          Voice Call Test Checklist
          <Badge variant="secondary" className="ml-auto text-xs">After TURN fix</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          মোবাইল থেকে কল করার আগে এই ধাপগুলো চেক করো — দুই দিক থেকে শুনতে পাচ্ছে কিনা নিশ্চিত করার জন্য।
        </p>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* 1. Environment */}
        <section>
          <h3 className="text-sm font-semibold mb-1">1. Environment</h3>
          <div className="rounded-md border bg-background px-3">
            <Row label="Secure context (HTTPS)" hint="WebRTC requires HTTPS" status={secureCtx} />
            <Separator />
            <Row label="getUserMedia API available" status={mediaApi} />
            <Separator />
            <Row label="Microphone permission" status={micPerm} detail={micPermDetail} hint="যদি 'prompt' হয় — Test my mic চাপলে অনুমতি চাইবে" />
            <Separator />
            <Row label="Network online" status={online} />
          </div>
        </section>

        {/* 2. TURN test */}
        <section>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold">2. TURN / ICE reachability</h3>
            <div className="flex items-center gap-2">
              {turnRanAt && <span className="text-[10px] text-muted-foreground">last: {turnRanAt}</span>}
              <Button size="sm" variant="outline" onClick={runTurnTest} disabled={turnStatus === 'running'}>
                {turnStatus === 'running' ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                Test TURN server
              </Button>
            </div>
          </div>
          <div className="rounded-md border bg-background px-3">
            <Row
              label="Relay candidate available"
              hint="Pass = TURN server reachable from this device. Without this, mobile data calls usually fail."
              status={turnStatus}
              detail={turnDetail}
            />
          </div>
        </section>

        {/* 3. Mic loopback */}
        <section>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold">3. Microphone loopback</h3>
            <div className="flex items-center gap-2">
              {micRanAt && <span className="text-[10px] text-muted-foreground">last: {micRanAt}</span>}
              {micStatus === 'pass' ? (
                <>
                  <Button size="sm" variant="outline" onClick={toggleListen}>
                    {listening ? <VolumeX className="h-3 w-3 mr-1" /> : <Volume2 className="h-3 w-3 mr-1" />}
                    {listening ? 'Mute playback' : 'Listen to mic'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={stopMic}>
                    <MicOff className="h-3 w-3 mr-1" /> Stop
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="outline" onClick={runMicTest} disabled={micStatus === 'running'}>
                  {micStatus === 'running' ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Mic className="h-3 w-3 mr-1" />}
                  Test my mic
                </Button>
              )}
            </div>
          </div>
          <div className="rounded-md border bg-background px-3 py-2 space-y-2">
            <Row
              label="Microphone capturing audio"
              hint="কথা বললে নিচের বার নড়বে — ব্রাউজার থেকে অনুমতি দিতে হবে"
              status={micStatus}
            />
            {micStatus === 'pass' && (
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-[width] duration-75"
                  style={{ width: `${Math.round(micLevel * 100)}%` }}
                />
              </div>
            )}
            {/* hidden until user toggles Listen — prevents echo by default */}
            <audio ref={audioElRef} autoPlay playsInline muted className="hidden" />
          </div>
        </section>

        {/* 4. Guided wizard (replaces old static manual checklist) */}
        <GuidedCallTestWizard />

      </CardContent>
    </Card>
  );
}
