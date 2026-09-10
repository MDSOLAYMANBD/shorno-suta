import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type PermissionLevel = 'full' | 'edit' | 'view' | 'none';

export interface Permissions {
  role: string;
  permissions: Record<string, PermissionLevel>;
}

/**
 * Loads role-based permissions for a given user id.
 *
 * IMPORTANT: When called from a context that already manages auth (e.g.
 * AdminDashboard via useAdminAuth), pass the verified `userId` explicitly
 * and do NOT trigger an extra getSession() here. That avoids a second
 * auth race during initial dashboard mount on mobile.
 */
export function usePermissions(externalUserId?: string) {
  const [permissions, setPermissions] = useState<Permissions | null>(null);
  // If a parent passes externalUserId === undefined, we'll fall back to
  // getSession(). If the parent passes an empty string (auth not ready yet),
  // we wait — don't show "loading forever" but also don't query with empty id.
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      let uid = externalUserId;

      // Parent passed an empty string => auth not ready. Don't fetch yet.
      if (uid === '') {
        setLoading(false);
        return;
      }

      // No userId hint at all — fall back to session lookup (legacy callers).
      if (!uid) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (cancelled) return;
          if (!session) {
            setLoading(false);
            return;
          }
          uid = session.user.id;
        } catch {
          if (!cancelled) setLoading(false);
          return;
        }
      }

      try {
        const { data } = await supabase.rpc('get_user_permissions', { _user_id: uid } as any);
        if (cancelled) return;
        if (data) setPermissions(data as any);
      } catch {
        // Transient failure — leave permissions null, caller can retry.
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    setLoading(true);
    load();

    return () => { cancelled = true; };
  }, [externalUserId]);

  const can = (section: string, minLevel: PermissionLevel = 'view'): boolean => {
    if (!permissions) return false;
    const level = permissions.permissions[section];
    if (!level || level === 'none') return false;
    if (minLevel === 'view') return true;
    if (minLevel === 'edit') return level === 'edit' || level === 'full';
    if (minLevel === 'full') return level === 'full';
    return false;
  };

  const isAdmin = permissions?.role === 'admin';

  return { permissions, loading, can, isAdmin };
}
