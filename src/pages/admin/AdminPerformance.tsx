import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Gauge, Zap, Image, Code2, Globe, Database, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useWebVitals } from '@/hooks/useWebVitals';
import { getPerformanceConfig, setPerformanceConfig, clearAllCaches, type PerformanceConfig } from '@/lib/performanceConfig';
import PerformanceGauge from '@/components/admin/PerformanceGauge';
import WebVitalsCard from '@/components/admin/WebVitalsCard';

export default function AdminPerformance() {
  const queryClient = useQueryClient();
  const vitals = useWebVitals();
  const [config, setConfig] = useState<PerformanceConfig>(getPerformanceConfig);

  const toggle = (key: keyof PerformanceConfig) => {
    const updated = setPerformanceConfig({ [key]: !config[key] });
    setConfig(updated);
    toast.success(`${key} ${updated[key] ? 'চালু' : 'বন্ধ'} করা হয়েছে`);
  };

  const handleClearCache = () => {
    clearAllCaches();
    queryClient.clear();
    toast.success('সকল ক্যাশ মুছে ফেলা হয়েছে');
  };

  const features = [
    {
      key: 'codeSplitting' as const,
      icon: Code2,
      title: 'কোড স্প্লিটিং',
      desc: 'পেজগুলো আলাদা আলাদা লোড হবে, প্রথম লোড দ্রুত হবে',
    },
    {
      key: 'lazyImages' as const,
      icon: Image,
      title: 'ইমেজ লেজি লোডিং',
      desc: 'ছবি স্ক্রলে আসলে তখন লোড হবে, ব্যান্ডউইথ বাঁচবে',
    },
    {
      key: 'dnsPrefetch' as const,
      icon: Globe,
      title: 'DNS প্রিফেচ / প্রিকানেক্ট',
      desc: 'সুপাবেস সার্ভারের সাথে আগে থেকেই কানেকশন তৈরি',
    },
    {
      key: 'cacheOptimization' as const,
      icon: Database,
      title: 'ক্যাশ অপটিমাইজেশন',
      desc: 'স্ট্যাটিক ডেটা ক্যাশ করে বারবার ফেচ কমানো',
    },
    {
      key: 'imageOptimization' as const,
      icon: Zap,
      title: 'ইমেজ অপটিমাইজেশন',
      desc: 'আপলোডের আগে WebP-তে কনভার্ট ও রিসাইজ',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Gauge className="h-6 w-6 text-primary" />
            পারফরম্যান্স
          </h1>
          <p className="text-sm text-muted-foreground mt-1">সাইটের গতি ও অপটিমাইজেশন নিয়ন্ত্রণ</p>
        </div>
      </div>

      {/* Score + Vitals */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card className="lg:row-span-1 flex items-center justify-center">
          <CardContent className="p-6 relative flex items-center justify-center">
            <PerformanceGauge score={vitals.score} />
          </CardContent>
        </Card>

        <WebVitalsCard
          metric={vitals.lcp}
          label="LCP"
          unit="ms"
          description="Largest Contentful Paint — মূল কনটেন্ট লোড সময়"
        />
        <WebVitalsCard
          metric={vitals.cls}
          label="CLS"
          unit=""
          description="Cumulative Layout Shift — লেআউট কতটুকু নড়ে"
        />
        <WebVitalsCard
          metric={vitals.inp}
          label="INP"
          unit="ms"
          description="Interaction to Next Paint — ক্লিক রেসপন্স সময়"
        />
      </div>

      {/* Feature Toggles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">অপটিমাইজেশন ফিচার</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {features.map(f => (
            <div key={f.key} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
              <div className="flex items-center gap-3">
                <f.icon className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="text-sm font-medium">{f.title}</p>
                  <p className="text-xs text-muted-foreground">{f.desc}</p>
                </div>
              </div>
              <Switch
                checked={config[f.key]}
                onCheckedChange={() => toggle(f.key)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Cache Management */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">ক্যাশ ম্যানেজমেন্ট</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button variant="destructive" onClick={handleClearCache} className="gap-2">
            <Trash2 className="h-4 w-4" />
            সকল ক্যাশ মুছুন
          </Button>
          <Button variant="outline" onClick={() => { queryClient.invalidateQueries(); toast.success('ডেটা রিফ্রেশ হচ্ছে...'); }} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            ডেটা রিফ্রেশ
          </Button>
        </CardContent>
      </Card>

      {/* Not Possible Info */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">সার্ভার-লেভেল ফিচার (প্রযোজ্য নয়)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground leading-relaxed">
            এই প্রজেক্ট Vercel-এ হোস্টেড React SPA। তাই Full-page static cache, CDN URL rewrite, Redis,
            HTTP/2-3 config, Browser cache headers, Critical CSS generation — এগুলো সার্ভার-সাইড ফিচার যা
            এখানে প্রযোজ্য নয়। Vite ইতিমধ্যে প্রোডাকশনে CSS/JS minify করে।
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
