import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Send } from 'lucide-react';

interface SendNotificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: any[];
}

export default function SendNotificationDialog({ open, onOpenChange, employees }: SendNotificationDialogProps) {
  const [mode, setMode] = useState<'all' | 'single'>('all');
  const [recipientId, setRecipientId] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error('বার্তা লিখুন');
      return;
    }
    if (mode === 'single' && !recipientId) {
      toast.error('একজন staff সিলেক্ট করুন');
      return;
    }

    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const groupId = crypto.randomUUID();
      const currentEmp = employees.find(e => e.user_id === session.user.id);
      const senderName = currentEmp?.full_name || session.user.user_metadata?.full_name || session.user.email || '';

      const recipients = mode === 'all'
        ? employees.filter(e => e.user_id !== session.user.id).map(e => e.user_id)
        : [recipientId];

      const notifications = recipients.map(rid => ({
        sender_id: session.user.id,
        recipient_id: rid,
        message: message.trim(),
        group_id: groupId,
        sender_name: senderName,
      }));

      const { error } = await supabase.from('staff_notifications' as any).insert(notifications);
      if (error) throw error;

      toast.success(`${recipients.length} জনকে বার্তা পাঠানো হয়েছে`);
      setMessage('');
      setRecipientId('');
      setMode('all');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'বার্তা পাঠানো ব্যর্থ');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Staff দের বার্তা পাঠান</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <RadioGroup value={mode} onValueChange={(v) => setMode(v as 'all' | 'single')} className="flex gap-4">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="all" id="all" />
              <Label htmlFor="all">সবাইকে</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="single" id="single" />
              <Label htmlFor="single">নির্দিষ্ট staff</Label>
            </div>
          </RadioGroup>

          {mode === 'single' && (
            <Select value={recipientId} onValueChange={setRecipientId}>
              <SelectTrigger>
                <SelectValue placeholder="Staff সিলেক্ট করুন" />
              </SelectTrigger>
              <SelectContent>
                {employees.map(emp => (
                  <SelectItem key={emp.user_id} value={emp.user_id}>
                    {emp.full_name || emp.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="বার্তা লিখুন..."
            rows={4}
          />
        </div>
        <DialogFooter>
          <Button onClick={handleSend} disabled={sending}>
            <Send className="h-4 w-4 mr-2" />
            {sending ? 'পাঠানো হচ্ছে...' : 'পাঠান'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
