// Colours and sizes as the page's language shows them (the same as the CORE Shop engine's
// variantLabel): as saved on the Bangla website; on the English one "লাল (Red)" → "Red",
// "মেরুন" → "Maroon", "ফ্রি সাইজ" → "Free size", "৪২" → "42".
import { getLang } from '@/lib/i18n';
import { colorEnglish } from '@/lib/colorSwatch';

const DIGITS = '০১২৩৪৫৬৭৮৯';
const SIZES: Record<string, string> = {
  'ফ্রি সাইজ': 'Free size', 'ফ্রি': 'Free size', 'স্ট্যান্ডার্ড': 'Standard', 'ছোট': 'Small', 'মাঝারি': 'Medium', 'বড়': 'Large',
};

export function variantLabel(value: string): string {
  if (getLang() !== 'en' || !value) return value;
  const both = /^(.+?)\s*\(([^()]+)\)$/.exec(value.trim());
  if (both) return both[2];
  if (!/[ঀ-৿]/.test(value)) return value;
  const size = SIZES[value.trim()];
  if (size) return size;
  const color = colorEnglish(value);
  if (color) return color;
  return value.replace(/[০-৯]/g, (d) => String(DIGITS.indexOf(d)));
}
