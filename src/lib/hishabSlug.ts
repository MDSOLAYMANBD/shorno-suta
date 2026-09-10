// Helper to build a URL-safe slug for hishab share links.
// Falls back to the provided id (UUID) when the name has no slug-able chars
// (e.g. pure Bengali). Edge function `accounting-memo` accepts either form.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

export function slugifyName(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // drop non-word chars (also drops Bengali)
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Build the URL segment used to identify a unit in /hishab/unit/... */
export function buildUnitSlug(id: string, name?: string | null): string {
  const s = slugifyName(name);
  return s || id;
}

/** Build the URL segment used to identify a person in /hishab/person/... */
export function buildPersonSlug(id: string, code?: string | null): string {
  return (code && code.trim()) || id;
}
