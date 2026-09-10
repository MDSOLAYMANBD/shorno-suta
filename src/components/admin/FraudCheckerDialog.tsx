import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, ShieldAlert, ShieldCheck, ShieldQuestion, AlertTriangle, CheckCircle, Calendar, MapPin, User, Truck, RefreshCw, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';
import { toast } from 'sonner';
import type { CourierBreakdown } from '@/hooks/useBDCourierCache';

export type RiskLevel = 'safe' | 'warning' | 'high-risk' | 'new';

export interface FraudAnalysis {
  riskLevel: RiskLevel;
  reasons: string[];
  totalOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  cancelRate: number;
  totalSpent: number;
  uniqueNames: string[];
  uniqueAddresses: string[];
  sameDayOrders: boolean;
}

export function analyzeCustomer(phone: string, allOrders: any[]): FraudAnalysis {
  const orders = allOrders.filter(o => o.customer_phone === phone);
  const total = orders.length;
  const delivered = orders.filter(o => o.status === 'delivered').length;
  const cancelled = orders.filter(o => o.status === 'cancelled').length;
  const cancelRate = total > 0 ? cancelled / total : 0;
  const totalSpent = orders.reduce((sum: number, o: any) => sum + (o.total || 0), 0);

  const uniqueNames = [...new Set(orders.map(o => o.customer_name?.trim()).filter(Boolean))] as string[];
  const uniqueAddresses = [...new Set(orders.map(o => o.customer_address?.trim()).filter(Boolean))] as string[];

  const dateGroups: Record<string, number> = {};
  orders.forEach(o => {
    const day = o.created_at?.substring(0, 10);
    if (day) dateGroups[day] = (dateGroups[day] || 0) + 1;
  });
  const sameDayOrders = Object.values(dateGroups).some(c => c > 1);

  const diffNames = uniqueNames.length > 1;
  const reasons: string[] = [];

  if (total <= 1) {
    return { riskLevel: 'new', reasons: ['নতুন কাস্টমার — কোনো হিস্ট্রি নেই'], totalOrders: total, deliveredOrders: delivered, cancelledOrders: cancelled, cancelRate, totalSpent, uniqueNames, uniqueAddresses, sameDayOrders };
  }

  if (cancelRate > 0.5) reasons.push(`বাতিল হার ${Math.round(cancelRate * 100)}% (${cancelled}/${total})`);
  if (diffNames) reasons.push(`ভিন্ন নাম ব্যবহার করেছেন: ${uniqueNames.join(', ')}`);
  if (sameDayOrders) reasons.push('একই দিনে একাধিক অর্ডার করেছেন');
  if (cancelRate > 0.3 && cancelRate <= 0.5) reasons.push(`বাতিল হার ${Math.round(cancelRate * 100)}%`);

  let riskLevel: RiskLevel = 'new';
  if (cancelRate > 0.5 || diffNames) riskLevel = 'high-risk';
  else if (cancelRate > 0.3 || sameDayOrders) riskLevel = 'warning';
  else if (delivered > 0) riskLevel = 'safe';

  if (riskLevel === 'safe') reasons.push(`${delivered}টি সফল ডেলিভারি আছে`);

  return { riskLevel, reasons, totalOrders: total, deliveredOrders: delivered, cancelledOrders: cancelled, cancelRate, totalSpent, uniqueNames, uniqueAddresses, sameDayOrders };
}

export const riskConfig: Record<RiskLevel, { color: string; bg: string; label: string; icon: typeof Shield }> = {
  'safe': { color: 'text-green-600', bg: 'bg-green-500', label: 'নিরাপদ', icon: ShieldCheck },
  'warning': { color: 'text-yellow-600', bg: 'bg-yellow-500', label: 'সতর্কতা', icon: ShieldAlert },
  'high-risk': { color: 'text-red-600', bg: 'bg-red-500', label: 'ঝুঁকিপূর্ণ', icon: ShieldAlert },
  'new': { color: 'text-gray-400', bg: 'bg-gray-400', label: 'নতুন', icon: ShieldQuestion },
};

