import { useState, useEffect, useRef } from 'react';
import CodeEditor from '@/components/admin/CodeEditor';
import CodeEditorWithPreview from '@/components/admin/CodeEditorWithPreview';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash2, Edit, Save, Loader2, GripVertical, ChevronUp, ChevronDown, Eye, EyeOff, ExternalLink, ImagePlus, X, Image as ImageIcon } from 'lucide-react';
import { useSiteConfig, useSaveSiteConfig } from '@/hooks/useSiteConfig';
import { supabase } from '@/integrations/supabase/client';
import { optimizeImage } from '@/lib/imageOptimizer';

interface PageSection {
  heading: string;
  icon: string;
  body: string;
  style?: string;
  type?: 'default' | 'html_blog' | 'license';
  image?: string;
}

interface PageConfig {
  id: string;
  title: string;
  subtitle?: string;
  seo_title?: string;
  slug: string;
  route: string;
  is_builtin: boolean;
  enabled: boolean;
  icon?: string;
  sections: PageSection[];
}

const DEFAULT_BUILTIN_PAGES: PageConfig[] = [
  {
    id: 'about',
    title: 'আমাদের সম্পর্কে',
    subtitle: 'About Us – স্বর্ণ সুতা',
    slug: 'about',
    route: '/about',
    is_builtin: true,
    enabled: true,
    icon: '📖',
    sections: [
      { heading: 'আমাদের গল্প', icon: '🛍️', body: 'স্বর্ণ সুতা-এর পথচলা শুরু হয় ২০১৬ সালে, Daraz প্ল্যাটফর্মের মাধ্যমে।' },
      { heading: 'বর্তমানে আমাদের রয়েছে', icon: '🏭', body: 'এমব্রয়ডারি ফ্যাক্টরি, স্ক্রিন প্রিন্ট ফ্যাক্টরি, সেলাই ফ্যাক্টরি, অফিস (অনলাইন সেলস)' },
      { heading: 'আমাদের লক্ষ্য', icon: '🎯', body: 'আমরা সরাসরি গ্রাহকের কাছে পণ্য পৌঁছে দিই। মধ্যস্বত্বভোগী না থাকায় আমরা তুলনামূলক কম দামে ভালো মানের পণ্য দিতে সক্ষম।' },
      { heading: 'প্রতিষ্ঠাতা', icon: '👤', body: 'MD SOLAYMAN — Founder, Shorno Suta' },
    ],
  },
  {
    id: 'contact',
    title: 'যোগাযোগ করুন',
    subtitle: 'Contact Us – Shorno Suta',
    slug: 'contact',
    route: '/contact',
    is_builtin: true,
    enabled: true,
    icon: '📞',
    sections: [
      { heading: 'Customer Support & Help Desk', icon: '📌', body: 'Help Line: +880 9617 888821\nWhatsApp Support: +880 1974 313871\nসাপোর্ট সময়: প্রতিদিন সকাল ১০টা – রাত ৯টা' },
      { heading: 'Office Address', icon: '📍', body: '৬৪, নবীনগর নার্সারি গলি, ১২ নং রোড, কামরাঙ্গীরচর, ঢাকা – ১২১১, বাংলাদেশ' },
    ],
  },
  {
    id: 'policies',
    title: 'নীতিমালা',
    subtitle: 'Policies – Shorno Suta',
    slug: 'policies',
    route: '/policies',
    is_builtin: true,
    enabled: true,
    icon: '📋',
    sections: [
      { heading: 'রিটার্ন পলিসি', icon: '🔁', body: 'ডেলিভারি ম্যানের সামনে প্রোডাক্ট চেক করা বাধ্যতামূলক। পছন্দ না হলে ডেলিভারি চার্জ দিয়ে রিটার্ন করা যাবে।' },
      { heading: 'ক্যানসেলেশন পলিসি', icon: '❌', body: 'শিপ করার আগে ক্যানসেল করলে কোনো চার্জ নেই। শিপ হওয়ার পর ক্যানসেল করলে ডেলিভারি চার্জ দিতে হবে।' },
      { heading: 'এক্সচেঞ্জ / রিফান্ড পলিসি', icon: '🔄', body: 'আমরা রিফান্ড দিই না, তবে এক্সচেঞ্জ সুবিধা দিয়ে থাকি।' },
    ],
  },
];

