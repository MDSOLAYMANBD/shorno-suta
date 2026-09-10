import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Sparkles, X } from 'lucide-react';

const INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const DISPLAY_DURATION = 30_000; // 30 seconds

const HOBBY_OPTIONS: Record<string, string> = {
  movies: '🎬', music: '🎵', gaming: '🎮', reading: '📚',
  cooking: '🍳', travel: '✈️', learning: '📖', exercise: '💪',
  cricket: '🏏', football: '⚽',
};

function getTimeMessages(fullName: string, salutation: string, dob?: string): string[] {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const msgs: string[] = [];

  // Birthday — top priority
  if (dob) {
    const birth = new Date(dob);
    if (now.getMonth() === birth.getMonth() && now.getDate() === birth.getDate()) {
      msgs.push(`🎂 শুভ জন্মদিন ${fullName} ${salutation}! 🎉🥳`);
      msgs.push(`🎈 Happy Birthday ${fullName}! আজ আপনার দিন! 🎁`);
      return msgs; // Birthday messages are enough
    }
  }

  // Morning arrival (9-10)
  if (h >= 9 && h < 10) {
    msgs.push(`☀️ সুপ্রভাত ${fullName} ${salutation}! চলো আজকের দিন শুরু করি!`);
    msgs.push(`🌅 গুড মর্নিং! আজও দারুণ একটা দিন হবে ইনশাআল্লাহ 💫`);
    msgs.push(`😊 হেই ${fullName}, কেমন আছো? চলো কাজ শুরু করি!`);
  }

  // Mid-morning tea (10-11)
  if (h >= 10 && h < 11) {
    msgs.push(`☕ চা খেয়ে নিলেন ${fullName} ${salutation}? এনার্জি দরকার!`);
    msgs.push(`🎯 ফোকাস ধরে রাখুন — দারুণ করছেন!`);
  }

  // Late morning (11-12)
  if (h >= 11 && h < 12) {
    msgs.push(`💪 সকালের কাজ ভালোই হচ্ছে ${fullName} ${salutation}!`);
    msgs.push(`🚀 আপনার পরিশ্রম কখনো বৃথা যায় না!`);
  }

  // Dhuhr prayer (12:15-12:45)
  if (h === 12 && m >= 15) {
    msgs.push(`🕌 যোহরের নামাজের সময় হয়ে গেছে — নামাজ পড়ে আসুন`);
    msgs.push(`🤲 নামাজ পড়লে মন শান্ত থাকে, কাজেও বরকত আসে 🕌`);
  }
  if (h === 13 && m < 15) {
    msgs.push(`🕌 যোহরের নামাজ পড়ে নিন ${fullName} ${salutation}`);
  }

  // Lunch (1:00-1:30)
  if (h === 13) {
    msgs.push(`🍽️ খাবার খেয়ে নিন, শরীর ঠিক থাকলে কাজও ভালো হবে!`);
    msgs.push(`💧 পানি খেতে ভুলবেন না ${fullName} ${salutation}!`);
  }

  // Afternoon (2-3)
  if (h >= 14 && h < 15) {
    msgs.push(`😎 দুপুরের ঘুম পাচ্ছে? একটু হেঁটে আসুন ফ্রেশ হবেন!`);
    msgs.push(`💡 ছোট ছোট পদক্ষেপে বড় সাফল্য আসে!`);
  }

  // Asr prayer (3:15-3:45)
  if (h === 15 && m >= 15) {
    msgs.push(`🕌 আসরের নামাজ পড়ে এসে ফ্রেশ হয়ে কাজ করুন`);
    msgs.push(`🤲 চলো নামাজ পড়ে একটু বিশ্রাম নিয়ে আসি 🕌`);
  }
  if (h === 16 && m < 15) {
    msgs.push(`🕌 আসরের নামাজ পড়ে নিন — মন শান্ত থাকবে`);
  }

  // Afternoon (4-5)
  if (h >= 16 && h < 17) {
    msgs.push(`☕ বিকালের চা খেয়ে নিন ${fullName} ${salutation}!`);
    msgs.push(`🎯 দিনের বেশিরভাগ কাজ শেষ — দারুণ করেছেন!`);
    msgs.push(`💪 আর একটু, দিন প্রায় শেষ ${fullName} ${salutation}!`);
  }

  // Evening (5-6)
  if (h >= 17 && h < 18) {
    msgs.push(`🌤️ দিন প্রায় শেষ — দারুণ কাজ হয়েছে আজ!`);
    msgs.push(`🌟 আপনি দারুণ কাজ করছেন — এভাবেই চালিয়ে যান!`);
  }

  // Maghrib prayer (6:00-6:30)
  if (h === 18 && m < 30) {
    msgs.push(`🌅 মাগরিবের নামাজের সময়, চলো নামাজ পড়ে আসি`);
    msgs.push(`🕌 সূর্য ডুবেছে — মাগরিবের নামাজ পড়ে নিন ${fullName} ${salutation}`);
  }

  // Evening (7-8)
  if (h >= 19 && h < 20) {
    msgs.push(`🌙 সন্ধ্যা হয়ে গেছে ${fullName} ${salutation}, অনেক পরিশ্রম হয়েছে আজ!`);
    msgs.push(`🏠 পরিবারের সাথে সময় কাটান — আপনি এটা ডিজার্ভ করেন!`);
  }

  // Isha prayer (8:00-8:30)
  if (h === 20 && m < 30) {
    msgs.push(`🕌 এশার নামাজ পড়ে নিন — মন শান্ত থাকবে`);
    msgs.push(`🤲 দিনের শেষ নামাজ — এশা পড়ে ফেলুন ${fullName} ${salutation} 🕌`);
  }

  // Late night / overtime (9+)
  if (h >= 21) {
    msgs.push(`🦸 ওভারটাইম হিরো! বোনাসের জন্য যোগ্য হতে পারেন!`);
    msgs.push(`✨ রাত ${h > 21 ? (h - 12) : '৯'}টার পরেও কাজ? আপনি সত্যিকারের যোদ্ধা! 💪`);
    msgs.push(`🌙 অনেক রাত হয়ে গেছে — শরীরের যত্ন নিন ${fullName} ${salutation}`);
  }

  // General fallbacks (always available)
  if (msgs.length === 0) {
    msgs.push(`😊 হেই ${fullName}, কেমন আছো?`);
    msgs.push(`🎯 ফোকাস ধরে রাখুন — সাফল্য কাছেই!`);
    msgs.push(`💧 পানি খেয়েছেন? চলো এক গ্লাস পানি খাই!`);
  }

  return msgs;
}

