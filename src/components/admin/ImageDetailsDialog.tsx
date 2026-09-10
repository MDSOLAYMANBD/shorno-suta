import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Copy, Trash2, Loader2, Lock, Unlock, Pencil, Check, X, Download } from 'lucide-react';
import { optimizeImage } from '@/lib/imageOptimizer';

interface ImageDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string | null;
  bucket: string;
  createdAt?: string;
  onDeleted?: () => void;
  onRenamed?: () => void;
}

interface ImageMeta {
  width: number;
  height: number;
  size: number;
  format: string;
}

const PRESETS = [600, 800, 1200];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFormat(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = { webp: 'WebP', jpg: 'JPEG', jpeg: 'JPEG', png: 'PNG', gif: 'GIF', svg: 'SVG' };
  return map[ext] || ext.toUpperCase();
}

export default function ImageDetailsDialog({
  open, onOpenChange, fileName, bucket, createdAt, onDeleted, onRenamed
}: ImageDetailsDialogProps) {
  const [meta, setMeta] = useState<ImageMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [resizeW, setResizeW] = useState('');
  const [resizeH, setResizeH] = useState('');
  const [lockRatio, setLockRatio] = useState(true);
  const [aspectRatio, setAspectRatio] = useState(1);
  const [resizing, setResizing] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const publicUrl = fileName
    ? supabase.storage.from(bucket).getPublicUrl(fileName).data.publicUrl
    : '';

  const loadMeta = useCallback(async () => {
    if (!fileName) return;
    setLoading(true);
    setMeta(null);
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Image load failed'));
        img.src = publicUrl;
      });
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      setAspectRatio(width / height);
      setResizeW(String(width));
      setResizeH(String(height));

      // Try to get file size
      let size = 0;
      try {
        const res = await fetch(publicUrl, { method: 'HEAD' });
        const cl = res.headers.get('content-length');
        if (cl) size = parseInt(cl, 10);
      } catch { /* ignore */ }

      setMeta({ width, height, size, format: getFormat(fileName) });
    } catch {
      toast.error('ছবির তথ্য লোড করতে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  }, [fileName, publicUrl]);

  useEffect(() => {
    if (open && fileName) {
      loadMeta();
      setNewName(fileName.replace(/\.[^.]+$/, ''));
      setDeleteConfirm(false);
      setEditingName(false);
    }
  }, [open, fileName, loadMeta]);

  const handleWidthChange = (val: string) => {
    setResizeW(val);
    if (lockRatio && val && meta) {
      setResizeH(String(Math.round(Number(val) / aspectRatio)));
    }
  };

  const handleHeightChange = (val: string) => {
    setResizeH(val);
    if (lockRatio && val && meta) {
      setResizeW(String(Math.round(Number(val) * aspectRatio)));
    }
  };

  const applyPreset = (px: number) => {
    if (!meta) return;
    if (meta.width >= meta.height) {
      setResizeW(String(px));
      setResizeH(String(Math.round(px / aspectRatio)));
    } else {
      setResizeH(String(px));
      setResizeW(String(Math.round(px * aspectRatio)));
    }
  };

  const handleResize = async () => {
    if (!fileName || !meta) return;
    const w = Number(resizeW);
    const h = Number(resizeH);
    if (!w || !h || w < 1 || h < 1) { toast.error('সঠিক মাপ দিন'); return; }
    if (w === meta.width && h === meta.height) { toast.error('মাপ একই আছে'); return; }

    setResizing(true);
    try {
      // Download original
      const { data: blob, error: dlErr } = await supabase.storage.from(bucket).download(fileName);
      if (dlErr || !blob) throw dlErr || new Error('Download failed');

      const file = new File([blob], fileName, { type: blob.type });
      const optimized = await optimizeImage(file, { maxWidth: w, maxHeight: h, quality: 0.85, skipIfSmaller: 0 });

      // Upload as new file
      const ext = optimized.name.split('.').pop();
      const newPath = `${Date.now()}-resized.${ext}`;
      const { error: upErr } = await supabase.storage.from(bucket).upload(newPath, optimized, { cacheControl: '31536000' });
      if (upErr) throw upErr;

      toast.success(`রিসাইজ হয়েছে (${w}x${h})`);
      onRenamed?.(); // refresh list
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'রিসাইজ ব্যর্থ');
    } finally {
      setResizing(false);
    }
  };

  const handleRename = async () => {
    if (!fileName || !newName.trim()) return;
    const ext = fileName.split('.').pop();
    const finalName = `${newName.trim()}.${ext}`;
    if (finalName === fileName) { setEditingName(false); return; }

    setRenaming(true);
    try {
      const { data: blob, error: dlErr } = await supabase.storage.from(bucket).download(fileName);
      if (dlErr || !blob) throw dlErr || new Error('Download failed');

      const { error: upErr } = await supabase.storage.from(bucket).upload(finalName, blob, { contentType: blob.type, cacheControl: '31536000' });
      if (upErr) throw upErr;

      const { error: rmErr } = await supabase.storage.from(bucket).remove([fileName]);
      if (rmErr) throw rmErr;

      toast.success('নাম পরিবর্তন হয়েছে');
      setEditingName(false);
      onRenamed?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'রিনেম ব্যর্থ');
    } finally {
      setRenaming(false);
    }
  };

  const handleDelete = async () => {
    if (!fileName) return;
    setDeleting(true);
    try {
      const { error } = await supabase.storage.from(bucket).remove([fileName]);
      if (error) throw error;
      toast.success('ছবি ডিলিট হয়েছে');
      onDeleted?.();
      onOpenChange(false);
    } catch {
      toast.error('ডিলিট ব্যর্থ');
    } finally {
      setDeleting(false);
    }
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(publicUrl);
    toast.success('URL কপি হয়েছে');
  };

  const downloadImage = () => {
    const a = document.createElement('a');
    a.href = publicUrl;
    a.download = fileName || 'image';
    a.target = '_blank';
    a.click();
  };

  if (!fileName) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">ছবির বিস্তারিত</DialogTitle>
        </DialogHeader>

        {/* Preview */}
        <div className="rounded-lg overflow-hidden border border-border bg-muted aspect-video flex items-center justify-center">
          <img src={publicUrl} alt={fileName} className="max-w-full max-h-full object-contain" />
        </div>

        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : meta ? (
          <div className="space-y-3">
            {/* File info */}
            <div className="space-y-1.5 text-sm">
              {/* Name with rename */}
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground shrink-0">নাম:</span>
                {editingName ? (
                  <div className="flex items-center gap-1 flex-1 min-w-0">
                    <Input
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      className="h-7 text-xs flex-1"
                      disabled={renaming}
                    />
                    <span className="text-xs text-muted-foreground">.{fileName.split('.').pop()}</span>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleRename} disabled={renaming}>
                      {renaming ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditingName(false)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="truncate font-medium">{fileName}</span>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0" onClick={() => setEditingName(true)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">সাইজ:</span>
                <span className="font-medium">{meta.size > 0 ? formatSize(meta.size) : 'অজানা'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">মাপ:</span>
                <span className="font-medium">{meta.width} × {meta.height} px</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">ফরম্যাট:</span>
                <Badge variant="secondary" className="text-xs">{meta.format}</Badge>
              </div>
              {createdAt && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">তারিখ:</span>
                  <span className="font-medium">{new Date(createdAt).toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
              )}
            </div>

            {/* URL */}
            <div className="flex items-center gap-2">
              <Input value={publicUrl} readOnly className="h-8 text-xs flex-1" />
              <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={copyUrl}>
                <Copy className="h-3 w-3 mr-1" /> কপি
              </Button>
            </div>

            <Separator />

            {/* Resize section */}
            <div className="space-y-2">
              <p className="text-sm font-medium">রিসাইজ করুন</p>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">প্রস্থ (W)</label>
                  <Input type="number" value={resizeW} onChange={e => handleWidthChange(e.target.value)} className="h-8 text-sm" />
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 mt-4"
                  onClick={() => setLockRatio(!lockRatio)}
                  title={lockRatio ? 'অনুপাত লক আছে' : 'অনুপাত আনলক'}
                >
                  {lockRatio ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                </Button>
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">উচ্চতা (H)</label>
                  <Input type="number" value={resizeH} onChange={e => handleHeightChange(e.target.value)} className="h-8 text-sm" />
                </div>
              </div>
              <div className="flex gap-1.5">
                {PRESETS.map(px => (
                  <Button key={px} size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => applyPreset(px)}>
                    {px}px
                  </Button>
                ))}
              </div>
              <Button size="sm" onClick={handleResize} disabled={resizing} className="w-full">
                {resizing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                রিসাইজ করুন
              </Button>
            </div>

            <Separator />

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={downloadImage}>
                <Download className="h-3.5 w-3.5 mr-1" /> ডাউনলোড
              </Button>
              <div className="flex-1" />
              {deleteConfirm ? (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-destructive font-medium">নিশ্চিত?</span>
                  <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={handleDelete} disabled={deleting}>
                    {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'হ্যাঁ'}
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setDeleteConfirm(false)}>না</Button>
                </div>
              ) : (
                <Button size="sm" variant="destructive" onClick={() => setDeleteConfirm(true)}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> ডিলিট
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
