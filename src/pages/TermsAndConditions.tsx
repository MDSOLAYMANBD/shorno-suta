import { useEffect, useRef, useState } from 'react';
import Layout from '@/components/layout/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import SEOHead from '@/components/SEOHead';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Link } from 'react-router-dom';
import {
  ShoppingCart,
  Package,
  CreditCard,
  Truck,
  RotateCcw,
  AlertTriangle,
  XCircle,
  Repeat,
  UserCheck,
  Phone,
  ScrollText,
  ArrowUp,
  Calendar,
  MessageCircle,
  PhoneCall,
} from 'lucide-react';

type SectionDef = {
  id: string;
  num: number;
  bn: string;
  en: string;
  Icon: React.ComponentType<{ className?: string }>;
  bnContent: React.ReactNode;
  enContent: React.ReactNode;
};

const Bullets = ({ items }: { items: string[] }) => (
  <ul className="space-y-1.5">
    {items.map((it, i) => (
      <li key={i} className="flex gap-2">
        <span className="text-primary mt-1">•</span>
        <span>{it}</span>
      </li>
    ))}
  </ul>
);

const SECTIONS: SectionDef[] = [
  {
    id: 'order-process', num: 1, bn: 'অর্ডার প্রক্রিয়া', en: 'Order Process', Icon: ShoppingCart,
    bnContent: (
      <>
        <p>গ্রাহক আমাদের ওয়েবসাইট, ফেসবুক পেজ, WhatsApp অথবা ফোন কলের মাধ্যমে অর্ডার করতে পারবেন।</p>
        <p className="font-medium text-foreground">অর্ডার করার সময় যা দিতে হবে:</p>
        <Bullets items={['পূর্ণ নাম', 'মোবাইল নম্বর', 'সম্পূর্ণ ডেলিভারি ঠিকানা']} />
        <p>অর্ডার জমা দেওয়ার পর আমাদের প্রতিনিধি ফোনে অর্ডার নিশ্চিত করবেন। নিশ্চিত হওয়ার পর কুরিয়ারে পাঠানো হবে।</p>
      </>
    ),
    enContent: (
      <>
        <p>Customers may place orders through our website, Facebook page, WhatsApp, or phone call.</p>
        <p className="font-medium text-foreground">Required information:</p>
        <Bullets items={['Full Name', 'Mobile Number', 'Complete Delivery Address']} />
        <p>After submission, our representative will confirm the order by phone. After confirmation, the order ships via courier.</p>
      </>
    ),
  },
  {
    id: 'product-information', num: 2, bn: 'পণ্যের তথ্য', en: 'Product Information', Icon: Package,
    bnContent: <p>আমরা পণ্যের ছবি, বিবরণ, কাপড়ের ধরন, কাজের বিবরণ ও মূল্য যথাসম্ভব সঠিকভাবে প্রদর্শনের চেষ্টা করি। মোবাইল, মনিটর ও আলোর পার্থক্যের কারণে সামান্য রঙের ভিন্নতা থাকতে পারে।</p>,
    enContent: <p>We try to display product images, descriptions, fabrics, workmanship and pricing accurately. Slight color differences may occur due to screen settings and lighting conditions.</p>,
  },
  {
    id: 'payment-policy', num: 3, bn: 'পেমেন্ট নীতি', en: 'Payment Policy', Icon: CreditCard,
    bnContent: <Bullets items={['সাধারণ অর্ডার Cash on Delivery', 'বিশেষ ক্ষেত্রে অগ্রিম পেমেন্ট নেওয়া হতে পারে', 'উপহার অর্ডারের ক্ষেত্রে গ্রাহক চাইলে অনলাইন পেমেন্ট করতে পারবেন']} />,
    enContent: <Bullets items={['Standard orders are Cash on Delivery', 'Advance payment may be requested in special cases', 'Customers may choose online payment for gift orders']} />,
  },
  {
    id: 'delivery-policy', num: 4, bn: 'ডেলিভারি নীতি', en: 'Delivery Policy', Icon: Truck,
    bnContent: <Bullets items={['ঢাকা শহরের মধ্যে ২৪ ঘণ্টার মধ্যে ডেলিভারি', 'ঢাকা শহরের বাইরে ২–৫ কার্যদিবস', 'ওজন ও অবস্থান অনুযায়ী ডেলিভারি চার্জ প্রযোজ্য']} />,
    enContent: <Bullets items={['Inside Dhaka: Within 24 hours', 'Outside Dhaka: 2–5 working days', 'Delivery charges vary based on location and parcel weight']} />,
  },
  {
    id: 'return-policy', num: 5, bn: 'রিটার্ন নীতি', en: 'Return Policy', Icon: RotateCcw,
    bnContent: <Bullets items={['ডেলিভারির সময় পণ্য যাচাই করে গ্রহণ করতে হবে', 'পছন্দ না হলে ডেলিভারি চার্জ প্রদান করে তাৎক্ষণিক রিটার্ন করা যাবে', 'শুধু পছন্দ না হওয়ার কারণে রিফান্ড প্রযোজ্য নয়']} />,
    enContent: <Bullets items={['Product must be checked during delivery', 'If not satisfied, customer may return immediately by paying delivery charge', 'Refund is not applicable for personal preference']} />,
  },
  {
    id: 'damaged-wrong', num: 6, bn: 'ক্ষতিগ্রস্ত বা ভুল পণ্য', en: 'Damaged or Wrong Product', Icon: AlertTriangle,
    bnContent: <p>ভুল পণ্য, ছেঁড়া, ক্ষতিগ্রস্ত অথবা ভুল সাইজের পণ্য পেলে ৭ দিনের মধ্যে WhatsApp নম্বরে যোগাযোগ করতে হবে। যথাযথ প্রমাণ পাওয়া গেলে আমাদের খরচে পরিবর্তন করা হবে।</p>,
    enContent: <p>Customers must report damaged, defective, wrong size, or incorrect products within 7 days. Verified issues will be replaced at our cost.</p>,
  },
  {
    id: 'cancellation', num: 7, bn: 'ক্যানসেলেশন নীতি', en: 'Cancellation Policy', Icon: XCircle,
    bnContent: <Bullets items={['শিপিংয়ের আগে অর্ডার বাতিল করা যাবে', 'শিপিংয়ের পরে বাতিল করলে ডেলিভারি চার্জ প্রযোজ্য হবে', 'কুরিয়ারে হস্তান্তরের পর সম্পূর্ণ বাতিল গ্রহণযোগ্য নয়']} />,
    enContent: <Bullets items={['Orders may be cancelled before shipping', 'Delivery charges apply after shipment', 'Full cancellation is not available after courier handover']} />,
  },
  {
    id: 'exchange', num: 8, bn: 'এক্সচেঞ্জ নীতি', en: 'Exchange Policy', Icon: Repeat,
    bnContent: <Bullets items={['অন্য পণ্যের সাথে এক্সচেঞ্জ করা যাবে', 'এক্সচেঞ্জের ক্ষেত্রে ডেলিভারি চার্জ প্রযোজ্য হতে পারে', 'রিফান্ড সুবিধা নেই']} />,
    enContent: <Bullets items={['Products may be exchanged with another item', 'Delivery charges may apply', 'Refund facility is not available']} />,
  },
  {
    id: 'customer-responsibility', num: 9, bn: 'গ্রাহকের দায়িত্ব', en: 'Customer Responsibility', Icon: UserCheck,
    bnContent: <p>গ্রাহককে সঠিক নাম, মোবাইল নম্বর এবং ঠিকানা প্রদান করতে হবে। ভুল তথ্যের কারণে ডেলিভারি ব্যর্থ হলে প্রতিষ্ঠান দায়ী থাকবে না।</p>,
    enContent: <p>Customers must provide accurate contact and address information. The company is not responsible for delivery failures caused by incorrect information.</p>,
  },
  {
    id: 'contact', num: 10, bn: 'যোগাযোগের তথ্য', en: 'Contact Information', Icon: Phone,
    bnContent: <p>যেকোনো জিজ্ঞাসায় আমাদের হেল্পলাইন বা WhatsApp-এ যোগাযোগ করুন। আমরা সপ্তাহের প্রতিদিন আপনার পাশে আছি।</p>,
    enContent: <p>For any queries, contact our helpline or WhatsApp. We are here for you every day of the week.</p>,
  },
];

