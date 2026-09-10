import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { StickyNote, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  customerPhone: string | null;
}

// Notes are keyed by phone (since inbox conversations don't have a customer_id link)
export default function CustomerNotesSection({ customerPhone }: Props) {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [adding, setAdding] = useState(false);

  const { data: notes = [] } = useQuery({
    queryKey: ['inbox-customer-notes', customerPhone],
    queryFn: async () => {
      if (!customerPhone) return [];
      // crm_notes uses customer_id (uuid) — for inbox we store phone-based notes in inbox_customer_notes if it exists; fallback to none
      const { data } = await supabase
        .from('inbox_customer_notes' as any)
        .select('*')
        .eq('customer_phone', customerPhone)
        .order('created_at', { ascending: false })
        .limit(20);
      return (data || []) as any[];
    },
    enabled: !!customerPhone,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!customerPhone || !text.trim()) return;
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('inbox_customer_notes' as any).insert({
        customer_phone: customerPhone,
        note: text.trim(),
        created_by: user?.id || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      setText('');
      setAdding(false);
      qc.invalidateQueries({ queryKey: ['inbox-customer-notes', customerPhone] });
    },
    onError: (e: any) => toast.error('Note save failed: ' + e.message),
  });

  if (!customerPhone) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <StickyNote className="h-3 w-3" /> নোট
        </p>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setAdding(v => !v)}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>
      {adding && (
        <div className="space-y-1.5 mb-2">
          <Textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="নোট লিখুন..."
            className="text-xs h-16"
          />
          <Button size="sm" className="h-7 text-xs w-full" onClick={() => addMutation.mutate()} disabled={!text.trim() || addMutation.isPending}>
            সংরক্ষণ
          </Button>
        </div>
      )}
      {notes.length === 0 ? (
        <p className="text-xs text-muted-foreground">কোনো নোট নেই</p>
      ) : (
        <div className="space-y-1.5 max-h-32 overflow-y-auto">
          {notes.map((n: any) => (
            <div key={n.id} className="text-xs border rounded p-1.5 bg-muted/30">
              <p className="break-words">{n.note}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {new Date(n.created_at).toLocaleString('bn-BD')}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
