// "Download all photos" of a product (admin: product list, dropshipping catalog). Each photo
// is fetched and saved as a file (WebP photos as JPG/PNG), one after another; a photo whose
// server does not allow that opens in a new tab, to be saved by hand. The CORE Shop app saves
// these files itself. The same as the CORE Shop engine.
import { toast } from 'sonner';
import { asJpgOrPng } from '@/lib/imageFormat';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The product's photos and its colours' own photos, each once. */
export function productPhotos(images: unknown, variantImages?: { color_images?: Record<string, unknown> } | null): string[] {
  const out: string[] = [];
  const add = (v: unknown) => {
    if (typeof v === 'string' && v.trim()) out.push(v.trim());
    else if (Array.isArray(v)) v.forEach(add);
  };
  add(images);
  Object.values(variantImages?.color_images || {}).forEach(add);
  return [...new Set(out)];
}

/** File names from the product's name in Latin letters (the phone's gallery shows them). */
const fileBase = (name: string) =>
  (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'product';

export async function downloadImages(urls: string[], name: string) {
  let opened = 0;
  for (let i = 0; i < urls.length; i++) {
    const a = document.createElement('a');
    let blobUrl = '';
    try {
      const res = await fetch(urls[i], { mode: 'cors' });
      if (!res.ok) throw new Error(String(res.status));
      const blob = await asJpgOrPng(await res.blob());
      const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg').replace(/[^a-z0-9]/g, '') || 'jpg';
      blobUrl = URL.createObjectURL(blob);
      a.href = blobUrl;
      a.download = `${fileBase(name)}-${i + 1}.${ext}`;
    } catch {
      a.href = urls[i];
      a.target = '_blank';
      a.rel = 'noopener';
      opened++;
    }
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (blobUrl) setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    // browsers drop downloads started all at once
    if (i < urls.length - 1) await wait(400);
  }
  return { total: urls.length, opened };
}

/** Downloads them and says how it went. */
export async function downloadImagesWithToast(urls: string[], name: string) {
  if (!urls.length) return toast.error('এই পণ্যে কোনো ছবি নেই');
  const bn = (n: number) => n.toLocaleString('bn-BD');
  const { total, opened } = await downloadImages(urls, name);
  if (opened) toast.info(`${bn(opened)}টি ছবি নতুন ট্যাবে খুলেছে — সেখান থেকে সেভ করুন।`);
  else toast.success(`${bn(total)}টি ছবি ডাউনলোড হয়েছে`);
}
