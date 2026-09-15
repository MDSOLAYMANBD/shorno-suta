import Layout from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import SEOHead from '@/components/SEOHead';

export default function ReturnPolicy() {
  return (
    <Layout>
      <SEOHead title="রিটার্ন পলিসি | স্বর্ণ সুতা" description="স্বর্ণ সুতার রিটার্ন পলিসি। ডেলিভারি ম্যানের সামনে চেক করুন, ৭ দিনের মধ্যে সমস্যা জানান।" canonical="/return-policy" />
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
        <h1 className="text-3xl font-bold text-center text-foreground">রিটার্ন পলিসি / Return Policy</h1>

        {/* বাংলা */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">🔁 রিটার্ন পলিসি</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>আমরা চাই গ্রাহক নিশ্চিন্তে ও স্বচ্ছভাবে কেনাকাটা করুন।</p>
            <ul className="list-disc list-inside space-y-1">
              <li>ডেলিভারি ম্যানের সামনে প্রোডাক্ট চেক করা বাধ্যতামূলক</li>
              <li>পছন্দ না হলে ডেলিভারি চার্জ প্রদান করে তাৎক্ষণিক রিটার্ন করা যাবে</li>
              <li>এই ক্ষেত্রে কোনো রিফান্ড প্রযোজ্য নয়</li>
            </ul>

            <h3 className="text-lg font-semibold text-foreground pt-4">🎥 Damage / Wrong Product Policy</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>রিসিভের সময় চেক না করলে, পরে পার্সেল খোলার সময় অবশ্যই Unboxing Video/Photo রাখতে হবে</li>
              <li>৭ দিনের মধ্যে WhatsApp করুন: +8809617356977</li>
              <li>প্রোডাক্ট ভাঙা, ছেঁড়া, ভুল রং/সাইজ বা ভুল প্রোডাক্ট হলে আমরা নিজ খরচে পরিবর্তন করে দেব</li>
              <li>৭ দিনের পর কোনো অভিযোগ গ্রহণযোগ্য নয়</li>
            </ul>
          </CardContent>
        </Card>

        {/* English */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">🔁 Return Policy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>We aim to provide a transparent and smooth shopping experience.</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Customers must check the product in front of the delivery person</li>
              <li>If you do not like the product, you may return it immediately by paying the delivery charge</li>
              <li>No refund is applicable in this case</li>
            </ul>

            <h3 className="text-lg font-semibold text-foreground pt-4">🎥 Damaged or Wrong Product Policy</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>If the product is not checked at the time of delivery, an Unboxing video/photo is mandatory</li>
              <li>Issues must be reported within 7 days via WhatsApp: +8809617356977</li>
              <li>If the product is damaged, torn, wrong color, wrong size, or incorrect item, we will replace it at our cost</li>
              <li>Complaints after 7 days will not be accepted</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