interface CourierCacheResult {
  successRate: number | null;
  totalParcel: number;
  successParcel: number;
  cancelledParcel: number;
  courierBreakdown?: CourierBreakdown[];
  status: 'loading' | 'success' | 'error' | 'no-data';
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phone: string;
  allOrders: any[];
  courierCache?: CourierCacheResult | null;
  onRefresh?: (phone: string) => Promise<void>;
}

const statusLabel: Record<string, string> = {
  pending: 'পেন্ডিং', confirmed: 'কনফার্মড', hold: 'হোল্ড',
  shipped: 'শিপড', delivered: 'ডেলিভার্ড', cancelled: 'বাতিল',
};

const statusDot: Record<string, string> = {
  pending: 'bg-yellow-500', confirmed: 'bg-blue-500', hold: 'bg-orange-500',
  shipped: 'bg-purple-500', delivered: 'bg-green-500', cancelled: 'bg-red-500',
};

export default function FraudCheckerDialog({ open, onOpenChange, phone, allOrders, courierCache, onRefresh }: Props) {
  const [refreshing, setRefreshing] = useState(false);
  const analysis = analyzeCustomer(phone, allOrders);
  const customerOrders = allOrders.filter(o => o.customer_phone === phone).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const config = riskConfig[analysis.riskLevel];
  const RiskIcon = config.icon;

  const handleRefresh = async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try { await onRefresh(phone); } catch (e: any) { toast.error(`ফ্রড চেক ব্যর্থ: ${e.message || 'অজানা সমস্যা'}`); }
    setRefreshing(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="flex items-center gap-2">
              <RiskIcon className={`h-5 w-5 ${config.color}`} />
              ফ্রড চেকার — {phone}
            </DialogTitle>
            {onRefresh && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2.5 text-xs gap-1.5 font-medium"
                disabled={refreshing}
                onClick={handleRefresh}
              >
                {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                রিফ্রেশ
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Risk Badge */}
        <div className={`flex items-center gap-2 p-3 rounded-lg ${
          analysis.riskLevel === 'high-risk' ? 'bg-red-50 border border-red-200' :
          analysis.riskLevel === 'warning' ? 'bg-yellow-50 border border-yellow-200' :
          analysis.riskLevel === 'safe' ? 'bg-green-50 border border-green-200' :
          'bg-muted border border-border'
        }`}>
          <RiskIcon className={`h-6 w-6 ${config.color}`} />
          <div>
            <p className={`font-bold ${config.color}`}>{config.label}</p>
            {analysis.reasons.map((r, i) => (
              <p key={i} className="text-xs text-muted-foreground flex items-center gap-1">
                {analysis.riskLevel === 'high-risk' ? <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" /> :
                 analysis.riskLevel === 'warning' ? <AlertTriangle className="h-3 w-3 text-yellow-500 shrink-0" /> :
                 analysis.riskLevel === 'safe' ? <CheckCircle className="h-3 w-3 text-green-500 shrink-0" /> :
                 <ShieldQuestion className="h-3 w-3 text-gray-400 shrink-0" />}
                {r}
              </p>
            ))}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'মোট অর্ডার', value: analysis.totalOrders, color: 'text-foreground' },
            { label: 'ডেলিভার্ড', value: analysis.deliveredOrders, color: 'text-green-600' },
            { label: 'বাতিল', value: analysis.cancelledOrders, color: 'text-red-600' },
            { label: 'মোট খরচ', value: `৳${analysis.totalSpent}`, color: 'text-primary' },
          ].map(s => (
            <div key={s.label} className="text-center p-2 bg-muted/50 rounded-lg">
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* BD Courier History */}
        <div className="space-y-2">
          <p className="text-xs font-semibold flex items-center gap-1"><Truck className="h-3 w-3" /> কুরিয়ার হিস্ট্রি (BD Courier)</p>
          {courierCache?.status === 'success' ? (
            <div className="space-y-3">
              {/* Summary */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'মোট পার্সেল', value: courierCache.totalParcel, color: 'text-foreground' },
                  { label: 'সফল', value: courierCache.successParcel, color: 'text-green-600' },
                  { label: 'বাতিল', value: courierCache.cancelledParcel, color: 'text-red-600' },
                  { label: 'সাকসেস রেট', value: courierCache.successRate != null ? `${courierCache.successRate}%` : 'N/A', color: 'text-primary' },
                ].map(s => (
                  <div key={s.label} className="text-center p-2 bg-blue-50 rounded-lg border border-blue-100">
                    <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-[10px] text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Courier-wise Breakdown */}
              {courierCache.courierBreakdown && courierCache.courierBreakdown.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium text-muted-foreground">কুরিয়ার-ওয়াইজ ব্রেকডাউন</p>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="text-left p-1.5 font-medium">কুরিয়ার</th>
                          <th className="text-center p-1.5 font-medium">মোট</th>
                          <th className="text-center p-1.5 font-medium">সফল</th>
                          <th className="text-center p-1.5 font-medium">বাতিল</th>
                          <th className="text-center p-1.5 font-medium">রেট</th>
                        </tr>
                      </thead>
                      <tbody>
                        {courierCache.courierBreakdown.map(c => (
                          <tr key={c.key} className="border-t">
                            <td className="p-1.5">
                              <div className="flex items-center gap-1.5">
                                {c.logo && <img src={c.logo} alt={c.name} className="w-4 h-4 object-contain rounded" />}
                                <span className="font-medium">{c.name}</span>
                              </div>
                            </td>
                            <td className="p-1.5 text-center">{c.totalParcel}</td>
                            <td className="p-1.5 text-center text-green-600 font-medium">{c.successParcel}</td>
                            <td className="p-1.5 text-center text-red-600 font-medium">{c.cancelledParcel}</td>
                            <td className="p-1.5 text-center">
                              <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                c.successRate >= 70 ? 'bg-green-100 text-green-800' :
                                c.successRate >= 40 ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {c.successRate}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : courierCache?.status === 'error' ? (
            <p className="text-xs text-red-500 bg-red-50 p-2 rounded">কুরিয়ার ডাটা লোড হয়নি</p>
          ) : courierCache?.status === 'loading' ? (
            <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">লোড হচ্ছে...</p>
          ) : (
            <div className="flex items-center justify-between bg-muted/50 p-2 rounded">
              <p className="text-xs text-muted-foreground">কুরিয়ার ডাটা নেই</p>
              {onRefresh && (
                <Button variant="outline" size="sm" className="h-6 px-2 text-[10px] gap-1" disabled={refreshing} onClick={handleRefresh}>
                  {refreshing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  লোড করুন
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Used Names & Addresses */}
        {analysis.uniqueNames.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold flex items-center gap-1"><User className="h-3 w-3" /> ব্যবহৃত নাম</p>
            <div className="flex flex-wrap gap-1">
              {analysis.uniqueNames.map(n => <Badge key={n} variant="outline" className="text-xs">{n}</Badge>)}
            </div>
          </div>
        )}
        {analysis.uniqueAddresses.length > 1 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold flex items-center gap-1"><MapPin className="h-3 w-3" /> ব্যবহৃত ঠিকানা</p>
            <div className="space-y-0.5">
              {analysis.uniqueAddresses.map(a => <p key={a} className="text-xs text-muted-foreground">• {a}</p>)}
            </div>
          </div>
        )}

        {/* Order History */}
        <div className="space-y-1">
          <p className="text-xs font-semibold flex items-center gap-1"><Calendar className="h-3 w-3" /> অর্ডার হিস্ট্রি</p>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left p-2 font-medium">অর্ডার</th>
                  <th className="text-left p-2 font-medium">তারিখ</th>
                  <th className="text-right p-2 font-medium">মোট</th>
                  <th className="text-center p-2 font-medium">স্ট্যাটাস</th>
                </tr>
              </thead>
              <tbody>
                {customerOrders.map(o => (
                  <tr key={o.id} className="border-t">
                    <td className="p-2 font-medium">{o.order_number}</td>
                    <td className="p-2 text-muted-foreground">{format(new Date(o.created_at), 'dd MMM yyyy', { locale: bn })}</td>
                    <td className="p-2 text-right font-medium">৳{o.total}</td>
                    <td className="p-2 text-center">
                      <span className="inline-flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${statusDot[o.status] || 'bg-gray-400'}`} />
                        {statusLabel[o.status] || o.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
