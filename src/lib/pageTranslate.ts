// The admin, and the website's texts still written only in Bangla, in English. The pages are
// written in Bangla; while one is in English this swaps each Bangla text on the page for its
// English and keeps doing so as pages change. Numbers turn to 0-9, dates and "৩ দিন আগে" to
// English. A text with no English yet stays Bangla. Back to বাংলা puts every text back.
//  - admin (admin → ভাষা → EN): the CORE Shop engine's admin words (admin-en/*) and this
//    shop's own (admin-en/shopWords.ts).
//  - site (the website's বাং | EN): most of the website writes both languages itself
//    (lib/i18n.ts); this covers the rest with Shadamon Shop's and the engine's website texts
//    (site-en/shopPairs.ts, the same pages) and the shop's known texts (lib/i18nKnown.ts).
//
// Never translated: what customers get (the printed memos: .print-invoice-wrapper, and
// anything marked translate="no"), and what is being typed (inputs, textareas, editors).

type Dict = Map<string, string>;
/** Texts with a value inside: the Bangla as a pattern, the English with $1, $2 … */
type Pattern = { re: RegExp; en: string };
/** known: the shop's own texts (lib/i18n.ts knownIn: its name inside, an emoji around …). */
type Words = { dict: Dict; patterns: Pattern[]; known?: (text: string) => string | undefined };
export type PageKind = 'admin' | 'site';

const BANGLA = /[ঀ-৿]/;
/** Bangla letters and signs (not the digits ০-৯ or ৳). */
const BN_LETTER = /[অ-ৣ]/;
/** Nothing inside is translated (customers' memos, code). */
const NO_TRANSLATE = '[translate="no"],.notranslate,.print-invoice-wrapper,script,style,noscript';
/** Text being typed or edited keeps its words (its placeholder is still translated). */
const KEEP_TEXT = 'textarea,code,pre,[contenteditable=""],[contenteditable="true"]';
const SKIP_TEXT = `${NO_TRANSLATE},${KEEP_TEXT}`;
const ATTRS = ['placeholder', 'title', 'aria-label'];

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
const toAscii = (s: string) => s.replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 0x09e6));
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Single words in dates, times and counts ("২৩ নভেম্বর ২০২৬", "প্রায় ২ ঘণ্টা আগে", "৫টি").
const TOKENS: Record<string, string> = {
  'জানুয়ারি': 'January', 'জানুয়ারী': 'January', 'ফেব্রুয়ারি': 'February', 'ফেব্রুয়ারী': 'February',
  'মার্চ': 'March', 'এপ্রিল': 'April', 'মে': 'May', 'জুন': 'June', 'জুলাই': 'July', 'আগস্ট': 'August',
  'আগষ্ট': 'August', 'সেপ্টেম্বর': 'September', 'অক্টোবর': 'October', 'নভেম্বর': 'November',
  'ডিসেম্বর': 'December',
  'জানু': 'Jan', 'ফেব্রু': 'Feb', 'সেপ্টে': 'Sep', 'অক্টো': 'Oct', 'নভে': 'Nov', 'ডিসে': 'Dec',
  'রবিবার': 'Sunday', 'সোমবার': 'Monday', 'মঙ্গলবার': 'Tuesday', 'বুধবার': 'Wednesday',
  'বৃহস্পতিবার': 'Thursday', 'শুক্রবার': 'Friday', 'শনিবার': 'Saturday',
  'রবি': 'Sun', 'সোম': 'Mon', 'মঙ্গল': 'Tue', 'বুধ': 'Wed', 'বৃহঃ': 'Thu', 'বৃহস্পতি': 'Thu', 'শুক্র': 'Fri', 'শনি': 'Sat',
  'সেকেন্ড': 'seconds', 'মিনিট': 'minutes', 'মিনিটের': 'minute', 'ঘণ্টা': 'hours', 'ঘন্টা': 'hours',
  'দিন': 'days', 'সপ্তাহ': 'weeks', 'মাস': 'months', 'বছর': 'years',
  'আগে': 'ago', 'পরে': 'later', 'প্রায়': 'about', 'কম': 'less than', 'বেশি': 'more than', 'মধ্যে': 'within',
  'টি': '', 'টা': '', 'জন': 'people', 'পিস': 'pcs', 'টাকা': 'Tk', 'বার': 'times',
  'পূর্বাহ্ন': 'AM', 'অপরাহ্ন': 'PM', 'সকাল': 'morning', 'দুপুর': 'noon', 'বিকাল': 'afternoon', 'সন্ধ্যা': 'evening', 'রাত': 'night',
  'আজ': 'today', 'গতকাল': 'yesterday', 'আগামীকাল': 'tomorrow',
  'ও': 'and', 'এবং': 'and', 'থেকে': 'from', 'পর্যন্ত': 'to',
};

