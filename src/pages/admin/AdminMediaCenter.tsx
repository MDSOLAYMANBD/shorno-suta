import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Upload, Search, Trash2, Loader2, Image as ImageIcon, Clock, Copy, CheckSquare, X, HardDrive, ChevronDown, Pin, PinOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { optimizeMultipleWithStats } from '@/lib/imageOptimizer';
import ImageDetailsDialog from '@/components/admin/ImageDetailsDialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';

interface StorageFile {
  name: string;
  id: string;
  created_at: string;
  metadata?: { size?: number };
}

const BUCKET = 'product-images';
const PINNED_KEY = 'media_pinned_files';

const getPinnedFromStorage = (): string[] => {
  try { return JSON.parse(localStorage.getItem(PINNED_KEY) || '[]'); } catch { return []; }
};

export default function AdminMediaCenter() {
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [recentOnly, setRecentOnly] = useState(false);
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [totalSize, setTotalSize] = useState<number>(0);
  const [visibleCount, setVisibleCount] = useState(60);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pinned, setPinned] = useState<Set<string>>(() => new Set(getPinnedFromStorage()));

  // Duplicate detection
  const [dupDialogOpen, setDupDialogOpen] = useState(false);
  const [dupMatches, setDupMatches] = useState<{ file: File; existing: StorageFile[] }[]>([]);
  const [pendingUpload, setPendingUpload] = useState<File[]>([]);

  // Details dialog
  const [detailFile, setDetailFile] = useState<StorageFile | null>(null);

  // Bulk mode
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const togglePin = (name: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    // Re-read from localStorage instead of the React state snapshot, so a stale
    // in-memory set (e.g. from another open tab) can't clobber pins saved elsewhere.
    const n = new Set(getPinnedFromStorage());
    n.has(name) ? n.delete(name) : n.add(name);
    localStorage.setItem(PINNED_KEY, JSON.stringify(Array.from(n)));
    setPinned(n);
  };

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const allFiles: StorageFile[] = [];
      const PAGE = 1000;
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase.storage.from(BUCKET).list('', {
          limit: PAGE,
          offset,
          sortBy: { column: 'created_at', order: 'desc' },
        });
        if (error) throw error;
        const batch = (data || []).filter(f => f.id && !f.name.startsWith('.'));
        allFiles.push(...batch);
        hasMore = (data || []).length === PAGE;
        offset += PAGE;
      }
      setFiles(allFiles);
      const total = allFiles.reduce((sum, f) => sum + (f.metadata?.size || 0), 0);
      setTotalSize(total);
    } catch {
      toast.error('ছবি লোড করতে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  // Keep pinned state in sync if another tab changes it
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === PINNED_KEY) setPinned(new Set(getPinnedFromStorage()));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const getPublicUrl = (name: string) => {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(name);
    return data.publicUrl;
  };

  const formatSize = (b: number) => b > 1024 * 1024
    ? (b / 1024 / 1024).toFixed(1) + 'MB'
    : Math.round(b / 1024) + 'KB';

  const findDuplicates = (optimizedFiles: File[]): { file: File; existing: StorageFile[] }[] => {
    const matches: { file: File; existing: StorageFile[] }[] = [];
    for (const f of optimizedFiles) {
      const threshold = f.size * 0.02;
      const similar = files.filter(ef => ef.metadata?.size && Math.abs(ef.metadata.size - f.size) <= threshold);
      if (similar.length > 0) matches.push({ file: f, existing: similar });
    }
    return matches;
  };

  const doUpload = async (filesToUpload: File[]) => {
    setUploading(true);
    try {
      setUploadProgress('আপলোড হচ্ছে...');
      for (const file of filesToUpload) {
        const ext = file.name.split('.').pop();
        const path = `${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: '31536000' });
        if (error) throw error;
      }
      toast.success(`${filesToUpload.length}টি ছবি আপলোড হয়েছে`);
      await fetchFiles();
    } catch (e: any) {
      toast.error(e.message || 'আপলোড ব্যর্থ');
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  };

  const uploadFiles = async (fileList: FileList | File[]) => {
    const arr = Array.from(fileList);
    if (arr.length === 0) return;
    setUploading(true);
    try {
      setUploadProgress('অপটিমাইজ হচ্ছে...');
      const results = await optimizeMultipleWithStats(arr, {}, (done, total) => {
        setUploadProgress(`অপটিমাইজ হচ্ছে... ${done}/${total}`);
      });

      const optimized = results.map(r => r.file);
      const totalOriginal = results.reduce((s, r) => s + r.originalSize, 0);
      const totalOptimized = results.reduce((s, r) => s + r.optimizedSize, 0);
      const savedPercent = Math.round(((totalOriginal - totalOptimized) / totalOriginal) * 100);

      // Check duplicates
      const dups = findDuplicates(optimized);
      if (dups.length > 0) {
        setUploading(false);
        setUploadProgress('');
        setDupMatches(dups);
        setPendingUpload(optimized);
        setDupDialogOpen(true);
        return;
      }

      setUploadProgress('আপলোড হচ্ছে...');
      for (const r of results) {
        const ext = r.file.name.split('.').pop();
        const path = `${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, r.file, { cacheControl: '31536000' });
        if (error) throw error;
      }

      toast.success(
        `${arr.length}টি ছবি আপলোড হয়েছে — ${formatSize(totalOriginal)} থেকে ${formatSize(totalOptimized)} (${savedPercent}% কমেছে)`
      );
      await fetchFiles();
    } catch (e: any) {
      toast.error(e.message || 'আপলোড ব্যর্থ');
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  };

  const copyUrl = (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(getPublicUrl(name));
    toast.success('URL কপি হয়েছে');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files);
  };

  // Bulk operations
  const toggleBulk = (name: string) => {
    setBulkSelected(prev => {
      const n = new Set(prev);
      n.has(name) ? n.delete(name) : n.add(name);
      return n;
    });
  };

  const handleBulkDelete = async () => {
    if (bulkSelected.size === 0) return;
    setBulkDeleting(true);
    try {
      const names = Array.from(bulkSelected);
      const { error } = await supabase.storage.from(BUCKET).remove(names);
      if (error) throw error;
      toast.success(`${names.length}টি ছবি ডিলিট হয়েছে`);
      setBulkSelected(new Set());
      setBulkMode(false);
      await fetchFiles();
    } catch {
      toast.error('ডিলিট ব্যর্থ');
    } finally {
      setBulkDeleting(false);
    }
  };

  const exitBulkMode = () => {
    setBulkMode(false);
    setBulkSelected(new Set());
  };

  const handleImageClick = (file: StorageFile) => {
    if (bulkMode) {
      toggleBulk(file.name);
    } else {
      setDetailFile(file);
    }
  };

  const filtered = files.filter(f => {
    if (search && !f.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (recentOnly) {
      const created = new Date(f.created_at).getTime();
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      if (created < oneDayAgo) return false;
    }
    if (pinnedOnly && !pinned.has(f.name)) return false;
    return true;
  });

  // Sort pinned first
  const sorted = [...filtered].sort((a, b) => {
    const aPin = pinned.has(a.name) ? 0 : 1;
    const bPin = pinned.has(b.name) ? 0 : 1;
    return aPin - bPin;
  });

  // Reset visible count on filter change
  useEffect(() => {
    setVisibleCount(60);
  }, [search, recentOnly, pinnedOnly]);

  const visible = sorted.slice(0, visibleCount);
  const hasMoreItems = sorted.length > visibleCount;

  return (
    <div>
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ImageIcon className="h-6 w-6" /> মিডিয়া সেন্টার
          </h1>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{files.length}টি ছবি</Badge>
            <Button
              size="sm"
              variant={bulkMode ? 'default' : 'outline'}
              onClick={bulkMode ? exitBulkMode : () => setBulkMode(true)}
            >
              {bulkMode ? <><X className="h-4 w-4 mr-1" /> বাতিল</> : <><CheckSquare className="h-4 w-4 mr-1" /> সিলেক্ট</>}
            </Button>
          </div>
        </div>
        {/* Storage usage */}
        {(() => {
          const MAX_STORAGE = 107374182400;
          const usagePercent = Math.min((totalSize / MAX_STORAGE) * 100, 100);
          const colorClass = usagePercent >= 80 ? 'bg-destructive' : usagePercent >= 50 ? 'bg-yellow-500' : 'bg-green-500';
          return (
            <div className="flex items-center gap-3 bg-muted/50 rounded-lg px-3 py-2">
              <HardDrive className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>{formatSize(totalSize)} / 100 GB ব্যবহৃত</span>
                  <span>{usagePercent.toFixed(1)}%</span>
                </div>
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div className={cn("h-full rounded-full transition-all", colorClass)} style={{ width: `${usagePercent}%` }} />
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Upload zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors mb-4',
          dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
        )}
      >
        {uploading ? (
          <>
            <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary" />
            <p className="text-sm text-muted-foreground mt-2">{uploadProgress}</p>
          </>
        ) : (
          <>
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">ড্র্যাগ করুন অথবা ক্লিক করে ছবি আপলোড করুন</p>
            <p className="text-xs text-muted-foreground/60 mt-1">অটো অপটিমাইজ: WebP ফরম্যাট, সর্বোচ্চ 1200px, কোয়ালিটি অক্ষুণ্ণ</p>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={e => e.target.files && uploadFiles(e.target.files)}
        />
      </div>

      {/* Search & filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="flex-1 relative min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="ছবি খুঁজুন..." className="pl-9" />
        </div>
        <Button variant={recentOnly ? 'default' : 'outline'} size="sm" onClick={() => setRecentOnly(!recentOnly)}>
          <Clock className="h-4 w-4 mr-1" /> সাম্প্রতিক
        </Button>
        <Button variant={pinnedOnly ? 'default' : 'outline'} size="sm" onClick={() => setPinnedOnly(!pinnedOnly)}>
          <Pin className="h-4 w-4 mr-1" /> পিন করা ({pinned.size})
        </Button>
      </div>

      {/* Image grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">কোনো ছবি পাওয়া যায়নি</div>
      ) : (
        <>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {visible.map(file => {
            const isSelected = bulkSelected.has(file.name);
            const isPinned = pinned.has(file.name);
            return (
              <div
                key={file.name}
                className={cn(
                  'relative group aspect-square rounded-lg overflow-hidden border cursor-pointer transition-all',
                  isSelected ? 'border-primary ring-2 ring-primary/30' : isPinned ? 'border-yellow-500/60 ring-1 ring-yellow-500/20' : 'border-border hover:border-primary/40',
                  'bg-muted'
                )}
                onClick={() => handleImageClick(file)}
              >
                <img src={getPublicUrl(file.name)} alt={file.name} className="w-full h-full object-cover" loading="lazy" />

                {/* Pin indicator */}
                {isPinned && !bulkMode && (
                  <div className="absolute top-1.5 left-1.5 bg-yellow-500 text-white rounded-full p-0.5 z-10">
                    <Pin className="h-3 w-3" />
                  </div>
                )}

                {/* Bulk checkbox */}
                {bulkMode && (
                  <div className="absolute top-1.5 left-1.5 z-10" onClick={e => e.stopPropagation()}>
                    <Checkbox checked={isSelected} onCheckedChange={() => toggleBulk(file.name)} />
                  </div>
                )}

                {/* Hover overlay (non-bulk) */}
                {!bulkMode && (
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-end justify-center opacity-0 group-hover:opacity-100">
                    <div className="flex gap-1 mb-2">
                      <Button size="sm" variant="secondary" className="h-7 text-xs px-2" onClick={(e) => copyUrl(file.name, e)}>
                        <Copy className="h-3 w-3 mr-1" /> URL
                      </Button>
                      <Button size="sm" variant="secondary" className="h-7 text-xs px-2" onClick={(e) => togglePin(file.name, e)}>
                        {isPinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Show more button */}
        {hasMoreItems && (
          <div className="flex justify-center py-4">
            <Button
              variant="outline"
              onClick={() => setVisibleCount(prev => prev + 60)}
              className="gap-1.5"
            >
              <ChevronDown className="h-4 w-4" />
              আরও দেখুন ({sorted.length - visibleCount}টি বাকি)
            </Button>
          </div>
        )}
      </>
      )}

      {/* Bulk action bar */}
      {bulkMode && bulkSelected.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-background border border-border shadow-lg rounded-lg px-4 py-2.5 flex items-center gap-3 z-50">
          <span className="text-sm font-medium">{bulkSelected.size}টি সিলেক্ট করা হয়েছে</span>
          <Button size="sm" variant="destructive" onClick={handleBulkDelete} disabled={bulkDeleting}>
            {bulkDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
            সব ডিলিট
          </Button>
        </div>
      )}

      {/* Duplicate detection dialog */}
      <AlertDialog open={dupDialogOpen} onOpenChange={setDupDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ সম্ভাব্য ডুপ্লিকেট ছবি পাওয়া গেছে</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p className="mb-3">{dupMatches.length}টি ছবি আগে আপলোড করা ছবির সাথে মিলছে:</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {dupMatches.map((m, i) => (
                    <div key={i} className="flex items-center gap-2 bg-muted rounded p-2">
                      <span className="text-xs font-medium truncate flex-1 min-w-0">{m.file.name}</span>
                      <span className="text-xs text-muted-foreground">≈ {m.existing.length}টি মিল</span>
                      {m.existing.slice(0, 2).map(ef => (
                        <img key={ef.name} src={getPublicUrl(ef.name)} className="h-8 w-8 rounded object-cover border" alt="" />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDupDialogOpen(false); setPendingUpload([]); setDupMatches([]); }}>
              বাদ দিন
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setDupDialogOpen(false);
              doUpload(pendingUpload);
              setPendingUpload([]);
              setDupMatches([]);
            }}>
              তবুও আপলোড করুন
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Details dialog */}
      <ImageDetailsDialog
        open={!!detailFile}
        onOpenChange={open => { if (!open) setDetailFile(null); }}
        fileName={detailFile?.name || null}
        bucket={BUCKET}
        createdAt={detailFile?.created_at}
        onDeleted={() => { setDetailFile(null); fetchFiles(); }}
        onRenamed={() => { setDetailFile(null); fetchFiles(); }}
      />
    </div>
  );
}
