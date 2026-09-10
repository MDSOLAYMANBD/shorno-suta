import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Tag } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const TAG_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#64748b',
];

export default function TagManager() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState(TAG_COLORS[0]);

  const { data: tags = [] } = useQuery({
    queryKey: ['crm-tags'],
    queryFn: async () => {
      const { data } = await supabase.from('crm_tags' as any).select('*').order('created_at');
      return (data || []) as any[];
    },
  });

  const addTag = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('crm_tags' as any).insert({
        name: tagName.trim(),
        color: tagColor,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('ট্যাগ যোগ হয়েছে');
      setShowAdd(false);
      setTagName('');
      queryClient.invalidateQueries({ queryKey: ['crm-tags'] });
    },
    onError: (e: any) => toast.error(e.message?.includes('unique') ? 'এই নামে ট্যাগ আছে' : 'সমস্যা হয়েছে'),
  });

  const deleteTag = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('crm_tags' as any).delete().eq('id', id);
    },
    onSuccess: () => {
      toast.success('ট্যাগ মুছে ফেলা হয়েছে');
      queryClient.invalidateQueries({ queryKey: ['crm-tags'] });
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <Tag className="h-4 w-4" /> ট্যাগ ম্যানেজমেন্ট
        </h3>
        <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> নতুন ট্যাগ
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {tags.map((t: any) => (
          <Badge
            key={t.id}
            variant="outline"
            className="gap-1 pl-2 pr-1 py-1"
            style={{ borderColor: t.color, color: t.color }}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: t.color }} />
            {t.name}
            <button onClick={() => deleteTag.mutate(t.id)} className="ml-1 hover:opacity-70">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        {tags.length === 0 && (
          <p className="text-xs text-muted-foreground">কোনো ট্যাগ নেই। "নতুন ট্যাগ" বাটনে ক্লিক করুন।</p>
        )}
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>নতুন ট্যাগ</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">ট্যাগ নাম</Label>
              <Input value={tagName} onChange={e => setTagName(e.target.value)} placeholder="যেমন: Hot Customer" />
            </div>
            <div>
              <Label className="text-xs">রং</Label>
              <div className="flex gap-2 flex-wrap mt-1">
                {TAG_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setTagColor(c)}
                    className="w-7 h-7 rounded-full border-2 transition-transform"
                    style={{
                      background: c,
                      borderColor: tagColor === c ? 'hsl(var(--foreground))' : 'transparent',
                      transform: tagColor === c ? 'scale(1.15)' : 'scale(1)',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => addTag.mutate()} disabled={!tagName.trim() || addTag.isPending}>
              যোগ করুন
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
