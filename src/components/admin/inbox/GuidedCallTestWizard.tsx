// Guided Call Test Wizard
// Step-by-step verification of the full visitor → admin call lifecycle.
// Auto-detects ringing / accepted / ended transitions on `chat_calls` via
// Supabase realtime; falls back to manual confirm where the UI side can't be
// observed from the DB (e.g. "did the popup actually appear?").
//
// Read-only against `chat_calls` — no mutations, no schema changes.
//
// Per-step Event Log: every realtime payload, every manual pass/fail mark, and
// every audio-confirmation toggle is captured as a `LogEvent` with timestamp
// and source. Each step row exposes a collapsible log panel; a global
// "Copy full log" button serializes the whole timeline as JSON for bug reports.
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Circle,
  PlayCircle,
  RotateCcw,
  ListChecks,
  Copy,
  AlertTriangle,
  PhoneIncoming,
  ChevronRight,
  Eraser,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type StepStatus = 'locked' | 'pending' | 'pass' | 'fail';
type StepNum = 0 | 1 | 2 | 3 | 4 | 5;

type LogEvent = {
  id: string;
  ts: number;
  step: StepNum;            // 0 = global (arm/reset/system)
  kind: 'realtime' | 'manual' | 'auto' | 'state' | 'audio' | 'system';
  message: string;
  payload?: unknown;
};

const MAX_EVENTS = 200;

type State = {
  armed: boolean;
  callId: string | null;
  caller: { name?: string; phone?: string } | null;
  startedAt: number | null;
  ringingAt: number | null;
  acceptedAt: number | null;
  endedAt: number | null;
  steps: Record<1 | 2 | 3 | 4 | 5, StepStatus>;
  detail: Record<1 | 2 | 3 | 4 | 5, string>;
  audioAdmin: boolean;
  audioCustomer: boolean;
  events: LogEvent[];
  capWarned: boolean;
};

const initialState: State = {
  armed: false,
  callId: null,
  caller: null,
  startedAt: null,
  ringingAt: null,
  acceptedAt: null,
  endedAt: null,
  steps: { 1: 'locked', 2: 'locked', 3: 'locked', 4: 'locked', 5: 'locked' },
  detail: { 1: '', 2: '', 3: '', 4: '', 5: '' },
  audioAdmin: false,
  audioCustomer: false,
  events: [],
  capWarned: false,
};

type Action =
  | { type: 'arm' }
  | { type: 'reset' }
  | { type: 'clear-log' }
  | { type: 'ringing-detected'; callId: string; caller: { name?: string; phone?: string }; at: number }
  | { type: 'set-step'; step: 1 | 2 | 3 | 4 | 5; status: StepStatus; detail?: string }
  | { type: 'accepted'; at: number }
  | { type: 'ended'; at: number; clean: boolean }
  | { type: 'toggle-audio'; side: 'admin' | 'customer'; value: boolean }
  | { type: 'log'; event: Omit<LogEvent, 'id' | 'ts'> & { ts?: number } };

