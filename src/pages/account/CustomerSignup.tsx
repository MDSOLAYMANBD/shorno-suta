import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Eye, EyeOff, ArrowLeft, RefreshCw } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { supabase } from '@/integrations/supabase/client';

export default function CustomerSignup() {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [otp, setOtp] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const { signUp, signInWithProvider, user } = useCustomerAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) navigate('/account', { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const cleanPhone = phone.replace(/[\s-]/g, '').replace(/^\+?88/, '');

  const handleSendOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!/^01[3-9]\d{8}$/.test(cleanPhone)) {
      toast({ title: 'ভুল নম্বর', description: 'সঠিক ১১ সংখ্যার মোবাইল নম্বর দিন', variant: 'destructive' });
      return;
    }
    if (password.length !== 6) {
      toast({ title: 'পাসওয়ার্ড ভুল', description: '৬ সংখ্যার পাসওয়ার্ড দিন', variant: 'destructive' });
      return;
    }
    if (name.trim().length < 2) {
      toast({ title: 'নাম দিন', description: 'আপনার পুরো নাম লিখুন', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-otp', {
        body: { phone: cleanPhone },
      });
      if (error) throw new Error(error.message || 'OTP পাঠাতে সমস্যা হয়েছে');
      if (data?.error) throw new Error(data.error);

      setStep('otp');
      setResendCooldown(60);
      toast({ title: 'OTP পাঠানো হয়েছে', description: `${cleanPhone} নম্বরে কোড পাঠানো হয়েছে` });
    } catch (err: any) {
      toast({ title: 'OTP পাঠাতে ব্যর্থ', description: err.message || 'আবার চেষ্টা করুন', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndSignup = async () => {
    if (otp.length !== 4) {
      toast({ title: 'OTP দিন', description: '৪ সংখ্যার কোড দিন', variant: 'destructive' });
      return;
    }

    setOtpLoading(true);
    try {
      // Verify OTP first
      const { data, error } = await supabase.functions.invoke('verify-otp', {
        body: { phone: cleanPhone, code: otp },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      if (!data?.verified) throw new Error('OTP ভেরিফাই হয়নি');

      // OTP verified — now do the actual signup
      await signUp(cleanPhone, password, name.trim());
      toast({ title: 'একাউন্ট তৈরি হয়েছে!', description: 'আপনি এখন লগইন হয়ে গেছেন' });
      navigate('/account', { replace: true });
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('weak_password') || msg.includes('weak') || msg.includes('easy to guess')) {
        setStep('form');
        setOtp('');
        toast({ title: 'পাসওয়ার্ড দুর্বল', description: 'এই পাসওয়ার্ড খুব সহজ। অন্য একটি ৬ সংখ্যার পাসওয়ার্ড দিন।', variant: 'destructive' });
      } else {
        toast({ title: 'ব্যর্থ', description: msg || 'আবার চেষ্টা করুন', variant: 'destructive' });
      }
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-otp', {
        body: { phone: cleanPhone },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setResendCooldown(60);
      setOtp('');
      toast({ title: 'আবার পাঠানো হয়েছে', description: 'নতুন OTP আপনার নম্বরে পাঠানো হয়েছে' });
    } catch (err: any) {
      toast({ title: 'ব্যর্থ', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-10">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">
              {step === 'form' ? 'একাউন্ট তৈরি করুন' : 'ফোন ভেরিফিকেশন'}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {step === 'form' ? 'নতুন একাউন্ট খুলুন' : `${cleanPhone} নম্বরে পাঠানো ৪ সংখ্যার কোড দিন`}
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            {step === 'form' ? (
              <>
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">আপনার নাম *</Label>
                    <Input id="name" type="text" placeholder="পুরো নাম" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">মোবাইল নম্বর *</Label>
                    <Input id="phone" type="tel" placeholder="01XXXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">৬ সংখ্যার পাসওয়ার্ড *</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPw ? 'text' : 'password'}
                        placeholder="••••••"
                        maxLength={6}
                        inputMode="numeric"
                        pattern="[0-9]{6}"
                        value={password}
                        onChange={(e) => setPassword(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        required
                      />
                      <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    {loading ? 'কোড পাঠানো হচ্ছে...' : 'ভেরিফিকেশন কোড পাঠান'}
                  </Button>
                </form>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">অথবা</span></div>
                </div>

                <Button variant="outline" className="w-full" onClick={() => signInWithProvider('google')} type="button">
                  <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                  Google দিয়ে সাইনআপ করুন
                </Button>
              </>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-center">
                  <InputOTP maxLength={4} value={otp} onChange={setOtp} autoComplete="one-time-code">
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                <Button className="w-full" onClick={handleVerifyAndSignup} disabled={otpLoading || otp.length !== 4}>
                  {otpLoading ? 'যাচাই হচ্ছে...' : 'ভেরিফাই করুন ও একাউন্ট তৈরি করুন'}
                </Button>

                <div className="flex items-center justify-between">
                  <Button variant="ghost" size="sm" onClick={() => { setStep('form'); setOtp(''); }}>
                    <ArrowLeft className="h-4 w-4 mr-1" /> পেছনে
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleResend} disabled={resendCooldown > 0 || loading}>
                    <RefreshCw className="h-4 w-4 mr-1" />
                    {resendCooldown > 0 ? `${resendCooldown}s পর আবার` : 'আবার পাঠান'}
                  </Button>
                </div>
              </div>
            )}

            <p className="text-center text-sm text-muted-foreground">
              একাউন্ট আছে?{' '}
              <Link to="/account/login" className="text-primary font-medium hover:underline">
                লগইন করুন
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
