import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Printer, Download, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { getColorPrimaryImage } from '@/lib/productVariants';

interface OrderRef {
  num: string;
  id: string;
}

interface VariantRow {
  size: string | null;
  sell_price: number;
  quantity: number;
  order_numbers: OrderRef[];
}

interface ProductGroup {
  key: string;
  product_name: string;
  color: string | null;
  image: string | null;
  variants: VariantRow[];
  totalQty: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  orderIds: string[];
}

/* ── build grouped data from raw order items ── */
function buildGroups(
  itemsData: any[],
  orderNumMap: Map<string, string>,
  productMap: Map<string, any>
): ProductGroup[] {
  // First build flat items keyed by product+color+size
  const flat = new Map<string, { product_name: string; color: string | null; size: string | null; image: string | null; sell_price: number; quantity: number; order_numbers: OrderRef[] }>();

  for (const item of itemsData) {
    const key = `${item.product_name}||${item.color || ''}||${item.size || ''}`;
    const product = item.product_id ? productMap.get(item.product_id) : null;
    const colorImage = getColorPrimaryImage((product?.variant_images as any)?.color_images, item.color);
    const image = colorImage || product?.images?.[0] || null;
    const orderNum = orderNumMap.get(item.order_id) || item.order_id.slice(0, 8);
    const orderRef: OrderRef = { num: orderNum, id: item.order_id };

    if (flat.has(key)) {
      const existing = flat.get(key)!;
      existing.quantity += item.quantity;
      if (!existing.order_numbers.some(o => o.id === item.order_id)) existing.order_numbers.push(orderRef);
    } else {
      flat.set(key, { product_name: item.product_name, color: item.color, size: item.size, image, sell_price: item.price, quantity: item.quantity, order_numbers: [orderRef] });
    }
  }

  // Group by product+color
  const groupMap = new Map<string, ProductGroup>();
  for (const item of flat.values()) {
    const gKey = `${item.product_name}||${item.color || ''}`;
    if (!groupMap.has(gKey)) {
      groupMap.set(gKey, { key: gKey, product_name: item.product_name, color: item.color, image: item.image, variants: [], totalQty: 0 });
    }
    const g = groupMap.get(gKey)!;
    g.variants.push({ size: item.size, sell_price: item.sell_price, quantity: item.quantity, order_numbers: item.order_numbers });
    g.totalQty += item.quantity;
  }

  // Sort groups by name, variants by size
  const groups = Array.from(groupMap.values()).sort((a, b) => a.product_name.localeCompare(b.product_name) || (a.color || '').localeCompare(b.color || ''));
  for (const g of groups) {
    g.variants.sort((a, b) => (a.size || '').localeCompare(b.size || ''));
  }
  return groups;
}

