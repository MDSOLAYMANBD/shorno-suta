// Phase 5 — Saved Audience management page.
// Search, category chip, favorite toggle, rename, duplicate, delete, open.

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Star, StarOff, Copy, Trash2, Pencil, Search, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';
import { logAudit } from '@/lib/audience/audit';
import type { AudienceFilter, SavedAudience } from '@/lib/audience/types';
import { friendlyError } from '@/lib/audience/errors';

interface ExtSavedAudience extends SavedAudience {
  is_favorite: boolean;
  category: string | null;
  last_used_at: string | null;
  customer_count: number;
}

interface Props {
  onOpen?: (filter: AudienceFilter) => void;
}

export default function SavedAudiencesTab({ onOpen }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [renaming, setRenaming] = useState<ExtSavedAudience | null>(null);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('');

  const { data = [], isLoading } = useQuery({
    queryKey: ['saved-audiences-full'],
    queryFn: async (): Promise<ExtSavedAudience[]> => {
      const { data, error } = await (supabase.from('crm_saved_audiences' as any) as any)
        .select('*')
        .order('is_favorite', { ascending: false })
        .order('last_used_at', { ascending: false, nullsFirst: false })
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data as any[]) as ExtSavedAudience[];
    },
  });

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const a of data) if (a.category) set.add(a.category);
    return Array.from(set).sort();
  }, [data]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return data.filter((a) => {
      if (category !== 'all' && a.category !== category) return false;
      if (!s) return true;
      return a.name?.toLowerCase().includes(s) || a.description?.toLowerCase().includes(s);
    });
  }, [data, search, category]);

  const toggleFav = useMutation({
    mutationFn: async (a: ExtSavedAudience) => {
      const { error } = await (supabase.from('crm_saved_audiences' as any) as any)
        .update({ is_favorite: !a.is_favorite })
        .eq('id', a.id);
      if (error) throw error;
      await logAudit('audience_favorited', 'saved_audience', a.id, { is_favorite: !a.is_favorite });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-audiences-full'] }),
    onError: (e) => toast.error(friendlyError(e)),
  });

  const remove = useMutation({
    mutationFn: async (a: ExtSavedAudience) => {
      const { error } = await supabase.from('crm_saved_audiences' as any).delete().eq('id', a.id);
      if (error) throw error;
      await logAudit('audience_deleted', 'saved_audience', a.id, { name: a.name });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saved-audiences-full'] });
      toast.success('ডিলিট হয়েছে');
    },
    onError: (e) => toast.error(friendlyError(e)),
  });

  const duplicate = useMutation({
    mutationFn: async (a: ExtSavedAudience) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await (supabase.from('crm_saved_audiences' as any) as any)
        .insert({
          name: `${a.name} (copy)`,
          description: a.description,
          filters: a.filters,
          channel_hint: a.channel_hint,
          category: a.category,
          created_by: user?.id ?? null,
        })
        .select('*').single();
      if (error) throw error;
      await logAudit('audience_duplicated', 'saved_audience', (data as any)?.id, { from: a.id });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saved-audiences-full'] });
      toast.success('ডুপ্লিকেট হয়েছে');
    },
    onError: (e) => toast.error(friendlyError(e)),
  });

  const rename = useMutation({
    mutationFn: async () => {
      if (!renaming) return;
      const { error } = await (supabase.from('crm_saved_audiences' as any) as any)
        .update({ name: newName.trim(), category: newCategory.trim() || null })
        .eq('id', renaming.id);
      if (error) throw error;
      await logAudit('audience_edited', 'saved_audience', renaming.id, { name: newName, category: newCategory });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saved-audiences-full'] });
      toast.success('আপডেট হয়েছে');
      setRenaming(null);
    },
    onError: (e) => toast.error(friendlyError(e)),
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input className="h-8 pl-7 text-sm" placeholder="অডিয়েন্স খুঁজুন..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-1">
          <button onClick={() => setCategory('all')} className={`px-2 py-0.5 rounded text-[11px] border ${category === 'all' ? 'border-primary bg-primary/10' : ''}`}>সব</button>
          {categories.map((c) => (
            <button key={c} onClick={() => setCategory(c)} className={`px-2 py-0.5 rounded text-[11px] border ${category === c ? 'border-primary bg-primary/10' : ''}`}>{c}</button>
          ))}
        </div>
        <Badge variant="secondary" className="text-[10px]">{filtered.length} / {data.length}</Badge>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>নাম</TableHead>
                <TableHead>ক্যাটাগরি</TableHead>
                <TableHead className="text-right">কাস্টমার</TableHead>
                <TableHead>সর্বশেষ ব্যবহার</TableHead>
                <TableHead className="text-right">অ্যাকশন</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={6} className="text-center text-xs py-6">লোড হচ্ছে...</TableCell></TableRow>}
              {!isLoading && filtered.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <button onClick={() => toggleFav.mutate(a)} className="text-amber-500 hover:scale-110 transition">
                      {a.is_favorite ? <Star className="h-4 w-4 fill-current" /> : <StarOff className="h-4 w-4" />}
                    </button>
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="font-medium">{a.name}</div>
                    {a.description && <div className="text-[10px] text-muted-foreground line-clamp-1">{a.description}</div>}
                  </TableCell>
                  <TableCell className="text-xs">{a.category || '—'}</TableCell>
                  <TableCell className="text-xs text-right">{a.customer_count || 0}</TableCell>
                  <TableCell className="text-xs">{a.last_used_at ? new Date(a.last_used_at).toLocaleDateString() : '—'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {onOpen && (
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => onOpen(a.filters)} title="খুলুন">
                          <FolderOpen className="h-3 w-3" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => { setRenaming(a); setNewName(a.name); setNewCategory(a.category || ''); }} title="রিনেম">
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => duplicate.mutate(a)} title="ডুপ্লিকেট">
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-rose-600" onClick={() => { if (confirm(`ডিলিট করবেন "${a.name}"?`)) remove.mutate(a); }} title="ডিলিট">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-8">কোনো সেভড অডিয়েন্স নেই</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!renaming} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>রিনেম করুন</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="অডিয়েন্স নাম" />
            <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="ক্যাটাগরি (অপশনাল)" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(null)}>বাতিল</Button>
            <Button onClick={() => rename.mutate()} disabled={!newName.trim() || rename.isPending}>সেভ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
