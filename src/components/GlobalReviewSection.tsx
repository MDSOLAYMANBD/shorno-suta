import { useState, useMemo, useCallback, useEffect } from 'react';
import { Star, ChevronLeft, ChevronRight, Quote, Camera, Loader2, BadgeCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { optimizedImageUrl } from '@/lib/imageUrl';
import { useSiteConfig, DEFAULT_HOMEPAGE_CONFIG } from '@/hooks/useSiteConfig';
import { useApprovedReviews, useSubmitReview, uploadReviewImage } from '@/hooks/useCustomerReviews';
import { toast } from 'sonner';

function formatTimeAgo(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'এইমাত্র';
  if (m < 60) return `${m} মিনিট আগে`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ঘন্টা আগে`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} দিন আগে`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo} মাস আগে`;
  return `${Math.floor(mo / 12)} বছর আগে`;
}

function TestimonialImageGrid({ images, onClickImage }: { images: string[]; onClickImage: (idx: number) => void }) {
  if (!images || images.length === 0) return null;

  if (images.length === 1) {
    return (
      <div
        className="relative rounded-lg sm:rounded-xl overflow-hidden bg-muted/40 cursor-pointer group border sm:border-2 border-primary/20 shadow-sm hover:border-primary/40 hover:shadow-md transition-all duration-300"
        onClick={() => onClickImage(0)}
      >
        <img
          src={optimizedImageUrl(images[0], 400, 80)}
          alt="রিভিউ ছবি"
          className="w-full max-h-32 sm:max-h-72 object-contain group-hover:scale-[1.02] transition-transform duration-500"
        />
      </div>
    );
  }

  if (images.length === 2) {
    return (
      <div className="grid grid-cols-2 gap-1 sm:gap-1.5">
        {images.map((img, idx) => (
          <div
            key={idx}
            className="relative rounded-lg sm:rounded-xl overflow-hidden bg-muted/40 cursor-pointer group aspect-square sm:aspect-[3/4] border sm:border-2 border-primary/20 shadow-sm hover:border-primary/40 hover:shadow-md transition-all duration-300"
            onClick={() => onClickImage(idx)}
          >
            <img
              src={optimizedImageUrl(img, 300, 80)}
              alt={`ছবি ${idx + 1}`}
              className="w-full h-full object-contain group-hover:scale-[1.03] transition-transform duration-400"
            />
          </div>
        ))}
      </div>
    );
  }

  // 3+ images: first big, rest in grid
  return (
    <div className="space-y-1 sm:space-y-1.5">
      <div
        className="relative rounded-lg sm:rounded-xl overflow-hidden bg-muted/40 cursor-pointer group border sm:border-2 border-primary/20 shadow-sm hover:border-primary/40 hover:shadow-md transition-all duration-300"
        onClick={() => onClickImage(0)}
      >
        <img
          src={optimizedImageUrl(images[0], 400, 80)}
          alt="রিভিউ ছবি"
          className="w-full max-h-28 sm:max-h-60 object-contain group-hover:scale-[1.02] transition-transform duration-500"
        />
      </div>
      <div className="grid grid-cols-3 gap-1 sm:gap-1.5">
        {images.slice(1, 4).map((img, idx) => (
          <div
            key={idx}
            className="relative rounded overflow-hidden bg-muted/40 cursor-pointer group aspect-square border sm:border-2 border-primary/20 shadow-sm hover:border-primary/40 hover:shadow-md transition-all duration-300"
            onClick={() => onClickImage(idx + 1)}
          >
            <img
              src={optimizedImageUrl(img, 200, 75)}
              alt={`ছবি ${idx + 2}`}
              className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
            />
            {idx === 2 && images.length > 4 && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <span className="text-white text-sm font-bold">+{images.length - 4}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewSubmitDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const submitReview = useSubmitReview();

  const handleSubmit = async () => {
    if (!name.trim()) { toast.error('আপনার নাম লিখুন'); return; }
    setUploading(true);
    try {
      let imageUrls: string[] = [];
      for (const f of files) {
        const url = await uploadReviewImage(f);
        imageUrls.push(url);
      }
      await submitReview.mutateAsync({
        customer_name: name,
        customer_location: location || undefined,
        rating,
        review_text: text || undefined,
        images: imageUrls,
      });
      setSubmitted(true);
    } catch (e: any) {
      toast.error('সাবমিট করতে সমস্যা হয়েছে');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setName(''); setLocation(''); setRating(5); setText(''); setFiles([]); setSubmitted(false);
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{submitted ? '🎉 ধন্যবাদ!' : '📝 আপনার রিভিউ দিন'}</DialogTitle>
        </DialogHeader>

        {submitted ? (
          <div className="text-center py-6 space-y-3">
            <p className="text-4xl">🙏</p>
            <p className="text-sm text-muted-foreground">আপনার মূল্যবান মতামতের জন্য অসংখ্য ধন্যবাদ! আমরা দেখে অ্যাপ্রুভ করলে এটি দেখা যাবে।</p>
            <Button onClick={handleClose}>বন্ধ করুন</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label>আপনার নাম *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="নাম লিখুন" maxLength={200} />
            </div>
            <div>
              <Label>লোকেশন</Label>
              <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="যেমন: ঢাকা" maxLength={200} />
            </div>
            <div>
              <Label>রেটিং</Label>
              <div className="flex gap-1 mt-1">
                {[1, 2, 3, 4, 5].map(s => (
                  <button key={s} type="button" onClick={() => setRating(s)}>
                    <Star className={`h-6 w-6 transition-colors ${s <= rating ? 'text-yellow-500 fill-yellow-500' : 'text-muted'}`} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>আপনার মতামত</Label>
              <Textarea value={text} onChange={e => setText(e.target.value)} placeholder="পণ্য সম্পর্কে আপনার অভিজ্ঞতা লিখুন..." maxLength={2000} rows={3} />
            </div>
            <div>
              <Label>ছবি যোগ করুন</Label>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <label className="flex items-center gap-1.5 px-3 py-2 border border-dashed rounded-lg cursor-pointer text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                  <Camera className="h-4 w-4" />
                  ছবি বাছাই
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={e => {
                      const newFiles = Array.from(e.target.files || []);
                      setFiles(prev => [...prev, ...newFiles].slice(0, 5));
                    }}
                  />
                </label>
                {files.map((f, i) => (
                  <div key={i} className="relative">
                    <img src={URL.createObjectURL(f)} alt="" className="w-12 h-12 object-cover rounded-lg border" />
                    <button
                      onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground rounded-full text-[10px] flex items-center justify-center"
                    >×</button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">সর্বোচ্চ ৫টি ছবি</p>
            </div>

            <DialogFooter>
              <Button onClick={handleSubmit} disabled={uploading || !name.trim()} className="w-full gap-2">
                {uploading ? <><Loader2 className="h-4 w-4 animate-spin" /> আপলোড হচ্ছে...</> : 'রিভিউ সাবমিট করুন'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function GlobalReviewSection() {
  const { data: savedConfig } = useSiteConfig('homepage_config');
  const testRef = useScrollAnimation();

  const config = useMemo(() => {
    const def = DEFAULT_HOMEPAGE_CONFIG.testimonials;
    if (!savedConfig?.testimonials) return def;
    return { ...def, ...savedConfig.testimonials };
  }, [savedConfig]);

  const configItems = config.items || [];
  const { data: dbReviews = [] } = useApprovedReviews();

  const items = useMemo(() => {
    const dbItems = dbReviews.map(r => ({
      name: r.customer_name,
      location: r.customer_location || '',
      text: r.review_text || '',
      rating: r.rating,
      images: r.images || [],
      created_at: r.created_at,
    }));
    // Newest DB reviews first, then legacy config items at the bottom
    return [...dbItems, ...configItems.map((c: any) => ({ ...c, created_at: null }))];
  }, [configItems, dbReviews]);

  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIdx, setLightboxIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [reviewFormOpen, setReviewFormOpen] = useState(false);
  const [allOpen, setAllOpen] = useState(false);
  const PREVIEW_COUNT = 5;

  const stats = useMemo(() => {
    const counts = [0, 0, 0, 0, 0]; // index 0 => 1-star
    let sum = 0;
    items.forEach((t: any) => {
      const r = Math.min(5, Math.max(1, Math.round(t.rating || 5)));
      counts[r - 1]++;
      sum += r;
    });
    const total = items.length;
    const avg = total ? sum / total : 0;
    return { counts, total, avg };
  }, [items]);

  const openLightbox = (images: string[], idx: number) => {
    setLightboxImages(images);
    setLightboxIdx(idx);
    setLightboxOpen(true);
  };


  const renderReviewRow = (t: any, i: number) => {
    const hasImages = t.images && t.images.length > 0;
    const timeAgo = t.created_at ? formatTimeAgo(t.created_at) : null;
    return (
      <div key={i} className="flex gap-3 p-3 sm:p-4 hover:bg-muted/30 transition-colors">
        {t.avatar_url ? (
          <img src={t.avatar_url} alt={t.name} className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover ring-2 ring-primary/10 shrink-0" />
        ) : (
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary/15 flex items-center justify-center text-xs sm:text-sm font-bold text-primary ring-2 ring-primary/10 shrink-0">
            {(t.name || '?')[0]}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-xs sm:text-sm font-semibold leading-tight text-foreground truncate max-w-[140px] sm:max-w-none">{t.name}</p>
            <span className="inline-flex items-center gap-0.5 bg-green-50 border border-green-200 rounded-full px-1.5 py-0.5">
              <BadgeCheck className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-green-600 fill-green-100" />
              <span className="text-[8px] sm:text-[9px] font-semibold text-green-700 leading-none">Verified</span>
            </span>
            <div className="flex gap-0.5 ml-auto sm:ml-0">
              {Array.from({ length: 5 }).map((_, si) => (
                <Star key={si} className={`h-2.5 w-2.5 sm:h-3.5 sm:w-3.5 ${si < (t.rating || 5) ? 'text-yellow-500 fill-yellow-500' : 'text-muted'}`} />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-muted-foreground mt-0.5">
            {t.location && <span className="truncate">{t.location}</span>}
            {t.location && timeAgo && <span>•</span>}
            {timeAgo && <span className="shrink-0">{timeAgo}</span>}
          </div>
          {t.text && (
            <p className="text-[12px] sm:text-sm text-foreground/90 leading-relaxed mt-1.5 whitespace-pre-line">"{t.text}"</p>
          )}
          {!t.text && !hasImages && (
            <p className="text-xs text-muted-foreground italic mt-1">🙏 ধন্যবাদ</p>
          )}
        </div>
        {hasImages && (
          <div className="shrink-0 flex flex-col gap-1">
            {t.images.slice(0, 2).map((img: string, idx: number) => (
              <button
                key={idx}
                type="button"
                onClick={(e) => { e.stopPropagation(); openLightbox(t.images, idx); }}
                className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden border border-primary/20 hover:border-primary/50 transition-colors bg-muted/40"
              >
                <img
                  src={optimizedImageUrl(img, 160, 75)}
                  alt={`ছবি ${idx + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                {idx === 1 && t.images.length > 2 && (
                  <div className="absolute inset-0 bg-black/55 flex items-center justify-center text-white text-[11px] font-bold">
                    +{t.images.length - 2}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  // If testimonials disabled, don't render
  if (config.enabled === false) return null;

  if (items.length === 0) return <div id="reviews" />;

  return (
    <>
      <div id="reviews" className="scroll-mt-20">
        <section className="py-8 bg-gradient-to-b from-primary/5 to-background animate-on-scroll" ref={testRef}>
          <div className="container">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold mb-1">{config.heading || 'কাস্টমার রিভিউ'}</h2>
                <p className="text-muted-foreground text-sm">{config.subheading || ''}</p>
              </div>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs shrink-0" onClick={() => setReviewFormOpen(true)}>
                <Star className="h-3 w-3" /> আপনার রিভিউ দিন
              </Button>
            </div>

            {/* Rating summary card */}
            <div className="max-w-3xl mx-auto mb-4 rounded-2xl border border-border bg-gradient-to-br from-yellow-50/60 via-card to-card p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-center sm:items-stretch">
                {/* Left: average */}
                <div className="flex flex-col items-center justify-center sm:min-w-[130px] sm:border-r sm:border-border sm:pr-6">
                  <div className="text-4xl sm:text-5xl font-bold text-foreground leading-none">{stats.avg.toFixed(1)}</div>
                  <div className="flex gap-0.5 mt-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-4 w-4 ${i < Math.round(stats.avg) ? 'text-yellow-500 fill-yellow-500' : 'text-muted'}`} />
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1.5">মোট {stats.total} রিভিউ</div>
                </div>
                {/* Right: bars */}
                <div className="flex-1 w-full space-y-1.5">
                  {[5, 4, 3, 2, 1].map(star => {
                    const count = stats.counts[star - 1];
                    const pct = stats.total ? (count / stats.total) * 100 : 0;
                    return (
                      <div key={star} className="flex items-center gap-2 text-xs">
                        <span className="w-8 shrink-0 flex items-center gap-0.5 text-foreground/80 font-medium">
                          {star} <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                        </span>
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-yellow-500 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-14 shrink-0 text-right text-muted-foreground tabular-nums">
                          {count} জন
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div
              role="button"
              tabIndex={0}
              onClick={() => setAllOpen(true)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAllOpen(true); } }}
              className="max-w-3xl mx-auto rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border cursor-pointer hover:border-primary/40 hover:shadow-md transition-all"
            >
              {items.slice(0, PREVIEW_COUNT).map((t: any, i: number) => renderReviewRow(t, i))}
              {items.length > PREVIEW_COUNT && (
                <div className="px-4 py-2.5 text-center text-[11px] sm:text-xs text-primary font-medium bg-muted/20 hover:bg-primary/5 transition-colors">
                  + আরও {items.length - PREVIEW_COUNT} টি রিভিউ দেখতে ক্লিক করুন
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      <Dialog open={allOpen} onOpenChange={setAllOpen}>
        <DialogContent className="max-w-3xl p-0 gap-0 max-h-[85vh] flex flex-col">
          <DialogHeader className="px-4 py-3 border-b shrink-0">
            <DialogTitle>সকল রিভিউ ({items.length})</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto divide-y divide-border">
            {items.map((t: any, i: number) => renderReviewRow(t, i))}
          </div>
        </DialogContent>
      </Dialog>

      <ReviewSubmitDialog open={reviewFormOpen} onOpenChange={setReviewFormOpen} />


      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-3xl p-2 sm:p-4 bg-background border border-border">
          <DialogTitle className="sr-only">রিভিউ ছবি</DialogTitle>
          {lightboxImages.length > 0 && (
            <div className="relative">
              <img
                src={lightboxImages[lightboxIdx]}
                alt="রিভিউ ছবি"
                className="w-full max-h-[80vh] object-contain rounded-lg"
              />
              {lightboxImages.length > 1 && (
                <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between px-2">
                  <button
                    onClick={() => setLightboxIdx((lightboxIdx - 1 + lightboxImages.length) % lightboxImages.length)}
                    className="w-10 h-10 rounded-full bg-foreground/10 backdrop-blur flex items-center justify-center hover:bg-foreground/20 transition-colors"
                  >
                    <ChevronLeft className="h-5 w-5 text-foreground" />
                  </button>
                  <button
                    onClick={() => setLightboxIdx((lightboxIdx + 1) % lightboxImages.length)}
                    className="w-10 h-10 rounded-full bg-foreground/10 backdrop-blur flex items-center justify-center hover:bg-foreground/20 transition-colors"
                  >
                    <ChevronRight className="h-5 w-5 text-foreground" />
                  </button>
                </div>
              )}
              {lightboxImages.length > 1 && (
                <div className="flex justify-center gap-1.5 mt-3">
                  {lightboxImages.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setLightboxIdx(idx)}
                      className={`w-2 h-2 rounded-full transition-colors ${idx === lightboxIdx ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
