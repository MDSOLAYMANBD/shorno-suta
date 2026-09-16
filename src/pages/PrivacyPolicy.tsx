import Layout from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import SEOHead from '@/components/SEOHead';

export default function PrivacyPolicy() {
  return (
    <Layout>
      <SEOHead
        title="প্রাইভেসি পলিসি | স্বর্ণ সুতা"
        description="স্বর্ণ সুতা আপনার ব্যক্তিগত তথ্যের গোপনীয়তা রক্ষায় প্রতিশ্রুতিবদ্ধ। আমাদের প্রাইভেসি পলিসি জানুন।"
        canonical="/privacy-policy"
      />
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
        <h1 className="text-3xl font-bold text-center text-foreground">প্রাইভেসি পলিসি / Privacy Policy</h1>

        {/* বাংলা */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">🔒 গোপনীয়তা নীতি</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 text-sm leading-relaxed text-muted-foreground">
            <div>
              <h3 className="text-base font-semibold text-foreground mb-2">📋 তথ্য সংগ্রহ</h3>
              <p>অর্ডার প্রসেস করার জন্য আমরা নিম্নলিখিত তথ্য সংগ্রহ করি:</p>
              <ul className="list-disc list-inside space-y-1 mt-1">
                <li>আপনার নাম, ফোন নম্বর ও ডেলিভারি ঠিকানা</li>
                <li>অর্ডার সংক্রান্ত তথ্য (প্রোডাক্ট, পরিমাণ, মূল্য)</li>
                <li>ব্রাউজিং ডেটা (পেজ ভিজিট, সেশন তথ্য) — ওয়েবসাইট উন্নতির জন্য</li>
              </ul>
            </div>

            <div>
              <h3 className="text-base font-semibold text-foreground mb-2">🎯 তথ্য ব্যবহার</h3>
              <p>আপনার তথ্য শুধুমাত্র নিচের উদ্দেশ্যে ব্যবহার করা হয়:</p>
              <ul className="list-disc list-inside space-y-1 mt-1">
                <li>অর্ডার প্রসেসিং ও ডেলিভারি সম্পন্ন করা</li>
                <li>কাস্টমার সাপোর্ট প্রদান</li>
                <li>অফার ও আপডেট সম্পর্কে জানানো (SMS/Push Notification)</li>
                <li>ওয়েবসাইটের পারফরম্যান্স ও ব্যবহারকারী অভিজ্ঞতা উন্নত করা</li>
              </ul>
            </div>

            <div>
              <h3 className="text-base font-semibold text-foreground mb-2">🤝 তথ্য শেয়ারিং</h3>
              <p>আমরা আপনার তথ্য শুধুমাত্র নিচের সার্ভিস প্রোভাইডারদের সাথে শেয়ার করি:</p>
              <ul className="list-disc list-inside space-y-1 mt-1">
                <li><strong>কুরিয়ার সার্ভিস (Steadfast):</strong> ডেলিভারির জন্য নাম, ফোন ও ঠিকানা</li>
                <li><strong>পেমেন্ট গেটওয়ে (UddoktaPay):</strong> অনলাইন পেমেন্ট প্রসেসের জন্য</li>
              </ul>
              <p className="mt-1">আমরা কখনো আপনার তথ্য তৃতীয় পক্ষের কাছে বিক্রি করি না।</p>
            </div>

            <div>
              <h3 className="text-base font-semibold text-foreground mb-2">🍪 কুকি ও ট্র্যাকিং</h3>
              <p>আমাদের ওয়েবসাইটে নিম্নলিখিত ট্র্যাকিং টুল ব্যবহৃত হয়:</p>
              <ul className="list-disc list-inside space-y-1 mt-1">
                <li><strong>Meta Pixel:</strong> ফেসবুক বিজ্ঞাপনের কার্যকারিতা পরিমাপ</li>
                <li><strong>Google Analytics:</strong> ওয়েবসাইট ট্রাফিক ও ব্যবহারকারী আচরণ বিশ্লেষণ</li>
                <li><strong>Web Vitals:</strong> ওয়েবসাইটের পারফরম্যান্স মনিটরিং</li>
              </ul>
            </div>

            <div>
              <h3 className="text-base font-semibold text-foreground mb-2">🛡️ তথ্য সুরক্ষা</h3>
              <p>আপনার সকল তথ্য নিরাপদ ডেটাবেজে সংরক্ষিত হয়। আমরা SSL এনক্রিপশন এবং আধুনিক নিরাপত্তা ব্যবস্থা ব্যবহার করি। শুধুমাত্র অনুমোদিত কর্মীরাই আপনার তথ্যে প্রবেশ করতে পারে।</p>
            </div>

            <div>
              <h3 className="text-base font-semibold text-foreground mb-2">✅ গ্রাহকের অধিকার</h3>
              <ul className="list-disc list-inside space-y-1">
                <li>আপনি যেকোনো সময় আপনার তথ্য আপডেট বা মুছে ফেলার অনুরোধ করতে পারেন</li>
                <li>মার্কেটিং মেসেজ বন্ধ করার অনুরোধ জানাতে পারেন</li>
                <li>আপনার সংরক্ষিত তথ্য সম্পর্কে জানতে চাইতে পারেন</li>
              </ul>
            </div>

            <div>
              <h3 className="text-base font-semibold text-foreground mb-2">📞 যোগাযোগ</h3>
              <p>প্রাইভেসি সংক্রান্ত যেকোনো প্রশ্ন বা অনুরোধের জন্য যোগাযোগ করুন:</p>
              <ul className="list-disc list-inside space-y-1 mt-1">
                <li>WhatsApp: +8801843711211</li>
                <li>ওয়েবসাইট: shornosuta.com</li>
              </ul>
            </div>

            <p className="text-xs text-muted-foreground pt-2 border-t border-border">সর্বশেষ আপডেট: মার্চ ২০২৬</p>
          </CardContent>
        </Card>

        {/* English */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">🔒 Privacy Policy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 text-sm leading-relaxed text-muted-foreground">
            <div>
              <h3 className="text-base font-semibold text-foreground mb-2">📋 Information We Collect</h3>
              <p>We collect the following information to process your orders:</p>
              <ul className="list-disc list-inside space-y-1 mt-1">
                <li>Your name, phone number, and delivery address</li>
                <li>Order details (products, quantity, price)</li>
                <li>Browsing data (page visits, session info) — to improve our website</li>
              </ul>
            </div>

            <div>
              <h3 className="text-base font-semibold text-foreground mb-2">🎯 How We Use Your Information</h3>
              <ul className="list-disc list-inside space-y-1">
                <li>Processing and delivering your orders</li>
                <li>Providing customer support</li>
                <li>Sending offers and updates (SMS/Push Notifications)</li>
                <li>Improving website performance and user experience</li>
              </ul>
            </div>

            <div>
              <h3 className="text-base font-semibold text-foreground mb-2">🤝 Information Sharing</h3>
              <p>We only share your data with the following service providers:</p>
              <ul className="list-disc list-inside space-y-1 mt-1">
                <li><strong>Courier Service (Steadfast):</strong> Name, phone & address for delivery</li>
                <li><strong>Payment Gateway (UddoktaPay):</strong> For online payment processing</li>
              </ul>
              <p className="mt-1">We never sell your information to third parties.</p>
            </div>

            <div>
              <h3 className="text-base font-semibold text-foreground mb-2">🍪 Cookies & Tracking</h3>
              <p>Our website uses the following tracking tools:</p>
              <ul className="list-disc list-inside space-y-1 mt-1">
                <li><strong>Meta Pixel:</strong> Measuring Facebook ad effectiveness</li>
                <li><strong>Google Analytics:</strong> Analyzing website traffic and user behavior</li>
                <li><strong>Web Vitals:</strong> Monitoring website performance</li>
              </ul>
            </div>

            <div>
              <h3 className="text-base font-semibold text-foreground mb-2">🛡️ Data Security</h3>
              <p>All your data is stored in a secure database. We use SSL encryption and modern security measures. Only authorized personnel can access your information.</p>
            </div>

            <div>
              <h3 className="text-base font-semibold text-foreground mb-2">✅ Your Rights</h3>
              <ul className="list-disc list-inside space-y-1">
                <li>You can request to update or delete your data at any time</li>
                <li>You can opt out of marketing messages</li>
                <li>You can inquire about your stored information</li>
              </ul>
            </div>

            <div>
              <h3 className="text-base font-semibold text-foreground mb-2">📞 Contact Us</h3>
              <p>For any privacy-related questions or requests:</p>
              <ul className="list-disc list-inside space-y-1 mt-1">
                <li>WhatsApp: +8801843711211</li>
                <li>Website: shornosuta.com</li>
              </ul>
            </div>

            <p className="text-xs text-muted-foreground pt-2 border-t border-border">Last updated: March 2026</p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
