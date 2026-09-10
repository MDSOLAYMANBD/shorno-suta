import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';

export function useWishlist() {
  const { user } = useCustomerAuth();
  const qc = useQueryClient();

  const { data: wishlistItems = [], isLoading } = useQuery({
    queryKey: ['wishlist', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wishlist' as any)
        .select('id, product_id, created_at')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as { id: string; product_id: string; created_at: string }[];
    },
  });

  const wishlistProductIds = new Set(wishlistItems.map((w: any) => w.product_id));

  const toggleMutation = useMutation({
    mutationFn: async (productId: string) => {
      if (!user) throw new Error('Not authenticated');
      const exists = wishlistProductIds.has(productId);
      if (exists) {
        await supabase
          .from('wishlist' as any)
          .delete()
          .eq('user_id', user.id)
          .eq('product_id', productId);
      } else {
        await supabase
          .from('wishlist' as any)
          .insert({ user_id: user.id, product_id: productId } as any);
      }
      return !exists;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wishlist', user?.id] });
    },
  });

  return {
    wishlistItems,
    wishlistProductIds,
    isLoading,
    isInWishlist: (productId: string) => wishlistProductIds.has(productId),
    toggleWishlist: toggleMutation.mutate,
    isToggling: toggleMutation.isPending,
  };
}
