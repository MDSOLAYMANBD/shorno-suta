import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Megaphone, Plus } from 'lucide-react';
import CampaignComposer from '@/components/admin/broadcast/CampaignComposer';
import CampaignList from '@/components/admin/broadcast/CampaignList';

export default function AdminBroadcast() {
  const [composerOpen, setComposerOpen] = useState(false);
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-lg font-bold">ব্রডকাস্ট ক্যাম্পেইন</h1>
            <p className="text-xs text-muted-foreground">WhatsApp / Messenger বাল্ক ক্যাম্পেইন (সিমুলেশন মোড)</p>
          </div>
        </div>
        <Button onClick={() => setComposerOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> নতুন ক্যাম্পেইন
        </Button>
      </div>
      <CampaignList />
      <CampaignComposer open={composerOpen} onOpenChange={setComposerOpen} />
    </div>
  );
}
