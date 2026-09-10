import { useParams } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSiteConfig } from '@/hooks/useSiteConfig';
import { sanitizeHtml } from '@/lib/sanitize';
import NotFound from './NotFound';

export default function DynamicPage() {
  const { slug } = useParams<{ slug: string }>();
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

  const page = pagesData?.pages?.find((p: any) => p.slug === slug && !p.is_builtin);
  if (!page || !page.enabled) return <NotFound />;

  return (
    <Layout>
      {page.seo_title && <title>{page.seo_title}</title>}
      <div className="container py-10">
        <div className="text-center mb-10">
          {page.icon && (
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 mb-4">
              <span className="text-3xl">{page.icon}</span>
            </div>
          )}
          <h1 className="text-3xl font-bold text-foreground">{page.title}</h1>
          {page.subtitle && <p className="text-muted-foreground mt-2">{page.subtitle}</p>}
        </div>

        <div className="max-w-3xl mx-auto space-y-6">
          {page.sections?.map((section: any, idx: number) => {
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
                  <div
                    className="text-foreground prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(section.body.replace(/\n/g, '<br/>')) }}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
