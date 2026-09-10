import { useState } from 'react';
import { Star, Check, X, Trash2, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useAllReviews, useUpdateReviewStatus, useDeleteReview } from '@/hooks/useCustomerReviews';
import { optimizedImageUrl } from '@/lib/imageUrl';
import TestimonialManager from '@/components/admin/TestimonialManager';

export default function AdminReviews() {
  const [tab, setTab] = useState('pending');
  const { data: reviews = [], isLoading } = useAllReviews(tab === 'all' ? undefined : tab);
  const updateStatus = useUpdateReviewStatus();
  const deleteReview = useDeleteReview();
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  return (
    <div className="p-4 md:p-6 space-y-4 pb-20 md:pb-6">
      <h1 className="text-xl font-bold">রিভিউ ম্যানেজমেন্ট</h1>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pending">পেন্ডিং</TabsTrigger>
          <TabsTrigger value="approved">অ্যাপ্রুভড</TabsTrigger>
          <TabsTrigger value="rejected">রিজেক্টেড</TabsTrigger>
          <TabsTrigger value="all">সব</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <p className="text-muted-foreground text-sm">লোড হচ্ছে...</p>
          ) : reviews.length === 0 ? (
            <p className="text-muted-foreground text-sm">কোনো রিভিউ নেই</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {reviews.map((r) => (
                <Card key={r.id} className="overflow-hidden">
                  <CardContent className="p-4 space-y-3">
                    {/* Images */}
                    {r.images && r.images.length > 0 && (
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {r.images.map((img, idx) => (
                          <img
                            key={idx}
                            src={optimizedImageUrl(img, 200)}
                            alt={`রিভিউ ছবি ${idx + 1}`}
                            className="h-20 w-20 object-cover rounded-lg cursor-pointer flex-shrink-0 border"
                            onClick={() => setLightboxImg(img)}
                          />
                        ))}
                      </div>
                    )}

                    {/* Review text */}
                    {r.review_text && (
                      <p className="text-sm text-muted-foreground">"{r.review_text}"</p>
                    )}

                    {/* Name, rating, location */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {r.avatar_url ? (
                          <img src={r.avatar_url} alt={r.customer_name} className="h-8 w-8 rounded-full object-cover ring-1 ring-border shrink-0" />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary ring-1 ring-border shrink-0">
                            {(r.customer_name || '?')[0]}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium">{r.customer_name}</p>
                          {r.customer_location && (
                            <p className="text-xs text-muted-foreground">{r.customer_location}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`h-3 w-3 ${i < r.rating ? 'text-yellow-500 fill-yellow-500' : 'text-muted'}`} />
                        ))}
                      </div>
                    </div>

                    {/* Status badge */}
                    <div className="flex items-center justify-between">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        r.status === 'approved' ? 'bg-green-100 text-green-700' :
                        r.status === 'rejected' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {r.status === 'approved' ? 'অ্যাপ্রুভড' : r.status === 'rejected' ? 'রিজেক্টেড' : 'পেন্ডিং'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString('bn-BD')}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      {r.status !== 'approved' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 gap-1 text-green-600 border-green-200 hover:bg-green-50"
                          onClick={() => updateStatus.mutate({ id: r.id, status: 'approved' })}
                          disabled={updateStatus.isPending}
                        >
                          <Check className="h-3 w-3" /> অ্যাপ্রুভ
                        </Button>
                      )}
                      {r.status !== 'rejected' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 gap-1 text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => updateStatus.mutate({ id: r.id, status: 'rejected' })}
                          disabled={updateStatus.isPending}
                        >
                          <X className="h-3 w-3" /> রিজেক্ট
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => {
                          if (confirm('ডিলিট করতে চান?')) deleteReview.mutate(r.id);
                        }}
                        disabled={deleteReview.isPending}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Testimonial Manager */}
      <div className="mt-6 border-t pt-6">
        <TestimonialManager />
      </div>

      {/* Lightbox */}
      <Dialog open={!!lightboxImg} onOpenChange={() => setLightboxImg(null)}>
        <DialogContent className="max-w-2xl p-2 bg-black/95 border-none">
          <DialogTitle className="sr-only">রিভিউ ছবি</DialogTitle>
          {lightboxImg && (
            <img src={lightboxImg} alt="রিভিউ ছবি" className="w-full max-h-[80vh] object-contain rounded-lg" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
