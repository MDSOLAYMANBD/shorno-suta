import { useState, useMemo } from 'react';
import { useAccActivityLogs, useRestoreEntry, type AccActivityLog } from '@/hooks/useAccActivityLog';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ArrowLeft, RotateCcw, Plus, Pencil, Trash2, History, ChevronDown, ArrowRight, XCircle, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';
import { toast } from 'sonner';

const entityTypeLabel: Record<string, string> = {
  transaction: 'লেনদেন', person: 'ব্যক্তি', material: 'ম্যাটেরিয়াল',
  fixed_expense: 'নিয়মিত খরচ', custom_expense: 'কাস্টম খরচ',
  work_order: 'ওয়ার্ক অর্ডার', work_order_entry: 'ওয়ার্ক এন্ট্রি',
  party_entry: 'পার্টি এন্ট্রি', production_entry: 'প্রোডাকশন এন্ট্রি',
  attendance: 'উপস্থিতি', salary: 'বেতন', unit: 'ইউনিট',
};

const actionLabel: Record<string, { text: string; icon: React.ReactNode; color: string }> = {
  create: { text: 'তৈরি', icon: <Plus className="h-3.5 w-3.5" />, color: 'text-green-600 bg-green-50 dark:bg-green-950/30' },
  update: { text: 'এডিট', icon: <Pencil className="h-3.5 w-3.5" />, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30' },
  delete: { text: 'ডিলিট', icon: <Trash2 className="h-3.5 w-3.5" />, color: 'text-red-600 bg-red-50 dark:bg-red-950/30' },
  restore: { text: 'রিস্টোর', icon: <RotateCcw className="h-3.5 w-3.5" />, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30' },
  settlement: { text: 'হিসাব বন্ধ', icon: <XCircle className="h-3.5 w-3.5" />, color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/30' },
  settlement_update: { text: 'হিসাব বন্ধ এডিট', icon: <Pencil className="h-3.5 w-3.5" />, color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/30' },
  settlement_rejoin: { text: 'পুনরায় যোগদান', icon: <UserPlus className="h-3.5 w-3.5" />, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30' },
};

const fieldLabelMap: Record<string, string> = {
  amount: 'পরিমাণ',
  source: 'সোর্স',
  description: 'বিবরণ',
  unit_name: 'ইউনিট',
  person_name: 'ব্যক্তি',
};

const sourceLabel: Record<string, string> = { cash: 'ক্যাশ', bank: 'ব্যাংক', sale: 'সেল' };

function formatDiffValue(key: string, val: any): string {
  if (val === null || val === undefined || val === '') return '—';
  if (key === 'amount') return `৳${Number(val).toLocaleString('bn-BD')}`;
  if (key === 'source') return sourceLabel[val] || val;
  return String(val);
}

function DiffSection({ oldData, newData }: { oldData: Record<string, any>; newData: Record<string, any> }) {
  const diffKeys = Object.keys(fieldLabelMap).filter(key => {
    const o = oldData?.[key] ?? '';
    const n = newData?.[key] ?? '';
    return String(o) !== String(n);
  });

  if (diffKeys.length === 0) return null;

  return (
    <div className="mt-1.5 space-y-0.5 text-[11px]">
      {diffKeys.map(key => (
        <div key={key} className="flex items-center gap-1.5 flex-wrap">
          <span className="text-muted-foreground font-medium">{fieldLabelMap[key]}:</span>
          <span className="text-destructive line-through">{formatDiffValue(key, oldData?.[key])}</span>
          <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-green-600 dark:text-green-400 font-medium">{formatDiffValue(key, newData?.[key])}</span>
        </div>
      ))}
    </div>
  );
}

export default function AdminAccActivityLog() {
  const navigate = useNavigate();
  const [entityFilter, setEntityFilter] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('');
  const [restoreTarget, setRestoreTarget] = useState<AccActivityLog | null>(null);

  const { data: logs = [], isLoading } = useAccActivityLogs({
    entity_type: entityFilter || undefined,
    action: actionFilter || undefined,
    limit: 500,
  });

  const restoreEntry = useRestoreEntry();

  const { data: staffMap = {} } = useQuery({
    queryKey: ['employee-profiles-map'],
    queryFn: async () => {
      const { data } = await supabase.from('employee_profiles').select('user_id, full_name');
      const map: Record<string, string> = {};
      (data || []).forEach((p: any) => { map[p.user_id] = p.full_name; });
      return map;
    },
  });

  const grouped = useMemo(() => {
    const groups = new Map<string, AccActivityLog[]>();
    for (const log of logs) {
      const d = format(new Date(log.created_at), 'yyyy-MM-dd');
      if (!groups.has(d)) groups.set(d, []);
      groups.get(d)!.push(log);
    }
    return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [logs]);

  const handleRestore = async () => {
    if (!restoreTarget) return;
    try {
      await restoreEntry.mutateAsync(restoreTarget);
      toast.success('সফলভাবে রিস্টোর হয়েছে');
      setRestoreTarget(null);
    } catch (e: any) {
      toast.error(e.message || 'রিস্টোর করতে সমস্যা হয়েছে');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/admin/accounting')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-bold flex items-center gap-2"><History className="h-5 w-5" /> অ্যাক্টিভিটি লগ</h1>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Select value={entityFilter} onValueChange={v => setEntityFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[150px] h-8 text-xs">
            <SelectValue placeholder="সব ধরন" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">সব ধরন</SelectItem>
            {Object.entries(entityTypeLabel).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={actionFilter} onValueChange={v => setActionFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[170px] h-8 text-xs">
            <SelectValue placeholder="এডিট/ডিলিট/রিস্টোর" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">এডিট/ডিলিট/রিস্টোর</SelectItem>
            <SelectItem value="update">শুধু এডিট</SelectItem>
            <SelectItem value="delete">শুধু ডিলিট</SelectItem>
            <SelectItem value="restore">শুধু রিস্টোর</SelectItem>
            <SelectItem value="create">শুধু তৈরি (সব লেনদেন)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <p className="text-[10px] text-muted-foreground -mt-1">
        ডিফল্টে নতুন লেনদেন তৈরি (routine sale/expense) বাদে সব দেখানো হয় — "শুধু তৈরি" বেছে নিলে উত্তোলনসহ প্রতিটি নতুন লেনদেন দেখা যাবে।
      </p>

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground text-sm">লোড হচ্ছে...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">কোনো অ্যাক্টিভিটি পাওয়া যায়নি</div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([date, items]) => (
            <div key={date}>
              <div className="text-xs font-semibold text-muted-foreground mb-2 sticky top-0 bg-background py-1">
                {format(new Date(date), 'dd MMMM yyyy', { locale: bn })}
              </div>
              <div className="space-y-1.5">
                {items.map(log => {
                  const act = actionLabel[log.action] || { text: log.action, icon: <History className="h-3.5 w-3.5" />, color: 'text-muted-foreground bg-muted' };
                  const hasChanges = log.action === 'update' && log.old_data && log.new_data && Object.keys(log.old_data).length > 0;
                  const contextName = log.new_data?.person_name || log.old_data?.person_name;
                  const contextUnit = log.new_data?.unit_name || log.old_data?.unit_name;

                  const cardContent = (
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${act.color}`}>
                            {act.icon} {act.text}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                                {entityTypeLabel[log.entity_type] || log.entity_type}
                              </span>
                              {log.entity_name && (
                                <span className="text-xs font-semibold truncate">{log.entity_name}</span>
                              )}
                              {contextName && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 font-medium">👤 {contextName}</span>
                              )}
                              {contextUnit && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400 font-medium">🏢 {contextUnit}</span>
                              )}
                              {hasChanges && (
                                <ChevronDown className="h-3 w-3 text-muted-foreground transition-transform duration-200 [&[data-state=open]]:rotate-180" />
                              )}
                            </div>
                            {log.description && (
                              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{log.description}</p>
                            )}
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                              <span>{format(new Date(log.created_at), 'hh:mm a')}</span>
                              {log.user_id && staffMap[log.user_id] && (
                                <span>• {staffMap[log.user_id]}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        {log.action === 'delete' && log.old_data && Object.keys(log.old_data).length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs shrink-0"
                            onClick={(e) => { e.stopPropagation(); setRestoreTarget(log); }}
                          >
                            <RotateCcw className="h-3 w-3 mr-1" /> রিস্টোর
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  );

                  if (hasChanges) {
                    return (
                      <Collapsible key={log.id}>
                        <Card className="overflow-hidden">
                          <CollapsibleTrigger asChild>
                            <div className="cursor-pointer">{cardContent}</div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="px-3 pb-3 pt-0 border-t border-border/50">
                              <DiffSection oldData={log.old_data} newData={log.new_data} />
                            </div>
                          </CollapsibleContent>
                        </Card>
                      </Collapsible>
                    );
                  }

                  return (
                    <Card key={log.id} className="overflow-hidden">
                      {cardContent}
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!restoreTarget} onOpenChange={o => !o && setRestoreTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>রিস্টোর করবেন?</AlertDialogTitle>
            <AlertDialogDescription>
              "{restoreTarget?.entity_name}" — এই আইটেমটি আগের অবস্থায় ফিরিয়ে আনা হবে।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>বাতিল</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore} disabled={restoreEntry.isPending}>
              {restoreEntry.isPending ? 'রিস্টোর হচ্ছে...' : 'হ্যাঁ, রিস্টোর করুন'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
