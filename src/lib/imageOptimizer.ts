/**
 * Client-side image optimizer
 * Resizes and converts images to WebP before upload
 */

interface OptimizeOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  skipIfSmaller?: number; // Skip optimization if file is smaller than this (bytes)
}

const DEFAULT_OPTIONS: Required<OptimizeOptions> = {
  maxWidth: 1200,
  maxHeight: 1200,
  quality: 0.80,
  skipIfSmaller: 100 * 1024, // 100KB
};

function supportsWebP(): boolean {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL('image/webp').startsWith('data:image/webp');
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export async function optimizeImage(
  file: File,
  options: OptimizeOptions = {}
): Promise<File> {
  // Skip non-image files
  if (!file.type.startsWith('image/')) return file;

  // Skip SVGs – they're already small and vector
  if (file.type === 'image/svg+xml') return file;

  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Skip if already small enough
  if (file.size < opts.skipIfSmaller) return file;

  const img = await loadImage(file);
  const { width, height } = img;

  // Calculate new dimensions maintaining aspect ratio
  let newWidth = width;
  let newHeight = height;

  const needsResize = width > opts.maxWidth || height > opts.maxHeight;

  // Skip re-encoding if image doesn't need resizing and is already reasonable size
  if (!needsResize && file.size < 300 * 1024) {
    URL.revokeObjectURL(img.src);
    return file;
  }

  if (needsResize) {
    const ratio = Math.min(opts.maxWidth / width, opts.maxHeight / height);
    newWidth = Math.round(width * ratio);
    newHeight = Math.round(height * ratio);
  }

  // Draw to canvas
  const canvas = document.createElement('canvas');
  canvas.width = newWidth;
  canvas.height = newHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, newWidth, newHeight);

  // Clean up object URL
  URL.revokeObjectURL(img.src);

  // Convert to blob
  const useWebP = supportsWebP();
  const mimeType = useWebP ? 'image/webp' : 'image/jpeg';
  const quality = useWebP ? opts.quality : 0.85;

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))),
      mimeType,
      quality
    );
  });

  // If optimized is larger/same, keep original (don't degrade quality)
  if (blob.size >= file.size) {
    return file;
  }

  // Build new filename
  const baseName = file.name.replace(/\.[^.]+$/, '');
  const ext = useWebP ? 'webp' : 'jpg';
  const newFile = new File([blob], `${baseName}.${ext}`, { type: mimeType });

  return newFile;
}

export async function optimizeMultiple(
  files: File[],
  options: OptimizeOptions = {},
  onProgress?: (done: number, total: number) => void
): Promise<File[]> {
  const results: File[] = [];
  for (let i = 0; i < files.length; i++) {
    results.push(await optimizeImage(files[i], options));
    onProgress?.(i + 1, files.length);
  }
  return results;
}

export interface OptimizeResult {
  file: File;
  originalSize: number;
  optimizedSize: number;
  skipped: boolean;
}

export async function optimizeMultipleWithStats(
  files: File[],
  options: OptimizeOptions = {},
  onProgress?: (done: number, total: number) => void
): Promise<OptimizeResult[]> {
  const results: OptimizeResult[] = [];
  for (let i = 0; i < files.length; i++) {
    const original = files[i];
    const optimized = await optimizeImage(original, options);
    results.push({
      file: optimized,
      originalSize: original.size,
      optimizedSize: optimized.size,
      skipped: original === optimized,
    });
    onProgress?.(i + 1, files.length);
  }
  return results;
}