/** The English of a text when we know it, else undefined. */
function lookup(text: string, words: Words, depth = 0): string | undefined {
  const t = norm(text);
  if (!t) return t;
  const hit = words.dict.get(t) ?? words.known?.(t);
  if (hit !== undefined) return hit;
  if (depth > 2) return undefined;

  // a list in one line ("স্বাগতম 🌸 | অগ্রিম টাকা লাগে না | …"): each part on its own
  if (/\s[|•·]\s/.test(t)) {
    const parts = t.split(/(\s[|•·]\s)/);
    const done = parts.map((p, i) => (i % 2 ? p : lookup(p, words, depth + 1)));
    if (done.some((p, i) => i % 2 === 0 && p !== undefined)) return done.map((p, i) => p ?? parts[i]).join('');
  }

  // emoji, symbols or punctuation around a known text: "📦 অর্ডার", "মোট:", "সেভ করুন!"
  const m = t.match(/^([^ঀ-৿A-Za-z0-9]*)(.*?)([\s:：।!?.…,\-–—→←)]*)$/u);
  if (m && (m[1] || m[3]) && m[2]) {
    const inner = lookup(m[2], words, depth + 1);
    if (inner !== undefined) return m[1] + inner + m[3].replace(/।/g, '.');
  }

  const ascii = toAscii(t);
  // only numbers, ৳ and signs left ("৳১,২০০" → "৳1,200")
  if (!BN_LETTER.test(ascii)) return ascii;
  const glued = ascii.replace(/(\d)(টি|টা|জন|পিস|দিন|মাস|বছর|ঘণ্টা|ঘন্টা|মিনিট)/g, '$1 $2');

  // every word a date / time / count word ("23 নভেম্বর 2026", "প্রায় 2 ঘণ্টা আগে", "5টি")
  const parts = glued.split(/(\s+|,)/);
  if (parts.every((p) => !BN_LETTER.test(p) || TOKENS[p] !== undefined)) {
    return norm(parts.map((p) => (BN_LETTER.test(p) ? TOKENS[p] : p)).join('').replace(/\s+,/g, ','));
  }

  // a number before or after a known text: "5 জন সিলেক্টেড", "মোট অর্ডার 12"
  const before = glued.match(/^([৳$]?[\d,.]+%?\s*(?:টি|টা)?)\s*(.+)$/);
  if (before) {
    const rest = lookup(before[2], words, depth + 1);
    if (rest !== undefined) return `${before[1].replace(/\s*(টি|টা)$/, '').trim()} ${rest}`;
  }
  const after = glued.match(/^(.+?)\s*([৳$]?[\d,.]+%?)$/);
  if (after) {
    const rest = lookup(after[1], words, depth + 1);
    if (rest !== undefined) return `${rest} ${after[2]}`;
  }
  // "label: value" where both sides are known or numbers
  const colon = glued.match(/^(.+?)\s*[:：]\s*(.+)$/);
  if (colon) {
    const a = lookup(colon[1], words, depth + 1);
    const b = lookup(colon[2], words, depth + 1);
    if (a !== undefined && b !== undefined) return `${a}: ${b}`;
  }
  // a text with a value inside ("৳{0} কেনাকাটায় ফ্রি ডেলিভারি"): the value as it is (in
  // English where we know it), the words around it in English
  for (const p of words.patterns) {
    const found = t.match(p.re);
    if (!found) continue;
    return p.en.replace(/\$(\d)/g, (_, i: string) => {
      const value = found[Number(i)] ?? '';
      return lookup(value, words, depth + 1) ?? toAscii(value);
    });
  }
  return undefined;
}

/** A list of words and patterns; a later list wins over an earlier one. */
export function buildWords(lists: Array<Record<string, string>>, patternLists: Array<Record<string, string>> = []): Words {
  const dict: Dict = new Map();
  for (const list of lists) for (const [bn, en] of Object.entries(list)) dict.set(norm(bn), en);
  const patterns: Pattern[] = [];
  for (const list of patternLists)
    for (const [bn, en] of Object.entries(list)) {
      // "{0}টি পণ্য" → /^(.+?)টি পণ্য$/ ; the English's {0} → $1
      const source = norm(bn).split(/\{(\d)\}/).map((part, i) => (i % 2 ? '(.+?)' : escapeRe(part))).join('');
      patterns.push({ re: new RegExp(`^${source}$`), en: en.replace(/\{(\d)\}/g, (_, i: string) => `$${Number(i) + 1}`) });
    }
  return { dict, patterns };
}

/** The text in English, keeping its spaces around; null when it stays as it is. */
export function translateText(text: string, words: Words): string | null {
  if (!BANGLA.test(text)) return null;
  const en = lookup(text, words);
  if (en === undefined || en === norm(text)) return null;
  return (text.match(/^\s*/)?.[0] ?? '') + en + (text.match(/\s*$/)?.[0] ?? '');
}

