/**
 * Product CSV import/export helpers.
 * Standalone module — does not modify existing product logic.
 */

export const CSV_COLUMNS = [
  'slug',
  'name',
  'name_bn',
  'description',
  'description_bn',
  'category_name',
  'price',
  'original_price',
  'cost_price',
  'clearance_price',
  'clearance_active',
  'stock',
  'sizes',
  'colors',
  'images',
  'video_url',
  'video_file_url',
  'variant_images_json',
  'addon_config_json',
  'bump_product_slug',
  'bump_discount',
  'product_type',
  'is_active',
  'is_featured',
  'is_hidden_from_shop',
  'allow_pre_order',
  'seo_title',
  'seo_description',
  'seo_keywords',
  'feed_title',
  'feed_description',
] as const;

export type CsvColumn = (typeof CSV_COLUMNS)[number];

const escapeCell = (val: any): string => {
  if (val === null || val === undefined) return '';
  let s = String(val);
  if (/[",\r\n]/.test(s)) {
    s = '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
};

const arrToPipe = (arr: any): string => {
  if (!Array.isArray(arr)) return '';
  return arr.filter((v) => v !== null && v !== undefined && v !== '').join('|');
};

const pipeToArr = (s: string): string[] => {
  if (!s) return [];
  return s.split('|').map((v) => v.trim()).filter(Boolean);
};

/**
 * Build CSV text from product rows.
 * `categoryNameById` maps category_id -> category name for resolving.
 * `bumpSlugById` maps product_id -> slug for bump_product_id reverse lookup.
 */
export function productsToCsv(
  products: any[],
  categoryNameById: Map<string, string>,
  bumpSlugById: Map<string, string>,
): string {
  const lines: string[] = [];
  lines.push(CSV_COLUMNS.join(','));
  for (const p of products) {
    const row: Record<CsvColumn, any> = {
      slug: p.slug,
      name: p.name,
      name_bn: p.name_bn,
      description: p.description,
      description_bn: p.description_bn,
      category_name: p.category_id ? categoryNameById.get(p.category_id) ?? '' : '',
      price: p.price,
      original_price: p.original_price ?? '',
      cost_price: p.cost_price ?? '',
      clearance_price: p.clearance_price ?? '',
      clearance_active: p.clearance_active ? 'true' : 'false',
      stock: p.stock,
      sizes: arrToPipe(p.sizes),
      colors: arrToPipe(p.colors),
      images: arrToPipe(p.images),
      video_url: p.video_url ?? '',
      video_file_url: p.video_file_url ?? '',
      variant_images_json: p.variant_images ? JSON.stringify(p.variant_images) : '',
      addon_config_json: p.addon_config ? JSON.stringify(p.addon_config) : '',
      bump_product_slug: p.bump_product_id ? bumpSlugById.get(p.bump_product_id) ?? '' : '',
      bump_discount: p.bump_discount ?? 0,
      product_type: p.product_type ?? 'regular',
      is_active: p.is_active ? 'true' : 'false',
      is_featured: p.is_featured ? 'true' : 'false',
      is_hidden_from_shop: p.is_hidden_from_shop ? 'true' : 'false',
      allow_pre_order: p.allow_pre_order ? 'true' : 'false',
      seo_title: p.seo_title ?? '',
      seo_description: p.seo_description ?? '',
      seo_keywords: p.seo_keywords ?? '',
      feed_title: p.feed_title ?? '',
      feed_description: p.feed_description ?? '',
    };
    lines.push(CSV_COLUMNS.map((c) => escapeCell(row[c])).join(','));
  }
  // BOM so Excel opens Bangla text correctly.
  return '\uFEFF' + lines.join('\r\n');
}

export function buildSampleCsv(): string {
  return '\uFEFF' + CSV_COLUMNS.join(',') + '\r\n';
}

/**
 * RFC 4180 CSV parser. Handles quoted fields, embedded newlines, escaped quotes.
 * Returns array of row objects keyed by header names.
 */
export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  // Strip BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        cur.push(field);
        field = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        cur.push(field);
        rows.push(cur);
        cur = [];
        field = '';
      } else {
        field += ch;
      }
    }
  }
  if (field.length > 0 || cur.length > 0) {
    cur.push(field);
    rows.push(cur);
  }

  if (rows.length === 0) return { headers: [], rows: [] };
  const headers = rows[0].map((h) => h.trim());
  const dataRows = rows.slice(1).filter((r) => r.some((c) => c.trim() !== ''));
  const out = dataRows.map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (r[idx] ?? '').trim();
    });
    return obj;
  });
  return { headers, rows: out };
}

