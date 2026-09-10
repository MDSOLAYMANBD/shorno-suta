import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PhoneCall } from 'lucide-react';
import CallSimulationModal from './CallSimulationModal';

interface Props {
  conversationId: string | null;
  customerName: string;
  customerPhone: string;
}

export default function CallCustomerButton({ conversationId, customerName, customerPhone }: Props) {
  const [open, setOpen] = useState(false);
  if (!conversationId) return null;
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="h-8 gap-1"
        onClick={() => setOpen(true)}
        disabled={!customerPhone}
        title={customerPhone ? 'Call Customer' : 'No phone number'}
      >
        <PhoneCall className="h-3.5 w-3.5 text-emerald-600" />
        <span className="text-xs">Call</span>
      </Button>
      <CallSimulationModal
        open={open}
        onOpenChange={setOpen}
        conversationId={conversationId}
        customerName={customerName}
        customerPhone={customerPhone}
      />
    </>
  );
}
