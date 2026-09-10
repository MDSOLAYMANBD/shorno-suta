// Serializable rule-tree builder. Output conforms to RuleNode in types.ts
// and is reusable by Automation / Email / WhatsApp / Scheduled campaigns.

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Plus, Trash2 } from 'lucide-react';
import type { RuleGroup, RuleField, RuleLeaf, RuleNode, RuleOp } from '@/lib/audience/types';

interface Props {
  value: RuleGroup | undefined;
  onChange: (v: RuleGroup | undefined) => void;
}

const FIELDS: { id: RuleField; label: string }[] = [
  { id: 'orders_count',    label: 'Orders Count' },
  { id: 'total_spent',     label: 'Total Spend' },
  { id: 'district',        label: 'District' },
  { id: 'upazila',         label: 'Upazila' },
  { id: 'courier',         label: 'Courier' },
  { id: 'payment_method',  label: 'Payment Method' },
  { id: 'last_order_date', label: 'Last Order Date' },
  { id: 'customer_status', label: 'Customer Status' },
  { id: 'delivery_status', label: 'Delivery Status' },
  { id: 'order_status',    label: 'Order Status' },
];

const OPS: { id: RuleOp; label: string }[] = [
  { id: 'eq',     label: '=' },
  { id: 'neq',    label: '≠' },
  { id: 'gte',    label: '≥' },
  { id: 'lte',    label: '≤' },
  { id: 'gt',     label: '>' },
  { id: 'lt',     label: '<' },
  { id: 'in',     label: 'in' },
  { id: 'nin',    label: 'not in' },
  { id: 'before', label: 'before' },
  { id: 'after',  label: 'after' },
];

const emptyGroup = (): RuleGroup => ({ type: 'group', logic: 'and', children: [] });
const emptyLeaf  = (): RuleLeaf  => ({ type: 'rule', field: 'orders_count', op: 'gte', value: 1 });

export default function RuleBuilder({ value, onChange }: Props) {
  const root = value || emptyGroup();

  if (!value) {
    return (
      <Button variant="outline" size="sm" onClick={() => onChange(emptyGroup())}>
        <Plus className="h-3.5 w-3.5 mr-1" /> Add Advanced Rules
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <GroupNode node={root} onChange={onChange} onRemove={() => onChange(undefined)} root />
    </div>
  );
}

function GroupNode({
  node, onChange, onRemove, root,
}: { node: RuleGroup; onChange: (n: RuleGroup) => void; onRemove: () => void; root?: boolean }) {
  const update = (next: RuleNode[]) => onChange({ ...node, children: next });
  return (
    <Card className="p-2.5 border-dashed">
      <div className="flex items-center justify-between gap-2 mb-2">
        <Select value={node.logic} onValueChange={(v) => onChange({ ...node, logic: v as 'and' | 'or' })}>
          <SelectTrigger className="h-7 w-20 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="and">AND</SelectItem>
            <SelectItem value="or">OR</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" className="h-7 text-xs"
            onClick={() => update([...node.children, emptyLeaf()])}>
            <Plus className="h-3 w-3 mr-1" /> Rule
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs"
            onClick={() => update([...node.children, emptyGroup()])}>
            <Plus className="h-3 w-3 mr-1" /> Group
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs text-rose-600" onClick={onRemove}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <div className="space-y-2 pl-2 border-l">
        {node.children.length === 0 && (
          <p className="text-[11px] text-muted-foreground italic">No rules in this group.</p>
        )}
        {node.children.map((child, i) => (
          child.type === 'group' ? (
            <GroupNode key={i} node={child}
              onChange={(n) => update(node.children.map((c, idx) => idx === i ? n : c))}
              onRemove={() => update(node.children.filter((_, idx) => idx !== i))}
            />
          ) : (
            <LeafNode key={i} node={child}
              onChange={(n) => update(node.children.map((c, idx) => idx === i ? n : c))}
              onRemove={() => update(node.children.filter((_, idx) => idx !== i))}
            />
          )
        ))}
      </div>
      {root && (
        <pre className="text-[9px] text-muted-foreground mt-2 max-h-24 overflow-auto bg-muted/30 rounded p-1.5 font-mono">
{JSON.stringify(node, null, 0)}
        </pre>
      )}
    </Card>
  );
}

function LeafNode({ node, onChange, onRemove }: { node: RuleLeaf; onChange: (n: RuleLeaf) => void; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <Select value={node.field} onValueChange={(v) => onChange({ ...node, field: v as RuleField })}>
        <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
        <SelectContent>
          {FIELDS.map((f) => <SelectItem key={f.id} value={f.id} className="text-xs">{f.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={node.op} onValueChange={(v) => onChange({ ...node, op: v as RuleOp })}>
        <SelectTrigger className="h-7 text-xs w-20"><SelectValue /></SelectTrigger>
        <SelectContent>
          {OPS.map((o) => <SelectItem key={o.id} value={o.id} className="text-xs">{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Input
        value={Array.isArray(node.value) ? node.value.join(',') : String(node.value ?? '')}
        onChange={(e) => {
          const raw = e.target.value;
          const next = ['in', 'nin'].includes(node.op)
            ? raw.split(',').map((s) => s.trim()).filter(Boolean)
            : /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw;
          onChange({ ...node, value: next });
        }}
        className="h-7 text-xs flex-1"
        placeholder="value"
      />
      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-rose-600" onClick={onRemove}>
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}
