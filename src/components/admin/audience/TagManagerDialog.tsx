import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Edit2, Save, X } from 'lucide-react';
import { useCrmTags, type CrmTag } from '@/hooks/useCrmTags';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const PALETTE = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#6b7280'];

export default function TagManagerDialog({ open, onOpenChange }: Props) {
  const { list, create, update, remove } = useCrmTags();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [color, setColor] = useState(PALETTE[0]);
  const [editing, setEditing] = useState<CrmTag | null>(null);

  const submit = async () => {
    if (!name.trim()) return;
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, name: name.trim(), description: desc || null, color });
        toast.success('Tag updated');
      } else {
        await create.mutateAsync({ name: name.trim(), description: desc, color });
        toast.success('Tag created');
      }
      setName(''); setDesc(''); setEditing(null); setColor(PALETTE[0]);
    } catch (e: any) { toast.error(e.message); }
  };

  const startEdit = (t: CrmTag) => {
    setEditing(t); setName(t.name); setDesc(t.description || ''); setColor(t.color || PALETTE[0]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Customer Tags</DialogTitle></DialogHeader>

        <div className="space-y-2 border-b pb-3">
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tag name" className="h-9 text-sm" />
          </div>
          <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description (optional)" className="h-9 text-sm" />
          <div className="flex items-center gap-1.5">
            {PALETTE.map((c) => (
              <button key={c} type="button" onClick={() => setColor(c)}
                className="h-6 w-6 rounded-full border-2"
                style={{ background: c, borderColor: color === c ? '#000' : 'transparent' }} />
            ))}
            <div className="flex-1" />
            {editing && (
              <Button size="sm" variant="ghost" onClick={() => { setEditing(null); setName(''); setDesc(''); }}>
                <X className="h-3 w-3" />
              </Button>
            )}
            <Button size="sm" onClick={submit} disabled={!name.trim()}>
              {editing ? <Save className="h-3.5 w-3.5 mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
              {editing ? 'Save' : 'Add'}
            </Button>
          </div>
        </div>

        <div className="max-h-72 overflow-auto space-y-1">
          {(list.data || []).length === 0 && (
            <p className="text-xs text-muted-foreground italic text-center py-4">No tags yet.</p>
          )}
          {(list.data || []).map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-md border px-2 py-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <Badge variant="outline" style={t.color ? { borderColor: t.color, color: t.color } : undefined}>
                  {t.name}
                </Badge>
                {t.description && <span className="text-[11px] text-muted-foreground truncate">{t.description}</span>}
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEdit(t)}>
                  <Edit2 className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6 text-rose-600"
                  onClick={() => remove.mutate(t.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
