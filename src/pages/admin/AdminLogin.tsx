import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { checkStaffRoleWithRetry, isTransientAuthError, waitForFreshToken } from '@/lib/authHelpers';
import { useSiteConfig, DEFAULT_NAVBAR_CONFIG } from '@/hooks/useSiteConfig';
import {
  Mail, Lock, Eye, EyeOff, Shield, ShieldCheck, KeyRound,
  Sparkles, Zap, LogIn, ArrowRight, ArrowLeft, Loader2,
} from 'lucide-react';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  // While true, show a brand loader instead of the login form. Prevents
  // the "login form flash → auto redirect" feeling on mobile PWA where
  // a logged-in user briefly sees the form before being bounced to the
  // dashboard once the session restore finishes.
  const [checkingSession, setCheckingSession] = useState(true);

  // Pull live brand identity from settings (logo + brand name)
  const { data: navConfig } = useSiteConfig('navbar_config');
  const cfg = { ...DEFAULT_NAVBAR_CONFIG, ...(navConfig || {}) };
  const logoUrl = cfg.logo_url || cfg.wide_logo_url || '';
  const brandName = cfg.brand_name || 'স্বর্ণ সুতা';
  const brandInitial = (brandName.trim()[0] || 'স');

  // If already logged in with a valid role, redirect to dashboard.
  // Show a loader while this check runs so a returning admin doesn't see
  // the login form flash before the auto-redirect.
  useEffect(() => {
    let cancelled = false;
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;
        if (!session) {
          // Give the SDK a brief grace window for refresh-token rotation
          // (mobile PWA cold-resume case) before showing the login form.
          await new Promise((r) => setTimeout(r, 600));
          if (cancelled) return;
          const { data: { session: retry } } = await supabase.auth.getSession();
          if (cancelled) return;
          if (!retry) {
            setCheckingSession(false);
            return;
          }
          const result = await checkStaffRoleWithRetry(retry.user.id);
          if (cancelled) return;
          if (result.ok && result.hasRole) {
            navigate('/admin/dashboard', { replace: true });
            return;
          }
          setCheckingSession(false);
          return;
        }
        const result = await checkStaffRoleWithRetry(session.user.id);
        if (cancelled) return;
        if (result.ok && result.hasRole) {
          navigate('/admin/dashboard', { replace: true });
          return;
        }
        setCheckingSession(false);
      } catch {
        if (!cancelled) setCheckingSession(false);
      }
    };
    checkSession();
    return () => { cancelled = true; };
  }, [navigate]);

  const attemptLogin = async (): Promise<{ ok: boolean; transient?: boolean; message?: string }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (isTransientAuthError(error)) return { ok: false, transient: true };
        return { ok: false, message: error.message };
      }
      let session = data.session;
      let user = data.user;
      if (!session || !user) {
        // Sometimes mobile returns a delayed session — give SDK a moment.
        const fresh = await waitForFreshToken(2000);
        if (fresh?.user) {
          session = fresh;
          user = fresh.user;
        }
      }
      if (!session || !user) return { ok: false, transient: true };

      const result = await checkStaffRoleWithRetry(user.id);
      if (!result.ok) {
        if (isTransientAuthError((result as any).error)) return { ok: false, transient: true };
        return { ok: false, message: 'Role যাচাই করা যায়নি, আবার চেষ্টা করুন' };
      }
      if (!result.hasRole) {
        await supabase.auth.signOut().catch(() => {});
        return { ok: false, message: 'আপনার এই প্যানেলে অ্যাক্সেস নেই' };
      }
      return { ok: true };
    } catch (err: any) {
      if (isTransientAuthError(err)) return { ok: false, transient: true };
      return { ok: false, message: err?.message || 'Login failed' };
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Try once. If transient (abort/lock/network), wait briefly and retry once
    // more before surfacing an error to the user.
    let result = await attemptLogin();
    if (!result.ok && result.transient) {
      await new Promise((r) => setTimeout(r, 800));
      // Maybe the first call actually authenticated us — check session.
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const r = await checkStaffRoleWithRetry(session.user.id);
          if (r.ok && r.hasRole) {
            navigate('/admin/dashboard', { replace: true });
            return;
          }
          if (r.ok && !r.hasRole) {
            await supabase.auth.signOut().catch(() => {});
            toast.error('আপনার এই প্যানেলে অ্যাক্সেস নেই');
            setLoading(false);
            return;
          }
        }
      } catch {
        // ignore — fall through to second attempt
      }
      result = await attemptLogin();
    }

    if (result.ok) {
      navigate('/admin/dashboard', { replace: true });
      return;
    }

    if (result.transient) {
      toast.error('নেটওয়ার্ক সাময়িক সমস্যা — আবার চেষ্টা করুন');
    } else if (result.message) {
      toast.error(result.message);
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: window.location.origin + '/admin',
      });
      if (error) toast.error(error.message);
      else toast.success('Password reset লিংক পাঠানো হয়েছে!');
    } catch {
      toast.error('কিছু সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  // Brand-loader while we figure out if user is already logged in.
  // This prevents the login form from flashing for already-authenticated
  // admins on mobile PWA (the main cause of the "auto-login" feeling).
  if (checkingSession) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background animate-fade-in">
        <div className="relative">
          <div
            className="h-20 w-20 rounded-full bg-gradient-to-tr from-primary/20 via-primary/40 to-primary/20 animate-spin"
            style={{ animationDuration: '2s' }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            {logoUrl ? (
              <img src={logoUrl} alt={brandName} className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <ShieldCheck className="h-7 w-7 text-primary animate-pulse" />
            )}
          </div>
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold text-foreground tracking-wide">{brandName}</p>
          <p className="text-xs text-muted-foreground">সেশন যাচাই করা হচ্ছে...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-16 sm:py-20 overflow-hidden bg-background">
      {/* Animated brand background */}
      <div className="login-bg-mesh" aria-hidden="true">
        <div
          className="login-bg-blob animate-gradient-shift"
          style={{
            width: '460px', height: '460px',
            top: '-100px', left: '-100px',
            background: 'hsl(var(--primary) / 0.30)',
          }}
        />
        <div
          className="login-bg-blob animate-gradient-shift"
          style={{
            width: '420px', height: '420px',
            bottom: '-120px', right: '-80px',
            background: 'hsl(var(--secondary) / 0.28)',
            animationDelay: '4s',
          }}
        />
        <div
          className="login-bg-blob animate-gradient-shift"
          style={{
            width: '320px', height: '320px',
            top: '45%', left: '50%',
            background: 'hsl(var(--accent) / 0.18)',
            animationDelay: '8s',
          }}
        />

        {/* Subtle dot grid overlay (Vercel-style) */}
        <div className="absolute inset-0 bg-dot-grid opacity-60" />

        {/* Decorative SVG arcs in corners */}
        <svg
          className="absolute -top-20 -right-20 w-[420px] h-[420px] text-primary/10 animate-float-drift-1"
          viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth="0.5"
        >
          <circle cx="100" cy="100" r="80" />
          <circle cx="100" cy="100" r="60" />
          <circle cx="100" cy="100" r="40" />
        </svg>
        <svg
          className="absolute -bottom-24 -left-24 w-[420px] h-[420px] text-secondary/10 animate-float-drift-2"
          viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth="0.5"
        >
          <circle cx="100" cy="100" r="80" />
          <circle cx="100" cy="100" r="60" />
          <circle cx="100" cy="100" r="40" />
        </svg>

        {/* Admin-context floating icons */}
        <Shield className="absolute top-[14%] left-[8%] w-16 h-16 text-primary/12 animate-float-drift-1" />
        <KeyRound className="absolute bottom-[20%] right-[10%] w-14 h-14 text-secondary/15 animate-float-drift-2" />
        <Sparkles className="absolute top-[55%] left-[6%] w-10 h-10 text-amber-400/25 animate-float-drift-3" style={{ animationDelay: '5s' }} />

        {/* Twinkling sparkles */}
        <Sparkles className="absolute top-[18%] left-[42%] w-3.5 h-3.5 text-amber-400 animate-sparkle" />
        <Sparkles className="absolute top-[70%] right-[28%] w-3 h-3 text-primary animate-sparkle" style={{ animationDelay: '1s' }} />
        <Sparkles className="absolute bottom-[40%] left-[28%] w-4 h-4 text-secondary animate-sparkle" style={{ animationDelay: '1.5s' }} />
      </div>

      {/* Main login card */}
      <div className="relative z-10 w-full max-w-md animate-card-entry">
        <div className="glass-card card-shimmer-border rounded-3xl px-6 sm:px-9 pt-24 pb-10 relative">
          {/* Floating logo at top edge of card */}
          <div className="absolute left-1/2 -translate-x-1/2 -top-14 z-10">
            <div className="logo-ring-glow w-28 h-28">
              <div className="w-full h-full rounded-full bg-card flex items-center justify-center overflow-hidden shadow-2xl">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={brandName}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-full h-full rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-primary-foreground text-4xl font-bold">
                    {brandInitial}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Staff Access badge */}
          <div className="absolute top-4 right-4 z-10">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/30 backdrop-blur-sm">
              <ShieldCheck className="w-3 h-3 text-primary" />
              <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">Staff Access</span>
            </div>
          </div>

          {/* Brand header */}
          <div className="text-center mb-7">
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
              {brandName}
            </h1>

            {/* Decorative divider with sparkle */}
            <div className="flex items-center justify-center gap-3 my-4" aria-hidden="true">
              <span className="h-px w-12 sm:w-16 bg-gradient-to-r from-transparent to-primary/40" />
              <Sparkles className="w-4 h-4 text-primary animate-sparkle" />
              <span className="h-px w-12 sm:w-16 bg-gradient-to-l from-transparent to-primary/40" />
            </div>

            {/* Premium tagline */}
            <p className="text-lg sm:text-xl font-semibold tagline-shimmer leading-snug px-2">
              {showForgot ? 'পাসওয়ার্ড রিসেট' : 'অ্যাডমিন প্যানেল'}
            </p>
            <p className="text-sm text-muted-foreground mt-3">
              {showForgot ? 'নতুন পাসওয়ার্ড সেট করার লিংক পান' : 'আপনার অ্যাকাউন্টে নিরাপদে প্রবেশ করুন'}
            </p>
          </div>

          {showForgot ? (
            <form onSubmit={handleForgotPassword} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="forgot-email" className="text-sm font-medium">Email</Label>
                <div className="brand-input-wrapper">
                  <Mail className="brand-input-icon w-4 h-4" />
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="you@example.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="brand-input-with-icon h-12 rounded-xl text-base"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-primary/85 hover:from-primary/90 hover:to-primary text-primary-foreground font-semibold text-base shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all group animate-btn-pulse-glow"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    পাঠানো হচ্ছে...
                  </>
                ) : (
                  <>
                    <KeyRound className="h-5 w-5 mr-2" />
                    Reset Link পাঠান
                    <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>

              <button
                type="button"
                onClick={() => setShowForgot(false)}
                className="w-full inline-flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors group"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                Login এ ফিরে যান
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                <div className="brand-input-wrapper">
                  <Mail className="brand-input-icon w-4 h-4" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="brand-input-with-icon h-12 rounded-xl text-base"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                <div className="brand-input-wrapper">
                  <Lock className="brand-input-icon w-4 h-4" />
                  <Input
                    id="password"
                    type={showPw ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="brand-input-with-icon h-12 rounded-xl text-base pr-11"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors z-10"
                    aria-label={showPw ? 'হাইড' : 'দেখান'}
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-primary/85 hover:from-primary/90 hover:to-primary text-primary-foreground font-semibold text-base shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all group animate-btn-pulse-glow"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Logging in...
                  </>
                ) : (
                  <>
                    <LogIn className="h-5 w-5 mr-2" />
                    Login
                    <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>

              <button
                type="button"
                onClick={() => setShowForgot(true)}
                className="w-full text-center text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                Password ভুলে গেছেন?
              </button>
            </form>
          )}
        </div>

        {/* Admin-context trust strip */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-card/70 backdrop-blur-sm border border-border/50 hover:scale-105 hover:text-foreground hover:border-primary/40 transition-all">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span className="font-medium">নিরাপদ ও এনক্রিপ্টেড</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-card/70 backdrop-blur-sm border border-border/50 hover:scale-105 hover:text-foreground hover:border-primary/40 transition-all">
            <Lock className="w-4 h-4 text-primary" />
            <span className="font-medium">শুধু অনুমোদিত স্টাফ</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-card/70 backdrop-blur-sm border border-border/50 hover:scale-105 hover:text-foreground hover:border-primary/40 transition-all">
            <Zap className="w-4 h-4 text-primary" />
            <span className="font-medium">দ্রুত ও স্থিতিশীল</span>
          </div>
        </div>
      </div>
    </div>
  );
}
