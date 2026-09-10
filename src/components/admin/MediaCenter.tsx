import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Upload, Search, Trash2, Check, Loader2, Image as ImageIcon, Clock, ChevronDown, Pin, PinOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { optimizeMultiple } from '@/lib/imageOptimizer';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';

interface MediaCenterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (urls: string[]) => void;
  multiple?: boolean;
}

interface StorageFile {
  name: string;
  id: string;
  created_at: string;
  metadata?: { size?: number };
}

const BUCKET = 'product-images';
const PAGE_SIZE = 50;
const PINNED_KEY = 'media_pinned_files';

const getPinnedFromStorage = (): string[] => {
  try { return JSON.parse(localStorage.getItem(PINNED_KEY) || '[]'); } catch { return []; }
};

export default function MediaCenter({ open, onOpenChange, onSelect, multiple = false }: MediaCenterProps) {
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [recentOnly, setRecentOnly] = useState(false);
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pinned, setPinned] = useState<Set<string>>(() => new Set(getPinnedFromStorage()));

  // Duplicate detection
  const [dupDialogOpen, setDupDialogOpen] = useState(false);
  const [dupMatches, setDupMatches] = useState<{ file: File; existing: StorageFile[] }[]>([]);
  const [pendingUpload, setPendingUpload] = useState<File[]>([]);

  const togglePin = (name: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setPinned(prev => {
      const n = new Set(prev);
      n.has(name) ? n.delete(name) : n.add(name);
      localStorage.setItem(PINNED_KEY, JSON.stringify(Array.from(n)));
      return n;
    });
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
    } catch (e: any) {
      toast.error('ছবি লোড করতে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchFiles();
      setSelected(new Set());
      setVisibleCount(PAGE_SIZE);
    }
  }, [open, fetchFiles]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, recentOnly, pinnedOnly]);

  const getPublicUrl = (name: string) => {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(name);
    return data.publicUrl;
  };

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
    }
  };

  const uploadFiles = async (fileList: FileList | File[]) => {
    const arr = Array.from(fileList);
    if (arr.length === 0) return;
    setUploading(true);
    try {
      const optimized = await optimizeMultiple(arr);

      // Check duplicates
      const dups = findDuplicates(optimized);
      if (dups.length > 0) {
        setUploading(false);
        setDupMatches(dups);
        setPendingUpload(optimized);
        setDupDialogOpen(true);
        return;
      }

      for (const file of optimized) {
        const ext = file.name.split('.').pop();
        const path = `${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: '31536000' });
        if (error) throw error;
      }
      toast.success(`${arr.length}টি ছবি অপটিমাইজ ও আপলোড হয়েছে`);
      await fetchFiles();
    } catch (e: any) {
      toast.error(e.message || 'আপলোড ব্যর্থ');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (name: string) => {
    try {
      const { error } = await supabase.storage.from(BUCKET).remove([name]);
      if (error) throw error;
      setFiles(prev => prev.filter(f => f.name !== name));
      setSelected(prev => { const n = new Set(prev); n.delete(name); return n; });
      setDeleteConfirm(null);
      toast.success('ছবি ডিলিট হয়েছে');
    } catch {
      toast.error('ডিলিট করতে সমস্যা হয়েছে');
    }
  };

  const toggleSelect = (name: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(name)) {
        n.delete(name);
      } else {
        if (!multiple) n.clear();
        n.add(name);
      }
      return n;
    });
  };

  const handleConfirm = () => {
    const urls = Array.from(selected).map(name => getPublicUrl(name));
    onSelect(urls);
    onOpenChange(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files);
  };

  // Filter
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

  const visible = sorted.slice(0, visibleCount);
  const hasMore = sorted.length > visibleCount;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl flex flex-col p-0 z-[1100]" overlayClassName="z-[1100]">
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-primary" />
            মিডিয়া সেন্টার
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 space-y-3">
          {/* Upload zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors',
              dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            )}
          >
            {uploading ? (
              <Loader2 className="h-6 w-6 mx-auto animate-spin text-primary" />
            ) : (
              <>
                <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                <p className="text-sm text-muted-foreground">ড্র্যাগ করুন অথবা ক্লিক করুন</p>
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
          <div className="flex gap-2 flex-wrap">
            <div className="flex-1 relative min-w-[150px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="ছবি খুঁজুন..."
                className="pl-8 h-9"
              />
            </div>
            <Button
              variant={recentOnly ? 'default' : 'outline'}
              size="sm"
              className="h-9 shrink-0"
              onClick={() => setRecentOnly(!recentOnly)}
            >
              <Clock className="h-3.5 w-3.5 mr-1" />
              সাম্প্রতিক
            </Button>
            <Button
              variant={pinnedOnly ? 'default' : 'outline'}
              size="sm"
              className="h-9 shrink-0"
              onClick={() => setPinnedOnly(!pinnedOnly)}
            >
              <Pin className="h-3.5 w-3.5 mr-1" />
              পিন ({pinned.size})
            </Button>
          </div>

          {/* Image grid */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">কোনো ছবি পাওয়া যায়নি</div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                {visible.map(file => {
                  const isSelected = selected.has(file.name);
                  const isDeleting = deleteConfirm === file.name;
                  const isPinned = pinned.has(file.name);
                  return (
                    <div
                      key={file.name}
                      className={cn(
                        'relative group aspect-square rounded-lg overflow-hidden border-2 cursor-pointer transition-all',
                        isSelected ? 'border-primary ring-2 ring-primary/30' : isPinned ? 'border-yellow-500/60 ring-1 ring-yellow-500/20' : 'border-border hover:border-primary/40'
                      )}
                      onClick={() => !isDeleting && toggleSelect(file.name)}
                    >
                      <img
                        src={getPublicUrl(file.name)}
                        alt={file.name}
                        className="w-full h-full object-cover"
                        draggable={false}
                      />
                      {/* Pin indicator */}
                      {isPinned && (
                        <div className="absolute top-1.5 left-1.5 bg-yellow-500 text-white rounded-full p-0.5 z-10">
                          <Pin className="h-3 w-3" />
                        </div>
                      )}
                      {isSelected && (
                        <div className="absolute top-1.5 left-1.5 bg-primary text-primary-foreground rounded-full p-0.5">
                          <Check className="h-3.5 w-3.5" />
                        </div>
                      )}
                      {/* Hover actions */}
                      {isDeleting ? (
                        <div className="absolute inset-0 bg-destructive/80 flex flex-col items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                          <p className="text-destructive-foreground text-xs font-medium">ডিলিট?</p>
                          <div className="flex gap-1">
                            <Button size="sm" variant="destructive" className="h-6 text-xs px-2" onClick={() => handleDelete(file.name)}>হ্যাঁ</Button>
                            <Button size="sm" variant="outline" className="h-6 text-xs px-2 bg-background" onClick={() => setDeleteConfirm(null)}>না</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); togglePin(file.name, e); }}
                            className={cn(
                              "rounded-full p-1 transition-colors",
                              isPinned ? "bg-yellow-500 text-white" : "bg-black/50 text-white hover:bg-yellow-500"
                            )}
                          >
                            {isPinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                          </button>
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); setDeleteConfirm(file.name); }}
                            className="bg-destructive/80 text-destructive-foreground rounded-full p-1"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Show more button */}
              {hasMore && (
                <div className="flex justify-center py-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
                    className="gap-1.5"
                  >
                    <ChevronDown className="h-4 w-4" />
                    আরও দেখুন ({sorted.length - visibleCount}টি বাকি)
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Bottom action */}
        <div className="border-t border-border px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {selected.size > 0 ? `${selected.size}টি ছবি সিলেক্ট করা হয়েছে` : 'ছবি সিলেক্ট করুন'}
          </p>
          <Button onClick={handleConfirm} disabled={selected.size === 0} size="sm">
            <Check className="h-4 w-4 mr-1" />
            এই ছবি ব্যবহার করুন
          </Button>
        </div>
      </SheetContent>

      {/* Duplicate detection dialog */}
      <AlertDialog open={dupDialogOpen} onOpenChange={setDupDialogOpen}>
        <AlertDialogContent className="max-w-md z-[1200]">
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ সম্ভাব্য ডুপ্লিকেট ছবি</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p className="mb-3">{dupMatches.length}টি ছবি আগে আপলোড করা ছবির সাথে মিলছে:</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {dupMatches.map((m, i) => (
                    <div key={i} className="flex items-center gap-2 bg-muted rounded p-2">
                      <span className="text-xs font-medium truncate flex-1 min-w-0">{m.file.name}</span>
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
    </Sheet>
  );
}
