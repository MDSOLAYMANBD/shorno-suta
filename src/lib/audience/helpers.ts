// Phone normalization, dedupe, SMS-parts calculator.

const GSM7 = /^[A-Za-z0-9 @£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ!"#¤%&'()*+,\-./:;<=>?¡ÄÖÑÜ§¿äöñüà^{}\\[~\]|€]*$/;

export function normalizeBdPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let p = String(raw).replace(/[\s\-+()]/g, '');
  if (!p) return null;
  if (p.startsWith('88')) p = p.slice(2);
  if (p.startsWith('0')) p = p.slice(1);
  if (!/^1[3-9]\d{8}$/.test(p)) return null;
  return '880' + p;
}

export function dedupePhones(phones: (string | null | undefined)[]): {
  unique: string[];
  duplicates: number;
  invalid: number;
} {
  const seen = new Set<string>();
  let duplicates = 0;
  let invalid = 0;
  for (const raw of phones) {
    const n = normalizeBdPhone(raw);
    if (!n) { invalid++; continue; }
    if (seen.has(n)) { duplicates++; continue; }
    seen.add(n);
  }
  return { unique: Array.from(seen), duplicates, invalid };
}

// Same as dedupePhones, but also returns per-phone duplicate groups
// so callers can show "this number appeared N times" with associated names.
export function dedupePhonesWithGroups<T extends { phone: string; name?: string; matchedBy?: string[] }>(
  rows: T[],
): {
  unique: T[];
  invalid: number;
  duplicateGroups: Array<{ phone: string; count: number; names: string[]; matched: string[] }>;
} {
  const seen = new Map<string, { row: T; names: Set<string>; matched: Set<string>; count: number }>();
  let invalid = 0;
  for (const r of rows) {
    const n = normalizeBdPhone(r.phone);
    if (!n) { invalid++; continue; }
    const existing = seen.get(n);
    if (existing) {
      existing.count++;
      if (r.name) existing.names.add(r.name);
      for (const m of r.matchedBy || []) existing.matched.add(m);
    } else {
      const names = new Set<string>(); if (r.name) names.add(r.name);
      const matched = new Set<string>(r.matchedBy || []);
      seen.set(n, { row: { ...r, phone: n }, names, matched, count: 1 });
    }
  }
  const unique: T[] = [];
  const duplicateGroups: Array<{ phone: string; count: number; names: string[]; matched: string[] }> = [];
  for (const [phone, v] of seen) {
    unique.push(v.row);
    if (v.count > 1) {
      duplicateGroups.push({
        phone, count: v.count,
        names: Array.from(v.names),
        matched: Array.from(v.matched),
      });
    }
  }
  return { unique, invalid, duplicateGroups };
}

// Standard SMS part calculation: GSM-7 → 160/153, Unicode → 70/67
export function smsParts(message: string): number {
  if (!message) return 0;
  const isGsm = GSM7.test(message);
  const len = message.length;
  if (isGsm) {
    if (len <= 160) return 1;
    return Math.ceil(len / 153);
  }
  if (len <= 70) return 1;
  return Math.ceil(len / 67);
}

export function estimateSmsCost(parts: number, recipients: number, perPartRate = 0.4) {
  return parts * recipients * perPartRate;
}
