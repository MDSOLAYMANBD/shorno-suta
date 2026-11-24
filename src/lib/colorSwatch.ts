// Colour names to their colours, for the colour dots on product cards (CardColorSwatches)
// and the admin's product list (ProductColorDots).
import { getColorPrimaryImage, type ColorImagesMap } from '@/lib/productVariants';

// The same colours as CORE Shop's engine (store-engine/src/lib/variantPresets.ts):
// Bangla and English names and common spellings. A saved colour like "লাল (Red)",
// "হালকা গোলাপি" or "Navy" finds its colour; an unknown name finds none.

const COLORS: Array<[string, string[]]> = [
  ['#DC2626', ['লাল', 'red', 'lal']],
  ['#7F1D1D', ['মেরুন', 'maroon']],
  ['#EC4899', ['গোলাপি', 'pink', 'golapi']],
  ['#F9A8D4', ['বেবি পিংক', 'baby pink']],
  ['#C2185B', ['ড্রাগন', 'dragon', 'dragon fruit', 'magenta pink']],
  ['#C026D3', ['ম্যাজেন্টা', 'magenta']],
  ['#C98B8B', ['অনিয়ন', 'onion', 'onion pink', 'পেঁয়াজ']],
  ['#FDBA8C', ['পিচ', 'peach']],
  ['#F87171', ['কোরাল', 'coral']],
  ['#7C3AED', ['বেগুনি', 'purple', 'violet', 'বেগুনী']],
  ['#C4B5FD', ['ল্যাভেন্ডার', 'lavender']],
  ['#2563EB', ['নীল', 'blue', 'nil']],
  ['#38BDF8', ['আকাশি', 'sky blue', 'akashi', 'আকাশী']],
  ['#1D4ED8', ['রয়্যাল ব্লু', 'royal blue']],
  ['#1E3A8A', ['নেভি ব্লু', 'navy blue', 'navy', 'নেভি']],
  ['#2DD4BF', ['ফিরোজা', 'turquoise', 'firoza']],
  ['#0F766E', ['পেস্ট', 'teal', 'paste', 'পেস্ট কালার']],
  ['#99F6E4', ['মিন্ট', 'mint']],
  ['#16A34A', ['সবুজ', 'green', 'sobuj']],
  ['#84CC16', ['টিয়া', 'parrot green', 'tia', 'টিয়া সবুজ']],
  ['#65A30D', ['কলাপাতা', 'leaf green', 'kolapata', 'banana leaf']],
  ['#14532D', ['বোতল সবুজ', 'bottle green']],
  ['#6B7234', ['জলপাই', 'olive', 'jolpai', 'olive green']],
  ['#FACC15', ['হলুদ', 'yellow', 'holud']],
  ['#FDE047', ['লেমন', 'lemon']],
  ['#CA8A04', ['মাস্টার্ড', 'mustard', 'সরিষা']],
  ['#F97316', ['কমলা', 'orange', 'komla']],
  ['#EA580C', ['গাজরি', 'carrot', 'gajori', 'carrot orange']],
  ['#92400E', ['খয়েরি', 'brown', 'khoyeri', 'বাদামি', 'বাদামী']],
  ['#5B3A29', ['চকলেট', 'chocolate']],
  ['#6F4E37', ['কফি', 'coffee']],
  ['#E3C9A0', ['বিস্কুট', 'biscuit', 'beige', 'বেইজ']],
  ['#E0B19B', ['ন্যুড', 'nude']],
  ['#FFF4D6', ['ক্রিম', 'cream']],
  ['#F5F5EC', ['অফ হোয়াইট', 'off white']],
  ['#FFFFFF', ['সাদা', 'white', 'sada']],
  ['#9CA3AF', ['ধূসর', 'grey', 'gray', 'ash', 'ছাই', 'অ্যাশ']],
  ['#111111', ['কালো', 'black', 'kalo']],
  ['#D4AF37', ['সোনালি', 'golden', 'gold', 'সোনালী']],
  ['#C0C0C0', ['রুপালি', 'silver', 'রুপালী']],
  ['#B87333', ['কপার', 'copper', 'তামা']],

];

const NAMES = new Map<string, string>();
for (const [hex, names] of COLORS) for (const n of names) NAMES.set(n, hex);

const clean = (s: string) => s.toLowerCase().replace(/[()[\],/|_-]+/g, ' ').replace(/\s+/g, ' ').trim();

export function colorHex(value: string): string | undefined {
  const v = clean(value);
  if (!v) return undefined;
  if (NAMES.has(v)) return NAMES.get(v);
  // "লাল (Red)" → "লাল", "red"; "হালকা গোলাপি" → its last known word
  const parts = value.split(/[()]/).map(clean).filter(Boolean);
  for (const p of parts) if (NAMES.has(p)) return NAMES.get(p);
  const words = v.split(' ');
  for (let len = words.length - 1; len >= 1; len--) {
    for (let i = words.length - len; i >= 0; i--) {
      const hex = NAMES.get(words.slice(i, i + len).join(' '));
      if (hex) return hex;
    }
  }
  return undefined;
}

/** A colour's English name ("মেরুন" → "Maroon", "হালকা গোলাপি" → "Light pink"); undefined when unknown. */
export function colorEnglish(value: string): string | undefined {
  const english = (bn: string) => {
    const hit = COLORS.find(([, names]) => names.includes(bn));
    const en = hit?.[1].find((n) => !/[\u0980-\u09FF]/.test(n));
    return en ? en.charAt(0).toUpperCase() + en.slice(1) : undefined;
  };
  const v = clean(value);
  if (!v) return undefined;
  const whole = english(v);
  if (whole) return whole;
  // a shade before a colour: হালকা (light) / গাঢ় (dark) / ডিপ (deep)
  const shade = /^(হালকা|লাইট|গাঢ়|গাঢ|ডার্ক|ডিপ)\s+(.+)$/.exec(v);
  if (shade) {
    const base = english(shade[2]);
    const word = /^(হালকা|লাইট)$/.test(shade[1]) ? 'Light' : /^ডিপ$/.test(shade[1]) ? 'Deep' : 'Dark';
    if (base) return `${word} ${base.toLowerCase()}`;
  }
  return undefined;
}

const UNKNOWN = 'conic-gradient(#ef4444, #f59e0b, #22c55e, #3b82f6, #a855f7, #ef4444)';

/** A colour's dot: its own photo when it has one, over the colour itself (or a rainbow). */
export function swatchOf(color: string, colorImages?: ColorImagesMap): { photo: string | null; background: string } {
  return { photo: getColorPrimaryImage(colorImages, color), background: colorHex(color) || UNKNOWN };
}
