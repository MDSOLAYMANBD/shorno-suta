import Layout from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import SEOHead from '@/components/SEOHead';

export default function ExchangeRefundPolicy() {
  return (
    <Layout>
      <SEOHead title="এক্সচেঞ্জ ও রিফান্ড | স্বর্ণ সুতা" description="স্বর্ণ সুতার এক্সচেঞ্জ ও রিফান্ড পলিসি। প্রোডাক্ট এক্সচেঞ্জ, পেমেন্ট ও ডেলিভারি তথ্য।" canonical="/Return-ExchangePolicy" />
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
        <h1 className="text-3xl font-bold text-center text-foreground">এক্সচেঞ্জ ও রিফান্ড / Exchange &amp; Refund</h1>

        {/* বাংলা */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">🔄 এক্সচেঞ্জ / রিফান্ড পলিসি</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>আমরা রিফান্ড দিই না, তবে এক্সচেঞ্জ সুবিধা দিয়ে থাকি।</p>
            <ul className="list-disc list-inside space-y-1">
              <li>প্রোডাক্ট রাখতে না চাইলে আমাদের শপের অন্য যেকোনো প্রোডাক্টের সাথে এক্সচেঞ্জ করা যাবে</li>
              <li>এক্সচেঞ্জের ক্ষেত্রে ডেলিভারি চার্জ প্রযোজ্য হতে পারে</li>
              <li>কোনো রিফান্ড অপশন নেই</li>
            </ul>

            <h3 className="text-lg font-semibold text-foreground pt-4">💳 পেমেন্ট সংক্রান্ত তথ্য</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>সাধারণত সব অর্ডার Cash on Delivery</li>
              <li>সাধারণ অবস্থায় কোনো অ্যাডভান্স পেমেন্ট লাগে না</li>
              <li>আগে অকারণে রিটার্ন করলে, পরবর্তী অর্ডারে শুধু ডেলিভারি চার্জ অ্যাডভান্স নেওয়া হতে পারে</li>
              <li>স্বর্ণ সুতা-এর প্রতি আস্থা থেকে, গিফট দেওয়ার ক্ষেত্রে চাইলে নিজ ইচ্ছায় Online Payment Gateway এর মাধ্যমে অ্যাডভান্স পেমেন্ট করা যাবে</li>
              <li>রিফান্ড কোনো অবস্থাতেই প্রযোজ্য নয়</li>
            </ul>

            <h3 className="text-lg font-semibold text-foreground pt-4">🚚 ডেলিভারি তথ্য</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>ঢাকা শহরের মধ্যে: ২৪ ঘণ্টার মধ্যে ডেলিভারি</li>
              <li>ঢাকার বাইরে: ২–৫ কর্মদিবস</li>
              <li>১ কেজি পর্যন্ত ডেলিভারি চার্জ: ৭০ / ১০০ / ১২০ টাকা</li>
              <li>ওজন বেশি হলে ডেলিভারি চার্জ বাড়তে পারে</li>
            </ul>
          </CardContent>
        </Card>

        {/* English */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">🔄 Exchange &amp; Refund Policy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>We do not offer refunds. Instead, we provide an exchange facility.</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Customers may exchange the product with any other item from our shop</li>
              <li>Delivery charges may apply for exchanges</li>
              <li>No refund option is available</li>
            </ul>

            <h3 className="text-lg font-semibold text-foreground pt-4">💳 Payment Information</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>All orders are usually Cash on Delivery</li>
              <li>No advance payment is required in general</li>
              <li>If a customer previously returned an order without valid reason, delivery charge advance may be required</li>
              <li>For gift orders, customers may voluntarily pay in advance via Online Payment Gateway</li>
              <li>Refunds are not available</li>
            </ul>

            <h3 className="text-lg font-semibold text-foreground pt-4">🚚 Delivery Information</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>Inside Dhaka: Within 24 hours</li>
              <li>Outside Dhaka: 2–5 working days</li>
              <li>Delivery charge (up to 1 kg): BDT 70 / 100 / 120</li>
              <li>Charges may increase for heavier parcels</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
