import { useSyncExternalStore } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

// Singleton auth state shared across all hook instances
let _user: User | null = null;
let _session: Session | null = null;
let _loading = true;
let _listeners = new Set<() => void>();
let _initialized = false;

function notifyListeners() {
  _listeners.forEach(l => l());
}

function initAuthListener() {
  if (_initialized) return;
  _initialized = true;

  // Step 1: Restore session from storage (resolves before listener fires)
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) {
      _session = session;
      _user = session.user;
    }
    _loading = false;
    notifyListeners();
  });

  // Step 2: Listen for subsequent changes — do NOT await anything inside
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      _session = null;
      _user = null;
      _loading = false;
      notifyListeners();
    } else if (session) {
      _session = session;
      _user = session.user;
      _loading = false;
      notifyListeners();
    } else if (event === 'INITIAL_SESSION' && !session) {
      // PWA cold start with expired/missing token
      _loading = false;
      notifyListeners();
    }
    // TOKEN_REFRESHED with null session = mid-refresh, don't clear state
  });
}

function subscribe(callback: () => void) {
  _listeners.add(callback);
  initAuthListener();
  return () => { _listeners.delete(callback); };
}

let _snapshot = { user: _user, session: _session, loading: _loading };

function getSnapshot() {
  if (_snapshot.user !== _user || _snapshot.session !== _session || _snapshot.loading !== _loading) {
    _snapshot = { user: _user, session: _session, loading: _loading };
  }
  return _snapshot;
}

export function useCustomerAuth() {
  const state = useSyncExternalStore(subscribe, getSnapshot);

  const phoneToEmail = (phone: string) => {
    const clean = phone.replace(/[\s-]/g, '').replace(/^\+?88/, '');
    return `${clean}@phone.shorno-suta.app`;
  };

  const signUp = async (phone: string, password: string, fullName: string) => {
    const cleanPhone = phone.replace(/[\s-]/g, '').replace(/^\+?88/, '');
    
    const { data: fnData, error: fnError } = await supabase.functions.invoke('customer-signup', {
      body: { phone: cleanPhone, password, fullName },
    });
    if (fnError) throw new Error(fnError.message || 'Signup failed');
    if (fnData?.error) throw new Error(fnData.error);

    const email = phoneToEmail(cleanPhone);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signIn = async (phone: string, password: string) => {
    const email = phoneToEmail(phone);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signInWithProvider = async (provider: 'google' | 'facebook') => {
    const redirectTo = `${window.location.origin}/auth/callback`;

    // Google: untouched — defer fully to Supabase defaults.
    if (provider === 'google') {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });
      if (error) throw error;
      return;
    }

    // Facebook (customer): pure Supabase OAuth flow — no Facebook JS SDK,
    // no custom scopes, no business OAuth params, no manual 302 resolution.
    // We use skipBrowserRedirect only to log the Supabase-generated authorize
    // URL before navigating to it; we DO NOT modify or augment that URL.
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) throw error;

    const url = data?.url || '';
    try {
      const u = new URL(url);
      const sp = u.searchParams;
      // eslint-disable-next-line no-console
      console.log('[customer-fb-oauth] supabase authorize URL:', url);
      // eslint-disable-next-line no-console
      console.log('[customer-fb-oauth] provider:', sp.get('provider'));
      // eslint-disable-next-line no-console
      console.log('[customer-fb-oauth] redirect_to:', sp.get('redirect_to'));
      const forbidden = ['config_id', 'business_config_id', 'pages_', 'whatsapp_', 'business_management'];
      const hits = forbidden.filter((k) => url.includes(k));
      if (hits.length) {
        // eslint-disable-next-line no-console
        console.warn('[customer-fb-oauth] forbidden params detected:', hits);
      }
    } catch {}

    if (url) window.location.assign(url);
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const isStaff = async (): Promise<boolean> => {
    if (!state.user) return false;
    const { data } = await supabase.rpc('has_any_role', { _user_id: state.user.id });
    return !!data;
  };

  return { user: state.user, session: state.session, loading: state.loading, signUp, signIn, signInWithProvider, signOut, isStaff, phoneToEmail };
}
