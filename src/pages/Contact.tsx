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
  url: 'https://www.shornosuta.com/contact',
  telephone: '+8809617356977',
  image: 'https://www.shornosuta.com/pwa-512x512.png',
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
                <a href="tel:+8809617356977" className="flex items-center gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20 hover:bg-primary/10 transition-colors">
                  <Phone className="h-6 w-6 text-primary flex-shrink-0" />
                  <div><p className="text-sm text-muted-foreground">Help Line</p><p className="font-semibold text-foreground">+880 9617 356977</p></div>
                </a>
                <a href="https://wa.me/8809617356977" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 rounded-lg bg-[#25D366]/10 border border-[#25D366]/20 hover:bg-[#25D366]/20 transition-colors">
                  <MessageCircle className="h-6 w-6 text-[#25D366] flex-shrink-0" />
                  <div><p className="text-sm text-muted-foreground">WhatsApp Support</p><p className="font-semibold text-foreground">+880 9617 356977</p></div>
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
            <CardHeader><CardTitle className="flex items-center gap-2 text-xl"><MapPin className="h-5 w-5 text-primary" /> 📍 আমাদের লোকেশন</CardTitle></CardHeader>
            <CardContent>
              <div className="rounded-lg overflow-hidden border border-border">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3652.9095349430227!2d90.3638034!3d23.714924399999997!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3755bf50d7851ea7%3A0xad932e31f5429df6!2zU2hvcm5vIFN1dGEgJ-CmuOCnjeCmrOCmsOCnjeCmoyDgprjgp4HgpqTgpr4n!5e0!3m2!1sen!2sbd!4v1789111011085!5m2!1sen!2sbd"
                  width="100%"
                  height="350"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                  title="Shorno Suta Location"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-xl"><Globe className="h-5 w-5 text-primary" /> 🌐 Online Presence</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <a href="https://www.shornosuta.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors">
                  <Globe className="h-5 w-5 text-primary flex-shrink-0" /><div><p className="text-sm text-muted-foreground">Website</p><p className="text-sm font-medium text-foreground">shornosuta.com</p></div>
                </a>
                <a href="https://www.facebook.com/shornosuta/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors">
                  <Facebook className="h-5 w-5 text-[#1877F2] flex-shrink-0" /><div><p className="text-sm text-muted-foreground">Facebook</p><p className="text-sm font-medium text-foreground">shornosuta</p></div>
                </a>
                <a href="https://www.instagram.com/Shorno_Suta" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors">
                  <Instagram className="h-5 w-5 text-[#E4405F] flex-shrink-0" /><div><p className="text-sm text-muted-foreground">Instagram</p><p className="text-sm font-medium text-foreground">Shorno_Suta</p></div>
                </a>
                <a href="https://www.youtube.com/channel/UCM_OpuUCL19i0Ha-LQOMdzg" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors">
                  <Youtube className="h-5 w-5 text-[#FF0000] flex-shrink-0" /><div><p className="text-sm text-muted-foreground">YouTube</p><p className="text-sm font-medium text-foreground">ShornoSuta</p></div>
                </a>
                <a href="https://www.tiktok.com/@shornosutabd" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors">
                  <svg className="h-5 w-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1 0-5.78c.27 0 .54.04.8.1v-3.5a6.37 6.37 0 0 0-.8-.05A6.34 6.34 0 0 0 3.15 15.3a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.98a8.2 8.2 0 0 0 3.76.92V6.69z"/></svg>
                  <div><p className="text-sm text-muted-foreground">TikTok</p><p className="text-sm font-medium text-foreground">shornosutabd</p></div>
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
