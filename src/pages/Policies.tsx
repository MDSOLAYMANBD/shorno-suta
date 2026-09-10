import Layout from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSiteConfig } from '@/hooks/useSiteConfig';
import { sanitizeHtml } from '@/lib/sanitize';
import { Link } from 'react-router-dom';
import NotFound from './NotFound';
import SEOHead from '@/components/SEOHead';

const policyLinks = [
  { title: 'শর্তাবলী ও অর্ডার নীতিমালা', subtitle: 'Terms & Conditions', icon: '📜', path: '/terms-and-conditions' },
  { title: 'রিটার্ন পলিসি', subtitle: 'Return Policy', icon: '🔁', path: '/return-policy' },
  { title: 'ক্যানসেলেশন পলিসি', subtitle: 'Cancellation Policy', icon: '❌', path: '/refund-policy' },
  { title: 'এক্সচেঞ্জ ও রিফান্ড', subtitle: 'Exchange & Refund', icon: '🔄', path: '/Return-ExchangePolicy' },
  { title: 'প্রাইভেসি পলিসি', subtitle: 'Privacy Policy', icon: '🔒', path: '/privacy-policy' },
];

export default function Policies() {
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

  const pageConfig = pagesData?.pages?.find((p: any) => p.id === 'policies');
  if (pageConfig && !pageConfig.enabled) return <NotFound />;

  const title = pageConfig?.title || 'নীতিমালা';
  const subtitle = pageConfig?.subtitle;
  const icon = pageConfig?.icon;

  return (
    <Layout>
      <SEOHead title="নীতিমালা | স্বর্ণ সুতা" description="স্বর্ণ সুতার রিটার্ন, ক্যানসেলেশন ও এক্সচেঞ্জ পলিসি জানুন।" canonical="/policies" />
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          {icon && (
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 mb-4">
              <span className="text-3xl">{icon}</span>
            </div>
          )}
          <h1 className="text-3xl font-bold text-foreground">{title}</h1>
          {subtitle && <p className="text-muted-foreground mt-2">{subtitle}</p>}
        </div>
        <div className="space-y-4">
          {policyLinks.map((link) => (
            <Link key={link.path} to={link.path} className="block">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="flex items-center gap-4 p-6">
                  <span className="text-3xl">{link.icon}</span>
                  <div>
                    <p className="font-semibold text-foreground">{link.title}</p>
                    <p className="text-sm text-muted-foreground">{link.subtitle}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  );
}
