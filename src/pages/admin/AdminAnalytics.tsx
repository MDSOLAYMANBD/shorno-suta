import { useState, useCallback } from 'react';
import AnalyticsOverview from '@/components/admin/AnalyticsOverview';
import DeliveryCourierAnalytics from '@/components/admin/analytics/DeliveryCourierAnalytics';

export default function AdminAnalytics() {
  const [range, setRange] = useState<{ from: Date; to: Date } | undefined>(undefined);
  const handleRangeChange = useCallback((r: { from: Date; to: Date }) => {
    setRange(prev => (prev && prev.from.getTime() === r.from.getTime() && prev.to.getTime() === r.to.getTime() ? prev : r));
  }, []);
  return (
    <div className="space-y-6">
      <h1 className="text-xl md:text-2xl font-bold">এনালিটিক্স ওভারভিউ</h1>
      <AnalyticsOverview onRangeChange={handleRangeChange} />
      <DeliveryCourierAnalytics dateRange={range} />
    </div>
  );
}
