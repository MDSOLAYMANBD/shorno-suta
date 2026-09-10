import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useUpdateSetting } from '@/hooks/useStoreSettings';
import { ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { ConnectedAssetsPanel } from './ConnectedAssetsPanel';
import type { IntegrationAsset } from '@/hooks/useIntegrationHealth';

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  appId: string;
  waConfigId: string;
  igConfigId: string;
  igEmbedUrl: string;
  refetch: () => void;
  assets?: IntegrationAsset[];
  checking?: boolean;
  onAssetReconnect?: (a: IntegrationAsset) => void;
  onAssetSync?: (a: IntegrationAsset) => void;
};

export function DeveloperSettingsDrawer({ open, onOpenChange, appId, waConfigId, igConfigId, igEmbedUrl, refetch, assets = [], checking, onAssetReconnect, onAssetSync }: Props) {
  const updateSetting = useUpdateSetting();
  const save = (key: string, value: string, currentValue: string, label: string) => {
    if (value === currentValue) return;
    updateSetting.mutate({ key, value }, { onSuccess: () => { toast.success(`${label} saved`); refetch(); } });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Developer Settings</SheetTitle>
          <SheetDescription>Meta App credentials. সাধারণ ব্যবহারকারীর এগুলো পরিবর্তনের প্রয়োজন নেই।</SheetDescription>
        </SheetHeader>
        <div className="space-y-5 mt-6">
          <div className="space-y-1.5">
            <Label htmlFor="dev-app-id">Meta App ID</Label>
            <Input id="dev-app-id" defaultValue={appId} placeholder="1234567890"
              onBlur={(e) => save('meta_app_id', e.target.value.trim(), appId, 'App ID')} />
            <p className="text-xs text-muted-foreground">Meta Developer Console → আপনার App-এর Dashboard থেকে নিন।</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dev-wa-cfg">WhatsApp Embedded Signup Config ID</Label>
            <Input id="dev-wa-cfg" defaultValue={waConfigId} placeholder="987654321..."
              onBlur={(e) => save('meta_wa_embedded_signup_config_id', e.target.value.trim(), waConfigId, 'WA Config')} />
            <p className="text-xs text-muted-foreground">App → WhatsApp → Embedded Signup → Configuration ID</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dev-ig-cfg">Instagram Login Config ID (optional)</Label>
            <Input id="dev-ig-cfg" defaultValue={igConfigId} placeholder="Facebook Login for Business → Instagram config ID"
              onBlur={(e) => save('meta_ig_login_config_id', e.target.value.trim(), igConfigId, 'IG Config')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dev-ig-url">Instagram Business Login URL (optional)</Label>
            <Input id="dev-ig-url" defaultValue={igEmbedUrl} placeholder="https://www.instagram.com/oauth/authorize?..."
              onBlur={(e) => save('meta_ig_business_login_url', e.target.value.trim(), igEmbedUrl, 'IG Embed URL')} />
            <p className="text-xs text-muted-foreground">দিলে Instagram বাটন সরাসরি Instagram Business Login খুলবে।</p>
          </div>
          <div className="text-xs text-muted-foreground border-t pt-4 space-y-1">
            <div>🔒 <strong>App Secret</strong> ও <strong>Verify Token</strong> Supabase secrets-এ সংরক্ষিত।</div>
            <div>Tokens যখনই connect হবে, secure ভাবে server-side সংরক্ষণ হয়।</div>
          </div>
          <Button asChild variant="outline" size="sm" className="w-full">
            <a href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open Meta Developer Console
            </a>
          </Button>

          {assets.length > 0 && (
            <div className="border-t pt-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Advanced — All Assets</div>
              <ConnectedAssetsPanel
                assets={assets}
                checking={checking}
                onReconnect={(a) => onAssetReconnect?.(a)}
                onSync={(a) => onAssetSync?.(a)}
              />
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
