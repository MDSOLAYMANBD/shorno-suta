import { describe, expect, it } from 'vitest';
import { orderPieces } from './OrderQtyBadge';

describe('orderPieces', () => {
  it("adds up every item's quantity", () => {
    expect(orderPieces([{ quantity: 1 }, { quantity: 1 }, { quantity: 2 }])).toBe(4);
  });
  it('counts nothing for missing or broken quantities', () => {
    expect(orderPieces(undefined)).toBe(0);
    expect(orderPieces([{ quantity: null }, { quantity: 3 }])).toBe(3);
  });
});
