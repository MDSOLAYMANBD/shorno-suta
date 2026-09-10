import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useCustomerProfile } from '@/hooks/useCustomerProfile';
import { uploadReviewImage } from '@/hooks/useCustomerReviews';
import { useToast } from '@/hooks/use-toast';
import { useCart } from '@/contexts/CartContext';
import { useWishlist } from '@/hooks/useWishlist';
import { LogOut, Package, MapPin, Phone, Edit2, Check, X, ShoppingBag, Star, Camera, Upload, Image as ImageIcon, Mail, Award, Tag, Sparkles, Crown, Diamond, Gift, Zap, Heart, ShoppingCart } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import CustomerAuthGuard from '@/components/account/CustomerAuthGuard';
import { toast as sonnerToast } from 'sonner';
import { optimizedImageUrl } from '@/lib/imageUrl';

// Badge tier system
interface BadgeTier {
  name: string;
  emoji: string;
  icon: typeof Award;
  glowClass: string;
  bgGradient: string;
  textColor: string;
  borderColor: string;
  minDelivered: number;
}

const BADGE_TIERS: BadgeTier[] = [
  { name: 'ডায়মন্ড মেম্বার', emoji: '💎', icon: Diamond, glowClass: 'avatar-glow-diamond', bgGradient: 'bg-gradient-to-r from-violet-500/10 via-blue-500/10 to-purple-500/10', textColor: 'text-violet-600', borderColor: 'border-violet-300', minDelivered: 5 },
  { name: 'গোল্ড মেম্বার', emoji: '🏅', icon: Crown, glowClass: 'avatar-glow-gold', bgGradient: 'bg-gradient-to-r from-amber-500/10 to-yellow-500/10', textColor: 'text-amber-600', borderColor: 'border-amber-300', minDelivered: 3 },
  { name: 'স্টার কাস্টমার', emoji: '⭐', icon: Sparkles, glowClass: 'avatar-glow-star', bgGradient: 'bg-gradient-to-r from-yellow-400/10 to-orange-400/10', textColor: 'text-yellow-600', borderColor: 'border-yellow-300', minDelivered: 2 },
  { name: 'ব্রোঞ্জ মেম্বার', emoji: '🥉', icon: Award, glowClass: 'avatar-glow-bronze', bgGradient: 'bg-gradient-to-r from-orange-400/10 to-amber-300/10', textColor: 'text-orange-600', borderColor: 'border-orange-300', minDelivered: 1 },
];

function getTier(deliveredCount: number): BadgeTier | null {
  return BADGE_TIERS.find(t => deliveredCount >= t.minDelivered) || null;
}

function getNextTier(deliveredCount: number): { tier: BadgeTier; remaining: number } | null {
  const sorted = [...BADGE_TIERS].reverse(); // ascending
  for (const t of sorted) {
    if (deliveredCount < t.minDelivered) {
      return { tier: t, remaining: t.minDelivered - deliveredCount };
    }
  }
  return null;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'অপেক্ষমান', color: 'bg-yellow-100 text-yellow-800' },
  confirmed: { label: 'নিশ্চিত', color: 'bg-blue-100 text-blue-800' },
  shipped: { label: 'পাঠানো হয়েছে', color: 'bg-purple-100 text-purple-800' },
  delivered: { label: 'ডেলিভারি হয়েছে', color: 'bg-green-100 text-green-800' },
  cancelled: { label: 'বাতিল', color: 'bg-red-100 text-red-800' },
  returned: { label: 'রিটার্ন', color: 'bg-orange-100 text-orange-800' },
};

