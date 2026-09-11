import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ActivityTimeline from '@/components/admin/ActivityTimeline';
import EmployeeActivityChart from '@/components/admin/EmployeeActivityChart';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MediaCenter from '@/components/admin/MediaCenter';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { format, subDays, subMonths, startOfDay, startOfMonth } from 'date-fns';
import { Pencil, X, Check, Camera, Lock, Mail, Eye, EyeOff, ArrowLeft, CalendarIcon, Clock, Sparkles, Timer, TrendingUp, User, Heart, Cake, Quote, Trash2, RefreshCw, BookmarkPlus } from 'lucide-react';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import { getRandomQuote, MOTIVATIONAL_QUOTES, type Quote as QuoteType } from '@/lib/motivationalQuotes';

const FUNC_URL = 'https://xxucasikopqtcztbgfbw.supabase.co/functions/v1/manage-employee';

// Hobby options
const HOBBY_OPTIONS = [
  { value: 'movies', label: '🎬 মুভি দেখা' },
  { value: 'music', label: '🎵 গান শোনা' },
  { value: 'gaming', label: '🎮 গেম খেলা' },
  { value: 'reading', label: '📚 বই পড়া' },
  { value: 'cooking', label: '🍳 রান্না করা' },
  { value: 'travel', label: '✈️ ভ্রমণ' },
  { value: 'learning', label: '📖 নতুন কিছু শেখা' },
  { value: 'exercise', label: '💪 ব্যায়াম' },
  { value: 'cricket', label: '🏏 ক্রিকেট' },
  { value: 'football', label: '⚽ ফুটবল' },
];




