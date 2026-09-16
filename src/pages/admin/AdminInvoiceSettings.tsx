import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Save, Image as ImageIcon, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { useSiteConfig, useSaveSiteConfig, DEFAULT_INVOICE_CONFIG } from '@/hooks/useSiteConfig';
import ColorPickerWithRecent from '@/components/admin/ColorPickerWithRecent';
import MediaCenter from '@/components/admin/MediaCenter';
import OrderInvoice from '@/components/admin/OrderInvoice';

export default function AdminInvoiceSettings() {
  const navigate = useNavigate();
  const { data: savedInvoiceConfig } = useSiteConfig('invoice_config');
  const saveConfig = useSaveSiteConfig();
  const [invoiceForm, setInvoiceForm] = useState({ ...DEFAULT_INVOICE_CONFIG });
  const [logoMediaOpen, setLogoMediaOpen] = useState(false);
  const [sigMediaOpen, setSigMediaOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (savedInvoiceConfig) {
      setInvoiceForm(prev => ({ ...prev, ...savedInvoiceConfig }));
    }
  }, [savedInvoiceConfig]);

  const saveInvoiceConfig = async () => {
    try {
      await saveConfig.mutateAsync({ key: 'invoice_config', value: invoiceForm });
      toast.success('ইনভয়েস সেটিংস সেভ হয়েছে');
    } catch {
      toast.error('সেভ করতে সমস্যা হয়েছে');
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/site-editor')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> ফিরে যান
        </Button>
        <h1 className="text-2xl font-bold">🧾 ইনভয়েস / ডেলিভারি মেমো সেটিংস</h1>
      </div>
      <Card>
        <CardContent className="space-y-5 pt-6">
          <div>
            <Label className="mb-1.5 block">Brand Color (বর্ডার, হেডার, টোটালে ব্যবহার হবে)</Label>
            <ColorPickerWithRecent
              value={invoiceForm.brand_color}
              onChange={c => setInvoiceForm(p => ({ ...p, brand_color: c }))}
            />
          </div>
          <div>
            <Label>Business Name</Label>
            <Input value={invoiceForm.business_name} onChange={e => setInvoiceForm(p => ({ ...p, business_name: e.target.value }))} placeholder="SHORNO SUTA" />
          </div>
          <div>
            <Label className="mb-1.5 block">Business Logo</Label>
            <div className="flex items-center gap-3">
              {invoiceForm.logo_url ? (
                <img src={invoiceForm.logo_url} alt="Logo" className="object-contain rounded border"
                  style={{ height: `${invoiceForm.logo_size || 60}px` }} />
              ) : (
                <div className="rounded border border-dashed flex items-center justify-center text-muted-foreground"
                  style={{ width: '240px', height: '57px' }}>
                  <ImageIcon className="h-5 w-5" />
                </div>
              )}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setLogoMediaOpen(true)}>
                  <ImageIcon className="h-4 w-4 mr-1" /> ছবি সিলেক্ট
                </Button>
                {invoiceForm.logo_url && (
                  <Button size="sm" variant="ghost" onClick={() => setInvoiceForm(p => ({ ...p, logo_url: '' }))}>সরান</Button>
                )}
              </div>
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block">লোগো সাইজ ({invoiceForm.logo_size || 60}px)</Label>
            <Slider
              value={[invoiceForm.logo_size || 60]}
              onValueChange={([v]) => setInvoiceForm(p => ({ ...p, logo_size: v }))}
              min={30}
              max={120}
              step={2}
              className="w-full"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Phone Number</Label>
              <Input value={invoiceForm.phone} onChange={e => setInvoiceForm(p => ({ ...p, phone: e.target.value }))} placeholder="+8809617-356977" />
            </div>
            <div>
              <Label>WhatsApp Number</Label>
              <Input value={invoiceForm.whatsapp} onChange={e => setInvoiceForm(p => ({ ...p, whatsapp: e.target.value }))} placeholder="+8801843-711211" />
            </div>
          </div>
          <div>
            <Label>Business Address</Label>
            <Input value={invoiceForm.address} onChange={e => setInvoiceForm(p => ({ ...p, address: e.target.value }))} placeholder="House-64, Narsari Goli..." />
          </div>
          <div>
            <Label>Header Note (হেডার কার্ডের মাঝখানে দেখাবে)</Label>
            <Textarea value={invoiceForm.header_note || ''} onChange={e => setInvoiceForm(p => ({ ...p, header_note: e.target.value }))} rows={2} placeholder="✨ প্রিয় গ্রাহক, আলহামদুলিল্লাহ, আপনার অর্ডার পেয়ে আমরা সত্যিই আনন্দিত।" />
          </div>
          <div>
            <Label>Footer / Thank You Message</Label>
            <Textarea value={invoiceForm.footer_message} onChange={e => setInvoiceForm(p => ({ ...p, footer_message: e.target.value }))} rows={4} placeholder="ধন্যবাদ বার্তা..." />
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox id="enable_signature" checked={invoiceForm.enable_signature} onCheckedChange={(v) => setInvoiceForm(p => ({ ...p, enable_signature: !!v }))} />
              <Label htmlFor="enable_signature" className="cursor-pointer">Enable Authorized Signature (ইনভয়েসে সিগনেচার দেখাবে)</Label>
            </div>
            {invoiceForm.enable_signature && (
              <div>
                <Label className="mb-1.5 block">Authorized Signature Image</Label>
                <div className="flex items-center gap-3">
                  {invoiceForm.signature_url ? (
                    <img src={invoiceForm.signature_url} alt="Signature" className="h-12 object-contain rounded border" />
                  ) : (
                    <div className="h-12 w-24 rounded border border-dashed flex items-center justify-center text-muted-foreground text-xs">No signature</div>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setSigMediaOpen(true)}>
                      <ImageIcon className="h-4 w-4 mr-1" /> সিলেক্ট
                    </Button>
                    {invoiceForm.signature_url && (
                      <Button size="sm" variant="ghost" onClick={() => setInvoiceForm(p => ({ ...p, signature_url: '' }))}>সরান</Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox id="enable_qr" checked={invoiceForm.enable_qr} onCheckedChange={(v) => setInvoiceForm(p => ({ ...p, enable_qr: !!v }))} />
              <Label htmlFor="enable_qr" className="cursor-pointer">Enable QR Code (হেডারে QR দেখাবে)</Label>
            </div>
            {invoiceForm.enable_qr && (
              <div className="space-y-2">
                <Label>QR Code Target</Label>
                <select value={invoiceForm.qr_target} onChange={e => setInvoiceForm(p => ({ ...p, qr_target: e.target.value as 'website' | 'whatsapp' | 'custom' }))} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="website">Website Home URL</option>
                  <option value="whatsapp">WhatsApp Chat Link</option>
                  <option value="custom">Custom URL</option>
                </select>
                {invoiceForm.qr_target === 'custom' && (
                  <div>
                    <Label>Custom QR URL</Label>
                    <Input value={invoiceForm.qr_custom_url || ''} onChange={e => setInvoiceForm(p => ({ ...p, qr_custom_url: e.target.value }))} placeholder="https://example.com" />
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={saveInvoiceConfig} disabled={saveConfig.isPending} className="flex-1">
              <Save className="h-4 w-4 mr-2" />
              {saveConfig.isPending ? 'সেভ হচ্ছে...' : 'ইনভয়েস সেটিংস সেভ করুন'}
            </Button>
            <Button variant="outline" onClick={() => setPreviewOpen(true)}>
              <Eye className="h-4 w-4 mr-2" /> প্রিভিউ
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-[170mm] max-h-[90vh] overflow-auto p-2">
          <DialogHeader>
            <DialogTitle>ইনভয়েস প্রিভিউ</DialogTitle>
          </DialogHeader>
          <OrderInvoice
            order={{
              order_number: 'SD-000001',
              created_at: new Date().toISOString(),
              customer_name: 'ফারহানা আক্তার',
              customer_phone: '01712345678',
              customer_address: '৬৪, নবীনগর, কামরাঙ্গীরচর, ঢাকা',
              city: 'ঢাকা',
              order_origin: 'website',
              subtotal: 1500,
              delivery_charge: 70,
              total: 1570,
            }}
            items={[
              { id: '1', product_name: 'থ্রি পিস সেট (ডিজাইন-১)', quantity: 1, price: 850, size: 'L', color: 'লাল' },
              { id: '2', product_name: 'বোরখা (প্রিমিয়াম)', quantity: 1, price: 650, size: 'Free', color: 'কালো' },
            ]}
          />
        </DialogContent>
      </Dialog>

      <MediaCenter open={logoMediaOpen} onOpenChange={setLogoMediaOpen} onSelect={(urls) => setInvoiceForm(p => ({ ...p, logo_url: urls[0] || '' }))} />
      <MediaCenter open={sigMediaOpen} onOpenChange={setSigMediaOpen} onSelect={(urls) => setInvoiceForm(p => ({ ...p, signature_url: urls[0] || '' }))} />
    </div>
  );
}
