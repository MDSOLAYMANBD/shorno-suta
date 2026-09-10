import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Upload, Loader2, Gift } from 'lucide-react';
import { toast } from 'sonner';
import { optimizeImage } from '@/lib/imageOptimizer';
import { useIsMobile } from '@/hooks/use-mobile';

export default function AddGiveawayDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [profileLink, setProfileLink] = useState('');
  const [productName, setProductName] = useState('');
  const [profileScreenshot, setProfileScreenshot] = useState<File | null>(null);
  const [packagingImage, setPackagingImage] = useState<File | null>(null);
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const uploadImage = async (file: File, prefix: string): Promise<string> => {
    const optimized = await optimizeImage(file);
    const ext = 'webp';
    const path = `giveaway/${prefix}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('product-images').upload(path, optimized);
    if (error) throw error;
    const { data } = supabase.storage.from('product-images').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSubmit = async () => {
    if (!customerName.trim() || !productName.trim()) {
      toast.error('কাস্টমারের নাম ও প্রোডাক্টের নাম দিন');
      return;
    }
    setLoading(true);
    try {
      let profileScreenshotUrl = '';
      let packagingImageUrl = '';

      if (profileScreenshot) {
        profileScreenshotUrl = await uploadImage(profileScreenshot, 'profile');
      }
      if (packagingImage) {
        packagingImageUrl = await uploadImage(packagingImage, 'packaging');
      }

      const { error } = await supabase.from('giveaway_entries').insert({
        customer_name: customerName.trim(),
        profile_link: profileLink.trim() || null,
        product_name: productName.trim(),
        profile_screenshot: profileScreenshotUrl || null,
        packaging_image: packagingImageUrl || null,
      });

      if (error) throw error;

      toast.success('গিফট এন্ট্রি যোগ হয়েছে!');
      queryClient.invalidateQueries({ queryKey: ['giveaway-entries'] });
      setOpen(false);
      setCustomerName('');
      setProfileLink('');
      setProductName('');
      setProfileScreenshot(null);
      setPackagingImage(null);
    } catch (err: any) {
      toast.error(err.message || 'এন্ট্রি যোগ করতে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" className="gap-2 font-bold shadow-lg shadow-primary/25">
          <Gift className="h-4 w-4" />
          নতুন গিফট
        </Button>
      </DialogTrigger>
      <DialogContent fullScreen={isMobile} className={isMobile ? '' : 'max-w-md'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            নতুন গিফট এন্ট্রি
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>কাস্টমারের নাম *</Label>
            <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="নাম লিখুন" />
          </div>
          <div className="space-y-1.5">
            <Label>প্রোডাক্টের নাম *</Label>
            <Input value={productName} onChange={e => setProductName(e.target.value)} placeholder="যেমন: শাড়ি, থ্রি পিস" />
          </div>
          <div className="space-y-1.5">
            <Label>প্রোফাইল লিংক</Label>
            <Input value={profileLink} onChange={e => setProfileLink(e.target.value)} placeholder="https://facebook.com/..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>প্রোফাইল স্ক্রিনশট</Label>
              <label className="flex flex-col items-center justify-center gap-1 border-2 border-dashed rounded-lg p-3 cursor-pointer hover:bg-muted/50 transition-colors text-center">
                {profileScreenshot ? (
                  <img src={URL.createObjectURL(profileScreenshot)} alt="" className="w-full h-20 object-cover rounded" />
                ) : (
                  <>
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">ছবি আপলোড</span>
                  </>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={e => setProfileScreenshot(e.target.files?.[0] || null)} />
              </label>
            </div>
            <div className="space-y-1.5">
              <Label>প্যাকেজিং ছবি</Label>
              <label className="flex flex-col items-center justify-center gap-1 border-2 border-dashed rounded-lg p-3 cursor-pointer hover:bg-muted/50 transition-colors text-center">
                {packagingImage ? (
                  <img src={URL.createObjectURL(packagingImage)} alt="" className="w-full h-20 object-cover rounded" />
                ) : (
                  <>
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">ছবি আপলোড</span>
                  </>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={e => setPackagingImage(e.target.files?.[0] || null)} />
              </label>
            </div>
          </div>
          <Button onClick={handleSubmit} disabled={loading} className="w-full font-bold">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'সেভ করুন'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
