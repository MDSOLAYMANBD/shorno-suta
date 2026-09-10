import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTodayAttendance, useMonthlyAttendance, useAttendanceAction } from '@/hooks/useSelfAttendance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';
import { Clock, Coffee, LogIn, LogOut, AlertTriangle, CheckCircle2, Timer, TrendingUp, CalendarDays, Award } from 'lucide-react';

export default function StaffAttendance() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const { data: todayRes, isLoading } = useTodayAttendance();
  const { data: monthlyData } = useMonthlyAttendance();
  const action = useAttendanceAction();
  const today = todayRes?.data;

  // Lunch countdown
  const [lunchCountdown, setLunchCountdown] = useState<string | null>(null);

  useEffect(() => {
    setIsMobile(window.innerWidth < 1024);
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { navigate('/admin'); return; }
      // Get employee name from employee_profiles
      supabase.from('employee_profiles').select('full_name').eq('user_id', session.user.id).maybeSingle()
        .then(({ data }) => setUserName(data?.full_name || session.user.email || 'Employee'));
    });
  }, [navigate]);

  // Lunch timer
  useEffect(() => {
    if (!today?.lunch_start || today?.lunch_end) { setLunchCountdown(null); return; }
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - new Date(today.lunch_start).getTime()) / 1000);
      const remaining = 60 * 60 - elapsed;
      if (remaining <= 0) {
        const over = Math.abs(remaining);
        setLunchCountdown(`-${Math.floor(over / 60)}:${String(over % 60).padStart(2, '0')} অতিরিক্ত`);
      } else {
        setLunchCountdown(`${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [today?.lunch_start, today?.lunch_end]);

  if (isMobile) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-background">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">শুধুমাত্র PC থেকে ব্যবহারযোগ্য</h2>
            <p className="text-muted-foreground">Smart Office Attendance System শুধুমাত্র ডেস্কটপ/ল্যাপটপ থেকে অ্যাক্সেস করা যায়।</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Monthly stats
  const records = monthlyData || [];
  const totalDays = records.length;
  const lateDays = records.filter((r: any) => r.status === 'late').length;
  const onTimeDays = records.filter((r: any) => r.status === 'present').length;
  const totalLateMin = records.reduce((s: number, r: any) => s + (r.late_minutes || 0), 0);
  const lunchViolations = records.filter((r: any) => (r.lunch_overtime_minutes || 0) > 0).length;
  const earlyLeaves = records.filter((r: any) => (r.early_leave_minutes || 0) > 0).length;

  let performance = 'Excellent';
  let performanceColor = 'text-green-600';
  let performanceEmoji = '🌟';
  if (lateDays >= 6 || lunchViolations >= 4) { performance = 'Poor'; performanceColor = 'text-red-600'; performanceEmoji = '⚠️'; }
  else if (lateDays >= 1) { performance = 'Good'; performanceColor = 'text-yellow-600'; performanceEmoji = '⭐'; }

  const formatTime = (ts: string | null) => ts ? format(new Date(ts), 'hh:mm a') : '--:--';

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-card border-b">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">🏢 Smart Office Attendance</h1>
            <p className="text-muted-foreground mt-1">
              👤 {userName} &nbsp;|&nbsp; 📅 {format(new Date(), 'dd MMMM yyyy, EEEE', { locale: bn })}
            </p>
          </div>
          <div>
            {today?.check_in ? (
              today.status === 'late' ? (
                <Badge variant="destructive" className="text-sm px-3 py-1">
                  ⏰ লেট — {today.late_minutes} মিনিট
                </Badge>
              ) : (
                <Badge className="bg-green-600 text-white text-sm px-3 py-1">
                  ✅ সময়মতো উপস্থিত
                </Badge>
              )
            ) : (
              <Badge variant="outline" className="text-sm px-3 py-1">
                ⏳ চেক-ইন করুন
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {/* Action Buttons */}
        <div className="grid grid-cols-4 gap-4">
          <Card className={`${today?.check_in ? 'border-green-500/50 bg-green-50 dark:bg-green-950/20' : ''}`}>
            <CardContent className="pt-6 text-center">
              <LogIn className={`h-10 w-10 mx-auto mb-3 ${today?.check_in ? 'text-green-600' : 'text-primary'}`} />
              <h3 className="font-semibold mb-3">Present</h3>
              <Button
                className="w-full"
                disabled={!!today?.check_in || action.isPending}
                onClick={() => action.mutate('check_in')}
                variant={today?.check_in ? 'outline' : 'default'}
              >
                {today?.check_in ? `✅ ${formatTime(today.check_in)}` : 'চেক-ইন'}
              </Button>
            </CardContent>
          </Card>

          <Card className={`${today?.lunch_start && !today?.lunch_end ? 'border-orange-500/50 bg-orange-50 dark:bg-orange-950/20' : ''}`}>
            <CardContent className="pt-6 text-center">
              <Coffee className={`h-10 w-10 mx-auto mb-3 ${today?.lunch_start ? 'text-orange-600' : 'text-muted-foreground'}`} />
              <h3 className="font-semibold mb-3">Lunch Start</h3>
              <Button
                className="w-full"
                variant="outline"
                disabled={!today?.check_in || !!today?.lunch_start || action.isPending}
                onClick={() => action.mutate('lunch_start')}
              >
                {today?.lunch_start ? `🍽️ ${formatTime(today.lunch_start)}` : 'শুরু করুন'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 text-center">
              <Timer className={`h-10 w-10 mx-auto mb-3 ${today?.lunch_end ? 'text-green-600' : 'text-muted-foreground'}`} />
              <h3 className="font-semibold mb-3">Lunch End</h3>
              {lunchCountdown && !today?.lunch_end && (
                <p className={`text-lg font-mono font-bold mb-2 ${lunchCountdown.startsWith('-') ? 'text-red-600' : 'text-orange-600'}`}>
                  {lunchCountdown}
                </p>
              )}
              <Button
                className="w-full"
                variant="outline"
                disabled={!today?.lunch_start || !!today?.lunch_end || action.isPending}
                onClick={() => action.mutate('lunch_end')}
              >
                {today?.lunch_end ? `✅ ${formatTime(today.lunch_end)}` : 'শেষ করুন'}
              </Button>
            </CardContent>
          </Card>

          <Card className={`${today?.check_out ? 'border-blue-500/50 bg-blue-50 dark:bg-blue-950/20' : ''}`}>
            <CardContent className="pt-6 text-center">
              <LogOut className={`h-10 w-10 mx-auto mb-3 ${today?.check_out ? 'text-blue-600' : 'text-muted-foreground'}`} />
              <h3 className="font-semibold mb-3">End Duty</h3>
              <Button
                className="w-full"
                variant={today?.check_out ? 'outline' : 'destructive'}
                disabled={!today?.check_in || !!today?.check_out || action.isPending}
                onClick={() => action.mutate('check_out')}
              >
                {today?.check_out ? `🏁 ${formatTime(today.check_out)}` : 'ডিউটি শেষ'}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Today's Summary */}
        {today?.check_in && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5" /> আজকের সারাংশ
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">চেক-ইন</p>
                  <p className="text-lg font-bold">{formatTime(today.check_in)}</p>
                  {today.late_minutes > 0 && <p className="text-xs text-red-600">{today.late_minutes} মিনিট লেট</p>}
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">লাঞ্চ</p>
                  <p className="text-lg font-bold">
                    {today.lunch_duration_minutes ? `${today.lunch_duration_minutes} মিনিট` : '--'}
                  </p>
                  {today.lunch_overtime_minutes > 0 && <p className="text-xs text-red-600">{today.lunch_overtime_minutes} মিনিট অতিরিক্ত</p>}
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">চেক-আউট</p>
                  <p className="text-lg font-bold">{formatTime(today.check_out)}</p>
                  {today.early_leave_minutes > 0 && <p className="text-xs text-yellow-600">{today.early_leave_minutes} মিনিট আগে</p>}
                  {today.overtime_minutes > 0 && <p className="text-xs text-green-600">{today.overtime_minutes} মিনিট ওভারটাইম</p>}
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">মোট কাজ</p>
                  <p className="text-lg font-bold">{today.total_working_hours ? `${today.total_working_hours} ঘণ্টা` : '--'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Monthly Report */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarDays className="h-5 w-5" /> মাসিক রিপোর্ট — {format(new Date(), 'MMMM yyyy', { locale: bn })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="text-center p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                <p className="text-2xl font-bold text-blue-600">{totalDays}</p>
                <p className="text-xs text-muted-foreground mt-1">কার্যদিবস</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-950/20">
                <p className="text-2xl font-bold text-green-600">{onTimeDays}</p>
                <p className="text-xs text-muted-foreground mt-1">সময়মতো</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-red-50 dark:bg-red-950/20">
                <p className="text-2xl font-bold text-red-600">{lateDays}</p>
                <p className="text-xs text-muted-foreground mt-1">লেট</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-orange-50 dark:bg-orange-950/20">
                <p className="text-2xl font-bold text-orange-600">{totalLateMin}</p>
                <p className="text-xs text-muted-foreground mt-1">মোট লেট (মিনিট)</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-purple-50 dark:bg-purple-950/20">
                <p className="text-2xl font-bold text-purple-600">{lunchViolations}</p>
                <p className="text-xs text-muted-foreground mt-1">লাঞ্চ ভায়োলেশন</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-yellow-50 dark:bg-yellow-950/20">
                <p className="text-2xl font-bold text-yellow-600">{earlyLeaves}</p>
                <p className="text-xs text-muted-foreground mt-1">আর্লি লিভ</p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-center gap-3 p-4 rounded-lg bg-muted/50">
              <Award className={`h-8 w-8 ${performanceColor}`} />
              <div className="text-center">
                <p className="text-sm text-muted-foreground">পারফরম্যান্স স্ট্যাটাস</p>
                <p className={`text-xl font-bold ${performanceColor}`}>
                  {performanceEmoji} {performance}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent records table */}
        {records.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">সাম্প্রতিক রেকর্ড</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 px-3">তারিখ</th>
                      <th className="text-left py-2 px-3">স্ট্যাটাস</th>
                      <th className="text-left py-2 px-3">চেক-ইন</th>
                      <th className="text-left py-2 px-3">চেক-আউট</th>
                      <th className="text-left py-2 px-3">লেট</th>
                      <th className="text-left py-2 px-3">লাঞ্চ</th>
                      <th className="text-left py-2 px-3">কাজ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r: any) => (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="py-2 px-3">{format(new Date(r.date + 'T00:00:00'), 'dd MMM', { locale: bn })}</td>
                        <td className="py-2 px-3">
                          <Badge variant={r.status === 'late' ? 'destructive' : 'default'} className="text-xs">
                            {r.status === 'late' ? 'লেট' : 'সময়মতো'}
                          </Badge>
                        </td>
                        <td className="py-2 px-3">{formatTime(r.check_in)}</td>
                        <td className="py-2 px-3">{formatTime(r.check_out)}</td>
                        <td className="py-2 px-3">{r.late_minutes > 0 ? `${r.late_minutes}m` : '-'}</td>
                        <td className="py-2 px-3">{r.lunch_duration_minutes ? `${r.lunch_duration_minutes}m` : '-'}</td>
                        <td className="py-2 px-3">{r.total_working_hours ? `${r.total_working_hours}h` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
