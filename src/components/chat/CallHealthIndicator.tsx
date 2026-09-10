// Live call health indicator — shared by admin (IncomingCallNotification)
// and customer (VoiceCallDialog / VoiceCallMiniBar) surfaces.
//
// Reads RTCPeerConnection.getStats() every 2 seconds and surfaces:
//   - connection / ICE connection state
//   - selected candidate-pair type (relay = TURN, srflx = STUN, host = LAN)
//   - count of local relay candidates gathered
//   - round-trip time, jitter, inbound packet loss
//   - connected duration
//
// Read-only — never mutates the peer connection. Safe to mount conditionally.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ChevronDown, ChevronUp, Wifi, Shield, Globe, Network, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export interface CallHealthIndicatorProps {
  pc: RTCPeerConnection | null;
  connectedAt: number | null;
  // `pill` = compact (mini bar / customer dialog footer),
  // `inline` = full-width row (admin in-call card).
  variant?: 'pill' | 'inline';
  className?: string;
}

type PairType = 'relay' | 'srflx' | 'host' | 'prflx' | 'unknown';
type Quality = 'good' | 'fair' | 'poor' | 'unknown';

interface HealthSnapshot {
  connState: RTCPeerConnectionState;
  iceState: RTCIceConnectionState;
  pairType: PairType;
  localRelayCount: number;
  rttMs: number | null;
  jitterMs: number | null;
  lossPct: number | null;
  bytesReceived: number;
  bytesSent: number;
}

const EMPTY: HealthSnapshot = {
  connState: 'new',
  iceState: 'new',
  pairType: 'unknown',
  localRelayCount: 0,
  rttMs: null,
  jitterMs: null,
  lossPct: null,
  bytesReceived: 0,
  bytesSent: 0,
};

function fmtDuration(sec: number) {
  const m = Math.floor(sec / 60);
  return `${m}:${String(sec % 60).padStart(2, '0')}`;
}

function pairLabel(t: PairType) {
  switch (t) {
    case 'relay': return 'TURN রিলে';
    case 'srflx': return 'STUN ডাইরেক্ট';
    case 'host':  return 'লোকাল নেটওয়ার্ক';
    case 'prflx': return 'পিয়ার রিফ্লেক্সিভ';
    default:      return 'অজানা';
  }
}

function pairIcon(t: PairType) {
  switch (t) {
    case 'relay': return <Shield className="h-3 w-3" />;
    case 'srflx': return <Globe className="h-3 w-3" />;
    case 'host':  return <Network className="h-3 w-3" />;
    default:      return <Wifi className="h-3 w-3" />;
  }
}

function classify(snap: HealthSnapshot): Quality {
  if (snap.connState === 'failed' || snap.connState === 'disconnected' || snap.connState === 'closed') return 'poor';
  if (snap.connState !== 'connected') return 'unknown';
  const rtt = snap.rttMs;
  const loss = snap.lossPct;
  if (rtt == null && loss == null) return 'good';
  const rttBad = rtt != null && rtt > 400;
  const rttFair = rtt != null && rtt > 200;
  const lossBad = loss != null && loss > 5;
  const lossFair = loss != null && loss > 2;
  if (rttBad || lossBad) return 'poor';
  if (rttFair || lossFair) return 'fair';
  return 'good';
}

function qualityColor(q: Quality) {
  switch (q) {
    case 'good': return 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/30';
    case 'fair': return 'text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/30';
    case 'poor': return 'text-destructive bg-destructive/10 border-destructive/30';
    default:     return 'text-muted-foreground bg-muted border-border';
  }
}

function qualityLabel(q: Quality) {
  switch (q) {
    case 'good': return 'ভালো';
    case 'fair': return 'মাঝারি';
    case 'poor': return 'দুর্বল';
    default:     return 'সংযোগ হচ্ছে';
  }
}

interface QualitySegment {
  quality: Quality;
  startMs: number;
  endMs: number | null;
  rttMs: number | null;
  lossPct: number | null;
  pairType: PairType;
  connState: RTCPeerConnectionState;
}

const MAX_SEGMENTS = 50;

