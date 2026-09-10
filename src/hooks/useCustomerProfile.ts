import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCustomerAuth } from './useCustomerAuth';

let _cachedProfile: any = null;
let _cachedUserId: string | null = null;
let _fetchedAt = 0;
const STALE_MS = 5 * 60 * 1000; // 5 minutes

export function useCustomerProfile() {
  const { user } = useCustomerAuth();
  const [profile, setProfile] = useState<any>(_cachedUserId === user?.id ? _cachedProfile : null);
  const [loading, setLoading] = useState(!_cachedProfile || _cachedUserId !== user?.id);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      _cachedProfile = null;
      _cachedUserId = null;
      return;
    }

    // Use cache if fresh
    if (_cachedUserId === user.id && _cachedProfile && Date.now() - _fetchedAt < STALE_MS) {
      setProfile(_cachedProfile);
      setLoading(false);
      return;
    }

    supabase
      .from('customer_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        _cachedProfile = data;
        _cachedUserId = user.id;
        _fetchedAt = Date.now();
        setProfile(data);
        setLoading(false);
      });
  }, [user]);

  const updateProfile = useCallback((newProfile: any) => {
    setProfile(newProfile);
    _cachedProfile = newProfile;
    _fetchedAt = Date.now();
  }, []);

  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || (profile as any)?.avatar_url || null;
  const displayName = profile?.full_name || user?.user_metadata?.full_name || '';

  return { profile, setProfile: updateProfile, loading, avatarUrl, displayName };
}
