/**
 * Stock Clearance pricing override.
 *
 * When a product has `clearance_active = true` AND a positive `clearance_price`,
 * we override the row so that downstream UI (which already understands the
 * `original_price < price` sale model) treats clearance_price as the effective
 * sale price.
 *
 * - `price` becomes max(original_price, price)  (the compare-at / strikethrough)
 * - `original_price` becomes clearance_price    (the displayed sale price)
 * - `clearance_active` is preserved so UI can show a distinct badge.
 */
export function applyClearance<T extends {
  price?: number | null;
  original_price?: number | null;
  clearance_price?: number | null;
  clearance_active?: boolean | null;
}>(row: T): T {
  try {
    if (!row) return row;
    // Clearance columns may be absent on older cached rows / fallback queries.
    const cp = Number((row as any)?.clearance_price ?? 0);
    const active = (row as any)?.clearance_active === true;
    if (!active || !Number.isFinite(cp) || cp <= 0) return row;

    const basePrice = Number(row.price || 0);
    const origSale = Number(row.original_price || 0);
    const compareAt = origSale > 0 && origSale < basePrice ? basePrice : Math.max(basePrice, origSale);

    if (cp >= compareAt) return row; // no real discount, ignore

    return { ...row, price: compareAt, original_price: cp };
  } catch {
    return row;
  }
}

/**
 * Size-level sale price helper.
 * Keep this available for variant-specific flows, but do not apply it to product
 * listing cards. Storefront cards must show the product-level সেল মূল্য, not the
 * cheapest size variant price.
 */
export function applySizeSalePrice<T extends {
  price?: number | null;
  original_price?: number | null;
  variant_images?: any;
}>(row: T): T {
  try {
    if (!row) return row;
    const sizeData = (row as any)?.variant_images?.size_data;
    if (!sizeData || typeof sizeData !== 'object') return row;
    const sales: number[] = [];
    for (const k of Object.keys(sizeData)) {
      const sp = Number(sizeData[k]?.sale_price || 0);
      if (Number.isFinite(sp) && sp > 0) sales.push(sp);
    }
    if (sales.length === 0) return row;
    const minSale = Math.min(...sales);
    const basePrice = Number(row.price || 0);
    const origSale = Number(row.original_price || 0);
    const currentSale = origSale > 0 && origSale < basePrice ? origSale : basePrice;
    if (minSale >= currentSale) return row;
    const compareAt = Math.max(basePrice, origSale);
    return { ...row, price: compareAt, original_price: minSale } as T;
  } catch {
    return row;
  }
}

export function applyClearanceList<T extends Record<string, any>>(rows: T[] | null | undefined): T[] {
  if (!rows) return [];
  try {
    return rows.map((r) => applyClearance(r as any) as any);
  } catch {
    return rows as T[];
  }
}