export default function PagesManager() {
  const { data: savedData, isLoading } = useSiteConfig('pages_config');
  const saveMutation = useSaveSiteConfig();
  const [pages, setPages] = useState<PageConfig[]>([]);
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (isLoading || initialized) return;
    if (savedData?.pages?.length) {
      const existing = savedData.pages as PageConfig[];
      const merged = [...existing];
      for (const def of DEFAULT_BUILTIN_PAGES) {
        if (!merged.find(p => p.id === def.id)) {
          merged.push(def);
        }
      }
      setPages(merged);
    } else {
      setPages([...DEFAULT_BUILTIN_PAGES]);
    }
    setInitialized(true);
  }, [isLoading, savedData, initialized]);

  const savePages = async (updatedPages: PageConfig[]) => {
    try {
      await saveMutation.mutateAsync({ key: 'pages_config', value: { pages: updatedPages } });
      toast.success('সেভ হয়েছে!');
    } catch {
      toast.error('সেভ করতে সমস্যা হয়েছে');
    }
  };

  const togglePage = (id: string) => {
    const updated = pages.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p);
    setPages(updated);
    savePages(updated);
  };

  const deletePage = (id: string) => {
    const updated = pages.filter(p => p.id !== id);
    setPages(updated);
    savePages(updated);
    if (editingPageId === id) setEditingPageId(null);
  };

  const addNewPage = () => {
    const newPage: PageConfig = {
      id: `custom_${Date.now()}`,
      title: 'নতুন পেজ',
      subtitle: '',
      seo_title: '',
      slug: `new-page-${Date.now()}`,
      route: '',
      is_builtin: false,
      enabled: true,
      icon: '📄',
      sections: [{ heading: 'সেকশন ১', icon: '📝', body: 'এখানে কন্টেন্ট লিখুন...' }],
    };
    newPage.route = `/page/${newPage.slug}`;
    const updated = [...pages, newPage];
    setPages(updated);
    setEditingPageId(newPage.id);
  };

  const updatePage = (id: string, updates: Partial<PageConfig>) => {
    setPages(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const getPreviewUrl = (page: PageConfig) => {
    return page.is_builtin ? page.route : `/page/${page.slug}`;
  };

  const editingPage = pages.find(p => p.id === editingPageId);

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[200px] text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> লোড হচ্ছে...</div>;
  }

  if (editingPage) {
    return (
      <PageEditor
        page={editingPage}
        onChange={(updates) => updatePage(editingPage.id, updates)}
        onSave={() => { savePages(pages); setEditingPageId(null); }}
        onBack={() => setEditingPageId(null)}
        isSaving={saveMutation.isPending}
        previewUrl={getPreviewUrl(editingPage)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">পেজ ম্যানেজার</h2>
          <p className="text-sm text-muted-foreground">পেজ তৈরি, এডিট ও চালু/বন্ধ করুন</p>
        </div>
        <Button onClick={addNewPage} className="gap-2">
          <Plus className="h-4 w-4" /> নতুন পেজ
        </Button>
      </div>

      <div className="space-y-2">
        {pages.map(page => (
          <div key={page.id} className="flex items-center gap-3 p-4 border border-border rounded-lg bg-card hover:shadow-sm transition-shadow">
            <span className="text-2xl">{page.icon || '📄'}</span>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm truncate">{page.title}</h3>
              <p className="text-xs text-muted-foreground truncate">{page.is_builtin ? page.route : `/page/${page.slug}`}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {page.enabled ? (
                <span className="text-xs text-green-600 flex items-center gap-1"><Eye className="h-3 w-3" /> চালু</span>
              ) : (
                <span className="text-xs text-muted-foreground flex items-center gap-1"><EyeOff className="h-3 w-3" /> বন্ধ</span>
              )}
              <Switch checked={page.enabled} onCheckedChange={() => togglePage(page.id)} />
              <Button variant="outline" size="sm" onClick={() => window.open(getPreviewUrl(page), '_blank')} className="gap-1" title="প্রিভিউ দেখুন">
                <ExternalLink className="h-3 w-3" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditingPageId(page.id)} className="gap-1">
                <Edit className="h-3 w-3" /> এডিট
              </Button>
              {!page.is_builtin && (
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => deletePage(page.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PageEditor({ page, onChange, onSave, onBack, isSaving, previewUrl }: {
  page: PageConfig;
  onChange: (updates: Partial<PageConfig>) => void;
  onSave: () => void;
  onBack: () => void;
  isSaving: boolean;
  previewUrl: string;
}) {
  const updateSection = (idx: number, updates: Partial<PageSection>) => {
    const newSections = [...page.sections];
    newSections[idx] = { ...newSections[idx], ...updates };
    onChange({ sections: newSections });
  };

  const addSection = (type: 'default' | 'html_blog' | 'license' = 'default') => {
    if (type === 'html_blog') {
      onChange({ sections: [...page.sections, { heading: '', icon: '', body: '', type: 'html_blog' }] });
    } else if (type === 'license') {
      onChange({ sections: [...page.sections, { heading: 'ট্রেড লাইসেন্স', icon: '📜', body: '', type: 'license' }] });
    } else {
      onChange({ sections: [...page.sections, { heading: 'নতুন সেকশন', icon: '📝', body: '' }] });
    }
  };

  const removeSection = (idx: number) => {
    onChange({ sections: page.sections.filter((_, i) => i !== idx) });
  };

  const moveSection = (idx: number, dir: 'up' | 'down') => {
    const newSections = [...page.sections];
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= newSections.length) return;
    [newSections[idx], newSections[swapIdx]] = [newSections[swapIdx], newSections[idx]];
    onChange({ sections: newSections });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
          <h2 className="text-lg font-bold">{page.icon} {page.title} এডিট</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => window.open(previewUrl, '_blank')} className="gap-2">
            <ExternalLink className="h-4 w-4" /> প্রিভিউ দেখুন
          </Button>
          <Button onClick={onSave} disabled={isSaving} className="gap-2">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            সেভ করুন
          </Button>
        </div>
      </div>

      {/* Page Meta */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">পেজ টাইটেল</Label>
              <Input value={page.title} onChange={e => onChange({ title: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">সাবটাইটেল</Label>
              <Input value={page.subtitle || ''} onChange={e => onChange({ subtitle: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">আইকন (Emoji)</Label>
              <Input value={page.icon || ''} onChange={e => onChange({ icon: e.target.value })} placeholder="📄" />
            </div>
            <div>
              <Label className="text-xs">SEO টাইটেল</Label>
              <Input value={page.seo_title || ''} onChange={e => onChange({ seo_title: e.target.value })} placeholder="ব্রাউজার ট্যাবে দেখাবে" />
            </div>
          </div>
          {!page.is_builtin && (
            <div>
              <Label className="text-xs">Slug (ইংরেজি, lowercase)</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">/page/</span>
                <Input
                  value={page.slug}
                  onChange={e => {
                    const slug = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                    onChange({ slug, route: `/page/${slug}` });
                  }}
                  placeholder="my-page"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sections */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">কন্টেন্ট সেকশনসমূহ</Label>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => addSection('default')} className="gap-1">
              <Plus className="h-3 w-3" /> সেকশন
            </Button>
            <Button variant="outline" size="sm" onClick={() => addSection('license')} className="gap-1">
              <Plus className="h-3 w-3" /> লাইসেন্স
            </Button>
            <Button variant="outline" size="sm" onClick={() => addSection('html_blog')} className="gap-1">
              <Plus className="h-3 w-3" /> HTML Blog
            </Button>
          </div>
        </div>

        {page.sections.map((section, idx) => {
          const isHtmlBlog = section.type === 'html_blog';
          const isLicense = section.type === 'license';
          return (
            <Card key={idx}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {isHtmlBlog ? '🌐 HTML Blog ব্লক' : isLicense ? '📜 লাইসেন্স সেকশন' : `সেকশন ${idx + 1}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Select
                      value={section.type || 'default'}
                      onValueChange={(val) => updateSection(idx, { type: val as 'default' | 'html_blog' | 'license' })}
                    >
                      <SelectTrigger className="h-7 w-[130px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">ডিফল্ট</SelectItem>
                        <SelectItem value="license">📜 লাইসেন্স</SelectItem>
                        <SelectItem value="html_blog">HTML Blog</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveSection(idx, 'up')} disabled={idx === 0}>
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveSection(idx, 'down')} disabled={idx === page.sections.length - 1}>
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeSection(idx)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {isHtmlBlog ? (
                  <div>
                    <Label className="text-xs mb-1">HTML কন্টেন্ট + লাইভ প্রিভিউ</Label>
                    <CodeEditorWithPreview
                      htmlValue={section.body}
                      onHtmlChange={v => updateSection(idx, { body: v })}
                      cssValue={section.style || ''}
                      onCssChange={v => updateSection(idx, { style: v })}
                      height={400}
                      htmlPlaceholder="<div>আপনার HTML কন্টেন্ট এখানে লিখুন...</div>"
                    />
                  </div>
                ) : isLicense ? (
                  <>
                    <div>
                      <Label className="text-xs">হেডিং</Label>
                      <Input value={section.heading} onChange={e => updateSection(idx, { heading: e.target.value })} placeholder="ট্রেড লাইসেন্স" />
                    </div>
                    <div>
                      <Label className="text-xs">বিবরণ (ঐচ্ছিক)</Label>
                      <Textarea value={section.body} onChange={e => updateSection(idx, { body: e.target.value })} rows={2} className="text-xs" placeholder="লাইসেন্স নম্বর বা অন্যান্য তথ্য..." />
                    </div>
                    <SectionImageUpload
                      image={section.image}
                      onImageChange={(url) => updateSection(idx, { image: url })}
                      label="লাইসেন্সের ছবি আপলোড করুন"
                    />
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-[1fr_60px] gap-2">
                      <div>
                        <Label className="text-xs">হেডিং</Label>
                        <Input value={section.heading} onChange={e => updateSection(idx, { heading: e.target.value })} />
                      </div>
                      <div>
                        <Label className="text-xs">আইকন</Label>
                        <Input value={section.icon} onChange={e => updateSection(idx, { icon: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">কন্টেন্ট (HTML/টেক্সট)</Label>
                      <Textarea
                        value={section.body}
                        onChange={e => updateSection(idx, { body: e.target.value })}
                        rows={4}
                        className="text-xs"
                      />
                    </div>
                    <SectionImageUpload
                      image={section.image}
                      onImageChange={(url) => updateSection(idx, { image: url })}
                    />
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function SectionImageUpload({ image, onImageChange, label }: { image?: string; onImageChange: (url: string | undefined) => void; label?: string }) {
  const [uploading, setUploading] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const MediaCenter = useRef<typeof import('@/components/admin/MediaCenter').default | null>(null);
  const [MediaLoaded, setMediaLoaded] = useState(false);

  const openMedia = async () => {
    if (!MediaCenter.current) {
      const mod = await import('@/components/admin/MediaCenter');
      MediaCenter.current = mod.default;
      setMediaLoaded(true);
    }
    setMediaOpen(true);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const optimized = await optimizeImage(file);
      const fileName = `pages/${Date.now()}-${optimized.name}`;
      const { error } = await supabase.storage.from('product-images').upload(fileName, optimized, { cacheControl: '31536000' });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(fileName);
      onImageChange(publicUrl);
      toast.success('ছবি আপলোড হয়েছে');
    } catch {
      toast.error('ছবি আপলোড ব্যর্থ');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const MC = MediaCenter.current;

  return (
    <div>
      <Label className="text-xs">{label || 'সেকশন ছবি (ঐচ্ছিক)'}</Label>
      {image ? (
        <div className="relative mt-1 inline-block">
          <img src={image} alt="" className="h-24 w-auto rounded-md border border-border object-cover" />
          <Button
            variant="destructive"
            size="icon"
            className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
            onClick={() => onImageChange(undefined)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <div className="mt-1 flex items-center gap-2">
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="gap-1"
          >
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImagePlus className="h-3 w-3" />}
            আপলোড
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openMedia}
            className="gap-1"
          >
            <ImageIcon className="h-3 w-3" />
            মিডিয়া থেকে
          </Button>
        </div>
      )}
      {MC && (
        <MC
          open={mediaOpen}
          onOpenChange={setMediaOpen}
          onSelect={(urls: string[]) => {
            if (urls.length > 0) onImageChange(urls[0]);
          }}
          multiple={false}
        />
      )}
    </div>
  );
}