/* ── Print HTML with chamber layout ── */
const buildPrintHTML = (groups: ProductGroup[], orderCount: number, totalPcs: number, storeName?: string) => {
  const now = new Date();
  const dateStr = now.toLocaleDateString('bn-BD', { day: '2-digit', month: 'long', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' });
  const brand = storeName || 'স্বর্ণ সুতা';

  const groupRows = groups.map((g, gi) => {
    const imgHtml = g.image
      ? `<img src="${g.image}" width="48" height="48" style="object-fit:cover;border-radius:4px;border:1px solid #e5e7eb;" />`
      : `<div style="width:48px;height:48px;background:#f3f4f6;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#bbb;font-size:10px;">—</div>`;

    const variantRows = g.variants.map((v, vi) => {
      const orderNums = v.order_numbers.map(o => `<div style="font-family:'Courier New',monospace;font-size:11px;line-height:1.4;color:#000;font-weight:600;">${o.num}</div>`).join('');
      const borderTop = vi > 0 ? 'border-top:1px dashed #e5e7eb;' : '';
      return `<tr>
        <td style="text-align:center;padding:4px 6px;${borderTop}font-size:12px;color:#555;">${v.size || '—'}</td>
        <td style="padding:4px 6px;${borderTop}">${orderNums}</td>
        <td style="text-align:center;padding:4px 6px;${borderTop}font-size:12px;color:#555;">৳${v.sell_price}</td>
        <td style="text-align:center;padding:4px 6px;${borderTop}font-weight:700;font-size:15px;color:#111;">${v.quantity}</td>
        <td style="text-align:center;padding:4px 6px;${borderTop}"><div style="width:14px;height:14px;border:2px solid #ccc;border-radius:3px;margin:0 auto;"></div></td>
      </tr>`;
    }).join('');

    const totalRow = `<tr style="border-top:1px dotted #ddd;background:#f0fdf4;">
      <td colspan="3" style="text-align:right;padding:4px 8px;font-weight:600;font-size:12px;color:#555;">মোট:</td>
      <td style="text-align:center;padding:4px 6px;font-weight:800;font-size:14px;color:#16a34a;white-space:nowrap;"><span style="background:#dcfce7;border-radius:4px;padding:1px 6px;display:inline-flex;align-items:center;gap:2px;">${g.totalQty} পিস</span></td>
      <td></td>
    </tr>`;

    return `<tr style="border-top:2px solid #bbb;">
      <td style="text-align:center;vertical-align:middle;padding:8px 6px;font-weight:600;color:#555;font-size:13px;width:36px;">${gi + 1}</td>
      <td style="vertical-align:middle;padding:8px 6px;text-align:center;width:56px;">${imgHtml}</td>
      <td style="vertical-align:middle;padding:8px 10px;width:180px;">
        <div style="font-weight:600;font-size:13px;line-height:1.3;color:#111;">${g.product_name}</div>
        ${g.color ? `<div style="font-size:11px;color:#777;margin-top:2px;">কালার: ${g.color}</div>` : ''}
      </td>
      <td style="padding:0;vertical-align:top;">
        <table style="width:100%;border-collapse:collapse;">
          <tbody>${variantRows}${totalRow}</tbody>
        </table>
      </td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>অর্ডার চেকলিস্ট</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#222;}
  .brand-bar{height:4px;background:linear-gradient(90deg,#f85606,#ee4d7b,#a855f7,#3b82f6);}
  .header{padding:14px 20px 12px;display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1px solid #e5e7eb;}
  .header .brand{font-size:18px;font-weight:700;letter-spacing:-0.3px;}
  .header .brand small{font-size:10px;font-weight:400;color:#888;display:block;margin-top:1px;text-transform:uppercase;letter-spacing:0.5px;}
  .header .meta{text-align:right;font-size:10px;color:#666;line-height:1.6;}
  .stats{padding:8px 20px;display:flex;gap:20px;font-size:11px;color:#555;background:#fafafa;border-bottom:1px solid #e5e7eb;}
  .stats strong{color:#222;}
  .outer-table{width:100%;border-collapse:collapse;}
  .outer-table>thead>tr>th{background:#f1f3f5;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;color:#555;padding:6px 8px;border:1px solid #ddd;}
  .outer-table>tbody>tr>td{border:1px solid #ddd;vertical-align:middle;}
  .footer{padding:10px 20px;font-size:10px;color:#aaa;border-top:1px solid #e5e7eb;text-align:center;}
  @media print{body{padding:0;}@page{margin:6mm;}}
  tr{page-break-inside:avoid;break-inside:avoid;}
</style></head><body>
<div class="brand-bar"></div>
<div class="header">
  <div class="brand">${brand}<small>অর্ডার চেকলিস্ট</small></div>
  <div class="meta"><div>তারিখ: ${dateStr}</div><div>সময়: ${timeStr}</div></div>
</div>
<div class="stats">
  <span>অর্ডার: <strong>${orderCount}</strong> টি</span>
  <span>আইটেম: <strong>${groups.length}</strong> ধরন</span>
  <span>মোট পিস: <strong>${totalPcs}</strong></span>
</div>
<table class="outer-table">
  <thead>
    <tr>
      <th style="width:36px;">#</th>
      <th style="width:56px;">ছবি</th>
      <th>প্রোডাক্ট</th>
      <th>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <th style="width:60px;font-size:10px;font-weight:600;padding:0;border:none;text-align:center;">সাইজ</th>
            <th style="font-size:10px;font-weight:600;padding:0;border:none;text-align:center;">অর্ডার নং</th>
            <th style="width:55px;font-size:10px;font-weight:600;padding:0;border:none;text-align:center;">মূল্য</th>
            <th style="width:45px;font-size:10px;font-weight:600;padding:0;border:none;text-align:center;">পরিমাণ</th>
            <th style="width:35px;font-size:10px;font-weight:600;padding:0;border:none;text-align:center;">✓</th>
          </tr>
        </table>
      </th>
    </tr>
  </thead>
  <tbody>${groupRows}</tbody>
</table>
<div class="footer">Generated by ${brand} · ${dateStr}</div>
</body></html>`;
};

export default function OrderChecklistDialog({ open, onClose, orderIds }: Props) {
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const isMobile = useIsMobile();
  const { data: settings } = useStoreSettings();
  const storeName = settings?.store_name_bn || settings?.store_name || 'স্বর্ণ সুতা';

  // All variant keys for checkbox tracking
  const allKeys = useMemo(() => groups.flatMap(g => g.variants.map((v, vi) => `${g.key}||${v.size || ''}||${vi}`)), [groups]);
  const totalPcs = useMemo(() => groups.reduce((s, g) => s + g.totalQty, 0), [groups]);

  useEffect(() => {
    if (!open || orderIds.length === 0) return;
    setLoading(true);
    setChecked(new Set());

    (async () => {
      const { data: ordersData } = await supabase.from('orders').select('id, order_number').in('id', orderIds);
      const orderNumMap = new Map((ordersData || []).map((o: any) => [o.id, o.order_number]));

      const { data: itemsData } = await supabase.from('order_items')
        .select('id, order_id, product_id, product_name, price, quantity, color, size')
        .in('order_id', orderIds);

      if (!itemsData?.length) { setGroups([]); setLoading(false); return; }

      const productIds = [...new Set(itemsData.filter(i => i.product_id).map(i => i.product_id!))];
      const { data: products } = productIds.length > 0
        ? await supabase.from('products').select('id, images, variant_images').in('id', productIds)
        : { data: [] as any[] };
      const productMap = new Map((products || []).map((p: any) => [p.id, p]));

      setGroups(buildGroups(itemsData, orderNumMap, productMap));
      setLoading(false);
    })();
  }, [open, orderIds]);

  const toggleCheck = (key: string) => {
    setChecked(prev => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; });
  };
  const toggleAll = () => {
    setChecked(prev => prev.size === allKeys.length ? new Set() : new Set(allKeys));
  };

  const handlePrint = () => {
    const html = buildPrintHTML(groups, orderIds.length, totalPcs, storeName);
    const w = window.open('', '_blank');
    if (!w) { window.print(); return; }
    w.document.write(html);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 600);
  };

  const handlePdfDownload = async () => {
    setPdfLoading(true);
    try {
      const [html2canvasModule, jsPDFModule] = await Promise.all([import('html2canvas'), import('jspdf')]);
      const html2canvas = html2canvasModule.default;
      const jsPDF = jsPDFModule.jsPDF;

      const container = document.createElement('div');
      container.style.cssText = 'position:fixed;left:-9999px;top:0;width:800px;background:#fff;';
      const htmlStr = buildPrintHTML(groups, orderIds.length, totalPcs, storeName);
      container.innerHTML = htmlStr.replace(/<!DOCTYPE.*?<body>/s, '').replace(/<\/body>.*$/s, '');
      document.body.appendChild(container);

      await new Promise(r => setTimeout(r, 400));
      const canvas = await html2canvas(container, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff', logging: false });
      document.body.removeChild(container);

      const a4W = 210, a4H = 297, margin = 10;
      const usableW = a4W - margin * 2;
      const usableH = a4H - margin * 2;

      // Calculate how many pages we need
      const imgWPx = canvas.width;
      const imgHPx = canvas.height;
      const scale = usableW / imgWPx; // mm per px
      const totalHMm = imgHPx * scale;
      const pageCount = Math.ceil(totalHMm / usableH);

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      for (let p = 0; p < pageCount; p++) {
        if (p > 0) pdf.addPage();

        // Slice the canvas for this page
        const srcY = Math.round((p * usableH) / scale);
        const srcH = Math.min(Math.round(usableH / scale), imgHPx - srcY);
        if (srcH <= 0) break;

        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = imgWPx;
        pageCanvas.height = srcH;
        const ctx = pageCanvas.getContext('2d')!;
        ctx.drawImage(canvas, 0, srcY, imgWPx, srcH, 0, 0, imgWPx, srcH);

        const pageImgH = srcH * scale;
        pdf.addImage(pageCanvas.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, usableW, pageImgH);
      }

      const blob = pdf.output('blob');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `checklist-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      console.error('[Checklist PDF]', err);
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" fullScreen={isMobile}>
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-sm md:text-base">📋 চেকলিস্ট ({orderIds.length}টি অর্ডার · {totalPcs}টি পিস)</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handlePrint} disabled={loading || groups.length === 0}>
                <Printer className="h-3 w-3 mr-1" /> প্রিন্ট
              </Button>
              <Button size="sm" variant="outline" onClick={handlePdfDownload} disabled={loading || pdfLoading || groups.length === 0}>
                {pdfLoading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Download className="h-3 w-3 mr-1" />}
                PDF
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : groups.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">কোনো আইটেম পাওয়া যায়নি</p>
        ) : (
          <div>
            {/* Select all */}
            <div className="flex items-center gap-2 mb-3">
              <Checkbox checked={allKeys.length > 0 && checked.size === allKeys.length} onCheckedChange={toggleAll} />
              <span className="text-xs text-muted-foreground">সব সিলেক্ট ({checked.size}/{allKeys.length})</span>
            </div>

            {/* Chamber-style table */}
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-muted text-muted-foreground text-[10px] uppercase tracking-wide">
                    <th className="border-b px-2 py-2 text-center w-8">#</th>
                    <th className="border-b px-2 py-2 text-center w-14">ছবি</th>
                    <th className="border-b px-3 py-2 text-left" style={{ width: '180px' }}>প্রোডাক্ট</th>
                    <th className="border-b px-2 py-2 text-center w-16">সাইজ</th>
                    <th className="border-b px-2 py-2 text-left">অর্ডার নং</th>
                    <th className="border-b px-2 py-2 text-center w-14">মূল্য</th>
                    <th className="border-b px-2 py-2 text-center w-12">পরিমাণ</th>
                    <th className="border-b px-2 py-2 text-center w-8">✓</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g, gi) => (
                    <tr key={g.key} className="border-t-2 border-t-border align-top">
                      {/* # */}
                      <td className="px-2 py-2.5 text-center text-muted-foreground font-medium">{gi + 1}</td>
                      {/* Image */}
                      <td className="px-2 py-2.5 text-center">
                        {g.image ? (
                          <img src={g.image} alt="" className="w-[48px] h-[48px] object-cover rounded mx-auto" />
                        ) : (
                          <div className="w-[48px] h-[48px] bg-muted rounded flex items-center justify-center text-xs text-muted-foreground mx-auto">—</div>
                        )}
                      </td>
                      {/* Product info */}
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-sm leading-tight">{g.product_name}</div>
                        {g.color && <span className="text-[11px] text-muted-foreground mt-0.5 block">কালার: {g.color}</span>}
                      </td>
                      {/* Variants chamber - nested rows inside one cell spanning remaining columns */}
                      <td colSpan={5} className="p-0">
                        <table className="w-full border-collapse">
                          <tbody>
                            {g.variants.map((v, vi) => {
                              const vKey = `${g.key}||${v.size || ''}||${vi}`;
                              const isChecked = checked.has(vKey);
                              return (
                                <tr
                                  key={vKey}
                                  className={`${vi > 0 ? 'border-t border-dashed border-border/50' : ''} ${isChecked ? 'opacity-40 bg-muted/30' : 'hover:bg-muted/10'} transition-all`}
                                >
                                  <td className="px-2 py-1.5 text-center text-xs text-muted-foreground" style={{ width: '64px' }}>{v.size || '—'}</td>
                                  <td className="px-2 py-1.5">
                                    <div className="flex flex-col">
                                      {v.order_numbers.map(o => (
                                        <a key={o.id} href={`/admin/orders?preview=${o.id}`} target="_blank" rel="noopener noreferrer" className="text-[11px] font-mono font-semibold text-primary hover:underline leading-tight">{o.num}</a>
                                      ))}
                                    </div>
                                  </td>
                                  <td className="px-2 py-1.5 text-center text-xs" style={{ width: '56px' }}>৳{v.sell_price}</td>
                                  <td className="px-2 py-1.5 text-center font-bold text-sm text-primary" style={{ width: '48px' }}>{v.quantity}</td>
                                  <td className="px-2 py-1.5 text-center" style={{ width: '32px' }}>
                                    <Checkbox checked={isChecked} onCheckedChange={() => toggleCheck(vKey)} />
                                  </td>
                                </tr>
                              );
                            })}
                            {/* Total row */}
                            <tr className="border-t border-dotted border-border/20 bg-primary/5">
                              <td className="px-2 py-1.5 text-right text-xs font-medium text-muted-foreground" colSpan={2}>মোট:</td>
                              <td className="px-2 py-1.5" style={{ width: '56px' }}></td>
                              <td className="px-2 py-1.5 text-center font-bold text-sm text-primary whitespace-nowrap" style={{ width: '48px' }}>
                                <span className="bg-primary/10 rounded px-1.5 py-0.5 inline-flex items-center gap-0.5">{g.totalQty} <span>পিস</span></span>
                              </td>
                              <td style={{ width: '32px' }}></td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 pt-3 border-t text-xs text-muted-foreground flex gap-4">
              <span>{groups.length} ভিন্ন আইটেম</span>
              <span>মোট {totalPcs} পিস</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
