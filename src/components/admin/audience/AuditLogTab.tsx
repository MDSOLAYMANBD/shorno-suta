// Phase 5 — Audit log viewer for CRM/Audience actions.

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { AuditLogRow } from '@/lib/audience/audit';

const ACTIONS = [
  'audience_created', 'audience_edited', 'audience_deleted',
  'audience_duplicated', 'audience_favorited',
  'sms_sent', 'sms_dry_run', 'campaign_cancelled',
];

export default function AuditLogTab() {
  const [action, setAction] = useState<string>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const { data = [], isLoading } = useQuery({
    queryKey: ['crm-audit-logs', action, fromDate, toDate],
    queryFn: async (): Promise<AuditLogRow[]> => {
      let q: any = (supabase.from('crm_audit_logs' as any) as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (action !== 'all') q = q.eq('action', action);
      if (fromDate) q = q.gte('created_at', new Date(fromDate).toISOString());
      if (toDate) q = q.lte('created_at', new Date(new Date(toDate).getTime() + 86399999).toISOString());
      const { data, error } = await q;
      if (error) throw error;
      return (data as any[]) as AuditLogRow[];
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger className="h-8 text-xs w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">সব অ্যাকশন</SelectItem>
            {ACTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" className="h-8 text-xs w-auto" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        <span className="text-xs text-muted-foreground">→</span>
        <Input type="date" className="h-8 text-xs w-auto" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        <Badge variant="secondary" className="text-[10px]">{data.length}</Badge>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>সময়</TableHead>
                  <TableHead>ব্যবহারকারী</TableHead>
                  <TableHead>অ্যাকশন</TableHead>
                  <TableHead>এন্টিটি</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>মেটাডেটা</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={6} className="text-center text-xs py-6">লোড হচ্ছে...</TableCell></TableRow>}
                {!isLoading && data.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs whitespace-nowrap">{format(new Date(l.created_at), 'dd MMM HH:mm:ss')}</TableCell>
                    <TableCell className="text-xs">{l.actor_email || l.actor_id || '—'}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{l.action}</Badge></TableCell>
                    <TableCell className="text-xs">{l.entity_type}{l.entity_id ? ` · ${l.entity_id.slice(0, 8)}` : ''}</TableCell>
                    <TableCell className="text-xs">{l.ip || '—'}</TableCell>
                    <TableCell className="text-[10px] max-w-xs truncate font-mono">{l.metadata && Object.keys(l.metadata).length ? JSON.stringify(l.metadata) : '—'}</TableCell>
                  </TableRow>
                ))}
                {!isLoading && data.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-8">কোনো লগ নেই</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
