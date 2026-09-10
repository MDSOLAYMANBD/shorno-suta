import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getSessionId } from './useVisitorTracking';

// Logs every storefront navigation to page_views (one row per pathname
// change) so admin can reconstruct the full multi-page visitor journey.
// Distinct from useVisitorTracking's one-time site_visits insert (landing
// page only) — this fires on every pathname change, keyed off the same
// shared session id.
export function usePageViewTracking() {
  const location = useLocation();
  useEffect(() => {
    const sid = getSessionId();
    supabase
      .from('page_views' as any)
      .insert({ session_id: sid, page_path: location.pathname } as any)
      .then(() => {});
  }, [location.pathname]);
}