function makeEventId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function appendEvent(state: State, ev: Omit<LogEvent, 'id' | 'ts'> & { ts?: number }): State {
  const full: LogEvent = {
    id: makeEventId(),
    ts: ev.ts ?? Date.now(),
    step: ev.step,
    kind: ev.kind,
    message: ev.message,
    payload: ev.payload,
  };
  let events = [...state.events, full];
  let capWarned = state.capWarned;
  if (events.length > MAX_EVENTS) {
    const overflow = events.length - MAX_EVENTS;
    events = events.slice(overflow);
    if (!capWarned) {
      events.unshift({
        id: makeEventId(),
        ts: Date.now(),
        step: 0,
        kind: 'system',
        message: `Event log capped at ${MAX_EVENTS} — older entries dropped`,
      });
      capWarned = true;
    }
  }
  return { ...state, events, capWarned };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'arm':
      return appendEvent(
        { ...initialState, armed: true, startedAt: Date.now(), steps: { ...initialState.steps, 1: 'pending' } },
        { step: 0, kind: 'system', message: 'Guided test armed — waiting for visitor call' },
      );
    case 'reset':
      return initialState;
    case 'clear-log':
      return { ...state, events: [], capWarned: false };
    case 'ringing-detected':
      return {
        ...state,
        callId: action.callId,
        caller: action.caller,
        ringingAt: action.at,
        steps: { ...state.steps, 1: 'pass', 2: 'pending' },
        detail: { ...state.detail, 1: `${action.caller.name || 'Unknown'} • ${action.caller.phone || 'no phone'}` },
      };
    case 'set-step':
      return {
        ...state,
        steps: { ...state.steps, [action.step]: action.status },
        detail: action.detail !== undefined ? { ...state.detail, [action.step]: action.detail } : state.detail,
      };
    case 'accepted':
      return {
        ...state,
        acceptedAt: action.at,
        steps: {
          ...state.steps,
          3: 'pass',
          4: state.steps[4] === 'locked' ? 'pending' : state.steps[4],
        },
        detail: {
          ...state.detail,
          3: state.ringingAt ? `Connected in ${((action.at - state.ringingAt) / 1000).toFixed(1)}s` : 'Connected',
        },
      };
    case 'ended':
      return {
        ...state,
        endedAt: action.at,
        steps: { ...state.steps, 5: action.clean ? 'pass' : 'fail' },
        detail: {
          ...state.detail,
          5: state.acceptedAt
            ? `Duration ${((action.at - state.acceptedAt) / 1000).toFixed(0)}s`
            : 'Ended without accept',
        },
      };
    case 'toggle-audio': {
      const next = { ...state, [action.side === 'admin' ? 'audioAdmin' : 'audioCustomer']: action.value };
      const both = next.audioAdmin && next.audioCustomer;
      return {
        ...next,
        steps: {
          ...next.steps,
          4: both ? 'pass' : next.steps[4] === 'locked' ? 'locked' : 'pending',
          5: both && next.steps[5] === 'locked' ? 'pending' : next.steps[5],
        },
      };
    }
    case 'log':
      return appendEvent(state, action.event);
  }
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === 'pass') return <CheckCircle2 className="h-5 w-5 text-green-600" />;
  if (status === 'fail') return <XCircle className="h-5 w-5 text-destructive" />;
  if (status === 'pending') return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
  return <Circle className="h-5 w-5 text-muted-foreground/40" />;
}

function StatusBadge({ status }: { status: StepStatus }) {
  const map: Record<StepStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    locked: { label: 'Locked', variant: 'outline' },
    pending: { label: 'Waiting…', variant: 'secondary' },
    pass: { label: 'Done', variant: 'default' },
    fail: { label: 'Failed', variant: 'destructive' },
  };
  const m = map[status];
  return <Badge variant={m.variant} className="text-[10px] uppercase tracking-wide">{m.label}</Badge>;
}

const STATS_SNIPPET = `// Paste in DevTools console while a call is connected
(async () => {
  const pc = window.__lastPC; // exposed by useVoiceCall / IncomingCallNotification if available
  if (!pc) return console.warn('No RTCPeerConnection ref — open the call first');
  const s = await pc.getStats();
  s.forEach(r => {
    if (r.type === 'inbound-rtp' && r.kind === 'audio') console.log('IN  bytes:', r.bytesReceived, 'packets:', r.packetsReceived);
    if (r.type === 'outbound-rtp' && r.kind === 'audio') console.log('OUT bytes:', r.bytesSent, 'packets:', r.packetsSent);
  });
})();`;

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    try {
      return String(value);
    } catch {
      return '[unserializable]';
    }
  }
}

function formatEvent(ev: LogEvent, startedAt: number | null): string {
  const rel = startedAt ? `+${((ev.ts - startedAt) / 1000).toFixed(2)}s` : new Date(ev.ts).toISOString().slice(11, 23);
  const head = `${rel.padEnd(8, ' ')}  ${ev.kind.padEnd(8, ' ')} ${ev.message}`;
  if (ev.payload === undefined) return head;
  const json = safeStringify(ev.payload);
  if (json.length <= 80 && !json.includes('\n')) return `${head}  ${json}`;
  // indent each payload line by 2 spaces
  return `${head}\n${json.split('\n').map((l) => '  ' + l).join('\n')}`;
}