function ProfileHeader({ employee, onAvatarUpdated, canEdit, savedQuotes, onSaveQuote }: { employee: any; onAvatarUpdated: () => void; canEdit: boolean; savedQuotes: QuoteType[]; onSaveQuote: (q: QuoteType) => void }) {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [currentQuote, setCurrentQuote] = useState(() => getRandomQuote());
  const [fadeIn, setFadeIn] = useState(true);

  const showNextQuote = () => {
    setFadeIn(false);
    setTimeout(() => {
      setCurrentQuote(getRandomQuote());
      setFadeIn(true);
    }, 300);
  };

  const isAlreadySaved = savedQuotes.some(q => q.quote === currentQuote.quote.quote);




  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || '';
  };

  const patchEmployee = async (body: Record<string, any>) => {
    const token = await getToken();
    const res = await fetch(FUNC_URL, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ user_id: id, ...body }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed');
    }
  };

  const saveName = async () => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await patchEmployee({ full_name: editName.trim() });
      toast.success('নাম আপডেট হয়েছে');
      queryClient.invalidateQueries({ queryKey: ['employee', id] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['my-profile'] });
      setIsEditing(false);
    } catch {
      toast.error('আপডেট ব্যর্থ হয়েছে');
    } finally {
      setSaving(false);
    }
  };

  const handleMediaSelect = async (urls: string[]) => {
    if (urls.length === 0) return;
    try {
      await patchEmployee({ avatar_url: urls[0] });
      toast.success('প্রোফাইল ছবি আপডেট হয়েছে');
      queryClient.invalidateQueries({ queryKey: ['employee', id] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['my-profile'] });
      onAvatarUpdated();
    } catch {
      toast.error('ছবি আপডেট ব্যর্থ');
    }
  };

  return (
    <>
      <Card className="overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-primary via-secondary to-primary" />
        <CardContent className="flex items-center gap-4 pt-5 pb-4">
          <div className={cn("relative", canEdit && "group cursor-pointer")} onClick={() => canEdit && setMediaOpen(true)}>
            <Avatar className="h-16 w-16 ring-2 ring-primary/20">
              <AvatarImage src={employee.avatar_url || ''} />
              <AvatarFallback className="text-lg bg-primary/10 text-primary">{(employee.full_name || employee.email)[0].toUpperCase()}</AvatarFallback>
            </Avatar>
            {canEdit && (
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="h-5 w-5 text-white" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            {isEditing && canEdit ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="max-w-[250px] h-9"
                  placeholder="নাম লিখুন"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && saveName()}
                />
                <Button size="sm" onClick={saveName} disabled={saving}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold">{employee.full_name || 'স্বর্ণ সুতা'}</h1>
                {canEdit && (
                  <Button size="sm" variant="ghost" onClick={() => { setEditName(employee.full_name || ''); setIsEditing(true); }} className="h-7 w-7 p-0">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            )}
            <div className="flex gap-2 mt-1">
              <Badge variant="secondary">{employee.role}</Badge>
            </div>
          </div>

          {/* Motivational Quote */}
          <div
            className="hidden md:flex flex-1 items-center justify-center cursor-pointer group select-none"
            onClick={showNextQuote}
            title="ক্লিক করলে নতুন উক্তি আসবে"
          >
            <div className={cn(
              "relative text-center px-8 py-5 max-w-lg rounded-xl bg-muted/20 border border-border/40",
              fadeIn ? "animate-quote-in" : "animate-quote-out"
            )}>
              {/* Decorative quotation mark */}
              <span className="absolute -top-3 left-4 text-5xl font-serif text-primary/20 leading-none select-none">"</span>
              <p className="text-lg md:text-xl font-serif italic text-foreground/85 leading-relaxed tracking-wide">
                {currentQuote.quote.quote}
              </p>
              <p className="text-sm font-semibold text-primary mt-3 tracking-wide">— {currentQuote.quote.author}</p>
              <span className="absolute -bottom-3 right-4 text-5xl font-serif text-primary/20 leading-none select-none rotate-180">"</span>
            </div>
          </div>

          {/* Save / Refresh buttons */}
          <div className="hidden md:flex flex-col gap-1.5 shrink-0">
            <Button
              size="icon"
              variant="ghost"
              className="h-9 w-9"
              onClick={(e) => { e.stopPropagation(); showNextQuote(); }}
              title="নতুন উক্তি"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className={cn("h-9 w-9", isAlreadySaved && "text-red-500")}
              onClick={(e) => {
                e.stopPropagation();
                if (!isAlreadySaved) {
                  onSaveQuote(currentQuote.quote);
                  toast.success('উক্তি সেভ হয়েছে ❤️');
                } else {
                  toast.info('এই উক্তি আগেই সেভ করা আছে');
                }
              }}
              title={isAlreadySaved ? 'সেভ করা আছে' : 'সেভ করুন'}
            >
              <Heart className={cn("h-4 w-4", isAlreadySaved && "fill-current")} />
            </Button>
          </div>
        </CardContent>

        {/* Mobile quote */}
        <div className="md:hidden px-4 pb-4">
          <div
            className={cn(
              "relative text-center cursor-pointer p-4 rounded-xl bg-muted/30 border border-border/30 transition-all duration-300",
              fadeIn ? "animate-quote-in" : "animate-quote-out"
            )}
            onClick={showNextQuote}
          >
            <span className="absolute -top-2 left-3 text-4xl font-serif text-primary/20 leading-none select-none">"</span>
            <p className="text-base font-serif italic text-foreground/85 leading-relaxed tracking-wide">
              {currentQuote.quote.quote}
            </p>
            <div className="flex items-center justify-center gap-2 mt-2.5">
              <p className="text-sm font-semibold text-primary tracking-wide">— {currentQuote.quote.author}</p>
              {!isAlreadySaved && (
                <button
                  onClick={(e) => { e.stopPropagation(); onSaveQuote(currentQuote.quote); toast.success('উক্তি সেভ হয়েছে ❤️'); }}
                  className="text-muted-foreground hover:text-red-500 transition-colors"
                >
                  <Heart className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </Card>
      {canEdit && <MediaCenter open={mediaOpen} onOpenChange={setMediaOpen} onSelect={handleMediaSelect} />}
    </>
  );
}

const BENGALI_DAYS: Record<string, string> = {
  saturday: 'শনিবার',
  sunday: 'রবিবার',
  monday: 'সোমবার',
  tuesday: 'মঙ্গলবার',
  wednesday: 'বুধবার',
  thursday: 'বৃহস্পতিবার',
  friday: 'শুক্রবার',
};

const TIME_OPTIONS = Array.from({ length: 19 }, (_, i) => {
  const h = i + 6; // 6:00 to 24:00
  const hStr = String(h).padStart(2, '0') + ':00';
  const label = h < 12 ? `সকাল ${h}:00` : h === 12 ? 'দুপুর 12:00' : h <= 15 ? `দুপুর ${h - 12}:00` : h <= 17 ? `বিকাল ${h - 12}:00` : `রাত ${h - 12}:00`;
  return { value: hStr, label };
});

function SettingsTab({ employee, isSelf, isAdmin, savedQuotes, onRemoveQuote }: { employee: any; isSelf: boolean; isAdmin: boolean; savedQuotes: QuoteType[]; onRemoveQuote: (index: number) => void }) {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  // Personal info state
  const { data: personalData, refetch: refetchPersonal } = useQuery({
    queryKey: ['employee-personal-full', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('employee_profiles' as any)
        .select('gender, date_of_birth, hobbies, duty_start_time, duty_end_time, off_day')
        .eq('user_id', id!)
        .maybeSingle();
      return (data as any) || {};
    },
    enabled: !!id,
  });

  const [gender, setGender] = useState<string>('');
  const [dateOfBirth, setDateOfBirth] = useState<string>('');
  const [selectedHobbies, setSelectedHobbies] = useState<string[]>([]);
  const [savingPersonal, setSavingPersonal] = useState(false);

  // Duty config state
  const [dutyStart, setDutyStart] = useState('10:00');
  const [dutyEnd, setDutyEnd] = useState('21:00');
  const [offDay, setOffDay] = useState('friday');
  const [savingDuty, setSavingDuty] = useState(false);

  useEffect(() => {
    if (personalData) {
      setGender(personalData.gender || '');
      setDateOfBirth(personalData.date_of_birth || '');
      setSelectedHobbies(personalData.hobbies || []);
      setDutyStart(personalData.duty_start_time || '10:00');
      setDutyEnd(personalData.duty_end_time || '21:00');
      setOffDay(personalData.off_day || 'friday');
    }
  }, [personalData]);

  const toggleHobby = (hobby: string) => {
    setSelectedHobbies(prev =>
      prev.includes(hobby) ? prev.filter(h => h !== hobby) : [...prev, hobby]
    );
  };

  const savePersonalInfo = async () => {
    setSavingPersonal(true);
    try {
      const { error } = await supabase
        .from('employee_profiles' as any)
        .update({
          gender: gender || null,
          date_of_birth: dateOfBirth || null,
          hobbies: selectedHobbies,
        })
        .eq('user_id', id!);
      if (error) throw error;
      toast.success('ব্যক্তিগত তথ্য আপডেট হয়েছে');
      refetchPersonal();
      queryClient.invalidateQueries({ queryKey: ['employee-personal-info', id] });
    } catch {
      toast.error('আপডেট ব্যর্থ');
    } finally {
      setSavingPersonal(false);
    }
  };

  const saveDutyConfig = async () => {
    setSavingDuty(true);
    try {
      const { error } = await supabase
        .from('employee_profiles' as any)
        .update({ duty_start_time: dutyStart, duty_end_time: dutyEnd, off_day: offDay })
        .eq('user_id', id!);
      if (error) throw error;
      toast.success('ডিউটি সেটিংস আপডেট হয়েছে');
      refetchPersonal();
      queryClient.invalidateQueries({ queryKey: ['employee-duty-config', id] });
    } catch {
      toast.error('আপডেট ব্যর্থ');
    } finally {
      setSavingDuty(false);
    }
  };

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || '';
  };

  const handleSelfPasswordChange = async () => {
    if (newPassword.length < 6) { toast.error('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে'); return; }
    if (newPassword !== confirmPassword) { toast.error('পাসওয়ার্ড মিলছে না'); return; }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('পাসওয়ার্ড পরিবর্তন হয়েছে');
      setNewPassword(''); setConfirmPassword('');
    } catch (err: any) { toast.error(err.message || 'পাসওয়ার্ড পরিবর্তন ব্যর্থ'); }
    finally { setChangingPassword(false); }
  };

  const handleAdminPasswordChange = async () => {
    if (newPassword.length < 6) { toast.error('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে'); return; }
    if (newPassword !== confirmPassword) { toast.error('পাসওয়ার্ড মিলছে না'); return; }
    setChangingPassword(true);
    try {
      const token = await getToken();
      const res = await fetch(FUNC_URL, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ user_id: id, new_password: newPassword }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('পাসওয়ার্ড পরিবর্তন হয়েছে');
      setNewPassword(''); setConfirmPassword('');
    } catch { toast.error('পাসওয়ার্ড পরিবর্তন ব্যর্থ'); }
    finally { setChangingPassword(false); }
  };

  const handleSendResetLink = async () => {
    setSendingReset(true);
    try {
      const token = await getToken();
      const res = await fetch(FUNC_URL, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ user_id: id, reset_password: true }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success(`${employee.email} এ রিসেট লিংক পাঠানো হয়েছে`);
    } catch { toast.error('রিসেট লিংক পাঠানো ব্যর্থ'); }
    finally { setSendingReset(false); }
  };

  return (
    <div className="space-y-6">
      {/* Personal Info */}
      <Card className="animate-fade-in">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            ব্যক্তিগত তথ্য
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Email (read-only) */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" /> ইমেইল
            </label>
            <Input value={employee.email || ''} readOnly className="bg-muted/50" />
          </div>

          {/* Status */}
          <div className="space-y-2">
            <label className="text-sm font-medium">স্ট্যাটাস</label>
            <Badge variant={employee.is_active ? 'default' : 'destructive'}>
              {employee.is_active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Gender */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <Heart className="h-3.5 w-3.5" /> লিঙ্গ
              </label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">পুরুষ</SelectItem>
                  <SelectItem value="female">মহিলা</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date of Birth */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <Cake className="h-3.5 w-3.5" /> জন্ম তারিখ
              </label>
              <Input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                max={format(new Date(), 'yyyy-MM-dd')}
              />
            </div>
          </div>

          {/* Hobbies */}
          <div className="space-y-2">
            <label className="text-sm font-medium">শখ ও আগ্রহ</label>
            <div className="flex flex-wrap gap-2">
              {HOBBY_OPTIONS.map(h => (
                <button
                  key={h.value}
                  type="button"
                  onClick={() => toggleHobby(h.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200",
                    selectedHobbies.includes(h.value)
                      ? "bg-primary text-primary-foreground border-primary shadow-sm scale-105"
                      : "bg-muted/50 text-muted-foreground border-border hover:border-primary/50 hover:bg-primary/5"
                  )}
                >
                  {h.label}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={savePersonalInfo} disabled={savingPersonal} size="sm">
            {savingPersonal ? 'সেভ হচ্ছে...' : 'ব্যক্তিগত তথ্য সেভ করুন'}
          </Button>
        </CardContent>
      </Card>

      {/* Duty Config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            ডিউটি ও ছুটি সেটিংস
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">ডিউটি শুরু সময়</label>
              <Select value={dutyStart} onValueChange={setDutyStart}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.filter(t => parseInt(t.value) < 16).map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">ডিউটি শেষ সময়</label>
              <Select value={dutyEnd} onValueChange={setDutyEnd}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.filter(t => parseInt(t.value) >= 16).map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">ছুটির দিন</label>
              <Select value={offDay} onValueChange={setOffDay}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(BENGALI_DAYS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={saveDutyConfig} disabled={savingDuty} size="sm">
            {savingDuty ? 'সেভ হচ্ছে...' : 'সেভ করুন'}
          </Button>
        </CardContent>
      </Card>

      {/* Password Change */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4" />
            পাসওয়ার্ড পরিবর্তন
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">নতুন পাসওয়ার্ড</label>
            <div className="relative">
              <Input type={showPassword ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="নতুন পাসওয়ার্ড লিখুন" />
              <button type="button" className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">পাসওয়ার্ড নিশ্চিত করুন</label>
            <Input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="পাসওয়ার্ড আবার লিখুন" />
          </div>
          <Button onClick={isSelf ? handleSelfPasswordChange : handleAdminPasswordChange} disabled={changingPassword || !newPassword}>
            {changingPassword ? 'পরিবর্তন হচ্ছে...' : 'পাসওয়ার্ড পরিবর্তন করুন'}
          </Button>
        </CardContent>
      </Card>

      {isAdmin && !isSelf && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4" />
              পাসওয়ার্ড রিসেট লিংক
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3"><strong>{employee.email}</strong> এ পাসওয়ার্ড রিসেট লিংক পাঠানো হবে।</p>
            <Button variant="outline" onClick={handleSendResetLink} disabled={sendingReset}>
              <Mail className="h-4 w-4 mr-2" />
              {sendingReset ? 'পাঠানো হচ্ছে...' : 'রিসেট লিংক পাঠান'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Saved Quotes */}
      {savedQuotes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Quote className="h-4 w-4" />
              সেভ করা উক্তি ({savedQuotes.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {savedQuotes.map((q, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 group">
                <div className="flex-1 min-w-0">
                  <p className="text-sm italic text-foreground leading-relaxed">"{q.quote}"</p>
                  <p className="text-xs font-semibold text-primary mt-1">— {q.author}</p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-destructive hover:text-destructive"
                  onClick={() => onRemoveQuote(i)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Need cn for conditional classes
// cn already imported at top
import { Bell, Send, CalendarDays, Award, LogIn, Coffee, CoffeeIcon, LogOut } from 'lucide-react';
import { useTodayAttendance, useAttendanceAction } from '@/hooks/useSelfAttendance';
import { Textarea } from '@/components/ui/textarea';
import { format as formatDate } from 'date-fns';
import { bn } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import StaffNotificationCard from '@/components/admin/StaffNotificationCard';

function NotificationsTab({ userId, isSelf }: { userId: string; isSelf: boolean }) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('');
  const [currentUserName, setCurrentUserName] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsOwner(session.user.email === 'amisrsolayman@gmail.com');
        setCurrentUserId(session.user.id);
        setCurrentUserName(session.user.user_metadata?.full_name || session.user.email || '');
      }
    });
  }, []);

  // Fetch all employees for name resolution
  const { data: allEmployees = [] } = useQuery({
    queryKey: ['all-employees-for-notif', currentUserId],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];
      const res = await fetch(FUNC_URL, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      return await res.json();
    },
    enabled: !!currentUserId,
  });

  // Fetch received notifications
  const { data: receivedNotifs = [] } = useQuery({
    queryKey: ['staff-notifications-received', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('staff_notifications' as any)
        .select('*')
        .eq('recipient_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      return (data as any[]) || [];
    },
  });

  // Fetch sent notifications (deduplicated by group_id)
  const { data: sentNotifs = [] } = useQuery({
    queryKey: ['staff-notifications-sent', currentUserId],
    queryFn: async () => {
      if (!currentUserId) return [];
      const { data } = await supabase
        .from('staff_notifications' as any)
        .select('*')
        .eq('sender_id', currentUserId)
        .order('created_at', { ascending: false })
        .limit(200);
      if (!data) return [];
      // Deduplicate by group_id — keep first (newest) per group
      const seen = new Set<string>();
      return (data as any[]).filter((n: any) => {
        const gid = n.group_id || n.id;
        if (seen.has(gid)) return false;
        seen.add(gid);
        return true;
      });
    },
    enabled: !!currentUserId,
  });

  // Fetch read receipts for sent messages
  const sentGroupIds = useMemo(() => sentNotifs.map((n: any) => n.group_id || n.id), [sentNotifs]);
  const { data: readReceipts = [] } = useQuery({
    queryKey: ['staff-notif-read-receipts', sentGroupIds],
    queryFn: async () => {
      if (sentGroupIds.length === 0) return [];
      const { data } = await supabase
        .from('staff_notifications' as any)
        .select('group_id, recipient_id, is_read')
        .in('group_id', sentGroupIds);
      return (data as any[]) || [];
    },
    enabled: sentGroupIds.length > 0,
  });

  // Merge received + sent, deduplicate, sort by created_at
  const notifications = useMemo(() => {
    const map = new Map<string, any>();
    // Add received first
    receivedNotifs.forEach((n: any) => map.set(n.id, { ...n, _isSent: false }));
    // Add sent (mark as sent)
    sentNotifs.forEach((n: any) => {
      const key = `sent-${n.group_id || n.id}`;
      if (!map.has(key)) {
        map.set(key, { ...n, _isSent: true, is_read: true }); // sender always "read"
      }
    });
    return Array.from(map.values()).sort(
      (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [receivedNotifs, sentNotifs]);

  // Build read receipt map: group_id -> { total, readCount, readNames }
  const readReceiptMap = useMemo(() => {
    const result: Record<string, { total: number; readCount: number; readNames: string[] }> = {};
    readReceipts.forEach((r: any) => {
      if (!result[r.group_id]) result[r.group_id] = { total: 0, readCount: 0, readNames: [] };
      result[r.group_id].total++;
      if (r.is_read) {
        result[r.group_id].readCount++;
        const emp = allEmployees.find((e: any) => e.user_id === r.recipient_id);
        if (emp) result[r.group_id].readNames.push(emp.full_name || emp.email);
      }
    });
    return result;
  }, [readReceipts, allEmployees]);

  // Auto-mark all unread received notifications as read when tab opens
  useEffect(() => {
    if (!isSelf) return;
    const unreadIds = receivedNotifs.filter((n: any) => !n.is_read).map((n: any) => n.id);
    if (unreadIds.length === 0) return;
    (async () => {
      await supabase
        .from('staff_notifications' as any)
        .update({ is_read: true })
        .in('id', unreadIds);
      queryClient.invalidateQueries({ queryKey: ['staff-notifications-received', userId] });
      queryClient.invalidateQueries({ queryKey: ['staff-notif-read-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['unread-notif-count', userId] });
      queryClient.invalidateQueries({ queryKey: ['notif-unread'] });
    })();
  }, [receivedNotifs, isSelf, userId, queryClient]);

  const markAsRead = async (notifId: string) => {
    await supabase
      .from('staff_notifications' as any)
      .update({ is_read: true })
      .eq('id', notifId);
    queryClient.invalidateQueries({ queryKey: ['staff-notifications-received', userId] });
    queryClient.invalidateQueries({ queryKey: ['staff-notif-read-receipts'] });
    queryClient.invalidateQueries({ queryKey: ['unread-notif-count', userId] });
    queryClient.invalidateQueries({ queryKey: ['notif-unread'] });
  };

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await fetch(FUNC_URL, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      const allEmps = await res.json();
      const recipients = (allEmps as any[]).filter((e: any) => e.user_id !== session.user.id);

      if (recipients.length === 0) {
        toast.error('কোনো staff পাওয়া যায়নি');
        return;
      }

      const groupId = crypto.randomUUID();
      const currentEmp = (allEmps as any[]).find((e: any) => e.user_id === session.user.id);
      const senderName = currentEmp?.full_name || session.user.user_metadata?.full_name || session.user.email || '';

      const notifs = recipients.map((e: any) => ({
        sender_id: session.user.id,
        recipient_id: e.user_id,
        message: message.trim(),
        group_id: groupId,
        sender_name: senderName,
      }));

      const { error } = await supabase.from('staff_notifications' as any).insert(notifs);
      if (error) throw error;
      toast.success(`${recipients.length} জন staff কে বার্তা পাঠানো হয়েছে`);
      setMessage('');
      queryClient.invalidateQueries({ queryKey: ['staff-notifications-received', userId] });
      queryClient.invalidateQueries({ queryKey: ['staff-notifications-sent', currentUserId] });
    } catch {
      toast.error('বার্তা পাঠানো ব্যর্থ');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      {isOwner && isSelf && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Send className="h-4 w-4" /> বার্তা পাঠান
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="সব staff কে বার্তা লিখুন..."
              rows={3}
            />
            <Button onClick={handleSend} disabled={sending || !message.trim()} size="sm">
              <Send className="h-4 w-4 mr-2" />
              {sending ? 'পাঠানো হচ্ছে...' : 'পাঠান'}
            </Button>
          </CardContent>
        </Card>
      )}

      <TooltipProvider delayDuration={200}>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" /> বার্তা
          </CardTitle>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">কোনো বার্তা নেই</p>
          ) : (
            <div className="space-y-3">
              {notifications.map((n: any) => {
                const groupId = n.group_id || n.id;
                const receipt = n._isSent ? readReceiptMap[groupId] : null;
                return (
                  <div key={n._isSent ? `sent-${groupId}` : n.id}>
                    {n._isSent && (
                      <div className="flex items-center gap-2 mb-1.5 ml-2">
                        <Badge variant="secondary" className="text-[10px] px-2 py-0.5">আপনি পাঠিয়েছেন</Badge>
                        {receipt && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-[11px] text-muted-foreground cursor-help flex items-center gap-1">
                                <Eye className="h-3 w-3" />
                                {receipt.readCount}/{receipt.total} জন দেখেছে
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs max-w-[200px]">
                              {receipt.readNames.length > 0
                                ? receipt.readNames.join(', ')
                                : 'কেউ এখনো দেখেনি'}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    )}
                    <StaffNotificationCard
                      notification={n}
                      currentUserId={currentUserId}
                      currentUserName={currentUserName}
                      onMarkRead={n._isSent ? undefined : markAsRead}
                      employees={allEmployees}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      </TooltipProvider>
    </div>
  );
}
// Motivational quotes — performance-based
const PERFORMANCE_QUOTES = {
  excellent: [
    '🌟 আপনার কঠোর পরিশ্রমই প্রতিষ্ঠানের শক্তি — অসাধারণ চলছে!',
    '💪 সময়ানুবর্তিতায় আপনি একটি আদর্শ — এভাবে চালিয়ে যান!',
    '🏆 দুর্দান্ত পারফরম্যান্স! আপনি প্রমাণ করছেন যে ধারাবাহিকতাই সাফল্য।',
    '✨ আপনার নিষ্ঠা টিমের সবাইকে অনুপ্রাণিত করে — ব্রাভো!',
    '🎯 একদম পারফেক্ট! আপনি এই মাসের সেরা পারফর্মার!',
  ],
  good: [
    '⭐ ভালো চলছে! একটু সময়ানুবর্তিতায় মনোযোগ দিলেই সেরা হবেন!',
    '📈 আপনার উন্নতি চোখে পড়ার মতো — আরেকটু চেষ্টা করলেই টপে!',
    '🌱 ভালো কাজের ধারা বজায় রাখুন — সাফল্য কাছেই!',
    '💫 আরেকটু নিয়মিত হলেই Excellent রেটিং পাবেন!',
  ],
  poor: [
    '🔥 হাল ছাড়বেন না! প্রতিটি নতুন দিন নতুন সুযোগ!',
    '💡 সময়মতো আসা একটি অভ্যাস — আজ থেকেই শুরু করুন!',
    '🚀 আগামীকাল আরও ভালো করার সুযোগ আছে — বিশ্বাস রাখুন!',
    '🎯 ছোট ছোট উন্নতিই বড় পরিবর্তন আনে — একটু মনোযোগ দিন!',
  ],
};

function AttendanceTab({ userId, isSelf }: { userId: string; isSelf: boolean }) {
  const { isAdmin } = usePermissions();
  const { data: todayData, isLoading: todayLoading } = useTodayAttendance();
  const attendanceAction = useAttendanceAction();
  const todayRecord = isSelf ? todayData?.data : null;

  const [lunchTimer, setLunchTimer] = useState<string>('');

  // Fetch off_day config
  const { data: dutyConfig } = useQuery({
    queryKey: ['employee-duty-config', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('employee_profiles' as any)
        .select('duty_start_time, duty_end_time, off_day')
        .eq('user_id', userId)
        .maybeSingle();
      return (data as any) || { duty_start_time: '10:00', duty_end_time: '21:00', off_day: 'friday' };
    },
    enabled: !!userId,
  });

  const offDay = dutyConfig?.off_day || 'friday';
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const todayDayName = dayNames[new Date().getDay()];
  const isOffDay = todayDayName === offDay;

  useEffect(() => {
    if (!todayRecord?.lunch_start || todayRecord?.lunch_end) return;
    const interval = setInterval(() => {
      const elapsed = Math.round((Date.now() - new Date(todayRecord.lunch_start).getTime()) / 60000);
      const remaining = 60 - elapsed;
      setLunchTimer(remaining > 0 ? `${remaining} মিনিট বাকি` : `${Math.abs(remaining)} মিনিট অতিরিক্ত!`);
    }, 1000);
    return () => clearInterval(interval);
  }, [todayRecord?.lunch_start, todayRecord?.lunch_end]);

  const { data: monthlyRecords = [], isLoading } = useQuery({
    queryKey: ['staff-attendance-profile', userId],
    queryFn: async () => {
      const now = new Date();
      const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const { data, error } = await (supabase.from('staff_attendance' as any) as any)
        .select('*')
        .eq('user_id', userId)
        .gte('date', startDate)
        .order('date', { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!userId,
  });

  const formatTime = (ts: string | null) => ts ? formatDate(new Date(ts), 'hh:mm a') : '--:--';

  const totalDays = monthlyRecords.length;
  const onTimeDays = monthlyRecords.filter((r: any) => r.status === 'present').length;
  const lateDays = monthlyRecords.filter((r: any) => r.status === 'late').length;
  const totalLateMin = monthlyRecords.reduce((s: number, r: any) => s + (r.late_minutes || 0), 0);
  const lunchViolations = monthlyRecords.filter((r: any) => (r.lunch_overtime_minutes || 0) > 0).length;
  const earlyLeaves = monthlyRecords.filter((r: any) => (r.early_leave_minutes || 0) > 0).length;

  // Overtime calculation
  const totalOvertimeMin = monthlyRecords.reduce((s: number, r: any) => s + (r.overtime_minutes || 0), 0);
  const overtimeHours = (totalOvertimeMin / 60).toFixed(1);
  const overtimeDays = monthlyRecords.filter((r: any) => (r.overtime_minutes || 0) > 0).length;

  let performance = 'Excellent';
  let performanceColor = 'text-green-600';
  let performanceEmoji = '🌟';
  let performanceKey: 'excellent' | 'good' | 'poor' = 'excellent';
  if (lateDays >= 6 || lunchViolations >= 4) { performance = 'Poor'; performanceColor = 'text-red-600'; performanceEmoji = '⚠️'; performanceKey = 'poor'; }
  else if (lateDays >= 1) { performance = 'Good'; performanceColor = 'text-yellow-600'; performanceEmoji = '⭐'; performanceKey = 'good'; }

  // Random motivational quote (stable per render)
  const motivationalQuote = useMemo(() => {
    const quotes = PERFORMANCE_QUOTES[performanceKey];
    return quotes[Math.floor(Math.random() * quotes.length)];
  }, [performanceKey, totalDays]);

  const todayStr = formatDate(new Date(), 'yyyy-MM-dd');
  const today = isSelf ? todayRecord : monthlyRecords.find((r: any) => r.date === todayStr);

  if (isLoading) return <div className="text-center py-10 text-muted-foreground">লোড হচ্ছে...</div>;

  return (
    <div className="space-y-4">
      {/* Off Day Banner */}
      {isSelf && isOffDay && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20 animate-fade-in">
          <CardContent className="p-4 text-center">
            <p className="text-lg font-bold text-green-600">🎉 আজ ছুটির দিন — {BENGALI_DAYS[offDay]}</p>
            <p className="text-sm text-muted-foreground">আজ আপনার সাপ্তাহিক ছুটি</p>
          </CardContent>
        </Card>
      )}
      {/* Action Buttons — only for own profile */}
      {isSelf && !isOffDay && (
        <Card className="overflow-hidden">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Button
                className="h-16 flex flex-col gap-1 transition-all duration-300 hover:scale-[1.03] hover:shadow-lg"
                variant={todayRecord?.check_in ? 'secondary' : 'default'}
                disabled={!!todayRecord?.check_in || attendanceAction.isPending}
                onClick={() => attendanceAction.mutate('check_in')}
              >
                <LogIn className="h-5 w-5" />
                <span className="text-xs">
                  {todayRecord?.check_in ? `✅ ${formatTime(todayRecord.check_in)}` : 'Present'}
                </span>
              </Button>
              <Button
                className="h-16 flex flex-col gap-1 transition-all duration-300 hover:scale-[1.03]"
                variant={todayRecord?.lunch_start ? 'secondary' : 'outline'}
                disabled={!todayRecord?.check_in || !!todayRecord?.lunch_start || attendanceAction.isPending}
                onClick={() => attendanceAction.mutate('lunch_start')}
              >
                <Coffee className="h-5 w-5" />
                <span className="text-xs">
                  {todayRecord?.lunch_start ? `🍽️ ${formatTime(todayRecord.lunch_start)}` : 'Lunch Start'}
                </span>
              </Button>
              <Button
                className="h-16 flex flex-col gap-1 transition-all duration-300 hover:scale-[1.03]"
                variant={todayRecord?.lunch_end ? 'secondary' : 'outline'}
                disabled={!todayRecord?.lunch_start || !!todayRecord?.lunch_end || attendanceAction.isPending}
                onClick={() => attendanceAction.mutate('lunch_end')}
              >
                <CoffeeIcon className="h-5 w-5" />
                <span className="text-xs">
                  {todayRecord?.lunch_end
                    ? `✅ ${todayRecord.lunch_duration_minutes}m`
                    : todayRecord?.lunch_start
                      ? lunchTimer || 'Lunch End'
                      : 'Lunch End'}
                </span>
              </Button>
              <Button
                className="h-16 flex flex-col gap-1 transition-all duration-300 hover:scale-[1.03]"
                variant={todayRecord?.check_out ? 'secondary' : 'destructive'}
                disabled={!todayRecord?.check_in || !!todayRecord?.check_out || attendanceAction.isPending}
                onClick={() => attendanceAction.mutate('check_out')}
              >
                <LogOut className="h-5 w-5" />
                <span className="text-xs">
                  {todayRecord?.check_out ? `🏠 ${formatTime(todayRecord.check_out)}` : 'End Duty'}
                </span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      {/* Today's Status */}
      {today && (
        <Card className="animate-fade-in">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" /> আজকের স্ট্যাটাস
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="p-3 rounded-lg bg-muted/50 transition-all duration-300 hover:shadow-md hover:scale-[1.02]">
                <p className="text-xs text-muted-foreground">চেক-ইন</p>
                <p className="text-sm font-bold">{formatTime(today.check_in)}</p>
                {today.status === 'late' && <Badge variant="destructive" className="text-[10px] mt-1">লেট {today.late_minutes}m</Badge>}
                {today.status === 'present' && <Badge className="bg-green-600 text-white text-[10px] mt-1">সময়মতো</Badge>}
              </div>
              <div className="p-3 rounded-lg bg-muted/50 transition-all duration-300 hover:shadow-md hover:scale-[1.02]">
                <p className="text-xs text-muted-foreground">লাঞ্চ</p>
                <p className="text-sm font-bold">{today.lunch_duration_minutes ? `${today.lunch_duration_minutes} মিনিট` : '--'}</p>
                {today.lunch_overtime_minutes > 0 && <Badge variant="destructive" className="text-[10px] mt-1">{today.lunch_overtime_minutes}m অতিরিক্ত</Badge>}
              </div>
              <div className="p-3 rounded-lg bg-muted/50 transition-all duration-300 hover:shadow-md hover:scale-[1.02]">
                <p className="text-xs text-muted-foreground">চেক-আউট</p>
                <p className="text-sm font-bold">{formatTime(today.check_out)}</p>
                {today.early_leave_minutes > 0 && <Badge variant="outline" className="text-[10px] mt-1">{today.early_leave_minutes}m আগে</Badge>}
              </div>
              <div className="p-3 rounded-lg bg-muted/50 transition-all duration-300 hover:shadow-md hover:scale-[1.02]">
                <p className="text-xs text-muted-foreground">মোট কাজ</p>
                <p className="text-sm font-bold">{today.total_working_hours ? `${today.total_working_hours} ঘণ্টা` : '--'}</p>
              </div>
              {/* Overtime today */}
              {(today.overtime_minutes || 0) > 0 && (
                <div className="p-3 rounded-lg bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 border border-amber-200/50 transition-all duration-300 hover:shadow-md hover:scale-[1.02]">
                  <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1"><Timer className="h-3 w-3" /> ওভারটাইম</p>
                  <p className="text-sm font-bold text-amber-700 dark:text-amber-300">{today.overtime_minutes} মিনিট</p>
                  <Badge className="bg-amber-500 text-white text-[10px] mt-1 badge-shimmer">⏰ অতিরিক্ত</Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Monthly Summary */}
      <Card className="animate-fade-in">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4" /> মাসিক রিপোর্ট — {formatDate(new Date(), 'MMMM yyyy', { locale: bn })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
            {[
              { value: totalDays, label: 'কার্যদিবস', bg: 'bg-blue-50 dark:bg-blue-950/20', color: 'text-blue-600' },
              { value: onTimeDays, label: 'সময়মতো', bg: 'bg-green-50 dark:bg-green-950/20', color: 'text-green-600' },
              { value: lateDays, label: 'লেট', bg: 'bg-red-50 dark:bg-red-950/20', color: 'text-red-600' },
              { value: totalLateMin, label: 'লেট (মিনিট)', bg: 'bg-orange-50 dark:bg-orange-950/20', color: 'text-orange-600' },
              { value: lunchViolations, label: 'লাঞ্চ ভায়োলেশন', bg: 'bg-purple-50 dark:bg-purple-950/20', color: 'text-purple-600' },
              { value: earlyLeaves, label: 'আর্লি লিভ', bg: 'bg-yellow-50 dark:bg-yellow-950/20', color: 'text-yellow-600' },
              { value: overtimeDays, label: 'ওভারটাইম দিন', bg: 'bg-amber-50 dark:bg-amber-950/20', color: 'text-amber-600' },
              { value: `${overtimeHours}h`, label: 'মোট ওভারটাইম', bg: 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20', color: 'text-amber-700 dark:text-amber-400' },
            ].map((item, i) => (
              <div key={i} className={`text-center p-3 rounded-lg ${item.bg} transition-all duration-500 hover:shadow-md hover:scale-[1.03]`} style={{ animationDelay: `${i * 80}ms` }}>
                <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
                <p className="text-[10px] text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>

          {/* Performance Badge */}
          <div className="mt-4 flex items-center justify-center gap-2 p-3 rounded-lg bg-muted/50">
            <Award className={`h-6 w-6 ${performanceColor} ${performanceKey === 'excellent' ? 'animate-float-slow' : ''}`} />
            <span className={`font-bold ${performanceColor} ${performanceKey === 'excellent' ? 'text-shimmer' : ''}`}>
              {performanceEmoji} {performance}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Overtime Bonus Incentive Banner */}
      {totalOvertimeMin > 0 && (
        <Card className="overflow-hidden border-amber-200/60 dark:border-amber-800/40 animate-fade-in">
          <div className="relative bg-gradient-to-r from-amber-50 via-orange-50 to-yellow-50 dark:from-amber-950/30 dark:via-orange-950/20 dark:to-yellow-950/20 p-5">
            {/* Sparkle effects */}
            <div className="absolute top-2 right-4 animate-float-slow"><Sparkles className="h-5 w-5 text-amber-400/60" /></div>
            <div className="absolute bottom-3 right-12 animate-float-slow" style={{ animationDelay: '1s' }}><Sparkles className="h-4 w-4 text-yellow-400/50" /></div>
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0 shadow-lg animate-glow-pulse-btn">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-amber-800 dark:text-amber-300 text-sm">
                  🌟 এই মাসে আপনি {overtimeHours} ঘণ্টা ওভারটাইম করেছেন!
                </h3>
                <p className="text-xs text-amber-700/80 dark:text-amber-400/70 mt-1">
                  {overtimeDays} দিন ডিউটি টাইমের পরেও কাজ করেছেন — বোনাসের জন্য যোগ্য হতে পারেন! 🎉
                </p>
                {isSelf && (
                  <p className="text-[10px] text-amber-600/60 dark:text-amber-500/50 mt-2 italic">
                    ওভারটাইম বোনাস সম্পূর্ণভাবে কর্তৃপক্ষের সিদ্ধান্তের উপর নির্ভরশীল
                  </p>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Motivational Quote */}
      {totalDays > 0 && (
        <div className="text-center py-3 px-4 rounded-lg bg-muted/30 border border-dashed border-muted-foreground/20 animate-fade-in">
          <p className="text-sm text-muted-foreground italic leading-relaxed">{motivationalQuote}</p>
        </div>
      )}

      {/* Recent Records */}
      {monthlyRecords.length > 0 && (
        <Card className="animate-fade-in">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">সাম্প্রতিক রেকর্ড</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>তারিখ</TableHead>
                  <TableHead>স্ট্যাটাস</TableHead>
                  <TableHead>চেক-ইন</TableHead>
                  <TableHead>চেক-আউট</TableHead>
                  <TableHead>লেট</TableHead>
                  <TableHead>লাঞ্চ</TableHead>
                  <TableHead>কাজ</TableHead>
                  <TableHead>ওভারটাইম</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyRecords.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{formatDate(new Date(r.date + 'T00:00:00'), 'dd MMM', { locale: bn })}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === 'late' ? 'destructive' : 'default'} className="text-[10px]">
                        {r.status === 'late' ? 'লেট' : r.status === 'off_day' ? 'ছুটি' : 'সময়মতো'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{formatTime(r.check_in)}</TableCell>
                    <TableCell className="text-xs">{formatTime(r.check_out)}</TableCell>
                    <TableCell className="text-xs">{r.late_minutes > 0 ? `${r.late_minutes}m` : '-'}</TableCell>
                    <TableCell className="text-xs">{r.lunch_duration_minutes ? `${r.lunch_duration_minutes}m` : '-'}</TableCell>
                    <TableCell className="text-xs">{r.total_working_hours ? `${r.total_working_hours}h` : '-'}</TableCell>
                    <TableCell className="text-xs">
                      {(r.overtime_minutes || 0) > 0 ? (
                        <Badge className="bg-amber-500 text-white text-[10px]">+{r.overtime_minutes}m</Badge>
                      ) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {monthlyRecords.length === 0 && (
        <div className="text-center py-10 text-muted-foreground">এই মাসে কোনো রেকর্ড নেই</div>
      )}
    </div>
  );
}

export default function AdminEmployeeProfile() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { isAdmin } = usePermissions();
  const [currentUserId, setCurrentUserId] = useState('');
  const [activityFilter, setActivityFilter] = useState('all');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setCurrentUserId(session.user.id);
    });
  }, []);

  const isSelf = currentUserId === id;
  const canEdit = isSelf || isAdmin;
  const queryClient = useQueryClient();

  const { data: employee, refetch } = useQuery({
    queryKey: ['employee', id],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(FUNC_URL, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` },
      });
      const all = await res.json();
      return all.find((e: any) => e.user_id === id) || null;
    },
  });

  // Saved quotes
  const { data: savedQuotes = [] } = useQuery({
    queryKey: ['saved-quotes', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('employee_profiles' as any)
        .select('saved_quotes')
        .eq('user_id', id!)
        .maybeSingle();
      return ((data as any)?.saved_quotes || []) as QuoteType[];
    },
    enabled: !!id,
  });

  const handleSaveQuote = async (q: QuoteType) => {
    const updated = [...savedQuotes, q];
    await supabase
      .from('employee_profiles' as any)
      .update({ saved_quotes: updated })
      .eq('user_id', id!);
    queryClient.invalidateQueries({ queryKey: ['saved-quotes', id] });
  };

  const handleRemoveQuote = async (index: number) => {
    const updated = savedQuotes.filter((_, i) => i !== index);
    await supabase
      .from('employee_profiles' as any)
      .update({ saved_quotes: updated })
      .eq('user_id', id!);
    queryClient.invalidateQueries({ queryKey: ['saved-quotes', id] });
    toast.success('উক্তি মুছে ফেলা হয়েছে');
  };

  const { data: logs = [] } = useQuery({
    queryKey: ['activity-logs', id],
    queryFn: async () => {
      const PAGE = 1000;
      let offset = 0;
      const allLogs: any[] = [];
      while (true) {
        const { data, error } = await supabase
          .from('activity_logs' as any)
          .select('*')
          .eq('user_id', id)
          .order('created_at', { ascending: false })
          .range(offset, offset + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allLogs.push(...data);
        if (data.length < PAGE) break;
        offset += PAGE;
      }
      return allLogs.map(l => ({
        ...l,
        employee_name: employee?.full_name || employee?.email || '',
        employee_avatar: employee?.avatar_url || '',
      }));
    },
    enabled: !!employee,
  });

  const ACTION_LABELS: Record<string, string> = {
    order_status_change: 'অর্ডার প্রসেস',
    order_delete: 'অর্ডার ডিলিট',
    product_create: 'প্রোডাক্ট যোগ',
    product_edit: 'প্রোডাক্ট এডিট',
    product_delete: 'প্রোডাক্ট ডিলিট',
    category_create: 'ক্যাটেগরি তৈরি',
    category_edit: 'ক্যাটেগরি এডিট',
    category_delete: 'ক্যাটেগরি ডিলিট',
    coupon_create: 'কুপন তৈরি',
    settings_change: 'সেটিংস পরিবর্তন',
    chat_reply: 'কাস্টমার রিপ্লাই',
  };

  const now = new Date();
  const dailyData = Array.from({ length: 30 }, (_, i) => {
    const day = subDays(now, 29 - i);
    const dayStart = startOfDay(day);
    const dayEnd = new Date(dayStart.getTime() + 86400000);
    const count = logs.filter((l: any) => {
      const d = new Date(l.created_at);
      return d >= dayStart && d < dayEnd;
    }).length;
    return { label: format(day, 'dd/MM'), count };
  });

  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const month = subMonths(now, 5 - i);
    const mStart = startOfMonth(month);
    const mEnd = startOfMonth(subMonths(now, 4 - i));
    const count = logs.filter((l: any) => {
      const d = new Date(l.created_at);
      return d >= mStart && d < (i === 5 ? new Date() : mEnd);
    }).length;
    return { label: format(month, 'MMM yy'), count };
  });

  const actionBreakdown = logs.reduce((acc: Record<string, number>, l: any) => {
    acc[l.action_type] = (acc[l.action_type] || 0) + 1;
    return acc;
  }, {});

  const tabFromUrl = searchParams.get('tab');
  const defaultTab = tabFromUrl === 'notifications' ? 'notifications' : (canEdit ? 'settings' : 'activity');
  const [activeTab, setActiveTab] = useState(defaultTab);

  // Query unread notifications count
  const { data: unreadNotifCount = 0 } = useQuery({
    queryKey: ['unread-notif-count', id],
    queryFn: async () => {
      const { count } = await supabase
        .from('staff_notifications' as any)
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', id!)
        .eq('is_read', false);
      return count || 0;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 min — realtime updates via staff-notif channel
  });

  const navigate = useNavigate();

  if (!employee) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">লোড হচ্ছে...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/admin/employees')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm text-muted-foreground">কর্মচারীদের তালিকা</span>
      </div>
      <ProfileHeader employee={employee} onAvatarUpdated={() => refetch()} canEdit={canEdit} savedQuotes={savedQuotes} onSaveQuote={handleSaveQuote} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="attendance">উপস্থিতি</TabsTrigger>
          <TabsTrigger value="notifications" className="relative">
            বার্তা
            {unreadNotifCount > 0 && (
              <span className="ml-1.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {unreadNotifCount}
              </span>
            )}
          </TabsTrigger>
          {canEdit && <TabsTrigger value="settings">সেটিংস</TabsTrigger>}
        </TabsList>

        <TabsContent value="activity" className="space-y-6">
          {/* ... keep existing code */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold">{logs.length}</p>
                <p className="text-xs text-muted-foreground">মোট Activity</p>
              </CardContent>
            </Card>
            {Object.entries(actionBreakdown)
              .filter(([_, count]) => (count as number) > 0)
              .sort(([, a], [, b]) => (b as number) - (a as number))
              .map(([type, count]) => (
                <Card key={type}>
                  <CardContent className="pt-4 text-center">
                    <p className="text-2xl font-bold">{count as number}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {ACTION_LABELS[type] || type.replace(/_/g, ' ')}
                    </p>
                  </CardContent>
                </Card>
              ))}
          </div>

          <EmployeeActivityChart dailyData={dailyData} monthlyData={monthlyData} logs={logs} selectedDate={selectedDate} onDateChange={setSelectedDate} />

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">Activity Timeline</CardTitle>
              <Select value={activityFilter} onValueChange={setActivityFilter}>
                <SelectTrigger className="w-[180px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">সব Activity</SelectItem>
                  {Object.entries(actionBreakdown)
                    .filter(([_, count]) => (count as number) > 0)
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .map(([type]) => (
                      <SelectItem key={type} value={type}>
                        {ACTION_LABELS[type] || type.replace(/_/g, ' ')}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              <ActivityTimeline logs={activityFilter === 'all' ? logs : logs.filter((l: any) => l.action_type === activityFilter)} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance">
          <AttendanceTab userId={id!} isSelf={isSelf} />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationsTab userId={id!} isSelf={isSelf} />
        </TabsContent>

        {canEdit && (
          <TabsContent value="settings">
            <SettingsTab employee={employee} isSelf={isSelf} isAdmin={isAdmin} savedQuotes={savedQuotes} onRemoveQuote={handleRemoveQuote} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
