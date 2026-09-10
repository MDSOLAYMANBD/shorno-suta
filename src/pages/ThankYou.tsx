import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import OrderSuccessContent, { OrderSuccessItem } from '@/components/order/OrderSuccessContent';
import SEOHead from '@/components/SEOHead';
import { supabase } from '@/integrations/supabase/client';
import { getVisitorClickKeys } from '@/lib/sms/shortLinks';


const STORAGE_KEY = 'thank_you_order';
const GOOGLE_MERCHANT_ID = '5372768452';

export interface ThankYouOrderData {
  orderNumber: string;
  orderId?: string;
  items: OrderSuccessItem[];
  deliveryCharge?: number;
  customerPhone?: string;
  discount?: number;
  customerEmail?: string;
}

/** Call this before navigating to /thank-you */
export function storeThankYouData(data: ThankYouOrderData) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // storage full — ignore
  }
}

function useGoogleCustomerReviews(orderData: ThankYouOrderData | null) {
  useEffect(() => {
    if (!orderData?.customerEmail) return;

    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + 5);
    const estimatedDelivery = deliveryDate.toISOString().split('T')[0];

    const renderOptIn = () => {
      try {
        (window as any).gapi.load('surveyoptin', () => {
          (window as any).gapi.surveyoptin.render({
            merchant_id: GOOGLE_MERCHANT_ID,
            order_id: orderData.orderNumber,
            email: orderData.customerEmail,
            delivery_country: 'BD',
            estimated_delivery_date: estimatedDelivery,
          });
        });
      } catch (e) {
        console.error('[Google Customer Reviews] Failed:', e);
      }
    };

    if ((window as any).gapi?.load) {
      renderOptIn();
      return;
    }

    (window as any).__gcr_renderOptIn = renderOptIn;
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/platform.js?onload=__gcr_renderOptIn';
    script.async = true;
    document.head.appendChild(script);

    return () => {
      delete (window as any).__gcr_renderOptIn;
    };
  }, [orderData]);
}

export default function ThankYou() {
  const navigate = useNavigate();
  const [orderData, setOrderData] = useState<ThankYouOrderData | null>(null);

  useGoogleCustomerReviews(orderData);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ThankYouOrderData;
        if (parsed.orderNumber) {
          setOrderData(parsed);
          sessionStorage.removeItem(STORAGE_KEY);
          // Fire-and-forget SMS click → order attribution
          try {
            const keys = getVisitorClickKeys();
            if (parsed.orderId && parsed.customerPhone && keys.length > 0) {
              (supabase.rpc as any)('sms_link_order_from_clicks', {
                p_order_id: parsed.orderId,
                p_phone: parsed.customerPhone,
                p_click_keys: keys,
              }).then(() => {}, () => {});
            }
          } catch { /* ignore */ }
          return;

        }
      }
    } catch {
      // corrupted data
    }
    // No valid data — redirect to shop
    navigate('/shop', { replace: true });
  }, [navigate]);


  if (!orderData) return null;

  return (
    <Layout>
      <SEOHead title="অর্ডার সফল হয়েছে | স্বর্ণ সুতা" description="আপনার অর্ডার সফলভাবে সম্পন্ন হয়েছে। ধন্যবাদ স্বর্ণ সুতা থেকে কেনাকাটা করার জন্য।" noindex />
      <div className="min-h-[60vh] flex items-center justify-center bg-muted/30 px-4 py-8">
        <div className="max-w-sm w-full bg-card rounded-2xl shadow-lg p-6">
           <OrderSuccessContent
            orderNumber={orderData.orderNumber}
            orderId={orderData.orderId}
            items={orderData.items}
            deliveryCharge={orderData.deliveryCharge}
            discount={orderData.discount}
            customerPhone={orderData.customerPhone}
            onClose={() => navigate('/shop')}
            closeLabel="শপিং চালিয়ে যান"
          />
        </div>
      </div>
    </Layout>
  );
}
