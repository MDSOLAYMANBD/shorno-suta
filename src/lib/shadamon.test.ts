import { describe, expect, it } from 'vitest';
import {
  fitToCollect, mentionsShadamon, shadamonArea, shadamonStatus, swapBrand,
} from '../../supabase/functions/_shared/shadamon';

describe('Shadamon order states', () => {
  it('speaks the courier words the order status understands', () => {
    expect(shadamonStatus('pending')).toBe('in_review');
    expect(shadamonStatus('confirmed')).toBe('in_review');
    expect(shadamonStatus('with_courier')).toBe('in_review');
    expect(shadamonStatus('shipped')).toBe('pending');
    expect(shadamonStatus('on_hold')).toBe('hold');
    expect(shadamonStatus('delivered')).toBe('delivered');
    expect(shadamonStatus('partially_delivered')).toBe('partial_delivered');
    expect(shadamonStatus('returned')).toBe('cancelled');
    expect(shadamonStatus('cancelled')).toBeNull();
    expect(shadamonStatus('something new')).toBeUndefined();
  });
});

describe('Shadamon delivery areas', () => {
  it('keeps the original three and reads the shop’s own by name', () => {
    expect(shadamonArea('dhaka_suburb')).toBe('dhaka_suburb');
    expect(shadamonArea('z1', 'ঢাকা সিটি')).toBe('dhaka_inside');
    expect(shadamonArea('z2', 'ঢাকার বাইরে')).toBe('dhaka_outside');
    expect(shadamonArea('z3', 'সাব-এরিয়া (সাভার, গাজীপুর)')).toBe('dhaka_suburb');
    expect(shadamonArea('z4', 'চট্টগ্রাম')).toBe('dhaka_outside');
  });
});

describe('fitting an order to what the customer pays', () => {
  const total = (units: number[], qty: number[], delivery: number) => units.reduce((s, u, i) => s + u * qty[i], 0) + delivery;

  it('changes nothing when the shop charged what Shadamon does', () => {
    const r = fitToCollect([{ unitPrice: 2400, quantity: 2, minPrice: 2200 }], 70, 4870);
    expect(r).toEqual({ ok: true, unitPrices: [2400], total: 4870, short: 0 });
  });

  it('puts a higher delivery charge of the shop into the price (more profit)', () => {
    const r = fitToCollect([{ unitPrice: 2400, quantity: 1, minPrice: 2200 }], 70, 2400 + 120);
    expect(r).toEqual({ ok: true, unitPrices: [2450], total: 2520, short: 0 });
  });

  it('takes a discount and an advance off the prices, spread by price', () => {
    const lines = [
      { unitPrice: 1500, quantity: 1, minPrice: 1200 },
      { unitPrice: 500, quantity: 2, minPrice: 400 },
    ];
    const r = fitToCollect(lines, 70, 2500 + 70 - 300);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(total(r.unitPrices, [1, 2], 70)).toBe(2270);
    expect(r.short).toBe(0);
    r.unitPrices.forEach((u, i) => expect(u).toBeGreaterThanOrEqual(lines[i].minPrice));
  });

  it('never asks the customer for more, when whole taka cannot match', () => {
    // only lines of 2: an odd difference cannot be matched exactly
    const r = fitToCollect([{ unitPrice: 1000, quantity: 2, minPrice: 800 }], 70, 2000 + 70 - 15);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.total).toBeLessThanOrEqual(2055);
    expect(r.short).toBe(1);
  });

  it('refuses below Shadamon’s prices and says the least', () => {
    expect(fitToCollect([{ unitPrice: 2400, quantity: 1, minPrice: 2200 }], 70, 2000)).toEqual({ ok: false, least: 2270 });
    expect(fitToCollect([], 70, 500)).toEqual({ ok: false, least: 70 });
  });

  it('keeps every line at Shadamon’s price at least when the cut is large', () => {
    const lines = [
      { unitPrice: 3000, quantity: 1, minPrice: 2900 },
      { unitPrice: 1000, quantity: 1, minPrice: 500 },
    ];
    const r = fitToCollect(lines, 100, 3500);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.unitPrices[0]).toBeGreaterThanOrEqual(2900);
    expect(r.unitPrices[1]).toBeGreaterThanOrEqual(500);
    expect(r.total).toBe(3500);
  });
});

describe('Shadamon’s name in product text', () => {
  it('finds it in Bangla and English', () => {
    expect(mentionsShadamon('Shadamon Shop exclusive')).toBe(true);
    expect(mentionsShadamon('সাদামন শপের নিজস্ব ডিজাইন')).toBe(true);
    expect(mentionsShadamon('visit shadamonshop.com')).toBe(true);
    expect(mentionsShadamon('Pure cotton saree')).toBe(false);
    // the same answer twice (no regex state left behind)
    expect(mentionsShadamon('Shadamon')).toBe(true);
    expect(mentionsShadamon('Shadamon')).toBe(true);
  });

  it('swaps it for the shop’s name in the same script', () => {
    expect(swapBrand('Shadamon Shop exclusive', 'রূপকথা', 'Rupkotha')).toBe('Rupkotha exclusive');
    expect(swapBrand('সাদামন শপের নিজস্ব, সাদামন শপ গ্যারান্টি', 'রূপকথা', 'Rupkotha')).toBe('রূপকথা-এর নিজস্ব, রূপকথা গ্যারান্টি');
  });
});
