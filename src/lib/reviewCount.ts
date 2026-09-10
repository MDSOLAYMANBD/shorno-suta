// Synthetic review count shown next to product ratings, derived from units
// sold. Ramps 1:1 for the first couple of sales so a brand-new product with
// a single order doesn't already look like it has 3 reviews it hasn't
// earned, then settles into the same 0.3x-of-sales curve used everywhere
// else once a product has enough sales for that curve to feel earned.
export function estimateReviewCount(totalSold: number): number {
  if (!totalSold || totalSold <= 0) return 0;
  return Math.floor(totalSold * 0.3) + Math.min(totalSold, 3);
}
