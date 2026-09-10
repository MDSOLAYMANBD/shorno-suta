// Persistent live call status banner — globally mounted in AdminDashboard.
// Shows ringing / waiting / accepted / ended states for chat_calls so admin
// always knows what's happening regardless of which admin page they're on.
// Clicking the banner opens the matching live-chat thread.
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, PhoneIncoming, PhoneOff, PhoneMissed, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface CallRow {
  id: string;
  session_id: string;
  caller_name: string;
  caller_phone: string;
  status: string;
  accepted_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
}

function fmtDuration(sec: number) {
  const m = Math.floor(sec / 60);
  return `${m}:${String(sec % 60).padStart(2, '0')}`;
}

export default function CallStatusBanner() {
  const [call, setCall] = useState<CallRow | null>(null);
  const [tick, setTick] = useState(0);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigate = useNavigate();

  // Live timer for in-call state
  useEffect(() => {
    if (call?.status === 'accepted' && call.accepted_at) {
      tickIntervalRef.current = setInterval(() => setTick((t) => t + 1), 1000);
      return () => {
        if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
      };
    }
  }, [call?.status, call?.accepted_at]);

  // Auto-dismiss ended/missed/rejected calls after 5s
  useEffect(() => {
    if (!call) return;
    if (['ended', 'missed', 'rejected'].includes(call.status)) {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = setTimeout(() => setCall(null), 5000);
      return () => {
        if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      };
    }
  }, [call?.status, call?.id]);

  // Realtime subscription
  useEffect(() => {
    const ch = supabase
      .channel('admin-call-status-banner')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_calls' }, (payload) => {
        const row = payload.new as CallRow;
        if (row.status === 'ringing' || row.status === 'waiting') {
          setCall(row);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_calls' }, (payload) => {
        const row = payload.new as CallRow;
        setCall((prev) => {
          if (!prev && (row.status === 'accepted' || row.status === 'waiting')) return row;
          if (prev && prev.id === row.id) return row;
          return prev;
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  if (!call) return null;

  let Icon = Phone;
  let label = '';
  let detail = '';
  let bg = '';
  let pulse = false;

  if (call.status === 'ringing') {
    Icon = PhoneIncoming;
    label = '📞 ইনকামিং কল';
    detail = `${call.caller_name || 'ভিজিটর'}${call.caller_phone ? ` · ${call.caller_phone}` : ''}`;
    bg = 'bg-amber-500 text-white';
    pulse = true;
  } else if (call.status === 'waiting') {
    Icon = Clock;
    label = '⏳ অপেক্ষায় কল';
    detail = `${call.caller_name || 'ভিজিটর'}${call.caller_phone ? ` · ${call.caller_phone}` : ''}`;
    bg = 'bg-blue-600 text-white';
    pulse = true;
  } else if (call.status === 'accepted') {
    Icon = Phone;
    const elapsed = call.accepted_at
      ? Math.max(0, Math.floor((Date.now() - new Date(call.accepted_at).getTime()) / 1000))
      : 0;
    label = '🟢 কল চলছে';
    detail = `${call.caller_name || 'ভিজিটর'} · ${fmtDuration(elapsed)}`;
    bg = 'bg-emerald-600 text-white';
    void tick;
  } else if (call.status === 'ended') {
    Icon = PhoneOff;
    label = 'কল শেষ হয়েছে';
    detail = `${call.caller_name || 'ভিজিটর'}${call.duration_seconds ? ` · ${fmtDuration(call.duration_seconds)}` : ''}`;
    bg = 'bg-slate-600 text-white';
  } else if (call.status === 'missed') {
    Icon = PhoneMissed;
    label = '⚠️ মিসড কল';
    detail = `${call.caller_name || 'ভিজিটর'}${call.caller_phone ? ` · ${call.caller_phone}` : ''}`;
    bg = 'bg-destructive text-destructive-foreground';
  } else if (call.status === 'rejected') {
    Icon = PhoneOff;
    label = 'কল reject করা হয়েছে';
    detail = call.caller_name || 'ভিজিটর';
    bg = 'bg-slate-500 text-white';
  } else {
    return null;
  }

  const handleClick = () => {
    if (call.session_id) navigate(`/admin/live-chat?session=${call.session_id}`);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'sticky top-0 z-[55] w-full px-3 py-2 flex items-center gap-3 shadow-md animate-in slide-in-from-top-2 text-left hover:brightness-95 transition-all',
        bg
      )}
      title="চ্যাট খুলুন"
    >
      <div className={cn(
        'h-8 w-8 rounded-full bg-white/20 flex items-center justify-center shrink-0',
        pulse && 'animate-pulse'
      )}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0 flex flex-wrap items-baseline gap-x-2">
        <span className="text-sm font-semibold truncate">{label}</span>
        <span className="text-xs opacity-90 truncate">{detail}</span>
      </div>
      <span className="text-[10px] uppercase tracking-wide opacity-80 hidden sm:inline">
        চ্যাট খুলুন →
      </span>
    </button>
  );
}
