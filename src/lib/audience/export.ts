// Export utilities for any audience resolved through the Audience Engine.
// All exporters consume the same `AudienceCustomer[]` so the file always
// matches whatever filter the user is previewing on screen.

import type { AudienceCustomer, AudienceFilter } from './types';
import { detectDistrict } from './districts';
import { normalizeBdPhone, dedupePhones } from './helpers';
import { supabase } from '@/integrations/supabase/client';

export type ExportFormat =
  | 'csv'
  | 'excel'
  | 'phones'
  | 'full'
  | 'facebook'
  | 'google';

function triggerDownload(content: string | Blob, filename: string, mime = 'text/plain') {
  const blob = typeof content === 'string' ? new Blob([content], { type: mime }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvEscape(v: any) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows: Record<string, any>[], headers: string[]) {
  const lines = [headers.join(',')];
  for (const r of rows) lines.push(headers.map((h) => csvEscape(r[h])).join(','));
  return lines.join('\n');
}

// Stream every matching customer from the engine query.
// Used by exports only — preview/summary use the engine page APIs.
export async function fetchAudienceForExport(
  filter: AudienceFilter,
): Promise<AudienceCustomer[]> {
  const pageSize = 1000;
  let page = 0;
  const all: AudienceCustomer[] = [];
  const districtsSet = new Set(filter.districts);
  const manualExclude = new Set(filter.manualExclude);

  while (page * pageSize < 50_000) {
    let q: any = supabase
      .from('customers')
      .select('phone, name, address, total_orders, delivered_orders, total_spent, last_order_date');
    for (const id of filter.include) {
      // mirror engine.applyPreset minimally — engine remains the truth.
      if (id === 'vip') q = q.or('delivered_orders.gte.5,total_spent.gte.10000');
      else if (id === 'repeat') q = q.gte('delivered_orders', 2);
      else if (id === 'orders_2_plus') q = q.gte('total_orders', 2);
      else if (id === 'orders_5_plus') q = q.gte('total_orders', 5);
      else if (id === 'high_spend') q = q.gte('total_spent', 5000);
      else if (id === 'low_spend') q = q.lt('total_spent', 1000);
      else if (id === 'inside_dhaka') q = q.ilike('address', '%dhaka%');
      else if (id === 'outside_dhaka') q = q.not('address', 'ilike', '%dhaka%');
    }
    const { data, error } = await q.range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const r of data as any[]) {
      const phone = normalizeBdPhone(r.phone);
      if (!phone || manualExclude.has(phone)) continue;
      const d = detectDistrict(r.address);
      if (districtsSet.size && (!d || !districtsSet.has(d.name))) continue;
      all.push({
        phone,
        name: r.name || '',
        address: r.address || '',
        district: d?.name || null,
        upazila: null,
        area: null,
        total_orders: r.total_orders || 0,
        delivered_orders: r.delivered_orders || 0,
        total_spent: Number(r.total_spent || 0),
        last_order_date: r.last_order_date,
        customer_type:
          (r.delivered_orders || 0) >= 5 ? 'VIP' :
          (r.delivered_orders || 0) >= 2 ? 'Repeat' : 'New',
        tags: [],
      });
    }
    if (data.length < pageSize) break;
    page++;
  }

  // Dedupe by phone (engine produces uniques but exports re-validate).
  const seen = new Set<string>();
  return all.filter((c) => (seen.has(c.phone) ? false : (seen.add(c.phone), true)));
}

export function exportAudience(
  format: ExportFormat,
  customers: AudienceCustomer[],
  filenameBase = 'audience',
) {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const base = `${filenameBase}-${stamp}`;

  switch (format) {
    case 'phones': {
      const text = customers.map((c) => c.phone).join('\n');
      triggerDownload(text, `${base}-phones.txt`, 'text/plain');
      return;
    }
    case 'csv':
    case 'full': {
      const headers = ['phone', 'name', 'district', 'total_orders', 'delivered_orders', 'total_spent', 'last_order_date', 'customer_type', 'address'];
      const csv = toCsv(customers as any, headers);
      triggerDownload(csv, `${base}-${format}.csv`, 'text/csv;charset=utf-8');
      return;
    }
    case 'excel': {
      // Excel-compatible CSV with BOM for Bangla/Unicode names.
      const headers = ['phone', 'name', 'district', 'total_orders', 'delivered_orders', 'total_spent', 'last_order_date'];
      const csv = '\uFEFF' + toCsv(customers as any, headers);
      triggerDownload(csv, `${base}.xls`, 'application/vnd.ms-excel');
      return;
    }
    case 'facebook': {
      // Facebook Custom Audience: phone (E.164 without +), one per row.
      const headers = ['phone', 'fn', 'country'];
      const rows = customers.map((c) => ({
        phone: c.phone,
        fn: (c.name || '').split(/\s+/)[0] || '',
        country: 'BD',
      }));
      const csv = toCsv(rows, headers);
      triggerDownload(csv, `${base}-facebook-CA.csv`, 'text/csv;charset=utf-8');
      return;
    }
    case 'google': {
      // Google Customer Match expects: Phone, First Name, Country
      const headers = ['Phone', 'First Name', 'Country'];
      const rows = customers.map((c) => ({
        Phone: '+' + c.phone,
        'First Name': (c.name || '').split(/\s+/)[0] || '',
        Country: 'BD',
      }));
      const csv = toCsv(rows, headers);
      triggerDownload(csv, `${base}-google-CM.csv`, 'text/csv;charset=utf-8');
      return;
    }
  }
}

// Validation summary used by confirmation dialogs.
export function validateAudience(phones: string[], blacklist: Set<string> = new Set()) {
  const { unique, duplicates, invalid } = dedupePhones(phones);
  const blacklisted = unique.filter((p) => blacklist.has(p)).length;
  const finalList = unique.filter((p) => !blacklist.has(p));
  return { finalList, duplicates, invalid, blacklisted, total: phones.length };
}
