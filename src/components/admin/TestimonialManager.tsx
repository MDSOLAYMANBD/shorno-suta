import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Save, Plus, Trash2, Star, Loader2, X, ImageIcon, ChevronDown, ChevronRight, Search, GripVertical, Sparkles } from 'lucide-react';
import { useSiteConfig, useSaveSiteConfig, DEFAULT_HOMEPAGE_CONFIG } from '@/hooks/useSiteConfig';
import MediaCenter from '@/components/admin/MediaCenter';

interface TestimonialItem {
  name: string;
  location: string;
  text: string;
  rating: number;
  images: string[];
}

const SAMPLE_REVIEWS: TestimonialItem[] = [
  { name: 'নাজমুল হাসান', location: 'ঢাকা', text: 'অসাধারণ প্রোডাক্ট! কোয়ালিটি দেখে মুগ্ধ হয়েছি। আবারও অর্ডার করব ইনশাআল্লাহ।', rating: 5, images: [] },
  { name: 'তাসনিম আক্তার', location: 'চট্টগ্রাম', text: 'ডেলিভারি খুব দ্রুত পেয়েছি। পণ্যের মান চমৎকার, দাম অনুযায়ী ভ্যালু ফর মানি।', rating: 5, images: [] },
  { name: 'রুমানা বেগম', location: 'রাজশাহী', text: 'প্রথমবার অর্ডার করলাম, ভেবেছিলাম হয়তো ভালো হবে না। কিন্তু পেয়ে অবাক! দারুণ কোয়ালিটি।', rating: 5, images: [] },
  { name: 'ফারজানা ইসলাম', location: 'খুলনা', text: 'বন্ধুকে গিফট দিয়েছিলাম, সে খুব খুশি হয়েছে। প্যাকেজিংও সুন্দর ছিল।', rating: 5, images: [] },
  { name: 'মোঃ রাকিবুল ইসলাম', location: 'সিলেট', text: 'আগে অন্য জায়গা থেকে নিতাম, কিন্তু এখানকার প্রোডাক্ট পেয়ে আর কোথাও যাই না।', rating: 5, images: [] },
  { name: 'সাবরিনা চৌধুরী', location: 'বরিশাল', text: 'কাস্টমার সার্ভিস অসাধারণ! সমস্যা হলে সাথে সাথে সমাধান করে দেয়।', rating: 5, images: [] },
  { name: 'আবদুল করিম', location: 'রংপুর', text: 'দামে কম কিন্তু মানে অনেক ভালো। পরিবারের সবাই পছন্দ করেছে।', rating: 4, images: [] },
  { name: 'নুসরাত জাহান', location: 'কুমিল্লা', text: 'তিনবার অর্ডার করেছি, প্রতিবারই একই মান পেয়েছি। বিশ্বস্ত দোকান।', rating: 5, images: [] },
  { name: 'মাহমুদুল হক', location: 'গাজীপুর', text: 'ছবির সাথে হুবহু মিলে গেছে। অনলাইনে এত ভালো অভিজ্ঞতা আগে হয়নি।', rating: 5, images: [] },
  { name: 'আফরোজা খাতুন', location: 'নারায়ণগঞ্জ', text: 'খুব সুন্দর প্রোডাক্ট, দ্রুত ডেলিভারি। সবাইকে রেকমেন্ড করছি।', rating: 5, images: [] },
  { name: 'শাহরিয়ার কবির', location: 'ময়মনসিংহ', text: 'পণ্যটি ব্যবহার করে সন্তুষ্ট। দামও সাশ্রয়ী। ধন্যবাদ!', rating: 4, images: [] },
  { name: 'জান্নাতুল ফেরদৌস', location: 'টাঙ্গাইল', text: 'বাচ্চাদের জন্য নিয়েছিলাম। ওরা অনেক পছন্দ করেছে। থ্যাংক ইউ!', rating: 5, images: [] },
  { name: 'কামরুজ্জামান', location: 'ব্রাহ্মণবাড়িয়া', text: 'অর্ডার করার পর ৪৮ ঘণ্টার মধ্যে পেয়েছি। চমৎকার সেবা।', rating: 5, images: [] },
  { name: 'মিতু রহমান', location: 'যশোর', text: 'প্রোডাক্টের ফিনিশিং অনেক ভালো। আমি ১০০% সন্তুষ্ট।', rating: 5, images: [] },
  { name: 'সোহেল রানা', location: 'দিনাজপুর', text: 'অনলাইনে প্রথমবার কেনাকাটা, অনেক ভয়ে ছিলাম। কিন্তু পেয়ে মনে হলো সঠিক জায়গায় অর্ডার করেছি।', rating: 5, images: [] },
  { name: 'শারমিন সুলতানা', location: 'পাবনা', text: 'বোনের বিয়েতে গিফট হিসেবে দিয়েছি। সবাই জানতে চায় কোথা থেকে কিনেছি!', rating: 5, images: [] },
  { name: 'ইমরান হোসেন', location: 'বগুড়া', text: 'দ্বিতীয়বার অর্ডার করলাম। আগেরবারের মতোই ভালো পেয়েছি।', rating: 4, images: [] },
  { name: 'ফাতেমা আলম', location: 'নোয়াখালী', text: 'প্যাকেজিং এত সুন্দর যে খোলতে ইচ্ছে করে না! প্রোডাক্টও অসাধারণ।', rating: 5, images: [] },
  { name: 'তানভীর আহমেদ', location: 'ফেনী', text: 'বন্ধুদের দেখে অর্ডার করলাম, নিজেও এখন ফ্যান হয়ে গেছি!', rating: 5, images: [] },
  { name: 'রেশমা পারভীন', location: 'মানিকগঞ্জ', text: 'দাম, মান, ডেলিভারি — সব দিক থেকেই সেরা। আল্লাহ বরকত দিন।', rating: 5, images: [] },
];

