import { useState } from 'react';
import Layout from '@/components/layout/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Factory, Target, User, ShoppingBag, Scissors, Printer, CheckCircle2, Award, X, ShieldCheck, FileCheck } from 'lucide-react';
import { useSiteConfig } from '@/hooks/useSiteConfig';
import { sanitizeHtml } from '@/lib/sanitize';
import NotFound from './NotFound';
import SEOHead from '@/components/SEOHead';

export default function About() {
  const { data: pagesData, isLoading } = useSiteConfig('pages_config');
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  const pageConfig = pagesData?.pages?.find((p: any) => p.id === 'about');

  if (pageConfig && !pageConfig.enabled) return <NotFound />;

  // DB-driven rendering
  if (pageConfig?.sections?.length) {
    return (
      <Layout>
        <SEOHead title="আমাদের সম্পর্কে | স্বর্ণ সুতা" description="স্বর্ণ সুতা সম্পর্কে জানুন। ২০১৬ সাল থেকে সেরা মানের পোশাক তৈরি ও বিক্রয়।" canonical="/about" />

        {/* Editorial Hero */}
        <section className="relative overflow-hidden border-b border-border/40 bg-gradient-to-b from-primary/[0.05] via-background to-background">
          <div className="absolute inset-0 pointer-events-none opacity-[0.12]"
            style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)', backgroundSize: '24px 24px' }} />
          <div className="container relative py-16 md:py-24 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs font-medium tracking-wider uppercase mb-6">
              {pageConfig.icon ? <span>{pageConfig.icon}</span> : <Award className="h-3.5 w-3.5" />}
              Est. ২০১৬ · Shorno Suta
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold text-foreground tracking-tight leading-[1.1] max-w-3xl mx-auto">
              {pageConfig.title}
            </h1>
            {pageConfig.subtitle && (
              <p className="text-base md:text-lg text-muted-foreground mt-5 max-w-2xl mx-auto leading-relaxed">{pageConfig.subtitle}</p>
            )}
          </div>
        </section>

        <div className="container py-16 md:py-20">
          <div className="max-w-4xl mx-auto space-y-16 md:space-y-20">
            {pageConfig.sections.map((section: any, idx: number) => {
              if (section.type === 'html_blog') {
                return (
                  <article key={idx} className="prose prose-sm md:prose-base max-w-none prose-headings:font-bold prose-headings:text-foreground prose-p:text-muted-foreground prose-p:leading-relaxed prose-a:text-primary" dangerouslySetInnerHTML={{ __html: sanitizeHtml(section.body) }} />
                );
              }
              if (section.type === 'license') {
                return (
                  <Card key={idx} className="overflow-hidden border-none shadow-lg bg-gradient-to-br from-primary/5 via-background to-secondary/5">
                    <CardContent className="p-0">
                      <div className="flex items-center gap-3 px-6 pt-6 pb-4 md:px-8 md:pt-8">
                        <div className="h-11 w-11 rounded-xl bg-primary/15 flex items-center justify-center ring-2 ring-primary/10">
                          <ShieldCheck className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h2 className="text-xl md:text-2xl font-bold text-foreground">{section.heading || 'ট্রেড লাইসেন্স'}</h2>
                          {section.body && <p className="text-sm text-muted-foreground mt-0.5">{section.body}</p>}
                        </div>
                        <Badge className="shrink-0 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20 gap-1.5 py-1 px-3">
                          <FileCheck className="h-3.5 w-3.5" /> সত্যায়িত
                        </Badge>
                      </div>
                      {section.image && (
                        <div className="px-4 pb-6 md:px-6 md:pb-8">
                          <div
                            className="w-full rounded-xl overflow-hidden border border-border/60 shadow-inner bg-muted/20 cursor-pointer group relative"
                            onClick={() => setLightboxImg(section.image)}
                          >
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center z-10">
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm flex items-center gap-1.5">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="M11 8v6"/><path d="M8 11h6"/></svg>
                                বড় করে দেখুন
                              </div>
                            </div>
                            <img
                              src={section.image}
                              alt={section.heading || 'Trade License'}
                              className="w-full h-auto object-contain group-hover:scale-[1.01] transition-transform duration-300"
                            />
                          </div>
                          <p className="text-xs text-muted-foreground/60 text-center mt-3 flex items-center justify-center gap-1.5">
                            <ShieldCheck className="h-3 w-3" />
                            ঢাকা দক্ষিণ সিটি কর্পোরেশন কর্তৃক ইস্যুকৃত
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              }
              // Smart renderer based on heading keywords
              const heading: string = section.heading || '';
              const body: string = section.body || '';
              const stripTags = (s: string) => s.replace(/<[^>]*>/g, '').trim();
              const cleanBody = stripTags(body);

              // === STORY / TIMELINE ===
              // TODO: this whole timeline is the previous client's real company history
              // (Daraz origin, factories, etc.) — replace with Shorno Suta's actual story
              // once the client provides it. Do not ship this as-is.
              if (/গল্প|story|যাত্রা|journey|পথচলা/i.test(heading)) {
                const timeline = [
                  { year: '২০১৬', title: 'যাত্রা শুরু', text: 'Daraz প্ল্যাটফর্মের মাধ্যমে স্বর্ণ সুতা-এর পথচলা শুরু। প্রথমে ছোট পরিসরে কিচেন আইটেম নিয়ে কাজ শুরু হয়।' },
                  { year: '২০১৮', title: 'পোশাকে মনোযোগ', text: 'গ্রাহকদের চাহিদা অনুযায়ী পোশাক (Clothing) সেক্টরে মনোযোগ দেওয়া হয়। নিজস্ব উৎপাদন শুরু।' },
                  { year: '২০২০', title: 'নিজস্ব প্ল্যাটফর্ম', text: 'নিজস্ব ওয়েবসাইট ও সোশ্যাল মিডিয়া মার্কেটিং-এর মাধ্যমে সরাসরি গ্রাহকের কাছে পণ্য পৌঁছানো শুরু।' },
                  { year: 'বর্তমান', title: 'পূর্ণাঙ্গ উৎপাদন', text: 'এমব্রয়ডারি, স্ক্রিন প্রিন্ট ও সেলাই — তিনটি ফ্যাক্টরি সহ পূর্ণাঙ্গ উৎপাদন ব্যবস্থা।' },
                ];
                return (
                  <section key={idx}>
                    <div className="text-center mb-10">
                      <div className="text-xs font-semibold text-primary uppercase tracking-[0.2em] mb-2">— Our Journey —</div>
                      <h2 className="text-3xl md:text-4xl font-bold text-foreground flex items-center justify-center gap-3">
                        {section.icon && <span>{section.icon}</span>}{heading}
                      </h2>
                      {cleanBody && <p className="text-muted-foreground mt-3 max-w-xl mx-auto">{cleanBody}</p>}
                    </div>
                    {section.image && (
                      <div
                        className="relative w-full mb-10 rounded-3xl overflow-hidden border border-border/60 shadow-lg cursor-pointer group aspect-[21/9] bg-muted"
                        onClick={() => setLightboxImg(section.image)}
                      >
                        <img src={section.image} alt={heading} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
                      </div>
                    )}
                    <div className="relative">
                      <div className="absolute left-4 md:left-5 top-2 bottom-2 w-px bg-gradient-to-b from-transparent via-border to-transparent" />
                      <div className="space-y-6">
                        {timeline.map((it, i) => (
                          <div key={i} className="relative pl-14 md:pl-20">
                            <div className="absolute left-4 md:left-5 top-3 -translate-x-1/2 z-10">
                              <div className="h-4 w-4 rounded-full bg-background border-2 border-primary flex items-center justify-center shadow-sm">
                                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                              </div>
                            </div>
                            <div className="bg-card border border-border/60 rounded-2xl p-5 md:p-6 hover:border-primary/40 hover:shadow-md transition-all">
                              <div className="flex items-center gap-3 mb-2 flex-wrap">
                                <span className="text-[11px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full tracking-wider">{it.year}</span>
                                <h3 className="text-lg md:text-xl font-bold text-foreground">{it.title}</h3>
                              </div>
                              <p className="text-muted-foreground leading-relaxed text-[15px]">{it.text}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                );
              }

              // === FACILITIES ===
              if (/রয়েছে|ফ্যাক্টরি|facilit|factories|আমাদের রয়েছে/i.test(heading)) {
                const facilityIcons: Record<string, any> = {
                  embroid: Factory, এমব: Factory,
                  print: Printer, প্রিন্ট: Printer,
                  sew: Scissors, সেলাই: Scissors,
                  office: ShoppingBag, অফিস: ShoppingBag, sale: ShoppingBag,
                };
                const items = cleanBody
                  .split(/[,،\n।]/)
                  .map(s => s.trim())
                  .filter(Boolean);
                const pickIcon = (name: string) => {
                  const low = name.toLowerCase();
                  for (const k of Object.keys(facilityIcons)) {
                    if (low.includes(k.toLowerCase()) || name.includes(k)) return facilityIcons[k];
                  }
                  return Factory;
                };
                return (
                  <section key={idx}>
                    <div className="text-center mb-10">
                      <div className="text-xs font-semibold text-primary uppercase tracking-[0.2em] mb-2">— Our Facilities —</div>
                      <h2 className="text-3xl md:text-4xl font-bold text-foreground flex items-center justify-center gap-3">
                        {section.icon && <span>{section.icon}</span>}{heading}
                      </h2>
                      <p className="text-muted-foreground mt-3 max-w-xl mx-auto">প্রতিটি ধাপ — কাটিং থেকে প্যাকিং — সম্পূর্ণ নিজস্ব ব্যবস্থাপনায়</p>
                    </div>
                    {section.image && (
                      <div
                        className="relative w-full mb-10 rounded-3xl overflow-hidden border border-border/60 shadow-lg cursor-pointer group aspect-[21/9] bg-muted"
                        onClick={() => setLightboxImg(section.image)}
                      >
                        <img src={section.image} alt={heading} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
                      </div>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
                      {items.map((name, i) => {
                        const Icon = pickIcon(name);
                        const gradients = [
                          'from-emerald-500/20 via-teal-500/10 to-cyan-500/5',
                          'from-amber-500/20 via-orange-500/10 to-rose-500/5',
                          'from-violet-500/20 via-purple-500/10 to-fuchsia-500/5',
                          'from-sky-500/20 via-blue-500/10 to-indigo-500/5',
                        ];
                        const iconColors = ['text-emerald-600', 'text-amber-600', 'text-violet-600', 'text-sky-600'];
                        const ringColors = ['ring-emerald-500/20', 'ring-amber-500/20', 'ring-violet-500/20', 'ring-sky-500/20'];
                        const g = gradients[i % 4];
                        const ic = iconColors[i % 4];
                        const rc = ringColors[i % 4];
                        return (
                          <div key={i} className="group relative">
                            {/* Glow */}
                            <div className={`absolute -inset-0.5 rounded-2xl bg-gradient-to-br ${g} opacity-0 group-hover:opacity-100 blur-lg transition-opacity duration-500`} />
                            <div className="relative h-full bg-card border border-border/60 rounded-2xl p-5 md:p-6 overflow-hidden hover:border-primary/40 hover:shadow-xl transition-all duration-300 hover:-translate-y-1.5">
                              {/* Decorative gradient blob */}
                              <div className={`absolute -top-12 -right-12 w-28 h-28 rounded-full bg-gradient-to-br ${g} blur-2xl opacity-60 group-hover:opacity-100 group-hover:scale-125 transition-all duration-500`} />
                              {/* Number badge */}
                              <div className="absolute top-3 right-3 text-[10px] font-mono font-bold text-muted-foreground/40 tracking-wider">0{i + 1}</div>
                              {/* Icon plaque */}
                              <div className="relative mb-5">
                                <div className={`inline-flex h-14 w-14 md:h-16 md:w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${g} ring-4 ${rc} group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-sm`}>
                                  <Icon className={`h-7 w-7 md:h-8 md:w-8 ${ic}`} strokeWidth={1.75} />
                                </div>
                              </div>
                              <h3 className="relative font-bold text-sm md:text-[15px] text-foreground leading-tight">{name}</h3>
                              <div className="relative mt-3 pt-3 border-t border-border/40 flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider">
                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                সক্রিয়
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                  </section>
                );
              }

              // === MISSION / GOALS ===
              if (/লক্ষ্য|মিশন|mission|goal|উদ্দেশ্য/i.test(heading)) {
                // Split by ।, newline, or • to make bullet points; if only one sentence, split by full-stop
                let points = cleanBody.split(/\n|•|\u2022/).map(s => s.trim()).filter(Boolean);
                if (points.length <= 1) {
                  points = cleanBody.split(/।/).map(s => s.trim()).filter(Boolean);
                }
                if (points.length <= 1) {
                  points = [
                    'সরাসরি গ্রাহকের কাছে পণ্য পৌঁছে দেওয়া — মধ্যস্বত্বভোগী ছাড়া',
                    'তুলনামূলক কম দামে সেরা মানের পোশাক প্রদান',
                    'প্রতিটি পোশাক নিজস্ব ব্যবস্থাপনায় ধাপে ধাপে তৈরি',
                    'গ্রাহক সন্তুষ্টি সবার আগে — দ্রুত ডেলিভারি ও সহজ রিটার্ন',
                  ];
                }
                return (
                  <section key={idx} className="relative">
                    {/* Decorative background */}
                    <div className="absolute inset-0 -mx-4 md:-mx-8 rounded-3xl bg-gradient-to-br from-primary/[0.04] via-transparent to-secondary/[0.04] pointer-events-none" />
                    <div className="relative grid md:grid-cols-5 gap-8 md:gap-12 items-start py-8 md:py-12 px-4 md:px-8">
                      <div className="md:col-span-2">
                        <div className="md:sticky md:top-24">
                          {section.image ? (
                            <div
                              className="relative mb-5 rounded-2xl overflow-hidden border border-border/60 shadow-xl cursor-pointer group aspect-[4/3]"
                              onClick={() => setLightboxImg(section.image)}
                            >
                              <div className="absolute -inset-2 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 blur-xl opacity-60 -z-10" />
                              <img src={section.image} alt={heading} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                              <div className="absolute top-3 left-3 h-10 w-10 rounded-xl bg-background/90 backdrop-blur flex items-center justify-center shadow-md">
                                <Target className="h-5 w-5 text-primary" strokeWidth={2.25} />
                              </div>
                            </div>
                          ) : (
                            <div className="relative inline-block mb-5">
                              <div className="absolute -inset-2 rounded-2xl bg-gradient-to-br from-primary/30 to-secondary/30 blur-xl opacity-60" />
                              <div className="relative h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg">
                                <Target className="h-8 w-8 text-primary-foreground" strokeWidth={2} />
                              </div>
                            </div>
                          )}
                          <div className="text-xs font-semibold text-primary uppercase tracking-[0.2em] mb-2">— Our Mission —</div>
                          <h2 className="text-3xl md:text-4xl font-bold text-foreground leading-tight">
                            {heading.split(' ').map((w, i, arr) =>
                              i === arr.length - 1
                                ? <span key={i} className="italic font-serif text-primary"> {w}</span>
                                : <span key={i}>{i > 0 ? ' ' : ''}{w}</span>
                            )}
                          </h2>
                          <p className="text-muted-foreground mt-4 leading-relaxed">গ্রাহকের সন্তুষ্টি, মান, ও স্বচ্ছতা — এই তিনটি স্তম্ভে দাঁড়িয়ে আমাদের প্রতিটি সিদ্ধান্ত।</p>
                          <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
                            <div className="h-px flex-1 bg-border" />
                            <span className="font-semibold tracking-wider uppercase">৪টি প্রতিশ্রুতি</span>
                            <div className="h-px flex-1 bg-border" />
                          </div>
                        </div>
                      </div>
                      <div className="md:col-span-3 space-y-3">
                        {points.map((p, i) => (
                          <div
                            key={i}
                            className="group relative overflow-hidden rounded-2xl bg-card border border-border/60 hover:border-primary/40 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5"
                          >
                            {/* Hover accent bar */}
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary via-primary/70 to-primary/30 scale-y-0 group-hover:scale-y-100 origin-top transition-transform duration-500" />
                            {/* Decorative number */}
                            <div className="absolute -right-4 -bottom-6 text-7xl font-black text-primary/[0.06] group-hover:text-primary/[0.12] transition-colors select-none">
                              0{i + 1}
                            </div>
                            <div className="relative flex gap-4 p-5 md:p-6">
                              <div className="shrink-0">
                                <div className="relative">
                                  <div className="absolute inset-0 rounded-full bg-primary/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
                                  <div className="relative h-11 w-11 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                                    <CheckCircle2 className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
                                  </div>
                                </div>
                              </div>
                              <div className="flex-1 pt-1">
                                <p className="text-foreground/90 leading-relaxed text-[15px] md:text-base font-medium">{p}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                );
              }


              // === FOUNDER ===
              if (/প্রতিষ্ঠাতা|founder|ceo|মালিক/i.test(heading)) {
                // Extract a name (first word that looks like a name)
                const nameMatch = cleanBody.match(/[A-Z][A-Z\s]+/);
                const name = nameMatch ? nameMatch[0].trim() : 'MD SOLAYMAN';
                const initials = name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
                return (
                  <section key={idx}>
                    <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-primary/[0.06] via-background to-secondary/[0.04]">
                      <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
                      <div className="relative grid md:grid-cols-5 gap-8 p-8 md:p-12 items-center">
                        <div className="md:col-span-2 flex justify-center">
                          <div className="relative">
                            <div className="absolute -inset-3 rounded-3xl bg-gradient-to-br from-primary/30 to-secondary/30 blur-xl opacity-60" />
                            {section.image ? (
                              <div
                                className="relative h-44 w-44 md:h-56 md:w-56 rounded-3xl overflow-hidden shadow-2xl border border-primary/20 cursor-pointer group"
                                onClick={() => setLightboxImg(section.image)}
                              >
                                <img src={section.image} alt={name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                              </div>
                            ) : (
                              <div className="relative h-40 w-40 md:h-52 md:w-52 rounded-3xl bg-gradient-to-br from-primary/25 via-primary/10 to-secondary/20 flex items-center justify-center shadow-2xl border border-primary/20">
                                <span className="text-5xl md:text-6xl font-extrabold bg-gradient-to-br from-primary to-primary/60 bg-clip-text text-transparent">{initials}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="md:col-span-3 text-center md:text-left">
                          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider mb-3">
                            <User className="h-3.5 w-3.5" />
                            {heading}
                          </div>
                          <h3 className="text-3xl md:text-4xl font-bold text-foreground">{name}</h3>
                          <p className="text-muted-foreground mt-1 text-sm md:text-base">Founder & CEO · Shorno Suta</p>
                          <blockquote className="mt-5 pl-4 border-l-2 border-primary/50 italic text-muted-foreground leading-relaxed">
                            "২০১৬ সাল থেকে একটাই স্বপ্ন — মানসম্মত পোশাক সরাসরি গ্রাহকের কাছে পৌঁছে দেওয়া, কোনো মধ্যস্বত্বভোগী ছাড়াই।"
                          </blockquote>
                        </div>
                      </div>
                    </div>
                  </section>
                );
              }

              // === DEFAULT card ===
              return (
                <Card key={idx} className="overflow-hidden border-border/60 shadow-sm hover:shadow-md transition-shadow">
                  {section.image && (
                    <div className="w-full aspect-video overflow-hidden cursor-pointer" onClick={() => setLightboxImg(section.image)}>
                      <img src={section.image} alt={section.heading} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                    </div>
                  )}
                  <CardContent className="p-6 md:p-8">
                    <h2 className="flex items-center gap-3 text-2xl md:text-3xl font-bold text-foreground mb-4">
                      {section.icon && <span>{section.icon}</span>}
                      {section.heading}
                    </h2>
                    <div className="text-muted-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeHtml(body.replace(/\n/g, '<br/>')) }} />
                  </CardContent>
                </Card>
              );

            })}
          </div>
        </div>


        {/* Lightbox */}
        {lightboxImg && (
          <div className="fixed inset-0 z-[1100] bg-black/80 flex items-center justify-center p-4" onClick={() => setLightboxImg(null)}>
            <button className="absolute top-4 right-4 text-white/80 hover:text-white" onClick={() => setLightboxImg(null)}>
              <X className="h-8 w-8" />
            </button>
            <img src={lightboxImg} alt="" className="max-w-full max-h-[90vh] object-contain rounded-lg" onClick={e => e.stopPropagation()} />
          </div>
        )}
      </Layout>
    );
  }

  // Fallback: professional editorial-style content
  const facilities = [
    { icon: Factory, name: 'এমব্রয়ডারি ফ্যাক্টরি', nameEn: 'Embroidery Factory' },
    { icon: Printer, name: 'স্ক্রিন প্রিন্ট ফ্যাক্টরি', nameEn: 'Screen Print Factory' },
    { icon: Scissors, name: 'সেলাই ফ্যাক্টরি', nameEn: 'Sewing Factory' },
    { icon: ShoppingBag, name: 'অফিস (অনলাইন সেলস)', nameEn: 'Office (Online Sales)' },
  ];

  const timeline = [
    { year: '২০১৬', title: 'যাত্রা শুরু', text: 'Daraz প্ল্যাটফর্মের মাধ্যমে স্বর্ণ সুতা-এর পথচলা শুরু। প্রথমে ছোট পরিসরে কিচেন আইটেম নিয়ে কাজ শুরু হয়।' },
    { year: '২০১৮', title: 'পোশাকে মনোযোগ', text: 'গ্রাহকদের চাহিদা অনুযায়ী পোশাক (Clothing) সেক্টরে মনোযোগ দেওয়া হয়। নিজস্ব উৎপাদন শুরু।' },
    { year: '২০২০', title: 'নিজস্ব প্ল্যাটফর্ম', text: 'নিজস্ব ওয়েবসাইট ও সোশ্যাল মিডিয়া মার্কেটিং-এর মাধ্যমে সরাসরি গ্রাহকের কাছে পণ্য পৌঁছানো শুরু।' },
    { year: 'বর্তমান', title: 'পূর্ণাঙ্গ উৎপাদন', text: 'এমব্রয়ডারি, স্ক্রিন প্রিন্ট ও সেলাই — তিনটি ফ্যাক্টরি সহ পূর্ণাঙ্গ উৎপাদন ব্যবস্থা।' },
  ];

  return (
    <Layout>
      <SEOHead title="আমাদের সম্পর্কে | স্বর্ণ সুতা" description="স্বর্ণ সুতা সম্পর্কে জানুন। ২০১৬ সাল থেকে সেরা মানের পোশাক তৈরি ও বিক্রয়।" canonical="/about" />

      {/* Editorial Hero */}
      <section className="relative overflow-hidden border-b border-border/40 bg-gradient-to-b from-primary/[0.04] via-background to-background">
        <div className="absolute inset-0 pointer-events-none opacity-[0.15]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)', backgroundSize: '24px 24px' }} />
        <div className="container relative py-16 md:py-24">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs font-medium tracking-wider uppercase mb-6">
              <Award className="h-3.5 w-3.5" />
              Est. ২০১৬ · Shorno Suta
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold text-foreground tracking-tight leading-[1.1]">
              আমাদের <span className="italic font-serif text-primary">গল্প</span>,<br className="hidden md:block" /> আপনার বিশ্বাসে গড়া
            </h1>
            <p className="text-base md:text-lg text-muted-foreground mt-6 max-w-2xl mx-auto leading-relaxed">
              সরাসরি প্রস্তুতকারক থেকে আপনার দোরগোড়ায় — মধ্যস্বত্বভোগী ছাড়াই সেরা মানের পোশাক, সেরা দামে।
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 mt-10 pt-8 border-t border-border/40 max-w-xl mx-auto">
              {[
                { num: '১০+', label: 'বছরের অভিজ্ঞতা' },
                { num: '৩', label: 'নিজস্ব ফ্যাক্টরি' },
                { num: '৫০K+', label: 'সন্তুষ্ট গ্রাহক' },
              ].map((s, i) => (
                <div key={i} className="text-center">
                  <div className="text-2xl md:text-3xl font-bold text-foreground">{s.num}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 uppercase tracking-wider">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="container py-16 md:py-20">
        <div className="max-w-4xl mx-auto space-y-20 md:space-y-28">

          {/* Story — Editorial Timeline */}
          <section>
            <div className="text-center mb-12">
              <div className="text-xs font-semibold text-primary uppercase tracking-[0.2em] mb-2">— Our Journey —</div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground">পথচলার গল্প</h2>
            </div>
            <div className="relative">
              {/* vertical line */}
              <div className="absolute left-4 md:left-1/2 top-2 bottom-2 w-px bg-gradient-to-b from-transparent via-border to-transparent md:-translate-x-1/2" />
              <div className="space-y-10 md:space-y-14">
                {timeline.map((item, i) => (
                  <div key={i} className={`relative grid md:grid-cols-2 gap-6 md:gap-12 items-start ${i % 2 === 1 ? 'md:[direction:rtl]' : ''}`}>
                    {/* dot */}
                    <div className="absolute left-4 md:left-1/2 top-2 -translate-x-1/2 z-10">
                      <div className="h-4 w-4 rounded-full bg-background border-2 border-primary flex items-center justify-center shadow-sm">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      </div>
                    </div>
                    {/* card */}
                    <div className={`md:[direction:ltr] pl-12 md:pl-0 ${i % 2 === 0 ? 'md:pr-10 md:text-right' : 'md:pl-10'}`}>
                      <div className="inline-block text-[11px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full mb-3 tracking-wider">{item.year}</div>
                      <h3 className="text-xl md:text-2xl font-bold text-foreground mb-2">{item.title}</h3>
                      <p className="text-muted-foreground leading-relaxed">{item.text}</p>
                    </div>
                    <div className="hidden md:block" />
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Facilities */}
          <section>
            <div className="text-center mb-12">
              <div className="text-xs font-semibold text-primary uppercase tracking-[0.2em] mb-2">— Our Facilities —</div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground">বর্তমানে আমাদের রয়েছে</h2>
              <p className="text-muted-foreground mt-3 max-w-xl mx-auto">প্রতিটি ধাপ — কাটিং থেকে প্যাকিং — সম্পূর্ণ নিজস্ব ব্যবস্থাপনায়</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              {facilities.map((f, i) => (
                <div key={i} className="group relative bg-card border border-border/60 rounded-2xl p-5 md:p-6 hover:border-primary/40 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                  <div className="absolute top-3 right-3 text-[10px] font-mono font-bold text-muted-foreground/40">0{i + 1}</div>
                  <div className="h-12 w-12 md:h-14 md:w-14 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <f.icon className="h-6 w-6 md:h-7 md:w-7 text-primary" />
                  </div>
                  <h3 className="font-bold text-sm md:text-base text-foreground leading-tight">{f.name}</h3>
                  <p className="text-[11px] md:text-xs text-muted-foreground mt-1 uppercase tracking-wide">{f.nameEn}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Mission — two column editorial */}
          <section className="relative">
            <div className="grid md:grid-cols-5 gap-8 md:gap-12 items-start">
              <div className="md:col-span-2">
                <div className="md:sticky md:top-24">
                  <div className="h-14 w-14 rounded-2xl bg-primary/15 flex items-center justify-center mb-5">
                    <Target className="h-7 w-7 text-primary" />
                  </div>
                  <div className="text-xs font-semibold text-primary uppercase tracking-[0.2em] mb-2">— Our Mission —</div>
                  <h2 className="text-3xl md:text-4xl font-bold text-foreground leading-tight">আমাদের লক্ষ্য সবসময় <span className="italic font-serif text-primary">আপনি</span></h2>
                  <p className="text-muted-foreground mt-4 leading-relaxed">গ্রাহকের সন্তুষ্টি, মান, ও স্বচ্ছতা — এই তিনটি স্তম্ভে দাঁড়িয়ে আমাদের প্রতিটি সিদ্ধান্ত।</p>
                </div>
              </div>
              <div className="md:col-span-3 space-y-4">
                {[
                  { title: 'সরাসরি গ্রাহকের কাছে', text: 'মধ্যস্বত্বভোগী ছাড়াই সরাসরি প্রস্তুতকারক থেকে আপনার দোরগোড়ায়।' },
                  { title: 'সেরা দামে সেরা মান', text: 'তুলনামূলক কম দামে — কারণ আমরাই বানাই, আমরাই বিক্রি করি।' },
                  { title: 'নিজস্ব ব্যবস্থাপনা', text: 'প্রতিটি পোশাক — কাটিং, এমব্রয়ডারি, সেলাই, প্যাকিং — ধাপে ধাপে নিজস্ব তত্ত্বাবধানে।' },
                  { title: 'গ্রাহক সন্তুষ্টিই প্রথম', text: 'দ্রুত ডেলিভারি, সহজ রিটার্ন, ও ২৪/৭ সাপোর্ট।' },
                ].map((p, i) => (
                  <div key={i} className="group flex gap-4 p-5 rounded-xl bg-card border border-border/50 hover:border-primary/30 hover:shadow-md transition-all">
                    <div className="shrink-0">
                      <div className="h-10 w-10 rounded-full bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center transition-colors">
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      </div>
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground mb-1">{p.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{p.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Founder — Editorial Card */}
          {/* TODO: MD SOLAYMAN / "MS" initials / the quote below belong to the previous
              client's founder — replace with Shorno Suta's actual founder details.
              Do not ship this as-is. */}
          <section>
            <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-primary/[0.06] via-background to-secondary/[0.04]">
              <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
              <div className="relative grid md:grid-cols-5 gap-8 p-8 md:p-12 items-center">
                <div className="md:col-span-2 flex justify-center">
                  <div className="relative">
                    <div className="absolute -inset-3 rounded-3xl bg-gradient-to-br from-primary/30 to-secondary/30 blur-xl opacity-60" />
                    <div className="relative h-40 w-40 md:h-52 md:w-52 rounded-3xl bg-gradient-to-br from-primary/25 via-primary/10 to-secondary/20 flex items-center justify-center shadow-2xl border border-primary/20">
                      <span className="text-5xl md:text-6xl font-extrabold bg-gradient-to-br from-primary to-primary/60 bg-clip-text text-transparent">MS</span>
                    </div>
                  </div>
                </div>
                <div className="md:col-span-3 text-center md:text-left">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider mb-3">
                    <User className="h-3.5 w-3.5" />
                    প্রতিষ্ঠাতা
                  </div>
                  <h3 className="text-3xl md:text-4xl font-bold text-foreground">MD SOLAYMAN</h3>
                  <p className="text-muted-foreground mt-1 text-sm md:text-base">Founder & CEO · Shorno Suta</p>
                  <blockquote className="mt-5 pl-4 border-l-2 border-primary/50 italic text-muted-foreground leading-relaxed">
                    "২০১৬ সাল থেকে একটাই স্বপ্ন — মানসম্মত পোশাক সরাসরি গ্রাহকের কাছে পৌঁছে দেওয়া, কোনো মধ্যস্বত্বভোগী ছাড়াই।"
                  </blockquote>
                </div>
              </div>
            </div>
          </section>

        </div>
      </div>

      {/* Lightbox */}
      {lightboxImg && (
        <div className="fixed inset-0 z-[1100] bg-black/80 flex items-center justify-center p-4" onClick={() => setLightboxImg(null)}>
          <button className="absolute top-4 right-4 text-white/80 hover:text-white" onClick={() => setLightboxImg(null)}>
            <X className="h-8 w-8" />
          </button>
          <img src={lightboxImg} alt="" className="max-w-full max-h-[90vh] object-contain rounded-lg" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </Layout>
  );
}
