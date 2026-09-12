import { useState } from 'react';
import { Share2, Copy, Check, MessageSquare, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';

type EntityType = 'person' | 'unit' | 'unit-module';

interface Props {
  entityType: EntityType;
  entityId: string;
  entityName: string;
  /** For unit-module: the module type segment (e.g. "party", "kapor", "production", "work-orders") */
  extraPath?: string;
  /** Optional override origin (defaults to current location origin or production domain) */
  origin?: string;
  className?: string;
}

const BASE_ORIGIN = 'https://www.shornosuta.com';

function buildHishabUrl(p: Props): string {
  const origin = p.origin || (typeof window !== 'undefined' ? window.location.origin : BASE_ORIGIN);
  // Always use production domain for shareable links so they don't break across previews
  const shareOrigin = (origin.includes('shornosuta.com') || origin.includes('shorno-suta.vercel.app')) ? origin : BASE_ORIGIN;
  if (p.entityType === 'unit-module' && p.extraPath) {
    return `${shareOrigin}/hishab/unit-module/${p.entityId}/${p.extraPath}`;
  }
  return `${shareOrigin}/hishab/${p.entityType}/${p.entityId}`;
}

export default function AccountingShareButton(props: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const url = buildHishabUrl(props);
  const shareText = `স্বর্ণ সুতা ❤️\n\n${props.entityName} এর হিসাব দেখুন:\n${url}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      toast.success('লিংক কপি হয়েছে!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('কপি করতে সমস্যা হয়েছে');
    }
  };

  const handleWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
    setOpen(false);
  };

  const handleView = () => {
    window.open(url, '_blank');
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={props.className}
          title="হিসাব শেয়ার করুন"
        >
          <Share2 className="h-4 w-4 mr-1" />
          শেয়ার
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2 z-[1002]" align="end">
        <p className="text-xs font-semibold text-muted-foreground px-2 py-1">হিসাব শেয়ার</p>
        <button
          onClick={handleCopy}
          className="w-full flex items-center gap-2 px-2 py-2 text-sm rounded hover:bg-muted text-left"
        >
          {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
          {copied ? 'কপি হয়েছে!' : 'লিংক কপি করুন'}
        </button>
        <button
          onClick={handleWhatsApp}
          className="w-full flex items-center gap-2 px-2 py-2 text-sm rounded hover:bg-muted text-left"
        >
          <MessageSquare className="h-4 w-4 text-green-600" />
          WhatsApp-এ পাঠান
        </button>
        <button
          onClick={handleView}
          className="w-full flex items-center gap-2 px-2 py-2 text-sm rounded hover:bg-muted text-left"
        >
          <Eye className="h-4 w-4" />
          হিসাব দেখুন
        </button>
      </PopoverContent>
    </Popover>
  );
}