const parseBool = (v: string | undefined): boolean | undefined => {
  if (v === undefined || v === '') return undefined;
  const s = v.toLowerCase();
  if (['true', '1', 'yes', 'y', 'হ্যাঁ'].includes(s)) return true;
  if (['false', '0', 'no', 'n', 'না'].includes(s)) return false;
  return undefined;
};

const parseNum = (v: string | undefined): number | undefined => {
  if (v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export interface RowValidation {
  index: number;
  slug: string;
  errors: string[];
  warnings: string[];
  payload: Record<string, any>;
}

/**
 * Convert raw CSV row into a payload suitable for products INSERT/UPDATE.
 * Returns errors if required fields are missing or category cannot be resolved.
 * `omitEmpty` controls whether empty cells are skipped (true for UPDATE, false for INSERT defaults).
 */
export function buildProductPayload(
  raw: Record<string, string>,
  index: number,
  categoryIdByName: Map<string, string>,
  productIdBySlug: Map<string, string>,
  isAdmin: boolean,
): RowValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const payload: Record<string, any> = {};

  const slug = (raw.slug || '').trim();
  if (!slug) errors.push('slug missing');

  const set = (key: string, value: any, allowEmpty = false) => {
    if (value === undefined) return;
    if (!allowEmpty && (value === '' || value === null)) return;
    payload[key] = value;
  };

  set('slug', slug || undefined);
  set('name', raw.name?.trim() || undefined);
  set('name_bn', raw.name_bn?.trim() || raw.name?.trim() || undefined);
  set('description', raw.description ?? '', true);
  set('description_bn', raw.description_bn ?? raw.description ?? '', true);

  // Category
  if (raw.category_name && raw.category_name.trim()) {
    const cid = categoryIdByName.get(raw.category_name.trim().toLowerCase());
    if (!cid) errors.push(`unknown category: "${raw.category_name}"`);
    else payload.category_id = cid;
  }

  set('price', parseNum(raw.price));
  set('original_price', parseNum(raw.original_price));
  if (isAdmin) {
    set('cost_price', parseNum(raw.cost_price));
  } else if (raw.cost_price && raw.cost_price.trim()) {
    warnings.push('cost_price skipped (admin only)');
  }
  set('clearance_price', parseNum(raw.clearance_price));
  set('clearance_active', parseBool(raw.clearance_active));
  set('stock', parseNum(raw.stock));

  if (raw.sizes !== undefined) payload.sizes = pipeToArr(raw.sizes);
  if (raw.colors !== undefined) payload.colors = pipeToArr(raw.colors);
  if (raw.images !== undefined) payload.images = pipeToArr(raw.images);

  set('video_url', raw.video_url?.trim() || undefined);
  set('video_file_url', raw.video_file_url?.trim() || undefined);

  if (raw.variant_images_json && raw.variant_images_json.trim()) {
    try {
      payload.variant_images = JSON.parse(raw.variant_images_json);
    } catch {
      errors.push('variant_images_json invalid');
    }
  }
  if (raw.addon_config_json && raw.addon_config_json.trim()) {
    try {
      payload.addon_config = JSON.parse(raw.addon_config_json);
    } catch {
      errors.push('addon_config_json invalid');
    }
  }

  if (raw.bump_product_slug && raw.bump_product_slug.trim()) {
    const bid = productIdBySlug.get(raw.bump_product_slug.trim().toLowerCase());
    if (!bid) warnings.push(`bump_product_slug not found: ${raw.bump_product_slug}`);
    else payload.bump_product_id = bid;
  }
  set('bump_discount', parseNum(raw.bump_discount));

  set('product_type', raw.product_type?.trim() || undefined);
  set('is_active', parseBool(raw.is_active));
  set('is_featured', parseBool(raw.is_featured));
  set('is_hidden_from_shop', parseBool(raw.is_hidden_from_shop));
  set('allow_pre_order', parseBool(raw.allow_pre_order));

  set('seo_title', raw.seo_title ?? '', true);
  set('seo_description', raw.seo_description ?? '', true);
  set('seo_keywords', raw.seo_keywords ?? '', true);
  set('feed_title', raw.feed_title ?? '', true);
  set('feed_description', raw.feed_description ?? '', true);

  return { index, slug, errors, warnings, payload };
}

export function downloadFile(filename: string, content: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
