import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CustomerReview {
  id: string;
  customer_name: string;
  customer_location: string | null;
  rating: number;
  review_text: string | null;
  images: string[];
  status: string;
  created_at: string;
  avatar_url?: string | null;
  customer_user_id?: string | null;
}

// Helper to enrich reviews with avatar_url from customer_profiles
async function enrichWithAvatars(reviews: any[]): Promise<CustomerReview[]> {
  const userIds = reviews
    .map((r: any) => r.customer_user_id)
    .filter(Boolean) as string[];
  if (userIds.length === 0) return reviews as CustomerReview[];

  const { data: profiles } = await supabase
    .from('customer_profiles')
    .select('user_id, avatar_url')
    .in('user_id', userIds);

  const avatarMap = new Map(
    (profiles || []).map((p: any) => [p.user_id, p.avatar_url])
  );

  return reviews.map((r: any) => ({
    ...r,
    avatar_url: r.customer_user_id ? avatarMap.get(r.customer_user_id) || null : null,
  })) as CustomerReview[];
}

// Public: fetch approved reviews
export function useApprovedReviews() {
  return useQuery({
    queryKey: ['customer-reviews', 'approved'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_reviews' as any)
        .select('*')
        .eq('status', 'approved')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return enrichWithAvatars(data || []);
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Admin: fetch all reviews (needs auth)
export function useAllReviews(statusFilter?: string) {
  return useQuery({
    queryKey: ['customer-reviews', 'all', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('customer_reviews' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      const { data, error } = await query;
      if (error) throw error;
      return enrichWithAvatars(data || []);
    },
  });
}

// Public: submit a review
export function useSubmitReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (review: {
      customer_name: string;
      customer_location?: string;
      rating: number;
      review_text?: string;
      images?: string[];
    }) => {
      const { error } = await supabase
        .from('customer_reviews' as any)
        .insert({
          customer_name: review.customer_name.trim(),
          customer_location: review.customer_location?.trim() || null,
          rating: review.rating,
          review_text: review.review_text?.trim() || null,
          images: review.images || [],
          status: 'pending',
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-reviews'] });
    },
  });
}

// Admin: update review status
export function useUpdateReviewStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('customer_reviews' as any)
        .update({ status } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-reviews'] });
      toast.success('রিভিউ আপডেট হয়েছে');
    },
  });
}

// Admin: delete review
export function useDeleteReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('customer_reviews' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-reviews'] });
      toast.success('রিভিউ ডিলিট হয়েছে');
    },
  });
}

// Upload review image to storage
export async function uploadReviewImage(file: File): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('রিভিউ ছবি আপলোডের জন্য লগইন করুন');
  const ext = file.name.split('.').pop();
  const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;
  const { error } = await supabase.storage
    .from('review-images')
    .upload(fileName, file, { cacheControl: '31536000', upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from('review-images').getPublicUrl(fileName);
  return data.publicUrl;
}
