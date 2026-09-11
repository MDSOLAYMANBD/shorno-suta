import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { checkStaffRoleWithRetry } from '@/lib/authHelpers';

interface AdminAuthState {
  ready: boolean;
  user: User | null;
  session: Session | null;
  isStaff: boolean;
  roleChecked: boolean;
  roleCheckFailed: boolean;
  signingOut: boolean;
}

// Storage key the supabase client uses for the persisted session.
// (Default = `sb-<project-ref>-auth-token`.) We only use this to detect
// "session is stored but the SDK is mid-restore" so we don't bounce a
// real admin to the login page during a transient null session.
const SESSION_STORAGE_KEY = 'sb-xxucasikopqtcztbgfbw-auth-token';

const SESSION_RESTORE_GRACE_MS = 3500;

function hasStoredSession(): boolean {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    // Supabase stores `{ access_token, refresh_token, expires_at, ... }`.
    // We treat the presence of a refresh_token as "logged in" — even if the
    // access token has expired the SDK will rotate it.
    return !!(parsed?.refresh_token);
  } catch {
    return false;
  }
}

export function useAdminAuth() {
  const [state, setState] = useState<AdminAuthState>({
    ready: false,
    user: null,
    session: null,
    isStaff: false,
    roleChecked: false,
    roleCheckFailed: false,
    signingOut: false,
  });

  const verifiedUserIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);
  const graceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sawDefinitiveSignalRef = useRef(false);

  const clearGraceTimer = () => {
    if (graceTimerRef.current) {
      clearTimeout(graceTimerRef.current);
      graceTimerRef.current = null;
    }
  };

  const verifyRole = useCallback(async (session: Session) => {
    if (verifiedUserIdRef.current === session.user.id) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    try {
      const result = await checkStaffRoleWithRetry(session.user.id);

      if (!mountedRef.current) return;

      if (!result.ok) {
        setState((prev) => ({
          ...prev,
          ready: true,
          user: session.user,
          session,
          roleChecked: false,
          roleCheckFailed: true,
        }));
        return;
      }

      verifiedUserIdRef.current = session.user.id;
      setState({
        ready: true,
        user: session.user,
        session,
        isStaff: result.hasRole,
        roleChecked: true,
        roleCheckFailed: false,
        signingOut: false,
      });
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  const retryRoleCheck = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      verifiedUserIdRef.current = null;
      setState((prev) => ({ ...prev, roleCheckFailed: false }));
      await verifyRole(session);
    } catch {
      // transient — leave state alone, user can retry again
    }
  }, [verifyRole]);

  useEffect(() => {
    mountedRef.current = true;

    const handleSession = (session: Session) => {
      sawDefinitiveSignalRef.current = true;
      clearGraceTimer();
      setState((prev) => ({
        ...prev,
        user: session.user,
        session,
        ready: prev.ready,
      }));
      setTimeout(() => {
        if (mountedRef.current) verifyRole(session);
      }, 0);
    };

    const declareLoggedOut = () => {
      sawDefinitiveSignalRef.current = true;
      clearGraceTimer();
      verifiedUserIdRef.current = null;
      setState({
        ready: true,
        user: null,
        session: null,
        isStaff: false,
        roleChecked: true,
        roleCheckFailed: false,
        signingOut: false,
      });
    };

    const handleNoSession = (definitive: boolean) => {
      // If localStorage still has a session blob, the SDK is most likely
      // mid-restore (mobile cold-resume, refresh-token rotation in flight,
      // or auth-lock waiting). NEVER auto-logout in that case — keep
      // showing the spinner and wait for a SIGNED_IN/TOKEN_REFRESHED event.
      if (!definitive || hasStoredSession()) {
        if (graceTimerRef.current) return;
        graceTimerRef.current = setTimeout(async () => {
          graceTimerRef.current = null;
          if (!mountedRef.current) return;
          if (sawDefinitiveSignalRef.current && state.user) return;

          // One last poll — maybe the SDK finished restoring during the wait.
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!mountedRef.current) return;
            if (session) {
              handleSession(session);
              return;
            }
          } catch {
            // ignore — fall through to final decision
          }

          // Even after grace window, if storage STILL has a token, do not
          // logout. Mark ready with no user so the redirect effect can decide,
          // but we'll re-check on visibility/online events too.
          declareLoggedOut();
        }, SESSION_RESTORE_GRACE_MS);
        return;
      }

      declareLoggedOut();
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mountedRef.current) return;

      if (event === 'SIGNED_OUT') {
        declareLoggedOut();
        return;
      }

      if (session) {
        handleSession(session);
        return;
      }

      // Null session events. INITIAL_SESSION + null is "definitive only if
      // there's no token in storage" — handled inside handleNoSession.
      if (event === 'INITIAL_SESSION') {
        handleNoSession(true);
      }
      // Other null-session events: ignore (mid-refresh).
    });

    // Bootstrap restored session.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mountedRef.current) return;
      if (session) {
        handleSession(session);
      } else {
        handleNoSession(false);
      }
    }).catch(() => {
      if (!mountedRef.current) return;
      handleNoSession(false);
    });

    // Mobile PWA: re-check on visibility & online events. If storage has a
    // session, re-attempt restoration instead of staying logged-out.
    const recover = () => {
      if (!mountedRef.current) return;
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!mountedRef.current) return;
        if (session) {
          if (verifiedUserIdRef.current !== session.user.id) {
            handleSession(session);
          }
        } else if (hasStoredSession()) {
          // Token in storage but SDK didn't return it — try again shortly.
          setTimeout(() => {
            if (!mountedRef.current) return;
            supabase.auth.getSession().then(({ data: { session: s2 } }) => {
              if (s2 && mountedRef.current) handleSession(s2);
            }).catch(() => {});
          }, 600);
        }
      }).catch(() => {});
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') recover();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', recover);
    window.addEventListener('focus', recover);

    return () => {
      mountedRef.current = false;
      clearGraceTimer();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', recover);
      window.removeEventListener('focus', recover);
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verifyRole]);

  const signOut = async () => {
    setState((prev) => ({ ...prev, signingOut: true }));
    try {
      await supabase.auth.signOut();
    } finally {
      verifiedUserIdRef.current = null;
    }
  };

  return { ...state, signOut, retryRoleCheck };
}
