import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useToast } from '@/hooks/use-toast';
import { useSiteConfig, DEFAULT_NAVBAR_CONFIG } from '@/hooks/useSiteConfig';
import {
  LogIn, Eye, EyeOff, ShoppingBag, Heart, Sparkles,
  Phone, Lock, ArrowRight, BadgeCheck, PackageCheck, RefreshCw,
} from 'lucide-react';
import Layout from '@/components/layout/Layout';

export default function CustomerLogin() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn, signInWithProvider, user } = useCustomerAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Pull live brand identity from settings (logo + brand name)
  const { data: navConfig } = useSiteConfig('navbar_config');
  const cfg = { ...DEFAULT_NAVBAR_CONFIG, ...(navConfig || {}) };
  const logoUrl = cfg.logo_url || cfg.wide_logo_url || '';
  const brandName = cfg.brand_name || 'স্বর্ণ সুতা';
  const brandInitial = (brandName.trim()[0] || 'স');

  useEffect(() => {
    if (user) navigate('/account', { replace: true });
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !password) return;
    setLoading(true);
    try {
      await signIn(phone, password);
      navigate('/account', { replace: true });
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.toLowerCase().includes('email not confirmed')) {
        try {
          const cleanPhone = phone.replace(/[\s-]/g, '').replace(/^\+?88/, '');
          await supabase.functions.invoke('customer-signup', {
            body: { phone: cleanPhone, password, fullName: cleanPhone },
          });
          await signIn(phone, password);
          navigate('/account', { replace: true });
          return;
        } catch {}
      }
      toast({ title: 'লগইন ব্যর্থ', description: msg || 'ভুল ফোন নম্বর বা পাসওয়ার্ড', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="relative min-h-[85vh] flex items-center justify-center px-4 py-16 sm:py-20 overflow-hidden">
        {/* Animated brand background */}
        <div className="login-bg-mesh" aria-hidden="true">
          {/* Soft gradient blobs (reduced opacity for premium clean look) */}
          <div
            className="login-bg-blob animate-gradient-shift"
            style={{
              width: '460px', height: '460px',
              top: '-100px', left: '-100px',
              background: 'hsl(var(--primary) / 0.35)',
            }}
          />
          <div
            className="login-bg-blob animate-gradient-shift"
            style={{
              width: '420px', height: '420px',
              bottom: '-120px', right: '-80px',
              background: 'hsl(var(--secondary) / 0.30)',
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

          {/* Reduced floating shopping icons (3 instead of 5 for cleaner look) */}
          <ShoppingBag className="absolute top-[14%] left-[8%] w-16 h-16 text-primary/12 animate-float-drift-1" />
          <Heart className="absolute bottom-[20%] right-[10%] w-14 h-14 text-rose-400/15 animate-float-drift-2" />
          <Sparkles className="absolute top-[55%] left-[6%] w-10 h-10 text-amber-400/25 animate-float-drift-3" style={{ animationDelay: '5s' }} />

          {/* Twinkling sparkles */}
          <Sparkles className="absolute top-[18%] left-[42%] w-3.5 h-3.5 text-amber-400 animate-sparkle" />
          <Sparkles className="absolute top-[70%] right-[28%] w-3 h-3 text-primary animate-sparkle" style={{ animationDelay: '1s' }} />
          <Sparkles className="absolute bottom-[40%] left-[28%] w-4 h-4 text-secondary animate-sparkle" style={{ animationDelay: '1.5s' }} />
        </div>

        {/* Main login card */}
        <div className="relative z-10 w-full max-w-lg animate-card-entry">
          <div className="glass-card card-shimmer-border rounded-3xl px-6 sm:px-10 pt-24 pb-10 sm:pb-12">
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
                "খুশির কেনাকাটা হোক স্বর্ণ সুতার সাথে"
              </p>
              <p className="text-sm text-muted-foreground mt-3">
                আপনার একাউন্টে প্রবেশ করুন
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-medium">মোবাইল নম্বর</Label>
                <div className="brand-input-wrapper">
                  <Phone className="brand-input-icon w-4 h-4" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="01XXXXXXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="brand-input-with-icon h-12 rounded-xl text-base"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">পাসওয়ার্ড (৬ সংখ্যা)</Label>
                <div className="brand-input-wrapper">
                  <Lock className="brand-input-icon w-4 h-4" />
                  <Input
                    id="password"
                    type={showPw ? 'text' : 'password'}
                    placeholder="••••••"
                    maxLength={6}
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    value={password}
                    onChange={(e) => setPassword(e.target.value.replace(/\D/g, '').slice(0, 6))}
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
                    <ShoppingBag className="h-4 w-4 mr-2 animate-shop-bag-bounce" />
                    লগইন হচ্ছে...
                  </>
                ) : (
                  <>
                    <LogIn className="h-5 w-5 mr-2" />
                    লগইন
                    <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>
            </form>

            {/* Divider with sparkle */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border/60" /></div>
              <div className="relative flex justify-center">
                <span className="bg-card/90 backdrop-blur-sm px-3 flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
                  <Sparkles className="w-3 h-3 text-primary" />
                  অথবা
                  <Sparkles className="w-3 h-3 text-primary" />
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => signInWithProvider('google')}
              type="button"
              className="w-full h-11 rounded-xl hover:scale-[1.02] hover:border-primary/40 hover:shadow-md hover:shadow-primary/10 transition-all"
            >
              <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Google দিয়ে লগইন করুন
            </Button>

            {/* Prominent signup footer */}
            <div className="mt-7 pt-6 border-t border-border/50 text-center">
              <p className="text-sm text-muted-foreground mb-2">নতুন এখানে?</p>
              <Link
                to="/account/signup"
                className="inline-flex items-center gap-1.5 text-primary font-semibold hover:gap-2.5 transition-all group"
              >
                একাউন্ট তৈরি করুন
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>

          {/* Brand-aligned trust strip (no false claims) */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-card/70 backdrop-blur-sm border border-border/50 hover:scale-105 hover:text-foreground hover:border-primary/40 transition-all">
              <BadgeCheck className="w-4 h-4 text-primary" />
              <span className="font-medium">অগ্রিম টাকা লাগে না</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-card/70 backdrop-blur-sm border border-border/50 hover:scale-105 hover:text-foreground hover:border-primary/40 transition-all">
              <PackageCheck className="w-4 h-4 text-primary" />
              <span className="font-medium">পণ্য দেখে টাকা দিন</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-card/70 backdrop-blur-sm border border-border/50 hover:scale-105 hover:text-foreground hover:border-primary/40 transition-all">
              <RefreshCw className="w-4 h-4 text-primary" />
              <span className="font-medium">৭ দিনে এক্সচেঞ্জ</span>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
