import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { formatDistanceToNow, subDays, startOfDay } from 'date-fns';
import { Phone, MessageCircle, CheckCircle, AlertTriangle, TrendingUp, PhoneCall, X, Clock, Filter, StickyNote, Package, Eye, Mail, Search } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import AbandonedCheckoutEditor from '@/components/admin/AbandonedCheckoutEditor';
import { Input } from '@/components/ui/input';

type StatusTab = 'abandoned' | 'contacted' | 'recovered' | 'dismissed' | 'all';

const STATUS_TABS: { value: StatusTab; label: string; icon: any }[] = [
  { value: 'abandoned', label: 'অসম্পূর্ণ', icon: AlertTriangle },
  { value: 'contacted', label: 'যোগাযোগ হয়েছে', icon: PhoneCall },
  { value: 'recovered', label: 'রিকভার্ড', icon: CheckCircle },
  { value: 'dismissed', label: 'বাদ দেওয়া', icon: X },
  { value: 'all', label: 'সব', icon: Filter },
];

export default function AdminAbandonedCheckouts() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<StatusTab>('abandoned');
  const [timeFilter, setTimeFilter] = useState('all');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [editorCheckout, setEditorCheckout] = useState<any>(null);
  const [search, setSearch] = useState('');

  const bnToEnDigits = (s: string) => s.replace(/[০-৯]/g, d => String('০১২৩৪৫৬৭৮৯'.indexOf(d)));
  const normalizeBDPhone = (p: string) => {
    let n = bnToEnDigits(p).replace(/[\s\-\(\)]+/g, '');
    n = n.replace(/^\+?880/, '0');
    return n;
  };

  const { data: productsData } = useQuery({
    queryKey: ['products-image-map'],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('name, name_bn, images');
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const getItemImage = (item: any) => {
    if (item.image) return item.image;
    if (!productsData) return null;
    const match = productsData.find((p: any) =>
      p.name === item.name || p.name_bn === item.name ||
      p.name === item.name_bn || p.name_bn === item.name_bn
    );
    return match?.images?.[0] || null;
  };

  const { data: allCheckouts = [], isLoading } = useQuery({
    queryKey: ['admin-abandoned-checkouts', activeTab, timeFilter],
    queryFn: async () => {
      let query = supabase.from('abandoned_checkouts').select('*').order('created_at', { ascending: false });

      if (activeTab !== 'all') {
        query = query.eq('status', activeTab);
      }

      if (timeFilter === 'today') {
        query = query.gte('created_at', startOfDay(new Date()).toISOString());
      } else if (timeFilter === '7days') {
        query = query.gte('created_at', subDays(new Date(), 7).toISOString());
      } else if (timeFilter === '30days') {
        query = query.gte('created_at', subDays(new Date(), 30).toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['admin-abandoned-stats'],
    queryFn: async () => {
      const [abandoned, contacted, recovered, dismissed, total] = await Promise.all([
        supabase.from('abandoned_checkouts').select('*', { count: 'exact', head: true }).eq('status', 'abandoned'),
        supabase.from('abandoned_checkouts').select('*', { count: 'exact', head: true }).eq('status', 'contacted'),
        supabase.from('abandoned_checkouts').select('*', { count: 'exact', head: true }).eq('status', 'recovered'),
        supabase.from('abandoned_checkouts').select('*', { count: 'exact', head: true }).eq('status', 'dismissed'),
        supabase.from('abandoned_checkouts').select('*', { count: 'exact', head: true }),
      ]);
      return {
        abandoned: abandoned.count || 0,
        contacted: contacted.count || 0,
        recovered: recovered.count || 0,
        dismissed: dismissed.count || 0,
        total: total.count || 0,
      };
    },
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['admin-abandoned-checkouts'] });
    qc.invalidateQueries({ queryKey: ['admin-abandoned-stats'] });
    qc.invalidateQueries({ queryKey: ['abandoned-count'] });
  };

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: any = { status };
      if (status === 'recovered') updates.recovered_at = new Date().toISOString();
      const { error } = await supabase.from('abandoned_checkouts').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      invalidateAll();
      const msgs: Record<string, string> = {
        contacted: 'যোগাযোগ করা হয়েছে মার্ক করা হলো',
        recovered: 'রিকভার্ড মার্ক করা হলো',
        dismissed: 'ডিসমিস করা হলো',
      };
      toast.success(msgs[status] || 'আপডেট হয়েছে');
    },
  });

  const saveNote = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await supabase.from('abandoned_checkouts').update({ notes } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      setEditingNoteId(null);
      toast.success('নোট সেভ হয়েছে');
    },
  });

  const recoveryRate = stats && stats.total > 0 ? Math.round((stats.recovered / stats.total) * 100) : 0;

  const getWhatsAppUrl = (c: any) => {
    const phone = (c.customer_phone || '').replace(/[^0-9]/g, '');
    const items = (c.cart_data || []).map((item: any) => item.name || item.name_bn).join(', ');
    const msg = encodeURIComponent(
      `আসসালামু আলাইকুম ${c.customer_name || ''},\n\nআপনার অর্ডারটি সম্পূর্ণ হয়নি। আপনি ${items ? `"${items}"` : 'প্রোডাক্ট'} নিতে চাইলে অর্ডার কনফার্ম করুন।\n\nমোট: ৳${c.subtotal}\n\nধন্যবাদ।`
    );
    return `https://wa.me/${phone}?text=${msg}`;
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">অসম্পূর্ণ অর্ডার</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 mb-4">
        <Card>
          <CardContent className="p-3 text-center">
            <AlertTriangle className="h-4 w-4 text-destructive mx-auto mb-0.5" />
            <p className="text-xl font-bold">{stats?.abandoned ?? 0}</p>
            <p className="text-[10px] text-muted-foreground">অসম্পূর্ণ</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <PhoneCall className="h-4 w-4 text-accent-foreground mx-auto mb-0.5" />
            <p className="text-xl font-bold">{stats?.contacted ?? 0}</p>
            <p className="text-[10px] text-muted-foreground">যোগাযোগ</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <CheckCircle className="h-4 w-4 text-primary mx-auto mb-0.5" />
            <p className="text-xl font-bold">{stats?.recovered ?? 0}</p>
            <p className="text-[10px] text-muted-foreground">রিকভার্ড</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <X className="h-4 w-4 text-muted-foreground mx-auto mb-0.5" />
            <p className="text-xl font-bold">{stats?.dismissed ?? 0}</p>
            <p className="text-[10px] text-muted-foreground">বাদ দেওয়া</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <TrendingUp className="h-4 w-4 text-accent-foreground mx-auto mb-0.5" />
            <p className="text-xl font-bold">{recoveryRate}%</p>
            <p className="text-[10px] text-muted-foreground">রেট</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="ফোন নম্বর বা নাম দিয়ে খুঁজুন..."
          className="pl-9 h-9 text-sm"
        />
      </div>

      {/* Tabs + Time Filter */}
      <div className="flex gap-1 w-full overflow-x-auto scrollbar-hide pb-1 mb-4">
        {STATUS_TABS.map(tab => (
          <Button
            key={tab.value}
            size="sm"
            variant={activeTab === tab.value ? 'default' : 'outline'}
            onClick={() => setActiveTab(tab.value)}
            className="text-xs flex-1"
          >
            <tab.icon className="h-3 w-3 mr-1" />
            {tab.label}
          </Button>
        ))}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="outline" className="h-8 w-8 shrink-0 relative">
              <Clock className="h-3.5 w-3.5" />
              {timeFilter !== 'all' && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setTimeFilter('all')} className={cn(timeFilter === 'all' && 'font-bold')}>সব সময়</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTimeFilter('today')} className={cn(timeFilter === 'today' && 'font-bold')}>আজ</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTimeFilter('7days')} className={cn(timeFilter === '7days' && 'font-bold')}>৭ দিন</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTimeFilter('30days')} className={cn(timeFilter === '30days' && 'font-bold')}>৩০ দিন</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* List */}
      {isLoading ? <p className="text-muted-foreground text-sm">Loading...</p> : (
        <div className="space-y-2">
          {(() => {
            const q = search.trim().toLowerCase();
            const nq = normalizeBDPhone(q);
            const filtered = q ? allCheckouts.filter((c: any) => {
              const np = normalizeBDPhone(c.customer_phone || '');
              return np.includes(nq) || (c.customer_name || '').toLowerCase().includes(q);
            }) : allCheckouts;
            return filtered;
          })().map((c: any) => {
            const cart = c.cart_data || [];
            const statusColor: Record<string, string> = {
              abandoned: 'destructive',
              contacted: 'secondary',
              recovered: 'default',
              dismissed: 'outline',
            };
            return (
              <Card key={c.id} className={cn("overflow-hidden", c.status === 'dismissed' && "opacity-60 bg-muted/30")}>
                <CardContent className="p-3">
                  <div className="flex flex-col gap-2">
                    {/* Top row: info + contact buttons */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="font-medium text-sm truncate">{c.customer_name || 'Unknown'}</p>
                          <Badge variant={statusColor[c.status] as any || 'outline'} className="text-[9px] px-1.5 py-0 h-4 shrink-0">
                            {c.status === 'abandoned' && 'অসম্পূর্ণ'}
                            {c.status === 'contacted' && 'যোগাযোগ'}
                            {c.status === 'recovered' && 'রিকভার্ড'}
                            {c.status === 'dismissed' && 'ডিসমিস'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{c.customer_phone}</p>
                        {c.customer_address && (
                          <p className="text-[11px] text-muted-foreground truncate">{c.customer_address}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm font-semibold">৳{c.subtotal}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        {cart.length > 0 && (() => {
                          const itemImg = getItemImage(cart[0]);
                          return (
                            <div className="flex items-center gap-2 mt-1">
                              {itemImg ? (
                                <img src={itemImg} alt="" className="h-8 w-8 rounded object-cover border border-border shrink-0" />
                              ) : (
                                <div className="h-8 w-8 rounded border border-border flex items-center justify-center bg-muted shrink-0">
                                  <Package className="h-4 w-4 text-muted-foreground" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] text-muted-foreground truncate">
                                  {cart.map((item: any) => {
                                    const name = item.name_bn || item.name;
                                    const variants = [item.size, item.color].filter(Boolean).join(', ');
                                    return `${name} x${item.quantity || item.qty}${variants ? ` (${variants})` : ''}`;
                                  }).join(', ')}
                                </p>
                              </div>
                            </div>
                          );
                        })()}
                        {(c as any).notes && editingNoteId !== c.id && (
                          <p className="text-[11px] text-muted-foreground italic mt-1">📝 {(c as any).notes}</p>
                        )}
                      </div>
                      {c.customer_phone && (
                        <div className="flex gap-1 shrink-0 flex-wrap">
                          <Button size="icon" variant="outline" className="h-8 w-8 md:h-7 md:w-7" asChild>
                            <a href={`tel:${c.customer_phone}`}><Phone className="h-3.5 w-3.5 md:h-3 md:w-3" /></a>
                          </Button>
                          <Button size="icon" variant="outline" className="h-8 w-8 md:h-7 md:w-7" asChild>
                            <a href={getWhatsAppUrl(c)} target="_blank" rel="noopener noreferrer">
                              <MessageCircle className="h-3.5 w-3.5 md:h-3 md:w-3" />
                            </a>
                          </Button>
                          <Button size="icon" variant="outline" className="h-8 w-8 md:h-7 md:w-7 relative"
                            onClick={() => { setEditingNoteId(editingNoteId === c.id ? null : c.id); setNoteText((c as any).notes || ''); }}>
                            <StickyNote className="h-3.5 w-3.5 md:h-3 md:w-3" />
                            {(c as any).notes && <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />}
                          </Button>
                          <Button size="icon" variant="outline" className="h-8 w-8 md:h-7 md:w-7"
                            onClick={() => setEditorCheckout(c)}>
                            <Eye className="h-3.5 w-3.5 md:h-3 md:w-3" />
                          </Button>
                          <Button size="icon" variant="outline" className="h-8 w-8 md:h-7 md:w-7"
                              title="ইমেইল রিমাইন্ডার পাঠান"
                              onClick={async () => {
                                const email = (c as any).customer_email;
                                if (!email) {
                                  toast.error('এই কাস্টমারের ইমেইল নেই');
                                  return;
                                }
                                try {
                                  // Fetch template from DB
                                  const { data: tpl } = await supabase
                                    .from('email_templates')
                                    .select('subject, html_content, is_active')
                                    .eq('template_key', 'cart_abandoned')
                                    .single();

                                  const items = (c.cart_data || []).map((item: any) => item.name_bn || item.name).join(', ');
                                  
                                  let subject = tpl?.subject || 'আপনার কার্টে এখনো পণ্য রয়েছে – Shorno Suta';
                                  let html = tpl?.html_content || `<p>প্রিয় ${c.customer_name || 'কাস্টমার'}, আপনার কার্টে পণ্য রয়েছে: ${items}. মোট: ৳${c.subtotal}</p>`;
                                  
                                  // Replace template variables
                                  html = html
                                    .replace(/\{\{customer_name\}\}/g, c.customer_name || 'কাস্টমার')
                                    .replace(/\{\{items\}\}/g, items || 'প্রোডাক্ট')
                                    .replace(/\{\{subtotal\}\}/g, String(c.subtotal || 0));
                                  subject = subject
                                    .replace(/\{\{customer_name\}\}/g, c.customer_name || 'কাস্টমার');

                                  await supabase.functions.invoke('send-email', {
                                    body: { to: email, subject, html },
                                  });

                                  // Log to notification_logs
                                  await supabase.from('notification_logs' as any).insert({
                                    notification_type: 'cart_abandoned',
                                    channel: 'email',
                                    recipient: email,
                                    status: 'sent',
                                    message_content: subject,
                                  } as any);

                                  toast.success('ইমেইল রিমাইন্ডার পাঠানো হয়েছে');
                                } catch {
                                  toast.error('ইমেইল পাঠাতে সমস্যা হয়েছে');
                                }
                              }}>
                              <Mail className="h-3.5 w-3.5 md:h-3 md:w-3" />
                            </Button>
                        </div>
                      )}
                    </div>
                    {/* Inline note editor */}
                    {editingNoteId === c.id && (
                      <div className="flex flex-col gap-1.5">
                        <Textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="নোট লিখুন..." rows={2} className="text-xs min-h-[50px]" />
                        <div className="flex gap-1.5">
                          <Button size="sm" className="h-7 text-[11px] px-2.5" onClick={() => saveNote.mutate({ id: c.id, notes: noteText })} disabled={saveNote.isPending}>
                            সেভ
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-[11px] px-2.5" onClick={() => setEditingNoteId(null)}>
                            বাতিল
                          </Button>
                        </div>
                      </div>
                    )}
                    {/* Bottom row: action buttons */}
                    {c.status !== 'recovered' && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {c.status === 'abandoned' && (
                          <Button size="sm" variant="outline" className="h-7 text-[11px] px-2.5 md:h-6 md:text-[10px] md:px-1.5"
                            onClick={() => updateStatus.mutate({ id: c.id, status: 'contacted' })}>
                            <PhoneCall className="h-3 w-3 mr-0.5" /> যোগাযোগ
                          </Button>
                        )}
                        {(c.status === 'abandoned' || c.status === 'contacted') && (
                          <Button size="sm" className="h-7 text-[11px] px-2.5 md:h-6 md:text-[10px] md:px-1.5"
                            onClick={() => updateStatus.mutate({ id: c.id, status: 'recovered' })}>
                            <CheckCircle className="h-3 w-3 mr-0.5" /> রিকভার
                          </Button>
                        )}
                        {(c.status === 'abandoned' || c.status === 'contacted') && (
                          <Button size="sm" variant="ghost" className="h-7 text-[10px] text-muted-foreground px-2 md:h-5 md:text-[9px] md:px-1 ml-auto"
                            onClick={() => updateStatus.mutate({ id: c.id, status: 'dismissed' })}>
                            <X className="h-2.5 w-2.5 mr-0.5" /> ডিসমিস
                          </Button>
                        )}
                        {c.status === 'dismissed' && (
                          <Button size="sm" variant="outline" className="h-7 text-[11px] px-2.5 md:h-6 md:text-[10px] md:px-1.5"
                            onClick={() => updateStatus.mutate({ id: c.id, status: 'abandoned' })}>
                            <AlertTriangle className="h-3 w-3 mr-0.5" /> পুনরায় সক্রিয়
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {allCheckouts.length === 0 && <p className="text-muted-foreground text-sm text-center py-8">কোনো রেকর্ড নেই</p>}
        </div>
      )}

      <AbandonedCheckoutEditor
        checkout={editorCheckout}
        open={!!editorCheckout}
        onOpenChange={(open) => { if (!open) setEditorCheckout(null); }}
        onSaved={() => { invalidateAll(); }}
      />
    </div>
  );
}
