import { useNavigate } from 'react-router-dom';
import { PenTool, UserCog, Gauge, Plug, Sparkles, Wallet } from 'lucide-react';

const SETTINGS_CARDS = [
  { to: '/admin/site-editor', icon: PenTool, label: 'সাইট এডিটর', desc: 'হোমপেজ, নেভবার, ফুটার, থিম, ইনভয়েস ইত্যাদি' },
  { to: '/admin/employees', icon: UserCog, label: 'এমপ্লয়ী', desc: 'এমপ্লয়ী একাউন্ট ও পারমিশন' },
  { to: '/admin/performance', icon: Gauge, label: 'পারফরম্যান্স', desc: 'সাইট স্পিড ও অপটিমাইজেশন' },
  { to: '/admin/settings/integrations', icon: Plug, label: 'ইন্টিগ্রেশন', desc: 'Marketing, Courier, Payment, SMS, CAPTCHA' },
  { to: '/admin/settings/payment', icon: Wallet, label: 'পেমেন্ট সেটিংস', desc: 'UddoktaPay, bKash চালু/বন্ধ ও কনফিগারেশন' },
  { to: '/admin/ai-keys', icon: Sparkles, label: 'AI Keys', desc: 'AI provider API keys' },
];

export default function AdminSettings() {
  const navigate = useNavigate();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Settings</h1>
      <p className="text-sm text-muted-foreground mb-6">যে সেকশন এডিট করতে চান সেটি সিলেক্ট করুন।</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SETTINGS_CARDS.map(card => {
          const Icon = card.icon;
          return (
            <button
              key={card.to}
              onClick={() => navigate(card.to)}
              className="border border-border rounded-xl p-6 text-left hover:border-primary hover:shadow-md transition-all bg-card"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-lg">{card.label}</h3>
              <p className="text-sm text-muted-foreground mt-1">{card.desc}</p>
              <p className="text-xs text-primary mt-2">ওপেন করুন →</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
