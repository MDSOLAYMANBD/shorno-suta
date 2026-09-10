import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import {
  evaluateFreeShipping,
  isCampaignLive,
  type FreeShippingCampaign,
  type EvalCartItem,
} from '@/lib/freeShipping';

interface Props {
  campaigns: FreeShippingCampaign[];
}

interface ParsedLine {
  id: string;
  quantity: number;
  price: number;
}

function parseCart(input: string): ParsedLine[] {
  return input
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const parts = l.split(/[,:\t|]+/).map((p) => p.trim());
      const [id, qty = '1', price = '0'] = parts;
      return {
        id,
        quantity: Math.max(1, parseInt(qty, 10) || 1),
        price: Number(price) || 0,
      };
    })
    .filter((p) => p.id);
}

export function FreeShippingDebugPanel({ campaigns }: Props) {
  const [cartInput, setCartInput] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [liveCart, setLiveCart] = useState<ParsedLine[] | null>(null);

  // Try to load real cart from localStorage as a quick "Load my cart" helper
  function loadFromStorefront() {
    try {
      const raw = localStorage.getItem('cart');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const txt = parsed
        .map((i: any) => `${i.id},${i.quantity || 1},${i.price || 0}`)
        .join('\n');
      setCartInput(txt);
    } catch {}
  }

  const items = useMemo(() => parseCart(cartInput), [cartInput]);
  const productIds = useMemo(() => Array.from(new Set(items.map((i) => i.id))), [items]);

  const [catMap, setCatMap] = useState<Record<string, string | null>>({});
  const [productNames, setProductNames] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    if (productIds.length === 0) {
      setCatMap({});
      setProductNames({});
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, category_id')
        .in('id', productIds);
      if (cancelled || error || !data) return;
      const c: Record<string, string | null> = {};
      const n: Record<string, string> = {};
      data.forEach((p: any) => {
        c[p.id] = p.category_id;
        n[p.id] = p.name;
      });
      setCatMap(c);
      setProductNames(n);
    })();
    return () => {
      cancelled = true;
    };
  }, [productIds.join(',')]);

  const evalItems: EvalCartItem[] = items.map((i) => ({
    product_id: i.id,
    quantity: i.quantity,
    price: i.price,
    category_id: catMap[i.id] ?? null,
  }));

  const result = useMemo(
    () =>
      evaluateFreeShipping(campaigns, {
        items: evalItems,
        appliedCouponCode: couponCode || null,
      }),
    [campaigns, JSON.stringify(evalItems), couponCode],
  );

  const activeCampaigns = campaigns.filter((c) => isCampaignLive(c));
  const totalQty = evalItems.reduce((s, i) => s + i.quantity, 0);
  const totalAmount = evalItems.reduce((s, i) => s + i.price * i.quantity, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">🧪 Debug Cart</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-xs text-muted-foreground">
            Format per line: <code>product_id, quantity, price</code>
          </div>
          <Textarea
            value={cartInput}
            onChange={(e) => setCartInput(e.target.value)}
            placeholder={'b1a2c3...,2,750\nd4e5f6...,1,1200'}
            rows={5}
          />
          <div className="flex gap-2 flex-wrap items-center">
            <Button size="sm" variant="outline" onClick={loadFromStorefront}>
              📥 Load my cart (localStorage)
            </Button>
            <input
              className="px-2 py-1 border rounded text-sm"
              placeholder="Coupon code (optional)"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
            />
            <Badge variant="outline">Items: {items.length}</Badge>
            <Badge variant="outline">Qty: {totalQty}</Badge>
            <Badge variant="outline">Amount: ৳{totalAmount}</Badge>
          </div>
          {items.length > 0 && (
            <div className="text-xs space-y-1 bg-muted/40 rounded p-2">
              {items.map((i, idx) => (
                <div key={idx} className="flex justify-between">
                  <span className="truncate max-w-[60%]">
                    {productNames[i.id] ? `${productNames[i.id]} · ` : ''}
                    <code className="text-[10px]">{i.id.slice(0, 8)}…</code>
                  </span>
                  <span>
                    qty {i.quantity} · ৳{i.price} · cat{' '}
                    <code className="text-[10px]">{(catMap[i.id] || '—').slice(0, 8)}</code>
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">📊 Engine Output</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm mb-3">
            <Stat label="Active campaigns" value={activeCampaigns.length} />
            <Stat
              label="Cart qualifies"
              value={result.applied ? 'YES' : 'NO'}
              tone={result.applied ? 'good' : 'bad'}
            />
            <Stat
              label="Shipping override"
              value={result.applied ? 'APPLIED (৳0)' : 'NOT APPLIED'}
              tone={result.applied ? 'good' : 'bad'}
            />
            <Stat label="Applied campaign" value={result.applied?.name || '—'} />
          </div>

          <div className="space-y-3">
            {campaigns.length === 0 && (
              <div className="text-sm text-muted-foreground">No campaigns at all.</div>
            )}
            {campaigns.map((c) => {
              const e = result.evaluations.find((x) => x.campaign.id === c.id);
              const live = isCampaignLive(c);
              const isApplied = result.applied?.id === c.id;
              return (
                <div
                  key={c.id}
                  className={`border rounded p-3 text-xs ${
                    isApplied ? 'border-green-500 bg-green-50 dark:bg-green-950/30' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-sm">{c.name}</div>
                    <div className="flex gap-1 flex-wrap">
                      <Badge variant={live ? 'default' : 'secondary'}>
                        {live ? 'LIVE' : `not live (${c.status})`}
                      </Badge>
                      {isApplied && <Badge className="bg-green-600">APPLIED</Badge>}
                      {e?.qualified && !isApplied && (
                        <Badge variant="outline">qualified (lower priority)</Badge>
                      )}
                    </div>
                  </div>
                  <Row k="Rule type" v={c.rule_type} />
                  <Row
                    k="Required quantity"
                    v={c.min_quantity != null ? String(c.min_quantity) : '—'}
                  />
                  <Row
                    k="Current quantity (matched)"
                    v={e ? String(e.matchedQuantity) : '0'}
                  />
                  <Row
                    k="Required amount"
                    v={c.min_amount != null ? `৳${c.min_amount}` : '—'}
                  />
                  <Row
                    k="Current amount (matched)"
                    v={e ? `৳${e.matchedSubtotal}` : '৳0'}
                  />
                  <Row
                    k="Matching categories"
                    v={
                      c.applicable_category_ids.length === 0
                        ? 'ALL (no filter)'
                        : c.applicable_category_ids.join(', ')
                    }
                  />
                  <Row
                    k="Matching products"
                    v={
                      c.applicable_product_ids.length === 0
                        ? 'ALL (no filter)'
                        : c.applicable_product_ids.join(', ')
                    }
                  />
                  <Row
                    k="Coupon required"
                    v={c.coupon_code || '—'}
                  />
                  <Row k="Priority" v={String(c.priority)} />
                  <Row
                    k="Progress"
                    v={e ? `${Math.round(e.progress * 100)}%` : '0%'}
                  />
                  <Row
                    k="Missing qty / amount"
                    v={e ? `${e.missingQty} items · ৳${e.missingAmount}` : '—'}
                  />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: 'good' | 'bad';
}) {
  return (
    <div
      className={`rounded border p-2 ${
        tone === 'good'
          ? 'border-green-500 bg-green-50 dark:bg-green-950/30'
          : tone === 'bad'
          ? 'border-red-300 bg-red-50 dark:bg-red-950/30'
          : ''
      }`}
    >
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-semibold text-sm">{value}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2 py-0.5 border-b border-dashed last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-mono text-right break-all">{v}</span>
    </div>
  );
}
