import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Check, X, Ruler, Palette } from 'lucide-react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

interface GlobalItem {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

function ItemManager({ title, icon: Icon, tableName, queryKey }: {
  title: string;
  icon: React.ElementType;
  tableName: string;
  queryKey: string;
}) {
  const qc = useQueryClient();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const { data: items = [], isLoading } = useQuery({
    queryKey: [queryKey],
    queryFn: async () => {
      const { data, error } = await supabase.from(tableName as any).select('*').order('sort_order');
      if (error) throw error;
      return data as unknown as GlobalItem[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async (name: string) => {
      const maxOrder = items.length > 0 ? Math.max(...items.map(i => i.sort_order)) + 1 : 1;
      const { error } = await supabase.from(tableName as any).insert({ name, sort_order: maxOrder } as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [queryKey] }); setNewName(''); toast.success('যোগ হয়েছে'); },
    onError: (e: any) => toast.error(e.message?.includes('duplicate') ? 'এই নাম আগে থেকে আছে' : e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<GlobalItem> }) => {
      const { error } = await supabase.from(tableName as any).update(updates as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [queryKey] }); setEditingId(null); toast.success('আপডেট হয়েছে'); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(tableName as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [queryKey] }); toast.success('ডিলিট হয়েছে'); },
  });

  const startEdit = (item: GlobalItem) => {
    setEditingId(item.id);
    setEditName(item.name);
  };

  const saveEdit = () => {
    if (!editingId || !editName.trim()) return;
    updateMutation.mutate({ id: editingId, updates: { name: editName.trim() } });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className="h-4 w-4" /> {title}
          <Badge variant="secondary" className="ml-auto text-[10px]">{items.length}টি</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new */}
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder={`নতুন ${title.toLowerCase()} যোগ করুন...`}
            className="h-9"
            onKeyDown={e => e.key === 'Enter' && newName.trim() && addMutation.mutate(newName.trim())}
          />
          <Button size="sm" className="h-9 shrink-0" onClick={() => newName.trim() && addMutation.mutate(newName.trim())} disabled={addMutation.isPending}>
            <Plus className="h-4 w-4 mr-1" /> যোগ
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-4">লোড হচ্ছে...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">কোনো আইটেম নেই</p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>নাম</TableHead>
                  <TableHead className="w-20 text-center">সক্রিয়</TableHead>
                  <TableHead className="w-24 text-center">অ্যাকশন</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(item => (
                  <TableRow key={item.id}>
                    <TableCell>
                      {editingId === item.id ? (
                        <div className="flex gap-1">
                          <Input
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            className="h-7 text-sm"
                            onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                            autoFocus
                          />
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={saveEdit}><Check className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingId(null)}><X className="h-3.5 w-3.5" /></Button>
                        </div>
                      ) : (
                        <span className="text-sm font-medium cursor-pointer hover:text-primary" onClick={() => startEdit(item)}>{item.name}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={item.is_active}
                        onCheckedChange={v => updateMutation.mutate({ id: item.id, updates: { is_active: v } })}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(item)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm('ডিলিট করতে চান?')) deleteMutation.mutate(item.id); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminSizesColors() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">📏 সাইজ ও কালার ম্যানেজমেন্ট</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ItemManager title="সাইজ" icon={Ruler} tableName="global_sizes" queryKey="global-sizes" />
        <ItemManager title="কালার" icon={Palette} tableName="global_colors" queryKey="global-colors" />
      </div>
    </div>
  );
}
