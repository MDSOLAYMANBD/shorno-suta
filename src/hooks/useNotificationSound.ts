import { useCallback, useRef } from 'react';

type NotifType = 'order' | 'message' | 'chat';

const SOUND_CONFIG: Record<NotifType, { freqs: { freq: number; delay: number }[]; duration: number }> = {
  order: { freqs: [{ freq: 830, delay: 0 }, { freq: 1050, delay: 180 }, { freq: 1250, delay: 360 }], duration: 0.45 },
  message: { freqs: [{ freq: 600, delay: 0 }, { freq: 750, delay: 150 }], duration: 0.4 },
  chat: { freqs: [{ freq: 500, delay: 0 }], duration: 0.3 },
};

function playTone(freq: number, duration: number, volume = 0.3) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.type = 'sine';
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch {}
}

export async function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

function sendBrowserNotification(title: string, body: string, onClick?: () => void, tag?: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const notif = new Notification(title, {
      body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: tag || undefined,
      renotify: !!tag,
      requireInteraction: true,
      vibrate: [200, 100, 200],
    } as NotificationOptions);
    if (onClick) {
      notif.onclick = () => {
        window.focus();
        onClick();
        notif.close();
      };
    }
  } catch {}
}

export function useNotificationSound() {
  const lastPlayed = useRef<number>(0);

  const playSound = useCallback((type: NotifType) => {
    const now = Date.now();
    if (now - lastPlayed.current < 800) return;
    lastPlayed.current = now;

    const config = SOUND_CONFIG[type];
    config.freqs.forEach(({ freq, delay }) => {
      if (delay === 0) playTone(freq, config.duration);
      else setTimeout(() => playTone(freq, config.duration), delay);
    });
  }, []);

  const notify = useCallback((type: NotifType, title: string, body: string, onClick?: () => void, tag?: string) => {
    playSound(type);
    sendBrowserNotification(title, body, onClick, tag);
  }, [playSound]);

  return { playSound, notify, requestPermission: requestNotificationPermission };
}
