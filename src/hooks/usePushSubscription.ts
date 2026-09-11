import { useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = "https://xxucasikopqtcztbgfbw.supabase.co";
const REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function syncSubscriptionToDB(userId: string, subJson: any) {
  const endpoint = subJson.endpoint;
  const { data: existing } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint')
    .eq('user_id', userId)
    .eq('endpoint', endpoint)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('push_subscriptions')
      .update({ keys: subJson.keys })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('push_subscriptions')
      .insert({ user_id: userId, endpoint, keys: subJson.keys });
  }
  // Cleanup stale subscriptions
  await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', userId)
    .neq('endpoint', endpoint);
}

export function usePushSubscription(userId: string) {
  const vapidKeyRef = useRef<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch per-user DB preference
  const { data: pushEnabled } = useQuery({
    queryKey: ['push-pref', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('staff_notification_preferences' as any)
        .select('push_enabled')
        .eq('user_id', userId)
        .maybeSingle();
      return (data as any)?.push_enabled ?? true;
    },
    enabled: !!userId,
  });

  const manageSubscription = useCallback(async () => {
    if (!userId) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    try {
      await navigator.serviceWorker.register('/custom-sw.js', {
        scope: '/',
        updateViaCache: 'none',
      });
      const registration = await navigator.serviceWorker.ready;
      try { await registration.update(); } catch (_) { /* ignore */ }

      const existingSub = await (registration as any).pushManager.getSubscription();

      // If push disabled or permission not granted → unsubscribe
      if (!pushEnabled || (typeof Notification !== 'undefined' && Notification.permission !== 'granted')) {
        if (existingSub) {
          await existingSub.unsubscribe();
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('user_id', userId)
            .eq('endpoint', existingSub.endpoint);
          console.log('[Push] Unsubscribed');
        }
        return;
      }

      // Get VAPID key (cache it)
      if (!vapidKeyRef.current) {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/get-vapid-key`);
        const { key } = await res.json();
        if (!key) {
          console.log('[Push] VAPID key not configured');
          return;
        }
        vapidKeyRef.current = key;
      }

      let subscription = existingSub;
      if (!subscription) {
        console.log('[Push] Subscribing fresh');
        subscription = await (registration as any).pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKeyRef.current),
        });
      }

      await syncSubscriptionToDB(userId, subscription.toJSON());
      console.log('[Push] Subscription synced');
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        console.log('[Push] Permission denied');
      } else {
        console.error('[Push] Subscription failed:', err);
      }
    }
  }, [userId, pushEnabled]);

  // Initial subscription + periodic refresh
  useEffect(() => {
    if (!userId || pushEnabled === undefined) return;

    const timer = setTimeout(manageSubscription, 2000);
    
    // Refresh subscription every 30 minutes to keep it alive on mobile
    intervalRef.current = setInterval(manageSubscription, REFRESH_INTERVAL);

    return () => {
      clearTimeout(timer);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [userId, pushEnabled, manageSubscription]);

  // Listen for SW pushsubscriptionchange messages
  useEffect(() => {
    if (!userId) return;

    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'PUSH_SUBSCRIPTION_CHANGED' && event.data.subscription) {
        console.log('[Push] Received subscription change from SW');
        syncSubscriptionToDB(userId, event.data.subscription);
      }
    };

    navigator.serviceWorker?.addEventListener('message', handler);
    return () => navigator.serviceWorker?.removeEventListener('message', handler);
  }, [userId]);
}
