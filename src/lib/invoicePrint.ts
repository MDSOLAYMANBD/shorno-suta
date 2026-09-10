/**
 * Shared invoice print utility.
 * 
 * On desktop: uses window.print() with visible off-screen wrapper.
 * On mobile: uses html2canvas to render invoice as image, then opens
 *            an iframe-based print dialog (native browser print).
 */

const isMobileDevice = () => /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;

/**
 * Wait for all <img> inside an element to finish loading.
 */
async function waitForImages(el: HTMLElement, timeoutMs = 5000): Promise<void> {
  const imgs = Array.from(el.querySelectorAll('img'));
  if (imgs.length === 0) return;

  await Promise.all(imgs.map(img => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise<void>(resolve => {
      img.onload = () => resolve();
      img.onerror = () => resolve();
      setTimeout(resolve, timeoutMs);
    });
  }));
}

/**
 * Open an iframe with image(s) and trigger native print dialog.
 */
function printViaIframe(imgDataUrls: string[]): Promise<void> {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.left = '-9999px';
    iframe.style.top = '0';
    iframe.style.width = '148mm';
    iframe.style.height = '210mm';
    document.body.appendChild(iframe);

    const imgsHtml = imgDataUrls.map((src, i) =>
      `<img src="${src}" style="width:100%;${i > 0 ? 'page-break-before:always;' : ''}" />`
    ).join('');

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      resolve();
      return;
    }

    doc.open();
    doc.write(`<!DOCTYPE html><html><head><style>
      @page { size: A5; margin: 0; }
      * { margin: 0; padding: 0; }
      body { margin: 0; }
      img { display: block; width: 100%; }
    </style></head><body>${imgsHtml}</body></html>`);
    doc.close();

    // Wait for images to load inside iframe then print
    const imgsInIframe = Array.from(doc.querySelectorAll('img'));
    const loaded = imgsInIframe.map(img =>
      img.complete ? Promise.resolve() : new Promise<void>(r => { img.onload = () => r(); img.onerror = () => r(); })
    );

    Promise.all(loaded).then(() => {
      setTimeout(() => {
        try {
          iframe.contentWindow?.print();
        } catch (e) {
          console.error('[invoicePrint] iframe print failed:', e);
        }
        // Cleanup after delay
        setTimeout(() => {
          try { document.body.removeChild(iframe); } catch {}
          resolve();
        }, 2000);
      }, 300);
    });
  });
}

/**
 * Print invoice content from a ref element.
 */
export async function printInvoice(
  element: HTMLElement | null,
  _filename = 'invoice.pdf'
): Promise<void> {
  if (!element) {
    console.warn('[invoicePrint] No element provided');
    return;
  }

  await waitForImages(element);

  if (isMobileDevice()) {
    try {
      const html2canvasModule = await import('html2canvas');
      const html2canvas = html2canvasModule.default;

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: element.scrollWidth,
        height: element.scrollHeight,
        logging: false,
      });

      // Split canvas into A5-sized pages if content is taller than one page
      const a5HeightPx = canvas.width * (210 / 148); // A5 aspect ratio
      const imgDataUrls: string[] = [];

      if (canvas.height <= a5HeightPx * 1.05) {
        // Fits in one page
        imgDataUrls.push(canvas.toDataURL('image/jpeg', 0.92));
      } else {
        // Split into multiple pages
        const pages = Math.ceil(canvas.height / a5HeightPx);
        for (let i = 0; i < pages; i++) {
          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = canvas.width;
          pageCanvas.height = Math.min(a5HeightPx, canvas.height - i * a5HeightPx);
          const ctx = pageCanvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(canvas, 0, -i * a5HeightPx);
            imgDataUrls.push(pageCanvas.toDataURL('image/jpeg', 0.92));
          }
        }
      }

      await printViaIframe(imgDataUrls);
    } catch (err) {
      console.error('[invoicePrint] Mobile print failed, falling back:', err);
      window.print();
    }
  } else {
    window.print();
  }
}

/**
 * Print multiple invoices (bulk print).
 */
export async function printBulkInvoices(
  wrapperElement: HTMLElement | null,
  invoiceElements: HTMLElement[],
  _filename = 'invoices.pdf'
): Promise<void> {
  if (!wrapperElement || invoiceElements.length === 0) {
    console.warn('[invoicePrint] No elements provided for bulk print');
    return;
  }

  await Promise.all(invoiceElements.map(el => waitForImages(el)));

  if (isMobileDevice()) {
    try {
      const html2canvasModule = await import('html2canvas');
      const html2canvas = html2canvasModule.default;

      const imgDataUrls: string[] = [];
      for (const el of invoiceElements) {
        const canvas = await html2canvas(el, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false,
        });
        imgDataUrls.push(canvas.toDataURL('image/jpeg', 0.92));
      }

      await printViaIframe(imgDataUrls);
    } catch (err) {
      console.error('[invoicePrint] Mobile bulk print failed, falling back:', err);
      window.print();
    }
  } else {
    window.print();
  }
}
