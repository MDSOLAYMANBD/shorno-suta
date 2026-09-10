import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trackPurchase } from '@/lib/ecommerceTracking';
import { trackMetaPurchase } from '@/lib/metaTracking';
import { storeThankYouData } from '@/pages/ThankYou';

export default function PaymentResult() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'paid' | 'failed' | 'cancelled'>('loading');
  const [orderNumber, setOrderNumber] = useState('');
  const trackingFired = useRef(false);

  // Shared by every gateway — all gateway-verify functions return the same
  // { payment_status, order_number, amount, order_details } shape.
  const handleVerifyResult = (data: any) => {
    setOrderNumber(data.order_number || '');
    const paymentStatus = data.payment_status === 'paid'
      ? 'paid'
      : data.payment_status === 'cancelled'
        ? 'cancelled'
        : 'failed';
    setStatus(paymentStatus as any);

    if (paymentStatus === 'paid' && data.order_details && !trackingFired.current) {
      trackingFired.current = true;
      const details = data.order_details;
      const items = details.items || [];
      const orderNum = details.order_number || data.order_number;
      const total = details.total || data.amount || 0;
      const shipping = details.delivery_charge || 0;

      trackPurchase(orderNum, items.map((it: any) => ({
        id: it.product_id,
        name: it.product_name,
        price: it.price,
        quantity: it.quantity,
      })), total, shipping, undefined, {
        customer_name: details.customer_name || undefined,
        customer_phone: details.customer_phone || undefined,
        customer_address: details.customer_address || undefined,
        customer_email: details.customer_email || undefined,
      });

      trackMetaPurchase(orderNum, items.map((it: any) => ({
        id: it.product_id,
        quantity: it.quantity,
        price: it.price,
      })), total, {
        ph: details.customer_phone || undefined,
        fn: details.customer_name || undefined,
        client_user_agent: navigator.userAgent,
      });

      storeThankYouData({
        orderNumber: orderNum,
        items: items.map((it: any) => ({
          name: it.product_name,
          qty: it.quantity,
          price: it.price,
          size: it.size,
          color: it.color,
        })),
        deliveryCharge: shipping,
        customerEmail: details.customer_email || undefined,
      });
      navigate('/thank-you', { replace: true });
    }
  };

  useEffect(() => {
    const cancelled = searchParams.get('status');

    // bKash's redirect always carries paymentID; verify server-side rather
    // than trusting the client-visible ?status= it also appends.
    const bkashPaymentId = searchParams.get('paymentID');
    if (bkashPaymentId) {
      const verifyBkash = async (attempt = 0) => {
        try {
          const { data, error } = await supabase.functions.invoke('bkash-verify', {
            body: { payment_id: bkashPaymentId, status: cancelled || undefined },
          });
          if (error || data?.error) {
            setStatus('failed');
            return;
          }
          if (data.payment_status === 'processing' && attempt < 2) {
            setTimeout(() => verifyBkash(attempt + 1), 1500);
            return;
          }
          handleVerifyResult(data);
        } catch {
          setStatus('failed');
        }
      };
      verifyBkash();
      return;
    }

    if (cancelled === 'cancelled') {
      setStatus('cancelled');
      return;
    }

    const invoiceId = searchParams.get('invoice_id');
    if (!invoiceId) {
      setStatus('failed');
      return;
    }

    const verify = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('uddoktapay-verify', {
          body: { invoice_id: invoiceId },
        });
        if (error || data?.error) {
          setStatus('failed');
          return;
        }
        handleVerifyResult(data);
      } catch {
        setStatus('failed');
      }
    };

    verify();
  }, [searchParams]);

  return (
    <Layout>
      <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
        <div className="max-w-sm w-full bg-card rounded-2xl shadow-lg p-6 text-center space-y-4">
          {status === 'loading' && (
            <>
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
              <p className="text-lg font-semibold">পেমেন্ট যাচাই করা হচ্ছে...</p>
            </>
          )}

          {status === 'paid' && (
            <>
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <CheckCircle className="h-10 w-10 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-green-700">পেমেন্ট সফল!</h2>
              {orderNumber && (
                <p className="text-muted-foreground">
                  অর্ডার নম্বর: <span className="font-semibold text-foreground">{orderNumber}</span>
                </p>
              )}
              <p className="text-sm text-muted-foreground">আপনার অর্ডার সফলভাবে গৃহীত হয়েছে।</p>
              <div className="flex gap-2 pt-2">
                <Button onClick={() => navigate('/shop')} className="flex-1">শপিং চালিয়ে যান</Button>
                <Button variant="outline" onClick={() => navigate('/order-status')} className="flex-1">অর্ডার ট্র্যাক</Button>
              </div>
            </>
          )}

          {(status === 'failed' || status === 'cancelled') && (
            <>
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
                <XCircle className="h-10 w-10 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-red-700">
                {status === 'cancelled' ? 'পেমেন্ট বাতিল হয়েছে' : 'পেমেন্ট ব্যর্থ হয়েছে'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {status === 'cancelled'
                  ? 'আপনি পেমেন্ট বাতিল করেছেন। আবার চেষ্টা করুন।'
                  : 'পেমেন্ট সম্পন্ন হয়নি। অনুগ্রহ করে আবার চেষ্টা করুন।'}
              </p>
              <div className="flex gap-2 pt-2">
                <Button onClick={() => navigate('/checkout')} className="flex-1">আবার চেষ্টা করুন</Button>
                <Button variant="outline" onClick={() => navigate('/shop')} className="flex-1">শপে ফিরুন</Button>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
