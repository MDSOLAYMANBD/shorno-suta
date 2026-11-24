import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSiteConfig, DEFAULT_WELCOME_ISLAND_CONFIG } from '@/hooks/useSiteConfig';
import { knownNow, trNow } from '@/lib/i18n';

const STORAGE_KEY = 'customer_welcome_shown';
const FINAL_HOLD = 3000;
const TRANSITION_MS = 350;
const TOAST_APPEAR_DELAY = 2000;
const PERSISTENT_APPEAR_DELAY = 150;

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return trNow('🌞 শুভ সকাল!', '🌞 Good morning!');
  if (h >= 12 && h < 16) return trNow('☀️ শুভ দুপুর!', '☀️ Good afternoon!');
  if (h >= 16 && h < 19) return trNow('🌇 শুভ বিকাল!', '🌇 Good afternoon!');
  if (h >= 19 && h < 23) return trNow('🌙 শুভ সন্ধ্যা!', '🌙 Good evening!');
  return trNow('🌃 শুভ রাত্রি!', '🌃 Good night!');
}

// Shared message-cycling logic for the welcome island — used by both the
// desktop floating pill (a one-time toast) and the mobile inline version that
// sits in the navbar's logo/search gap (a permanent fixture of that space).
//
// Pass `persistent: true` for the inline version: it ignores the
// once-per-session flag (so it doesn't vanish after a refresh), appears
// almost instantly instead of after a 2s toast-style delay, and loops back
// to the first message instead of hiding once it reaches the last one.
export function useWelcomeIslandMessages(opts?: { persistent?: boolean }) {
  const persistent = opts?.persistent ?? false;
  const { data: saved } = useSiteConfig('welcome_island_config');
  const cfg = { ...DEFAULT_WELCOME_ISLAND_CONFIG, ...(saved || {}) };

  const [visible, setVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);

  const messages = useMemo(() => {
    // the shop's own messages in English where we know them (lib/i18nKnown.ts)
    const list = (cfg.messages || []).map((m: string) => knownNow((m || '').trim())).filter(Boolean);
    if (cfg.use_time_based_greeting) {
      return [getGreeting(), trNow('🤲 আসসালামু আলাইকুম', '🤲 Assalamu alaikum'), trNow('😊 কেমন আছেন?', '😊 How are you?'), ...list].filter(Boolean);
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(cfg.messages), cfg.use_time_based_greeting]);

  const hide = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => setVisible(false), 400);
  }, []);

  const advanceOrLoop = useCallback(() => {
    setFading(true);
    setTimeout(() => {
      setIndex(i => (i >= messages.length - 1 ? 0 : i + 1));
      setFading(false);
    }, TRANSITION_MS);
  }, [messages.length]);

  useEffect(() => {
    if (!cfg.enabled || messages.length === 0) return;
    if (!persistent) {
      try {
        if (cfg.show_once_per_session && sessionStorage.getItem(STORAGE_KEY)) return;
      } catch {}
    }
    const t = setTimeout(() => {
      setVisible(true);
      if (!persistent) {
        try { if (cfg.show_once_per_session) sessionStorage.setItem(STORAGE_KEY, '1'); } catch {}
      }
    }, persistent ? PERSISTENT_APPEAR_DELAY : TOAST_APPEAR_DELAY);
    return () => clearTimeout(t);
  }, [cfg.enabled, cfg.show_once_per_session, messages.length, persistent]);

  useEffect(() => {
    if (!visible || isExiting) return;
    const isLast = index >= messages.length - 1;
    const delay = (!persistent && isLast) ? FINAL_HOLD : (cfg.message_duration_ms || 4500);
    const t = setTimeout(() => {
      if (isLast && !persistent) {
        hide();
      } else {
        advanceOrLoop();
      }
    }, delay);
    return () => clearTimeout(t);
  }, [visible, isExiting, index, messages.length, cfg.message_duration_ms, hide, persistent, advanceOrLoop]);

  const handleClick = useCallback(() => {
    if (index >= messages.length - 1 && !persistent) { hide(); return; }
    advanceOrLoop();
  }, [index, messages.length, hide, persistent, advanceOrLoop]);

  return { cfg, messages, visible, isExiting, index, fading, hide, handleClick };
}
