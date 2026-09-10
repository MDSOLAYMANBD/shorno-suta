import { memo, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Columns3, Loader2, Search, ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { useCustomerPreview, type SortField } from '@/hooks/useCustomerPreview';
import { useColumnPrefs } from '@/hooks/useColumnPrefs';
import { CUSTOMER_COLUMNS, DEFAULT_VISIBLE } from '@/lib/audience/columns';
import type { AudienceFilter, AudienceCustomer } from '@/lib/audience/types';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface Props {
  filter: AudienceFilter;
  selected: Set<string>;
  onToggleSelect: (phone: string) => void;
  onSelectMany: (phones: string[]) => void;
  onUnselectMany: (phones: string[]) => void;
  onRemove?: (phone: string) => void;
  onRowOpen?: (c: AudienceCustomer) => void;
  prefKey?: string; // distinct key per consuming module
}

const SORT_OPTIONS: { id: SortField; label: string }[] = [
  { id: 'last_order_date', label: 'Last Order' },
  { id: 'total_orders',    label: 'Orders' },
  { id: 'total_spent',     label: 'Spend' },
  { id: 'name',            label: 'Name' },
  { id: 'created_at',      label: 'Created' },
];

function CustomerPreviewTable({
  filter, selected, onToggleSelect, onSelectMany, onUnselectMany, onRemove, onRowOpen,
  prefKey = 'audience-preview',
}: Props) {

  const isMobile = useIsMobile();
  const PAGE_STORAGE_KEY = `${prefKey}.previewPage`;
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(() => {
    if (typeof window === 'undefined') return 0;
    const saved = Number(window.localStorage.getItem(PAGE_STORAGE_KEY) || 0);
    return Number.isFinite(saved) && saved > 0 ? saved : 0;
  });
  const pageSize = 50;
  const [sortBy, setSortBy] = useState<SortField>('last_order_date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [visibleCols, setVisibleCols] = useColumnPrefs(prefKey, DEFAULT_VISIBLE);

  useEffect(() => {
    try { window.localStorage.setItem(PAGE_STORAGE_KEY, String(page)); } catch { /* ignore storage errors */ }
  }, [PAGE_STORAGE_KEY, page]);

  const { data, isFetching } = useCustomerPreview({
    filter, search, sortBy, sortDir, page, pageSize,
  });

  const rows = data?.rows || [];
  const total = data?.total || 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    if (!data) return;
    if (data.page !== page) return;
    if (page >= pageCount) setPage(Math.max(0, pageCount - 1));
  }, [data, page, pageCount]);

  const visibleColumns = useMemo(
    () => CUSTOMER_COLUMNS.filter((c) => visibleCols.includes(c.id)),
    [visibleCols],
  );

  const pagePhones = rows.map((r) => r.phone);
  const pageAllSelected = pagePhones.length > 0 && pagePhones.every((p) => selected.has(p));
  const togglePage = () => {
    if (pageAllSelected) onUnselectMany(pagePhones);
    else onSelectMany(pagePhones);
  };

  return (
    <Card className="p-3 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search name, phone, address…"
            className="pl-8 h-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortField)}>
            <SelectTrigger className="h-9 w-36 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((s) => (
                <SelectItem key={s.id} value={s.id} className="text-xs">{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline" size="icon" className="h-9 w-9"
            onClick={() => setSortDir((d) => d === 'asc' ? 'desc' : 'asc')}
            title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
          >
            {sortDir === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1"><Columns3 className="h-4 w-4" /> Columns</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs">Visible columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {CUSTOMER_COLUMNS.map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.id}
                  checked={visibleCols.includes(c.id)}
                  onCheckedChange={(v) => {
                    setVisibleCols(v
                      ? [...visibleCols, c.id]
                      : visibleCols.filter((x) => x !== c.id));
                  }}
                >{c.label}</DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5">
            <Checkbox checked={pageAllSelected} onCheckedChange={togglePage} />
            <span>Select page</span>
          </label>
          <span className="text-muted-foreground">
            Selected <span className="font-mono font-semibold">{selected.size.toLocaleString()}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isFetching && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          <Badge variant="outline" className="text-[10px] font-mono">
            {total.toLocaleString()} matching
          </Badge>
        </div>
      </div>

      {isMobile ? (
        <div className="space-y-2">
          {rows.map((c) => (
            <MobileCard key={c.phone} customer={c}
              selected={selected.has(c.phone)}
              onToggle={() => onToggleSelect(c.phone)}
              onOpen={() => onRowOpen?.(c)}
              onRemove={onRemove ? () => onRemove(c.phone) : undefined}
            />
          ))}
          {rows.length === 0 && !isFetching && <Empty />}
        </div>
      ) : (
        <div className="rounded-md border overflow-auto max-h-[60vh]">
          <table className="min-w-full text-xs">
            <thead className="sticky top-0 bg-background border-b z-10">
              <tr>
                <th className="px-2 py-2 w-8" />
                {visibleColumns.map((c) => (
                  <th
                    key={c.id}
                    style={{ width: c.width }}
                    className={cn('px-2 py-2 text-left font-medium text-muted-foreground', c.align === 'right' && 'text-right')}
                  >
                    {c.label}
                  </th>
                ))}
                {onRemove && <th className="px-2 py-2 w-10" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.phone}
                    className={cn('border-b last:border-0 hover:bg-muted/40', selected.has(c.phone) && 'bg-emerald-50/50 dark:bg-emerald-950/10')}
                >
                  <td className="px-2 py-1.5">
                    <Checkbox checked={selected.has(c.phone)} onCheckedChange={() => onToggleSelect(c.phone)} />
                  </td>
                  {visibleColumns.map((col) => (
                    <td
                      key={col.id}
                      className={cn('px-2 py-1.5 truncate cursor-pointer', col.align === 'right' && 'text-right font-mono')}
                      onClick={() => onRowOpen?.(c)}
                      title={col.render(c)}
                    >
                      {col.render(c)}
                    </td>
                  ))}
                  {onRemove && (
                    <td className="px-2 py-1.5">
                      <Button size="icon" variant="ghost" className="h-7 w-7"
                        onClick={(e) => { e.stopPropagation(); onRemove(c.phone); }}
                        title="Remove from audience">
                        <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
              {rows.length === 0 && !isFetching && (
                <tr><td colSpan={visibleColumns.length + 1 + (onRemove ? 1 : 0)}><Empty /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          Page <span className="font-mono">{page + 1}</span> / <span className="font-mono">{pageCount}</span>
        </span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" disabled={page + 1 >= pageCount} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

function MobileCard({ customer, selected, onToggle, onOpen, onRemove }: any) {
  return (
    <div className={cn('rounded-lg border p-2.5', selected && 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/10')}>
      <div className="flex items-start gap-2">
        <Checkbox className="mt-0.5" checked={selected} onCheckedChange={onToggle} />
        <button type="button" onClick={onOpen} className="flex-1 text-left min-w-0">
          <div className="font-semibold text-sm truncate">{customer.name || 'Unnamed'}</div>
          <div className="text-[11px] text-muted-foreground font-mono">{customer.phone}</div>
          <div className="text-[10px] text-muted-foreground truncate">{customer.district || '—'}</div>
          <div className="mt-1 flex items-center gap-2 text-[10px]">
            <Badge variant="secondary">Orders: {customer.total_orders}</Badge>
            <Badge variant="secondary">৳{Math.round(customer.total_spent).toLocaleString()}</Badge>
            <Badge variant="outline">{customer.customer_type}</Badge>
          </div>
        </button>
        {onRemove && (
          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0"
            onClick={onRemove} title="Remove from audience">
            <Trash2 className="h-3.5 w-3.5 text-rose-600" />
          </Button>
        )}
      </div>
    </div>
  );
}

function Empty() {
  return <div className="text-center text-xs text-muted-foreground py-8">No customers match.</div>;
}

export default memo(CustomerPreviewTable);
