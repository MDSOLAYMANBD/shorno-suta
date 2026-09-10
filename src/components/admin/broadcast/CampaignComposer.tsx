import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AudienceSelector, { AudienceFilter } from './AudienceSelector';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

async function buildAudience(filter: AudienceFilter) {
  let q = supabase
    .from('inbox_conversations' as any)
    .select('id, customer_name, customer_phone, platform, lead_score');
  if (filter.scope === 'lead_score' && filter.lead_score) q = q.eq('lead_score', filter.lead_score);
  if (filter.scope === 'platform' && filter.platform) q = q.eq('platform', filter.platform);
  const { data } = await q.limit(1000);
  return (data || []) as any[];
}

export default function CampaignComposer({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState('whatsapp');
  const [message, setMessage] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [filter, setFilter] = useState<AudienceFilter>({ scope: 'all' });
  const [scheduleNow, setScheduleNow] = useState(true);
  const [scheduledAt, setScheduledAt] = useState('');

  useEffect(() => {
    if (open) {
      setName(''); setPlatform('whatsapp'); setMessage(''); setMediaUrl('');
      setFilter({ scope: 'all' }); setScheduleNow(true); setScheduledAt('');
    }
  }, [open]);

  const { data: audience = [] } = useQuery({
    queryKey: ['broadcast-audience-preview', filter],
    queryFn: () => buildAudience(filter),
    enabled: open,
  });

  const audienceSize = audience.length;

  const saveMutation = useMutation({
    mutationFn: async (sendNow: boolean) => {
      const { data: { user } } = await supabase.auth.getUser();
      const status = sendNow ? 'sending' : 'scheduled';
      const { data: campaign, error } = await supabase
        .from('inbox_broadcast_campaigns' as any)
        .insert({
          name: name.trim() || 'Untitled',
          platform,
          message: message.trim(),
          media_url: mediaUrl.trim() || null,
          audience_filter: filter as any,
          audience_size: audienceSize,
          status,
          scheduled_at: sendNow ? new Date().toISOString() : (scheduledAt ? new Date(scheduledAt).toISOString() : null),
          created_by: user?.id || null,
        } as any)
        .select('id')
        .single();
      if (error) throw error;

      // Insert recipients
      if (audience.length > 0) {
        const rows = audience.map((c: any) => ({
          campaign_id: (campaign as any).id,
          conversation_id: c.id,
          customer_name: c.customer_name || '',
          customer_phone: c.customer_phone || '',
          status: 'pending',
        }));
        // Chunk into groups of 200
        for (let i = 0; i < rows.length; i += 200) {
          await supabase.from('inbox_broadcast_recipients' as any).insert(rows.slice(i, i + 200) as any);
        }
      }

      // If send now → invoke simulation function
      if (sendNow) {
        await supabase.functions.invoke('inbox-broadcast-simulate', {
          body: { campaign_id: (campaign as any).id },
        });
      }

      return (campaign as any).id;
    },
    onSuccess: () => {
      toast.success('ক্যাম্পেইন সংরক্ষিত');
      qc.invalidateQueries({ queryKey: ['broadcast-campaigns'] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error('ব্যর্থ: ' + e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>নতুন ব্রডকাস্ট ক্যাম্পেইন</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">নাম</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="যেমনঃ ঈদ অফার ২০২৬" />
          </div>
          <div>
            <Label className="text-xs">প্ল্যাটফর্ম</Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="messenger">Messenger</SelectItem>
                <SelectItem value="both">দুটিই</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">মেসেজ</Label>
            <Textarea value={message} onChange={e => setMessage(e.target.value)} className="h-20" placeholder="আপনার মেসেজ লিখুন..." />
          </div>
          <div>
            <Label className="text-xs">মিডিয়া URL (অপশনাল)</Label>
            <Input value={mediaUrl} onChange={e => setMediaUrl(e.target.value)} placeholder="https://..." />
          </div>
          <AudienceSelector value={filter} onChange={setFilter} estimatedSize={audienceSize} />
          <div>
            <Label className="text-xs">সময়</Label>
            <div className="flex gap-2 items-center">
              <Select value={scheduleNow ? 'now' : 'later'} onValueChange={v => setScheduleNow(v === 'now')}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="now">এখন পাঠান</SelectItem>
                  <SelectItem value="later">পরে শিডিউল</SelectItem>
                </SelectContent>
              </Select>
              {!scheduleNow && (
                <Input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => saveMutation.mutate(false)} disabled={saveMutation.isPending}>
            ড্রাফট সেভ
          </Button>
          <Button onClick={() => saveMutation.mutate(scheduleNow)} disabled={!message.trim() || saveMutation.isPending || audienceSize === 0}>
            {scheduleNow ? 'এখন সিমুলেট পাঠান' : 'শিডিউল করুন'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
