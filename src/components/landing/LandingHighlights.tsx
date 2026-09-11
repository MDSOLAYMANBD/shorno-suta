import { Gem, Sparkles, CloudSun, Scissors } from 'lucide-react';

const highlights = [
  { icon: Gem, title: 'প্রিমিয়াম ফেব্রিক', desc: 'প্রিমিয়াম কোয়ালিটি কটন ফেব্রিক যা দীর্ঘস্থায়ী ও আরামদায়ক।' },
  { icon: Sparkles, title: 'হ্যান্ড মিরর ওয়ার্ক', desc: 'নিখুঁত এমব্রয়ডারি এবং রিয়েল হ্যান্ড মিরর ওয়ার্কের সূক্ষ্ম কারুকাজ।' },
  { icon: CloudSun, title: 'সব ঋতুতে আরামদায়ক', desc: 'সফট ফেব্রিক যা গরম ও শীতে সমান আরামদায়ক।' },
  { icon: Scissors, title: 'ট্রেন্ডি ডিজাইন', desc: 'আধুনিক কাটিং ও ট্রেন্ডি ডিজাইন যা যেকোনো অনুষ্ঠানে মানানসই।' },
];

export default function LandingHighlights() {
  return (
    <section className="py-8 sm:py-12 px-4">
      <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
        {highlights.map((h, i) => (
          <div key={i} className="flex gap-3 p-4 rounded-xl border border-border bg-card">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#8C6A1A15' }}>
              <h.icon className="h-5 w-5" style={{ color: '#8C6A1A' }} />
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-1">{h.title}</h3>
              <p className="text-xs" style={{ color: '#666' }}>{h.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