export default function CallHealthIndicator({
  pc, connectedAt, variant = 'pill', className,
}: CallHealthIndicatorProps) {
  const [snap, setSnap] = useState<HealthSnapshot>(EMPTY);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [segments, setSegments] = useState<QualitySegment[]>([]);
  const prevPacketsRef = useRef<{ recv: number; lost: number }>({ recv: 0, lost: 0 });

  // 1-second tick for the connected-duration display
  useEffect(() => {
    if (!connectedAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [connectedAt]);

  // Poll getStats() every 2s
  useEffect(() => {
    if (!pc) { setSnap(EMPTY); setSegments([]); prevPacketsRef.current = { recv: 0, lost: 0 }; return; }
    let cancelled = false;

    const sample = async () => {
      if (!pc) return;
      try {
        const stats = await pc.getStats();

        let pairType: PairType = 'unknown';
        let rttMs: number | null = null;
        let bytesReceived = 0;
        let bytesSent = 0;
        let jitterMs: number | null = null;
        let packetsReceived = 0;
        let packetsLost = 0;
        let localRelayCount = 0;

        let selectedPairId: string | null = null;
        stats.forEach((r: any) => {
          if (r.type === 'transport' && r.selectedCandidatePairId) {
            selectedPairId = r.selectedCandidatePairId;
          }
          if (r.type === 'local-candidate' && r.candidateType === 'relay') {
            localRelayCount++;
          }
        });

        // Fallback when transport doesn't expose selectedCandidatePairId (Safari)
        if (!selectedPairId) {
          stats.forEach((r: any) => {
            if (r.type === 'candidate-pair' && r.state === 'succeeded' && r.nominated) {
              selectedPairId = r.id;
            }
          });
        }

        if (selectedPairId) {
          const pair: any = stats.get(selectedPairId);
          if (pair) {
            if (typeof pair.currentRoundTripTime === 'number') {
              rttMs = Math.round(pair.currentRoundTripTime * 1000);
            }
            const local: any = pair.localCandidateId ? stats.get(pair.localCandidateId) : null;
            const remote: any = pair.remoteCandidateId ? stats.get(pair.remoteCandidateId) : null;
            const lt: string | undefined = local?.candidateType;
            const rt: string | undefined = remote?.candidateType;
            const known = (v: string | undefined): v is PairType =>
              v === 'relay' || v === 'srflx' || v === 'host' || v === 'prflx';
            if (lt === 'relay' || rt === 'relay') pairType = 'relay';
            else if (lt === 'srflx' || rt === 'srflx') pairType = 'srflx';
            else if (lt === 'host' && rt === 'host') pairType = 'host';
            else if (known(lt)) pairType = lt;
          }
        }

        stats.forEach((r: any) => {
          if (r.type === 'inbound-rtp' && r.kind === 'audio') {
            bytesReceived += r.bytesReceived || 0;
            packetsReceived += r.packetsReceived || 0;
            packetsLost += r.packetsLost || 0;
            if (typeof r.jitter === 'number') jitterMs = Math.round(r.jitter * 1000);
          }
          if (r.type === 'outbound-rtp' && r.kind === 'audio') {
            bytesSent += r.bytesSent || 0;
          }
        });

        const dRecv = packetsReceived - prevPacketsRef.current.recv;
        const dLost = packetsLost - prevPacketsRef.current.lost;
        const denom = dRecv + dLost;
        const lossPct = denom > 0 ? Math.max(0, (dLost / denom) * 100) : null;
        prevPacketsRef.current = { recv: packetsReceived, lost: packetsLost };

        if (cancelled) return;
        const nextSnap: HealthSnapshot = {
          connState: pc.connectionState,
          iceState: pc.iceConnectionState,
          pairType,
          localRelayCount,
          rttMs,
          jitterMs,
          lossPct: lossPct == null ? null : Math.round(lossPct * 10) / 10,
          bytesReceived,
          bytesSent,
        };
        setSnap(nextSnap);

        // Record quality transitions for the timeline
        const newQ = classify(nextSnap);
        setSegments((prev) => {
          const ts = Date.now();
          const last = prev[prev.length - 1];
          const open: QualitySegment = {
            quality: newQ,
            startMs: ts,
            endMs: null,
            rttMs: nextSnap.rttMs,
            lossPct: nextSnap.lossPct,
            pairType: nextSnap.pairType,
            connState: nextSnap.connState,
          };
          if (!last) return [open];
          if (last.quality === newQ) return prev;
          const closed: QualitySegment = { ...last, endMs: ts };
          const next = [...prev.slice(0, -1), closed, open];
          return next.length > MAX_SEGMENTS ? next.slice(next.length - MAX_SEGMENTS) : next;
        });
      } catch {
        /* ignore transient stats errors */
      }
    };

    sample();
    const id = setInterval(sample, 2000);
    return () => { cancelled = true; clearInterval(id); };
  }, [pc]);

  const quality = useMemo(() => classify(snap), [snap]);
  const durationSec = connectedAt ? Math.max(0, Math.floor((now - connectedAt) / 1000)) : 0;

  if (!pc) return null;

  const colorCls = qualityColor(quality);
  const dotCls =
    quality === 'good' ? 'bg-emerald-500' :
    quality === 'fair' ? 'bg-amber-500' :
    quality === 'poor' ? 'bg-destructive' : 'bg-muted-foreground/40';

  if (variant === 'pill') {
    return (
      <div className={cn('w-full', className)}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-full border text-[11px] font-medium transition-colors',
            colorCls,
          )}
          aria-label="Call health"
        >
          <span className={cn('h-2 w-2 rounded-full shrink-0', dotCls, quality !== 'unknown' && 'animate-pulse')} />
          <Activity className="h-3 w-3 shrink-0" />
          <span className="truncate">কল কোয়ালিটি · {qualityLabel(quality)}</span>
          {connectedAt && (
            <span className="ml-auto tabular-nums opacity-80">{fmtDuration(durationSec)}</span>
          )}
          {open ? <ChevronUp className="h-3 w-3 shrink-0" /> : <ChevronDown className="h-3 w-3 shrink-0" />}
        </button>
        {open && <DetailGrid snap={snap} durationSec={durationSec} segments={segments} connectedAt={connectedAt} now={now} />}
      </div>
    );
  }

  return (
    <div className={cn('w-full rounded-lg border', colorCls, className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] font-medium"
      >
        <span className={cn('h-2 w-2 rounded-full shrink-0', dotCls, quality !== 'unknown' && 'animate-pulse')} />
        {pairIcon(snap.pairType)}
        <span>{qualityLabel(quality)}</span>
        <span className="opacity-70">·</span>
        <span className="opacity-90 truncate">{pairLabel(snap.pairType)}</span>
        {snap.rttMs != null && <><span className="opacity-70">·</span><span className="tabular-nums">{snap.rttMs}ms</span></>}
        {connectedAt && <span className="ml-auto tabular-nums opacity-80">{fmtDuration(durationSec)}</span>}
        {open ? <ChevronUp className="h-3 w-3 shrink-0" /> : <ChevronDown className="h-3 w-3 shrink-0" />}
      </button>
      {open && <DetailGrid snap={snap} durationSec={durationSec} segments={segments} connectedAt={connectedAt} now={now} />}
    </div>
  );
}

function DetailGrid({
  snap, durationSec, segments, connectedAt, now,
}: {
  snap: HealthSnapshot;
  durationSec: number;
  segments: QualitySegment[];
  connectedAt: number | null;
  now: number;
}) {
  const cells: { label: string; value: string; tone?: 'ok' | 'warn' | 'bad' }[] = [
    { label: 'Connection', value: snap.connState },
    { label: 'ICE', value: snap.iceState },
    { label: 'Path', value: pairLabel(snap.pairType), tone: snap.pairType === 'relay' ? 'ok' : snap.pairType === 'unknown' ? 'warn' : 'ok' },
    { label: 'Relay candidates', value: String(snap.localRelayCount), tone: snap.localRelayCount > 0 ? 'ok' : 'warn' },
    { label: 'RTT', value: snap.rttMs != null ? `${snap.rttMs} ms` : '—', tone: snap.rttMs == null ? undefined : snap.rttMs > 400 ? 'bad' : snap.rttMs > 200 ? 'warn' : 'ok' },
    { label: 'Jitter', value: snap.jitterMs != null ? `${snap.jitterMs} ms` : '—', tone: snap.jitterMs == null ? undefined : snap.jitterMs > 50 ? 'warn' : 'ok' },
    { label: 'Inbound loss', value: snap.lossPct != null ? `${snap.lossPct}%` : '—', tone: snap.lossPct == null ? undefined : snap.lossPct > 5 ? 'bad' : snap.lossPct > 2 ? 'warn' : 'ok' },
    { label: 'Connected', value: fmtDuration(durationSec) },
    { label: 'In', value: `${(snap.bytesReceived / 1024).toFixed(1)} KB` },
    { label: 'Out', value: `${(snap.bytesSent / 1024).toFixed(1)} KB` },
  ];

  const relMMSS = (absMs: number) => {
    if (!connectedAt) return '--:--';
    const sec = Math.max(0, Math.floor((absMs - connectedAt) / 1000));
    return fmtDuration(sec);
  };

  const copyTimeline = async () => {
    const lines = segments.map((s) => {
      const start = relMMSS(s.startMs);
      const end = s.endMs ? relMMSS(s.endMs) : 'now';
      const dur = Math.max(0, Math.floor(((s.endMs ?? Date.now()) - s.startMs) / 1000));
      const meta = [
        s.rttMs != null ? `RTT ${s.rttMs}ms` : null,
        s.lossPct != null ? `loss ${s.lossPct}%` : null,
        s.pairType !== 'unknown' ? s.pairType : null,
      ].filter(Boolean).join(' · ');
      return `${s.quality.padEnd(7)} ${start} → ${end}  (${dur}s)${meta ? '  ' + meta : ''}`;
    }).join('\n');
    try {
      await navigator.clipboard.writeText(lines || '(no transitions yet)');
      toast.success('Timeline কপি হয়েছে');
    } catch {
      toast.error('Clipboard access blocked');
    }
  };

  return (
    <div className="bg-background/60 rounded-b-lg border-t border-border/50 px-2 py-2 text-[10px] font-mono">
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {cells.map((c) => (
          <div key={c.label} className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground truncate">{c.label}</span>
            <span className={cn(
              'tabular-nums shrink-0',
              c.tone === 'ok' && 'text-emerald-600 dark:text-emerald-400',
              c.tone === 'warn' && 'text-amber-600 dark:text-amber-400',
              c.tone === 'bad' && 'text-destructive',
            )}>{c.value}</span>
          </div>
        ))}
      </div>

      {segments.length > 0 && (
        <div className="mt-2 pt-2 border-t border-border/50">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground not-italic">
              Quality timeline
            </span>
            <button
              type="button"
              onClick={copyTimeline}
              className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <Copy className="h-3 w-3" /> Copy
            </button>
          </div>
          <div className="max-h-40 overflow-auto space-y-0.5 pr-1">
            {segments.map((s, i) => {
              const isActive = i === segments.length - 1 && s.endMs == null;
              const endAbs = s.endMs ?? now;
              const dur = Math.max(0, Math.floor((endAbs - s.startMs) / 1000));
              const dot =
                s.quality === 'good' ? 'bg-emerald-500' :
                s.quality === 'fair' ? 'bg-amber-500' :
                s.quality === 'poor' ? 'bg-destructive' : 'bg-muted-foreground/40';
              const meta = [
                s.rttMs != null ? `RTT ${s.rttMs}ms` : null,
                s.lossPct != null ? `loss ${s.lossPct}%` : null,
              ].filter(Boolean).join(' · ');
              return (
                <div
                  key={i}
                  className={cn(
                    'flex items-center gap-1.5 px-1 py-0.5 rounded',
                    isActive && 'bg-muted/60',
                  )}
                >
                  <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', dot, isActive && 'animate-pulse')} />
                  <span className="w-10 shrink-0 capitalize">{s.quality}</span>
                  <span className="tabular-nums shrink-0 text-muted-foreground">
                    {relMMSS(s.startMs)} → {isActive ? 'now' : relMMSS(endAbs)}
                  </span>
                  <span className="tabular-nums shrink-0 text-muted-foreground/80">({dur}s)</span>
                  {meta && <span className="truncate text-muted-foreground/80">· {meta}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
