import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface Props {
  visible: boolean;
}

// Local-only typing indicator for the staff side (visual cue, no DB).
export default function TypingIndicator({ visible }: Props) {
  const [dots, setDots] = useState('.');
  useEffect(() => {
    if (!visible) return;
    const t = setInterval(() => setDots(d => d.length >= 3 ? '.' : d + '.'), 400);
    return () => clearInterval(t);
  }, [visible]);
  if (!visible) return null;
  return (
    <div className="text-[11px] text-muted-foreground flex items-center gap-1 px-2">
      <Loader2 className="h-3 w-3 animate-spin" />
      টাইপ করছেন{dots}
    </div>
  );
}