export default function GuidedCallTestWizard() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const callIdRef = useRef<string | null>(null);
  const [showNoPopupHint, setShowNoPopupHint] = useState(false);

  // Keep ref in sync so realtime handlers see the latest call id
  useEffect(() => { callIdRef.current = state.callId; }, [state.callId]);

  // Helpers that combine state changes with log entries
  const log = (event: Omit<LogEvent, 'id' | 'ts'>) => dispatch({ type: 'log', event });
  const markPass = (step: 1 | 2 | 3 | 4 | 5, note: string) => {
    dispatch({ type: 'set-step', step, status: 'pass', detail: note });
    log({ step, kind: 'manual', message: `Marked PASS — ${note}` });
  };
  const markFail = (step: 1 | 2 | 3 | 4 | 5, note: string) => {
    dispatch({ type: 'set-step', step, status: 'fail', detail: note });
    log({ step, kind: 'manual', message: `Marked FAIL — ${note}` });
  };

  // Subscribe to chat_calls when armed
  useEffect(() => {
    if (!state.armed) return;
    const nonce = Math.random().toString(36).slice(2, 8);
    const ch = supabase
      .channel(`guided-call-test-${nonce}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_calls' }, (payload) => {
        const row: any = payload.new;
        if (!row || row.status !== 'ringing') return;
        if (callIdRef.current) return; // already tracking one
        log({
          step: 1,
          kind: 'realtime',
          message: `INSERT chat_calls status=${row.status}`,
          payload: row,
        });
        dispatch({
          type: 'ringing-detected',
          callId: row.id,
          caller: { name: row.caller_name, phone: row.caller_phone },
          at: Date.now(),
        });
        log({ step: 1, kind: 'auto', message: 'Auto-detected ringing → step 1 PASS, step 2 pending' });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_calls' }, (payload) => {
        const row: any = payload.new;
        if (!row || !callIdRef.current || row.id !== callIdRef.current) return;
        const s = row.status as string;
        const isAccepted = s === 'accepted' || s === 'in-call' || s === 'in_call';
        const isTerminal = s === 'ended' || s === 'rejected' || s === 'failed' || s === 'missed';
        // Attribute the realtime payload to the relevant step
        const targetStep: StepNum = isAccepted ? 3 : isTerminal ? 5 : 0;
        log({
          step: targetStep,
          kind: 'realtime',
          message: `UPDATE chat_calls status=${s}`,
          payload: row,
        });
        if (isAccepted && !state.acceptedAt) {
          dispatch({ type: 'accepted', at: Date.now() });
          log({ step: 3, kind: 'auto', message: 'Auto-detected accepted → step 3 PASS' });
        }
        if (isTerminal) {
          const clean = s === 'ended';
          if (!clean && !state.acceptedAt) {
            dispatch({ type: 'set-step', step: 3, status: 'fail', detail: `Call ${s} before accept` });
            log({ step: 3, kind: 'auto', message: `Step 3 FAIL — call ${s} before accept` });
          }
          dispatch({ type: 'ended', at: Date.now(), clean });
          log({ step: 5, kind: 'auto', message: `Auto-detected terminal status=${s} → step 5 ${clean ? 'PASS' : 'FAIL'}` });
        }
      })
      .subscribe((status) => {
        log({ step: 0, kind: 'system', message: `Realtime channel status: ${status}` });
      });
    channelRef.current = ch;
    return () => {
      try { supabase.removeChannel(ch); } catch { /* ignore */ }
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.armed]);

  const completed = useMemo(
    () => Object.values(state.steps).filter((s) => s === 'pass').length,
    [state.steps]
  );
  const allDone = completed === 5;
  const totalElapsed = state.startedAt && state.endedAt
    ? ((state.endedAt - state.startedAt) / 1000).toFixed(0)
    : null;

  // Group events by step for per-row rendering
  const eventsByStep = useMemo(() => {
    const groups: Record<1 | 2 | 3 | 4 | 5, LogEvent[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    for (const e of state.events) {
      if (e.step >= 1 && e.step <= 5) groups[e.step as 1 | 2 | 3 | 4 | 5].push(e);
    }
    return groups;
  }, [state.events]);

  const arm = () => dispatch({ type: 'arm' });
  const reset = () => { dispatch({ type: 'reset' }); setShowNoPopupHint(false); };

  const copySnippet = async () => {
    try {
      await navigator.clipboard.writeText(STATS_SNIPPET);
      toast.success('Snippet কপি হয়েছে — DevTools console-এ পেস্ট করো');
    } catch {
      toast.error('Clipboard access blocked');
    }
  };

  const copyFullLog = async () => {
    try {
      const dump = {
        startedAt: state.startedAt,
        endedAt: state.endedAt,
        callId: state.callId,
        caller: state.caller,
        steps: state.steps,
        detail: state.detail,
        events: state.events,
      };
      await navigator.clipboard.writeText(JSON.stringify(dump, null, 2));
      toast.success(`Full log কপি হয়েছে (${state.events.length} events)`);
    } catch {
      toast.error('Clipboard access blocked');
    }
  };

  return (
    <Card className="mt-4 border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ListChecks className="h-4 w-4 text-primary" />
          Guided Call Test
          <Badge variant="secondary" className="ml-auto text-xs">{completed}/5 steps</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          ধাপে ধাপে ভিজিটর কল → অ্যাডমিন রিং → অ্যাকসেপ্ট → দুই-পাশের অডিও → কল শেষ — সব verify করো।
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {!state.armed ? (
            <Button size="sm" onClick={arm}>
              <PlayCircle className="h-4 w-4 mr-1" /> Start guided test
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={reset}>
              <RotateCcw className="h-4 w-4 mr-1" /> Reset
            </Button>
          )}
          {state.armed && !state.callId && (
            <span className="text-xs text-muted-foreground">
              এখন কাস্টমার ডিভাইস থেকে চ্যাটে গিয়ে call দাও — automatically detect হবে।
            </span>
          )}
        </div>

        {/* Steps */}
        <div className="rounded-md border bg-background divide-y">
          {/* Step 1 */}
          <StepRow
            n={1}
            title="Visitor placed call"
            hint="কাস্টমার চ্যাট উইজেট থেকে Call চাপলে chat_calls row-এ status=ringing হবে"
            status={state.steps[1]}
            detail={state.detail[1]}
            events={eventsByStep[1]}
            startedAt={state.startedAt}
            action={
              state.armed && state.steps[1] === 'pending' ? (
                <Button size="sm" variant="ghost" onClick={() => markPass(1, 'Marked manually')}>
                  Mark done
                </Button>
              ) : null
            }
          />

          {/* Step 2 */}
          <StepRow
            n={2}
            title="Admin popup appeared"
            hint="IncomingCallNotification dialog স্ক্রিনে এসেছে এবং রিং হচ্ছে?"
            status={state.steps[2]}
            detail={state.detail[2]}
            events={eventsByStep[2]}
            startedAt={state.startedAt}
            action={
              state.steps[2] === 'pending' ? (
                <div className="flex flex-col items-end gap-1">
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => markPass(2, 'Confirmed visually')}>
                      Yes, popup showed
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => { markFail(2, 'No popup'); setShowNoPopupHint(true); }}>
                      No popup
                    </Button>
                  </div>
                </div>
              ) : null
            }
          />
          {showNoPopupHint && state.steps[2] === 'fail' && (
            <div className="px-3 py-2 bg-destructive/5 border-t-0 text-xs space-y-1">
              <div className="flex items-center gap-1 font-semibold text-destructive">
                <AlertTriangle className="h-3 w-3" /> Common causes
              </div>
              <ul className="list-disc ml-5 space-y-0.5 text-muted-foreground">
                <li>Tab inactive বা browser tab background-এ — Chrome autoplay block করছে</li>
                <li>লগইন user-এর admin/staff role নাই — RLS row return করেনি</li>
                <li>Realtime channel subscribe হয়নি — page refresh দাও</li>
                <li>Notification permission blocked — browser settings-এ allow করো</li>
              </ul>
            </div>
          )}

          {/* Step 3 */}
          <StepRow
            n={3}
            title="Accepted — both sides connected"
            hint="অ্যাডমিন Accept চাপলে status accepted/in-call হবে — auto detect"
            status={state.steps[3]}
            detail={state.detail[3]}
            events={eventsByStep[3]}
            startedAt={state.startedAt}
          />

          {/* Step 4 */}
          <StepRow
            n={4}
            title="Two-way audio confirmed"
            hint="দুই দিক থেকেই কথা শোনা যাচ্ছে কিনা confirm করো"
            status={state.steps[4]}
            detail={state.detail[4]}
            events={eventsByStep[4]}
            startedAt={state.startedAt}
          />
          {(state.steps[4] === 'pending' || state.steps[4] === 'pass') && (
            <div className="px-3 py-2 space-y-2 bg-muted/20">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox
                  checked={state.audioAdmin}
                  onCheckedChange={(v) => {
                    const value = !!v;
                    dispatch({ type: 'toggle-audio', side: 'admin', value });
                    log({ step: 4, kind: 'audio', message: `admin→customer audible = ${value}` });
                  }}
                />
                Admin spoke → customer confirmed audible
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox
                  checked={state.audioCustomer}
                  onCheckedChange={(v) => {
                    const value = !!v;
                    dispatch({ type: 'toggle-audio', side: 'customer', value });
                    log({ step: 4, kind: 'audio', message: `customer→admin audible = ${value}` });
                  }}
                />
                Customer spoke → admin confirmed audible
              </label>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={copySnippet}>
                <Copy className="h-3 w-3 mr-1" /> Copy audio-stats console snippet
              </Button>
            </div>
          )}

          {/* Step 5 */}
          <StepRow
            n={5}
            title="Call ended cleanly"
            hint="End Call চাপলে status=ended এবং ended_at set হবে — auto detect"
            status={state.steps[5]}
            detail={state.detail[5]}
            events={eventsByStep[5]}
            startedAt={state.startedAt}
          />
        </div>

        {/* Footer summary */}
        <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground font-mono px-1">
          {state.callId && (
            <span className="inline-flex items-center gap-1">
              <PhoneIncoming className="h-3 w-3" /> tracking call_id: {state.callId.slice(0, 8)}…
            </span>
          )}
          <span>Total events: {state.events.length}</span>
          <div className="ml-auto flex gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={copyFullLog}
              disabled={state.events.length === 0}
            >
              <Copy className="h-3 w-3 mr-1" /> Copy full log
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => dispatch({ type: 'clear-log' })}
              disabled={state.events.length === 0}
            >
              <Eraser className="h-3 w-3 mr-1" /> Clear log
            </Button>
          </div>
        </div>

        {allDone && (
          <div className="rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 px-3 py-2 flex items-center gap-2 text-sm text-green-800 dark:text-green-300">
            <CheckCircle2 className="h-4 w-4" />
            All 5 steps passed{totalElapsed ? ` in ${totalElapsed}s` : ''}. Voice call flow verified end-to-end ✓
            <Button size="sm" variant="outline" className="ml-auto h-7" onClick={reset}>Run again</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StepRow({
  n,
  title,
  hint,
  status,
  detail,
  action,
  events,
  startedAt,
}: {
  n: number;
  title: string;
  hint?: string;
  status: StepStatus;
  detail?: string;
  action?: React.ReactNode;
  events: LogEvent[];
  startedAt: number | null;
}) {
  return (
    <div className="flex items-start gap-3 px-3 py-3">
      <div className="pt-0.5"><StepIcon status={status} /></div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-mono">{n}.</span>
          <span className="text-sm font-medium">{title}</span>
          <div className="ml-auto"><StatusBadge status={status} /></div>
        </div>
        {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
        {detail && <div className="text-xs mt-1 font-mono text-muted-foreground break-all">{detail}</div>}
        {events.length > 0 && (
          <Collapsible>
            <CollapsibleTrigger className="group text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mt-1.5">
              <ChevronRight className="h-3 w-3 transition-transform group-data-[state=open]:rotate-90" />
              Log ({events.length})
            </CollapsibleTrigger>
            <CollapsibleContent>
              <pre className="mt-1 rounded bg-muted/40 border text-[10.5px] leading-snug font-mono p-2 max-h-56 overflow-auto whitespace-pre-wrap break-all">
                {events.map((e) => formatEvent(e, startedAt)).join('\n')}
              </pre>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
