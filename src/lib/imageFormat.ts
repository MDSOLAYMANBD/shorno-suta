// Product photos are kept as WebP (small, fast pages). A photo someone downloads to post
// elsewhere (Facebook, WhatsApp, a phone's gallery) is saved as JPG instead, or as PNG when it
// has see-through parts, because many apps take WebP badly. Only the downloads use this.

const KEEP = /^image\/(jpe?g|png|gif|svg\+xml)$/i;

const toBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

/** True when some pixel is not fully opaque. */
function seeThrough(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const px = ctx.getImageData(0, 0, w, h).data;
  for (let i = 3; i < px.length; i += 4) if (px[i] < 255) return true;
  return false;
}

/**
 * The photo as JPG (PNG when it has see-through parts). JPG, PNG, GIF and SVG come back as
 * they are, and so does any photo the browser cannot redraw.
 */
export async function asJpgOrPng(blob: Blob): Promise<Blob> {
  if (KEEP.test(blob.type)) return blob;
  try {
    const bmp = await createImageBitmap(blob);
    const { width: w, height: h } = bmp;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx || !w || !h) { bmp.close(); return blob; }
    ctx.drawImage(bmp, 0, 0);
    bmp.close();
    const out = seeThrough(ctx, w, h) ? await toBlob(canvas, 'image/png') : await toBlob(canvas, 'image/jpeg', 0.92);
    return out && out.size ? out : blob;
  } catch {
    return blob;
  }
}
