import { useState } from 'react';
import { useAttendance, useMarkAttendance } from '@/hooks/useAttendance';
import { usePersons } from '@/hooks/usePersons';
import { useUnits } from '@/hooks/useAccounting';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';
import { CalendarIcon, Check, X, Clock, Coffee } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  present: { label: 'উপস্থিত', color: 'bg-green-100 text-green-700 border-green-300', icon: Check },
  absent: { label: 'অনুপস্থিত', color: 'bg-red-100 text-red-700 border-red-300', icon: X },
  late: { label: 'লেট', color: 'bg-yellow-100 text-yellow-700 border-yellow-300', icon: Clock },
  off_day: { label: 'ছুটি', color: 'bg-blue-100 text-blue-700 border-blue-300', icon: Coffee },
};

export default function AdminAttendance() {
  const [date, setDate] = useState<Date>(new Date());
  const [unitFilter, setUnitFilter] = useState<string>('');
  const dateStr = format(date, 'yyyy-MM-dd');
  const { data: attendance = [], isLoading } = useAttendance(date, unitFilter || undefined);
  const { data: allPersons = [] } = usePersons();
  const persons = allPersons.filter(p => p.type === 'employee' || p.type === 'salaried_production');
  const { data: units = [] } = useUnits();
  const markAttendance = useMarkAttendance();

  // Get employees who don't have attendance for this date yet
  const attendedIds = new Set(attendance.map(a => a.person_id));
  const filteredPersons = persons.filter(p => {
    if (unitFilter && p.unit_id !== unitFilter) return false;
    return true;
  });

  const handleMark = async (personId: string, status: string) => {
    try {
      await markAttendance.mutateAsync({
        person_id: personId,
        date: dateStr,
        status,
        check_in: status === 'present' || status === 'late' ? new Date().toISOString() : undefined,
      });
      toast.success('আপডেট হয়েছে');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/admin/accounting')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">উপস্থিতি</h1>
            <p className="text-sm text-muted-foreground">{format(date, 'dd MMMM yyyy, EEEE', { locale: bn })}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <CalendarIcon className="h-4 w-4 mr-1" />
                {format(date, 'dd MMM', { locale: bn })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="single" selected={date} onSelect={d => d && setDate(d)} locale={bn} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <Select value={unitFilter || 'all'} onValueChange={v => setUnitFilter(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-[130px]"><SelectValue placeholder="সব ইউনিট" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">সব ইউনিট</SelectItem>
              {units.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">লোড হচ্ছে...</div>
      ) : (
        <div className="space-y-2">
          {filteredPersons.map(person => {
            const record = attendance.find(a => a.person_id === person.id);
            const currentStatus = record?.status || null;

            return (
              <Card key={person.id}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">{person.name}</div>
                      <div className="text-xs text-muted-foreground">{person.acc_units?.name || '—'}</div>
                    </div>
                    <div className="flex gap-1">
                      {Object.entries(statusConfig).map(([key, cfg]) => {
                        const Icon = cfg.icon;
                        return (
                          <Button
                            key={key}
                            variant="outline"
                            size="sm"
                            className={cn(
                              'h-8 w-8 p-0 border',
                              currentStatus === key ? cfg.color : 'text-muted-foreground'
                            )}
                            onClick={() => handleMark(person.id, key)}
                            disabled={markAttendance.isPending}
                          >
                            <Icon className="h-4 w-4" />
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                  {record?.check_in && (
                    <div className="text-[10px] text-muted-foreground mt-1">
                      ইন: {format(new Date(record.check_in), 'hh:mm a')}
                      {record.check_out && <span> · আউট: {format(new Date(record.check_out), 'hh:mm a')}</span>}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {filteredPersons.length === 0 && <div className="text-center py-10 text-muted-foreground">কোনো কর্মচারী নেই</div>}
        </div>
      )}

      {/* Summary */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">সারাংশ</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-4 text-sm">
            <span className="text-green-600 font-medium">✓ {attendance.filter(a => a.status === 'present').length} উপস্থিত</span>
            <span className="text-red-600 font-medium">✗ {attendance.filter(a => a.status === 'absent').length} অনুপস্থিত</span>
            <span className="text-yellow-600 font-medium">⏰ {attendance.filter(a => a.status === 'late').length} লেট</span>
            <span className="text-blue-600 font-medium">☕ {attendance.filter(a => a.status === 'off_day').length} ছুটি</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
