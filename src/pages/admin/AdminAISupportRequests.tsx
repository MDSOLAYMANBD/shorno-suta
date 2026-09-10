import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Phone, MessageSquare, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import SEOHead from '@/components/SEOHead';

interface SupportRequest {
  id: string;
  session_id: string | null;
  visitor_name: string;
  visitor_phone: string;
  last_message: string | null;
  status: string;
  created_at: string;
  resolved_at: string | null;
}

export default function AdminAISupportRequests() {
  const [items, setItems] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('ai_support_requests').select('*').order('created_at', { ascending: false }).limit(200);
    if (error) toast.error(error.message);
    else setItems((data || []) as any);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel('ai-support').on('postgres_changes', { event: '*', schema: 'public', table: 'ai_support_requests' }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const updateStatus = async (id: string, status: string) => {
    const patch: any = { status };
    if (status === 'resolved') patch.resolved_at = new Date().toISOString();
    const { error } = await supabase.from('ai_support_requests').update(patch).eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('আপডেট হয়েছে'); load(); }
  };

  const getBadge = (s: string) => {
    if (s === 'pending') return <Badge variant="destructive">নতুন</Badge>;
    if (s === 'contacted') return <Badge>যোগাযোগ হয়েছে</Badge>;
    return <Badge variant="secondary">সমাধান</Badge>;
  };

  return (
    <div className="container py-6 space-y-6">
      <SEOHead title="হিউম্যান সাপোর্ট রিকোয়েস্ট | অ্যাডমিন" description="ভিজিটরদের 'Talk to Human' কলব্যাক রিকোয়েস্ট" />
      <div className="flex items-center gap-2">
        <MessageSquare className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">হিউম্যান সাপোর্ট রিকোয়েস্ট</h1>
      </div>

      <Card>
        <CardHeader><CardTitle>সব রিকোয়েস্ট</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="text-center py-6"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div> : (
            <Table>
              <TableHeader><TableRow><TableHead>ভিজিটর</TableHead><TableHead>ফোন</TableHead><TableHead>শেষ মেসেজ</TableHead><TableHead>সময়</TableHead><TableHead>স্ট্যাটাস</TableHead><TableHead>অ্যাকশন</TableHead></TableRow></TableHeader>
              <TableBody>
                {items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="font-medium">{it.visitor_name || '—'}</TableCell>
                    <TableCell><a href={`tel:${it.visitor_phone}`} className="text-primary flex items-center gap-1"><Phone className="h-3 w-3" />{it.visitor_phone || '—'}</a></TableCell>
                    <TableCell className="max-w-sm truncate text-sm text-muted-foreground">{it.last_message || '—'}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{new Date(it.created_at).toLocaleString('bn-BD')}</TableCell>
                    <TableCell>{getBadge(it.status)}</TableCell>
                    <TableCell className="space-x-1 whitespace-nowrap">
                      {it.session_id && <Button size="sm" variant="outline" asChild><Link to={`/admin/live-chat?session=${it.session_id}`}>চ্যাট</Link></Button>}
                      {it.status === 'pending' && <Button size="sm" variant="outline" onClick={() => updateStatus(it.id, 'contacted')}>Contacted</Button>}
                      {it.status !== 'resolved' && <Button size="sm" onClick={() => updateStatus(it.id, 'resolved')}><CheckCircle2 className="h-3 w-3 mr-1" />Resolved</Button>}
                    </TableCell>
                  </TableRow>
                ))}
                {items.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">কোনো রিকোয়েস্ট নেই</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
