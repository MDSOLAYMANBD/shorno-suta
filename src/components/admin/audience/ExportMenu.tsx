// Export menu — channel-agnostic dropdown that emits one of six formats
// from the current Audience Engine filter. Heavy work runs async so the
// UI never blocks.

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, FileText, Phone, Users, Facebook, Globe, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { exportAudience, fetchAudienceForExport, type ExportFormat } from '@/lib/audience/export';
import type { AudienceFilter } from '@/lib/audience/types';

interface Props {
  filter: AudienceFilter;
  filenameBase?: string;
  disabled?: boolean;
}

const ITEMS: { id: ExportFormat; label: string; icon: any; hint?: string }[] = [
  { id: 'csv',      label: 'CSV',                    icon: FileText },
  { id: 'excel',    label: 'Excel (.xls)',           icon: FileSpreadsheet },
  { id: 'phones',   label: 'Phone Numbers Only',     icon: Phone },
  { id: 'full',     label: 'Full Customer List',     icon: Users },
  { id: 'facebook', label: 'Facebook Custom Audience', icon: Facebook },
  { id: 'google',   label: 'Google Customer Match',  icon: Globe },
];

export default function ExportMenu({ filter, filenameBase = 'audience', disabled }: Props) {
  const [busy, setBusy] = useState<ExportFormat | null>(null);

  const handle = async (fmt: ExportFormat) => {
    if (busy) return;
    setBusy(fmt);
    try {
      const customers = await fetchAudienceForExport(filter);
      if (customers.length === 0) {
        toast.info('এই অডিয়েন্সে কোনো গ্রাহক নেই');
        return;
      }
      exportAudience(fmt, customers, filenameBase);
      toast.success(`${customers.length.toLocaleString()} জন এক্সপোর্ট হয়েছে`);
    } catch (e: any) {
      toast.error(e?.message || 'এক্সপোর্টে সমস্যা');
    } finally {
      setBusy(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled || !!busy}>
          {busy ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Export Audience</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ITEMS.map((it) => {
          const Icon = it.icon;
          return (
            <DropdownMenuItem key={it.id} onClick={() => handle(it.id)} disabled={!!busy}>
              <Icon className="h-4 w-4 mr-2" /> {it.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
