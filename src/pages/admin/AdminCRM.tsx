import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import TagManager from '@/components/admin/crm/TagManager';
import CustomerCard from '@/components/admin/crm/CustomerCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Users, Filter, StickyNote, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function AdminCRM() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterTag, setFilterTag] = useState<string>('all');
  const [tagDialogCustomerId, setTagDialogCustomerId] = useState<string | null>(null);
  const [selectedTagId, setSelectedTagId] = useState('');
  const [notesCustomerId, setNotesCustomerId] = useState<string | null>(null);
  const [newNote, setNewNote] = useState('');

  // Customers
  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['crm-customers'],
    queryFn: async () => {
      const { data } = await supabase
        .from('customers')
        .select('*')
        .order('total_orders', { ascending: false })
        .limit(500);
      return data || [];
    },
  });

  // All tags
  const { data: tags = [] } = useQuery({
    queryKey: ['crm-tags'],
    queryFn: async () => {
      const { data } = await supabase.from('crm_tags' as any).select('*').order('created_at');
      return (data || []) as any[];
    },
  });

  // Customer-tag assignments
  const { data: customerTags = [] } = useQuery({
    queryKey: ['crm-customer-tags'],
    queryFn: async () => {
      const { data } = await supabase
        .from('crm_customer_tags' as any)
        .select('id, customer_id, tag_id, crm_tags(name, color)') as any;
      return (data || []).map((ct: any) => ({
        ...ct,
        tag_name: ct.crm_tags?.name || '',
        tag_color: ct.crm_tags?.color || '#6366f1',
      }));
    },
  });

  // Notes for selected customer
  const { data: notes = [] } = useQuery({
    queryKey: ['crm-notes', notesCustomerId],
    queryFn: async () => {
      if (!notesCustomerId) return [];
      const { data } = await supabase
        .from('crm_notes' as any)
        .select('*')
        .eq('customer_id', notesCustomerId)
        .order('created_at', { ascending: false });
      return (data || []) as any[];
    },
    enabled: !!notesCustomerId,
  });

  // Add tag to customer
  const addTagMutation = useMutation({
    mutationFn: async () => {
      if (!tagDialogCustomerId || !selectedTagId) return;
      const { error } = await supabase.from('crm_customer_tags' as any).insert({
        customer_id: tagDialogCustomerId,
        tag_id: selectedTagId,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('ট্যাগ যোগ হয়েছে');
      setTagDialogCustomerId(null);
      setSelectedTagId('');
      queryClient.invalidateQueries({ queryKey: ['crm-customer-tags'] });
    },
    onError: (e: any) => toast.error(e.message?.includes('unique') ? 'এই ট্যাগ আগেই আছে' : 'সমস্যা হয়েছে'),
  });

  // Add note
  const addNoteMutation = useMutation({
    mutationFn: async () => {
      if (!notesCustomerId || !newNote.trim()) return;
      const { data: { session } } = await supabase.auth.getSession();
      const { error } = await supabase.from('crm_notes' as any).insert({
        customer_id: notesCustomerId,
        note: newNote.trim(),
        created_by: session?.user?.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      setNewNote('');
      queryClient.invalidateQueries({ queryKey: ['crm-notes', notesCustomerId] });
      toast.success('নোট যোগ হয়েছে');
    },
  });

  // Filter customers
  const filtered = customers.filter((c: any) => {
    const matchSearch = !search ||
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search);
    
    if (filterTag === 'all') return matchSearch;
    
    const hasThatTag = customerTags.some(
      (ct: any) => ct.customer_id === c.id && ct.tag_id === filterTag
    );
    return matchSearch && hasThatTag;
  });

  // Stats
  const totalCustomers = customers.length;
  const repeatBuyers = customers.filter((c: any) => c.total_orders >= 2).length;
  const totalRevenue = customers.reduce((s: number, c: any) => s + Number(c.total_spent || 0), 0);

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">CRM</h1>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="shadow-none">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{totalCustomers.toLocaleString('bn-BD')}</p>
            <p className="text-xs text-muted-foreground">মোট কাস্টমার</p>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{repeatBuyers.toLocaleString('bn-BD')}</p>
            <p className="text-xs text-muted-foreground">রিপিট বায়ার</p>
          </CardContent>
        </Card>
        <Card className="shadow-none sm:col-span-1 col-span-2">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">৳{totalRevenue.toLocaleString('bn-BD')}</p>
            <p className="text-xs text-muted-foreground">মোট আয়</p>
          </CardContent>
        </Card>
      </div>

      {/* Tag Manager */}
      <Card>
        <CardContent className="p-4">
          <TagManager />
        </CardContent>
      </Card>

      {/* Search & Filter */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="নাম বা ফোন দিয়ে খুঁজুন..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterTag} onValueChange={setFilterTag}>
          <SelectTrigger className="w-40">
            <Filter className="h-3.5 w-3.5 mr-1" />
            <SelectValue placeholder="ট্যাগ ফিল্টার" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">সব কাস্টমার</SelectItem>
            {tags.map((t: any) => (
              <SelectItem key={t.id} value={t.id}>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: t.color }} />
                  {t.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Customer List */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">লোড হচ্ছে...</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c: any) => (
            <CustomerCard
              key={c.id}
              customer={c}
              tags={customerTags.filter((ct: any) => ct.customer_id === c.id)}
              onAddTag={setTagDialogCustomerId}
              onViewNotes={setNotesCustomerId}
            />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-8 text-muted-foreground text-sm">কোনো কাস্টমার পাওয়া যায়নি</div>
          )}
        </div>
      )}

      {/* Add Tag Dialog */}
      <Dialog open={!!tagDialogCustomerId} onOpenChange={v => !v && setTagDialogCustomerId(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>ট্যাগ যোগ করুন</DialogTitle></DialogHeader>
          <Select value={selectedTagId} onValueChange={setSelectedTagId}>
            <SelectTrigger><SelectValue placeholder="ট্যাগ নির্বাচন করুন" /></SelectTrigger>
            <SelectContent>
              {tags.map((t: any) => (
                <SelectItem key={t.id} value={t.id}>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: t.color }} />
                    {t.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button onClick={() => addTagMutation.mutate()} disabled={!selectedTagId || addTagMutation.isPending}>
              যোগ করুন
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notes Dialog */}
      <Dialog open={!!notesCustomerId} onOpenChange={v => !v && setNotesCustomerId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">
              <StickyNote className="h-4 w-4" /> কাস্টমার নোট
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {notes.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">কোনো নোট নেই</p>
            ) : (
              notes.map((n: any) => (
                <div key={n.id} className="bg-muted/50 rounded-lg p-3">
                  <p className="text-sm whitespace-pre-wrap">{n.note}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {new Date(n.created_at).toLocaleDateString('bn-BD')}
                  </p>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2">
            <Textarea
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              placeholder="নোট লিখুন..."
              className="text-sm min-h-[60px]"
            />
          </div>
          <DialogFooter>
            <Button onClick={() => addNoteMutation.mutate()} disabled={!newNote.trim() || addNoteMutation.isPending}>
              নোট যোগ করুন
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