const loading: Partial<Record<PageKind, Promise<Words>>> = {};
function loadWords(kind: PageKind): Promise<Words> {
  if (kind === 'admin')
    return (loading.admin ??= Promise.all([
      import('./admin-en/enginePairs'), import('./admin-en/engineWords'), import('./admin-en/shopWords'),
    ]).then(([pairs, engine, shop]) => buildWords([pairs.default.words, engine.default, shop.default], [pairs.default.patterns])));
  return (loading.site ??= Promise.all([
    import('./admin-en/engineWords'), import('./admin-en/enginePairs'), import('./i18nKnown'), import('./site-en/shopPairs'),
    import('./i18n'),
  ]).then(([engine, pairs, known, shop, i18n]) => ({
    ...buildWords([engine.default, pairs.default.words, known.KNOWN_EN, shop.default.words], [shop.default.patterns, pairs.default.patterns]),
    known: (text: string) => {
      const en = i18n.knownIn('en', text);
      return en !== text ? en : undefined;
    },
  })));
}

// What each text and attribute was before it was put in English, and what was put there:
// a text React has since changed is translated again; Bangla puts back the original.
const origText = new WeakMap<Text, string>();
const shownText = new WeakMap<Text, string>();
const origAttr = new WeakMap<Element, Record<string, string>>();
const shownAttr = new WeakMap<Element, Record<string, string>>();

let words: Words | null = null;
let observer: MutationObserver | null = null;
/** The page in English now (or on its way, while its words load). */
let wanted: PageKind | null = null;

function doText(node: Text, check: boolean) {
  const data = node.data;
  if (!words || shownText.get(node) === data || !BANGLA.test(data)) return;
  if (check && node.parentElement?.closest(SKIP_TEXT)) return;
  const en = translateText(data, words);
  if (en === null) return;
  origText.set(node, data);
  shownText.set(node, en);
  node.data = en;
}

function doAttrs(el: Element, only?: string | null) {
  if (!words) return;
  for (const name of only ? [only] : ATTRS) {
    const value = el.getAttribute(name);
    if (!value || !BANGLA.test(value) || shownAttr.get(el)?.[name] === value) continue;
    const en = translateText(value, words);
    if (en === null) continue;
    origAttr.set(el, { ...origAttr.get(el), [name]: value });
    shownAttr.set(el, { ...shownAttr.get(el), [name]: en });
    el.setAttribute(name, en);
  }
}

function walk(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) return doText(root as Text, true);
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const top = root as Element;
  if (top.closest(NO_TRANSLATE)) return;
  if (top.parentElement?.closest(KEEP_TEXT)) return;
  // the root itself (the walker starts on it without asking acceptNode)
  if (top.matches(KEEP_TEXT)) return doAttrs(top);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => {
      if (n.nodeType !== Node.ELEMENT_NODE) return NodeFilter.FILTER_ACCEPT;
      const el = n as Element;
      if (el.matches(NO_TRANSLATE)) return NodeFilter.FILTER_REJECT;
      if (el.matches(KEEP_TEXT)) {
        doAttrs(el);
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  for (let n: Node | null = walker.currentNode; n; n = walker.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) doText(n as Text, false);
    else doAttrs(n as Element);
  }
}

function restore() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  for (let n: Node | null = walker.currentNode; n; n = walker.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) {
      const text = n as Text;
      const bn = origText.get(text);
      if (bn !== undefined && shownText.get(text) === text.data) text.data = bn;
      shownText.delete(text);
    } else {
      const el = n as Element;
      const bn = origAttr.get(el);
      const shown = shownAttr.get(el);
      if (bn && shown) for (const [name, value] of Object.entries(bn)) if (el.getAttribute(name) === shown[name]) el.setAttribute(name, value);
      shownAttr.delete(el);
    }
  }
}

/** Puts the page in English (its words load once, the first time). */
export function startEnglish(kind: PageKind) {
  if (wanted && wanted !== kind) stopEnglish(wanted);
  wanted = kind;
  document.documentElement.lang = 'en';
  loadWords(kind)
    .then((loaded) => {
      if (wanted !== kind || observer) return;
      words = loaded;
      walk(document.body);
      observer = new MutationObserver((records) => {
        for (const r of records) {
          if (r.type === 'characterData') doText(r.target as Text, true);
          else if (r.type === 'childList') r.addedNodes.forEach(walk);
          else if (r.type === 'attributes' && !(r.target as Element).closest(NO_TRANSLATE)) doAttrs(r.target as Element, r.attributeName);
        }
      });
      observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    })
    .catch(() => {
      /* the words could not load (offline): the page stays Bangla */
    });
}

/** Back to Bangla: every text as it was. */
export function stopEnglish(kind: PageKind) {
  if (wanted !== kind) return;
  wanted = null;
  document.documentElement.lang = 'bn';
  observer?.disconnect();
  observer = null;
  if (words) restore();
  words = null;
}
