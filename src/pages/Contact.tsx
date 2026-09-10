import Layout from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone, MessageCircle, MapPin, Globe, Clock, Facebook, Instagram, Youtube } from 'lucide-react';
import { useSiteConfig } from '@/hooks/useSiteConfig';
import { sanitizeHtml } from '@/lib/sanitize';
import NotFound from './NotFound';
import SEOHead from '@/components/SEOHead';

const CONTACT_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: 'স্বর্ণ সুতা',
  alternateName: 'Shorno Suta',
  url: 'https://shorno-suta.vercel.app/contact',
  telephone: '+8801843711211',
  image: 'https://shorno-suta.vercel.app/pwa-512x512.png',
  address: {
    '@type': 'PostalAddress',
    addressCountry: 'BD',
    addressLocality: 'Dhaka',
  },
  openingHoursSpecification: [{
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: ['Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday'],
    opens: '10:00',
    closes: '21:00',
  }],
};

export default function Contact() {
  const { data: pagesData, isLoading } = useSiteConfig('pages_config');

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  const pageConfig = pagesData?.pages?.find((p: any) => p.id === 'contact');
  if (pageConfig && !pageConfig.enabled) return <NotFound />;

  if (pageConfig?.sections?.length) {
    return (
      <Layout>
        <SEOHead title="যোগাযোগ | স্বর্ণ সুতা" description="স্বর্ণ সুতায় যোগাযোগ করুন। ফোন, হোয়াটসঅ্যাপ ও অফিস ঠিকানা।" canonical="/contact" jsonLd={CONTACT_JSONLD} />
        <div className="container py-10">
          <div className="text-center mb-10">
            {pageConfig.icon && (
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 mb-4">
                <span className="text-3xl">{pageConfig.icon}</span>
              </div>
            )}
            <h1 className="text-3xl font-bold text-foreground">{pageConfig.title}</h1>
            {pageConfig.subtitle && <p className="text-muted-foreground mt-2">{pageConfig.subtitle}</p>}
          </div>
          <div className="max-w-3xl mx-auto space-y-6">
            {pageConfig.sections.map((section: any, idx: number) => {
              if (section.type === 'html_blog') {
                return (
                  <div key={idx} className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeHtml(section.body) }} />
                );
              }
              return (
                <Card key={idx}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      {section.icon && <span>{section.icon}</span>}
                      {section.heading}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-foreground" dangerouslySetInnerHTML={{ __html: sanitizeHtml(section.body.replace(/\n/g, '<br/>')) }} />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </Layout>
    );
  }

  // Fallback: original hardcoded content
  return (
    <Layout>
      <SEOHead title="যোগাযোগ | স্বর্ণ সুতা" description="স্বর্ণ সুতায় যোগাযোগ করুন। ফোন, হোয়াটসঅ্যাপ ও অফিস ঠিকানা।" canonical="/contact" jsonLd={CONTACT_JSONLD} />
      <div className="container py-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 mb-4">
            <Phone className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">যোগাযোগ করুন</h1>
          <p className="text-muted-foreground mt-2">Contact Us – Shorno Suta</p>
        </div>

        <div className="max-w-3xl mx-auto space-y-8">
          <div className="text-center px-4">
            <p className="text-lg text-foreground font-medium">আমরা আপনার পাশে আছি</p>
            <p className="text-muted-foreground mt-2">
              Shorno Suta সর্বদা গ্রাহক সন্তুষ্টিকে সর্বোচ্চ অগ্রাধিকার দেয়। যেকোনো প্রশ্ন, অর্ডার সংক্রান্ত সহায়তা, অভিযোগ, মতামত বা ব্যবসায়িক অনুসন্ধানের জন্য আমাদের সাথে নির্দ্বিধায় যোগাযোগ করুন।
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">📌 Customer Support & Help Desk</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <a href="tel:+8801843711211" className="flex items-center gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20 hover:bg-primary/10 transition-colors">
                  <Phone className="h-6 w-6 text-primary flex-shrink-0" />
                  <div><p className="text-sm text-muted-foreground">Help Line</p><p className="font-semibold text-foreground">+880 1843 711211</p></div>
                </a>
                <a href="https://wa.me/8801843711211" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 rounded-lg bg-[#25D366]/10 border border-[#25D366]/20 hover:bg-[#25D366]/20 transition-colors">
                  <MessageCircle className="h-6 w-6 text-[#25D366] flex-shrink-0" />
                  <div><p className="text-sm text-muted-foreground">WhatsApp Support</p><p className="font-semibold text-foreground">+880 1843 711211</p></div>
                </a>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" /><span>🕒 সাপোর্ট সময়: প্রতিদিন সকাল ১০টা – রাত ৯টা</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-xl"><MapPin className="h-5 w-5 text-primary" /> 📍 Office Address</CardTitle></CardHeader>
            <CardContent><p className="text-foreground">কামরাঙ্গীরচর, খোলা মোড়া ঘাট,<br />ঢাকা – ১২১১, বাংলাদেশ</p></CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-xl"><Globe className="h-5 w-5 text-primary" /> 🌐 Online Presence</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <a href="https://shorno-suta.vercel.app" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors">
                  <Globe className="h-5 w-5 text-primary flex-shrink-0" /><div><p className="text-sm text-muted-foreground">Website</p><p className="text-sm font-medium text-foreground">shorno-suta.vercel.app</p></div>
                </a>
                <a href="https://www.facebook.com/shornosuta" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors">
                  <Facebook className="h-5 w-5 text-[#1877F2] flex-shrink-0" /><div><p className="text-sm text-muted-foreground">Facebook</p><p className="text-sm font-medium text-foreground">shornosuta</p></div>
                </a>
                {/* TODO: Instagram/YouTube not provided yet by the client — add back once known. */}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
