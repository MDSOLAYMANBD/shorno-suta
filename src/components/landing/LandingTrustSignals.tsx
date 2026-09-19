import { Truck, Clock, Package, RefreshCw, type LucideIcon } from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  truck: Truck, clock: Clock, package: Package, refresh: RefreshCw,
};

const DEFAULT_ITEMS = [
  { icon: 'truck', title: 'ক্যাশ অন ডেলিভারি', desc: 'সারা বাংলাদেশে অগ্রিম পেমেন্ট ছাড়াই ডেলিভারি।' },
  { icon: 'clock', title: 'দ্রুত ডেলিভারি', desc: 'ঢাকায় ২৪-৪৮ ঘণ্টা, ঢাকার বাইরে ২-৫ কর্মদিবস।' },
  { icon: 'package', title: 'সিলড প্যাকেজিং', desc: 'সিলড ব্র্যান্ডেড প্যাকেটে নিরাপদ ডেলিভারি।' },
  { icon: 'refresh', title: '৭ দিনের এক্সচেঞ্জ', desc: 'ভুল সাইজ বা ক্ষতিগ্রস্ত পণ্যে ৭ দিনের মধ্যে পরিবর্তন। (আনবক্সিং ভিডিও বাধ্যতামূলক)' },
];

interface TrustItem { icon?: string; title: string; desc: string; }

interface Props {
  enabled?: boolean;
  heading?: string;
  items?: TrustItem[];
}

export default function LandingTrustSignals({ enabled = true, heading, items }: Props) {
  if (!enabled) return null;

  const displayItems = items && items.length > 0 ? items : DEFAULT_ITEMS;

  return (
    <section className="py-8 sm:py-12 px-4" style={{ backgroundColor: 'hsl(var(--primary) / 0.05)' }}>
      <div className="max-w-3xl mx-auto">
        <h2 className="text-xl sm:text-2xl font-bold text-center mb-6">{heading || 'ডেলিভারি ও রিটার্ন পলিসি'}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {displayItems.map((s, i) => {
            const Icon = ICON_MAP[s.icon || ''] || Truck;
            return (
              <div key={i} className="bg-white rounded-xl p-4 flex gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'hsl(var(--primary) / 0.08)' }}>
                  <Icon className="h-5 w-5" style={{ color: 'hsl(var(--primary))' }} />
                </div>
                <div>
                  <h3 className="font-semibold text-sm mb-0.5">{s.title}</h3>
                  <p className="text-xs" style={{ color: '#666' }}>{s.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
