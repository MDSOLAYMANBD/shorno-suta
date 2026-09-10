import Layout from '@/components/layout/Layout';
import SEOHead from '@/components/SEOHead';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function CancellationPolicy() {
  return (
    <Layout>
      <SEOHead title="ক্যানসেলেশন পলিসি | স্বর্ণ সুতা" description="স্বর্ণ সুতার ক্যানসেলেশন পলিসি। শিপিংয়ের আগে বিনা চার্জে ক্যানসেল করুন।" canonical="/refund-policy" />
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
        <h1 className="text-3xl font-bold text-center text-foreground">ক্যানসেলেশন পলিসি / Cancellation Policy</h1>

        {/* বাংলা */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">❌ ক্যানসেলেশন পলিসি</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-relaxed text-muted-foreground">
            <ul className="list-disc list-inside space-y-1">
              <li>প্রতিটি অর্ডার আমরা ফোন কলের মাধ্যমে কনফার্ম করি</li>
              <li>কনফার্ম হওয়ার পর অর্ডার কুরিয়ারে পাঠানো হয়</li>
              <li>শিপ করার আগে ক্যানসেল করলে: কোনো চার্জ নেই</li>
              <li>শিপ হওয়ার পর ক্যানসেল করলে: ডেলিভারি চার্জ দিতে হবে</li>
              <li>কুরিয়ারে হস্তান্তরের পর অর্ডার সম্পূর্ণ ফ্রি ক্যানসেল করা যাবে না</li>
            </ul>
          </CardContent>
        </Card>

        {/* English */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">❌ Cancellation Policy</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-relaxed text-muted-foreground">
            <ul className="list-disc list-inside space-y-1">
              <li>Every order is confirmed by phone call before shipping</li>
              <li>After confirmation, the order is handed over to the courier</li>
              <li>Cancel before shipping: No charge</li>
              <li>Cancel after shipping: Delivery charge must be paid</li>
              <li>Orders cannot be fully canceled once handed over to courier</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
