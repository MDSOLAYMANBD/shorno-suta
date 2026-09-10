
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { Search, Pencil, Trash2, UserCircle, Mail, Phone, Chrome } from 'lucide-react';
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';

export default function AdminCustomerAccounts() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [editProfile, setEditProfile] = useState<any>(null);
  const [editForm, setEditForm] = useState({ full_name: '', phone: '', address: '', email: '' });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [authInfo, setAuthInfo] = useState<Record<string, { email: string; provider: string }>>({});

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['admin-customer-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch auth info (email & provider) for all customers
  useEffect(() => {
    if (profiles.length === 0) return;
    const userIds = profiles.map((p: any) => p.user_id);
    supabase.rpc('get_customer_auth_info', { user_ids: userIds }).then(({ data }) => {
      if (data) {
        const map: Record<string, { email: string; provider: string }> = {};
        (data as any[]).forEach((d: any) => { map[d.id] = { email: d.email, provider: d.provider }; });
        setAuthInfo(map);
      }
    });
  }, [profiles]);

  const filtered = profiles.filter((p: any) =>
    !search || p.full_name?.toLowerCase().includes(search.toLowerCase()) || p.phone?.includes(search) || p.email?.toLowerCase().includes(search.toLowerCase())
  );

  const getSignupMethod = (p: any) => {
    const info = authInfo[p.user_id];
    if (!info) return null;
    if (info.provider === 'google') return 'google';
    return 'phone';
  };

  const updateMutation = useMutation({
    mutationFn: async (vals: { id: string; full_name: string; phone: string; address: string; email: string }) => {
      const { error } = await supabase
        .from('customer_profiles')
        .update({ full_name: vals.full_name, phone: vals.phone, address: vals.address, email: vals.email } as any)
        .eq('id', vals.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-customer-profiles'] });
      setEditProfile(null);
      toast.success('প্রোফাইল আপডেট হয়েছে');
    },
    onError: () => toast.error('আপডেট ব্যর্থ হয়েছে'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('customer_profiles').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-customer-profiles'] });
      setDeleteId(null);
      toast.success('একাউন্ট ডিলিট হয়েছে');
    },
    onError: () => toast.error('ডিলিট ব্যর্থ হয়েছে'),
  });

  const openEdit = (p: any) => {
    setEditProfile(p);
    setEditForm({ full_name: p.full_name || '', phone: p.phone || '', address: p.address || '', email: p.email || '' });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <UserCircle className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">কাস্টমার একাউন্ট</h1>
          <span className="text-sm text-muted-foreground">({filtered.length})</span>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="নাম, ফোন বা ইমেইল দিয়ে সার্চ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">কোনো কাস্টমার একাউন্ট পাওয়া যায়নি</p>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>কাস্টমার</TableHead>
                <TableHead>ফোন</TableHead>
                <TableHead className="hidden md:table-cell">ইমেইল</TableHead>
                <TableHead className="hidden md:table-cell">সাইনআপ</TableHead>
                <TableHead className="hidden md:table-cell">যোগদান</TableHead>
                <TableHead className="text-right">অ্যাকশন</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p: any) => {
                const method = getSignupMethod(p);
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          {p.avatar_url ? (
                            <AvatarImage src={p.avatar_url} alt={p.full_name} />
                          ) : null}
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {(p.full_name || '?').charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <span className="font-medium truncate max-w-[150px] block">{p.full_name || '—'}</span>
                          <span className="text-xs text-muted-foreground md:hidden">{format(new Date(p.created_at), 'dd MMM yyyy', { locale: bn })}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{p.phone || '—'}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground truncate max-w-[200px]">
                      {p.email || authInfo[p.user_id]?.email?.replace(/@phone\.shorno-suta\.app$/, '') || '—'}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {method === 'google' ? (
                        <Badge variant="secondary" className="gap-1 text-xs">
                          <Chrome className="h-3 w-3" /> Google
                        </Badge>
                      ) : method === 'phone' ? (
                        <Badge variant="outline" className="gap-1 text-xs">
                          <Phone className="h-3 w-3" /> ফোন
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-xs">
                      {format(new Date(p.created_at), 'dd MMM yyyy', { locale: bn })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setDeleteId(p.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editProfile} onOpenChange={() => setEditProfile(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>প্রোফাইল এডিট</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>নাম</Label>
              <Input value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} />
            </div>
            <div>
              <Label>ফোন</Label>
              <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
            </div>
            <div>
              <Label>ইমেইল</Label>
              <Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} placeholder="example@gmail.com" />
            </div>
            <div>
              <Label>ঠিকানা</Label>
              <Input value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditProfile(null)}>বাতিল</Button>
            <Button
              onClick={() => updateMutation.mutate({ id: editProfile.id, ...editForm })}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? 'সেভ হচ্ছে...' : 'সেভ করুন'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>একাউন্ট ডিলিট করুন?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">এই কাস্টমারের প্রোফাইল স্থায়ীভাবে মুছে ফেলা হবে। এটি পূর্বাবস্থায় ফেরানো যাবে না।</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>বাতিল</Button>
            <Button variant="destructive" onClick={() => deleteId && deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'ডিলিট হচ্ছে...' : 'ডিলিট করুন'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