interface DynamicIslandProps {
  userId: string;
}

export default function DynamicIsland({ userId }: DynamicIslandProps) {
  const [visible, setVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [msgIndex, setMsgIndex] = useState(0);
  const [messageQueue, setMessageQueue] = useState<string[]>([]);

  // Fetch employee profile data
  const { data: profile } = useQuery({
    queryKey: ['dynamic-island-profile', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('employee_profiles' as any)
        .select('full_name, gender, date_of_birth, hobbies')
        .eq('user_id', userId)
        .maybeSingle();
      return data as any;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  const fullName = useMemo(() => (profile?.full_name || '').trim() || 'বন্ধু', [profile?.full_name]);
  const salutation = useMemo(() => profile?.gender === 'female' ? 'আপু' : 'ভাই', [profile?.gender]);
  const dob = profile?.date_of_birth;

  const generateMessages = useCallback(() => {
    return getTimeMessages(fullName, salutation, dob);
  }, [fullName, salutation, dob]);

  // Show island
  const showIsland = useCallback(() => {
    const msgs = generateMessages();
    setMessageQueue(msgs);
    setMsgIndex(0);
    setIsExiting(false);
    setVisible(true);
    localStorage.setItem('dynamic_island_last_shown', Date.now().toString());
  }, [generateMessages]);

  // Hide island with animation
  const hideIsland = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      setVisible(false);
      setIsExiting(false);
    }, 400);
  }, []);

  // Show next message on tap (only when not swiping)
  const advanceMessage = useCallback(() => {
    const msgs = generateMessages();
    setMessageQueue(msgs);
    setMsgIndex(prev => (prev + 1) % msgs.length);
    setIsExiting(false);
    localStorage.setItem('dynamic_island_last_shown', Date.now().toString());
  }, [generateMessages]);

  // Swipe / drag to dismiss
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number; t: number } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragStart.current = { x: e.clientX, y: e.clientY, t: Date.now() };
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = Math.min(0, e.clientY - dragStart.current.y); // only up
    setDrag({ x: dx, y: dy });
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    const dt = Date.now() - dragStart.current.t;
    const dist = Math.hypot(dx, dy);
    const velocity = dist / Math.max(dt, 1);
    dragStart.current = null;
    setDragging(false);

    if (Math.abs(dx) > 80 || dy < -50 || velocity > 0.6) {
      hideIsland();
    } else if (dist < 8) {
      setDrag({ x: 0, y: 0 });
      advanceMessage();
    } else {
      setDrag({ x: 0, y: 0 });
    }
  }, [hideIsland, advanceMessage]);

  // Interval check: show every 30 minutes
  useEffect(() => {
    if (!profile) return;

    const checkAndShow = () => {
      const lastShown = parseInt(localStorage.getItem('dynamic_island_last_shown') || '0');
      const elapsed = Date.now() - lastShown;
      if (elapsed >= INTERVAL_MS) {
        showIsland();
      }
    };

    // Initial check after 3 second delay
    const initTimeout = setTimeout(checkAndShow, 3000);

    // Check every minute
    const interval = setInterval(checkAndShow, 60_000);

    return () => {
      clearTimeout(initTimeout);
      clearInterval(interval);
    };
  }, [profile, showIsland]);

  // Auto-hide after 30 seconds
  useEffect(() => {
    if (!visible || isExiting) return;
    const timer = setTimeout(hideIsland, DISPLAY_DURATION);
    return () => clearTimeout(timer);
  }, [visible, isExiting, msgIndex, hideIsland]);

  if (!visible || messageQueue.length === 0) return null;

  const currentMsg = messageQueue[msgIndex % messageQueue.length];

  return (
    <div
      className={cn(
        "fixed top-2 left-1/2 -translate-x-1/2 z-[9999] select-none",
        "md:top-3",
        isExiting ? 'animate-island-collapse' : 'animate-island-expand'
      )}
      style={{
        transform: `translate(calc(-50% + ${drag.x}px), ${drag.y}px)`,
        opacity: Math.max(0.2, 1 - Math.hypot(drag.x, drag.y) / 200),
        transition: dragging ? 'none' : 'transform 250ms ease, opacity 250ms ease',
        touchAction: 'none',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      role="status"
      aria-live="polite"
    >
      <div className="dynamic-island-pill flex items-center gap-2.5 pl-5 pr-2 py-2.5 rounded-[28px] bg-[#1a1a1a] text-white shadow-2xl border border-white/10 max-w-[90vw] md:max-w-[500px] cursor-grab active:cursor-grabbing">
        <Sparkles className="h-4 w-4 text-amber-400 shrink-0 animate-pulse" />
        <span className="text-[13px] font-medium leading-snug truncate">
          {currentMsg}
        </span>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); hideIsland(); }}
          aria-label="Close"
          className="ml-1 shrink-0 h-6 w-6 inline-flex items-center justify-center rounded-full hover:bg-white/15 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