function DashboardContent() {
  const { user, signOut } = useCustomerAuth();
  const { profile, setProfile, avatarUrl, loading: profileLoading } = useCustomerProfile();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { items: cartItems, totalItems: cartTotalItems } = useCart();
  const { wishlistItems, isLoading: wishlistLoading } = useWishlist();
  const [wishlistProducts, setWishlistProducts] = useState<any[]>([]);

  const [orders, setOrders] = useState<any[]>([]);
  const [orderItems, setOrderItems] = useState<Record<string, any[]>>({});
  const [productImages, setProductImages] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ full_name: '', phone: '', address: '', email: '' });
  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Per-product review state
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<{ orderId: string; productId: string; productName: string } | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [reviewImages, setReviewImages] = useState<string[]>([]);
  const [uploadingReviewImg, setUploadingReviewImg] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [myReviews, setMyReviews] = useState<any[]>([]);
  const reviewImgRef = useRef<HTMLInputElement>(null);

  const displayAvatar = localAvatarUrl || avatarUrl;
  const [availableCoupons, setAvailableCoupons] = useState<any[]>([]);
  const [activeCoupon, setActiveCoupon] = useState<string | null>(localStorage.getItem('active_coupon'));
  const [giveawayEntries, setGiveawayEntries] = useState<any[]>([]);
  const deliveredCount = orders.filter(o => o.status === 'delivered').length;
  const currentTier = getTier(deliveredCount);
  const nextTier = getNextTier(deliveredCount);

  useEffect(() => {
    if (user && !profileLoading) loadData();
  }, [user, profileLoading]);

  // Fetch wishlist product details
  useEffect(() => {
    if (wishlistItems.length === 0) { setWishlistProducts([]); return; }
    const pIds = wishlistItems.map((w: any) => w.product_id);
    supabase.from('products').select('id, name, name_bn, price, original_price, images, slug').in('id', pIds)
      .then(({ data }) => { if (data) setWishlistProducts(data); });
  }, [wishlistItems]);

  useEffect(() => {
    if (profile) {
      setEditForm({ full_name: profile.full_name || '', phone: profile.phone || '', address: profile.address || '', email: (profile as any).email || '' });
    }
  }, [profile]);

  // Check if a product in an order already has a review
  const hasReview = (orderId: string, productId: string) => {
    return myReviews.some((r: any) => r.order_id === orderId && r.product_id === productId);
  };

  const openReviewDialog = (orderId: string, productId: string, productName: string) => {
    setReviewTarget({ orderId, productId, productName });
    setReviewRating(5);
    setReviewText('');
    setReviewImages([]);
    setReviewDialogOpen(true);
  };

  const loadData = async () => {
    setLoadingData(true);

    // Non-blocking: claim unclaimed orders in background
    if (profile?.phone) {
      Promise.resolve(supabase.rpc('claim_orders_by_phone', {
        _user_id: user!.id,
        _phone: profile.phone,
      })).catch(() => {});
    }

    // Parallel: fetch orders + reviews at the same time
    const [ordersResult, reviewsResult] = await Promise.all([
      supabase
        .from('orders')
        .select('id, order_number, total, subtotal, delivery_charge, status, created_at, customer_name, discount_note, free_shipping')
        .eq('customer_user_id', user!.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('customer_reviews' as any)
        .select('*')
        .eq('customer_user_id', user!.id)
        .order('created_at', { ascending: false }),
    ]);

    const ords = ordersResult.data;
    if (reviewsResult.data) setMyReviews(reviewsResult.data as any[]);

    if (ords) {
      setOrders(ords);
      const orderIds = ords.map(o => o.id);
      if (orderIds.length > 0) {
        // Fetch order items
        const { data: items } = await supabase
          .from('order_items')
          .select('order_id, product_name, quantity, price, size, color, product_id')
          .in('order_id', orderIds);

        if (items) {
          const grouped: Record<string, any[]> = {};
          const pIds = new Set<string>();
          items.forEach(item => {
            if (!grouped[item.order_id]) grouped[item.order_id] = [];
            grouped[item.order_id].push(item);
            if (item.product_id) pIds.add(item.product_id);
          });
          setOrderItems(grouped);

          // Fetch product images
          if (pIds.size > 0) {
            const { data: prods } = await supabase
              .from('products')
              .select('id, images')
              .in('id', Array.from(pIds));
            if (prods) {
              const imgMap: Record<string, string> = {};
              prods.forEach(p => {
                if (p.images?.[0]) imgMap[p.id] = p.images[0];
              });
              setProductImages(imgMap);
            }
          }
        }
      }
    }

    // Fetch available coupons if at least 1 delivered order
    const deliveredOrds = (ords || []).filter((o: any) => o.status === 'delivered');
    if (deliveredOrds.length > 0) {
      const { data: couponsData } = await supabase.rpc('get_available_coupons');
      if (couponsData && Array.isArray(couponsData)) {
        setAvailableCoupons(couponsData);
      }
    }

    // Fetch giveaway entries linked to customer's orders
    const orderIds = (ords || []).map((o: any) => o.id);
    if (orderIds.length > 0) {
      const { data: gEntries } = await supabase
        .from('giveaway_entries')
        .select('*')
        .in('order_id', orderIds)
        .order('created_at', { ascending: false });
      if (gEntries) setGiveawayEntries(gEntries);
    }

    setLoadingData(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop();
      const filePath = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(filePath, file, { cacheControl: '31536000', upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const newUrl = urlData.publicUrl;

      await supabase.from('customer_profiles').update({ avatar_url: newUrl } as any).eq('user_id', user.id);
      setLocalAvatarUrl(newUrl);
      setProfile((prev: any) => prev ? { ...prev, avatar_url: newUrl } : prev);
      sonnerToast.success('প্রোফাইল ছবি আপডেট হয়েছে');
    } catch (err: any) {
      sonnerToast.error(err.message || 'আপলোড ব্যর্থ');
    }
    setUploadingAvatar(false);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    const updateData: any = { full_name: editForm.full_name.trim(), phone: editForm.phone.trim(), address: editForm.address.trim() || null, email: editForm.email.trim() };
    const { error } = await supabase
      .from('customer_profiles')
      .update(updateData)
      .eq('user_id', user!.id);

    if (error) {
      toast({ title: 'সেভ ব্যর্থ', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'প্রোফাইল আপডেট হয়েছে' });
      setProfile((prev: any) => ({ ...prev, ...editForm }));
      setEditing(false);
    }
    setSaving(false);
  };

  const handleReviewImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setUploadingReviewImg(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files).slice(0, 3)) {
        const url = await uploadReviewImage(file);
        urls.push(url);
      }
      setReviewImages(prev => [...prev, ...urls].slice(0, 5));
    } catch (err: any) {
      sonnerToast.error(err.message || 'ছবি আপলোড ব্যর্থ');
    }
    setUploadingReviewImg(false);
  };

  const handleSubmitReview = async () => {
    if (!reviewTarget) return;
    if (!reviewText.trim() && reviewImages.length === 0) {
      sonnerToast.error('রিভিউ লিখুন অথবা ছবি দিন');
      return;
    }
    setSubmittingReview(true);
    try {
      const { error } = await supabase.from('customer_reviews' as any).insert({
        customer_name: profile?.full_name || 'কাস্টমার',
        customer_location: profile?.address || null,
        rating: reviewRating,
        review_text: reviewText.trim() || null,
        images: reviewImages,
        status: 'pending',
        customer_user_id: user!.id,
        order_id: reviewTarget.orderId,
        product_id: reviewTarget.productId,
        product_name: reviewTarget.productName,
      } as any);
      if (error) throw error;
      sonnerToast.success('রিভিউ সাবমিট হয়েছে! অনুমোদনের পর দেখা যাবে।');
      setReviewDialogOpen(false);
      loadData();
    } catch (err: any) {
      sonnerToast.error(err.message || 'রিভিউ সাবমিট ব্যর্থ');
    }
    setSubmittingReview(false);
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  if (loadingData) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 animate-fade-in">
        <div className="relative">
          <div className="h-16 w-16 rounded-full bg-gradient-to-tr from-primary/20 via-primary/40 to-primary/20 animate-spin" style={{ animationDuration: '2s' }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <ShoppingBag className="h-6 w-6 text-primary animate-pulse" />
          </div>
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold text-foreground tracking-wide">স্বর্ণ সুতা</p>
          <p className="text-xs text-muted-foreground">আপনার প্রোফাইল লোড হচ্ছে...</p>
        </div>
      </div>
    );
  }

  const handleActivateCoupon = (code: string) => {
    localStorage.setItem('active_coupon', code);
    setActiveCoupon(code);
    sonnerToast.success(`কুপন "${code}" সক্রিয় হয়েছে! চেকআউটে অটো অ্যাপ্লাই হবে।`);
  };

  const handleDeactivateCoupon = () => {
    localStorage.removeItem('active_coupon');
    setActiveCoupon(null);
    sonnerToast.info('কুপন নিষ্ক্রিয় করা হয়েছে');
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Profile Header with Badge */}
      <Card className={`overflow-hidden relative ${currentTier ? currentTier.bgGradient : ''}`}>
        {/* Subtle dot pattern background */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, hsl(var(--foreground)) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
        <CardContent className="pt-6 pb-5 relative z-10">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className={currentTier ? currentTier.glowClass : ''}>
                <Avatar className={`h-20 w-20 border-2 ${currentTier ? currentTier.borderColor : 'border-primary/20'}`}>
                  {displayAvatar ? (
                    <AvatarImage src={displayAvatar} alt="Profile" />
                  ) : null}
                  <AvatarFallback className="text-xl font-bold bg-primary/10 text-primary">
                    {(profile?.full_name || '?').charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
              <button
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute inset-0 flex items-center justify-center bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Camera className="h-5 w-5" />
              </button>
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold truncate">{profile?.full_name || 'কাস্টমার'}</h1>
              <p className="text-sm text-muted-foreground">{profile?.phone || ''}</p>
              {currentTier && (
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-base">{currentTier.emoji}</span>
                  <Badge className={`text-[10px] px-2 py-0.5 ${currentTier.textColor} border ${currentTier.borderColor} bg-background/60 badge-shimmer`} variant="outline">
                    {currentTier.name}
                  </Badge>
                </div>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout} className="shrink-0">
              <LogOut className="h-4 w-4 mr-1" />
              লগআউট
            </Button>
          </div>

          {/* Progress to next tier */}
          {nextTier && (
            <div className="mt-4 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  পরবর্তী লেভেল: {nextTier.tier.emoji} {nextTier.tier.name}
                </span>
                <span>আরো {nextTier.remaining}টি ডেলিভারি</span>
              </div>
              <Progress value={(deliveredCount / nextTier.tier.minDelivered) * 100} className="h-2" />
            </div>
          )}
          {!nextTier && deliveredCount >= 5 && (
            <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-violet-500" />
              <span>আপনি সর্বোচ্চ লেভেলে পৌঁছেছেন! 🎉</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Profile Edit Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">প্রোফাইল তথ্য</CardTitle>
          {!editing ? (
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              <Edit2 className="h-4 w-4 mr-1" /> এডিট
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}><X className="h-4 w-4" /></Button>
              <Button size="sm" onClick={handleSaveProfile} disabled={saving}>
                <Check className="h-4 w-4 mr-1" /> {saving ? 'সেভ...' : 'সেভ'}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {editing ? (
            <>
              <div className="space-y-1">
                <Label>নাম</Label>
                <Input autoComplete="name" value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>ফোন</Label>
                <Input autoComplete="tel" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>ইমেইল</Label>
                {user?.app_metadata?.provider === 'google' ? (
                  <Input type="email" value={user?.email || ''} readOnly className="bg-muted cursor-not-allowed" />
                ) : (
                  <Input type="email" autoComplete="email" placeholder="example@gmail.com" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                )}
                {user?.app_metadata?.provider === 'google' && (
                  <p className="text-xs text-muted-foreground">Google দিয়ে সাইনআপ করায় ইমেইল পরিবর্তন করা যাবে না</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>ঠিকানা</Label>
                <Input autoComplete="street-address" value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
              </div>
            </>
          ) : (
            <div className="grid gap-2 text-sm">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{profile?.phone || '—'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{(profile as any)?.email || user?.email?.replace(/@phone\.shorno-suta\.app$/, '') || 'ইমেইল যোগ করুন'}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{profile?.address || 'ঠিকানা যোগ করুন'}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: ShoppingBag, value: orders.length, label: 'মোট অর্ডার', gradient: 'from-blue-500/15 to-cyan-500/10', iconBg: 'bg-blue-500/15', iconColor: 'text-blue-600', blobColor: 'bg-blue-400/10' },
          { icon: Package, value: deliveredCount, label: 'ডেলিভারড', gradient: 'from-emerald-500/15 to-green-500/10', iconBg: 'bg-emerald-500/15', iconColor: 'text-emerald-600', blobColor: 'bg-emerald-400/10' },
          { icon: Tag, value: `৳${orders.reduce((s, o) => s + Number(o.total), 0).toLocaleString('bn-BD')}`, label: 'মোট খরচ', gradient: 'from-violet-500/15 to-purple-500/10', iconBg: 'bg-violet-500/15', iconColor: 'text-violet-600', blobColor: 'bg-violet-400/10' },
        ].map((stat, i) => (
          <Card key={i} className={`stat-card-premium bg-gradient-to-br ${stat.gradient} border-0 shadow-sm`}>
            <CardContent className="pt-5 pb-4 text-center relative">
              {/* Floating blob */}
              <div className={`absolute top-1 right-1 w-8 h-8 rounded-full ${stat.blobColor} animate-blob-float`} style={{ animationDelay: `${i * 0.8}s` }} />
              {/* Icon with glow */}
              <div className={`relative inline-flex items-center justify-center w-11 h-11 rounded-full ${stat.iconBg} mb-2`}>
                <stat.icon className={`h-5 w-5 ${stat.iconColor} animate-float-slow`} style={{ animationDelay: `${i * 0.5}s` }} />
              </div>
              <p className="text-xl font-bold text-foreground">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Coupon Reward Cards */}
      {availableCoupons.length > 0 && deliveredCount > 0 && (
        <Card className="border-0 bg-gradient-to-br from-amber-50/80 via-orange-50/40 to-yellow-50/60 dark:from-amber-950/30 dark:via-orange-950/20 dark:to-yellow-950/30 shadow-md relative overflow-hidden">
          {/* Shimmer overlay */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute inset-0 animate-shimmer-slide bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          </div>
          <CardHeader className="pb-3 relative z-10">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="relative">
                <Gift className="h-5 w-5 text-amber-500" />
                <Sparkles className="h-3 w-3 text-yellow-400 absolute -top-1 -right-1 animate-pulse" />
              </div>
              আপনার জন্য বিশেষ অফার
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 relative z-10">
            {availableCoupons.map((coupon: any) => {
              const isActive = activeCoupon === coupon.code;
              return (
                <div key={coupon.id} className={`coupon-ticket border-2 border-dashed rounded-xl p-4 transition-all ${isActive ? 'border-primary bg-primary/5 shadow-md shadow-primary/10' : 'border-amber-300/60 dark:border-amber-700/40 bg-background/80'}`}>
                  {isActive && (
                    <Badge className="absolute -top-2 right-5 text-[10px] bg-primary text-primary-foreground z-10 badge-shimmer">
                      <Check className="h-3 w-3 mr-0.5" /> সক্রিয় কুপন
                    </Badge>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="font-mono text-xs tracking-wider bg-gradient-to-r from-amber-100 to-yellow-100 dark:from-amber-900/40 dark:to-yellow-900/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300">
                          {coupon.code}
                        </Badge>
                      </div>
                      <p className="text-sm font-semibold">
                        {coupon.discount_type === 'percentage'
                          ? `${coupon.discount_value}% ছাড়`
                          : `৳${coupon.discount_value} ছাড়`}
                        {coupon.max_discount_amount ? ` (সর্বোচ্চ ৳${coupon.max_discount_amount})` : ''}
                      </p>
                      {coupon.min_order_amount > 0 && (
                        <p className="text-xs text-muted-foreground">সর্বনিম্ন ৳{coupon.min_order_amount} অর্ডারে প্রযোজ্য</p>
                      )}
                      {coupon.expires_at && (
                        <p className="text-[10px] text-muted-foreground">
                          মেয়াদ: {new Date(coupon.expires_at).toLocaleDateString('bn-BD')}
                        </p>
                      )}
                    </div>
                    {isActive ? (
                      <Button variant="outline" size="sm" onClick={handleDeactivateCoupon} className="shrink-0 text-xs border-primary/30">
                        <X className="h-3 w-3 mr-1" /> নিষ্ক্রিয়
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => handleActivateCoupon(coupon.code)} className="shrink-0 text-xs animate-glow-pulse-btn">
                        <Zap className="h-3 w-3 mr-1" /> সক্রিয় করুন
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            <p className="text-[10px] text-muted-foreground text-center">
              সক্রিয় কুপন চেকআউটে স্বয়ংক্রিয়ভাবে প্রযোজ্য হবে
            </p>
          </CardContent>
        </Card>
      )}

      {/* Giveaway Gift Cards */}
      {giveawayEntries.length > 0 && (
        <Card className="overflow-hidden border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" /> আপনার গিফট কার্ড ({giveawayEntries.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {giveawayEntries.map((entry, idx) => {
                const proofImg = entry.profile_screenshot || entry.packaging_image;
                return (
                  <div key={entry.id} className="relative rounded-lg overflow-hidden border border-primary/20 bg-gradient-to-b from-primary/5 to-transparent">
                    {proofImg && (
                      <div className="aspect-[4/3] overflow-hidden">
                        <img src={proofImg} alt="গিফট প্রুফ" className="w-full h-full object-cover" loading="lazy" />
                      </div>
                    )}
                    <div className="p-2 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20" variant="outline">
                          🎁 #{idx + 1}
                        </Badge>
                      </div>
                      <p className="text-xs font-medium truncate">{entry.product_name}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <Link to="/giveaway" className="block mt-3">
              <Button variant="outline" size="sm" className="w-full text-xs">
                <Sparkles className="h-3 w-3 mr-1" /> সব গিফট দেখুন
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Cart Products */}
      {cartTotalItems > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" /> কার্টে থাকা প্রোডাক্ট ({cartTotalItems})
            </CardTitle>
            <Link to="/cart">
              <Button variant="outline" size="sm" className="text-xs">কার্ট দেখুন</Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {cartItems.slice(0, 5).map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                {item.image ? (
                  <img src={optimizedImageUrl(item.image, 64, 70)} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">{item.name_bn || item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.size && `${item.size} `}{item.color && `• ${item.color} `}× {item.quantity}
                  </p>
                </div>
                <span className="shrink-0 font-medium">৳{(item.price * item.quantity).toLocaleString('bn-BD')}</span>
              </div>
            ))}
            {cartItems.length > 5 && (
              <p className="text-xs text-muted-foreground text-center">+{cartItems.length - 5}টি আরো আইটেম</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Wishlist / Favorites */}
      {wishlistProducts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Heart className="h-5 w-5 fill-red-500 text-red-500" /> ফেভারিট প্রোডাক্ট ({wishlistProducts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {wishlistProducts.map((p: any) => {
                const isSale = p.original_price && p.original_price > 0 && p.original_price < p.price;
                const dp = isSale ? p.original_price : p.price;
                return (
                  <Link key={p.id} to={`/product/${p.slug}`} className="group border border-border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                    <div className="aspect-square bg-muted overflow-hidden">
                      {p.images?.[0] ? (
                        <img src={optimizedImageUrl(p.images[0], 200, 70)} alt={p.name_bn || p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <ImageIcon className="h-6 w-6" />
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="text-xs font-medium truncate">{p.name_bn || p.name}</p>
                      <p className="text-xs font-bold text-primary">৳{dp}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Order History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5" /> অর্ডার হিস্ট্রি
          </CardTitle>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">এখনো কোনো অর্ডার নেই</p>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => {
                const status = STATUS_LABELS[order.status] || { label: order.status, color: 'bg-muted text-muted-foreground' };
                const items = orderItems[order.id] || [];
                const isDelivered = order.status === 'delivered';
                return (
                  <div key={order.id} className="border border-border rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{order.order_number}</span>
                      <Badge className={`${status.color} text-xs`}>{status.label}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(order.created_at).toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                    {items.length > 0 && (
                      <div className="space-y-2">
                        {items.map((item, i) => {
                          const reviewed = item.product_id ? hasReview(order.id, item.product_id) : false;
                          return (
                            <div key={i} className="space-y-1">
                              <div className="flex items-center gap-2 text-sm">
                                {item.product_id && productImages[item.product_id] ? (
                                  <img src={productImages[item.product_id]} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                                ) : (
                                  <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                )}
                                <span className="text-muted-foreground flex-1 min-w-0 truncate">
                                  {item.product_name} × {item.quantity}
                                  {item.size && ` (${item.size})`}
                                  {item.color && ` - ${item.color}`}
                                </span>
                                <span className="shrink-0">৳{(item.price * item.quantity).toLocaleString('bn-BD')}</span>
                              </div>
                              {/* Review button for delivered orders */}
                              {isDelivered && item.product_id && (
                                reviewed ? (
                                  <Badge variant="secondary" className="text-[10px] ml-10">✓ রিভিউ দেওয়া হয়েছে</Badge>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="ml-10 h-7 text-xs"
                                    onClick={() => openReviewDialog(order.id, item.product_id, item.product_name)}
                                  >
                                    <Star className="h-3 w-3 mr-1" /> রিভিউ দিন
                                  </Button>
                                )
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <Separator />
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div className="flex justify-between"><span>সাবটোটাল</span><span>৳{Number(order.subtotal).toLocaleString('bn-BD')}</span></div>
                      <div className="flex justify-between"><span>ডেলিভারি</span><span>৳{Number(order.delivery_charge).toLocaleString('bn-BD')}</span></div>
                      {(() => {
                        const disc = Number(order.subtotal || 0) + Number(order.delivery_charge || 0) - Number(order.total || 0);
                        return disc > 0 ? (
                          <div className="flex justify-between text-red-500">
                            <span>ডিসকাউন্ট</span><span>-৳{disc.toLocaleString('bn-BD')}</span>
                          </div>
                        ) : null;
                      })()}
                      {order.discount_note && <p className="text-[10px] italic">{order.discount_note}</p>}
                    </div>
                    <div className="flex justify-between text-sm font-medium">
                      <span>মোট</span><span>৳{Number(order.total).toLocaleString('bn-BD')}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* My Reviews */}
      {myReviews.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">আমার রিভিউসমূহ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {myReviews.map((r: any) => (
              <div key={r.id} className="border border-border rounded-lg p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {r.product_id && productImages[r.product_id] && (
                      <img src={productImages[r.product_id]} alt="" className="w-8 h-8 rounded object-cover" />
                    )}
                    <div>
                      {r.product_name && <p className="text-xs font-medium">{r.product_name}</p>}
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map(s => (
                          <Star key={s} className={`h-3 w-3 ${s <= r.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/20'}`} />
                        ))}
                      </div>
                    </div>
                  </div>
                  <Badge variant={r.status === 'approved' ? 'default' : r.status === 'pending' ? 'secondary' : 'destructive'} className="text-[10px]">
                    {r.status === 'approved' ? 'অনুমোদিত' : r.status === 'pending' ? 'অপেক্ষমান' : 'প্রত্যাখ্যাত'}
                  </Badge>
                </div>
                {r.review_text && <p className="text-sm text-muted-foreground">{r.review_text}</p>}
                {r.images?.length > 0 && (
                  <div className="flex gap-1">
                    {r.images.map((img: string, i: number) => (
                      <img key={i} src={img} alt="" className="w-12 h-12 rounded object-cover" />
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString('bn-BD')}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Star className="h-4 w-4" /> রিভিউ দিন
            </DialogTitle>
          </DialogHeader>
          {reviewTarget && (
            <div className="space-y-4">
              {/* Product info */}
              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                {reviewTarget.productId && productImages[reviewTarget.productId] ? (
                  <img src={productImages[reviewTarget.productId]} alt="" className="w-10 h-10 rounded object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <span className="text-sm font-medium">{reviewTarget.productName}</span>
              </div>

              {/* Star Rating */}
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map(s => (
                  <button key={s} type="button" onClick={() => setReviewRating(s)}>
                    <Star className={`h-7 w-7 transition-colors ${s <= reviewRating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
                  </button>
                ))}
                <span className="text-sm text-muted-foreground ml-2">{reviewRating}/5</span>
              </div>

              <Textarea
                placeholder="আপনার অভিজ্ঞতা শেয়ার করুন..."
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                rows={3}
              />

              {/* Image upload */}
              <div className="flex items-center gap-2 flex-wrap">
                {reviewImages.map((url, i) => (
                  <div key={i} className="relative w-16 h-16">
                    <img src={url} alt="" className="w-full h-full rounded-lg object-cover" />
                    <button
                      onClick={() => setReviewImages(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs"
                    >×</button>
                  </div>
                ))}
                {reviewImages.length < 5 && (
                  <button
                    onClick={() => reviewImgRef.current?.click()}
                    disabled={uploadingReviewImg}
                    className="w-16 h-16 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center text-muted-foreground hover:border-primary/50 transition-colors"
                  >
                    {uploadingReviewImg ? (
                      <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Upload className="h-5 w-5" />
                    )}
                  </button>
                )}
                <input ref={reviewImgRef} type="file" accept="image/*" multiple className="hidden" onChange={handleReviewImageUpload} />
              </div>

              <Button onClick={handleSubmitReview} disabled={submittingReview} className="w-full">
                {submittingReview ? 'সাবমিট হচ্ছে...' : 'রিভিউ সাবমিট করুন'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CustomerDashboard() {
  return (
    <Layout>
      <CustomerAuthGuard>
        <DashboardContent />
      </CustomerAuthGuard>
    </Layout>
  );
}