export default function TestimonialManager() {
  const { data: savedConfig, isLoading } = useSiteConfig('homepage_config');
  const saveMutation = useSaveSiteConfig();

  const [heading, setHeading] = useState('');
  const [subheading, setSubheading] = useState('');
  const [items, setItems] = useState<TestimonialItem[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [mediaOpenIdx, setMediaOpenIdx] = useState<number | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!isLoading && !initialized) {
      const testimonials = savedConfig?.testimonials || DEFAULT_HOMEPAGE_CONFIG.testimonials;
      setHeading(testimonials.heading || '');
      setSubheading(testimonials.subheading || '');
      setItems(testimonials.items || []);
      setInitialized(true);
    }
  }, [isLoading, savedConfig, initialized]);

  const handleSave = async () => {
    try {
      const fullConfig = savedConfig || DEFAULT_HOMEPAGE_CONFIG;
      const updated = {
        ...fullConfig,
        testimonials: {
          ...fullConfig.testimonials,
          heading,
          subheading,
          items,
        },
      };
      await saveMutation.mutateAsync({ key: 'homepage_config', value: updated });
      toast.success('টেস্টিমোনিয়াল সেভ হয়েছে!');
    } catch {
      toast.error('সেভ করতে সমস্যা হয়েছে');
    }
  };

  const updateItem = (idx: number, field: string, value: any) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const addItem = () => {
    const newIdx = items.length;
    setItems(prev => [...prev, { name: '', location: '', text: '', rating: 5, images: [] }]);
    setExpandedIdx(newIdx);
    setSearchQuery('');
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
    if (expandedIdx === idx) setExpandedIdx(null);
    else if (expandedIdx !== null && expandedIdx > idx) setExpandedIdx(expandedIdx - 1);
  };

  const handleDragStart = (idx: number) => {
    setDragIdx(idx);
    setExpandedIdx(null);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    setDragOverIdx(idx);
  };

  const handleDrop = (idx: number) => {
    if (dragIdx === null || dragIdx === idx) return;
    setItems(prev => {
      const arr = [...prev];
      const [moved] = arr.splice(dragIdx, 1);
      arr.splice(idx, 0, moved);
      return arr;
    });
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const handleDragEnd = () => {
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const addSampleReviews = () => {
    setItems(prev => [...prev, ...SAMPLE_REVIEWS]);
    toast.success('২০টি স্যাম্পল রিভিউ যোগ হয়েছে!');
  };

  const addImage = (idx: number, url: string) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, images: [...(item.images || []), url] } : item));
  };

  const removeImage = (idx: number, imgIdx: number) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, images: (item.images || []).filter((_, j) => j !== imgIdx) } : item));
  };

  const isSearchActive = searchQuery.trim().length > 0;

  const filteredItems = items.map((item, idx) => ({ item, idx })).filter(({ item }) => {
    if (!isSearchActive) return true;
    const q = searchQuery.toLowerCase();
    return item.name.toLowerCase().includes(q) || item.text.toLowerCase().includes(q) || item.location.toLowerCase().includes(q);
  });

  if (isLoading || !initialized) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">🌟 টেস্টিমোনিয়াল সেটিংস</CardTitle>
            <Badge variant="secondary" className="text-xs">{items.length}টি</Badge>
          </div>
          <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending} className="gap-1.5">
            {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            সেভ করুন
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Heading & Subheading */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">হেডিং</Label>
            <Input value={heading} onChange={e => setHeading(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">সাবহেডিং</Label>
            <Input value={subheading} onChange={e => setSubheading(e.target.value)} />
          </div>
        </div>

        {/* Search */}
        {items.length > 3 && (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="নাম বা রিভিউ দিয়ে খুঁজুন..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
        )}

        {/* Items - Compact List */}
        <div className="space-y-1">
          <Label className="text-xs font-semibold">রিভিউ তালিকা</Label>
          <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
            {filteredItems.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-4">
                {searchQuery ? 'কোনো রিভিউ পাওয়া যায়নি' : 'কোনো রিভিউ নেই'}
              </div>
            )}
            {filteredItems.map(({ item, idx }) => (
              <div
                key={idx}
                className={`bg-background transition-all ${dragIdx === idx ? 'opacity-40' : ''} ${dragOverIdx === idx ? 'ring-2 ring-primary ring-inset' : ''}`}
                draggable={!isSearchActive}
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={() => handleDrop(idx)}
                onDragEnd={handleDragEnd}
              >
                {/* Compact Row */}
                <div
                  className="flex items-center gap-1.5 px-2.5 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                >
                  {!isSearchActive && (
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0 cursor-grab active:cursor-grabbing" />
                  )}
                  {expandedIdx === idx
                    ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  }
                  <span className="text-xs text-muted-foreground w-5 shrink-0">#{idx + 1}</span>
                  <span className="text-xs font-medium truncate min-w-0 flex-1">
                    {item.name || <span className="text-muted-foreground italic">নাম নেই</span>}
                  </span>
                  {item.location && (
                    <span className="text-xs text-muted-foreground truncate max-w-[80px] hidden sm:inline">{item.location}</span>
                  )}
                  <div className="flex shrink-0">
                    {[1, 2, 3, 4, 5].map(r => (
                      <Star key={r} className={`h-3 w-3 ${r <= (item.rating || 5) ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground/30'}`} />
                    ))}
                  </div>
                  {(item.images || []).length > 0 && (
                    <span className="text-xs text-muted-foreground shrink-0">📷{item.images.length}</span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={e => { e.stopPropagation(); removeItem(idx); }}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>

                {/* Expanded Edit Form */}
                {expandedIdx === idx && (
                  <div className="px-3 pb-3 pt-1 space-y-2 bg-muted/20 border-t border-border">
                    <Input placeholder="নাম" value={item.name} onChange={e => updateItem(idx, 'name', e.target.value)} className="text-xs h-8" />
                    <Input placeholder="লোকেশন" value={item.location} onChange={e => updateItem(idx, 'location', e.target.value)} className="text-xs h-8" />
                    <Textarea placeholder="রিভিউ টেক্সট" value={item.text} onChange={e => updateItem(idx, 'text', e.target.value)} rows={2} className="text-xs" />
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">রেটিং:</Label>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map(r => (
                          <button key={r} onClick={() => updateItem(idx, 'rating', r)}>
                            <Star className={`h-4 w-4 ${r <= (item.rating || 5) ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground'}`} />
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Images */}
                    <div className="space-y-1.5">
                      <Label className="text-xs">ছবি/স্ক্রিনশট</Label>
                      {(item.images || []).length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {(item.images || []).map((img, imgIdx) => (
                            <div key={imgIdx} className="relative group w-14 h-14 rounded-md overflow-hidden border border-border">
                              <img src={img} alt="" className="w-full h-full object-cover" />
                              <button
                                onClick={() => removeImage(idx, imgIdx)}
                                className="absolute top-0 right-0 bg-destructive text-destructive-foreground rounded-bl-md p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <Button variant="outline" size="sm" className="gap-1 text-xs h-7" onClick={() => setMediaOpenIdx(idx)}>
                        <ImageIcon className="h-3 w-3" /> ছবি যোগ করুন
                      </Button>
                    </div>
                    {mediaOpenIdx === idx && (
                      <MediaCenter
                        open={true}
                        onOpenChange={(open) => { if (!open) setMediaOpenIdx(null); }}
                        onSelect={(urls: string[]) => {
                          if (urls.length > 0) addImage(idx, urls[0]);
                          setMediaOpenIdx(null);
                        }}
                      />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" size="sm" className="flex-1 gap-1 border-dashed" onClick={addItem}>
              <Plus className="h-3 w-3" /> রিভিউ যোগ করুন
            </Button>
            <Button variant="outline" size="sm" className="gap-1 border-dashed" onClick={addSampleReviews}>
              <Sparkles className="h-3 w-3" /> ২০টি স্যাম্পল যোগ করুন
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
