// Per-user column visibility prefs, persisted in localStorage so they survive
// reloads without a migration. Key includes the auth user id when available.
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useColumnPrefs(prefKey: string, defaults: string[]) {
  const [uid, setUid] = useState<string | null>(null);
  const [visible, setVisible] = useState<string[]>(defaults);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? 'anon'));
  }, []);

  useEffect(() => {
    if (!uid) return;
    const key = `crm-cols:${prefKey}:${uid}`;
    try {
      const raw = localStorage.getItem(key);
      if (raw) setVisible(JSON.parse(raw));
      else setVisible(defaults);
    } catch { setVisible(defaults); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, prefKey]);

  const update = (next: string[]) => {
    setVisible(next);
    if (uid) {
      try { localStorage.setItem(`crm-cols:${prefKey}:${uid}`, JSON.stringify(next)); } catch {}
    }
  };

  return [visible, update] as const;
}
