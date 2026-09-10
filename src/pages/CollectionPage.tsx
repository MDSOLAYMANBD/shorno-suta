import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Shop from './Shop';

export default function CollectionPage() {
  const { slug } = useParams<{ slug: string }>();

  const { data: collection, isLoading } = useQuery({
    queryKey: ['product-collection', slug],
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('product_collections')
        .select('*')
        .eq('slug', slug!)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; slug: string; title: string; product_ids: string[]; created_at: string } | null;
    },
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">কালেকশন পাওয়া যায়নি।</p>
      </div>
    );
  }

  const ids = collection.product_ids.join(',');

  return <Shop collectionIds={ids} collectionTitle={collection.title} />;
}