export default function TermsAndConditions() {
  const [activeId, setActiveId] = useState<string>('order-process');
  const [showTop, setShowTop] = useState(false);
  const [showFloatingToc, setShowFloatingToc] = useState(false);
  const inlineTocRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 500);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const el = inlineTocRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Show floating TOC only after the inline TOC has scrolled out of view (past it)
        setShowFloatingToc(!entry.isIntersecting && entry.boundingClientRect.top < 0);
      },
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveId(entry.target.id);
        });
      },
      { rootMargin: '-30% 0px -60% 0px' }
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'হোম', item: 'https://shorno-suta.vercel.app/' },
      { '@type': 'ListItem', position: 2, name: 'Terms & Conditions', item: 'https://shorno-suta.vercel.app/terms-and-conditions' },
    ],
  };

  return (
    <Layout>
      <SEOHead
        title="শর্তাবলী ও অর্ডার নীতিমালা | Terms & Conditions | স্বর্ণ সুতা"
        description="স্বর্ণ সুতার সম্পূর্ণ শর্তাবলী — অর্ডার, পেমেন্ট, ডেলিভারি, রিটার্ন, এক্সচেঞ্জ ও ক্যানসেলেশন নীতি। Complete terms and conditions for Shorno Suta."
        canonical="/terms-and-conditions"
        jsonLd={[jsonLd]}
      />

      {/* Hero */}
      <div className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-accent/10 to-background" />
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-accent/30 blur-3xl" />
        <div className="relative max-w-5xl mx-auto px-4 py-12 sm:py-16">
          <Breadcrumb className="mb-6 print:hidden">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild><Link to="/">হোম</Link></BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild><Link to="/policies">নীতিমালা</Link></BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>শর্তাবলী</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="flex flex-col items-center text-center gap-4">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 ring-1 ring-primary/30 shadow-lg shadow-primary/10">
              <ScrollText className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl sm:text-5xl font-bold text-foreground tracking-tight">
              শর্তাবলী ও অর্ডার নীতিমালা
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground">Terms &amp; Conditions</p>
            <div className="inline-flex items-center gap-2 rounded-full bg-background/80 backdrop-blur px-4 py-1.5 text-xs font-medium text-muted-foreground border border-border">
              <Calendar className="h-3.5 w-3.5" />
              সর্বশেষ আপডেট: মে ২০২৬
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-8 sm:py-10">
        <div className="grid lg:grid-cols-[260px_1fr] gap-8 min-w-0">

          {/* Sticky TOC */}
          <aside className="hidden lg:block print:hidden">
            <div className="sticky top-24">
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-2">
                  সূচিপত্র
                </p>
                <nav className="space-y-0.5">
                  {SECTIONS.map((s) => {
                    const active = activeId === s.id;
                    return (
                      <a
                        key={s.id}
                        href={`#${s.id}`}
                        className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                          active
                            ? 'bg-primary/10 text-primary font-semibold'
                            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                        }`}
                      >
                        <span className={`text-xs mt-0.5 font-mono ${active ? 'text-primary' : 'text-muted-foreground/60'}`}>
                          {String(s.num).padStart(2, '0')}
                        </span>
                        <span className="leading-snug">{s.bn}</span>
                      </a>
                    );
                  })}
                </nav>
              </div>
            </div>
          </aside>

          {/* Content */}
          <main className="space-y-6">
            {/* Intro */}
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
              <CardContent className="pt-6 space-y-2 text-sm leading-relaxed text-muted-foreground">
                <p>
                  <strong className="text-foreground">স্বর্ণ সুতা</strong> থেকে কেনাকাটা করার জন্য ধন্যবাদ 💚
                  নিচের শর্তাবলী আমাদের সকল ক্রয়-বিক্রয় কার্যক্রমে প্রযোজ্য। অর্ডার করার মাধ্যমে আপনি এই শর্তগুলোতে সম্মতি প্রদান করছেন।
                </p>
                <p>
                  Thank you for shopping with <strong className="text-foreground">Shorno Suta</strong>. The following terms apply to all our sales activities. By placing an order, you agree to these terms.
                </p>
              </CardContent>
            </Card>

            {/* Mobile inline TOC - appears at top of body */}
            <div ref={inlineTocRef} className="lg:hidden print:hidden">
              <Card className="border-primary/20">
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    📑 সূচিপত্র
                  </p>
                  <div className="grid grid-cols-2 gap-1">
                    {SECTIONS.map((s) => (
                      <a
                        key={s.id}
                        href={`#${s.id}`}
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                      >
                        <span className="font-mono text-[10px] text-primary shrink-0">{String(s.num).padStart(2, '0')}</span>
                        <span className="leading-snug truncate">{s.bn}</span>
                      </a>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Mobile floating TOC - shown only after scrolling past the inline TOC */}
            <aside
              className={`lg:hidden print:hidden fixed top-20 right-1.5 z-30 w-[120px] rounded-xl border border-border bg-card/85 backdrop-blur shadow-md transition-all duration-300 ${
                showFloatingToc ? 'opacity-100 translate-x-0 pointer-events-auto' : 'opacity-0 translate-x-4 pointer-events-none'
              }`}
              aria-label="সূচিপত্র"
              aria-hidden={!showFloatingToc}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 pt-1.5 pb-1 border-b border-border/50">
                সূচিপত্র
              </p>
              <nav className="max-h-[55vh] overflow-y-auto py-1">
                {SECTIONS.map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className="flex items-start gap-1.5 px-2 py-1 text-[11px] leading-tight text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  >
                    <span className="font-mono text-[10px] text-primary shrink-0 mt-0.5">{String(s.num).padStart(2, '0')}</span>
                    <span className="leading-snug">{s.bn}</span>
                  </a>
                ))}
              </nav>
            </aside>





            {/* Sections */}
            {SECTIONS.map((s) => (
              <section
                key={s.id}
                id={s.id}
                className="scroll-mt-24 group rounded-2xl border border-border bg-card overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all"
              >
                {/* Header */}
                <div className="flex items-center gap-3 sm:gap-4 border-l-4 border-primary bg-gradient-to-r from-primary/5 to-transparent px-3 sm:px-5 py-3 sm:py-4">
                  <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/30">
                    <s.Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-primary/80">
                      Section {String(s.num).padStart(2, '0')}
                    </div>
                    <h2 className="text-base sm:text-xl font-bold text-foreground break-words leading-tight">
                      {s.bn} <span className="text-muted-foreground font-normal">/ {s.en}</span>
                    </h2>
                  </div>
                </div>

                {/* Bilingual body */}
                <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
                  <div className="p-4 sm:p-5 space-y-3 text-sm leading-relaxed text-muted-foreground break-words min-w-0">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold text-primary-foreground">
                      🇧🇩 বাংলা
                    </div>
                    {s.bnContent}
                  </div>
                  <div className="p-4 sm:p-5 space-y-3 text-sm leading-relaxed text-muted-foreground break-words min-w-0">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold text-primary-foreground">
                      🇬🇧 English
                    </div>
                    {s.enContent}
                  </div>
                </div>
              </section>
            ))}

            {/* Contact CTA */}
            <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-accent/10 to-primary/5 p-4 sm:p-8">
              <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
              <div className="relative space-y-5">
                <div className="text-center space-y-1">
                  <h3 className="text-xl sm:text-2xl font-bold text-foreground">কোনো প্রশ্ন আছে?</h3>
                  <p className="text-sm text-muted-foreground">আমাদের সাথে এখনই যোগাযোগ করুন — আমরা সাহায্য করতে প্রস্তুত।</p>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Button asChild size="lg" className="h-14 text-sm sm:text-base px-3 w-full min-w-0">
                    <a href="tel:+8801843711211" className="flex items-center justify-center">
                      <PhoneCall className="h-5 w-5 mr-2 shrink-0" />
                      <span className="truncate">হেল্পলাইন: 01843711211</span>
                    </a>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="h-14 text-sm sm:text-base px-3 w-full min-w-0 bg-background hover:bg-accent">
                    <a href="https://wa.me/8801843711211" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center">
                      <MessageCircle className="h-5 w-5 mr-2 shrink-0" />
                      <span className="truncate">WhatsApp: 01843711211</span>
                    </a>
                  </Button>
                </div>
                <div className="text-center text-xs text-muted-foreground pt-2">
                  🌐 <a href="https://shorno-suta.vercel.app" className="text-primary hover:underline">shorno-suta.vercel.app</a>
                </div>
              </div>
            </div>

            <p className="text-xs text-center text-muted-foreground pt-4">
              © {new Date().getFullYear()} Shorno Suta · সর্বশেষ আপডেট: মে ২০২৬
            </p>
          </main>
        </div>
      </div>

      {/* Back to top */}
      {showTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="print:hidden fixed bottom-24 right-5 z-40 h-11 w-11 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center hover:scale-110 transition-transform"
          aria-label="উপরে যান"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      )}
    </Layout>
  );
}
